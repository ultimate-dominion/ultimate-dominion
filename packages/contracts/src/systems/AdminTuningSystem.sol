// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    Admin,
    WeaponScaling,
    ClassMultipliers,
    Items,
    ItemsData,
    ArmorStats,
    ArmorStatsData,
    WeaponStats,
    WeaponStatsData,
    StatRestrictions,
    StatRestrictionsData,
    ConsumableStats,
    ConsumableStatsData
} from "@codegen/index.sol";
import {ItemType} from "@codegen/common.sol";
import {NotAdmin} from "../Errors.sol";

error ItemNotFound();

/**
 * @title AdminTuningSystem
 * @notice Admin functions for combat tuning (split from AdminSystem for contract size)
 */
contract AdminTuningSystem is System {
    modifier onlyAdmin() {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        _;
    }

    function adminSetWeaponScaling(uint256 itemId, bool usesAgi) public onlyAdmin {
        WeaponScaling.set(itemId, usesAgi);
    }

    function adminSetClassMultipliers(
        bytes32 characterId, uint256 physical, uint256 spell,
        uint256 healing, uint256 critDmg, uint256 maxHp
    ) public onlyAdmin {
        ClassMultipliers.set(characterId, physical, spell, healing, critDmg, maxHp);
    }

    /// @notice Update stats for an existing item without changing supply or counter
    /// @param itemId The ID of the item to update
    /// @param dropChance New drop chance value
    /// @param price New price value
    /// @param rarity New rarity value
    /// @param stats ABI-encoded stats blob (type-specific struct + StatRestrictionsData)
    function adminUpdateItemStats(
        uint256 itemId,
        uint256 dropChance,
        uint256 price,
        uint256 rarity,
        bytes memory stats
    ) public onlyAdmin {
        ItemsData memory existing = Items.get(itemId);
        ItemType itemType = existing.itemType;

        // Verify item exists (uninitialized items have empty stats blob)
        if (existing.stats.length == 0) revert ItemNotFound();

        StatRestrictionsData memory statRestrictions;
        if (itemType == ItemType.Weapon) {
            WeaponStatsData memory weaponStats;
            (weaponStats, statRestrictions) = abi.decode(stats, (WeaponStatsData, StatRestrictionsData));
            WeaponStats.set(itemId, weaponStats);
            StatRestrictions.set(itemId, statRestrictions);
        } else if (itemType == ItemType.Armor) {
            ArmorStatsData memory armorStats;
            (armorStats, statRestrictions) = abi.decode(stats, (ArmorStatsData, StatRestrictionsData));
            ArmorStats.set(itemId, armorStats);
            StatRestrictions.set(itemId, statRestrictions);
        } else if (itemType == ItemType.Consumable) {
            ConsumableStatsData memory consumableStats;
            (consumableStats, statRestrictions) = abi.decode(stats, (ConsumableStatsData, StatRestrictionsData));
            ConsumableStats.set(itemId, consumableStats);
            StatRestrictions.set(itemId, statRestrictions);
        }

        Items.set(itemId, ItemsData({
            itemType: itemType,
            dropChance: dropChance,
            price: price,
            rarity: rarity,
            stats: stats
        }));
    }
}
