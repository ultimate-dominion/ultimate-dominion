// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import { Items, Stats, StatsData, ConsumableStats, ConsumableStatsData, StatRestrictions, StatRestrictionsData } from "@codegen/index.sol";
import { ItemType } from "@codegen/common.sol";
import {EquipmentUtils} from "@libraries/EquipmentUtils.sol";

/**
 * @title ConsumableSystem
 * @notice Validates consumable usage and provides simple helpers; effect application is handled elsewhere
 */
contract ConsumableSystem is System {
    using EquipmentUtils for StatsData;

    /**
     * @notice Validate whether a character can use a consumable item
     */
    function validateConsumable(bytes32 characterId, uint256 itemId) public view returns (bool) {
        require(Items.getItemType(itemId) == ItemType.Consumable, "CONSUMABLE: Not a consumable");
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

        ConsumableStatsData memory cs = ConsumableStats.get(itemId);
        return EquipmentUtils.validateEquipmentCompatibility(stats.level, cs.minLevel);
    }

    /**
     * @notice Example usage hook; returns whether the item would heal or damage
     * @dev Effect application and inventory mutations are out of scope here
     */
    function previewConsumableEffect(uint256 itemId) public view returns (bool isHealing, int256 magnitude) {
        ConsumableStatsData memory cs = ConsumableStats.get(itemId);
        // Negative damage implies healing in our calculations
        isHealing = cs.maxDamage < 0 || cs.minDamage < 0;
        magnitude = cs.maxDamage;
    }
}


