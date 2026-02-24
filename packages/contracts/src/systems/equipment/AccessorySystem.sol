// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    CharacterEquipment,
    CharacterEquipmentData,
    Items,
    ItemsData,
    AccessoryStats,
    AccessoryStatsData,
    StatRestrictions,
    StatRestrictionsData,
    Stats,
    StatsData,
    Levels
} from "@codegen/index.sol";
import {ItemType} from "@codegen/common.sol";
import {IWorld} from "@world/IWorld.sol";
import {_requireAccess} from "../../utils.sol";

/**
 * @title AccessorySystem
 * @dev Handles accessory equipment mechanics including equipping, unequipping, and calculating bonuses
 */
contract AccessorySystem is System {
    // Events
    event AccessoryEquipped(bytes32 indexed characterId, uint256 accessoryId);
    event AccessoryUnequipped(bytes32 indexed characterId, uint256 accessoryId);
    event AccessoryBonusesCalculated(
        bytes32 indexed characterId,
        int256 armorBonus,
        int256 strBonus,
        int256 agiBonus,
        int256 intBonus,
        int256 hpBonus
    );

    // Errors
    error AccessorySystem_CharacterNotFound();
    error AccessorySystem_ItemNotFound();
    error AccessorySystem_NotAccessory();
    error AccessorySystem_AlreadyEquipped();
    error AccessorySystem_NotEquipped();
    error AccessorySystem_RequirementsNotMet();
    error AccessorySystem_LevelTooLow();

    /**
     * @dev Checks if a specific accessory item is equipped by a character
     * @param characterId The character ID
     * @param accessoryId The ID of the accessory item
     * @return isEquipped True if the accessory is equipped, false otherwise
     */
    function isAccessoryEquipped(bytes32 characterId, uint256 accessoryId) internal view returns (bool isEquipped) {
        uint256[] memory equippedAccessories = CharacterEquipment.getEquippedAccessories(characterId);
        for (uint256 i = 0; i < equippedAccessories.length; i++) {
            if (equippedAccessories[i] == accessoryId) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Equips an accessory item to a character
     * @param characterId The character to equip the accessory to
     * @param accessoryId The ID of the accessory item to equip
     */
    function UD__equipAccessory(bytes32 characterId, uint256 accessoryId) public {
        _requireAccess(address(this), _msgSender());

        // Validate character exists
        if (!IWorld(_world()).UD__isValidCharacterId(characterId)) {
            revert AccessorySystem_CharacterNotFound();
        }

        // Validate item exists and is accessory
        ItemsData memory itemData = Items.get(accessoryId);
        // Item exists if itemType is Accessory
        if (itemData.itemType != ItemType.Accessory) {
            revert AccessorySystem_NotAccessory();
        }

        // Check if already equipped
        if (isAccessoryEquipped(characterId, accessoryId)) {
            revert AccessorySystem_AlreadyEquipped();
        }

        // Check requirements
        if (!UD__checkAccessoryRequirements(characterId, accessoryId)) {
            revert AccessorySystem_RequirementsNotMet();
        }

        // Equip accessory
        CharacterEquipment.pushEquippedAccessories(characterId, accessoryId);
        emit AccessoryEquipped(characterId, accessoryId);
    }

    /**
     * @dev Unequips an accessory item from a character
     * @param characterId The character to unequip the accessory from
     * @param accessoryId The ID of the accessory item to unequip
     */
    function UD__unequipAccessory(bytes32 characterId, uint256 accessoryId) public {
        _requireAccess(address(this), _msgSender());

        // Validate character exists
        if (!IWorld(_world()).UD__isValidCharacterId(characterId)) {
            revert AccessorySystem_CharacterNotFound();
        }

        // Check if equipped
        if (!isAccessoryEquipped(characterId, accessoryId)) {
            revert AccessorySystem_NotEquipped();
        }

        // Unequip accessory
        uint256[] memory equippedAccessories = CharacterEquipment.getEquippedAccessories(characterId);
        for (uint256 i = 0; i < equippedAccessories.length; i++) {
            if (equippedAccessories[i] == accessoryId) {
                // Remove by swapping with last element and popping
                equippedAccessories[i] = equippedAccessories[equippedAccessories.length - 1];
                CharacterEquipment.setEquippedAccessories(characterId, equippedAccessories);
                CharacterEquipment.popEquippedAccessories(characterId);
                break;
            }
        }
        emit AccessoryUnequipped(characterId, accessoryId);
    }

    /**
     * @dev Calculates the total stat bonuses from equipped accessories for a character
     * @param characterId The character ID
     * @return armorBonus The total armor bonus
     * @return strBonus The total strength bonus
     * @return agiBonus The total agility bonus
     * @return intBonus The total intelligence bonus
     * @return hpBonus The total HP bonus
     */
    function UD__calculateAccessoryBonuses(bytes32 characterId)
        public
        view
        returns (
            int256 armorBonus,
            int256 strBonus,
            int256 agiBonus,
            int256 intBonus,
            int256 hpBonus
        )
    {
        uint256[] memory equippedAccessories = CharacterEquipment.getEquippedAccessories(characterId);
        for (uint256 i = 0; i < equippedAccessories.length; i++) {
            AccessoryStatsData memory accessoryStats = AccessoryStats.get(equippedAccessories[i]);
            armorBonus += accessoryStats.armorModifier;
            strBonus += accessoryStats.strModifier;
            agiBonus += accessoryStats.agiModifier;
            intBonus += accessoryStats.intModifier;
            hpBonus += accessoryStats.hpModifier;
        }

        // Note: Events cannot be emitted in view functions
    }

    /**
     * @dev Checks if accessory requirements are met for a character
     * @param characterId The character to check
     * @param accessoryId The ID of the accessory item
     * @return canEquip True if requirements are met, false otherwise
     */
    function UD__checkAccessoryRequirements(bytes32 characterId, uint256 accessoryId)
        public
        view
        returns (bool canEquip)
    {
        StatsData memory characterStats = Stats.get(characterId);
        AccessoryStatsData memory accessoryStats = AccessoryStats.get(accessoryId);
        StatRestrictionsData memory statRestrictions = StatRestrictions.get(accessoryId);

        // Check level requirement
        if (characterStats.level < accessoryStats.minLevel) {
            return false;
        }

        // Check stat requirements
        if (characterStats.strength < statRestrictions.minStrength) {
            return false;
        }
        if (characterStats.agility < statRestrictions.minAgility) {
            return false;
        }
        if (characterStats.intelligence < statRestrictions.minIntelligence) {
            return false;
        }

        return true;
    }

    /**
     * @dev Gets the equipped accessories for a character
     * @param characterId The character ID
     * @return equippedAccessories The array of equipped accessory item IDs
     */
    function UD__getEquippedAccessories(bytes32 characterId) public view returns (uint256[] memory equippedAccessories) {
        return CharacterEquipment.getEquippedAccessories(characterId);
    }

    /**
     * @dev Gets the stats for a specific accessory item
     * @param accessoryId The ID of the accessory item
     * @return accessoryStats The stats of the accessory item
     */
    function UD__getAccessoryStats(uint256 accessoryId) public view returns (AccessoryStatsData memory accessoryStats) {
        return AccessoryStats.get(accessoryId);
    }

    /**
     * @dev Checks if a specific accessory item is equipped by a character (public interface)
     * @param characterId The character ID
     * @param accessoryId The ID of the accessory item
     * @return isEquipped True if the accessory is equipped, false otherwise
     */
    function UD__isAccessoryEquipped(bytes32 characterId, uint256 accessoryId) public view returns (bool isEquipped) {
        return isAccessoryEquipped(characterId, accessoryId);
    }
}
