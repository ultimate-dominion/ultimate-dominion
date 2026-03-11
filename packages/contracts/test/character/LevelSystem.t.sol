// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "../SetUp.sol";
import {
    Characters,
    CharactersData,
    Stats,
    StatsData,
    Levels,
    EncounterEntity
} from "../../src/codegen/index.sol";
import {Classes, PowerSource, Race, ArmorType, AdvancedClass} from "../../src/codegen/common.sol";
import {IWorld} from "../../src/codegen/world/IWorld.sol";
import {ILevelSystem} from "../../src/codegen/world/ILevelSystem.sol";
import {MAX_LEVEL, EARLY_GAME_CAP, STAT_POINTS_EARLY} from "../../constants.sol";
import "forge-std/console.sol";

/**
 * @title LevelSystem Tests
 * @dev Tests the level-up flow, particularly the fix where experience is read
 *      from the Stats table (updated by PveRewardSystem) rather than
 *      Characters.baseStats (which was stale at 0).
 */
contract LevelSystemTest is SetUp {

    function setUp() public override {
        super.setUp();

        // Set up XP thresholds (matching PostDeploy)
        vm.startPrank(deployer);
        Levels.set(0, 0);
        Levels.set(1, 500);
        Levels.set(2, 2000);
        Levels.set(3, 5500);
        Levels.set(4, 25000);
        Levels.set(5, 85000);
        Levels.set(6, 200000);
        Levels.set(7, 450000);
        Levels.set(8, 900000);
        Levels.set(9, 1600000);
        vm.stopPrank();
    }

    // ====================================================================
    // Happy path
    // ====================================================================

    /// @dev Core regression test: PveRewardSystem only updates Stats.experience,
    ///      not Characters.baseStats.experience. LevelSystem must read from Stats.
    function testLevelUpWithExperienceOnlyInStatsTable() public {
        // Bob's character was created via enterGame in SetUp.
        // baseStats.experience == 0  (set at creation, never updated by combat)
        // Stats.experience == 0      (same initial value)
        StatsData memory baseStats = abi.decode(Characters.getBaseStats(bobCharacterId), (StatsData));
        assertEq(baseStats.experience, 0, "baseStats.experience should start at 0");

        // Simulate PveRewardSystem: give XP only to the Stats table (not baseStats)
        vm.startPrank(deployer);
        Stats.setExperience(bobCharacterId, 600); // Above level 2 threshold (500)
        vm.stopPrank();

        // Confirm desync: Stats has XP, baseStats doesn't
        assertEq(Stats.getExperience(bobCharacterId), 600);
        StatsData memory staleBase = abi.decode(Characters.getBaseStats(bobCharacterId), (StatsData));
        assertEq(staleBase.experience, 0, "baseStats should still be stale");

        // Build desired stats: +2 stat points for level 2 (STAT_POINTS_EARLY)
        StatsData memory current = Stats.get(bobCharacterId);
        StatsData memory desired = current;
        desired.strength = current.strength + 2; // Put both points in STR

        // Level up — this was reverting before the fix
        vm.prank(bob);
        world.UD__levelCharacter(bobCharacterId, desired);

        // Verify level increased
        assertEq(Stats.getLevel(bobCharacterId), 2, "Should be level 2");

        // Verify baseStats.experience was synced during level-up
        StatsData memory updatedBase = abi.decode(Characters.getBaseStats(bobCharacterId), (StatsData));
        assertEq(updatedBase.experience, 600, "baseStats.experience should be synced after level-up");
        assertEq(updatedBase.level, 2, "baseStats.level should be 2");
    }

    /// @dev Level up from 1 → 2 → 3 in sequence
    function testMultipleLevelUps() public {
        vm.startPrank(deployer);
        Stats.setExperience(bobCharacterId, 2500); // Above level 3 threshold (2000)
        vm.stopPrank();

        StatsData memory current = Stats.get(bobCharacterId);

        // Level 1 → 2 (+2 stat points)
        StatsData memory desired1 = current;
        desired1.strength = current.strength + 2;
        vm.prank(bob);
        world.UD__levelCharacter(bobCharacterId, desired1);
        assertEq(Stats.getLevel(bobCharacterId), 2);

        // Level 2 → 3 (+2 stat points)
        StatsData memory current2 = Stats.get(bobCharacterId);
        StatsData memory desired2 = current2;
        desired2.agility = current2.agility + 2;
        vm.prank(bob);
        world.UD__levelCharacter(bobCharacterId, desired2);
        assertEq(Stats.getLevel(bobCharacterId), 3);
    }

    /// @dev Stat points can be split across multiple stats
    function testLevelUpSplitStatPoints() public {
        vm.startPrank(deployer);
        Stats.setExperience(bobCharacterId, 600);
        vm.stopPrank();

        StatsData memory current = Stats.get(bobCharacterId);
        StatsData memory desired = current;
        desired.strength = current.strength + 1;
        desired.agility = current.agility + 1;

        vm.prank(bob);
        world.UD__levelCharacter(bobCharacterId, desired);
        assertEq(Stats.getLevel(bobCharacterId), 2);
        assertEq(Stats.getStrength(bobCharacterId), desired.strength);
        assertEq(Stats.getAgility(bobCharacterId), desired.agility);
    }

    // ====================================================================
    // Unhappy paths
    // ====================================================================

    /// @dev Revert when character has no experience at all
    function testRevertInsufficientExperience() public {
        // Bob starts at level 1 with 0 XP everywhere
        StatsData memory current = Stats.get(bobCharacterId);
        StatsData memory desired = current;
        desired.strength = current.strength + 2;

        vm.prank(bob);
        vm.expectRevert(ILevelSystem.LevelSystem_InsufficientExperience.selector);
        world.UD__levelCharacter(bobCharacterId, desired);
    }

    /// @dev Revert when experience is just below the threshold
    function testRevertExperienceJustBelowThreshold() public {
        vm.startPrank(deployer);
        Stats.setExperience(bobCharacterId, 499); // Threshold is 500
        vm.stopPrank();

        StatsData memory current = Stats.get(bobCharacterId);
        StatsData memory desired = current;
        desired.strength = current.strength + 2;

        vm.prank(bob);
        vm.expectRevert(ILevelSystem.LevelSystem_InsufficientExperience.selector);
        world.UD__levelCharacter(bobCharacterId, desired);
    }

    /// @dev Revert when stat allocation doesn't match allowed points
    function testRevertInvalidStatChanges() public {
        vm.startPrank(deployer);
        Stats.setExperience(bobCharacterId, 600);
        vm.stopPrank();

        StatsData memory current = Stats.get(bobCharacterId);

        // Try to allocate 3 points instead of 2
        StatsData memory desired = current;
        desired.strength = current.strength + 3;

        vm.prank(bob);
        vm.expectRevert(ILevelSystem.LevelSystem_InvalidStatChanges.selector);
        world.UD__levelCharacter(bobCharacterId, desired);
    }

    /// @dev Revert when allocating zero stat points (must use all points)
    function testRevertZeroStatAllocation() public {
        vm.startPrank(deployer);
        Stats.setExperience(bobCharacterId, 600);
        vm.stopPrank();

        StatsData memory current = Stats.get(bobCharacterId);
        StatsData memory desired = current; // No changes

        vm.prank(bob);
        vm.expectRevert(ILevelSystem.LevelSystem_InvalidStatChanges.selector);
        world.UD__levelCharacter(bobCharacterId, desired);
    }

    /// @dev Revert when trying to level up again without enough XP for next level
    function testRevertDoubleLevel() public {
        vm.startPrank(deployer);
        Stats.setExperience(bobCharacterId, 600); // Enough for L2, not L3
        vm.stopPrank();

        // First level-up succeeds
        StatsData memory current = Stats.get(bobCharacterId);
        StatsData memory desired = current;
        desired.strength = current.strength + 2;
        vm.prank(bob);
        world.UD__levelCharacter(bobCharacterId, desired);
        assertEq(Stats.getLevel(bobCharacterId), 2);

        // Second level-up should fail (need 2000 XP for L3)
        StatsData memory current2 = Stats.get(bobCharacterId);
        StatsData memory desired2 = current2;
        desired2.strength = current2.strength + 2;
        vm.prank(bob);
        vm.expectRevert(ILevelSystem.LevelSystem_InsufficientExperience.selector);
        world.UD__levelCharacter(bobCharacterId, desired2);
    }

    /// @dev Revert when character doesn't exist
    function testRevertCharacterNotFound() public {
        bytes32 fakeId = bytes32(uint256(0xdead));
        StatsData memory desired = Stats.get(bobCharacterId);

        vm.prank(bob);
        vm.expectRevert(ILevelSystem.LevelSystem_CharacterNotFound.selector);
        world.UD__levelCharacter(fakeId, desired);
    }

    // ====================================================================
    // Edge cases
    // ====================================================================

    /// @dev Level up at exact XP threshold (500 exactly for L2)
    function testLevelUpAtExactThreshold() public {
        vm.startPrank(deployer);
        Stats.setExperience(bobCharacterId, 500); // Exactly at threshold
        vm.stopPrank();

        StatsData memory current = Stats.get(bobCharacterId);
        StatsData memory desired = current;
        desired.intelligence = current.intelligence + 2;

        vm.prank(bob);
        world.UD__levelCharacter(bobCharacterId, desired);
        assertEq(Stats.getLevel(bobCharacterId), 2);
    }

    /// @dev Enough XP to skip levels (e.g., 6000 XP at level 1 could reach L3)
    ///      but must level up one at a time
    function testCanOnlyLevelOneAtATime() public {
        vm.startPrank(deployer);
        Stats.setExperience(bobCharacterId, 6000); // Enough for L3 (5500)
        vm.stopPrank();

        // Must still go L1 → L2 first
        StatsData memory current = Stats.get(bobCharacterId);
        StatsData memory desired = current;
        desired.strength = current.strength + 2;

        vm.prank(bob);
        world.UD__levelCharacter(bobCharacterId, desired);
        assertEq(Stats.getLevel(bobCharacterId), 2, "Should be L2, not L3");

        // Then L2 → L3
        StatsData memory current2 = Stats.get(bobCharacterId);
        StatsData memory desired2 = current2;
        desired2.agility = current2.agility + 2;
        vm.prank(bob);
        world.UD__levelCharacter(bobCharacterId, desired2);
        assertEq(Stats.getLevel(bobCharacterId), 3);
    }

    /// @dev getCurrentAvailableLevel uses experience passed in (pure calculation)
    function testGetCurrentAvailableLevelBoundaries() public {
        assertEq(world.UD__getCurrentAvailableLevel(0), 1);
        assertEq(world.UD__getCurrentAvailableLevel(499), 1);
        assertEq(world.UD__getCurrentAvailableLevel(500), 2);
        assertEq(world.UD__getCurrentAvailableLevel(1999), 2);
        assertEq(world.UD__getCurrentAvailableLevel(2000), 3);
        assertEq(world.UD__getCurrentAvailableLevel(5499), 3);
        assertEq(world.UD__getCurrentAvailableLevel(5500), 4);
        assertEq(world.UD__getCurrentAvailableLevel(1600000), 10);
    }
}
