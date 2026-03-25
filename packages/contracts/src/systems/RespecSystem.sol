// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Characters,
    Stats,
    StatsData,
    ClassMultipliers,
    CharacterEquipment,
    Admin
} from "@codegen/index.sol";
import {AdvancedClass} from "@codegen/common.sol";
import {StatCalculator} from "@libraries/StatCalculator.sol";
import {GoldLib} from "../libraries/GoldLib.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {
    CannotRespecInCombat,
    InvalidRespecStats,
    InsufficientGoldForRespec
} from "../Errors.sol";
import {
    STAT_RESPEC_BASE_COST,
    FULL_RESPEC_MULTIPLIER,
    RESPEC_COST_PER_LEVEL
} from "../../constants.sol";

/**
 * @title RespecSystem
 * @notice Allows players to redistribute stat points (stat respec) or fully
 *         reset their character including class (full respec).
 */
contract RespecSystem is System {

    event StatRespec(bytes32 indexed characterId, uint256 goldCost);
    event FullRespec(bytes32 indexed characterId, uint256 goldCost);

    /**
     * @notice Redistribute stat points while keeping class and level.
     * @param characterId The character to respec
     * @param desiredStats The desired stat distribution
     */
    function statRespec(bytes32 characterId, StatsData memory desiredStats) public {
        PauseLib.requireNotPaused();
        address owner = Characters.getOwner(characterId);
        require(owner == _msgSender(), "Not character owner");
        if (IWorld(_world()).UD__isInEncounter(characterId)) revert CannotRespecInCombat();

        StatsData memory currentStats = Stats.get(characterId);
        StatsData memory originalStats = abi.decode(Characters.getOriginalStats(characterId), (StatsData));

        // Calculate total earned stat points
        int256 earnedPoints = StatCalculator.calculateTotalStatPoints(currentStats.level);

        // Validate: desired stats must equal original base + earned points
        int256 desiredTotal = desiredStats.strength + desiredStats.agility + desiredStats.intelligence;
        int256 originalTotal = originalStats.strength + originalStats.agility + originalStats.intelligence;
        if (desiredTotal != originalTotal + earnedPoints) revert InvalidRespecStats();

        // All stats must be >= 0
        if (desiredStats.strength < 0 || desiredStats.agility < 0 || desiredStats.intelligence < 0) {
            revert InvalidRespecStats();
        }

        // Calculate and burn gold
        uint256 cost = _getStatRespecCost(currentStats.level);
        GoldLib.goldBurn(_world(), owner, cost);

        // Apply new stats, preserving everything else
        currentStats.strength = desiredStats.strength;
        currentStats.agility = desiredStats.agility;
        currentStats.intelligence = desiredStats.intelligence;

        // Sync both tables
        Characters.setBaseStats(characterId, abi.encode(currentStats));
        Stats.set(characterId, currentStats);

        // Recalculate equipment bonuses
        AdjustedCombatStats memory bonuses = IWorld(_world()).UD__calculateEquipmentBonuses(characterId);
        IWorld(_world()).UD__setStats(characterId, bonuses);

        emit StatRespec(characterId, cost);
    }

    /**
     * @notice Full reset: return to originalStats, clear advanced class, keep XP.
     *         Character will need to re-level from 1.
     * @param characterId The character to fully respec
     */
    function fullRespec(bytes32 characterId) public {
        PauseLib.requireNotPaused();
        address owner = Characters.getOwner(characterId);
        require(owner == _msgSender(), "Not character owner");
        if (IWorld(_world()).UD__isInEncounter(characterId)) revert CannotRespecInCombat();

        StatsData memory currentStats = Stats.get(characterId);
        StatsData memory originalStats = abi.decode(Characters.getOriginalStats(characterId), (StatsData));

        // Calculate and burn gold (10x stat respec cost)
        uint256 cost = _getStatRespecCost(currentStats.level) * FULL_RESPEC_MULTIPLIER;
        GoldLib.goldBurn(_world(), owner, cost);

        // Build reset stats: original base values, level 1, keep XP
        StatsData memory newStats = StatsData({
            strength: originalStats.strength,
            agility: originalStats.agility,
            intelligence: originalStats.intelligence,
            class: currentStats.class,
            maxHp: originalStats.maxHp,
            currentHp: originalStats.maxHp,
            level: 1,
            experience: currentStats.experience,
            powerSource: currentStats.powerSource,
            race: currentStats.race,
            startingArmor: currentStats.startingArmor,
            advancedClass: AdvancedClass.None,
            hasSelectedAdvancedClass: false
        });

        // Write to both tables
        Characters.setBaseStats(characterId, abi.encode(newStats));
        Stats.set(characterId, newStats);

        // Clear class multipliers
        ClassMultipliers.set(characterId, 0, 0, 0, 0, 0);

        // Clear all equipment (stat requirements may no longer be met)
        uint256[] memory empty = new uint256[](0);
        CharacterEquipment.setEquippedWeapons(characterId, empty);
        CharacterEquipment.setEquippedSpells(characterId, empty);
        CharacterEquipment.setEquippedArmor(characterId, empty);
        CharacterEquipment.setEquippedConsumables(characterId, empty);
        CharacterEquipment.setEquippedAccessories(characterId, empty);
        // Reset equipment stat bonuses to zero
        CharacterEquipment.setStrBonus(characterId, 0);
        CharacterEquipment.setAgiBonus(characterId, 0);
        CharacterEquipment.setIntBonus(characterId, 0);
        CharacterEquipment.setHpBonus(characterId, 0);
        CharacterEquipment.setArmor(characterId, 0);

        emit FullRespec(characterId, cost);
    }

    /**
     * @notice View: get respec costs for a character.
     */
    function getRespecCost(bytes32 characterId) public view returns (uint256 statCost, uint256 fullCost) {
        uint256 level = Stats.getLevel(characterId);
        statCost = _getStatRespecCost(level);
        fullCost = statCost * FULL_RESPEC_MULTIPLIER;
    }

    function _getStatRespecCost(uint256 level) internal pure returns (uint256) {
        return STAT_RESPEC_BASE_COST + (level * RESPEC_COST_PER_LEVEL);
    }
}
