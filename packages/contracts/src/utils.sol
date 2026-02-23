// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";
import {AccessControl} from "@latticexyz/world/src/AccessControl.sol";
import {WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";

bytes16 constant ERC20_SYSTEM_NAME = "ERC20System";
bytes16 constant ERC721_SYSTEM_NAME = "ERC721System";
bytes16 constant ERC1155_SYSTEM_NAME = "ERC1155System";
bytes16 constant CHARACTER_SYSTEM_NAME = "CharacterSystem";
bytes16 constant CHARACTER_CORE_NAME = "CharacterCore";
bytes16 constant RNG_SYSTEM_NAME = "RngSystem";
bytes16 constant ITEMS_SYSTEM_NAME = "ItemsSystem";
bytes16 constant SHOP_SYSTEM_NAME = "ShopSystem";
bytes16 constant MOB_SYSTEM_NAME = "MobSystem";
bytes16 constant MAP_SYSTEM_NAME = "MapSystem";
bytes16 constant LOOTMANAGER_SYSTEM_NAME = "LootManagerSyste";
bytes16 constant COMBAT_SYSTEM_NAME = "CombatSystem";

function _erc20SystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: ERC20_SYSTEM_NAME});
}

function _erc721SystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: ERC721_SYSTEM_NAME});
}

function _characterSystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: CHARACTER_SYSTEM_NAME});
}

function _characterCoreId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: CHARACTER_CORE_NAME});
}

function _erc1155SystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: ERC1155_SYSTEM_NAME});
}

function _itemsSystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: ITEMS_SYSTEM_NAME});
}

function _shopSystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: SHOP_SYSTEM_NAME});
}

function _mobSystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: MOB_SYSTEM_NAME});
}

function _mapSystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: MAP_SYSTEM_NAME});
}

function _lootManagerSystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: LOOTMANAGER_SYSTEM_NAME});
}

function _combatSystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: COMBAT_SYSTEM_NAME});
}

function _rngSystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: RNG_SYSTEM_NAME});
}

function _requireOwner(address requiredAddress, address sender) view {
    AccessControl.requireOwner(SystemRegistry.get(requiredAddress), sender);
}

function _requireAccess(address requiredAddress, address sender) view {
    AccessControl.requireAccess(SystemRegistry.get(requiredAddress), sender);
}

function _requireSystemAddress(ResourceId resourceId, address sender) view {
    AccessControl.requireAccess(resourceId, sender);
}

// Import Admin table for admin checks
import {Admin} from "@codegen/index.sol";

function _requireAccessOrAdmin(address requiredAddress, address sender) view {
    // Allow if sender is admin
    if (Admin.get(sender)) {
        return;
    }
    // Otherwise require namespace access
    AccessControl.requireAccess(SystemRegistry.get(requiredAddress), sender);
}

error NotAuthorizedCaller();

/// @dev Restricts to system-to-system IWorld calls (where _msgSender() == World address) or admin direct calls
function _requireSystemOrAdmin(address sender, address world) view {
    if (sender != world && !Admin.get(sender)) {
        revert NotAuthorizedCaller();
    }
}
