// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    Stats,
    StatsData,
    Characters,
    Items,
    WeaponStats,
    WeaponStatsData,
    ArmorStats,
    ArmorStatsData,
    StatRestrictions,
    StatRestrictionsData
} from "@codegen/index.sol";
import { ItemType } from "@codegen/common.sol";
import {EquipmentUtils} from "@libraries/EquipmentUtils.sol";

/**
 * @title EquipmentCore
 * @notice Core equipment helpers: validation, ownership lookups, basic state helpers
 */
contract EquipmentCore is System {
    using EquipmentUtils for StatsData;

    /**
     * @notice Validate if a character meets requirements and min level for an item
     */
    function validateEquipment(bytes32 characterId, uint256 itemId) public view returns (bool) {
        StatsData memory stats = Stats.get(characterId);
        StatRestrictionsData memory restrictions = StatRestrictions.get(itemId);

        if (!EquipmentUtils.validateEquipmentRequirements(
                stats,
                restrictions.minStrength,
                restrictions.minAgility,
                restrictions.minIntelligence
            )) {
            return false;
        }

        ItemType itemType = Items.getItemType(itemId);
        if (itemType == ItemType.Weapon) {
            WeaponStatsData memory ws = WeaponStats.get(itemId);
            return EquipmentUtils.validateEquipmentCompatibility(stats.level, ws.minLevel);
        } else if (itemType == ItemType.Armor) {
            ArmorStatsData memory asd = ArmorStats.get(itemId);
            return EquipmentUtils.validateEquipmentCompatibility(stats.level, asd.minLevel);
        }
        // For other types, defer validation to their respective systems
        return true;
    }

    /**
     * @notice Get the owner of a character (renamed to avoid world interface collisions)
     */
    function getCharacterOwner(bytes32 characterId) public view returns (address) {
        return Characters.getOwner(characterId);
    }
}


