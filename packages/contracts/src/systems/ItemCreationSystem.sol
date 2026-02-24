// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {
    UltimateDominionConfig,
    Items,
    ItemsData,
    Counters,
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
import {_requireOwner, _requireAccessOrAdmin, _lootManagerSystemId} from "../utils.sol";
import {ITEMS_NAMESPACE, WORLD_NAMESPACE} from "../../constants.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {Owners} from "@erc1155/tables/Owners.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {_erc1155URIStorageTableId, _totalSupplyTableId, _ownersTableId} from "@erc1155/utils.sol";
import {ArrayMismatch, NoSupply} from "../Errors.sol";

contract ItemCreationSystem is System {
    function createItem(
        ItemType itemType,
        uint256 supply,
        uint256 dropChance,
        uint256 price,
        bytes memory stats,
        string memory itemMetadataURI
    ) public returns (uint256) {
        _requireAccessOrAdmin(address(this), _msgSender());
        uint256 itemId = _incrementItemsCounter();
        ItemsData memory newItem = ItemsData({itemType: itemType, dropChance: dropChance, price: price, stats: stats});

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

        address lootManager = Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE));
        _mintItemDirect(lootManager, itemId, supply);
        _setTokenUri(itemId, itemMetadataURI);
        Items.set(itemId, newItem);
        return itemId;
    }

    function resupplyLootManager(uint256 itemId, uint256 newSupply) public {
        _requireAccessOrAdmin(address(this), _msgSender());
        if (TotalSupply.getTotalSupply(_totalSupplyTableId(ITEMS_NAMESPACE), itemId) == 0) revert NoSupply();
        address lootManager = Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE));
        _mintItemDirect(lootManager, itemId, newSupply);
    }

    function createItems(
        ItemType[] memory itemTypes,
        uint256[] memory supply,
        uint256[] memory dropChances,
        uint256[] memory prices,
        bytes[] memory stats,
        string[] memory itemMetadataURIs
    ) public {
        uint256 len = itemTypes.length;
        if (supply.length != len || itemMetadataURIs.length != len || stats.length != len) revert ArrayMismatch();
        for (uint256 i; i < len; i++) {
            createItem(itemTypes[i], supply[i], dropChances[i], prices[i], stats[i], itemMetadataURIs[i]);
        }
    }

    function setTokenUri(uint256 tokenId, string memory tokenUri) public {
        _requireOwner(address(this), _msgSender());
        _setTokenUri(tokenId, tokenUri);
    }

    function getCurrentItemsCounter() public view returns (uint256) {
        address itemsContract = UltimateDominionConfig.getItems();
        return Counters.getCounter(address(itemsContract), 0);
    }

    function _setTokenUri(uint256 tokenId, string memory tokenUri) internal {
        ERC1155URIStorage.setUri(_erc1155URIStorageTableId(ITEMS_NAMESPACE), tokenId, tokenUri);
    }

    function _incrementItemsCounter() internal returns (uint256) {
        address itemsContract = UltimateDominionConfig.getItems();
        uint256 itemsCounter = Counters.getCounter(address(itemsContract), 0) + 1;
        Counters.setCounter(itemsContract, 0, (itemsCounter));
        return itemsCounter;
    }

    function _mintItemDirect(address to, uint256 itemId, uint256 amount) internal {
        uint256 currentBalance = Owners.getBalance(_ownersTableId(ITEMS_NAMESPACE), to, itemId);
        Owners.setBalance(_ownersTableId(ITEMS_NAMESPACE), to, itemId, currentBalance + amount);
        uint256 currentSupply = TotalSupply.getTotalSupply(_totalSupplyTableId(ITEMS_NAMESPACE), itemId);
        TotalSupply.setTotalSupply(_totalSupplyTableId(ITEMS_NAMESPACE), itemId, currentSupply + amount);
    }
}
