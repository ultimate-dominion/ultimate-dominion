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
 * @title Test_PveRewardLevelCap
 * @notice Verifies that characters at MAX_LEVEL receive 0 XP from PvE encounters.
 *         Covers the fix at PveRewardSystem.sol line 89-92:
 *         `if (statsTemp.level >= MAX_LEVEL || currentExp >= maxLevelExp)`
 *
 * Cases:
 *   1. Level 10 character receives 0 XP after winning PvE fight
 *   2. Level 10 character with XP below Levels[MAX_LEVEL] still receives 0 XP (level gate, not just XP gate)
 *   3. Level 9 character still receives XP (control — cap only applies at MAX_LEVEL)
 */
contract Test_PveRewardLevelCap is SetUp {
    bytes32[] public defenders;
    bytes32[] public attackers;
    bytes32 entityId;

    function setUp() public override {
        super.setUp();

        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);

        vm.prank(deployer);
        world.grantAccess(_mobSystemId("UD"), address(this));

        entityId = world.UD__spawnMob(5, 0, 1);

        // spawn bob
        vm.prank(bob);
        world.UD__spawn(bobCharacterId);

        // equip bob's starter items
        StarterItemsData memory starterDat = world.UD__getStarterItems(Classes.Mage);
        vm.prank(bob);
        world.UD__equipItems(bobCharacterId, starterDat.itemIds);

        defenders.push(entityId);
        attackers.push(bobCharacterId);
    }

    /// @notice Level 10 character receives 0 XP from PvE — the primary fix case
    function test_maxLevelCharacter_receives_noXp() public {
        // Buff bob to level 10 with XP at the cap
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.level = MAX_LEVEL;
        bobStats.experience = Levels.get(MAX_LEVEL);
        bobStats.agility = 50;
        bobStats.strength = 50;
        bobStats.intelligence = 50;
        bobStats.currentHp = 200;
        world.UD__adminSetStats(bobCharacterId, bobStats);

        uint256 xpBefore = Stats.getExperience(bobCharacterId);

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

        // Fight until encounter ends
        while (world.UD__getEncounter(encounterId).end == 0) {
            vm.prank(bob);
            world.UD__endTurn(encounterId, bobCharacterId, actions);
        }

        uint256 xpAfter = Stats.getExperience(bobCharacterId);
        assertEq(xpAfter, xpBefore, "Level 10 character should receive 0 XP from PvE");
    }

    /// @notice Level 10 character with XP below Levels[MAX_LEVEL] still gets 0 XP
    ///         The level check gates before the XP comparison
    function test_maxLevel_lowXp_receives_noXp() public {
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.level = MAX_LEVEL;
        bobStats.experience = 100; // well below any cap — but level is 10
        bobStats.agility = 50;
        bobStats.strength = 50;
        bobStats.intelligence = 50;
        bobStats.currentHp = 200;
        world.UD__adminSetStats(bobCharacterId, bobStats);

        uint256 xpBefore = Stats.getExperience(bobCharacterId);

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

        uint256 xpAfter = Stats.getExperience(bobCharacterId);
        assertEq(xpAfter, xpBefore, "Level 10 character with low XP should still receive 0 XP");
    }

    /// @notice Control: level 9 character still receives XP normally
    function test_belowMaxLevel_receives_xp() public {
        StatsData memory bobStats = world.UD__getStats(bobCharacterId);
        bobStats.level = MAX_LEVEL - 1; // level 9
        bobStats.experience = 100;
        bobStats.agility = 50;
        bobStats.strength = 50;
        bobStats.intelligence = 50;
        bobStats.currentHp = 200;
        world.UD__adminSetStats(bobCharacterId, bobStats);

        uint256 xpBefore = Stats.getExperience(bobCharacterId);

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

        uint256 xpAfter = Stats.getExperience(bobCharacterId);
        assertGt(xpAfter, xpBefore, "Level 9 character should receive XP from PvE");
    }
}
