// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    CharacterItemDurability,
    ItemDurability,
    CharacterEquipment,
    Items,
    Characters,
    Admin
} from "@codegen/index.sol";
import {ItemType} from "@codegen/common.sol";
import {_requireSystemOrAdmin} from "../utils.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import {GoldLib} from "../libraries/GoldLib.sol";
import {
    ItemBroken,
    ItemNotDamageable,
    ItemAlreadyFullDurability,
    NotAtRepairShop,
    NotAdmin,
    InsufficientBalance
} from "../Errors.sol";
import {
    DURABILITY_LOSS_PER_COMBAT,
    REPAIR_COST_R0,
    REPAIR_COST_R1,
    REPAIR_COST_R2,
    REPAIR_COST_R3,
    REPAIR_COST_R4
} from "../../constants.sol";

/**
 * @title DurabilitySystem
 * @notice Manages item durability: degradation in combat, repair at shops.
 *         Z2+ items have maxDurability > 0. Z1 items (maxDurability=0) are exempt.
 */
contract DurabilitySystem is System {
    /**
     * @notice Degrade all equipped items for a character after combat.
     *         Items with maxDurability=0 (Z1 items) are skipped.
     *         Items that hit 0 durability are NOT auto-unequipped here
     *         (they'll fail the equip check next time).
     */
    function degradeEquippedItems(bytes32 characterId) public {
        _requireSystemOrAdmin(_msgSender());

        // Degrade equipped weapons
        uint256 wc = CharacterEquipment.lengthEquippedWeapons(characterId);
        for (uint256 i; i < wc; i++) {
            _degradeItem(characterId, CharacterEquipment.getItemEquippedWeapons(characterId, i));
        }

        // Degrade equipped spells
        uint256 sc = CharacterEquipment.lengthEquippedSpells(characterId);
        for (uint256 i; i < sc; i++) {
            _degradeItem(characterId, CharacterEquipment.getItemEquippedSpells(characterId, i));
        }

        // Degrade equipped armor
        uint256 ac = CharacterEquipment.lengthEquippedArmor(characterId);
        for (uint256 i; i < ac; i++) {
            _degradeItem(characterId, CharacterEquipment.getItemEquippedArmor(characterId, i));
        }
    }

    /**
     * @notice Repair an item to full durability. Burns gold based on rarity.
     */
    function repairItem(bytes32 characterId, uint256 itemId) public {
        PauseLib.requireNotPaused();
        address owner = Characters.getOwner(characterId);
        require(owner == _msgSender(), "Not character owner");

        uint256 maxDur = ItemDurability.getMaxDurability(itemId);
        if (maxDur == 0) revert ItemNotDamageable();

        uint256 currentDur = CharacterItemDurability.getCurrentDurability(characterId, itemId);
        if (currentDur >= maxDur) revert ItemAlreadyFullDurability();

        uint256 pointsToRepair = maxDur - currentDur;
        uint256 costPerPoint = _getRepairCostPerPoint(itemId);
        uint256 totalCost = pointsToRepair * costPerPoint;

        GoldLib.goldBurn(_world(), owner, totalCost);
        CharacterItemDurability.setCurrentDurability(characterId, itemId, maxDur);
    }

    /**
     * @notice Check if an item can be equipped (durability > 0, or not damageable).
     */
    function canEquipDurability(bytes32 characterId, uint256 itemId) public view returns (bool) {
        uint256 maxDur = ItemDurability.getMaxDurability(itemId);
        if (maxDur == 0) return true; // Z1 item, no durability tracking
        return CharacterItemDurability.getCurrentDurability(characterId, itemId) > 0;
    }

    /**
     * @notice Initialize durability for a newly acquired item.
     *         Only sets if maxDurability > 0 and character doesn't already have durability tracked.
     */
    function initializeDurability(bytes32 characterId, uint256 itemId) public {
        _requireSystemOrAdmin(_msgSender());
        uint256 maxDur = ItemDurability.getMaxDurability(itemId);
        if (maxDur == 0) return; // Z1 item, skip

        uint256 currentDur = CharacterItemDurability.getCurrentDurability(characterId, itemId);
        if (currentDur == 0) {
            CharacterItemDurability.setCurrentDurability(characterId, itemId, maxDur);
        }
    }

    /**
     * @notice Admin: set max durability for an item type.
     */
    function setMaxDurability(uint256 itemId, uint256 maxDurability) public {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        ItemDurability.set(itemId, maxDurability, maxDurability);
    }

    // ========== Internal ==========

    function _degradeItem(bytes32 characterId, uint256 itemId) internal {
        uint256 maxDur = ItemDurability.getMaxDurability(itemId);
        if (maxDur == 0) return; // Z1 item, exempt

        uint256 currentDur = CharacterItemDurability.getCurrentDurability(characterId, itemId);
        if (currentDur == 0) return; // Already broken

        uint256 newDur = currentDur > DURABILITY_LOSS_PER_COMBAT
            ? currentDur - DURABILITY_LOSS_PER_COMBAT
            : 0;
        CharacterItemDurability.setCurrentDurability(characterId, itemId, newDur);
    }

    function _getRepairCostPerPoint(uint256 itemId) internal view returns (uint256) {
        uint256 rarity = Items.getRarity(itemId);
        if (rarity == 0) return REPAIR_COST_R0;
        if (rarity == 1) return REPAIR_COST_R1;
        if (rarity == 2) return REPAIR_COST_R2;
        if (rarity == 3) return REPAIR_COST_R3;
        return REPAIR_COST_R4; // R4+
    }
}
