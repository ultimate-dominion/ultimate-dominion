// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {ImplicitClassSystem} from "../src/systems/ImplicitClassSystem.sol";
import {
    Stats,
    StatsData,
    Characters,
    CharactersData,
    ClassMultipliers
} from "../src/codegen/index.sol";
import {Classes, Race, PowerSource, ArmorType, AdvancedClass} from "../src/codegen/common.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "../src/codegen/world/IWorld.sol";
import "forge-std/console.sol";

contract ImplicitClassSystemUnitTest is Test {
    IWorld world;
    address player;
    bytes32 characterId;

    function setUp() public {
        // Get world address from deployment
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/deploys/31337/latest.json");
        string memory json = vm.readFile(path);
        address worldAddress = vm.parseJsonAddress(json, ".worldAddress");

        world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        player = makeAddr("player");
    }

    function testGetAvailableClasses() public {
        AdvancedClass[9] memory classes = world.UD__getAvailableClasses();

        // Should have 9 classes
        uint256 classCount = 0;
        for (uint i = 0; i < 9; i++) {
            if (classes[i] != AdvancedClass.None) {
                classCount++;
            }
        }
        assertEq(classCount, 9, "Should have 9 available classes");

        console.log("Available classes:");
        for (uint i = 0; i < 9; i++) {
            console.log("  Class", i, ":", uint8(classes[i]));
        }
    }

    function testSelectWarriorClassAndVerifyMultipliers() public {
        // Mint character as player
        vm.startPrank(player);
        characterId = world.UD__mintCharacter(player, bytes32("TestWarrior"), "test_uri");

        // Roll stats
        world.UD__rollStats(bytes32(uint256(12345)), characterId, Classes.Warrior);
        vm.stopPrank();

        // Get stats and set level to 10 (admin action)
        // We need to prank as the world to set stats
        vm.startPrank(address(world));
        StatsData memory stats = Stats.get(characterId);
        stats.level = 10;
        stats.experience = 1000;
        Stats.set(characterId, stats);
        vm.stopPrank();

        console.log("Character stats before class selection:");
        console.log("  Strength:", uint256(int256(stats.strength)));
        console.log("  Level:", stats.level);

        // Select Warrior class
        vm.startPrank(player);
        world.UD__selectAdvancedClass(characterId, AdvancedClass.Warrior);
        vm.stopPrank();

        // Verify class was set
        StatsData memory finalStats = Stats.get(characterId);
        assertTrue(finalStats.advancedClass == AdvancedClass.Warrior, "Class not set");
        assertTrue(finalStats.hasSelectedAdvancedClass, "hasSelectedAdvancedClass not set");

        // Verify multipliers were set correctly
        (uint256 physical, uint256 spell, uint256 healing, uint256 crit, uint256 maxHp) =
            world.UD__getClassMultipliers(characterId);

        console.log("Warrior multipliers:");
        console.log("  Physical:", physical);
        console.log("  Spell:", spell);
        console.log("  Healing:", healing);
        console.log("  Crit:", crit);
        console.log("  MaxHp:", maxHp);

        assertEq(physical, 1100, "Warrior should have 110% physical damage");
        assertEq(spell, 1000, "Warrior should have 100% spell damage");
        assertEq(healing, 1000, "Warrior should have 100% healing");
        assertEq(crit, 1000, "Warrior should have 100% crit");
        assertEq(maxHp, 1000, "Warrior should have 100% maxHp");
    }

    function testSelectWizardClassAndVerifyMultipliers() public {
        // Mint character as player
        vm.startPrank(player);
        characterId = world.UD__mintCharacter(player, bytes32("TestWizard"), "test_uri");

        // Roll stats
        world.UD__rollStats(bytes32(uint256(12345)), characterId, Classes.Mage);
        vm.stopPrank();

        // Get stats and set level to 10 (admin action)
        vm.startPrank(address(world));
        StatsData memory stats = Stats.get(characterId);
        stats.level = 10;
        stats.experience = 1000;
        Stats.set(characterId, stats);
        vm.stopPrank();

        // Select Wizard class
        vm.startPrank(player);
        world.UD__selectAdvancedClass(characterId, AdvancedClass.Wizard);
        vm.stopPrank();

        // Verify multipliers were set correctly
        (uint256 physical, uint256 spell, uint256 healing, uint256 crit, uint256 maxHp) =
            world.UD__getClassMultipliers(characterId);

        console.log("Wizard multipliers:");
        console.log("  Physical:", physical);
        console.log("  Spell:", spell);
        console.log("  Healing:", healing);
        console.log("  Crit:", crit);
        console.log("  MaxHp:", maxHp);

        assertEq(physical, 1000, "Wizard should have 100% physical damage");
        assertEq(spell, 1150, "Wizard should have 115% spell damage");
        assertEq(healing, 1000, "Wizard should have 100% healing");
        assertEq(crit, 1000, "Wizard should have 100% crit");
        assertEq(maxHp, 1000, "Wizard should have 100% maxHp");
    }

    function testSelectRogueClassAndVerifyMultipliers() public {
        // Mint character as player
        vm.startPrank(player);
        characterId = world.UD__mintCharacter(player, bytes32("TestRogue"), "test_uri");

        // Roll stats
        world.UD__rollStats(bytes32(uint256(12345)), characterId, Classes.Rogue);
        vm.stopPrank();

        // Get stats and set level to 10 (admin action)
        vm.startPrank(address(world));
        StatsData memory stats = Stats.get(characterId);
        stats.level = 10;
        stats.experience = 1000;
        Stats.set(characterId, stats);
        vm.stopPrank();

        // Select Rogue class
        vm.startPrank(player);
        world.UD__selectAdvancedClass(characterId, AdvancedClass.Rogue);
        vm.stopPrank();

        // Verify multipliers were set correctly
        (uint256 physical, uint256 spell, uint256 healing, uint256 crit, uint256 maxHp) =
            world.UD__getClassMultipliers(characterId);

        console.log("Rogue multipliers:");
        console.log("  Physical:", physical);
        console.log("  Spell:", spell);
        console.log("  Healing:", healing);
        console.log("  Crit:", crit);
        console.log("  MaxHp:", maxHp);

        assertEq(physical, 1050, "Rogue should have 105% physical damage");
        assertEq(spell, 1000, "Rogue should have 100% spell damage");
        assertEq(healing, 1000, "Rogue should have 100% healing");
        assertEq(crit, 1200, "Rogue should have 120% crit damage");
        assertEq(maxHp, 1000, "Rogue should have 100% maxHp");
    }

    function testMultipliersInitiallyZero() public {
        // Mint character as player
        vm.startPrank(player);
        characterId = world.UD__mintCharacter(player, bytes32("TestInit"), "test_uri");

        // Roll stats
        world.UD__rollStats(bytes32(uint256(12345)), characterId, Classes.Warrior);
        vm.stopPrank();

        // Before selecting a class, multipliers should be 0
        (uint256 physical, uint256 spell, uint256 healing, uint256 crit, uint256 maxHp) =
            world.UD__getClassMultipliers(characterId);

        assertEq(physical, 0, "Physical should be 0 before class selection");
        assertEq(spell, 0, "Spell should be 0 before class selection");
        assertEq(healing, 0, "Healing should be 0 before class selection");
        assertEq(crit, 0, "Crit should be 0 before class selection");
        assertEq(maxHp, 0, "MaxHp should be 0 before class selection");
    }

    function testRevertIfNotLevel10() public {
        // Mint character as player
        vm.startPrank(player);
        characterId = world.UD__mintCharacter(player, bytes32("TestLvl1"), "test_uri");

        // Roll stats - character starts at level 1
        world.UD__rollStats(bytes32(uint256(12345)), characterId, Classes.Warrior);

        // Should revert when trying to select class before level 10
        vm.expectRevert("IMPLICIT CLASS: Must be level 10 to select advanced class");
        world.UD__selectAdvancedClass(characterId, AdvancedClass.Warrior);
        vm.stopPrank();
    }
}
