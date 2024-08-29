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
    Mobs,
    Stats,
    StatsData,
    CharacterEquipment,
    CharacterEquipmentData,
    WeaponStats,
    WeaponStatsData,
    ArmorStats,
    ArmorStatsData,
    SpellStats,
    SpellStatsData,
    ConsumableStats,
    StatRestrictions,
    StatRestrictionsData
} from "@codegen/index.sol";
import {ItemType, Classes} from "@codegen/common.sol";
import {AccessControlLib} from "@latticexyz/world-modules/src/utils/AccessControlLib.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import {_erc1155SystemId, _characterSystemId, _requireOwner, _requireAccess} from "../utils.sol";
import {ITEMS_NAMESPACE} from "../../constants.sol";
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
import {AdjustedCombatStats, MonsterStats} from "@interfaces/Structs.sol";
import "forge-std/console.sol";

contract EquipmentSystem is System {
    modifier inGame(bytes32 characterId) {
        CharactersData memory charData = Characters.get(characterId);
        require(charData.locked, "Character not in the Game");
        _;
    }

    function equipItems(bytes32 characterId, uint256[] memory itemIds) public inGame(characterId) {
        address characterOwner = IWorld(_world()).UD__getOwner(characterId);
        require(characterOwner == _msgSender(), "EQUIPMENT: Not Character Owner");
        uint256 itemId;
        for (uint256 i; i < itemIds.length; i++) {
            itemId = itemIds[i];
            require(IWorld(_world()).UD__isItemOwner(itemId, _msgSender()), "EQUIPMENT: Not Item Owner");
            ItemsData memory itemData = Items.get(itemId);
            require(uint8(itemData.itemType) < 4, "EQUIPMENT: Not an equippable Item");
            require(checkRequirements(characterId, itemId), "EQUIPMENT: Requirements not met");
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
            uint256[] memory equippedSpells = CharacterEquipment.getEquippedSpells(characterId);
            for (uint256 i; i < equippedSpells.length;) {
                if (equippedSpells[i] == itemId) {
                    _isEquipped = true;
                    break;
                }
                {
                    i++;
                }
            }
        } else if (uint8(itemData.itemType) == 3) {
            uint256[] memory equippedConsumables = CharacterEquipment.getEquippedConsumables(characterId);
            for (uint256 i; i < equippedConsumables.length;) {
                if (equippedConsumables[i] == itemId) {
                    _isEquipped = true;
                    break;
                }
                {
                    i++;
                }
            }
        } else {
            revert("EQUIPMENT: UNRECOGNIZED ITEM TYPE");
        }
    }

    function checkRequirements(bytes32 characterId, uint256 itemId) public view returns (bool canUse) {
        ItemsData memory itemData = Items.get(itemId);
        StatsData memory character = Stats.get(characterId);
        StatRestrictionsData memory statRestrictions = StatRestrictions.get(itemId);
        if (uint8(itemData.itemType) == 0) {
            bool isLevel = character.level >= WeaponStats.getMinLevel(itemId);
            bool hasStats = true;
            if (statRestrictions.minAgility > character.agility) hasStats = false;
            if (statRestrictions.minStrength > character.strength) hasStats = false;
            if (statRestrictions.minIntelligence > character.intelligence) hasStats = false;
            if (isLevel && hasStats) canUse = true;
        }
        if (uint8(itemData.itemType) == 1) {
            bool isLevel = character.level >= ArmorStats.getMinLevel(itemId);
            bool hasStats = true;
            if (statRestrictions.minAgility > character.agility) hasStats = false;
            if (statRestrictions.minStrength > character.strength) hasStats = false;
            if (statRestrictions.minIntelligence > character.intelligence) hasStats = false;
            if (isLevel && hasStats) canUse = true;
        }
        if (uint8(itemData.itemType) == 2) {
            bool isLevel = character.level >= SpellStats.getMinLevel(itemId);
            bool hasStats = true;
            if (statRestrictions.minAgility > character.agility) hasStats = false;
            if (statRestrictions.minStrength > character.strength) hasStats = false;
            if (statRestrictions.minIntelligence > character.intelligence) hasStats = false;
            if (isLevel && hasStats) canUse = true;
        }
        if (uint8(itemData.itemType) == 3) {
            bool isLevel = character.level >= ConsumableStats.getMinLevel(itemId);
            bool hasStats = true;
            if (statRestrictions.minAgility > character.agility) hasStats = false;
            if (statRestrictions.minStrength > character.strength) hasStats = false;
            if (statRestrictions.minIntelligence > character.intelligence) hasStats = false;
            if (isLevel && hasStats) canUse = true;
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
            require(CharacterEquipment.lengthEquippedSpells(characterId) < 3, "ITEMS: Too many spells equipped");
            CharacterEquipment.pushEquippedSpells(characterId, itemId);
        }

        if (uint8(itemType) == 4) {
            require(
                CharacterEquipment.lengthEquippedConsumables(characterId) < 3, "ITEMS: Too many consumables equipped"
            );
            CharacterEquipment.pushEquippedConsumables(characterId, itemId);
        }
    }

    function _setEquipmentBonuses(bytes32 characterId) internal {
        uint256[] memory equippedArmor = CharacterEquipment.getEquippedArmor(characterId);
        uint256[] memory equippedWeapons = CharacterEquipment.getEquippedWeapons(characterId);

        int256 totalArmor;
        int256 totalStrModifiers;
        int256 totalAgiModifiers;
        int256 totalIntModifiers;
        int256 totalHPModifiers;
        ArmorStatsData memory armorStats;
        WeaponStatsData memory weaponStats;
        if (equippedArmor.length > 0) {
            for (uint256 i; i < equippedArmor.length; i++) {
                armorStats = getArmorStats(equippedArmor[i]);
                totalArmor += armorStats.armorModifier;
                totalStrModifiers += armorStats.strModifier;
                totalAgiModifiers += armorStats.agiModifier;
                totalIntModifiers += armorStats.intModifier;
                totalHPModifiers += armorStats.hpModifier;
            }
        }
        if (equippedWeapons.length > 0) {
            for (uint256 i; i < equippedWeapons.length; i++) {
                weaponStats = getWeaponStats(equippedWeapons[i]);
                totalStrModifiers += weaponStats.strModifier;
                totalAgiModifiers += weaponStats.agiModifier;
                totalIntModifiers += weaponStats.intModifier;
                totalHPModifiers += weaponStats.hpModifier;
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
            uint256[] memory sortedArray =
                _moveIdToEndOfArray(itemId, CharacterEquipment.getEquippedSpells(characterId));
            if (sortedArray[sortedArray.length - 1] == itemId) {
                CharacterEquipment.setEquippedSpells(characterId, sortedArray);
                CharacterEquipment.popEquippedSpells(characterId);
                success = true;
            }
        } else if (itemType == uint8(3)) {
            uint256[] memory sortedArray =
                _moveIdToEndOfArray(itemId, CharacterEquipment.getEquippedConsumables(characterId));
            if (sortedArray[sortedArray.length - 1] == itemId) {
                CharacterEquipment.setEquippedConsumables(characterId, sortedArray);
                CharacterEquipment.popEquippedConsumables(characterId);
                success = true;
            }
        } else {
            revert("EQUIPMENT: UNRECOGNIZED ITEM TYPE");
        }
        _setEquipmentBonuses(characterId);
    }

    function applyEquipmentBonuses(bytes32 entityId) public view returns (AdjustedCombatStats memory modifiedStats) {
        StatsData memory entityStats = Stats.get(entityId);
        AdjustedCombatStats memory combatStats;

        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            CharacterEquipmentData memory equipmentStats = CharacterEquipment.get(entityId);

            combatStats.adjustedStrength = int256(entityStats.strength) + equipmentStats.strBonus >= 0
                ? int256(entityStats.strength) + equipmentStats.strBonus
                : int256(0);
            combatStats.adjustedAgility = int256(entityStats.agility) + equipmentStats.agiBonus >= 0
                ? int256(entityStats.agility) + equipmentStats.agiBonus
                : int256(0);
            combatStats.adjustedIntelligence = int256(entityStats.intelligence) + equipmentStats.intBonus >= 0
                ? int256(entityStats.intelligence) + equipmentStats.intBonus
                : int256(0);
            combatStats.adjustedMaxHp = int256(entityStats.baseHp) + equipmentStats.hpBonus >= 0
                ? int256(entityStats.baseHp) + equipmentStats.hpBonus
                : int256(1);
            combatStats.currentHp = int256(entityStats.currentHp);
        } else {
            combatStats.adjustedAgility = int256(entityStats.agility);
            combatStats.adjustedStrength = int256(entityStats.strength);
            combatStats.adjustedIntelligence = int256(entityStats.intelligence);
            combatStats.adjustedArmor =
                int256(abi.decode(Mobs.getMobStats(IWorld(_world()).UD__getMobId(entityId)), (MonsterStats)).armor);
            combatStats.adjustedMaxHp = int256(entityStats.baseHp);
            combatStats.currentHp = int256(entityStats.currentHp);
            combatStats.level = entityStats.level;
        }
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

    function checkItemEffect(uint256 itemId, bytes32 effectId) public view returns (bool hasAction) {
        ItemType itemType = Items.getItemType(itemId);

        if (itemType == ItemType.Weapon) {
            bytes32[] memory effects = WeaponStats.getEffects(itemId);
            for (uint256 i; i < effects.length;) {
                if (effectId == effects[i]) {
                    hasAction = true;
                    break;
                }
                {
                    i++;
                }
            }
        } else if (itemType == ItemType.Spell) {
            bytes32[] memory effects = SpellStats.getEffects(itemId);
            for (uint256 i; i < effects.length;) {
                if (effectId == effects[i]) {
                    hasAction = true;
                    break;
                }
                {
                    i++;
                }
            }
        } else if (itemType == ItemType.Consumable) {
            bytes32[] memory effects = ConsumableStats.getEffects(itemId);
            for (uint256 i; i < effects.length;) {
                if (effectId == effects[i]) {
                    hasAction = true;
                    break;
                }
                {
                    i++;
                }
            }
        }
    }

    function getItemEffects(uint256 itemId) public view returns (bytes32[] memory effects) {
        ItemType itemType = Items.getItemType(itemId);
        if (itemType == ItemType.Weapon) {
            effects = WeaponStats.getEffects(itemId);
        } else if (itemType == ItemType.Spell) {
            effects = SpellStats.getEffects(itemId);
        } else if (itemType == ItemType.Consumable) {
            effects = ConsumableStats.getEffects(itemId);
        }
    }

    function getWeaponStats(uint256 itemId) public view returns (WeaponStatsData memory _weaponStats) {
        ItemType itemType = Items.getItemType(itemId);
        require(itemType == ItemType.Weapon, "ITEMS: Not a  weapon");
        _weaponStats = WeaponStats.get(itemId);
    }

    function getArmorStats(uint256 itemId) public view returns (ArmorStatsData memory _ArmorStats) {
        ItemType itemType = Items.getItemType(itemId);
        require(itemType == ItemType.Armor, "ITEMS: Not a  Armor");
        _ArmorStats = ArmorStats.get(itemId);
    }

    function getSpellStats(uint256 itemId) public view returns (SpellStatsData memory _spellStats) {
        ItemType itemType = Items.getItemType(itemId);
        require(itemType == ItemType.Spell, "ITEMS: Not a  Armor");
        _spellStats = SpellStats.get(itemId);
    }
}
