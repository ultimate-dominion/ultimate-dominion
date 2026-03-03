// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {StatCalculator} from "../src/libraries/StatCalculator.sol";
import {StatsData, WeaponStatsData, ArmorStatsData, CharacterEquipmentData} from "@codegen/index.sol";
import {Classes, PowerSource, Race, ArmorType, AdvancedClass} from "@codegen/common.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";

contract StatCalculatorTest is Test {
    function _createDefaultStatsData() internal pure returns (StatsData memory) {
        return StatsData({
            strength: 10,
            agility: 8,
            intelligence: 6,
            class: Classes.Warrior,
            maxHp: 20,
            currentHp: 20,
            level: 1,
            experience: 0,
            powerSource: PowerSource.None,
            race: Race.None,
            startingArmor: ArmorType.None,
            advancedClass: AdvancedClass.None,
            hasSelectedAdvancedClass: false
        });
    }

    function testCalculateLevelFromExperience() public {
        // Create array with 100 levels (MAX_LEVEL)
        uint256[] memory levelsTable = new uint256[](100);

        // Set up experience thresholds with increasing requirements
        for (uint256 i = 0; i < 100; i++) {
            // Simple formula: level 1 = 0 XP, then increasing exponentially
            if (i == 0) {
                levelsTable[i] = 0;
            } else {
                levelsTable[i] = levelsTable[i - 1] + (i * 100);
            }
        }

        // Test level 1 (0-99 XP)
        uint256 level = StatCalculator.calculateLevelFromExperience(50, levelsTable);
        assertEq(level, 1);

        // Test level 5 (levelsTable[4] to levelsTable[5] - 1)
        level = StatCalculator.calculateLevelFromExperience(1100, levelsTable);
        assertEq(level, 5);

        // Test max level (XP >= levelsTable[99])
        level = StatCalculator.calculateLevelFromExperience(1000000, levelsTable);
        assertEq(level, 100);
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

    function testCalculateStatPointsForLevel() public {
        // Test early game: levels 1-10, +2 per level
        int256 statPoints = StatCalculator.calculateStatPointsForLevel(5);
        assertEq(statPoints, 2);

        statPoints = StatCalculator.calculateStatPointsForLevel(10);
        assertEq(statPoints, 2);

        // Test mid game: levels 11-50, +1 per 2 levels (even levels only)
        statPoints = StatCalculator.calculateStatPointsForLevel(12);
        assertEq(statPoints, 1); // even level gets point

        statPoints = StatCalculator.calculateStatPointsForLevel(13);
        assertEq(statPoints, 0); // odd level gets no point

        // Test late game: levels 51-100, +1 per 5 levels
        statPoints = StatCalculator.calculateStatPointsForLevel(55);
        assertEq(statPoints, 1); // level 55 % 5 == 0

        statPoints = StatCalculator.calculateStatPointsForLevel(52);
        assertEq(statPoints, 0); // level 52 % 5 != 0
    }

    function testCalculateHpForLevel() public {
        // Test early game: +2 HP per level
        int256 hpGain = StatCalculator.calculateHpForLevel(5);
        assertEq(hpGain, 2);

        // Test mid game: +1 HP per level
        hpGain = StatCalculator.calculateHpForLevel(25);
        assertEq(hpGain, 1);

        // Test late game: +1 HP per 2 levels (even only)
        hpGain = StatCalculator.calculateHpForLevel(60);
        assertEq(hpGain, 1); // even level

        hpGain = StatCalculator.calculateHpForLevel(61);
        assertEq(hpGain, 0); // odd level
    }

    function testValidateStatChanges() public {
        StatsData memory currentStats = _createDefaultStatsData();

        StatsData memory desiredStats = _createDefaultStatsData();
        desiredStats.strength = 12; // +2 point change

        // Valid stat changes for level 2 (early game: +2 points)
        bool isValid = StatCalculator.validateStatChanges(currentStats, desiredStats, 2);
        assertTrue(isValid);

        // Invalid stat changes (too many points)
        desiredStats.strength = 15; // +5 points
        isValid = StatCalculator.validateStatChanges(currentStats, desiredStats, 2);
        assertFalse(isValid);
    }

    function testValidateStatChanges_PhysicalBonusAtLevel5() public {
        StatsData memory currentStats = _createDefaultStatsData();
        currentStats.powerSource = PowerSource.Physical;

        // Physical at level 5 gets 3 points (2 base + 1 bonus)
        StatsData memory desiredStats = _createDefaultStatsData();
        desiredStats.powerSource = PowerSource.Physical;
        desiredStats.strength = 13; // +3 point change

        bool isValid = StatCalculator.validateStatChanges(currentStats, desiredStats, 5);
        assertTrue(isValid);

        // 2 points should be invalid for Physical at level 5 (needs exactly 3)
        StatsData memory twoPointStats = _createDefaultStatsData();
        twoPointStats.powerSource = PowerSource.Physical;
        twoPointStats.strength = 12; // +2 point change
        isValid = StatCalculator.validateStatChanges(currentStats, twoPointStats, 5);
        assertFalse(isValid);
    }

    function testValidateStatChanges_NonPhysicalNoBonusAtLevel5() public {
        // Divine at level 5 should NOT get the extra point
        StatsData memory divineStats = _createDefaultStatsData();
        divineStats.powerSource = PowerSource.Divine;

        StatsData memory desiredStats = _createDefaultStatsData();
        desiredStats.powerSource = PowerSource.Divine;
        desiredStats.strength = 12; // +2 points (normal)

        bool isValid = StatCalculator.validateStatChanges(divineStats, desiredStats, 5);
        assertTrue(isValid);

        // 3 points should be invalid for Divine at level 5
        StatsData memory threePointStats = _createDefaultStatsData();
        threePointStats.powerSource = PowerSource.Divine;
        threePointStats.strength = 13; // +3 points
        isValid = StatCalculator.validateStatChanges(divineStats, threePointStats, 5);
        assertFalse(isValid);
    }

    function testValidateStatChanges_PhysicalNoBonusAtOtherLevels() public {
        // Physical at level 4 should NOT get the extra point
        StatsData memory currentStats = _createDefaultStatsData();
        currentStats.powerSource = PowerSource.Physical;

        StatsData memory desiredStats = _createDefaultStatsData();
        desiredStats.powerSource = PowerSource.Physical;
        desiredStats.strength = 12; // +2 points (normal)

        bool isValid = StatCalculator.validateStatChanges(currentStats, desiredStats, 4);
        assertTrue(isValid);

        // 3 points should be invalid at level 4
        StatsData memory threePointStats = _createDefaultStatsData();
        threePointStats.powerSource = PowerSource.Physical;
        threePointStats.strength = 13; // +3 points
        isValid = StatCalculator.validateStatChanges(currentStats, threePointStats, 4);
        assertFalse(isValid);
    }

    function testCalculateEquipmentBonuses() public {
        StatsData memory baseStats = _createDefaultStatsData();

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
        StatsData memory baseStats = _createDefaultStatsData();

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

        StatsData memory characterStats = _createDefaultStatsData();

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
            strModifier: 8, // Requires 8 strength
            armorType: ArmorType.Cloth
        });

        StatsData memory characterStats = _createDefaultStatsData();

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
        // Test level 10 (early game: 20 points)
        int256 totalPoints = StatCalculator.calculateTotalStatPoints(10);
        assertEq(totalPoints, 20); // 10 levels * 2 points

        // Test level 20 (20 early + 5 mid = 25)
        totalPoints = StatCalculator.calculateTotalStatPoints(20);
        assertEq(totalPoints, 25); // 20 + (10/2) = 25

        // Test level 60 (20 early + 20 mid + 2 late)
        totalPoints = StatCalculator.calculateTotalStatPoints(60);
        assertEq(totalPoints, 42); // 20 + 20 + 2 = 42
    }

    function testCalculateTotalHpFromLeveling() public {
        // Test level 10 (early game: 20 HP)
        int256 totalHp = StatCalculator.calculateTotalHpFromLeveling(10);
        assertEq(totalHp, 20); // 10 levels * 2 HP

        // Test level 20 (20 early + 10 mid = 30)
        totalHp = StatCalculator.calculateTotalHpFromLeveling(20);
        assertEq(totalHp, 30); // 20 + 10 = 30

        // Test level 60 (20 early + 40 mid + 5 late)
        totalHp = StatCalculator.calculateTotalHpFromLeveling(60);
        assertEq(totalHp, 65); // 20 + 40 + 5 = 65
    }
}
