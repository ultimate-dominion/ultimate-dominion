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
import {Classes} from "@codegen/common.sol";
import {IWorld} from "@world/IWorld.sol";
import {StatCalculator} from "@libraries/StatCalculator.sol";
import {MAX_LEVEL, ABILITY_POINTS_PER_LEVEL, BONUS_POINT_LEVEL} from "../../../constants.sol";
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

        // Validate stat changes
        if (!StatCalculator.validateStatChanges(stats, desiredStats)) {
            revert LevelSystem_InvalidStatChanges();
        }

        // Process the level up
        processLevelUp(characterId, stats, desiredStats);
    }

    /**
     * @dev Calculates level bonuses for a character
     * @param characterId The character to calculate bonuses for
     * @return strBonus Strength bonus
     * @return agiBonus Agility bonus  
     * @return intBonus Intelligence bonus
     * @return hpBonus HP bonus
     */
    function calculateLevelBonuses(bytes32 characterId) public view returns (
        int256 strBonus,
        int256 agiBonus, 
        int256 intBonus,
        int256 hpBonus
    ) {
        StatsData memory stats = abi.decode(Characters.getBaseStats(characterId), (StatsData));
        uint256 availableLevel = UD__getCurrentAvailableLevel(stats.experience);
        
        // Calculate class bonuses
        (strBonus, agiBonus, intBonus) = StatCalculator.calculateClassBonus(stats.class, availableLevel);
        
        // Calculate HP bonus
        hpBonus = StatCalculator.calculateHpBonus(stats.class, stats.level);
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
        
        // Validate stat changes
        return StatCalculator.validateStatChanges(stats, desiredStats);
    }

    /**
     * @dev Processes a character level up
     * @param characterId The character to level up
     * @param currentStats Current character stats
     * @param desiredStats Desired stat distribution
     */
    function processLevelUp(bytes32 characterId, StatsData memory currentStats, StatsData memory desiredStats) internal {
        uint256 availableLevel = UD__getCurrentAvailableLevel(currentStats.experience);
        
        // Calculate class bonuses
        (int256 strBonus, int256 agiBonus, int256 intBonus) = StatCalculator.calculateClassBonus(
            currentStats.class, 
            availableLevel
        );
        
        // Apply class bonuses to desired stats
        if (strBonus > 0) {
            desiredStats.strength = desiredStats.strength + strBonus;
            emit LevelBonusApplied(characterId, 0, strBonus); // 0 = strength
        }
        if (agiBonus > 0) {
            desiredStats.agility = desiredStats.agility + agiBonus;
            emit LevelBonusApplied(characterId, 1, agiBonus); // 1 = agility
        }
        if (intBonus > 0) {
            desiredStats.intelligence = desiredStats.intelligence + intBonus;
            emit LevelBonusApplied(characterId, 2, intBonus); // 2 = intelligence
        }
        
        // Calculate and apply HP bonus
        int256 hpBonus = StatCalculator.calculateHpBonus(currentStats.class, currentStats.level);
        if (hpBonus > 0) {
            currentStats.maxHp = currentStats.maxHp + hpBonus;
            emit LevelBonusApplied(characterId, 3, hpBonus); // 3 = HP
        }
        
        // Update stats
        currentStats.strength = desiredStats.strength;
        currentStats.agility = desiredStats.agility;
        currentStats.intelligence = desiredStats.intelligence;
        currentStats.level += 1;
        
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
        // Convert AdjustedCombatStats to StatsData
        StatsData memory statsData = StatsData({
            strength: adjustedStats.strength,
            agility: adjustedStats.agility,
            intelligence: adjustedStats.intelligence,
            maxHp: adjustedStats.maxHp,
            currentHp: adjustedStats.maxHp, // Use maxHp as currentHp for now
            experience: 0, // This will be set by the calling function
            level: level,
            class: Classes.Warrior // This will be set by the calling function
        });
        Stats.set(entityId, statsData);
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
