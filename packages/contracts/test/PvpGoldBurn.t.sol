// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, EncounterType} from "@codegen/common.sol";
import {StatsData, Stats, StarterItemsData, GasReserve} from "@codegen/index.sol";
import {Action} from "@interfaces/Structs.sol";
import {_mobSystemId} from "../src/utils.sol";
import {_balancesTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {GOLD_NAMESPACE} from "../constants.sol";
import {ResourceId} from "@latticexyz/world/src/WorldResourceId.sol";

/**
 * @title Test_PvpGoldBurn
 * @notice Commit 4: Real burns for death/flee/PvP.
 *
 * Cases:
 *   1. PvE death burns 5% of wallet Gold (not escrow)
 *   2. PvE death with 0 wallet Gold is a no-op
 *   3. PvP death: losers lose 50% wallet Gold — 10% burned, 40% to winners
 *   4. PvP death with 0 wallet Gold: no revert, no-op
 *   5. PvE flee burns 5% of wallet Gold
 *   6. PvP flee: 10% of wallet — 5% burned, 5% to opponent
 */
contract Test_PvpGoldBurn is SetUp {
    bytes32 entityId;

    function setUp() public override {
        super.setUp();

        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);

        vm.prank(deployer);
        world.grantAccess(_mobSystemId("UD"), address(this));

        // spawn bob
        vm.prank(bob);
        world.UD__spawn(bobCharacterId);

        // equip bob's starter items
        StarterItemsData memory starterDat = world.UD__getStarterItems(Classes.Mage);
        vm.prank(bob);
        world.UD__equipItems(bobCharacterId, starterDat.itemIds);
    }

    /// @notice Helper: set up alice (rollStats, enterGame, spawn, equip)
    function _setupAlice() internal {
        vm.startPrank(alice);
        world.UD__rollStats(alicesRandomness, alicesCharacterId, Classes.Rogue);
        world.UD__enterGame(alicesCharacterId, newWeaponId, newArmorId);
        vm.stopPrank();

        vm.prank(alice);
        world.UD__spawn(alicesCharacterId);

        StarterItemsData memory starterDat = world.UD__getStarterItems(Classes.Rogue);
        vm.prank(alice);
        world.UD__equipItems(alicesCharacterId, starterDat.itemIds);
    }

    /// @notice Helper: drain a player's Gold balance to 0 via direct table write
    function _drainGold(address player) internal {
        ResourceId goldBalancesTableId = _balancesTableId(GOLD_NAMESPACE);
        ERC20Balances.set(goldBalancesTableId, player, 0);
        assertEq(goldToken.balanceOf(player), 0, "Player should have 0 Gold after drain");
    }

    // ===== 1. PvE death burns 5% of wallet Gold =====
    function test_pveDeath_burnsWalletGold() public {
        // Give bob wallet Gold via admin
        vm.prank(deployer);
        world.UD__adminDropGold(bobCharacterId, 100 ether);
        uint256 walletBefore = goldToken.balanceOf(bob);

        // Make bob weak so the mob kills him
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.agility = 1;
        bobStats.strength = 1;
        bobStats.intelligence = 1;
        bobStats.currentHp = 1;
        world.UD__adminSetStats(bobCharacterId, bobStats);

        // Spawn a strong mob
        entityId = world.UD__spawnMob(5, 1, 0, 1);
        StatsData memory mobStats = Stats.get(entityId);
        mobStats.agility = 50;
        mobStats.strength = 50;
        mobStats.currentHp = 200;
        world.UD__adminSetStats(entityId, mobStats);

        bytes32[] memory defenders = new bytes32[](1);
        defenders[0] = entityId;
        bytes32[] memory attackers = new bytes32[](1);
        attackers[0] = bobCharacterId;

        vm.prank(bob);
        world.UD__move(bobCharacterId, 0, 1);

        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);

        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            attackerEntityId: bobCharacterId,
            defenderEntityId: entityId,
            itemId: startingConsumableId
        });

        while (world.UD__getEncounter(encounterId).end == 0) {
            vm.prank(bob);
            world.UD__endTurn(encounterId, bobCharacterId, actions);
        }

        StatsData memory finalStats = world.UD__getStats(bobCharacterId);
        assertTrue(finalStats.currentHp <= 0, "Bob should have died - increase mob stats if flaky");

        uint256 walletAfter = goldToken.balanceOf(bob);
        uint256 expectedPenalty = walletBefore / 20; // 5%
        assertEq(walletBefore - walletAfter, expectedPenalty, "Death should burn 5% of wallet Gold");
    }

    // ===== 2. PvE death with 0 wallet Gold is a no-op =====
    function test_pveDeath_zeroGold_noOp() public {
        // Drain bob's Gold to truly test 0 Gold scenario
        _drainGold(bob);

        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.agility = 1;
        bobStats.strength = 1;
        bobStats.intelligence = 1;
        bobStats.currentHp = 1;
        world.UD__adminSetStats(bobCharacterId, bobStats);

        entityId = world.UD__spawnMob(5, 1, 0, 1);
        StatsData memory mobStats = Stats.get(entityId);
        mobStats.agility = 50;
        mobStats.strength = 50;
        mobStats.currentHp = 200;
        world.UD__adminSetStats(entityId, mobStats);

        bytes32[] memory defenders = new bytes32[](1);
        defenders[0] = entityId;
        bytes32[] memory attackers = new bytes32[](1);
        attackers[0] = bobCharacterId;

        vm.prank(bob);
        world.UD__move(bobCharacterId, 0, 1);

        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);

        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            attackerEntityId: bobCharacterId,
            defenderEntityId: entityId,
            itemId: startingConsumableId
        });

        // Should not revert even with 0 Gold
        while (world.UD__getEncounter(encounterId).end == 0) {
            vm.prank(bob);
            world.UD__endTurn(encounterId, bobCharacterId, actions);
        }

        StatsData memory finalStats = world.UD__getStats(bobCharacterId);
        assertTrue(finalStats.currentHp <= 0, "Bob should have died - increase mob stats if flaky");
        assertEq(goldToken.balanceOf(bob), 0, "Gold should still be 0 after death with no Gold");
    }

    // ===== 3. PvP death: losers lose wallet Gold — 10% burned, 40% to winners =====
    function test_pvpDeath_goldRedistribution() public {
        _setupAlice();

        // Give bob lots of Gold
        vm.prank(deployer);
        world.UD__adminDropGold(bobCharacterId, 100 ether);

        // Buff alice to guarantee she wins
        StatsData memory aliceStats = world.UD__getStats(alicesCharacterId);
        aliceStats.agility = 50;
        aliceStats.strength = 50;
        aliceStats.intelligence = 50;
        aliceStats.currentHp = 500;
        world.UD__adminSetStats(alicesCharacterId, aliceStats);

        // Nerf bob so he dies
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.agility = 1;
        bobStats.strength = 1;
        bobStats.intelligence = 1;
        bobStats.currentHp = 1;
        world.UD__adminSetStats(bobCharacterId, bobStats);

        // Move both to PvP zone (x >= 5)
        vm.prank(bob);
        world.UD__move(bobCharacterId, 5, 5);
        vm.prank(alice);
        world.UD__move(alicesCharacterId, 5, 5);

        uint256 bobGoldBefore = goldToken.balanceOf(bob);
        uint256 aliceGoldBefore = goldToken.balanceOf(alice);

        bytes32[] memory attackers = new bytes32[](1);
        attackers[0] = alicesCharacterId;
        bytes32[] memory defenders = new bytes32[](1);
        defenders[0] = bobCharacterId;

        vm.prank(alice);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvP, attackers, defenders);

        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            attackerEntityId: alicesCharacterId,
            defenderEntityId: bobCharacterId,
            itemId: startingConsumableId
        });

        while (world.UD__getEncounter(encounterId).end == 0) {
            vm.prank(alice);
            world.UD__endTurn(encounterId, alicesCharacterId, actions);
        }

        StatsData memory bobFinal = world.UD__getStats(bobCharacterId);
        assertTrue(bobFinal.currentHp <= 0, "Bob should have died - increase alice stats if flaky");

        uint256 bobGoldAfter = goldToken.balanceOf(bob);
        uint256 aliceGoldAfter = goldToken.balanceOf(alice);

        // Bob should have lost 50% of his Gold
        uint256 totalLoss = bobGoldBefore / 2;
        uint256 burned = totalLoss / 5; // 10% of wallet
        uint256 toWinner = totalLoss - burned; // 40% of wallet

        assertEq(bobGoldBefore - bobGoldAfter, totalLoss, "Loser should lose 50% of wallet Gold");
        assertEq(aliceGoldAfter - aliceGoldBefore, toWinner, "Winner should receive 40% of loser's Gold");
    }

    // ===== 4. PvP death with 0 wallet Gold: no revert, no-op =====
    function test_pvpDeath_zeroGold_noOp() public {
        _setupAlice();

        // Drain bob's Gold to 0
        _drainGold(bob);

        uint256 aliceGoldBefore = goldToken.balanceOf(alice);

        // Buff alice to guarantee she wins
        StatsData memory aliceStats = world.UD__getStats(alicesCharacterId);
        aliceStats.agility = 50;
        aliceStats.strength = 50;
        aliceStats.intelligence = 50;
        aliceStats.currentHp = 500;
        world.UD__adminSetStats(alicesCharacterId, aliceStats);

        // Nerf bob so he dies
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.agility = 1;
        bobStats.strength = 1;
        bobStats.intelligence = 1;
        bobStats.currentHp = 1;
        world.UD__adminSetStats(bobCharacterId, bobStats);

        // Move both to PvP zone (x >= 5)
        vm.prank(bob);
        world.UD__move(bobCharacterId, 5, 5);
        vm.prank(alice);
        world.UD__move(alicesCharacterId, 5, 5);

        bytes32[] memory attackers = new bytes32[](1);
        attackers[0] = alicesCharacterId;
        bytes32[] memory defenders = new bytes32[](1);
        defenders[0] = bobCharacterId;

        vm.prank(alice);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvP, attackers, defenders);

        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            attackerEntityId: alicesCharacterId,
            defenderEntityId: bobCharacterId,
            itemId: startingConsumableId
        });

        // Should not revert even with 0 Gold
        while (world.UD__getEncounter(encounterId).end == 0) {
            vm.prank(alice);
            world.UD__endTurn(encounterId, alicesCharacterId, actions);
        }

        StatsData memory bobFinal = world.UD__getStats(bobCharacterId);
        assertTrue(bobFinal.currentHp <= 0, "Bob should have died - increase alice stats if flaky");
        assertEq(goldToken.balanceOf(bob), 0, "Bob Gold should still be 0");
        assertEq(goldToken.balanceOf(alice), aliceGoldBefore, "Alice Gold should be unchanged when loser has 0");
    }

    // ===== 5. PvE flee burns 5% of wallet Gold =====
    function test_pveFlee_burnsWalletGold() public {
        // Give bob 100 Gold
        vm.prank(deployer);
        world.UD__adminDropGold(bobCharacterId, 100 ether);
        uint256 walletBefore = goldToken.balanceOf(bob);

        // Spawn a mob
        entityId = world.UD__spawnMob(5, 1, 0, 1);

        bytes32[] memory defenders = new bytes32[](1);
        defenders[0] = entityId;
        bytes32[] memory attackers = new bytes32[](1);
        attackers[0] = bobCharacterId;

        vm.prank(bob);
        world.UD__move(bobCharacterId, 0, 1);

        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvE, attackers, defenders);

        // Bob flees as attacker on turn 1 (currentTurn == 1)
        vm.prank(bob);
        world.UD__fleePvp(bobCharacterId);

        uint256 walletAfter = goldToken.balanceOf(bob);
        uint256 expectedPenalty = walletBefore / 20; // 5%
        assertEq(walletBefore - walletAfter, expectedPenalty, "PvE flee should burn 5% of wallet Gold");

        // Verify encounter ended
        assertTrue(world.UD__getEncounter(encounterId).end != 0, "Encounter should be ended after flee");
    }

    // ===== 6. PvP flee: 10% of wallet — 5% burned, 5% to opponent =====
    function test_pvpFlee_goldSplit() public {
        _setupAlice();

        // Give bob 100 Gold
        vm.prank(deployer);
        world.UD__adminDropGold(bobCharacterId, 100 ether);
        uint256 bobBefore = goldToken.balanceOf(bob);
        uint256 aliceBefore = goldToken.balanceOf(alice);
        uint256 totalSupplyBefore = goldToken.totalSupply();

        // Move both to PvP zone (x >= 5)
        vm.prank(bob);
        world.UD__move(bobCharacterId, 5, 5);
        vm.prank(alice);
        world.UD__move(alicesCharacterId, 5, 5);

        // Bob attacks alice — bob is attacker, alice is defender
        bytes32[] memory attackers = new bytes32[](1);
        attackers[0] = bobCharacterId;
        bytes32[] memory defenders = new bytes32[](1);
        defenders[0] = alicesCharacterId;

        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvP, attackers, defenders);

        // Bob flees as attacker on turn 1 (currentTurn == 1)
        vm.prank(bob);
        world.UD__fleePvp(bobCharacterId);

        uint256 bobAfter = goldToken.balanceOf(bob);
        uint256 aliceAfter = goldToken.balanceOf(alice);
        uint256 totalSupplyAfter = goldToken.totalSupply();

        // 10% of wallet = penalty pool
        uint256 totalPenalty = bobBefore / 10; // 10 ether
        uint256 toBurn = totalPenalty / 2; // 5 ether
        uint256 toOpponent = totalPenalty - toBurn; // 5 ether

        assertEq(bobBefore - bobAfter, totalPenalty, "Bob should lose 10% of wallet Gold");
        assertEq(aliceAfter - aliceBefore, toOpponent, "Alice should receive 5% of bob's wallet Gold");
        assertEq(totalSupplyBefore - totalSupplyAfter, toBurn, "5% of bob's wallet Gold should be burned from supply");

        // Verify encounter ended
        assertTrue(world.UD__getEncounter(encounterId).end != 0, "Encounter should be ended after flee");
    }
}
