// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    Characters,
    CharactersData,
    Stats,
    StatsData,
    Levels,
    CharacterEquipment,
    MobStats
} from "@codegen/index.sol";
import {Classes, RngRequestType} from "@codegen/common.sol";
import {IWorld} from "@world/IWorld.sol";
import {IRngSystem} from "../../interfaces/IRngSystem.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {StatCalculator} from "@libraries/StatCalculator.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {_requireAccess} from "../../utils.sol";
import {MAX_LEVEL} from "../../../constants.sol";
import {PauseLib} from "../../libraries/PauseLib.sol";
import {
    Unauthorized,
    InvalidCharacter,
    CharacterLocked,
    CannotLevelInCombat,
    InvalidStatChange,
    InvalidCombatEntity
} from "../../Errors.sol";

contract StatSystem is System {
    using StatCalculator for *;

    modifier onlyOwner(bytes32 characterId) {
        if (Characters.getOwner(characterId) != _msgSender()) revert Unauthorized();
        _;
    }

    modifier validCharacter(bytes32 characterId) {
        if (Characters.get(characterId).tokenId == 0) revert InvalidCharacter();
        _;
    }

    /**
     * @dev Roll stats for a character using RNG system
     * @param userRandomNumber User-provided random number
     * @param characterId The character to roll stats for
     * @param class The character's class
     */
    function rollStats(bytes32 userRandomNumber, bytes32 characterId, Classes class)
        public
        payable
        onlyOwner(characterId)
        validCharacter(characterId)
    {
        PauseLib.requireNotPaused();
        if (Characters.getLocked(characterId)) revert CharacterLocked();
        RngRequestType requestType = RngRequestType.CharacterStats;
        Stats.setClass(characterId, class);
        
        // Use systemSwitch to call rng system
        SystemSwitch.call(abi.encodeCall(IRngSystem.getRng, (userRandomNumber, requestType, abi.encode(characterId))));
    }

    /**
     * @dev Update character stats (used by other systems)
     * @param characterId The character to update
     * @param newStats The new stats data
     */
    function updateStats(bytes32 characterId, StatsData memory newStats) 
        public 
        onlyOwner(characterId) 
        validCharacter(characterId) 
    {
        if (Characters.getLocked(characterId)) revert CharacterLocked();
        
        Stats.set(characterId, newStats);
    }

    /**
     * @dev Calculate stat and HP bonuses for a character's next level (diminishing returns)
     * @param characterId The character to calculate bonuses for
     * @return statPoints Number of stat points available for next level
     * @return hpGain HP gained for next level
     */
    function calculateStatBonuses(bytes32 characterId)
        public
        view
        returns (int256 statPoints, int256 hpGain)
    {
        StatsData memory stats = Stats.get(characterId);
        uint256 nextLevel = stats.level + 1;

        // Calculate stat points for next level using diminishing returns
        statPoints = StatCalculator.calculateStatPointsForLevel(nextLevel);

        // Calculate HP gain for next level using diminishing returns
        hpGain = StatCalculator.calculateHpForLevel(nextLevel);
    }

    /**
     * @dev Validate stat requirements for equipment or abilities
     * @param characterId The character to validate
     * @param requiredStats The required stats
     * @return True if character meets requirements
     */
    function validateStatRequirements(bytes32 characterId, StatsData memory requiredStats) 
        public 
        view 
        returns (bool) 
    {
        StatsData memory characterStats = Stats.get(characterId);
        
        return characterStats.strength >= requiredStats.strength &&
               characterStats.agility >= requiredStats.agility &&
               characterStats.intelligence >= requiredStats.intelligence &&
               characterStats.level >= requiredStats.level;
    }

    /**
     * @dev Get current available level based on experience
     * @param experience The character's experience
     * @return The current available level
     */
    function getCurrentAvailableLevel(uint256 experience) public view returns (uint256) {
        uint256[] memory levelsTable = new uint256[](MAX_LEVEL);
        for (uint256 i = 0; i < MAX_LEVEL; i++) {
            levelsTable[i] = Levels.get(i);
        }
        return StatCalculator.calculateLevelFromExperience(experience, levelsTable);
    }

    /**
     * @dev Level up a character with new stats using diminishing returns
     * @param characterId The character to level up
     * @param desiredStats The desired new stats
     */
    function levelCharacter(bytes32 characterId, StatsData memory desiredStats)
        public
        onlyOwner(characterId)
        validCharacter(characterId)
    {
        PauseLib.requireNotPaused();
        if (IWorld(_world()).UD__isInEncounter(characterId)) revert CannotLevelInCombat();

        // Get baseStats, falling back to Stats table if empty
        bytes memory encodedBaseStats = Characters.getBaseStats(characterId);
        StatsData memory stats;
        if (encodedBaseStats.length > 0) {
            stats = abi.decode(encodedBaseStats, (StatsData));
        } else {
            stats = Stats.get(characterId);
        }
        stats.currentHp = Stats.getCurrentHp(characterId);

        if (stats.level == MAX_LEVEL) {
            return;
        }

        uint256 newLevel = stats.level + 1;

        // Validate stat changes using new diminishing returns system
        if (!StatCalculator.validateStatChanges(stats, desiredStats, newLevel)) revert InvalidStatChange();

        // Calculate HP gain using diminishing returns
        int256 hpGain = StatCalculator.calculateHpForLevel(newLevel);
        stats.maxHp += hpGain;

        stats.strength = desiredStats.strength;
        stats.agility = desiredStats.agility;
        stats.intelligence = desiredStats.intelligence;
        stats.level = newLevel;

        // Set base stats
        Characters.setBaseStats(characterId, abi.encode(stats));

        // Apply equipment bonuses and set them to stat table
        _setStats(characterId, IWorld(_world()).UD__calculateEquipmentBonuses(characterId), stats.level);

        // Re-apply world effects
        IWorld(_world()).UD__applyWorldEffects(characterId);
    }

    /**
     * @dev Set stats for an entity (used by other systems)
     * @param entityId The entity to set stats for
     * @param stats The new stats
     */
    function setStats(bytes32 entityId, AdjustedCombatStats memory stats) public {
        // Note: openAccess is true for this system, allowing any caller
        // This function is typically called by other systems like MapSystem
        StatsData memory statsData = Stats.get(entityId);

        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            statsData.strength = stats.strength;
            statsData.agility = stats.agility;
            statsData.intelligence = stats.intelligence;
            statsData.maxHp = stats.maxHp;
            CharacterEquipment.setArmor(entityId, stats.armor);
        } else if (IWorld(_world()).UD__isValidMob(entityId)) {
            statsData.strength = stats.strength;
            statsData.agility = stats.agility;
            statsData.intelligence = stats.intelligence;
            statsData.maxHp = stats.maxHp;
            MobStats.setArmor(entityId, stats.armor);
        } else {
            revert InvalidCombatEntity();
        }
        Stats.set(entityId, statsData);
    }

    /**
     * @dev Internal function to set stats with level
     * @param entityId The entity to set stats for
     * @param stats The new stats
     * @param level The entity's level
     */
    function _setStats(bytes32 entityId, AdjustedCombatStats memory stats, uint256 level) internal {
        StatsData memory statsData = Stats.get(entityId);
        statsData.strength = stats.strength;
        statsData.agility = stats.agility;
        statsData.intelligence = stats.intelligence;
        statsData.maxHp = stats.maxHp;
        statsData.currentHp = stats.maxHp;
        statsData.level = level;
        Stats.set(entityId, statsData);
    }

    /**
     * @dev Get character stats
     * @param characterId The character ID
     * @return The character's stats
     */
    function getStats(bytes32 characterId) public view returns (StatsData memory) {
        return Stats.get(characterId);
    }

    /**
     * @dev Get character base stats
     * @param characterId The character ID
     * @return The character's base stats
     */
    function getBaseStats(bytes32 characterId) public view returns (StatsData memory) {
        bytes memory encodedBaseStats = Characters.getBaseStats(characterId);
        if (encodedBaseStats.length > 0) {
            return abi.decode(encodedBaseStats, (StatsData));
        } else {
            // Fallback to Stats table for characters that haven't entered the game
            return Stats.get(characterId);
        }
    }

    /**
     * @dev Get character class
     * @param characterId The character ID
     * @return The character's class
     */
    function getClass(bytes32 characterId) public view returns (Classes) {
        return Stats.getClass(characterId);
    }

    /**
     * @dev Get character experience
     * @param characterId The character ID
     * @return The character's experience
     */
    function getExperience(bytes32 characterId) public view returns (uint256) {
        return Stats.getExperience(characterId);
    }

    /**
     * @dev Get character level
     * @param characterId The character ID
     * @return The character's level
     */
    function getLevel(bytes32 characterId) public view returns (uint256) {
        StatsData memory stats = Stats.get(characterId);
        return stats.level;
    }
}
