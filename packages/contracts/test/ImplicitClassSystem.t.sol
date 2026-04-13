// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {ImplicitClassSystem} from "../src/systems/ImplicitClassSystem.sol";
import {Characters, CharactersData, Stats, StatsData, ClassMultipliers, StatRollCount} from "../src/codegen/index.sol";
import {Classes, Race, PowerSource, ArmorType, AdvancedClass} from "../src/codegen/common.sol";
import {IWorld} from "../src/codegen/world/IWorld.sol";
import {RaceAlreadySet, PowerSourceAlreadySet} from "../src/Errors.sol";
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

        for (uint256 i = 0; i < 9; i++) {
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

    function testRollBaseStatsBeforeRaceAndPowerSource() public {
        address newPlayer = address(0xBEEF);
        vm.startPrank(newPlayer);
        bytes32 newCharacterId = world.UD__mintCharacter(newPlayer, bytes32("RawRoll"), "test_uri");

        world.UD__rollBaseStats(bytes32(uint256(1001)), newCharacterId);

        StatsData memory stats = Stats.get(newCharacterId);
        assertEq(uint256(stats.race), uint256(Race.None), "race should stay unset");
        assertEq(uint256(stats.powerSource), uint256(PowerSource.None), "power source should stay unset");
        assertEq(stats.maxHp, 18, "raw roll should use base hp");
        assertEq(stats.strength + stats.agility + stats.intelligence, 19, "raw stats should be balanced");
        assertEq(StatRollCount.getRollCount(newCharacterId), 1, "roll count should increment");

        vm.stopPrank();
    }

    function testChooseRaceAfterRollAddsBonuses() public {
        address newPlayer = address(0xBEEF2);
        vm.startPrank(newPlayer);
        bytes32 newCharacterId = world.UD__mintCharacter(newPlayer, bytes32("RaceRoll"), "test_uri");
        world.UD__rollBaseStats(bytes32(uint256(1002)), newCharacterId);

        StatsData memory beforeRace = Stats.get(newCharacterId);
        world.UD__chooseRace(newCharacterId, Race.Dwarf);
        StatsData memory afterRace = Stats.get(newCharacterId);

        assertEq(uint256(afterRace.race), uint256(Race.Dwarf), "race should be set");
        assertEq(afterRace.strength, beforeRace.strength + 2, "dwarf strength bonus");
        assertEq(afterRace.agility, beforeRace.agility - 1, "dwarf agility penalty");
        assertEq(afterRace.intelligence, beforeRace.intelligence, "dwarf intelligence unchanged");
        assertEq(afterRace.maxHp, beforeRace.maxHp + 1, "dwarf hp bonus");

        vm.stopPrank();
    }

    function testRerollBeforeRaceStaysRaw() public {
        address newPlayer = address(0xBEEF3);
        vm.startPrank(newPlayer);
        bytes32 newCharacterId = world.UD__mintCharacter(newPlayer, bytes32("Reroll"), "test_uri");

        world.UD__rollBaseStats(bytes32(uint256(1003)), newCharacterId);
        world.UD__rollBaseStats(bytes32(uint256(1004)), newCharacterId);

        StatsData memory stats = Stats.get(newCharacterId);
        assertEq(uint256(stats.race), uint256(Race.None), "race should stay unset");
        assertEq(uint256(stats.powerSource), uint256(PowerSource.None), "power source should stay unset");
        assertEq(stats.maxHp, 18, "reroll should stay raw");
        assertEq(stats.strength + stats.agility + stats.intelligence, 19, "reroll should stay balanced");
        assertEq(StatRollCount.getRollCount(newCharacterId), 2, "roll count should increment twice");

        vm.stopPrank();
    }

    function testCannotChooseRaceOrPowerSourceTwice() public {
        address newPlayer = address(0xBEEF4);
        vm.startPrank(newPlayer);
        bytes32 newCharacterId = world.UD__mintCharacter(newPlayer, bytes32("NoTwice"), "test_uri");

        world.UD__chooseRace(newCharacterId, Race.Human);
        vm.expectRevert(RaceAlreadySet.selector);
        world.UD__chooseRace(newCharacterId, Race.Elf);

        world.UD__choosePowerSource(newCharacterId, PowerSource.Physical);
        vm.expectRevert(PowerSourceAlreadySet.selector);
        world.UD__choosePowerSource(newCharacterId, PowerSource.Divine);

        vm.stopPrank();
    }

    function testNewOnboardingHappyPathEntersGame() public {
        address newPlayer = address(0xBEEF5);
        vm.startPrank(newPlayer);
        bytes32 newCharacterId = world.UD__mintCharacter(newPlayer, bytes32("NewFlow"), "test_uri");

        world.UD__rollBaseStats(bytes32(uint256(1005)), newCharacterId);
        world.UD__chooseRace(newCharacterId, Race.Human);
        world.UD__choosePowerSource(newCharacterId, PowerSource.Physical);
        world.UD__enterGame(newCharacterId, newWeaponId, newArmorId);

        CharactersData memory characterData = Characters.get(newCharacterId);
        StatsData memory stats = Stats.get(newCharacterId);
        assertTrue(characterData.locked, "character should be locked after entering");
        assertEq(uint256(stats.race), uint256(Race.Human), "race should be preserved");
        assertEq(uint256(stats.powerSource), uint256(PowerSource.Physical), "power source should be preserved");
        assertEq(stats.level, 1, "character should start at level 1");
        assertEq(stats.currentHp, stats.maxHp, "character should start at full hp");

        vm.stopPrank();
    }

    function testRaceBonusDoesNotDoubleApplyAfterRaceSelectedReroll() public {
        address newPlayer = address(0xBEEF6);
        vm.startPrank(newPlayer);
        bytes32 newCharacterId = world.UD__mintCharacter(newPlayer, bytes32("NoDouble"), "test_uri");

        world.UD__rollBaseStats(bytes32(uint256(1006)), newCharacterId);
        world.UD__chooseRace(newCharacterId, Race.Human);
        world.UD__rollBaseStats(bytes32(uint256(1007)), newCharacterId);

        StatsData memory stats = Stats.get(newCharacterId);
        assertEq(uint256(stats.race), uint256(Race.Human), "race should be preserved");
        assertEq(stats.strength + stats.agility + stats.intelligence, 22, "human bonus should apply once");
        assertEq(stats.maxHp, 18, "human does not change hp");

        vm.stopPrank();
    }
}
