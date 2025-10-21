// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Math, WAD} from "./Math.sol";
import {LibChunks} from "./LibChunks.sol";
import {
    StatsData,
    WeaponStatsData,
    ArmorStatsData,
    CharacterEquipmentData
} from "@codegen/index.sol";
import {Classes} from "@codegen/common.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {
    ABILITY_POINTS_PER_LEVEL,
    MAX_LEVEL,
    BONUS_POINT_LEVEL
} from "../../constants.sol";

/**
 * @title StatCalculator
 * @notice Library containing all stat calculation functions extracted from various systems
 * @dev This library reduces contract size by moving stat calculations out of main systems
 */
library StatCalculator {
    using Math for uint256;
    using Math for int256;

    /**
     * @notice Calculate level from experience points
     * @param experience Current experience points
     * @param levelsTable Array of experience thresholds for each level
     * @return currentLevel The calculated level
     */
    function calculateLevelFromExperience(uint256 experience, uint256[] memory levelsTable)
        internal
        pure
        returns (uint256 currentLevel)
    {
        if (experience >= levelsTable[MAX_LEVEL - 1]) {
            currentLevel = MAX_LEVEL;
        } else {
            for (uint256 i; i < MAX_LEVEL;) {
                if (levelsTable[i] <= experience && levelsTable[i + 1] > experience) {
                    currentLevel = i + 1;
                    break;
                }
                unchecked {
                    i++;
                }
            }
        }
    }

    /**
     * @notice Generate random stats for character creation
     * @param randomNumber Random number for stat generation
     * @param characterClass Character's class
     * @return stats Generated stats data
     */
    function generateRandomStats(uint256 randomNumber, Classes characterClass)
        internal
        pure
        returns (StatsData memory stats)
    {
        uint64[] memory chunks = LibChunks.get4Chunks(randomNumber);

        stats.class = characterClass;

        // Generate base stats in range [3, 10]
        stats.strength = int256(Math.absolute(int256(int64(chunks[0]))) % 8 + 3);
        stats.agility = int256(Math.absolute(int256(int64(chunks[1]))) % 8 + 3);

        // Calculate intelligence to ensure total is 19
        stats.intelligence = int256(19 - stats.strength - stats.agility);

        // Ensure intelligence is within the range [3, 10]
        if (stats.intelligence < 3) {
            int256 deficit = int256(3 - stats.intelligence);
            stats.intelligence = int256(3);

            if (stats.strength > stats.agility) {
                stats.strength -= deficit;
            } else {
                stats.agility -= deficit;
            }
        } else if (stats.intelligence > 10) {
            int256 excess = int256(stats.intelligence - 10);
            stats.intelligence = int256(10);

            if (stats.strength < stats.agility) {
                stats.strength += int256(excess);
            } else {
                stats.agility += int256(excess);
            }
        }

        // Class-based adjustments; should total to 21
        if (characterClass == Classes.Warrior) {
            stats.strength += 2;
            stats.maxHp = int256(20);
        } else if (characterClass == Classes.Rogue) {
            stats.agility += 2;
            stats.maxHp = int256(18);
        } else if (characterClass == Classes.Mage) {
            stats.intelligence += 2;
            stats.maxHp = int256(16);
        }
    }

    /**
     * @notice Calculate HP bonus for leveling up
     * @param characterClass Character's class
     * @param currentLevel Current character level
     * @return hpBonus HP bonus to add
     */
    function calculateHpBonus(Classes characterClass, uint256 currentLevel)
        internal
        pure
        returns (int256 hpBonus)
    {
        // Base HP increase per level
        hpBonus = 3;

        // Warrior gets extra HP every 3 levels
        if (uint8(characterClass) == 0 && currentLevel % 3 == 0) {
            hpBonus += 3;
        }
    }

    /**
     * @notice Calculate class bonus for leveling up
     * @param characterClass Character's class
     * @param availableLevel Available level for leveling
     * @return strBonus Strength bonus
     * @return agiBonus Agility bonus
     * @return intBonus Intelligence bonus
     */
    function calculateClassBonus(Classes characterClass, uint256 availableLevel)
        internal
        pure
        returns (int256 strBonus, int256 agiBonus, int256 intBonus)
    {
        // Add an extra point for class stat every BONUS_POINT_LEVEL levels
        if (availableLevel % BONUS_POINT_LEVEL == 0) {
            if (characterClass == Classes.Warrior) {
                strBonus = 1;
            } else if (characterClass == Classes.Rogue) {
                agiBonus = 1;
            } else if (characterClass == Classes.Mage) {
                intBonus = 1;
            }
        }
    }

    /**
     * @notice Validate stat changes during leveling
     * @param currentStats Current character stats
     * @param desiredStats Desired new stats
     * @return isValid Whether the stat changes are valid
     */
    function validateStatChanges(StatsData memory currentStats, StatsData memory desiredStats)
        internal
        pure
        returns (bool isValid)
    {
        int256 strChange = desiredStats.strength - currentStats.strength;
        int256 agiChange = desiredStats.agility - currentStats.agility;
        int256 intChange = desiredStats.intelligence - currentStats.intelligence;

        // Total stat changes must equal ABILITY_POINTS_PER_LEVEL
        isValid = (strChange + agiChange + intChange) == ABILITY_POINTS_PER_LEVEL;
    }

    /**
     * @notice Calculate equipment bonuses for combat stats
     * @param baseStats Base character stats
     * @param equipmentStats Equipment bonus data
     * @return combatStats Adjusted combat stats with equipment bonuses
     */
    function calculateEquipmentBonuses(StatsData memory baseStats, CharacterEquipmentData memory equipmentStats)
        internal
        pure
        returns (AdjustedCombatStats memory combatStats)
    {
        combatStats.strength = baseStats.strength + equipmentStats.strBonus;
        combatStats.agility = baseStats.agility + equipmentStats.agiBonus;
        combatStats.intelligence = baseStats.intelligence + equipmentStats.intBonus;
        combatStats.maxHp = baseStats.maxHp + equipmentStats.hpBonus;
        combatStats.armor = equipmentStats.armor;
    }

    /**
     * @notice Calculate base combat stats from character stats
     * @param baseStats Base character stats
     * @param armor Current armor value
     * @return combatStats Base combat stats
     */
    function calculateBaseCombatStats(StatsData memory baseStats, int256 armor)
        internal
        pure
        returns (AdjustedCombatStats memory combatStats)
    {
        combatStats.strength = baseStats.strength;
        combatStats.agility = baseStats.agility;
        combatStats.intelligence = baseStats.intelligence;
        combatStats.armor = armor;
        combatStats.maxHp = baseStats.maxHp;
        combatStats.currentHp = baseStats.currentHp;
    }

    /**
     * @notice Apply status effect modifiers to combat stats
     * @param baseStats Base combat stats
     * @param strModifier Strength modifier
     * @param agiModifier Agility modifier
     * @param intModifier Intelligence modifier
     * @param hpModifier HP modifier
     * @param armorModifier Armor modifier
     * @return adjustedStats Stats with status effect modifiers applied
     */
    function applyStatusEffectModifiers(
        AdjustedCombatStats memory baseStats,
        int256 strModifier,
        int256 agiModifier,
        int256 intModifier,
        int256 hpModifier,
        int256 armorModifier
    ) internal pure returns (AdjustedCombatStats memory adjustedStats) {
        adjustedStats.strength = baseStats.strength + strModifier;
        adjustedStats.agility = baseStats.agility + agiModifier;
        adjustedStats.intelligence = baseStats.intelligence + intModifier;
        adjustedStats.maxHp = baseStats.maxHp + hpModifier;
        adjustedStats.armor = baseStats.armor + armorModifier;
        adjustedStats.currentHp = baseStats.currentHp; // Current HP typically not modified by status effects
    }

    /**
     * @notice Calculate stat requirements for equipment
     * @param itemStats Item stat requirements
     * @param characterStats Character's current stats
     * @return meetsRequirements Whether character meets item requirements
     */
    function checkStatRequirements(
        WeaponStatsData memory itemStats,
        StatsData memory characterStats
    ) internal pure returns (bool meetsRequirements) {
        meetsRequirements = characterStats.strength >= itemStats.strModifier &&
            characterStats.agility >= itemStats.agiModifier &&
            characterStats.intelligence >= itemStats.intModifier;
    }

    /**
     * @notice Calculate stat requirements for armor
     * @param itemStats Armor stat requirements
     * @param characterStats Character's current stats
     * @return meetsRequirements Whether character meets armor requirements
     */
    function checkArmorStatRequirements(
        ArmorStatsData memory itemStats,
        StatsData memory characterStats
    ) internal pure returns (bool meetsRequirements) {
        meetsRequirements = characterStats.strength >= itemStats.strModifier &&
            characterStats.agility >= itemStats.agiModifier &&
            characterStats.intelligence >= itemStats.intModifier;
    }

    /**
     * @notice Calculate level-based stat scaling
     * @param baseValue Base stat value
     * @param level Character level
     * @param scalingFactor Scaling factor per level
     * @return scaledValue Scaled stat value
     */
    function calculateLevelScaling(int256 baseValue, uint256 level, int256 scalingFactor)
        internal
        pure
        returns (int256 scaledValue)
    {
        scaledValue = baseValue + (int256(level) * scalingFactor);
    }

    /**
     * @notice Calculate stat cap based on level
     * @param level Character level
     * @param baseCap Base stat cap
     * @param capPerLevel Cap increase per level
     * @return statCap Maximum allowed stat value
     */
    function calculateStatCap(uint256 level, int256 baseCap, int256 capPerLevel)
        internal
        pure
        returns (int256 statCap)
    {
        statCap = baseCap + (int256(level) * capPerLevel);
    }

    /**
     * @notice Calculate total stat points available for leveling
     * @param level Character level
     * @return totalPoints Total stat points available
     */
    function calculateTotalStatPoints(uint256 level) internal pure returns (int256 totalPoints) {
        // Each level gives ABILITY_POINTS_PER_LEVEL points
        // Plus class bonus every BONUS_POINT_LEVEL levels
        totalPoints = int256(level) * ABILITY_POINTS_PER_LEVEL;
        
        // Add class bonus points
        totalPoints += int256(level / BONUS_POINT_LEVEL);
    }
}
