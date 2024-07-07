// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";
import {AccessControlLib} from "@latticexyz/world-modules/src/utils/AccessControlLib.sol";
import {WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";

bytes16 constant ERC20_SYSTEM_NAME = "ERC20System";
bytes16 constant ERC721_SYSTEM_NAME = "ERC721System";
bytes16 constant ERC1155_SYSTEM_NAME = "ERC1155System";
bytes16 constant CHARACTER_SYSTEM_NAME = "CharacterSystem";
bytes16 constant ITEMS_SYSTEM_NAME = "ItemsSystem";
bytes16 constant MOB_SYSTEM_NAME = "MobSystem";
bytes16 constant MAP_SYSTEM_NAME = "MapSystem";

function _erc20SystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: ERC20_SYSTEM_NAME});
}

function _erc721SystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: ERC721_SYSTEM_NAME});
}

function _characterSystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: CHARACTER_SYSTEM_NAME});
}

function _erc1155SystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: ERC1155_SYSTEM_NAME});
}

function _itemsSystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: ITEMS_SYSTEM_NAME});
}

function _mobSystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: MOB_SYSTEM_NAME});
}

function _mapSystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: MAP_SYSTEM_NAME});
}

function _requireOwner(address callingSystem, address sender) view {
    AccessControlLib.requireOwner(SystemRegistry.get(callingSystem), sender);
}

function _requireAccess(address callingSystem, address sender) view {
    AccessControlLib.requireAccess(SystemRegistry.get(callingSystem), sender);
}
