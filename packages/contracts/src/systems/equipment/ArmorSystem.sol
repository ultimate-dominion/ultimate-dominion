// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    CharacterEquipment,
    CharacterEquipmentData,
    ArmorStats,
    ArmorStatsData,
    Items,
    ItemsData,
    StatRestrictions,
    StatRestrictionsData,
    Stats,
    StatsData
} from "@codegen/index.sol";
import {ItemType, Classes} from "@codegen/common.sol";
import {IWorld} from "@world/IWorld.sol";
import {_requireAccess} from "../../utils.sol";

/**
 * @title ArmorSystem
 * @dev Handles armor equipment mechanics including equipping, unequipping, and calculating armor bonuses
 */
contract ArmorSystem is System {
    // Events
    event ArmorEquipped(bytes32 indexed characterId, uint256 armorId);
    event ArmorUnequipped(bytes32 indexed characterId, uint256 armorId);
    event ArmorBonusesCalculated(bytes32 indexed characterId, int256 armorBonus, int256 strBonus, int256 agiBonus, int256 intBonus, int256 hpBonus);

    // Errors
    error ArmorSystem_CharacterNotFound();
    error ArmorSystem_ItemNotFound();
    error ArmorSystem_NotArmor();
    error ArmorSystem_AlreadyEquipped();
    error ArmorSystem_NotEquipped();
    error ArmorSystem_RequirementsNotMet();
    error ArmorSystem_LevelTooLow();
    error ArmorSystem_NoArmorSlot();

    /**
     * @dev Equips armor to a character
     * @param characterId The character to equip armor to
     * @param armorId The armor item ID to equip
     */
    function UD__equipArmor(bytes32 characterId, uint256 armorId) public {
        // Validate character exists
        if (!IWorld(_world()).UD__isValidCharacterId(characterId)) {
            revert ArmorSystem_CharacterNotFound();
        }

        // Validate item exists and is armor
        ItemsData memory itemData = Items.get(armorId);
        if (itemData.price == 0 && itemData.dropChance == 0) {
            revert ArmorSystem_ItemNotFound();
        }
        if (itemData.itemType != ItemType.Armor) {
            revert ArmorSystem_NotArmor();
        }

        // Check if already equipped
        if (isArmorEquipped(characterId, armorId)) {
            revert ArmorSystem_AlreadyEquipped();
        }

        // Check requirements
        if (!checkArmorRequirements(characterId, armorId)) {
            revert ArmorSystem_RequirementsNotMet();
        }

        // Check if character already has armor equipped
        CharacterEquipmentData memory equipmentData = CharacterEquipment.get(characterId);
        if (equipmentData.equippedArmor.length > 0) {
            revert ArmorSystem_AlreadyEquipped();
        }

        // Equip the armor
        CharacterEquipment.pushEquippedArmor(characterId, armorId);

        // Recalculate equipment bonuses
        IWorld(_world()).UD__calculateEquipmentBonuses(characterId);

        emit ArmorEquipped(characterId, armorId);
    }

    /**
     * @dev Unequips armor from a character
     * @param characterId The character to unequip armor from
     * @param armorId The armor item ID to unequip
     */
    function UD__unequipArmor(bytes32 characterId, uint256 armorId) public returns (bool success) {
        // Validate character exists
        if (!IWorld(_world()).UD__isValidCharacterId(characterId)) {
            revert ArmorSystem_CharacterNotFound();
        }

        // Check if armor is equipped
        if (!isArmorEquipped(characterId, armorId)) {
            revert ArmorSystem_NotEquipped();
        }

        // Remove armor from equipment
        uint256[] memory equippedArmor = CharacterEquipment.getEquippedArmor(characterId);
        uint256[] memory newEquippedArmor = new uint256[](equippedArmor.length - 1);
        uint256 newIndex = 0;
        
        for (uint256 i = 0; i < equippedArmor.length; i++) {
            if (equippedArmor[i] != armorId) {
                newEquippedArmor[newIndex] = equippedArmor[i];
                newIndex++;
            }
        }

        CharacterEquipment.setEquippedArmor(characterId, newEquippedArmor);

        // Recalculate equipment bonuses
        IWorld(_world()).UD__calculateEquipmentBonuses(characterId);

        emit ArmorUnequipped(characterId, armorId);
        return true;
    }

    /**
     * @dev Calculates armor bonuses for a character
     * @param characterId The character to calculate bonuses for
     * @return armorBonus Total armor bonus
     * @return strBonus Total strength bonus
     * @return agiBonus Total agility bonus
     * @return intBonus Total intelligence bonus
     * @return hpBonus Total HP bonus
     */
    function UD__calculateArmorBonuses(bytes32 characterId) public view returns (
        int256 armorBonus,
        int256 strBonus,
        int256 agiBonus,
        int256 intBonus,
        int256 hpBonus
    ) {
        CharacterEquipmentData memory equipmentData = CharacterEquipment.get(characterId);
        
        for (uint256 i = 0; i < equipmentData.equippedArmor.length; i++) {
            uint256 armorId = equipmentData.equippedArmor[i];
            ArmorStatsData memory armorStats = ArmorStats.get(armorId);
            
            armorBonus += armorStats.armorModifier;
            strBonus += armorStats.strModifier;
            agiBonus += armorStats.agiModifier;
            intBonus += armorStats.intModifier;
            hpBonus += armorStats.hpModifier;
        }

        // Note: Events cannot be emitted in view functions
    }

    /**
     * @dev Checks if armor requirements are met for a character
     * @param characterId The character to check
     * @param armorId The armor item ID to check
     * @return canEquip True if requirements are met
     */
    function UD__checkArmorRequirements(bytes32 characterId, uint256 armorId) public view returns (bool canEquip) {
        // Get character stats
        StatsData memory characterStats = Stats.get(characterId);
        
        // Get armor requirements
        StatRestrictionsData memory requirements = StatRestrictions.get(armorId);
        ArmorStatsData memory armorStats = ArmorStats.get(armorId);
        
        // Check level requirement
        if (characterStats.level < armorStats.minLevel) {
            return false;
        }
        
        // Check stat requirements
        if (characterStats.strength < requirements.minStrength) {
            return false;
        }
        if (characterStats.agility < requirements.minAgility) {
            return false;
        }
        if (characterStats.intelligence < requirements.minIntelligence) {
            return false;
        }
        
        return true;
    }

    /**
     * @dev Gets equipped armor for a character
     * @param characterId The character to get armor for
     * @return equippedArmor Array of equipped armor IDs
     */
    function UD__getEquippedArmor(bytes32 characterId) public view returns (uint256[] memory equippedArmor) {
        return CharacterEquipment.getEquippedArmor(characterId);
    }

    /**
     * @dev Gets armor stats for a specific armor item
     * @param armorId The armor item ID
     * @return armorStats The armor stats data
     */
    function UD__getArmorStats(uint256 armorId) public view returns (ArmorStatsData memory armorStats) {
        return ArmorStats.get(armorId);
    }

    /**
     * @dev Checks if a specific armor is equipped by a character
     * @param characterId The character to check
     * @param armorId The armor item ID to check
     * @return isEquipped True if armor is equipped
     */
    function UD__isArmorEquipped(bytes32 characterId, uint256 armorId) public view returns (bool isEquipped) {
        return isArmorEquipped(characterId, armorId);
    }

    /**
     * @dev Internal function to check if armor is equipped
     * @param characterId The character to check
     * @param armorId The armor item ID to check
     * @return isEquipped True if armor is equipped
     */
    function isArmorEquipped(bytes32 characterId, uint256 armorId) internal view returns (bool isEquipped) {
        uint256[] memory equippedArmor = CharacterEquipment.getEquippedArmor(characterId);
        for (uint256 i = 0; i < equippedArmor.length; i++) {
            if (equippedArmor[i] == armorId) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Internal function to check armor requirements
     * @param characterId The character to check
     * @param armorId The armor item ID to check
     * @return canEquip True if requirements are met
     */
    function checkArmorRequirements(bytes32 characterId, uint256 armorId) internal view returns (bool canEquip) {
        return UD__checkArmorRequirements(characterId, armorId);
    }
}
