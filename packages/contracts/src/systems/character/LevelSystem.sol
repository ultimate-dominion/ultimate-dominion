// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    Levels,
    Stats,
    Characters,
    CharactersData,
    StatsData
} from "@codegen/index.sol";
import {Classes, PowerSource, Race, ArmorType, AdvancedClass} from "@codegen/common.sol";
import {IWorld} from "@world/IWorld.sol";
import {StatCalculator} from "@libraries/StatCalculator.sol";
import {MAX_LEVEL} from "../../../constants.sol";
import {_requireAccess} from "../../utils.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";

/**
 * @title LevelSystem
 * @dev Handles character leveling mechanics including level progression, stat bonuses, and validation
 */
contract LevelSystem is System {
    using StatCalculator for *;

    // Events
    event CharacterLeveledUp(bytes32 indexed characterId, uint256 newLevel, uint256 experience);
    event LevelBonusApplied(bytes32 indexed characterId, uint256 statType, int256 bonus);

    // Errors
    error LevelSystem_CharacterNotFound();
    error LevelSystem_InvalidLevel();
    error LevelSystem_InvalidStatChanges();
    error LevelSystem_CharacterInCombat();
    error LevelSystem_MaxLevelReached();
    error LevelSystem_InsufficientExperience();

    /**
     * @dev Levels up a character with the provided stat distribution
     * @param characterId The character to level up
     * @param desiredStats The desired stat distribution for the level up
     */
    function UD__levelCharacter(bytes32 characterId, StatsData memory desiredStats) public {
        // Validate character exists
        if (!IWorld(_world()).UD__isValidCharacterId(characterId)) {
            revert LevelSystem_CharacterNotFound();
        }

        // Check if character is in combat
        if (IWorld(_world()).UD__isInEncounter(characterId)) {
            revert LevelSystem_CharacterInCombat();
        }

        // Get current stats
        StatsData memory stats = abi.decode(Characters.getBaseStats(characterId), (StatsData));
        stats.currentHp = Stats.getCurrentHp(characterId);
        
        // Check if already at max level
        if (stats.level >= MAX_LEVEL) {
            revert LevelSystem_MaxLevelReached();
        }

        // Calculate available level based on experience
        uint256 availableLevel = UD__getCurrentAvailableLevel(stats.experience);
        
        // Check if character can level up
        if (availableLevel <= stats.level) {
            revert LevelSystem_InsufficientExperience();
        }

        // Validate stat changes using new level
        uint256 newLevel = stats.level + 1;
        if (!StatCalculator.validateStatChanges(stats, desiredStats, newLevel)) {
            revert LevelSystem_InvalidStatChanges();
        }

        // Process the level up
        processLevelUp(characterId, stats, desiredStats, newLevel);
    }

    /**
     * @dev Calculates level bonuses for a character using diminishing returns
     * @param characterId The character to calculate bonuses for
     * @return statPoints Number of stat points available for the next level
     * @return hpGain HP gained for the next level
     */
    function calculateLevelBonuses(bytes32 characterId) public view returns (
        int256 statPoints,
        int256 hpGain
    ) {
        StatsData memory stats = abi.decode(Characters.getBaseStats(characterId), (StatsData));
        uint256 nextLevel = stats.level + 1;

        // Calculate stat points for next level using diminishing returns
        statPoints = StatCalculator.calculateStatPointsForLevel(nextLevel);

        // Calculate HP gain for next level using diminishing returns
        hpGain = StatCalculator.calculateHpForLevel(nextLevel);
    }

    /**
     * @dev Validates level requirements for a character
     * @param characterId The character to validate
     * @param desiredStats The desired stat distribution
     * @return isValid Whether the level requirements are met
     */
    function validateLevelRequirements(bytes32 characterId, StatsData memory desiredStats) public view returns (bool isValid) {
        StatsData memory stats = abi.decode(Characters.getBaseStats(characterId), (StatsData));
        uint256 availableLevel = UD__getCurrentAvailableLevel(stats.experience);

        // Check if character can level up
        if (availableLevel <= stats.level) {
            return false;
        }

        // Validate stat changes using new level
        uint256 newLevel = stats.level + 1;
        return StatCalculator.validateStatChanges(stats, desiredStats, newLevel);
    }

    /**
     * @dev Processes a character level up with diminishing returns
     * @param characterId The character to level up
     * @param currentStats Current character stats
     * @param desiredStats Desired stat distribution
     * @param newLevel The new level being attained
     */
    function processLevelUp(bytes32 characterId, StatsData memory currentStats, StatsData memory desiredStats, uint256 newLevel) internal {
        // Calculate and apply HP gain using diminishing returns
        int256 hpGain = StatCalculator.calculateHpForLevel(newLevel);
        if (hpGain > 0) {
            currentStats.maxHp = currentStats.maxHp + hpGain;
            emit LevelBonusApplied(characterId, 3, hpGain); // 3 = HP
        }

        // Update stats
        currentStats.strength = desiredStats.strength;
        currentStats.agility = desiredStats.agility;
        currentStats.intelligence = desiredStats.intelligence;
        currentStats.level = newLevel;

        // Update character base stats
        Characters.setBaseStats(characterId, abi.encode(currentStats));

        // Apply equipment bonuses and set them to stat table
        AdjustedCombatStats memory equipmentBonuses = IWorld(_world()).UD__calculateEquipmentBonuses(characterId);
        _setStats(characterId, equipmentBonuses, currentStats.level);

        // Re-apply world effects
        IWorld(_world()).UD__applyWorldEffects(characterId);

        emit CharacterLeveledUp(characterId, currentStats.level, currentStats.experience);
    }

    /**
     * @dev Gets the current available level based on experience
     * @param experience The character's experience points
     * @return currentAvailableLevel The level the character can reach
     */
    function UD__getCurrentAvailableLevel(uint256 experience) public view returns (uint256 currentAvailableLevel) {
        uint256[] memory levelsTable = new uint256[](MAX_LEVEL);
        for (uint256 i = 0; i < MAX_LEVEL; i++) {
            levelsTable[i] = Levels.get(i);
        }
        return StatCalculator.calculateLevelFromExperience(experience, levelsTable);
    }

    /**
     * @dev Sets stats for an entity (internal function)
     * @param entityId The entity ID
     * @param adjustedStats Adjusted combat stats
     * @param level The character level
     */
    function _setStats(bytes32 entityId, AdjustedCombatStats memory adjustedStats, uint256 level) internal {
        _requireAccess(address(this), _msgSender());
        // Get existing stats to preserve certain fields
        StatsData memory existingStats = Stats.get(entityId);

        // Update combat-related fields while preserving class-related fields
        existingStats.strength = adjustedStats.strength;
        existingStats.agility = adjustedStats.agility;
        existingStats.intelligence = adjustedStats.intelligence;
        existingStats.maxHp = adjustedStats.maxHp;
        existingStats.currentHp = adjustedStats.maxHp;
        existingStats.level = level;

        Stats.set(entityId, existingStats);
    }

    /**
     * @dev Gets character class (helper function)
     * @param characterId The character ID
     * @return characterClass The character's class
     */
    function getClass(bytes32 characterId) internal view returns (Classes characterClass) {
        return Stats.getClass(characterId);
    }
}
