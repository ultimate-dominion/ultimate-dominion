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
import "forge-std/console.sol";

contract StatSystem is System {
    using StatCalculator for *;

    modifier onlyOwner(bytes32 characterId) {
        require(Characters.getOwner(characterId) == _msgSender(), "STAT SYSTEM: INVALID OPERATOR");
        _;
    }

    modifier validCharacter(bytes32 characterId) {
        require(Characters.get(characterId).tokenId != 0, "STAT SYSTEM: INVALID CHARACTER");
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
        require(!Characters.getLocked(characterId), "STAT SYSTEM: character already in game world");
        RngRequestType requestType = RngRequestType.CharacterStats;
        Stats.setClass(characterId, class);
        
        // Use systemSwitch to call rng system
        SystemSwitch.call(abi.encodeCall(IRngSystem.getRng, (userRandomNumber, requestType, abi.encode(characterId))));
        
        console.log("StatSystem: Rolled stats for character", uint256(characterId), "class", uint256(class));
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
        require(!Characters.getLocked(characterId), "STAT SYSTEM: cannot update stats in game");
        
        Stats.set(characterId, newStats);
        
        console.log("StatSystem: Updated stats for character", uint256(characterId));
    }

    /**
     * @dev Calculate stat bonuses using StatCalculator library
     * @param characterId The character to calculate bonuses for
     * @return strBonus Strength bonus
     * @return agiBonus Agility bonus  
     * @return intBonus Intelligence bonus
     * @return hpBonus HP bonus
     */
    function calculateStatBonuses(bytes32 characterId) 
        public 
        view 
        returns (int256 strBonus, int256 agiBonus, int256 intBonus, int256 hpBonus) 
    {
        StatsData memory stats = Stats.get(characterId);
        
        // Calculate class bonus
        (strBonus, agiBonus, intBonus) = StatCalculator.calculateClassBonus(stats.class, stats.level);
        
        // Calculate HP bonus
        hpBonus = StatCalculator.calculateHpBonus(stats.class, stats.level);
        
        console.log("StatSystem: Calculated bonuses for character", uint256(characterId));
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
     * @dev Level up a character with new stats
     * @param characterId The character to level up
     * @param desiredStats The desired new stats
     */
    function levelCharacter(bytes32 characterId, StatsData memory desiredStats) 
        public 
        onlyOwner(characterId) 
        validCharacter(characterId) 
    {
        require(!IWorld(_world()).UD__isInEncounter(characterId), "STAT SYSTEM: cannot level in combat");
        
        StatsData memory stats = abi.decode(Characters.getBaseStats(characterId), (StatsData));
        stats.currentHp = Stats.getCurrentHp(characterId);
        uint256 availableLevel = getCurrentAvailableLevel(stats.experience);
        
        if (stats.level == MAX_LEVEL) {
            return;
        }
        
        // Validate stat changes using StatCalculator
        require(StatCalculator.validateStatChanges(stats, desiredStats), "STAT SYSTEM: INVALID STAT CHANGE");
        
        // Calculate class bonus using StatCalculator
        (int256 strBonus, int256 agiBonus, int256 intBonus) = StatCalculator.calculateClassBonus(getClass(characterId), availableLevel);
        if (strBonus > 0) {
            ++desiredStats.strength;
        }
        if (agiBonus > 0) {
            ++desiredStats.agility;
        }
        if (intBonus > 0) {
            ++desiredStats.intelligence;
        }
        
        // Calculate HP bonus using StatCalculator
        int256 hpBonus = StatCalculator.calculateHpBonus(stats.class, stats.level);
        if (hpBonus > 0) {
            stats.maxHp += hpBonus;
        }
        
        stats.strength = desiredStats.strength;
        stats.agility = desiredStats.agility;
        stats.intelligence = desiredStats.intelligence;
        stats.level += 1;

        // Set base stats
        Characters.setBaseStats(characterId, abi.encode(stats));

        // Apply equipment bonuses and set them to stat table
        _setStats(characterId, IWorld(_world()).UD__calculateEquipmentBonuses(characterId), stats.level);
        
        // Re-apply world effects
        IWorld(_world()).UD__applyWorldEffects(characterId);
        
        console.log("StatSystem: Leveled character", uint256(characterId), "to level", stats.level);
    }

    /**
     * @dev Set stats for an entity (used by other systems)
     * @param entityId The entity to set stats for
     * @param stats The new stats
     */
    function setStats(bytes32 entityId, AdjustedCombatStats memory stats) public {
        _requireAccess(address(this), _msgSender());
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
            revert("STAT SYSTEM: unrecognized entity id");
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
        return abi.decode(Characters.getBaseStats(characterId), (StatsData));
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
