// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {GasReserve, Shops} from "@codegen/index.sol";
import {EncounterType} from "@codegen/common.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";

/**
 * @title GoldLib & GasReserve Tests
 * @notice Tests GoldLib functions (goldMint, goldBurn, goldTransfer, goldBalanceOf)
 *         via game system entry points, plus GasReserve table CRUD.
 */
contract GoldLibTest is SetUp {
    function setUp() public override {
        super.setUp();

        // Grant admin to the test contract so we can call admin functions directly
        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);
    }

    // ==================== Helpers ====================

    function _giveGold(bytes32 characterId, uint256 amount) internal {
        vm.prank(deployer);
        world.UD__adminDropGold(characterId, amount);
    }

    function _createShopEncounter(bytes32 characterId, bytes32 _shopId) internal returns (bytes32) {
        bytes32[] memory group1 = new bytes32[](1);
        bytes32[] memory group2 = new bytes32[](1);
        group1[0] = characterId;
        group2[0] = _shopId;
        return world.UD__createEncounter(EncounterType.World, group1, group2);
    }

    // ==================== goldMint Tests ====================

    function test_goldMint_mintsToPlayer() public {
        uint256 balanceBefore = goldToken.balanceOf(bob);
        uint256 supplyBefore = goldToken.totalSupply();
        uint256 mintAmount = 50 ether;

        _giveGold(bobCharacterId, mintAmount);

        uint256 balanceAfter = goldToken.balanceOf(bob);
        uint256 supplyAfter = goldToken.totalSupply();

        assertEq(balanceAfter - balanceBefore, mintAmount, "Player balance should increase by mint amount");
        assertEq(supplyAfter - supplyBefore, mintAmount, "Total supply should increase by mint amount");
    }

    function test_goldMint_emitsTransferEvent() public {
        uint256 mintAmount = 25 ether;
        address goldTokenAddr = address(goldToken);

        // ERC20 Transfer(from, to, value) — mint is Transfer(address(0), recipient, amount)
        vm.expectEmit(true, true, false, true, goldTokenAddr);
        emit IERC20.Transfer(address(0), bob, mintAmount);

        _giveGold(bobCharacterId, mintAmount);
    }

    function test_goldMint_zeroAmount_noOp() public {
        uint256 balanceBefore = goldToken.balanceOf(bob);
        uint256 supplyBefore = goldToken.totalSupply();

        // GoldLib.goldMint returns early if amount == 0, so no state change or event
        _giveGold(bobCharacterId, 0);

        assertEq(goldToken.balanceOf(bob), balanceBefore, "Balance should not change for 0 mint");
        assertEq(goldToken.totalSupply(), supplyBefore, "Total supply should not change for 0 mint");
    }

    // ==================== goldBurn Tests ====================

    function test_goldBurn_burnsFromPlayer() public {
        // Give bob gold
        _giveGold(bobCharacterId, 200 ether);
        uint256 balanceBefore = goldToken.balanceOf(bob);
        uint256 supplyBefore = goldToken.totalSupply();

        // Spawn bob and move to shop position (0,0)
        vm.startPrank(bob);
        world.UD__spawn(bobCharacterId);

        // Approve gold spending for the shop system
        address shopAddr = world.UD__shopSystemAddress();
        goldToken.approve(shopAddr, type(uint256).max);

        // Create shop encounter (shop is at 0,0 from SetUp)
        _createShopEncounter(bobCharacterId, shopId);

        // Buy 1 item from shop — this calls GoldLib.goldBurn internally
        uint256[] memory buyable = Shops.getBuyableItems(shopId);
        uint256 itemIndex = 0;
        uint256 expectedPrice = world.UD__itemMarkup(shopId, buyable[itemIndex]);
        world.UD__buy(1, shopId, itemIndex, bobCharacterId);
        vm.stopPrank();

        uint256 balanceAfter = goldToken.balanceOf(bob);
        uint256 supplyAfter = goldToken.totalSupply();

        assertEq(balanceBefore - balanceAfter, expectedPrice, "Player balance should decrease by item price");
        assertEq(supplyBefore - supplyAfter, expectedPrice, "Total supply should decrease (gold burned)");
    }

    // ==================== goldBalanceOf Tests ====================

    function test_goldBalanceOf_correctBalance() public {
        uint256 amount = 42 ether;

        // Bob gets 5 Gold from enterGame in SetUp, so capture baseline
        uint256 baseline = goldToken.balanceOf(bob);

        _giveGold(bobCharacterId, amount);

        // goldToken.balanceOf reads the same underlying ERC20 balance table
        // that GoldLib.goldBalanceOf reads — they must agree
        assertEq(goldToken.balanceOf(bob), baseline + amount, "goldBalanceOf should reflect minted amount");
    }

    function test_goldBalanceOf_zeroForNewAddress() public {
        address nobody = makeAddr("nobody");
        assertEq(goldToken.balanceOf(nobody), 0, "New address should have 0 gold balance");
    }

    // ==================== goldTransfer Tests ====================

    function test_goldTransfer_movesGold() public {
        // Use GasStation.fundAndCharge which calls GoldLib.goldTransfer internally.
        // fundAndCharge transfers gold FROM the World TO the relayer.
        //
        // Setup:
        // 1. Mint gold to the World address (so it has a balance to transfer from)
        // 2. Set a GasReserve for bob's character
        // 3. Configure a relayer
        // 4. Call fundAndCharge as relayer — triggers goldTransfer(world, world, relayer, amount)

        address payable relayer = getUser();
        vm.label(relayer, "relayer");

        uint256 reserveAmount = 10 ether;
        uint256 chargePerCall = 1 ether;

        // Mint gold to the World so it has a transferable balance
        vm.prank(deployer);
        world.UD__transferGold(worldAddress, reserveAmount);

        // Set GasReserve for bob's character
        GasReserve.set(bobCharacterId, reserveAmount);

        // Configure relayer and charge amount (swapRouter=0 for fallback, relayer=relayer, goldPerGasCharge=1e18)
        vm.prank(deployer);
        world.UD__setGasStationSwapConfig(address(0), address(0), 0, relayer, chargePerCall);

        uint256 worldBalanceBefore = goldToken.balanceOf(worldAddress);
        uint256 relayerBalanceBefore = goldToken.balanceOf(relayer);
        uint256 supplyBefore = goldToken.totalSupply();

        // Call fundAndCharge as relayer — this calls goldTransfer under the hood
        vm.prank(relayer);
        world.UD__fundAndCharge(bob, bobCharacterId);

        uint256 worldBalanceAfter = goldToken.balanceOf(worldAddress);
        uint256 relayerBalanceAfter = goldToken.balanceOf(relayer);
        uint256 supplyAfter = goldToken.totalSupply();

        assertEq(worldBalanceBefore - worldBalanceAfter, chargePerCall, "Sender (World) balance should decrease");
        assertEq(relayerBalanceAfter - relayerBalanceBefore, chargePerCall, "Receiver (relayer) balance should increase");
        assertEq(supplyAfter, supplyBefore, "Total supply should not change for transfer");

        // GasReserve should also be decremented
        assertEq(GasReserve.get(bobCharacterId), reserveAmount - chargePerCall, "GasReserve should be decremented");
    }

    // ==================== GasReserve Table Tests ====================

    function test_gasReserve_initiallyZero() public {
        bytes32 characterId = bytes32("nonexistent");
        assertEq(GasReserve.getBalance(characterId), 0);
    }

    function test_gasReserve_setAndGet() public {
        bytes32 characterId = bytes32("testChar1");

        GasReserve.setBalance(characterId, 100 ether);
        assertEq(GasReserve.getBalance(characterId), 100 ether);

        // Update
        GasReserve.setBalance(characterId, 50 ether);
        assertEq(GasReserve.getBalance(characterId), 50 ether);

        // Zero out
        GasReserve.setBalance(characterId, 0);
        assertEq(GasReserve.getBalance(characterId), 0);
    }

    function test_gasReserve_multipleCharacters() public {
        bytes32 char1 = bytes32("char1");
        bytes32 char2 = bytes32("char2");

        GasReserve.setBalance(char1, 100 ether);
        GasReserve.setBalance(char2, 200 ether);

        assertEq(GasReserve.getBalance(char1), 100 ether);
        assertEq(GasReserve.getBalance(char2), 200 ether);

        // Independent — modifying one doesn't affect the other
        GasReserve.setBalance(char1, 0);
        assertEq(GasReserve.getBalance(char1), 0);
        assertEq(GasReserve.getBalance(char2), 200 ether);
    }

    function test_gasReserve_largeValue() public {
        bytes32 characterId = bytes32("whale");
        uint256 largeAmount = 1_000_000 ether;

        GasReserve.setBalance(characterId, largeAmount);
        assertEq(GasReserve.getBalance(characterId), largeAmount);
    }
}
