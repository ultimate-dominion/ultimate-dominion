// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {
    StatsData,
    Stats,
    GasStationConfig,
    GasStationCooldown,
    GasStationSwapConfig,
    GasReserve
} from "@codegen/index.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {TotalSupply as ERC20TotalSupply} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/TotalSupply.sol";
import {_balancesTableId as _goldBalancesTableId, _totalSupplyTableId as _goldTotalSupplyTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {
    DEFAULT_ETH_PER_GOLD,
    DEFAULT_MAX_GOLD_PER_SWAP,
    DEFAULT_GAS_COOLDOWN,
    GAS_STATION_MIN_LEVEL,
    GOLD_NAMESPACE
} from "../constants.sol";
import {
    GasStationDisabled,
    GasStationCooldownActive,
    GasStationMaxSwapExceeded,
    GasStationInsufficientTreasury,
    GasStationBelowMinLevel,
    GasStationTransferFailed,
    GasStationZeroAmount,
    GasStationNotRelayer,
    InsufficientBalance
} from "../src/Errors.sol";

contract Test_GasStationSystem is Test {
    using stdJson for string;

    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    address payable public alice;
    address payable public bob;
    address payable public relayer;
    uint256 public userNonce = 0;

    IWorld public world;
    address public worldAddress;
    IERC20Mintable public goldToken;

    bytes32 public aliceCharacterId;
    bytes32 public bobCharacterId;

    address gasStationAddress;

    function setUp() public {
        // Read world address from deployment (as deployer for restricted config reads)
        vm.deal(deployer, 100 ether);
        vm.startPrank(deployer);
        worldAddress = vm.envAddress("WORLD_ADDRESS");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        // Create users
        alice = _getUser();
        bob = _getUser();
        relayer = _getUser();
        vm.label(alice, "alice");
        vm.label(bob, "bob");
        vm.label(relayer, "relayer");

        // Get gold token (requires deployer access since UDConfigSys is restricted)
        goldToken = IERC20Mintable(world.UD__getGoldToken());

        // Look up GasStation system address (PostDeploy already granted Gold table access + set config)
        ResourceId gasStationSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "GasStationSys");
        gasStationAddress = Systems.getSystem(gasStationSystemId);

        // Force fallback mode — no Uniswap on local anvil
        GasStationSwapConfig.set(address(0), address(0), 0, address(0), 0);

        // Fund the GasStation treasury with ETH (PostDeploy doesn't fund it)
        (bool sent,) = gasStationAddress.call{value: 10 ether}("");
        require(sent, "Failed to fund GasStation treasury");
        vm.stopPrank();

        // Mint characters as their respective owners (no enterGame needed)
        vm.prank(alice);
        aliceCharacterId = world.UD__mintCharacter(alice, bytes32("Alice"), "test_uri_alice");

        vm.prank(bob);
        bobCharacterId = world.UD__mintCharacter(bob, bytes32("Bob"), "test_uri_bob");
    }

    // ==================== Helpers ====================

    function _getUser() internal returns (address payable) {
        address payable user = payable(address(uint160(uint256(keccak256(abi.encodePacked(userNonce++))))));
        vm.deal(user, 100 ether);
        return user;
    }

    function _setLevel(bytes32 characterId, uint256 level) internal {
        StatsData memory stats = world.UD__getStats(characterId);
        stats.level = level;
        vm.prank(deployer);
        world.UD__adminSetStats(characterId, stats);
    }

    function _giveGold(bytes32 characterId, uint256 amount) internal {
        vm.prank(deployer);
        world.UD__adminDropGold(characterId, amount);
    }

    // ==================== buyGas Tests (Fallback/Treasury Path) ====================

    function test_buyGas_succeedsAtLevel3() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        uint256 goldBefore = goldToken.balanceOf(bob);
        uint256 ethBefore = bob.balance;

        uint256 goldToSwap = 50 ether;
        uint256 expectedEth = (goldToSwap * DEFAULT_ETH_PER_GOLD) / 1e18;

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, goldToSwap, 0);

        uint256 goldAfter = goldToken.balanceOf(bob);
        uint256 ethAfter = bob.balance;

        assertEq(goldBefore - goldAfter, goldToSwap, "Gold not deducted correctly");
        assertEq(ethAfter - ethBefore, expectedEth, "ETH not received correctly");
    }

    function test_buyGas_correctExchangeRate() public {
        _setLevel(bobCharacterId, 5);
        _giveGold(bobCharacterId, 200 ether);

        uint256 ethBefore = bob.balance;

        // Swap exactly 100 Gold
        uint256 goldToSwap = 100 ether; // 100 Gold in 1e18 units
        uint256 expectedEth = (goldToSwap * DEFAULT_ETH_PER_GOLD) / 1e18;
        // With DEFAULT_ETH_PER_GOLD = 1e12, 100e18 * 1e12 / 1e18 = 100e12 = 0.0001 ETH

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, goldToSwap, 0);

        assertEq(bob.balance - ethBefore, expectedEth, "Exchange rate incorrect");
        assertEq(expectedEth, 100e12, "Expected 0.0001 ETH for 100 Gold");
    }

    function test_buyGas_revertsIfBelowLevel3() public {
        _setLevel(bobCharacterId, 2);
        _giveGold(bobCharacterId, 100 ether);

        vm.prank(bob);
        vm.expectRevert(GasStationBelowMinLevel.selector);
        world.UD__buyGas(bobCharacterId, 50 ether, 0);
    }

    function test_buyGas_revertsIfLevel0() public {
        // Level 0 by default after mint (no stats set)
        _giveGold(bobCharacterId, 100 ether);

        vm.prank(bob);
        vm.expectRevert(GasStationBelowMinLevel.selector);
        world.UD__buyGas(bobCharacterId, 50 ether, 0);
    }

    function test_buyGas_revertsIfCooldownActive() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 200 ether);

        // First swap should succeed
        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, 50 ether, 0);

        // Second swap immediately should fail (cooldown)
        vm.prank(bob);
        vm.expectRevert(GasStationCooldownActive.selector);
        world.UD__buyGas(bobCharacterId, 50 ether, 0);
    }

    function test_buyGas_succeedsAfterCooldown() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 200 ether);

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, 50 ether, 0);

        // Fast-forward past the cooldown
        vm.warp(block.timestamp + DEFAULT_GAS_COOLDOWN + 1);

        // Second swap should succeed now
        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, 50 ether, 0);
    }

    function test_buyGas_revertsIfInsufficientGold() public {
        _setLevel(bobCharacterId, 3);
        // Bob has no gold by default (we didn't call _giveGold)

        vm.prank(bob);
        vm.expectRevert(InsufficientBalance.selector);
        world.UD__buyGas(bobCharacterId, 1 ether, 0);
    }

    function test_buyGas_revertsIfTreasuryEmpty() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 500 ether);

        // Drain the treasury first
        vm.prank(deployer);
        world.UD__withdrawGasTreasury(gasStationAddress.balance);

        vm.prank(bob);
        vm.expectRevert(GasStationInsufficientTreasury.selector);
        world.UD__buyGas(bobCharacterId, 500 ether, 0);
    }

    function test_buyGas_revertsIfMaxSwapExceeded() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 1000 ether);

        vm.prank(bob);
        vm.expectRevert(GasStationMaxSwapExceeded.selector);
        world.UD__buyGas(bobCharacterId, DEFAULT_MAX_GOLD_PER_SWAP + 1, 0);
    }

    function test_buyGas_revertsIfDisabled() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        // Disable gas station
        vm.prank(deployer);
        GasStationConfig.setEnabled(false);

        vm.prank(bob);
        vm.expectRevert(GasStationDisabled.selector);
        world.UD__buyGas(bobCharacterId, 50 ether, 0);
    }

    function test_buyGas_revertsIfZeroAmount() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        vm.prank(bob);
        vm.expectRevert(GasStationZeroAmount.selector);
        world.UD__buyGas(bobCharacterId, 0, 0);
    }

    function test_buyGas_revertsIfNotOwner() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        // Alice tries to use bob's character
        vm.prank(alice);
        vm.expectRevert(); // "Not character owner"
        world.UD__buyGas(bobCharacterId, 50 ether, 0);
    }

    function test_buyGas_updatesCooldownTimestamp() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        uint256 timeBefore = block.timestamp;

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, 50 ether, 0);

        uint256 lastSwap = GasStationCooldown.getLastSwap(bob);
        assertEq(lastSwap, timeBefore, "Cooldown timestamp not set");
    }

    function test_buyGas_maxSwapAtLimit() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, DEFAULT_MAX_GOLD_PER_SWAP);

        uint256 ethBefore = bob.balance;
        uint256 expectedEth = (DEFAULT_MAX_GOLD_PER_SWAP * DEFAULT_ETH_PER_GOLD) / 1e18;

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, DEFAULT_MAX_GOLD_PER_SWAP, 0);

        assertEq(bob.balance - ethBefore, expectedEth, "Max swap failed");
    }

    // ==================== Config Tests ====================

    function test_setConfig_onlyAdmin() public {
        // Non-admin should fail
        vm.prank(bob);
        vm.expectRevert();
        world.UD__setGasStationConfig(2e12, 1000 ether, 120, true);
    }

    function test_setConfig_updatesValues() public {
        vm.prank(deployer);
        world.UD__setGasStationConfig(2e12, 1000 ether, 120, false);

        assertEq(GasStationConfig.getEthPerGold(), 2e12, "ethPerGold not updated");
        assertEq(GasStationConfig.getMaxGoldPerSwap(), 1000 ether, "maxGoldPerSwap not updated");
        assertEq(GasStationConfig.getCooldownSeconds(), 120, "cooldownSeconds not updated");
        assertEq(GasStationConfig.getEnabled(), false, "enabled not updated");
    }

    function test_buyGas_usesUpdatedRate() public {
        // Set a higher rate: 2e12 wei per gold
        vm.prank(deployer);
        world.UD__setGasStationConfig(2e12, DEFAULT_MAX_GOLD_PER_SWAP, DEFAULT_GAS_COOLDOWN, true);

        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        uint256 ethBefore = bob.balance;
        uint256 goldToSwap = 50 ether;
        uint256 expectedEth = (goldToSwap * 2e12) / 1e18;

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, goldToSwap, 0);

        assertEq(bob.balance - ethBefore, expectedEth, "Updated rate not applied");
    }

    // ==================== Swap Config Tests ====================

    function test_setSwapConfig_onlyAdmin() public {
        vm.prank(bob);
        vm.expectRevert();
        world.UD__setGasStationSwapConfig(address(1), address(2), 3000, address(3), 1e18);
    }

    function test_setSwapConfig_updatesValues() public {
        vm.prank(deployer);
        world.UD__setGasStationSwapConfig(address(1), address(2), 3000, relayer, 5e18);

        assertEq(GasStationSwapConfig.getSwapRouter(), address(1), "swapRouter not updated");
        assertEq(GasStationSwapConfig.getWeth(), address(2), "weth not updated");
        assertEq(GasStationSwapConfig.getPoolFee(), 3000, "poolFee not updated");
        assertEq(GasStationSwapConfig.getRelayerAddress(), relayer, "relayerAddress not updated");
        assertEq(GasStationSwapConfig.getGoldPerGasCharge(), 5e18, "goldPerGasCharge not updated");
    }

    // ==================== Treasury Tests ====================

    function test_fundTreasury() public {
        uint256 balanceBefore = gasStationAddress.balance;

        vm.prank(deployer);
        world.UD__fundGasTreasury{value: 5 ether}();

        assertEq(gasStationAddress.balance, balanceBefore + 5 ether, "Treasury not funded");
    }

    function test_fundTreasury_onlyAdmin() public {
        vm.prank(bob);
        vm.expectRevert();
        world.UD__fundGasTreasury{value: 1 ether}();
    }

    function test_withdrawTreasury() public {
        uint256 treasuryBefore = gasStationAddress.balance;

        vm.prank(deployer);
        world.UD__withdrawGasTreasury(1 ether);

        assertEq(gasStationAddress.balance, treasuryBefore - 1 ether, "Treasury not reduced");
    }

    function test_withdrawTreasury_onlyAdmin() public {
        vm.prank(bob);
        vm.expectRevert();
        world.UD__withdrawGasTreasury(1 ether);
    }

    function test_withdrawTreasury_revertsIfInsufficientBalance() public {
        uint256 balance = gasStationAddress.balance;

        vm.prank(deployer);
        vm.expectRevert(); // "Insufficient treasury"
        world.UD__withdrawGasTreasury(balance + 1 ether);
    }

    function test_gasTreasuryBalance() public {
        uint256 balance = world.UD__gasTreasuryBalance();
        assertEq(balance, gasStationAddress.balance, "Treasury balance mismatch");
    }

    function test_buyGas_revertsIfInsufficientWallet() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 10 ether);

        vm.prank(bob);
        vm.expectRevert(InsufficientBalance.selector);
        world.UD__buyGas(bobCharacterId, 50 ether, 0); // needs 50, has 10
    }

    // ==================== Edge Cases ====================

    function test_buyGas_exactlyAtLevel3() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        // Should succeed at exactly level 3
        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, 10 ether, 0);
    }

    function test_buyGas_fallback_burnsTotalSupply() public {
        // In fallback mode (swapRouter == address(0)), gold is burned
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        uint256 supplyBefore = goldToken.totalSupply();

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, 50 ether, 0);

        uint256 supplyAfter = goldToken.totalSupply();
        assertEq(supplyBefore - supplyAfter, 50 ether, "Total supply not reduced in fallback mode");
    }

    function test_buyGas_treasuryReducedByExactAmount() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        uint256 treasuryBefore = gasStationAddress.balance;
        uint256 goldToSwap = 50 ether;
        uint256 expectedEth = (goldToSwap * DEFAULT_ETH_PER_GOLD) / 1e18;

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, goldToSwap, 0);

        assertEq(treasuryBefore - gasStationAddress.balance, expectedEth, "Treasury reduction incorrect");
    }

    // ==================== fundAndCharge Tests ====================

    /// @dev Sets up relayer config, GasReserve for a character, and mints Gold to worldAddress to back the reserve.
    function _setupFundAndCharge(bytes32 characterId, uint256 reserveAmount, uint256 worldGoldAmount) internal {
        vm.startPrank(deployer);
        // Configure relayer with 1 Gold per gas charge
        GasStationSwapConfig.set(address(0), address(0), 0, relayer, 1 ether);

        // Set up GasReserve for the character
        GasReserve.setBalance(characterId, reserveAmount);

        // Mint Gold to worldAddress by writing directly to ERC20 tables
        ResourceId balancesTableId = _goldBalancesTableId(GOLD_NAMESPACE);
        ResourceId totalSupplyTableId = _goldTotalSupplyTableId(GOLD_NAMESPACE);
        uint256 currentWorldBalance = ERC20Balances.get(balancesTableId, worldAddress);
        ERC20Balances.set(balancesTableId, worldAddress, currentWorldBalance + worldGoldAmount);
        uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
        ERC20TotalSupply.set(totalSupplyTableId, currentSupply + worldGoldAmount);
        vm.stopPrank();
    }

    function test_fundAndCharge_fullReserve() public {
        uint256 reserveAmount = 5 ether;
        uint256 chargeAmount = 1 ether; // goldPerGasCharge
        _setupFundAndCharge(bobCharacterId, reserveAmount, reserveAmount);

        uint256 worldGoldBefore = goldToken.balanceOf(worldAddress);
        uint256 relayerGoldBefore = goldToken.balanceOf(relayer);
        uint256 supplyBefore = goldToken.totalSupply();

        vm.prank(relayer);
        world.UD__fundAndCharge(bob, bobCharacterId);

        // Reserve decreased by chargeAmount
        assertEq(GasReserve.getBalance(bobCharacterId), reserveAmount - chargeAmount, "Reserve not decreased");
        // Relayer Gold increased by chargeAmount
        assertEq(goldToken.balanceOf(relayer) - relayerGoldBefore, chargeAmount, "Relayer Gold not credited");
        // World Gold decreased by chargeAmount
        assertEq(worldGoldBefore - goldToken.balanceOf(worldAddress), chargeAmount, "World Gold not deducted");
        // Total supply unchanged (transfer, not mint/burn)
        assertEq(goldToken.totalSupply(), supplyBefore, "Total supply should not change");
    }

    function test_fundAndCharge_partialReserve() public {
        uint256 reserveAmount = 0.5 ether; // Less than 1 ether chargeAmount
        _setupFundAndCharge(bobCharacterId, reserveAmount, reserveAmount);

        uint256 relayerGoldBefore = goldToken.balanceOf(relayer);

        vm.prank(relayer);
        world.UD__fundAndCharge(bob, bobCharacterId);

        // Reserve should be fully drained
        assertEq(GasReserve.getBalance(bobCharacterId), 0, "Reserve should be 0 after partial charge");
        // Relayer gets the partial amount
        assertEq(goldToken.balanceOf(relayer) - relayerGoldBefore, reserveAmount, "Relayer should get partial amount");
    }

    function test_fundAndCharge_emptyReserve() public {
        // Reserve = 0, but still mint some Gold to world so we can verify no movement
        _setupFundAndCharge(bobCharacterId, 0, 10 ether);

        uint256 worldGoldBefore = goldToken.balanceOf(worldAddress);
        uint256 relayerGoldBefore = goldToken.balanceOf(relayer);

        vm.prank(relayer);
        world.UD__fundAndCharge(bob, bobCharacterId); // Should no-op, no revert

        // No Gold movement
        assertEq(goldToken.balanceOf(worldAddress), worldGoldBefore, "World Gold should not change");
        assertEq(goldToken.balanceOf(relayer), relayerGoldBefore, "Relayer Gold should not change");
        assertEq(GasReserve.getBalance(bobCharacterId), 0, "Reserve should stay 0");
    }

    function test_fundAndCharge_noCharacter() public {
        // Player with no character (address that never minted)
        address noCharPlayer = _getUser();
        bytes32 fakeCharId = bytes32("nonexistent");
        _setupFundAndCharge(fakeCharId, 5 ether, 5 ether);

        uint256 worldGoldBefore = goldToken.balanceOf(worldAddress);
        uint256 relayerGoldBefore = goldToken.balanceOf(relayer);

        vm.prank(relayer);
        world.UD__fundAndCharge(noCharPlayer, bytes32(0)); // No character — no-op

        assertEq(goldToken.balanceOf(worldAddress), worldGoldBefore, "World Gold should not change");
        assertEq(goldToken.balanceOf(relayer), relayerGoldBefore, "Relayer Gold should not change");
    }

    function test_fundAndCharge_mismatchedCharacter() public {
        // Bob's character exists, but we pass alice's characterId for bob's address
        _setupFundAndCharge(aliceCharacterId, 5 ether, 5 ether);

        uint256 worldGoldBefore = goldToken.balanceOf(worldAddress);
        uint256 relayerGoldBefore = goldToken.balanceOf(relayer);

        vm.prank(relayer);
        world.UD__fundAndCharge(bob, aliceCharacterId); // Mismatched — no-op

        assertEq(goldToken.balanceOf(worldAddress), worldGoldBefore, "World Gold should not change");
        assertEq(goldToken.balanceOf(relayer), relayerGoldBefore, "Relayer Gold should not change");
    }

    function test_fundAndCharge_revertsIfNotRelayer() public {
        _setupFundAndCharge(bobCharacterId, 5 ether, 5 ether);

        vm.prank(alice); // Not the relayer
        vm.expectRevert(GasStationNotRelayer.selector);
        world.UD__fundAndCharge(bob, bobCharacterId);
    }

    function test_fundAndCharge_supplyUnchanged() public {
        uint256 reserveAmount = 3 ether;
        _setupFundAndCharge(bobCharacterId, reserveAmount, reserveAmount);

        uint256 supplyBefore = goldToken.totalSupply();

        vm.prank(relayer);
        world.UD__fundAndCharge(bob, bobCharacterId);

        // Total supply must not change — it's a transfer, not mint/burn
        assertEq(goldToken.totalSupply(), supplyBefore, "Total supply must not change on fundAndCharge");
    }
}
