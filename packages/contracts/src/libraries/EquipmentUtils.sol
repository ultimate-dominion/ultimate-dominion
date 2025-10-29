// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {StatsData, WeaponStatsData, ArmorStatsData} from "@codegen/index.sol";

/**
 * @title EquipmentUtils
 * @notice Shared equipment validation and utility helpers extracted from EquipmentSystem
 */
library EquipmentUtils {
    /**
     * @notice Validate that a character meets stat requirements for an item
     */
    function validateEquipmentRequirements(
        StatsData memory stats,
        int256 minStrength,
        int256 minAgility,
        int256 minIntelligence
    ) internal pure returns (bool) {
        if (stats.strength < minStrength) return false;
        if (stats.agility < minAgility) return false;
        if (stats.intelligence < minIntelligence) return false;
        return true;
    }

    /**
     * @notice Calculate additive bonuses from weapon and armor to base stats
     */
    function calculateEquipmentBonuses(
        StatsData memory base,
        WeaponStatsData memory weapon,
        ArmorStatsData memory armor
    ) internal pure returns (StatsData memory out) {
        out = base;
        out.strength += weapon.strModifier + armor.strModifier;
        out.agility += weapon.agiModifier + armor.agiModifier;
        out.intelligence += weapon.intModifier + armor.intModifier;
        out.maxHp += armor.hpModifier;
    }

    /**
     * @notice Validate compatibility (e.g., level gate via minLevel)
     */
    function validateEquipmentCompatibility(uint256 characterLevel, uint256 minLevel) internal pure returns (bool) {
        return characterLevel >= minLevel;
    }

    /**
     * @notice Simple durability calculation placeholder
     */
    function calculateDurability(uint256 current, uint256 usage) internal pure returns (uint256) {
        if (usage >= current) return 0;
        return current - usage;
    }
}


