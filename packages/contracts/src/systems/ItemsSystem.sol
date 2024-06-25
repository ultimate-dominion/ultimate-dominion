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
    CharacterStats,
    CharacterStatsData,
    CharacterEquipment
} from "@codegen/index.sol";
import {ItemType, Classes} from "@codegen/common.sol";
import {AccessControlLib} from "@latticexyz/world-modules/src/utils/AccessControlLib.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import {_erc1155SystemId, _characterSystemId, _requireOwner} from "../utils.sol";
import {ITEMS_NAMESPACE} from "../../constants.sol";
import {WeaponStats} from "@interfaces/Structs.sol";
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
import "forge-std/console2.sol";

contract ItemsSystem is System {
    modifier inGame(uint256 characterId) {
        CharactersData memory charData = Characters.get(characterId);
        require(charData.locked, "Character not in the Game");
        _;
    }

    function _items() internal view returns (IERC1155System items) {
        items = IERC1155System(UltimateDominionConfig.getItems());
    }

    function createItem(ItemType itemType, uint256 supply, bytes memory stats, string memory itemMetadataURI)
        public
        returns (uint256)
    {
        uint256 itemId = _incrementItemsCounter();
        IWorld(_world()).call(
            _erc1155SystemId(ITEMS_NAMESPACE),
            abi.encodeWithSignature("mint(address,uint256,uint256,bytes)", address(this), itemId, supply, "")
        );

        setTokenUri(itemId, itemMetadataURI);
        Items.set(itemId, itemType, stats);

        return itemId;
    }

    function createItems(
        ItemType[] memory itemTypes,
        uint256[] memory supply,
        bytes[] memory stats,
        string[] memory itemMetadataURIs
    ) public {
        uint256 len = itemTypes.length;
        require(
            supply.length == len && itemMetadataURIs.length == len && stats.length == len,
            "ITEMS: Array length mismatch"
        );

        for (uint256 i; i < len; i++) {
            createItem(itemTypes[i], supply[i], stats[i], itemMetadataURIs[i]);
        }
    }

    function equipItems(uint256 characterId, uint256[] memory itemIds) public inGame(characterId) {
        address characterOwner = IWorld(_world()).UD__getOwner(characterId);
        require(characterOwner == _msgSender(), "ITEMS: Not Character Owner");
        uint256 itemId;
        for (uint256 i; i < itemIds.length; i++) {
            itemId = itemIds[i];
            require(isItemOwner(itemId, _msgSender()), "ITEMS: Not Item Owner");
            ItemsData memory itemData = Items.get(itemId);
            require(uint8(itemData.itemType) < 3, "ITEMS: Not an equippable Item");
            require(checkRequirements(characterId, itemId), "ITEMS: Requirements not met");
            _equipItem(characterId, itemId, itemData.itemType);
        }
    }

    function isEquipped(uint256 characterId, uint256 itemId) public view returns (bool isEquipped) {
        ItemsData memory itemData = Items.get(itemId);
        if (uint8(itemData.itemType) == 0) {
            uint256[] memory equippedWeap = CharacterEquipment.getEquippedWeapons(characterId);
            for (uint256 i; i < equippedWeap.length;) {
                if (equippedWeap[i] == itemId) isEquipped = true;
                break;
                {
                    i++;
                }
            }
        }
    }

    function checkRequirements(uint256 characterId, uint256 itemId) public view returns (bool) {
        ItemsData memory itemData = Items.get(itemId);
        CharacterStatsData memory character = CharacterStats.get(characterId);
        CharactersData memory characterData = Characters.get(characterId);
        bool canUse = true;
        if (uint8(itemData.itemType) == 0) {
            WeaponStats memory weaponStats = abi.decode(itemData.stats, (WeaponStats));
            bool isLevel = IWorld(_world()).UD__getCurrentLevel(character.experience) >= weaponStats.minLevel;
            bool isClass;
            if (weaponStats.classRestrictions.length > 0) {
                for (uint256 i; i < weaponStats.classRestrictions.length;) {
                    if (uint8(characterData.class) == uint8(weaponStats.classRestrictions[i])) isClass = true;
                    break;
                    {
                        i++;
                    }
                }
            } else {
                isClass = true;
            }
            if (!isLevel || !isClass) canUse = false;
        }
        // if(uint8(itemData.ItemType) == 1){check Armor requirements}
        return canUse;
    }

    function _equipItem(uint256 characterId, uint256 itemId, ItemType itemType) internal {
        if (uint8(itemType) == 0) {
            require(CharacterEquipment.lengthEquippedWeapons(characterId) < 3, "ITEMS: Too many weapons equipped");
            CharacterEquipment.pushEquippedWeapons(characterId, itemId);
        }
        if (uint8(itemType) == 1) {
            require(CharacterEquipment.lengthEquippedArmor(characterId) < 3, "ITEMS: Too many weapons equipped");
            CharacterEquipment.pushEquippedArmor(characterId, itemId);
        }
        if (uint8(itemType) == 2) {
            require(CharacterEquipment.lengthEquippedSpells(characterId) < 3, "ITEMS: Too many weapons equipped");
            CharacterEquipment.pushEquippedSpells(characterId, itemId);
        }
    }

    function getTotalSupply(uint256 tokenId) public view returns (uint256 _supply) {
        _supply = TotalSupply.getTotalSupply(_totalSupplyTableId(ITEMS_NAMESPACE), tokenId);
    }

    function issueStarterItems(uint256 characterId) public {
        require(_msgSender() == Systems.getSystem(_characterSystemId("UD")), "ITEMS: Invalid System");
        StarterItemsData memory starterItems = StarterItems.get(Characters.getClass(characterId));

        address owner = IWorld(_world()).UD__getOwner(characterId);

        for (uint256 i; i < starterItems.itemIds.length; i++) {
            _items().transferFrom(address(this), owner, starterItems.itemIds[i], starterItems.amounts[i]);
        }
    }

    function setTokenUri(uint256 tokenId, string memory tokenUri) public {
        _requireOwner(address(this), _msgSender());
        ERC1155URIStorage.setUri(_erc1155URIStorageTableId(ITEMS_NAMESPACE), tokenId, tokenUri);
    }

    function _incrementItemsCounter() internal returns (uint256) {
        address itemsContract = UltimateDominionConfig.getItems();
        uint256 itemsCounter = Counters.getCounter(address(itemsContract)) + 1;
        Counters.setCounter(itemsContract, (itemsCounter));
        return itemsCounter;
    }

    function getWeaponStats(uint256 itemId) public view returns (WeaponStats memory _weaponStats) {
        ItemsData memory _data = Items.get(itemId);
        require(_data.itemType == ItemType.Weapon, "ITEMS: Not a  weapon");
        _weaponStats = abi.decode(_data.stats, (WeaponStats));
    }

    function setStarterItems(Classes class, uint256[] memory itemIds, uint256[] memory amounts) public {
        _requireOwner(address(this), _msgSender());
        require(itemIds.length == amounts.length, "ITEMS: Length mismatch");
        StarterItems.set(class, itemIds, amounts);
    }

    function isItemOwner(uint256 itemId, address account) internal view returns (bool) {
        return Owners.getBalance(_ownersTableId(ITEMS_NAMESPACE), account, itemId) > 0;
    }

    // function getArmourStats(uint256 itemId)public view returns(){}
    // function getPotionStats(uint256 itemId)public view returns(){}
    // function getScrollStats(uint256 itemId)public view returns(){}
    // function getMaterialStats(uint256 itemId)public view returns(){}
}
