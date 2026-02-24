// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import {
    UltimateDominionConfig,
    Items,
    ItemsData,
    StarterItems,
    StarterItemsData,
    StarterItemPool,
    StarterConsumables,
    Stats,
    StatsData,
    ArmorStats,
    ArmorStatsData,
    WeaponStats,
    WeaponStatsData,
    ConsumableStats,
    ConsumableStatsData
} from "@codegen/index.sol";
import {ItemType, Classes} from "@codegen/common.sol";
import {_requireOwner} from "../utils.sol";
import {ITEMS_NAMESPACE} from "../../constants.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {Owners} from "@erc1155/tables/Owners.sol";
import {_totalSupplyTableId, _ownersTableId} from "@erc1155/utils.sol";
import {ArrayMismatch, NotWeapon, NotArmor, NotConsumable} from "../Errors.sol";

contract ItemsSystem is System {
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

    function getItemType(uint256 itemId) public view returns (ItemType) {
        ItemsData memory itemData = Items.get(itemId);
        return itemData.itemType;
    }

    function setStarterItems(Classes class, uint256[] memory itemIds, uint256[] memory amounts) public {
        _requireOwner(address(this), _msgSender());
        if (itemIds.length != amounts.length) revert ArrayMismatch();
        StarterItems.set(class, itemIds, amounts);
    }

    function setStarterItemPool(uint256 itemId, bool isStarter) public {
        _requireOwner(address(this), _msgSender());
        StarterItemPool.set(itemId, isStarter);
    }

    function setStarterConsumables(uint256[] memory itemIds, uint256[] memory amounts) public {
        _requireOwner(address(this), _msgSender());
        if (itemIds.length != amounts.length) revert ArrayMismatch();
        StarterConsumables.set(itemIds, amounts);
    }

    function getStarterConsumables() public view returns (uint256[] memory itemIds, uint256[] memory amounts) {
        itemIds = StarterConsumables.getItemIds();
        amounts = StarterConsumables.getAmounts();
    }

    function isStarterItem(uint256 itemId) public view returns (bool) {
        return StarterItemPool.getIsStarter(itemId);
    }

    function isItemOwner(uint256 itemId, address account) public view returns (bool) {
        return Owners.getBalance(_ownersTableId(ITEMS_NAMESPACE), account, itemId) > 0;
    }

    function _items() internal view returns (IERC1155System items) {
        items = IERC1155System(UltimateDominionConfig.getItems());
    }

    function getWeaponStats(uint256 itemId) public view returns (WeaponStatsData memory _weaponStats) {
        ItemType itemType = Items.getItemType(itemId);
        if (itemType != ItemType.Weapon) revert NotWeapon();
        _weaponStats = WeaponStats.get(itemId);
    }

    function getArmorStats(uint256 itemId) public view returns (ArmorStatsData memory _ArmorStats) {
        ItemType itemType = Items.getItemType(itemId);
        if (itemType != ItemType.Armor) revert NotArmor();
        _ArmorStats = ArmorStats.get(itemId);
    }

    function getConsumableStats(uint256 itemId) public view returns (ConsumableStatsData memory _consumableStats) {
        ItemType itemType = Items.getItemType(itemId);
        if (itemType != ItemType.Consumable) revert NotConsumable();
        _consumableStats = ConsumableStats.get(itemId);
    }
}
