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
    CharacterEquipmentData,
    ArmorStats,
    ArmorStatsData,
    WeaponStats,
    WeaponStatsData,
    StatRestrictions,
    StatRestrictionsData,
    SpellStatsData,
    SpellStats,
    ConsumableStats
} from "@codegen/index.sol";
import {ItemType, Classes} from "@codegen/common.sol";
import {AccessControlLib} from "@latticexyz/world-modules/src/utils/AccessControlLib.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import {_erc1155SystemId, _characterSystemId, _requireOwner, _requireAccess, _lootManagerSystemId} from "../utils.sol";
import {ITEMS_NAMESPACE, WORLD_NAMESPACE} from "../../constants.sol";
// import {WeaponStats, ArmorStats} from "@interfaces/Structs.sol";
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
import "forge-std/console.sol";

contract ItemsSystem is System {
    function createItem(
        ItemType itemType,
        uint256 supply,
        uint256 dropChance,
        bytes memory stats,
        string memory itemMetadataURI
    ) public returns (uint256) {
        _requireOwner(address(this), _msgSender());
        uint256 itemId = _incrementItemsCounter();
        // create new item struct
        ItemsData memory newItem = ItemsData({itemType: itemType, dropChance: dropChance, stats: stats});

        StatRestrictionsData memory statRestrictions;
        if (itemType == ItemType.Weapon) {
            WeaponStatsData memory weaponStats;
            (weaponStats, statRestrictions) = abi.decode(stats, (WeaponStatsData, StatRestrictionsData));

            // set weapon stats table
            WeaponStats.set(itemId, weaponStats);
            StatRestrictions.set(itemId, statRestrictions);
        } else if (itemType == ItemType.Armor) {
            ArmorStatsData memory armorStats;
            (armorStats, statRestrictions) = abi.decode(stats, (ArmorStatsData, StatRestrictionsData));

            // set armor stats table
            ArmorStats.set(itemId, armorStats);
            StatRestrictions.set(itemId, statRestrictions);
        }
        // mint supply to lootManager contract
        IWorld(_world()).call(
            _erc1155SystemId(ITEMS_NAMESPACE),
            abi.encodeWithSignature(
                "mint(address,uint256,uint256,bytes)",
                Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE)),
                itemId,
                supply,
                ""
            )
        );
        // see if you can guess what this is doing...
        setTokenUri(itemId, itemMetadataURI);

        // set the new item struct in the items table;
        Items.set(itemId, newItem);

        return itemId;
    }

    function resupplyLootManager(uint256 itemId, uint256 newSupply) public {
        _requireAccess(address(this), _msgSender());
        require(getTotalSupply(itemId) != 0, "No existing supply");
        // mint supply to lootManager contract
        IWorld(_world()).call(
            _erc1155SystemId(ITEMS_NAMESPACE),
            abi.encodeWithSignature(
                "mint(address,uint256,uint256,bytes)",
                Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE)),
                itemId,
                newSupply,
                ""
            )
        );
    }

    function createItems(
        ItemType[] memory itemTypes,
        uint256[] memory supply,
        uint256[] memory dropChances,
        bytes[] memory stats,
        string[] memory itemMetadataURIs
    ) public {
        uint256 len = itemTypes.length;
        require(
            supply.length == len && itemMetadataURIs.length == len && stats.length == len,
            "ITEMS: Array length misencounter"
        );

        for (uint256 i; i < len; i++) {
            createItem(itemTypes[i], supply[i], dropChances[i], stats[i], itemMetadataURIs[i]);
        }
    }

    function getItemBalance(bytes32 entityId, uint256 itemId) public view returns (uint256 _balance) {
        address ownerAddress = IWorld(_world()).UD__getOwnerAddress(entityId);
        _balance = _items().balanceOf(ownerAddress, itemId);
    }

    function getTotalSupply(uint256 tokenId) public view returns (uint256 _supply) {
        _supply = TotalSupply.getTotalSupply(_totalSupplyTableId(ITEMS_NAMESPACE), tokenId);
    }

    function getStarterItems(Classes class) public view returns (StarterItemsData memory data) {
        return StarterItems.get(class);
    }

    function setTokenUri(uint256 tokenId, string memory tokenUri) public {
        _requireOwner(address(this), _msgSender());
        ERC1155URIStorage.setUri(_erc1155URIStorageTableId(ITEMS_NAMESPACE), tokenId, tokenUri);
    }

    function getItemType(uint256 itemId) public view returns (ItemType) {
        ItemsData memory itemData = Items.get(itemId);
        return itemData.itemType;
    }

    function getCurrentItemsCounter() public view returns (uint256) {
        address itemsContract = UltimateDominionConfig.getItems();
        return Counters.getCounter(address(itemsContract), 0);
    }

    function _incrementItemsCounter() internal returns (uint256) {
        address itemsContract = UltimateDominionConfig.getItems();
        uint256 itemsCounter = Counters.getCounter(address(itemsContract), 0) + 1;
        Counters.setCounter(itemsContract, 0, (itemsCounter));
        return itemsCounter;
    }

    function setStarterItems(Classes class, uint256[] memory itemIds, uint256[] memory amounts) public {
        _requireOwner(address(this), _msgSender());
        require(itemIds.length == amounts.length, "ITEMS: Length misencounter");
        StarterItems.set(class, itemIds, amounts);
    }

    function isItemOwner(uint256 itemId, address account) public view returns (bool) {
        return Owners.getBalance(_ownersTableId(ITEMS_NAMESPACE), account, itemId) > 0;
    }

    function _items() internal view returns (IERC1155System items) {
        items = IERC1155System(UltimateDominionConfig.getItems());
    }

    // function getArmorStats(uint256 itemId)public view returns(){}

    function consumeItem(bytes32 characterId, uint256 itemId) public {
        _requireAccess(address(this), _msgSender());

        address playerAddr = IWorld(_world()).UD__getOwnerAddress(characterId);
        address lootManager = Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE));
        //will require approval
        _items().safeTransferFrom(playerAddr, lootManager, itemId, 1, "");
    }

    // function getConsumableStats(uint256 itemId)public view returns(){}
    // function getScrollStats(uint256 itemId)public view returns(){}
    // function getMaterialStats(uint256 itemId)public view returns(){}
}
