// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {ImplicitClassSystem} from "../src/systems/ImplicitClassSystem.sol";
import {
    Characters,
    CharactersData,
    Stats,
    StatsData,
    ClassMultipliers
} from "../src/codegen/index.sol";
import {Classes, Race, PowerSource, ArmorType, AdvancedClass} from "../src/codegen/common.sol";
import {IWorld} from "../src/codegen/world/IWorld.sol";
import "forge-std/console.sol";

contract ImplicitClassSystemTest is SetUp {
    address player;
    bytes32 characterId;

    function setUp() public override {
        super.setUp();

        player = address(0x1);
        vm.startPrank(player);

        // Create character
        characterId = world.UD__mintCharacter(player, bytes32("TestHero"), "test_uri");

        // Roll initial stats
        world.UD__rollStats(bytes32(uint256(12345)), characterId, Classes.Warrior);

        vm.stopPrank();
    }

    function testGetAvailableClasses() public {
        AdvancedClass[9] memory classes = world.UD__getAvailableClasses();

        // Verify all 9 classes are available
        bool hasWarrior = false;
        bool hasPaladin = false;
        bool hasRanger = false;
        bool hasRogue = false;
        bool hasDruid = false;
        bool hasWarlock = false;
        bool hasWizard = false;
        bool hasCleric = false;
        bool hasSorcerer = false;

        for (uint i = 0; i < 9; i++) {
            if (classes[i] == AdvancedClass.Warrior) hasWarrior = true;
            if (classes[i] == AdvancedClass.Paladin) hasPaladin = true;
            if (classes[i] == AdvancedClass.Ranger) hasRanger = true;
            if (classes[i] == AdvancedClass.Rogue) hasRogue = true;
            if (classes[i] == AdvancedClass.Druid) hasDruid = true;
            if (classes[i] == AdvancedClass.Warlock) hasWarlock = true;
            if (classes[i] == AdvancedClass.Wizard) hasWizard = true;
            if (classes[i] == AdvancedClass.Cleric) hasCleric = true;
            if (classes[i] == AdvancedClass.Sorcerer) hasSorcerer = true;
        }

        assertTrue(hasWarrior, "Missing Warrior");
        assertTrue(hasPaladin, "Missing Paladin");
        assertTrue(hasRanger, "Missing Ranger");
        assertTrue(hasRogue, "Missing Rogue");
        assertTrue(hasDruid, "Missing Druid");
        assertTrue(hasWarlock, "Missing Warlock");
        assertTrue(hasWizard, "Missing Wizard");
        assertTrue(hasCleric, "Missing Cleric");
        assertTrue(hasSorcerer, "Missing Sorcerer");
    }

    function testSelectWarriorClass() public {
        // Set character to level 10
        StatsData memory stats = Stats.get(characterId);
        stats.level = 10;
        stats.experience = 1000;
        Stats.set(characterId, stats);

        vm.startPrank(player);

        // Select Warrior class
        world.UD__selectAdvancedClass(characterId, AdvancedClass.Warrior);

        // Verify class was set
        StatsData memory finalStats = Stats.get(characterId);
        assertTrue(finalStats.advancedClass == AdvancedClass.Warrior, "Class not set");
        assertTrue(finalStats.hasSelectedAdvancedClass, "hasSelectedAdvancedClass not set");

        // Verify multipliers were set correctly
        (uint256 physical, uint256 spell, uint256 healing, uint256 crit, uint256 maxHp) =
            world.UD__getClassMultipliers(characterId);

        assertEq(physical, 1100, "Warrior should have 110% physical damage");
        assertEq(spell, 1000, "Warrior should have 100% spell damage");
        assertEq(healing, 1000, "Warrior should have 100% healing");
        assertEq(crit, 1000, "Warrior should have 100% crit");
        assertEq(maxHp, 1000, "Warrior should have 100% maxHp");

        vm.stopPrank();
    }

    function testSelectWizardClass() public {
        // Set character to level 10
        StatsData memory stats = Stats.get(characterId);
        stats.level = 10;
        stats.experience = 1000;
        Stats.set(characterId, stats);

        vm.startPrank(player);

        // Select Wizard class
        world.UD__selectAdvancedClass(characterId, AdvancedClass.Wizard);

        // Verify multipliers were set correctly
        (uint256 physical, uint256 spell, uint256 healing, uint256 crit, uint256 maxHp) =
            world.UD__getClassMultipliers(characterId);

        assertEq(physical, 1000, "Wizard should have 100% physical damage");
        assertEq(spell, 1150, "Wizard should have 115% spell damage");
        assertEq(healing, 1000, "Wizard should have 100% healing");
        assertEq(crit, 1000, "Wizard should have 100% crit");
        assertEq(maxHp, 1000, "Wizard should have 100% maxHp");

        vm.stopPrank();
    }

    function testSelectClericClass() public {
        // Set character to level 10
        StatsData memory stats = Stats.get(characterId);
        stats.level = 10;
        stats.experience = 1000;
        Stats.set(characterId, stats);

        vm.startPrank(player);

        // Select Cleric class
        world.UD__selectAdvancedClass(characterId, AdvancedClass.Cleric);

        // Verify multipliers were set correctly
        (uint256 physical, uint256 spell, uint256 healing, uint256 crit, uint256 maxHp) =
            world.UD__getClassMultipliers(characterId);

        assertEq(physical, 1000, "Cleric should have 100% physical damage");
        assertEq(spell, 1000, "Cleric should have 100% spell damage");
        assertEq(healing, 1150, "Cleric should have 115% healing");
        assertEq(crit, 1000, "Cleric should have 100% crit");
        assertEq(maxHp, 1000, "Cleric should have 100% maxHp");

        vm.stopPrank();
    }

    function testRevertIfNotLevel10() public {
        // Character is at level 1
        vm.startPrank(player);

        vm.expectRevert("IMPLICIT CLASS: Must be level 10 to select advanced class");
        world.UD__selectAdvancedClass(characterId, AdvancedClass.Warrior);

        vm.stopPrank();
    }

    function testRevertIfAlreadySelectedClass() public {
        // Set character to level 10
        StatsData memory stats = Stats.get(characterId);
        stats.level = 10;
        stats.experience = 1000;
        Stats.set(characterId, stats);

        vm.startPrank(player);

        // Select Warrior class first
        world.UD__selectAdvancedClass(characterId, AdvancedClass.Warrior);

        // Try to select again
        vm.expectRevert("IMPLICIT CLASS: Advanced class already selected");
        world.UD__selectAdvancedClass(characterId, AdvancedClass.Wizard);

        vm.stopPrank();
    }

    function testMultipliersInitiallyZero() public {
        // Before selecting a class, multipliers should be 0
        (uint256 physical, uint256 spell, uint256 healing, uint256 crit, uint256 maxHp) =
            world.UD__getClassMultipliers(characterId);

        assertEq(physical, 0, "Physical should be 0 before class selection");
        assertEq(spell, 0, "Spell should be 0 before class selection");
        assertEq(healing, 0, "Healing should be 0 before class selection");
        assertEq(crit, 0, "Crit should be 0 before class selection");
        assertEq(maxHp, 0, "MaxHp should be 0 before class selection");
    }

    function testClassMultipliersTable() public {
        // Set character to level 10
        StatsData memory stats = Stats.get(characterId);
        stats.level = 10;
        stats.experience = 1000;
        Stats.set(characterId, stats);

        vm.startPrank(player);

        // Select Rogue class
        world.UD__selectAdvancedClass(characterId, AdvancedClass.Rogue);

        vm.stopPrank();

        // Verify ClassMultipliers table was updated directly
        uint256 physical = ClassMultipliers.getPhysicalDamageMultiplier(characterId);
        uint256 crit = ClassMultipliers.getCritDamageMultiplier(characterId);

        assertEq(physical, 1050, "Rogue should have 105% physical damage");
        assertEq(crit, 1200, "Rogue should have 120% crit damage");
    }
}
