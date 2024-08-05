// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {IWorld} from "@world/IWorld.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import {IERC1155Receiver} from "@erc1155/IERC1155Receiver.sol";
import {
    UltimateDominionConfig,
    Items,
    ItemsData,
    Counters,
    StarterItems,
    StarterItemsData,
    Characters,
    CharactersData,
    Stats,
    StatsData,
    CharacterEquipment,
    CharacterEquipmentData
} from "@codegen/index.sol";
import {ItemType, Classes} from "@codegen/common.sol";
import {AccessControlLib} from "@latticexyz/world-modules/src/utils/AccessControlLib.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import {_erc1155SystemId, _characterSystemId, _requireOwner, _requireAccess} from "../utils.sol";
import {ITEMS_NAMESPACE} from "../../constants.sol";
import {WeaponStats, ArmorStats} from "@interfaces/Structs.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {Owners} from "@erc1155/tables/Owners.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {ERC1155MetadataURI} from "@erc1155/tables/ERC1155MetadataURI.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {
    _metadataTableId,
    _erc1155URIStorageTableId,
    _totalSupplyTableId,
    _operatorApprovalTableId,
    _ownersTableId
} from "@erc1155/utils.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import "forge-std/console2.sol";

contract EquipmentSystem is System {
    modifier inGame(bytes32 characterId) {
        CharactersData memory charData = Characters.get(characterId);
        require(charData.locked, "Character not in the Game");
        _;
    }

    function equipItems(bytes32 characterId, uint256[] memory itemIds) public inGame(characterId) {
        address characterOwner = IWorld(_world()).UD__getOwner(characterId);
        require(characterOwner == _msgSender(), "ITEMS: Not Character Owner");
        uint256 itemId;
        for (uint256 i; i < itemIds.length; i++) {
            itemId = itemIds[i];
            require(IWorld(_world()).UD__isItemOwner(itemId, _msgSender()), "ITEMS: Not Item Owner");
            ItemsData memory itemData = Items.get(itemId);
            require(uint8(itemData.itemType) < 3, "ITEMS: Not an equippable Item");
            require(checkRequirements(characterId, itemId), "ITEMS: Requirements not met");
            _equipItem(characterId, itemId, itemData.itemType);
        }
        _setEquipmentBonuses(characterId);
    }

    function isEquipped(bytes32 characterId, uint256 itemId) public view returns (bool _isEquipped) {
        ItemsData memory itemData = Items.get(itemId);
        if (uint8(itemData.itemType) == 0) {
            uint256[] memory equippedWeap = CharacterEquipment.getEquippedWeapons(characterId);
            for (uint256 i; i < equippedWeap.length;) {
                if (equippedWeap[i] == itemId) {
                    _isEquipped = true;
                    break;
                }
                {
                    i++;
                }
            }
        } else if (uint8(itemData.itemType) == 1) {
            uint256[] memory equippedArmor = CharacterEquipment.getEquippedArmor(characterId);
            for (uint256 i; i < equippedArmor.length;) {
                if (equippedArmor[i] == itemId) {
                    _isEquipped = true;
                    break;
                }
                {
                    i++;
                }
            }
        } else if (uint8(itemData.itemType) == 2) {
            // spells
        } else {
            revert("EQUIPMENT: UNRECOGNIZED ITEM TYPE");
        }
    }

    function checkRequirements(bytes32 characterId, uint256 itemId) public view returns (bool canUse) {
        ItemsData memory itemData = Items.get(itemId);
        StatsData memory character = Stats.get(characterId);

        canUse = true;

        if (uint8(itemData.itemType) == 0) {
            WeaponStats memory weaponStats = abi.decode(itemData.stats, (WeaponStats));
            bool isLevel = character.level >= weaponStats.minLevel;
            bool isClass;
            if (weaponStats.classRestrictions.length > 0) {
                for (uint256 i; i < weaponStats.classRestrictions.length;) {
                    if (uint8(character.class) == uint8(weaponStats.classRestrictions[i])) {
                        isClass = true;
                        break;
                    }
                    {
                        i++;
                    }
                }
            } else {
                isClass = true;
            }
            if (!isLevel || !isClass) canUse = false;
        }
        if (uint8(itemData.itemType) == 1) {
            ArmorStats memory armorStats = abi.decode(itemData.stats, (ArmorStats));
            bool isLevel = character.level >= armorStats.minLevel;
            bool isClass;
            if (armorStats.classRestrictions.length > 0) {
                for (uint256 i; i < armorStats.classRestrictions.length;) {
                    if (uint8(character.class) == uint8(armorStats.classRestrictions[i])) {
                        isClass = true;
                        break;
                    }
                    {
                        i++;
                    }
                }
            } else {
                isClass = true;
            }
            if (!isLevel || !isClass) canUse = false;
        }
        return canUse;
    }

    function _equipItem(bytes32 characterId, uint256 itemId, ItemType itemType) internal {
        require(!isEquipped(characterId, itemId), "EQUIPMENT: ALREADY EQUIPPED");
        if (uint8(itemType) == 0) {
            require(CharacterEquipment.lengthEquippedWeapons(characterId) < 2, "ITEMS: Too many weapons equipped");
            CharacterEquipment.pushEquippedWeapons(characterId, itemId);
        }
        if (uint8(itemType) == 1) {
            require(CharacterEquipment.lengthEquippedArmor(characterId) < 1, "ITEMS: Too much armor equipped");
            CharacterEquipment.pushEquippedArmor(characterId, itemId);
        }

        if (uint8(itemType) == 2) {
            // require(CharacterEquipment.lengthEquippedSpells(characterId) < 3, "ITEMS: Too many weapons equipped");
            // CharacterEquipment.pushEquippedSpells(characterId, itemId);
        }
    }

    function _setEquipmentBonuses(bytes32 characterId) internal {
        uint256[] memory equippedArmor = CharacterEquipment.getEquippedArmor(characterId);
        uint256[] memory equippedWeapons = CharacterEquipment.getEquippedWeapons(characterId);
        uint256 totalArmor;
        int256 totalStrModifiers;
        int256 totalAgiModifiers;
        int256 totalIntModifiers;
        int256 totalHPModifiers;
        ArmorStats memory armorStats;
        WeaponStats memory weaponStats;
        if (equippedArmor.length > 0) {
            for (uint256 i; i < equippedArmor.length; i++) {
                armorStats = getArmorStats(equippedArmor[i]);
                totalArmor += armorStats.armorModifier;
                totalStrModifiers += armorStats.strModifier;
                totalAgiModifiers += armorStats.agiModifier;
                totalIntModifiers += armorStats.intModifier;
                totalHPModifiers += armorStats.hitPointModifier;
            }
        }
        if (equippedWeapons.length > 0) {
            for (uint256 i; i < equippedWeapons.length; i++) {
                weaponStats = getWeaponStats(equippedWeapons[i]);
                totalStrModifiers += weaponStats.strModifier;
                totalAgiModifiers += weaponStats.agiModifier;
                totalIntModifiers += weaponStats.intModifier;
                totalHPModifiers += weaponStats.hitPointModifier;
            }
        }
        CharacterEquipment.setStrBonus(characterId, totalStrModifiers);
        CharacterEquipment.setAgiBonus(characterId, totalAgiModifiers);
        CharacterEquipment.setIntBonus(characterId, totalIntModifiers);
        CharacterEquipment.setHpBonus(characterId, totalHPModifiers);
        CharacterEquipment.setArmor(characterId, totalArmor);
    }

    function unequipItem(bytes32 characterId, uint256 itemId) public inGame(characterId) returns (bool success) {
        address characterOwner = IWorld(_world()).UD__getOwner(characterId);
        require(characterOwner == _msgSender(), "ITEMS: Not Character Owner");
        uint8 itemType = uint8(IWorld(_world()).UD__getItemType(itemId));
        if (itemType == uint8(0)) {
            uint256[] memory sortedArray = _swapToEndOfArray(itemId, CharacterEquipment.getEquippedWeapons(characterId));
            if (sortedArray[sortedArray.length - 1] == itemId) {
                CharacterEquipment.setEquippedWeapons(characterId, sortedArray);
                CharacterEquipment.popEquippedWeapons(characterId);

                success = true;
            }
        } else if (itemType == uint8(1)) {
            uint256[] memory sortedArray = _swapToEndOfArray(itemId, CharacterEquipment.getEquippedArmor(characterId));
            if (sortedArray[sortedArray.length - 1] == itemId) {
                CharacterEquipment.setEquippedArmor(characterId, sortedArray);
                CharacterEquipment.popEquippedArmor(characterId);
                success = true;
            }
        } else if (itemType == uint8(2)) {
            // uint256[] memory sortedArray =
            //     _moveIdToEndOfArray(itemId, CharacterEquipment.getEquippedSpells(characterId));
            // if (sortedArray[sortedArray.length - 1] == itemId) {
            //     CharacterEquipment.setEquippedSpells(characterId, sortedArray);
            //     CharacterEquipment.popEquippedSpells(characterId);
            //     success = true;
            // }
        } else {
            revert("EQUIPMENT: UNRECOGNIZED ITEM TYPE");
        }
        _setEquipmentBonuses(characterId);
    }

    function applyEquipmentBonuses(bytes32 entityId) public view returns (AdjustedCombatStats memory modifiedStats) {
        StatsData memory entityStats = Stats.get(entityId);
        AdjustedCombatStats memory combatStats;

        CharacterEquipmentData memory equipmentStats = CharacterEquipment.get(entityId);
        //TODO add over/underflowProtection
        combatStats.adjustedStrength = uint256(
            int256(entityStats.strength) + equipmentStats.strBonus >= 0
                ? int256(entityStats.strength) + equipmentStats.strBonus
                : int256(0)
        );
        combatStats.adjustedAgility = uint256(
            int256(entityStats.agility) + equipmentStats.agiBonus >= 0
                ? int256(entityStats.agility) + equipmentStats.agiBonus
                : int256(0)
        );
        combatStats.adjustedIntelligence = uint256(
            int256(entityStats.intelligence) + equipmentStats.intBonus >= 0
                ? int256(entityStats.intelligence) + equipmentStats.intBonus
                : int256(0)
        );
        combatStats.adjustedMaxHp = uint256(
            int256(entityStats.baseHp) + equipmentStats.hpBonus >= 0
                ? int256(entityStats.baseHp) + equipmentStats.hpBonus
                : int256(1)
        );
        combatStats.currentHp = entityStats.currentHp;
        return combatStats;
    }

    function _moveIdToEndOfArray(uint256 itemId, uint256[] memory array)
        internal
        pure
        returns (uint256[] memory sortedArray)
    {
        uint256[] memory arrayToBeSorted = array;
        for (uint256 i = 0; i < arrayToBeSorted.length; i++) {
            if (arrayToBeSorted[i] == itemId) {
                for (uint256 j = i; j < arrayToBeSorted.length; j++) {
                    if (j + 1 < arrayToBeSorted.length) {
                        arrayToBeSorted[j] = arrayToBeSorted[j + 1];
                    } else if (j + 1 >= arrayToBeSorted.length) {
                        arrayToBeSorted[j] = itemId;
                    }
                }
                break;
            }
        }
        sortedArray = arrayToBeSorted;
    }

    function _swapToEndOfArray(uint256 itemId, uint256[] memory array)
        internal
        pure
        returns (uint256[] memory swappedArray)
    {
        if (array.length > 1) {
            for (uint256 i; i < array.length;) {
                if (array[i] == itemId) {
                    uint256 last = array[array.length - 1];
                    array[i] = last;
                    array[array.length - 1] = itemId;
                    swappedArray = array;
                    break;
                }
                {
                    i++;
                }
            }
        } else {
            swappedArray = array;
        }
    }

    function getWeaponStats(uint256 itemId) public view returns (WeaponStats memory _weaponStats) {
        ItemsData memory _data = Items.get(itemId);
        require(_data.itemType == ItemType.Weapon, "ITEMS: Not a  weapon");
        _weaponStats = abi.decode(_data.stats, (WeaponStats));
    }

    function getArmorStats(uint256 itemId) public view returns (ArmorStats memory _ArmorStats) {
        ItemsData memory _data = Items.get(itemId);
        require(_data.itemType == ItemType.Armor, "ITEMS: Not a  Armor");
        _ArmorStats = abi.decode(_data.stats, (ArmorStats));
    }
}
