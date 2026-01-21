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
import {Classes, PowerSource, Race, ArmorType, AdvancedClass} from "@codegen/common.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {
    MAX_LEVEL,
    EARLY_GAME_CAP,
    MID_GAME_CAP,
    STAT_POINTS_EARLY,
    STAT_POINTS_MID,
    STAT_POINTS_LATE,
    BASE_HP_GAIN_EARLY,
    BASE_HP_GAIN_MID,
    BASE_HP_GAIN_LATE
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
     * @notice Generate random stats for character creation (legacy - uses class system)
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
     * @notice Generate balanced base stats for implicit class system
     * @dev Generates stats totaling 19 points (each stat 3-10), base HP of 18
     *      Race and armor bonuses are applied separately via chooseRace/chooseStartingArmor
     * @param randomNumber Random number for stat generation
     * @param existingStats Existing stats to preserve (race, powerSource, etc. if already set)
     * @return stats Generated stats data with balanced distribution
     */
    function generateBalancedBaseStats(uint256 randomNumber, StatsData memory existingStats)
        internal
        pure
        returns (StatsData memory stats)
    {
        uint64[] memory chunks = LibChunks.get4Chunks(randomNumber);

        // Preserve existing implicit class choices
        stats.powerSource = existingStats.powerSource;
        stats.race = existingStats.race;
        stats.startingArmor = existingStats.startingArmor;
        stats.advancedClass = existingStats.advancedClass;
        stats.hasSelectedAdvancedClass = existingStats.hasSelectedAdvancedClass;

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

        // Base HP for all characters (bonuses come from race/armor choices)
        stats.maxHp = int256(18);
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
     * @notice Calculate stat points gained for a specific level (diminishing returns)
     * @param level The level being gained
     * @return statPoints Number of stat points gained at this level
     */
    function calculateStatPointsForLevel(uint256 level)
        internal
        pure
        returns (int256 statPoints)
    {
        if (level <= EARLY_GAME_CAP) {
            // Levels 1-10: +1 stat point every level
            statPoints = STAT_POINTS_EARLY;
        } else if (level <= MID_GAME_CAP) {
            // Levels 11-50: +1 stat point every 2 levels
            statPoints = (level % 2 == 0) ? STAT_POINTS_MID : int256(0);
        } else {
            // Levels 51-100: +1 stat point every 5 levels
            statPoints = (level % 5 == 0) ? STAT_POINTS_LATE : int256(0);
        }
    }

    /**
     * @notice Calculate HP gained for a specific level (diminishing returns)
     * @param level The level being gained
     * @return hpGain HP gained at this level
     */
    function calculateHpForLevel(uint256 level)
        internal
        pure
        returns (int256 hpGain)
    {
        if (level <= EARLY_GAME_CAP) {
            // Levels 1-10: +2 HP every level
            hpGain = BASE_HP_GAIN_EARLY;
        } else if (level <= MID_GAME_CAP) {
            // Levels 11-50: +1 HP every level
            hpGain = BASE_HP_GAIN_MID;
        } else {
            // Levels 51-100: +1 HP every 2 levels
            hpGain = (level % 2 == 0) ? BASE_HP_GAIN_LATE : int256(0);
        }
    }

    /**
     * @notice Validate stat changes during leveling
     * @param currentStats Current character stats
     * @param desiredStats Desired new stats
     * @param newLevel The level being gained
     * @return isValid Whether the stat changes are valid
     */
    function validateStatChanges(StatsData memory currentStats, StatsData memory desiredStats, uint256 newLevel)
        internal
        pure
        returns (bool isValid)
    {
        int256 strChange = desiredStats.strength - currentStats.strength;
        int256 agiChange = desiredStats.agility - currentStats.agility;
        int256 intChange = desiredStats.intelligence - currentStats.intelligence;

        // Total stat changes must equal the stat points for this level
        int256 allowedPoints = calculateStatPointsForLevel(newLevel);
        isValid = (strChange + agiChange + intChange) == allowedPoints;
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
     * @notice Calculate total stat points accumulated up to a level (diminishing returns)
     * @param level Character level
     * @return totalPoints Total stat points accumulated
     */
    function calculateTotalStatPoints(uint256 level) internal pure returns (int256 totalPoints) {
        totalPoints = 0;

        // Early game: levels 1-10, +1 per level
        uint256 earlyLevels = level > EARLY_GAME_CAP ? EARLY_GAME_CAP : level;
        totalPoints += int256(earlyLevels) * STAT_POINTS_EARLY;

        if (level > EARLY_GAME_CAP) {
            // Mid game: levels 11-50, +1 per 2 levels
            uint256 midLevels = level > MID_GAME_CAP ? MID_GAME_CAP - EARLY_GAME_CAP : level - EARLY_GAME_CAP;
            totalPoints += int256(midLevels / 2) * STAT_POINTS_MID;

            if (level > MID_GAME_CAP) {
                // Late game: levels 51-100, +1 per 5 levels
                uint256 lateLevels = level - MID_GAME_CAP;
                totalPoints += int256(lateLevels / 5) * STAT_POINTS_LATE;
            }
        }
    }

    /**
     * @notice Calculate total HP accumulated up to a level (diminishing returns)
     * @param level Character level
     * @return totalHp Total HP accumulated from leveling
     */
    function calculateTotalHpFromLeveling(uint256 level) internal pure returns (int256 totalHp) {
        totalHp = 0;

        // Early game: levels 1-10, +2 per level
        uint256 earlyLevels = level > EARLY_GAME_CAP ? EARLY_GAME_CAP : level;
        totalHp += int256(earlyLevels) * BASE_HP_GAIN_EARLY;

        if (level > EARLY_GAME_CAP) {
            // Mid game: levels 11-50, +1 per level
            uint256 midLevels = level > MID_GAME_CAP ? MID_GAME_CAP - EARLY_GAME_CAP : level - EARLY_GAME_CAP;
            totalHp += int256(midLevels) * BASE_HP_GAIN_MID;

            if (level > MID_GAME_CAP) {
                // Late game: levels 51-100, +1 per 2 levels
                uint256 lateLevels = level - MID_GAME_CAP;
                totalHp += int256(lateLevels / 2) * BASE_HP_GAIN_LATE;
            }
        }
    }
}
