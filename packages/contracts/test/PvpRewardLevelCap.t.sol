// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes} from "@codegen/common.sol";
import {StatsData, Stats, Levels, StarterItemsData} from "@codegen/index.sol";
import {EncounterType} from "@codegen/common.sol";
import {MAX_LEVEL} from "../constants.sol";
import {Action} from "@interfaces/Structs.sol";
import {_mobSystemId} from "../src/utils.sol";

/**
 * @title Test_PvpRewardLevelCap
 * @notice Verifies that PvP winners at MAX_LEVEL receive 0 XP.
 *         Covers the fix at PvpRewardSystem.sol line 78:
 *         `if (winnerStats.level >= MAX_LEVEL || currentExp >= maxLevelExp) continue;`
 *
 * Cases:
 *   1. Level 10 winner receives 0 XP after PvP victory
 *   2. Level 10 winner with low XP still receives 0 XP (level gate)
 *   3. Below-max-level winner still receives XP (control)
 */
contract Test_PvpRewardLevelCap is SetUp {
    function setUp() public override {
        super.setUp();

        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);

        // Roll stats + enter game for alice (only minted in SetUp, not enrolled)
        vm.startPrank(alice);
        world.UD__rollStats(alicesRandomness, alicesCharacterId, Classes.Rogue);
        world.UD__enterGame(alicesCharacterId, newWeaponId, newArmorId);
        vm.stopPrank();

        // Spawn both characters
        vm.prank(bob);
        world.UD__spawn(bobCharacterId);
        vm.prank(alice);
        world.UD__spawn(alicesCharacterId);

        // Equip starter items
        StarterItemsData memory starterDat = world.UD__getStarterItems(Classes.Rogue);
        vm.prank(alice);
        world.UD__equipItems(alicesCharacterId, starterDat.itemIds);

        starterDat = world.UD__getStarterItems(Classes.Mage);
        vm.prank(bob);
        world.UD__equipItems(bobCharacterId, starterDat.itemIds);
    }

    /// @notice Level 10 PvP winner receives 0 XP
    function test_maxLevelWinner_receives_noXp() public {
        // Bob = level 10 with massive stats, alice = weak (bob will win)
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.level = MAX_LEVEL;
        bobStats.experience = Levels.get(MAX_LEVEL);
        bobStats.agility = 100;
        bobStats.strength = 100;
        bobStats.intelligence = 100;
        bobStats.currentHp = 500;
        bobStats.maxHp = 500;
        world.UD__adminSetStats(bobCharacterId, bobStats);

        StatsData memory aliceStats = world.UD__getStats(alicesCharacterId);
        aliceStats.agility = 1;
        aliceStats.strength = 1;
        aliceStats.intelligence = 1;
        aliceStats.currentHp = 1;
        aliceStats.maxHp = 1;
        world.UD__adminSetStats(alicesCharacterId, aliceStats);

        uint256 xpBefore = Stats.getExperience(bobCharacterId);

        // Move both to PvP zone
        world.UD__adminMoveEntity(bobCharacterId, 5, 5);
        world.UD__adminMoveEntity(alicesCharacterId, 5, 5);

        bytes32[] memory pvpAttackers = new bytes32[](1);
        pvpAttackers[0] = bobCharacterId;
        bytes32[] memory pvpDefenders = new bytes32[](1);
        pvpDefenders[0] = alicesCharacterId;

        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvP, pvpAttackers, pvpDefenders);

        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            attackerEntityId: bobCharacterId,
            defenderEntityId: alicesCharacterId,
            itemId: startingConsumableId
        });

        while (world.UD__getEncounter(encounterId).end == 0) {
            vm.prank(bob);
            world.UD__endTurn(encounterId, bobCharacterId, actions);
        }

        uint256 xpAfter = Stats.getExperience(bobCharacterId);
        assertEq(xpAfter, xpBefore, "Level 10 PvP winner should receive 0 XP");
    }

    /// @notice Level 10 winner with low XP still gets 0 — level gate, not XP gate
    function test_maxLevel_lowXp_winner_receives_noXp() public {
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.level = MAX_LEVEL;
        bobStats.experience = 50; // well below cap
        bobStats.agility = 100;
        bobStats.strength = 100;
        bobStats.intelligence = 100;
        bobStats.currentHp = 500;
        bobStats.maxHp = 500;
        world.UD__adminSetStats(bobCharacterId, bobStats);

        StatsData memory aliceStats = world.UD__getStats(alicesCharacterId);
        aliceStats.agility = 1;
        aliceStats.strength = 1;
        aliceStats.intelligence = 1;
        aliceStats.currentHp = 1;
        aliceStats.maxHp = 1;
        world.UD__adminSetStats(alicesCharacterId, aliceStats);

        uint256 xpBefore = Stats.getExperience(bobCharacterId);

        world.UD__adminMoveEntity(bobCharacterId, 5, 5);
        world.UD__adminMoveEntity(alicesCharacterId, 5, 5);

        bytes32[] memory pvpAttackers = new bytes32[](1);
        pvpAttackers[0] = bobCharacterId;
        bytes32[] memory pvpDefenders = new bytes32[](1);
        pvpDefenders[0] = alicesCharacterId;

        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvP, pvpAttackers, pvpDefenders);

        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            attackerEntityId: bobCharacterId,
            defenderEntityId: alicesCharacterId,
            itemId: startingConsumableId
        });

        while (world.UD__getEncounter(encounterId).end == 0) {
            vm.prank(bob);
            world.UD__endTurn(encounterId, bobCharacterId, actions);
        }

        uint256 xpAfter = Stats.getExperience(bobCharacterId);
        assertEq(xpAfter, xpBefore, "Level 10 winner with low XP should still receive 0 XP");
    }

    /// @notice Control: below-max-level winner still receives XP
    function test_belowMaxLevel_winner_receives_xp() public {
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.level = MAX_LEVEL - 1; // level 9
        bobStats.experience = 100;
        bobStats.agility = 100;
        bobStats.strength = 100;
        bobStats.intelligence = 100;
        bobStats.currentHp = 500;
        bobStats.maxHp = 500;
        world.UD__adminSetStats(bobCharacterId, bobStats);

        StatsData memory aliceStats = world.UD__getStats(alicesCharacterId);
        aliceStats.agility = 1;
        aliceStats.strength = 1;
        aliceStats.intelligence = 1;
        aliceStats.currentHp = 1;
        aliceStats.maxHp = 1;
        world.UD__adminSetStats(alicesCharacterId, aliceStats);

        uint256 xpBefore = Stats.getExperience(bobCharacterId);

        world.UD__adminMoveEntity(bobCharacterId, 5, 5);
        world.UD__adminMoveEntity(alicesCharacterId, 5, 5);

        bytes32[] memory pvpAttackers = new bytes32[](1);
        pvpAttackers[0] = bobCharacterId;
        bytes32[] memory pvpDefenders = new bytes32[](1);
        pvpDefenders[0] = alicesCharacterId;

        vm.prank(bob);
        bytes32 encounterId = world.UD__createEncounter(EncounterType.PvP, pvpAttackers, pvpDefenders);

        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            attackerEntityId: bobCharacterId,
            defenderEntityId: alicesCharacterId,
            itemId: startingConsumableId
        });

        while (world.UD__getEncounter(encounterId).end == 0) {
            vm.prank(bob);
            world.UD__endTurn(encounterId, bobCharacterId, actions);
        }

        uint256 xpAfter = Stats.getExperience(bobCharacterId);
        assertGt(xpAfter, xpBefore, "Level 9 PvP winner should receive XP");
    }
}
