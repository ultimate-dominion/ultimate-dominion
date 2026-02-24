// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    WeaponStats,
    WeaponStatsData,
    CharacterEquipment,
    CharacterEquipmentData,
    StatRestrictions,
    StatRestrictionsData,
    Items,
    ItemsData,
    Characters,
    CharactersData,
    Stats,
    StatsData
} from "@codegen/index.sol";
import {ItemType} from "@codegen/common.sol";
import {IWorld} from "@world/IWorld.sol";
import {StatCalculator} from "@libraries/StatCalculator.sol";
import {UserDelegationControl} from "@latticexyz/world/src/codegen/tables/UserDelegationControl.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";

contract WeaponSystem is System {
    modifier inGame(bytes32 characterId) {
        CharactersData memory charData = Characters.get(characterId);
        require(charData.locked, "Character not in the Game");
        _;
    }

    modifier onlyCharacterOwner(bytes32 characterId) {
        address characterOwner = IWorld(_world()).UD__getOwner(characterId);
        address caller = _msgSender();
        // Check direct ownership or delegation
        bool isOwner = characterOwner == caller;
        bool hasDelegation = ResourceId.unwrap(UserDelegationControl.getDelegationControlId(characterOwner, caller)) != bytes32(0);
        require(isOwner || hasDelegation, "WEAPON: Not Character Owner");
        _;
    }

    modifier notInCombat(bytes32 characterId) {
        require(!IWorld(_world()).UD__isInEncounter(characterId), "Cannot equip weapons in combat");
        _;
    }

    /**
     * @dev Equips a weapon to a character
     * @param characterId The character ID
     * @param weaponId The weapon item ID
     */
    function equipWeapon(bytes32 characterId, uint256 weaponId)
        public
        inGame(characterId)
        notInCombat(characterId)
    {
        // Note: Ownership/delegation is validated by EquipmentSystem before calling this
        // Check item ownership - items are owned by the character owner (delegator)
        address characterOwner = IWorld(_world()).UD__getOwner(characterId);
        require(IWorld(_world()).UD__isItemOwner(weaponId, characterOwner), "WEAPON: Not Item Owner");
        require(Items.getItemType(weaponId) == ItemType.Weapon, "WEAPON: Not a weapon");
        require(checkWeaponRequirements(characterId, weaponId), "WEAPON: Requirements not met");
        require(!isWeaponEquipped(characterId, weaponId), "WEAPON: Already equipped");
        require(canEquipMoreWeapons(characterId), "WEAPON: Too many weapons equipped");

        CharacterEquipment.pushEquippedWeapons(characterId, weaponId);
        
        // Update equipment bonuses
        _updateWeaponBonuses(characterId);
        // Note: setStats expects AdjustedCombatStats, but calculateWeaponBonuses returns CharacterEquipmentData
        // This will be handled by the main EquipmentSystem coordination
        IWorld(_world()).UD__applyWorldEffects(characterId);
    }

    /**
     * @dev Unequips a weapon from a character
     * @param characterId The character ID
     * @param weaponId The weapon item ID
     */
    function unequipWeapon(bytes32 characterId, uint256 weaponId)
        public
        inGame(characterId)
        notInCombat(characterId)
        returns (bool success) 
    {
        require(isWeaponEquipped(characterId, weaponId), "WEAPON: Not equipped");

        uint256[] memory sortedArray = _swapToEndOfArray(weaponId, CharacterEquipment.getEquippedWeapons(characterId));
        if (sortedArray[sortedArray.length - 1] == weaponId) {
            CharacterEquipment.setEquippedWeapons(characterId, sortedArray);
            CharacterEquipment.popEquippedWeapons(characterId);
            success = true;
        }

        if (success) {
            _updateWeaponBonuses(characterId);
            // Note: setStats expects AdjustedCombatStats, but calculateWeaponBonuses returns CharacterEquipmentData
        // This will be handled by the main EquipmentSystem coordination
            IWorld(_world()).UD__applyWorldEffects(characterId);
        }
    }

    /**
     * @dev Checks if a character can equip a weapon based on requirements
     * @param characterId The character ID
     * @param weaponId The weapon item ID
     * @return canUse True if the character meets all requirements
     */
    function checkWeaponRequirements(bytes32 characterId, uint256 weaponId) public view returns (bool canUse) {
        ItemsData memory itemData = Items.get(weaponId);
        require(itemData.itemType == ItemType.Weapon, "WEAPON: Not a weapon");
        
        StatsData memory character = abi.decode(Characters.getBaseStats(characterId), (StatsData));
        StatRestrictionsData memory statRestrictions = StatRestrictions.get(weaponId);
        WeaponStatsData memory weaponStats = WeaponStats.get(weaponId);

        bool isLevel = character.level >= weaponStats.minLevel;
        bool hasStats = true;
        
        if (statRestrictions.minAgility > character.agility) hasStats = false;
        if (statRestrictions.minStrength > character.strength) hasStats = false;
        if (statRestrictions.minIntelligence > character.intelligence) hasStats = false;

        canUse = isLevel && hasStats;
    }

    /**
     * @dev Checks if a weapon is currently equipped by a character
     * @param characterId The character ID
     * @param weaponId The weapon item ID
     * @return equipped True if the weapon is equipped
     */
    function isWeaponEquipped(bytes32 characterId, uint256 weaponId) public view returns (bool equipped) {
        uint256[] memory equippedWeapons = CharacterEquipment.getEquippedWeapons(characterId);
        for (uint256 i = 0; i < equippedWeapons.length; i++) {
            if (equippedWeapons[i] == weaponId) {
                equipped = true;
                break;
            }
        }
    }

    /**
     * @dev Checks if a character can equip more weapons
     * @param characterId The character ID
     * @return canEquip True if the character can equip more weapons
     */
    function canEquipMoreWeapons(bytes32 characterId) public view returns (bool canEquip) {
        uint256 totalEquipped = CharacterEquipment.lengthEquippedWeapons(characterId) +
                               CharacterEquipment.lengthEquippedSpells(characterId) +
                               CharacterEquipment.lengthEquippedConsumables(characterId);
        canEquip = totalEquipped < 4;
    }

    /**
     * @dev Gets all equipped weapons for a character
     * @param characterId The character ID
     * @return weapons Array of equipped weapon IDs
     */
    function getEquippedWeapons(bytes32 characterId) public view returns (uint256[] memory weapons) {
        weapons = CharacterEquipment.getEquippedWeapons(characterId);
    }

    /**
     * @dev Gets weapon stats for a specific weapon
     * @param weaponId The weapon item ID
     * @return weaponStats The weapon statistics
     */
    function getWeaponStatsData(uint256 weaponId) public view returns (WeaponStatsData memory weaponStats) {
        require(Items.getItemType(weaponId) == ItemType.Weapon, "WEAPON: Not a weapon");
        weaponStats = WeaponStats.get(weaponId);
    }

    /**
     * @dev Checks if a weapon has a specific effect
     * @param weaponId The weapon item ID
     * @param effectId The effect ID to check
     * @return hasEffect True if the weapon has the effect
     */
    function checkWeaponEffect(uint256 weaponId, bytes32 effectId) public view returns (bool hasEffect) {
        require(Items.getItemType(weaponId) == ItemType.Weapon, "WEAPON: Not a weapon");
        bytes32[] memory effects = WeaponStats.getEffects(weaponId);
        for (uint256 i = 0; i < effects.length; i++) {
            if (effectId == effects[i]) {
                hasEffect = true;
                break;
            }
        }
    }

    /**
     * @dev Gets all effects for a weapon
     * @param weaponId The weapon item ID
     * @return effects Array of effect IDs
     */
    function getWeaponEffects(uint256 weaponId) public view returns (bytes32[] memory effects) {
        require(Items.getItemType(weaponId) == ItemType.Weapon, "WEAPON: Not a weapon");
        effects = WeaponStats.getEffects(weaponId);
    }

    /**
     * @dev Calculates weapon bonuses for a character
     * @param characterId The character ID
     * @return bonuses The calculated weapon bonuses
     */
    function calculateWeaponBonuses(bytes32 characterId) public view returns (CharacterEquipmentData memory bonuses) {
        if (!IWorld(_world()).UD__isValidCharacterId(characterId)) {
            return bonuses;
        }

        uint256[] memory equippedWeapons = CharacterEquipment.getEquippedWeapons(characterId);
        WeaponStatsData memory weaponStats;
        
        for (uint256 i = 0; i < equippedWeapons.length; i++) {
            weaponStats = WeaponStats.get(equippedWeapons[i]);
            bonuses.strBonus += weaponStats.strModifier;
            bonuses.agiBonus += weaponStats.agiModifier;
            bonuses.intBonus += weaponStats.intModifier;
            bonuses.hpBonus += weaponStats.hpModifier;
        }
    }

    /**
     * @dev Updates weapon bonuses for a character
     * @param characterId The character ID
     */
    function _updateWeaponBonuses(bytes32 characterId) internal {
        CharacterEquipmentData memory equipmentData = CharacterEquipment.get(characterId);
        CharacterEquipmentData memory weaponBonuses = calculateWeaponBonuses(characterId);
        
        // Update only weapon-related bonuses
        equipmentData.strBonus = weaponBonuses.strBonus;
        equipmentData.agiBonus = weaponBonuses.agiBonus;
        equipmentData.intBonus = weaponBonuses.intBonus;
        equipmentData.hpBonus = weaponBonuses.hpBonus;

        CharacterEquipment.set(characterId, equipmentData);
    }

    /**
     * @dev Helper function to move an item to the end of an array
     * @param itemId The item ID to move
     * @param array The array to modify
     * @return sortedArray The modified array
     */
    function _swapToEndOfArray(uint256 itemId, uint256[] memory array)
        internal
        pure
        returns (uint256[] memory sortedArray)
    {
        if (array.length > 1) {
            for (uint256 i = 0; i < array.length; i++) {
                if (array[i] == itemId) {
                    uint256 last = array[array.length - 1];
                    array[i] = last;
                    array[array.length - 1] = itemId;
                    sortedArray = array;
                    break;
                }
            }
        } else {
            sortedArray = array;
        }
    }
}
