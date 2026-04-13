// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {Characters, CharactersData, Stats, StatsData, ClassMultipliers, StatRollCount} from "@codegen/index.sol";
import {Race, PowerSource, ArmorType, AdvancedClass, RngRequestType} from "@codegen/common.sol";
import {IWorld} from "@world/IWorld.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import {AdjustedCombatStats} from "../interfaces/Structs.sol";
import {CLASS_MULTIPLIER_BASE} from "../../constants.sol";
import {
    Unauthorized,
    CharacterLocked,
    InvalidRace,
    RaceAlreadySet,
    InvalidPowerSource,
    PowerSourceAlreadySet,
    InvalidArmorType,
    ArmorAlreadySet,
    RequiresLevel10,
    AdvancedClassAlreadySet,
    InvalidAdvancedClass,
    MaxStatRollsExceeded
} from "../Errors.sol";
import {MAX_STAT_ROLLS} from "../../constants.sol";

/**
 * @title ImplicitClassSystem
 * @notice Handles the implicit class system - race, power source, armor selection, and advanced class at level 10
 */
contract ImplicitClassSystem is System {
    // Events
    event RaceSelected(bytes32 indexed characterId, Race race);
    event PowerSourceSelected(bytes32 indexed characterId, PowerSource powerSource);
    event ArmorTypeSelected(bytes32 indexed characterId, ArmorType armorType);
    event AdvancedClassSelected(bytes32 indexed characterId, AdvancedClass advancedClass);

    modifier onlyOwner(bytes32 characterId) {
        if (Characters.getOwner(characterId) != _msgSender()) revert Unauthorized();
        _;
    }

    /**
     * @notice Choose race for a character (part of implicit class system)
     * @param characterId The character to set race for
     * @param race The chosen race (Human, Elf, Dwarf)
     * @dev Applies race-specific stat modifiers:
     *      - Dwarf: STR +2, AGI -1, HP +1
     *      - Elf: AGI +2, INT +1, STR -1, HP -1
     *      - Human: STR +1, AGI +1, INT +1
     */
    function chooseRace(bytes32 characterId, Race race) public onlyOwner(characterId) {
        PauseLib.requireNotPaused();
        if (Characters.getLocked(characterId)) revert CharacterLocked();
        if (race == Race.None) revert InvalidRace();
        if (Stats.getRace(characterId) != Race.None) revert RaceAlreadySet();

        StatsData memory stats = Stats.get(characterId);
        stats.race = race;

        // Apply race-based stat modifiers
        if (race == Race.Dwarf) {
            stats.strength += 2;
            stats.agility -= 1;
            stats.maxHp += 1;
        } else if (race == Race.Elf) {
            stats.agility += 2;
            stats.intelligence += 1;
            stats.strength -= 1;
            stats.maxHp -= 1;
        } else if (race == Race.Human) {
            stats.strength += 1;
            stats.agility += 1;
            stats.intelligence += 1;
        }

        Stats.set(characterId, stats);
        emit RaceSelected(characterId, race);
    }

    /**
     * @notice Choose power source for a character (part of implicit class system)
     * @param characterId The character to set power source for
     * @param powerSource The chosen power source (Divine, Weave, Physical)
     * @dev Power source determines which advanced classes are available at level 10
     */
    function choosePowerSource(bytes32 characterId, PowerSource powerSource) public onlyOwner(characterId) {
        PauseLib.requireNotPaused();
        if (Characters.getLocked(characterId)) revert CharacterLocked();
        if (powerSource == PowerSource.None) revert InvalidPowerSource();
        if (Stats.getPowerSource(characterId) != PowerSource.None) revert PowerSourceAlreadySet();

        Stats.setPowerSource(characterId, powerSource);
        emit PowerSourceSelected(characterId, powerSource);
    }

    /**
     * @notice Choose starting armor type for a character (part of implicit class system)
     * @param characterId The character to set armor type for
     * @param armorType The chosen armor type (Cloth, Leather, Plate)
     * @dev Applies armor-type specific stat modifiers:
     *      - Cloth: INT +2, AGI +1, STR -1
     *      - Leather: AGI +2, STR +1
     *      - Plate: STR +2, HP +1, AGI -1
     */
    function chooseStartingArmor(bytes32 characterId, ArmorType armorType) public onlyOwner(characterId) {
        if (Characters.getLocked(characterId)) revert CharacterLocked();
        if (armorType == ArmorType.None) revert InvalidArmorType();
        if (Stats.getStartingArmor(characterId) != ArmorType.None) revert ArmorAlreadySet();

        StatsData memory stats = Stats.get(characterId);
        stats.startingArmor = armorType;

        // Apply armor-based stat modifiers
        if (armorType == ArmorType.Cloth) {
            stats.intelligence += 2;
            stats.agility += 1;
            stats.strength -= 1;
        } else if (armorType == ArmorType.Leather) {
            stats.agility += 2;
            stats.strength += 1;
        } else if (armorType == ArmorType.Plate) {
            stats.strength += 2;
            stats.maxHp += 1;
            stats.agility -= 1;
        }

        Stats.set(characterId, stats);
        emit ArmorTypeSelected(characterId, armorType);
    }

    /**
     * @notice Roll base stats for a character using RNG
     * @param userRandomNumber User-provided random seed
     * @param characterId The character to roll stats for
     * @dev Race bonuses are applied if race has already been selected. Armor is chosen via enterGame.
     */
    function rollBaseStats(bytes32 userRandomNumber, bytes32 characterId) public payable onlyOwner(characterId) {
        PauseLib.requireNotPaused();
        if (Characters.getLocked(characterId)) revert CharacterLocked();

        // Enforce re-roll limit (MAX_STAT_ROLLS total rolls allowed)
        uint32 currentRolls = StatRollCount.getRollCount(characterId);
        if (currentRolls >= MAX_STAT_ROLLS) revert MaxStatRollsExceeded();
        StatRollCount.setRollCount(characterId, currentRolls + 1);

        RngRequestType requestType = RngRequestType.CharacterStats;
        // Encode characterId with a flag indicating this is for balanced stats
        bytes memory data = abi.encode(characterId, true); // true = use balanced stats
        SystemSwitch.call(abi.encodeCall(IRngSystem.getRng, (userRandomNumber, requestType, data)));
    }

    /**
     * @notice Get the power source for a character
     */
    function getPowerSource(bytes32 characterId) public view returns (PowerSource) {
        return Stats.getPowerSource(characterId);
    }

    /**
     * @notice Get the race for a character
     */
    function getRace(bytes32 characterId) public view returns (Race) {
        return Stats.getRace(characterId);
    }

    /**
     * @notice Get the starting armor type for a character
     */
    function getStartingArmor(bytes32 characterId) public view returns (ArmorType) {
        return Stats.getStartingArmor(characterId);
    }

    /**
     * @notice Get the advanced class for a character (only set at level 10+)
     */
    function getAdvancedClass(bytes32 characterId) public view returns (AdvancedClass) {
        return Stats.getAdvancedClass(characterId);
    }

    /**
     * @notice Select advanced class at level 10 (class crystallization)
     * @dev Players can choose ANY class regardless of stats or power source
     * @param characterId The character selecting their advanced class
     * @param advancedClass The chosen advanced class
     */
    function selectAdvancedClass(bytes32 characterId, AdvancedClass advancedClass) public onlyOwner(characterId) {
        PauseLib.requireNotPaused();

        // Read base stats (without equipment) from Characters table — NOT Stats table
        // which includes equipment bonuses and would contaminate baseStats permanently.
        StatsData memory stats = abi.decode(Characters.getBaseStats(characterId), (StatsData));
        stats.experience = Stats.getExperience(characterId);

        // Check requirements
        if (stats.level < 10) revert RequiresLevel10();
        if (stats.hasSelectedAdvancedClass) revert AdvancedClassAlreadySet();
        if (advancedClass == AdvancedClass.None) revert InvalidAdvancedClass();

        // Apply class-specific flat stat bonuses
        stats = _applyAdvancedClassStatBonuses(stats, advancedClass);

        // Mark as having selected advanced class
        stats.advancedClass = advancedClass;
        stats.hasSelectedAdvancedClass = true;

        // Save clean base stats (no equipment)
        Characters.setBaseStats(characterId, abi.encode(stats));

        // Set class fields on Stats table (setStats preserves these when recalculating combat fields)
        Stats.setAdvancedClass(characterId, advancedClass);
        Stats.setHasSelectedAdvancedClass(characterId, true);

        // Set class multipliers in separate table
        _setClassMultipliers(characterId, advancedClass);

        // Recalculate Stats table combat fields: base + equipment bonuses
        AdjustedCombatStats memory equipBonuses = IWorld(_world()).UD__calculateEquipmentBonuses(characterId);
        IWorld(_world()).UD__setStats(characterId, equipBonuses);

        // Issue class-specific items
        IWorld(_world()).UD__issueAdvancedClassItems(characterId, advancedClass);

        emit AdvancedClassSelected(characterId, advancedClass);
    }

    /**
     * @notice Apply flat stat bonuses when selecting an advanced class
     * @dev Only applies flat stat changes to StatsData
     */
    function _applyAdvancedClassStatBonuses(StatsData memory stats, AdvancedClass advancedClass)
        internal
        pure
        returns (StatsData memory)
    {
        if (advancedClass == AdvancedClass.Warrior) {
            stats.strength += 3;
            stats.maxHp += 10;
        } else if (advancedClass == AdvancedClass.Paladin) {
            stats.strength += 2;
            stats.maxHp += 15;
        } else if (advancedClass == AdvancedClass.Ranger) {
            stats.agility += 3;
        } else if (advancedClass == AdvancedClass.Rogue) {
            stats.agility += 2;
            stats.intelligence += 1;
        } else if (advancedClass == AdvancedClass.Druid) {
            stats.agility += 2;
            stats.strength += 2;
        } else if (advancedClass == AdvancedClass.Warlock) {
            stats.agility += 2;
            stats.intelligence += 2;
        } else if (advancedClass == AdvancedClass.Wizard) {
            stats.intelligence += 3;
        } else if (advancedClass == AdvancedClass.Cleric) {
            stats.intelligence += 2;
            stats.maxHp += 10;
        } else if (advancedClass == AdvancedClass.Sorcerer) {
            stats.strength += 2;
            stats.intelligence += 2;
        }

        return stats;
    }

    /**
     * @notice Set class multipliers in the ClassMultipliers table
     * @dev Multipliers are stored as basis points (1000 = 100%, 1100 = 110%, 1150 = 115%)
     *
     * Class Multipliers:
     * - Warrior:  +10% physical damage
     * - Paladin:  +5% physical damage, +5% healing received
     * - Ranger:   +10% physical damage
     * - Rogue:    +15% critical damage
     * - Druid:    +5% all damage, +5% max HP
     * - Warlock:  +10% spell damage
     * - Wizard:   +15% spell damage
     * - Cleric:   +10% healing done
     * - Sorcerer: +8% spell damage, +5% max HP
     */
    function _setClassMultipliers(bytes32 characterId, AdvancedClass advancedClass) internal {
        uint256 physical = CLASS_MULTIPLIER_BASE;
        uint256 spell = CLASS_MULTIPLIER_BASE;
        uint256 healing = CLASS_MULTIPLIER_BASE;
        uint256 crit = CLASS_MULTIPLIER_BASE;
        uint256 maxHp = CLASS_MULTIPLIER_BASE;

        if (advancedClass == AdvancedClass.Warrior) {
            physical = 1100; // 110%
        } else if (advancedClass == AdvancedClass.Paladin) {
            physical = 1050; // 105%
            healing = 1050; // 105%
        } else if (advancedClass == AdvancedClass.Ranger) {
            physical = 1100; // 110%
        } else if (advancedClass == AdvancedClass.Rogue) {
            crit = 1150; // 115%
        } else if (advancedClass == AdvancedClass.Druid) {
            physical = 1050; // 105%
            spell = 1050; // 105%
            maxHp = 1050; // 105%
        } else if (advancedClass == AdvancedClass.Warlock) {
            spell = 1200; // 120%
        } else if (advancedClass == AdvancedClass.Wizard) {
            spell = 1250; // 125%
        } else if (advancedClass == AdvancedClass.Cleric) {
            healing = 1100; // 110%
        } else if (advancedClass == AdvancedClass.Sorcerer) {
            spell = 1150; // 115%
            maxHp = 1050; // 105%
        }

        ClassMultipliers.set(characterId, physical, spell, healing, crit, maxHp);
    }

    /**
     * @notice Get all available advanced classes
     * @dev Returns array of all classes since any class can be selected
     */
    function getAvailableClasses() public pure returns (AdvancedClass[9] memory) {
        return [
            AdvancedClass.Warrior,
            AdvancedClass.Paladin,
            AdvancedClass.Ranger,
            AdvancedClass.Rogue,
            AdvancedClass.Druid,
            AdvancedClass.Warlock,
            AdvancedClass.Wizard,
            AdvancedClass.Cleric,
            AdvancedClass.Sorcerer
        ];
    }

    /**
     * @notice Get class multipliers for a character
     * @return physical Physical damage multiplier (basis points)
     * @return spell Spell damage multiplier (basis points)
     * @return healing Healing multiplier (basis points)
     * @return crit Critical damage multiplier (basis points)
     * @return maxHp Max HP multiplier (basis points)
     */
    function getClassMultipliers(bytes32 characterId)
        public
        view
        returns (uint256 physical, uint256 spell, uint256 healing, uint256 crit, uint256 maxHp)
    {
        return (
            ClassMultipliers.getPhysicalDamageMultiplier(characterId),
            ClassMultipliers.getSpellDamageMultiplier(characterId),
            ClassMultipliers.getHealingMultiplier(characterId),
            ClassMultipliers.getCritDamageMultiplier(characterId),
            ClassMultipliers.getMaxHpMultiplier(characterId)
        );
    }
}
