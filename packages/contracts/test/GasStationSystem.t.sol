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
    GasStationCooldown
} from "@codegen/index.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {
    DEFAULT_ETH_PER_GOLD,
    DEFAULT_MAX_GOLD_PER_SWAP,
    DEFAULT_GAS_COOLDOWN,
    GAS_STATION_MIN_LEVEL
} from "../constants.sol";
import {
    GasStationDisabled,
    GasStationCooldownActive,
    GasStationMaxSwapExceeded,
    GasStationInsufficientTreasury,
    GasStationBelowMinLevel,
    GasStationTransferFailed,
    GasStationZeroAmount,
    InsufficientBalance
} from "../src/Errors.sol";

contract Test_GasStationSystem is Test {
    using stdJson for string;

    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    address payable public alice;
    address payable public bob;
    uint256 public userNonce = 0;

    IWorld public world;
    address public worldAddress;
    IERC20Mintable public goldToken;

    bytes32 public aliceCharacterId;
    bytes32 public bobCharacterId;

    address gasStationAddress;

    function setUp() public {
        // Read world address from deployment (as deployer for restricted config reads)
        vm.startPrank(deployer);
        string memory json = vm.readFile(
            string(abi.encodePacked(vm.projectRoot(), "/deploys/31337/latest.json"))
        );
        worldAddress = json.readAddress(".worldAddress");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        // Create users
        alice = _getUser();
        bob = _getUser();
        vm.label(alice, "alice");
        vm.label(bob, "bob");

        // Get gold token (requires deployer access since UDConfigSys is restricted)
        goldToken = IERC20Mintable(world.UD__getGoldToken());

        // Look up GasStation system address (PostDeploy already granted Gold table access + set config)
        ResourceId gasStationSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "GasStationSys");
        gasStationAddress = Systems.getSystem(gasStationSystemId);

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

    // ==================== buyGas Tests ====================

    function test_buyGas_succeedsAtLevel3() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        uint256 goldBefore = goldToken.balanceOf(bob);
        uint256 ethBefore = bob.balance;

        uint256 goldToSwap = 50 ether;
        uint256 expectedEth = (goldToSwap * DEFAULT_ETH_PER_GOLD) / 1e18;

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, goldToSwap);

        uint256 goldAfter = goldToken.balanceOf(bob);
        uint256 ethAfter = bob.balance;

        assertEq(goldBefore - goldAfter, goldToSwap, "Gold not burned correctly");
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
        world.UD__buyGas(bobCharacterId, goldToSwap);

        assertEq(bob.balance - ethBefore, expectedEth, "Exchange rate incorrect");
        assertEq(expectedEth, 100e12, "Expected 0.0001 ETH for 100 Gold");
    }

    function test_buyGas_revertsIfBelowLevel3() public {
        _setLevel(bobCharacterId, 2);
        _giveGold(bobCharacterId, 100 ether);

        vm.prank(bob);
        vm.expectRevert(GasStationBelowMinLevel.selector);
        world.UD__buyGas(bobCharacterId, 50 ether);
    }

    function test_buyGas_revertsIfLevel0() public {
        // Level 0 by default after mint (no stats set)
        _giveGold(bobCharacterId, 100 ether);

        vm.prank(bob);
        vm.expectRevert(GasStationBelowMinLevel.selector);
        world.UD__buyGas(bobCharacterId, 50 ether);
    }

    function test_buyGas_revertsIfCooldownActive() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 200 ether);

        // First swap should succeed
        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, 50 ether);

        // Second swap immediately should fail (cooldown)
        vm.prank(bob);
        vm.expectRevert(GasStationCooldownActive.selector);
        world.UD__buyGas(bobCharacterId, 50 ether);
    }

    function test_buyGas_succeedsAfterCooldown() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 200 ether);

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, 50 ether);

        // Fast-forward past the cooldown
        vm.warp(block.timestamp + DEFAULT_GAS_COOLDOWN + 1);

        // Second swap should succeed now
        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, 50 ether);
    }

    function test_buyGas_revertsIfInsufficientGold() public {
        _setLevel(bobCharacterId, 3);
        // Bob has no gold by default (we didn't call _giveGold)

        vm.prank(bob);
        vm.expectRevert(InsufficientBalance.selector);
        world.UD__buyGas(bobCharacterId, 1 ether);
    }

    function test_buyGas_revertsIfTreasuryEmpty() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 500 ether);

        // Drain the treasury first
        vm.prank(deployer);
        world.UD__withdrawGasTreasury(gasStationAddress.balance);

        vm.prank(bob);
        vm.expectRevert(GasStationInsufficientTreasury.selector);
        world.UD__buyGas(bobCharacterId, 500 ether);
    }

    function test_buyGas_revertsIfMaxSwapExceeded() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 1000 ether);

        vm.prank(bob);
        vm.expectRevert(GasStationMaxSwapExceeded.selector);
        world.UD__buyGas(bobCharacterId, DEFAULT_MAX_GOLD_PER_SWAP + 1);
    }

    function test_buyGas_revertsIfDisabled() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        // Disable gas station
        vm.prank(deployer);
        GasStationConfig.setEnabled(false);

        vm.prank(bob);
        vm.expectRevert(GasStationDisabled.selector);
        world.UD__buyGas(bobCharacterId, 50 ether);
    }

    function test_buyGas_revertsIfZeroAmount() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        vm.prank(bob);
        vm.expectRevert(GasStationZeroAmount.selector);
        world.UD__buyGas(bobCharacterId, 0);
    }

    function test_buyGas_revertsIfNotOwner() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        // Alice tries to use bob's character
        vm.prank(alice);
        vm.expectRevert(); // "Not character owner"
        world.UD__buyGas(bobCharacterId, 50 ether);
    }

    function test_buyGas_updatesCooldownTimestamp() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        uint256 timeBefore = block.timestamp;

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, 50 ether);

        uint256 lastSwap = GasStationCooldown.getLastSwap(bob);
        assertEq(lastSwap, timeBefore, "Cooldown timestamp not set");
    }

    function test_buyGas_maxSwapAtLimit() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, DEFAULT_MAX_GOLD_PER_SWAP);

        uint256 ethBefore = bob.balance;
        uint256 expectedEth = (DEFAULT_MAX_GOLD_PER_SWAP * DEFAULT_ETH_PER_GOLD) / 1e18;

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, DEFAULT_MAX_GOLD_PER_SWAP);

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
        world.UD__buyGas(bobCharacterId, goldToSwap);

        assertEq(bob.balance - ethBefore, expectedEth, "Updated rate not applied");
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

    // ==================== Edge Cases ====================

    function test_buyGas_exactlyAtLevel3() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        // Should succeed at exactly level 3
        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, 10 ether);
    }

    function test_buyGas_burnsTotalSupply() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        uint256 supplyBefore = goldToken.totalSupply();

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, 50 ether);

        uint256 supplyAfter = goldToken.totalSupply();
        assertEq(supplyBefore - supplyAfter, 50 ether, "Total supply not reduced");
    }

    function test_buyGas_treasuryReducedByExactAmount() public {
        _setLevel(bobCharacterId, 3);
        _giveGold(bobCharacterId, 100 ether);

        uint256 treasuryBefore = gasStationAddress.balance;
        uint256 goldToSwap = 50 ether;
        uint256 expectedEth = (goldToSwap * DEFAULT_ETH_PER_GOLD) / 1e18;

        vm.prank(bob);
        world.UD__buyGas(bobCharacterId, goldToSwap);

        assertEq(treasuryBefore - gasStationAddress.balance, expectedEth, "Treasury reduction incorrect");
    }
}
