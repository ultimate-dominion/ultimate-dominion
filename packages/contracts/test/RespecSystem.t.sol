// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {
    Stats,
    StatsData,
    Characters,
    ClassMultipliers,
    CharacterEquipment
} from "@codegen/index.sol";
import {AdvancedClass} from "@codegen/common.sol";
import {CannotRespecInCombat, InvalidRespecStats} from "../src/Errors.sol";
import {
    STAT_RESPEC_BASE_COST,
    FULL_RESPEC_MULTIPLIER,
    RESPEC_COST_PER_LEVEL
} from "../constants.sol";
import "forge-std/console.sol";

contract RespecSystemTest is SetUp {
    // Bob's known stats — set in setUp so every test starts deterministic
    int256 constant ORIG_STR = 7;
    int256 constant ORIG_AGI = 6;
    int256 constant ORIG_INT = 8;
    int256 constant ORIG_TOTAL = ORIG_STR + ORIG_AGI + ORIG_INT; // 21

    function setUp() public override {
        super.setUp();

        // Read bob's rolled stats so we know the starting shape
        StatsData memory rolled = Stats.get(bobCharacterId);

        // Overwrite to known values so tests are deterministic
        StatsData memory known = rolled;
        known.strength = ORIG_STR;
        known.agility = ORIG_AGI;
        known.intelligence = ORIG_INT;
        known.level = 5; // gives 5 earned stat points (levels 1-10 = 1pt/level)

        vm.startPrank(deployer);
        world.UD__adminSetStats(bobCharacterId, known);

        // Also update originalStats to match the base distribution
        StatsData memory orig = known;
        orig.level = 1; // original stats are the level-1 snapshot
        Characters.setOriginalStats(bobCharacterId, abi.encode(orig));
        vm.stopPrank();
    }

    // ====================================================================
    // Helpers
    // ====================================================================

    function _giveGold(bytes32 characterId, uint256 amount) internal {
        vm.prank(deployer);
        world.UD__adminDropGold(characterId, amount);
    }

    function _statRespecCost(uint256 level) internal pure returns (uint256) {
        return STAT_RESPEC_BASE_COST + (level * RESPEC_COST_PER_LEVEL);
    }

    // ====================================================================
    // Happy paths
    // ====================================================================

    /// @dev Redistribute stat points (same total), verify stats changed and gold burned
    function test_statRespec_redistributesPoints() public {
        uint256 level = 5;
        uint256 cost = _statRespecCost(level);
        _giveGold(bobCharacterId, cost);

        uint256 goldBefore = goldToken.balanceOf(bob);

        // At level 5, earnedPoints = 5. desiredTotal must equal ORIG_TOTAL + 5 = 26
        StatsData memory desired;
        desired.strength = 10;
        desired.agility = 10;
        desired.intelligence = 6; // 10 + 10 + 6 = 26

        vm.prank(bob);
        world.UD__statRespec(bobCharacterId, desired);

        StatsData memory after_ = Stats.get(bobCharacterId);
        assertEq(after_.strength, 10, "str should be 10");
        assertEq(after_.agility, 10, "agi should be 10");
        assertEq(after_.intelligence, 6, "int should be 6");

        uint256 goldAfter = goldToken.balanceOf(bob);
        assertEq(goldBefore - goldAfter, cost, "gold burned should equal cost");
    }

    /// @dev Verify stat respec cost = BASE + level * PER_LEVEL
    function test_statRespec_costScalesWithLevel() public {
        // Level is 5 from setUp
        (uint256 statCost, ) = world.UD__getRespecCost(bobCharacterId);

        uint256 expectedCost = STAT_RESPEC_BASE_COST + (5 * RESPEC_COST_PER_LEVEL);
        assertEq(statCost, expectedCost, "stat cost should be BASE + 5*PER_LEVEL");

        // Bump to level 10 and re-check
        StatsData memory s = Stats.get(bobCharacterId);
        s.level = 10;
        vm.prank(deployer);
        world.UD__adminSetStats(bobCharacterId, s);

        (uint256 statCost10, ) = world.UD__getRespecCost(bobCharacterId);
        uint256 expectedCost10 = STAT_RESPEC_BASE_COST + (10 * RESPEC_COST_PER_LEVEL);
        assertEq(statCost10, expectedCost10, "stat cost should be BASE + 10*PER_LEVEL");
    }

    /// @dev Full respec resets to original stats, level=1, class=None
    function test_fullRespec_resetsToOriginalStats() public {
        uint256 level = 5;
        uint256 cost = _statRespecCost(level) * FULL_RESPEC_MULTIPLIER;
        _giveGold(bobCharacterId, cost);

        vm.prank(bob);
        world.UD__fullRespec(bobCharacterId);

        StatsData memory after_ = Stats.get(bobCharacterId);
        assertEq(after_.strength, ORIG_STR, "str should reset to original");
        assertEq(after_.agility, ORIG_AGI, "agi should reset to original");
        assertEq(after_.intelligence, ORIG_INT, "int should reset to original");
        assertEq(after_.level, 1, "level should reset to 1");
        assertEq(uint8(after_.advancedClass), uint8(AdvancedClass.None), "advancedClass should be None");
        assertFalse(after_.hasSelectedAdvancedClass, "hasSelectedAdvancedClass should be false");
    }

    /// @dev Full respec clears all equipment arrays and bonuses
    function test_fullRespec_clearsEquipment() public {
        uint256 level = 5;
        uint256 cost = _statRespecCost(level) * FULL_RESPEC_MULTIPLIER;
        _giveGold(bobCharacterId, cost);

        // Confirm bob has equipment before respec (entered game with weapon + armor)
        uint256[] memory weaponsBefore = CharacterEquipment.getEquippedWeapons(bobCharacterId);
        uint256[] memory armorBefore = CharacterEquipment.getEquippedArmor(bobCharacterId);
        assertTrue(weaponsBefore.length > 0 || armorBefore.length > 0, "should have equipment before respec");

        vm.prank(bob);
        world.UD__fullRespec(bobCharacterId);

        assertEq(CharacterEquipment.getEquippedWeapons(bobCharacterId).length, 0, "weapons should be empty");
        assertEq(CharacterEquipment.getEquippedArmor(bobCharacterId).length, 0, "armor should be empty");
        assertEq(CharacterEquipment.getEquippedSpells(bobCharacterId).length, 0, "spells should be empty");
        assertEq(CharacterEquipment.getEquippedConsumables(bobCharacterId).length, 0, "consumables should be empty");
        assertEq(CharacterEquipment.getEquippedAccessories(bobCharacterId).length, 0, "accessories should be empty");

        // Stat bonuses from equipment should be zeroed
        assertEq(CharacterEquipment.getStrBonus(bobCharacterId), 0, "strBonus should be 0");
        assertEq(CharacterEquipment.getAgiBonus(bobCharacterId), 0, "agiBonus should be 0");
        assertEq(CharacterEquipment.getIntBonus(bobCharacterId), 0, "intBonus should be 0");
        assertEq(CharacterEquipment.getHpBonus(bobCharacterId), 0, "hpBonus should be 0");
        assertEq(CharacterEquipment.getArmor(bobCharacterId), 0, "armor should be 0");
    }

    /// @dev Full respec keeps XP
    function test_fullRespec_keepsXP() public {
        // Give bob some XP
        vm.prank(deployer);
        Stats.setExperience(bobCharacterId, 9999);

        uint256 level = 5;
        uint256 cost = _statRespecCost(level) * FULL_RESPEC_MULTIPLIER;
        _giveGold(bobCharacterId, cost);

        vm.prank(bob);
        world.UD__fullRespec(bobCharacterId);

        StatsData memory after_ = Stats.get(bobCharacterId);
        assertEq(after_.experience, 9999, "XP should be preserved");
    }

    /// @dev getRespecCost returns correct (statCost, fullCost)
    function test_getRespecCost_returnsCorrectValues() public {
        (uint256 statCost, uint256 fullCost) = world.UD__getRespecCost(bobCharacterId);

        uint256 expectedStatCost = STAT_RESPEC_BASE_COST + (5 * RESPEC_COST_PER_LEVEL);
        uint256 expectedFullCost = expectedStatCost * FULL_RESPEC_MULTIPLIER;

        assertEq(statCost, expectedStatCost, "stat cost mismatch");
        assertEq(fullCost, expectedFullCost, "full cost mismatch");
    }

    // ====================================================================
    // Unhappy paths
    // ====================================================================

    /// @dev Stat respec with wrong point total reverts
    function test_statRespec_revertsInvalidTotal() public {
        uint256 level = 5;
        uint256 cost = _statRespecCost(level);
        _giveGold(bobCharacterId, cost);

        // desiredTotal = 30, but should be ORIG_TOTAL + 5 = 26
        StatsData memory desired;
        desired.strength = 10;
        desired.agility = 10;
        desired.intelligence = 10; // 30 != 26

        vm.prank(bob);
        vm.expectRevert(InvalidRespecStats.selector);
        world.UD__statRespec(bobCharacterId, desired);
    }

    /// @dev Stat respec with negative stat values reverts
    function test_statRespec_revertsNegativeStats() public {
        uint256 level = 5;
        uint256 cost = _statRespecCost(level);
        _giveGold(bobCharacterId, cost);

        // Total = 26 (correct) but has a negative value
        StatsData memory desired;
        desired.strength = -1;
        desired.agility = 15;
        desired.intelligence = 12; // -1 + 15 + 12 = 26

        vm.prank(bob);
        vm.expectRevert(InvalidRespecStats.selector);
        world.UD__statRespec(bobCharacterId, desired);
    }

    /// @dev Stat respec by non-owner reverts
    function test_statRespec_revertsNotOwner() public {
        uint256 level = 5;
        uint256 cost = _statRespecCost(level);
        _giveGold(bobCharacterId, cost);

        StatsData memory desired;
        desired.strength = 10;
        desired.agility = 10;
        desired.intelligence = 6; // 26 = valid

        // Alice tries to respec bob's character
        vm.prank(alice);
        vm.expectRevert("Not character owner");
        world.UD__statRespec(bobCharacterId, desired);
    }

    /// @dev Full respec without enough gold reverts
    function test_fullRespec_revertsInsufficientGold() public {
        // Don't give bob any gold — he should have 0
        uint256 goldBalance = goldToken.balanceOf(bob);
        uint256 cost = _statRespecCost(5) * FULL_RESPEC_MULTIPLIER;
        assertTrue(goldBalance < cost, "bob should not have enough gold for full respec");

        vm.prank(bob);
        vm.expectRevert(); // goldBurn will revert (ERC20 insufficient balance)
        world.UD__fullRespec(bobCharacterId);
    }
}
