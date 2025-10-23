// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {StatCalculator} from "../src/libraries/StatCalculator.sol";
import {StatsData, WeaponStatsData, ArmorStatsData, CharacterEquipmentData} from "@codegen/index.sol";
import {Classes} from "@codegen/common.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";

contract StatCalculatorTest is Test {
    function testCalculateLevelFromExperience() public {
        uint256[] memory levelsTable = new uint256[](10);
        levelsTable[0] = 0;    // Level 1
        levelsTable[1] = 100;  // Level 2
        levelsTable[2] = 250;  // Level 3
        levelsTable[3] = 450;  // Level 4
        levelsTable[4] = 700;  // Level 5
        levelsTable[5] = 1000; // Level 6
        levelsTable[6] = 1350; // Level 7
        levelsTable[7] = 1750; // Level 8
        levelsTable[8] = 2200; // Level 9
        levelsTable[9] = 2700; // Level 10

        // Test level 1
        uint256 level = StatCalculator.calculateLevelFromExperience(50, levelsTable);
        assertEq(level, 1);

        // Test level 5
        level = StatCalculator.calculateLevelFromExperience(750, levelsTable);
        assertEq(level, 5);

        // Test max level
        level = StatCalculator.calculateLevelFromExperience(3000, levelsTable);
        assertEq(level, 10);
    }

    function testGenerateRandomStats() public {
        uint256 randomNumber = 123456789;
        
        // Test Warrior stats
        StatsData memory warriorStats = StatCalculator.generateRandomStats(randomNumber, Classes.Warrior);
        assertTrue(warriorStats.strength >= 5); // 3 base + 2 class bonus
        assertTrue(warriorStats.agility >= 3);
        assertTrue(warriorStats.intelligence >= 3);
        assertEq(warriorStats.maxHp, 20);
        assertTrue(warriorStats.class == Classes.Warrior);

        // Test Rogue stats
        StatsData memory rogueStats = StatCalculator.generateRandomStats(randomNumber, Classes.Rogue);
        assertTrue(rogueStats.strength >= 3);
        assertTrue(rogueStats.agility >= 5); // 3 base + 2 class bonus
        assertTrue(rogueStats.intelligence >= 3);
        assertEq(rogueStats.maxHp, 18);
        assertTrue(rogueStats.class == Classes.Rogue);

        // Test Mage stats
        StatsData memory mageStats = StatCalculator.generateRandomStats(randomNumber, Classes.Mage);
        assertTrue(mageStats.strength >= 3);
        assertTrue(mageStats.agility >= 3);
        assertTrue(mageStats.intelligence >= 5); // 3 base + 2 class bonus
        assertEq(mageStats.maxHp, 16);
        assertTrue(mageStats.class == Classes.Mage);
    }

    function testCalculateHpBonus() public {
        // Test Warrior HP bonus (level 3 % 3 == 0, so gets extra bonus)
        int256 hpBonus = StatCalculator.calculateHpBonus(Classes.Warrior, 3);
        assertEq(hpBonus, 6); // 3 base + 3 warrior bonus

        // Test Rogue HP bonus (level 2 % 3 != 0, so no extra bonus)
        hpBonus = StatCalculator.calculateHpBonus(Classes.Rogue, 2);
        assertEq(hpBonus, 3); // 3 base only

        // Test Mage HP bonus (level 6 % 3 == 0, but not Warrior, so no extra bonus)
        hpBonus = StatCalculator.calculateHpBonus(Classes.Mage, 6);
        assertEq(hpBonus, 3); // 3 base only

        // Test Warrior at level 1 (no extra bonus)
        hpBonus = StatCalculator.calculateHpBonus(Classes.Warrior, 1);
        assertEq(hpBonus, 3); // 3 base only
    }

    function testCalculateClassBonus() public {
        // Test Warrior bonus (BONUS_POINT_LEVEL = 1, so every level gets bonus)
        (int256 strBonus, int256 agiBonus, int256 intBonus) = StatCalculator.calculateClassBonus(Classes.Warrior, 2);
        assertEq(strBonus, 1);
        assertEq(agiBonus, 0);
        assertEq(intBonus, 0);

        // Test Rogue bonus
        (strBonus, agiBonus, intBonus) = StatCalculator.calculateClassBonus(Classes.Rogue, 2);
        assertEq(strBonus, 0);
        assertEq(agiBonus, 1);
        assertEq(intBonus, 0);

        // Test Mage bonus
        (strBonus, agiBonus, intBonus) = StatCalculator.calculateClassBonus(Classes.Mage, 2);
        assertEq(strBonus, 0);
        assertEq(agiBonus, 0);
        assertEq(intBonus, 1);

        // Test level 1 also gets bonus (BONUS_POINT_LEVEL = 1)
        (strBonus, agiBonus, intBonus) = StatCalculator.calculateClassBonus(Classes.Warrior, 1);
        assertEq(strBonus, 1);
        assertEq(agiBonus, 0);
        assertEq(intBonus, 0);
    }

    function testValidateStatChanges() public {
        StatsData memory currentStats = StatsData({
            strength: 10,
            agility: 8,
            intelligence: 6,
            class: Classes.Warrior,
            maxHp: 20,
            currentHp: 20,
            level: 1,
            experience: 0
        });

        StatsData memory desiredStats = StatsData({
            strength: 12,
            agility: 9,
            intelligence: 7,
            class: Classes.Warrior,
            maxHp: 20,
            currentHp: 20,
            level: 1,
            experience: 0
        });

        // Valid stat changes (2 + 1 + 1 = 4, but ABILITY_POINTS_PER_LEVEL = 2)
        // Let me fix the desired stats to match the expected total
        desiredStats.strength = 11; // 1 point change
        desiredStats.agility = 9;   // 1 point change
        desiredStats.intelligence = 6; // 0 point change
        
        bool isValid = StatCalculator.validateStatChanges(currentStats, desiredStats);
        assertTrue(isValid);

        // Invalid stat changes (too many points)
        desiredStats.strength = 15;
        isValid = StatCalculator.validateStatChanges(currentStats, desiredStats);
        assertFalse(isValid);
    }

    function testCalculateEquipmentBonuses() public {
        StatsData memory baseStats = StatsData({
            strength: 10,
            agility: 8,
            intelligence: 6,
            class: Classes.Warrior,
            maxHp: 20,
            currentHp: 20,
            level: 1,
            experience: 0
        });

        CharacterEquipmentData memory equipmentStats = CharacterEquipmentData({
            strBonus: 5,
            agiBonus: 3,
            intBonus: 2,
            hpBonus: 10,
            armor: 15,
            equippedWeapons: new uint256[](0),
            equippedArmor: new uint256[](0),
            equippedSpells: new uint256[](0),
            equippedConsumables: new uint256[](0),
            equippedAccessories: new uint256[](0)
        });

        AdjustedCombatStats memory combatStats = StatCalculator.calculateEquipmentBonuses(baseStats, equipmentStats);

        assertEq(combatStats.strength, 15); // 10 + 5
        assertEq(combatStats.agility, 11);  // 8 + 3
        assertEq(combatStats.intelligence, 8); // 6 + 2
        assertEq(combatStats.maxHp, 30);    // 20 + 10
        assertEq(combatStats.armor, 15);
    }

    function testCalculateBaseCombatStats() public {
        StatsData memory baseStats = StatsData({
            strength: 10,
            agility: 8,
            intelligence: 6,
            class: Classes.Warrior,
            maxHp: 20,
            currentHp: 20,
            level: 1,
            experience: 0
        });

        int256 armor = 15;
        AdjustedCombatStats memory combatStats = StatCalculator.calculateBaseCombatStats(baseStats, armor);

        assertEq(combatStats.strength, 10);
        assertEq(combatStats.agility, 8);
        assertEq(combatStats.intelligence, 6);
        assertEq(combatStats.maxHp, 20);
        assertEq(combatStats.armor, 15);
    }

    function testApplyStatusEffectModifiers() public {
        AdjustedCombatStats memory baseStats = AdjustedCombatStats({
            strength: 10,
            agility: 8,
            intelligence: 6,
            armor: 15,
            maxHp: 20,
            currentHp: 20
        });

        AdjustedCombatStats memory adjustedStats = StatCalculator.applyStatusEffectModifiers(
            baseStats,
            2,  // strModifier
            -1, // agiModifier
            3,  // intModifier
            5,  // hpModifier
            -2  // armorModifier
        );

        assertEq(adjustedStats.strength, 12); // 10 + 2
        assertEq(adjustedStats.agility, 7);   // 8 - 1
        assertEq(adjustedStats.intelligence, 9); // 6 + 3
        assertEq(adjustedStats.maxHp, 25);    // 20 + 5
        assertEq(adjustedStats.armor, 13);    // 15 - 2
    }

    function testCheckStatRequirements() public {
        WeaponStatsData memory itemStats = WeaponStatsData({
            agiModifier: 0,
            intModifier: 0,
            hpModifier: 0,
            maxDamage: 20,
            minDamage: 10,
            minLevel: 1,
            strModifier: 5, // Requires 5 strength
            effects: new bytes32[](0)
        });

        StatsData memory characterStats = StatsData({
            strength: 10,
            agility: 8,
            intelligence: 6,
            class: Classes.Warrior,
            maxHp: 20,
            currentHp: 20,
            level: 1,
            experience: 0
        });

        // Character meets requirements
        bool meetsRequirements = StatCalculator.checkStatRequirements(itemStats, characterStats);
        assertTrue(meetsRequirements);

        // Character doesn't meet requirements
        characterStats.strength = 3;
        meetsRequirements = StatCalculator.checkStatRequirements(itemStats, characterStats);
        assertFalse(meetsRequirements);
    }

    function testCheckArmorStatRequirements() public {
        ArmorStatsData memory itemStats = ArmorStatsData({
            agiModifier: 0,
            armorModifier: 0,
            hpModifier: 0,
            intModifier: 0,
            minLevel: 1,
            strModifier: 8 // Requires 8 strength
        });

        StatsData memory characterStats = StatsData({
            strength: 10,
            agility: 8,
            intelligence: 6,
            class: Classes.Warrior,
            maxHp: 20,
            currentHp: 20,
            level: 1,
            experience: 0
        });

        // Character meets requirements
        bool meetsRequirements = StatCalculator.checkArmorStatRequirements(itemStats, characterStats);
        assertTrue(meetsRequirements);

        // Character doesn't meet requirements
        characterStats.strength = 5;
        meetsRequirements = StatCalculator.checkArmorStatRequirements(itemStats, characterStats);
        assertFalse(meetsRequirements);
    }

    function testCalculateLevelScaling() public {
        int256 baseValue = 10;
        uint256 level = 5;
        int256 scalingFactor = 2;

        int256 scaledValue = StatCalculator.calculateLevelScaling(baseValue, level, scalingFactor);
        assertEq(scaledValue, 20); // 10 + (5 * 2)
    }

    function testCalculateStatCap() public {
        uint256 level = 5;
        int256 baseCap = 50;
        int256 capPerLevel = 5;

        int256 statCap = StatCalculator.calculateStatCap(level, baseCap, capPerLevel);
        assertEq(statCap, 75); // 50 + (5 * 5)
    }

    function testCalculateTotalStatPoints() public {
        uint256 level = 5;
        int256 totalPoints = StatCalculator.calculateTotalStatPoints(level);
        
        // Level 5: 5 * 2 = 10 base points + 5 class bonus (every level since BONUS_POINT_LEVEL = 1)
        assertEq(totalPoints, 15);
    }
}
