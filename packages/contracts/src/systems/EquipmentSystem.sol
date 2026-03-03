// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {IWorld} from "@world/IWorld.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import {IERC1155Receiver} from "@erc1155/IERC1155Receiver.sol";
import {
    Items,
    ItemsData,
    Characters,
    CharactersData,
    Stats,
    StatsData,
    CharacterEquipment,
    CharacterEquipmentData,
    WeaponStats,
    ArmorStats,
    ConsumableStats,
    AccessoryStats,
    StatRestrictions,
    StatRestrictionsData
} from "@codegen/index.sol";
import {ItemType} from "@codegen/common.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {Owners} from "@erc1155/tables/Owners.sol";
import {StatCalculator} from "@libraries/StatCalculator.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {ERC1155MetadataURI} from "@erc1155/tables/ERC1155MetadataURI.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {UserDelegationControl} from "@latticexyz/world/src/codegen/tables/UserDelegationControl.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {PauseLib} from "../libraries/PauseLib.sol";

contract EquipmentSystem is System {
    modifier inGame(bytes32 characterId) {
        CharactersData memory charData = Characters.get(characterId);
        require(charData.locked, "Character not in the Game");
        _;
    }

    function equipItems(bytes32 characterId, uint256[] memory itemIds) public inGame(characterId) {
        PauseLib.requireNotPaused();
        address characterOwner = IWorld(_world()).UD__getOwner(characterId);
        address caller = _msgSender();
        // Check direct ownership or delegation
        bool isOwner = characterOwner == caller;
        bool hasDelegation = ResourceId.unwrap(UserDelegationControl.getDelegationControlId(characterOwner, caller)) != bytes32(0);
        require(isOwner || hasDelegation, "EQUIPMENT: Not Character Owner");
        require(!IWorld(_world()).UD__isInEncounter(characterId), "Cannot equip items in combat");
        uint256 itemId;
        for (uint256 i; i < itemIds.length; i++) {
            itemId = itemIds[i];
            // Items are owned by the character owner (delegator), not the caller (session wallet)
            require(IWorld(_world()).UD__isItemOwner(itemId, characterOwner), "EQUIPMENT: Not Item Owner");
            ItemType itemType = Items.getItemType(itemId);
            if (itemType == ItemType.Weapon) {
                // Delegate to WeaponSystem
                IWorld(_world()).UD__equipWeapon(characterId, itemId);
            } else if (itemType == ItemType.Armor) {
                // Delegate to ArmorSystem
                IWorld(_world()).UD__equipArmor(characterId, itemId);
            } else if (itemType == ItemType.Consumable) {
                _equipItem(characterId, itemId, ItemType.Consumable);
            } else {
                revert("EQUIPMENT: Unsupported item type");
            }
        }

        // Recalculate and apply bonuses after all equips
        IWorld(_world()).UD__setStats(characterId, IWorld(_world()).UD__calculateEquipmentBonuses(characterId));
        IWorld(_world()).UD__applyWorldEffects(characterId);
    }

    function isEquipped(bytes32 characterId, uint256 itemId) public view returns (bool _isEquipped) {
        ItemsData memory itemData = Items.get(itemId);
        if (itemData.itemType == ItemType.Weapon) {
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
        } else if (itemData.itemType == ItemType.Armor) {
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
        } else if (itemData.itemType == ItemType.Consumable) {
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
        StatsData memory character = abi.decode(Characters.getBaseStats(characterId), (StatsData));
        StatRestrictionsData memory statRestrictions = StatRestrictions.get(itemId);

        if (itemData.itemType == ItemType.Weapon) {
            bool isLevel = character.level >= WeaponStats.getMinLevel(itemId);
            bool hasStats = true;
            if (statRestrictions.minAgility > character.agility) hasStats = false;
            if (statRestrictions.minStrength > character.strength) hasStats = false;
            if (statRestrictions.minIntelligence > character.intelligence) hasStats = false;
            if (isLevel && hasStats) canUse = true;
        }
        if (itemData.itemType == ItemType.Armor) {
            bool isLevel = character.level >= ArmorStats.getMinLevel(itemId);
            bool hasStats = true;
            if (statRestrictions.minAgility > character.agility) hasStats = false;
            if (statRestrictions.minStrength > character.strength) hasStats = false;
            if (statRestrictions.minIntelligence > character.intelligence) hasStats = false;
            if (isLevel && hasStats) canUse = true;
        }
        if (itemData.itemType == ItemType.Consumable) {
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
        uint256 totalLength;
        // check and equip armor
        if (itemType == ItemType.Armor) {
            if (CharacterEquipment.lengthEquippedArmor(characterId) < 1) {
                CharacterEquipment.pushEquippedArmor(characterId, itemId);
            } else if (CharacterEquipment.lengthEquippedArmor(characterId) > 0) {
                revert("Already wearing armor");
            }
        } else {
            // check and equip items
            totalLength += CharacterEquipment.lengthEquippedWeapons(characterId);
            totalLength += CharacterEquipment.lengthEquippedConsumables(characterId);
            require(totalLength < 4, "too many items equipped");

            if (itemType == ItemType.Weapon) {
                CharacterEquipment.pushEquippedWeapons(characterId, itemId);
            }
            if (itemType == ItemType.Consumable) {
                CharacterEquipment.pushEquippedConsumables(characterId, itemId);
            }
        }
    }

    function unequipItem(bytes32 characterId, uint256 itemId) public inGame(characterId) returns (bool success) {
        PauseLib.requireNotPaused();
        address characterOwner = IWorld(_world()).UD__getOwner(characterId);
        address caller = _msgSender();
        // Check direct ownership or delegation
        bool isOwner = characterOwner == caller;
        bool hasDelegation = ResourceId.unwrap(UserDelegationControl.getDelegationControlId(characterOwner, caller)) != bytes32(0);
        require(isOwner || hasDelegation, "EQUIPMENT: Not Character Owner");
        require(isEquipped(characterId, itemId), "EQUIPMENT: NOT EQUIPPED");
        require(!IWorld(_world()).UD__isInEncounter(characterId), "Cannot un-equip items in combat");
        ItemType itemType = IWorld(_world()).UD__getItemType(itemId);

        if (itemType == ItemType.Weapon) {
            // Delegate to WeaponSystem
            success = IWorld(_world()).UD__unequipWeapon(characterId, itemId);
        } else if (itemType == ItemType.Armor) {
            // Delegate to ArmorSystem
            success = IWorld(_world()).UD__unequipArmor(characterId, itemId);
        } else if (itemType == ItemType.Consumable) {
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
        if (success) {
            // Ensure stats are recalculated after unequip
            IWorld(_world()).UD__setStats(characterId, IWorld(_world()).UD__calculateEquipmentBonuses(characterId));
            IWorld(_world()).UD__applyWorldEffects(characterId);
        }
    }

    function getCombatStats(bytes32 entityId) public view returns (AdjustedCombatStats memory modifiedStats) {
        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            StatsData memory baseStats = Stats.get(entityId);
            modifiedStats.strength = baseStats.strength;
            modifiedStats.agility = baseStats.agility;
            modifiedStats.intelligence = baseStats.intelligence;
            modifiedStats.armor = CharacterEquipment.getArmor(entityId);
            modifiedStats.maxHp = baseStats.maxHp;
            modifiedStats.currentHp = baseStats.currentHp;
        } else if (IWorld(_world()).UD__isValidMob(entityId)) {
            modifiedStats = IWorld(_world()).UD__getMonsterCombatStats(entityId);
        } else {
            revert("unrecognized id");
        }
    }

    /// @dev returns the base stats + the equipment stats of a character
    function calculateEquipmentBonuses(bytes32 entityId) public view returns (AdjustedCombatStats memory) {
        AdjustedCombatStats memory combatStats = getCombatStats(entityId);
        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            // Get baseStats from Characters table, falling back to Stats table if empty
            bytes memory encodedBaseStats = Characters.getBaseStats(entityId);
            StatsData memory baseStats;
            if (encodedBaseStats.length > 0) {
                baseStats = abi.decode(encodedBaseStats, (StatsData));
            } else {
                // Fallback to Stats table for characters that haven't properly entered the game
                baseStats = Stats.get(entityId);
            }
            CharacterEquipmentData memory equipmentStats = CharacterEquipment.get(entityId);

            return StatCalculator.calculateEquipmentBonuses(baseStats, equipmentStats);
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
        } else if (itemType == ItemType.Consumable) {
            effects = ConsumableStats.getEffects(itemId);
        } else if (itemType == ItemType.Accessory) {
            effects = AccessoryStats.getEffects(itemId);
        }
    }
}
