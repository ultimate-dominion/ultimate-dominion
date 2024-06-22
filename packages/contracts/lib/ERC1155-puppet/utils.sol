// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";

import {WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";

import {
    ERC1155_SYSTEM_NAME,
    TOTAL_SUPPLY_NAME,
    METADATA_NAME,
    ERC1155URISTORAGE_SYSTEM_NAME,
    OPERATOR_APPROVAL_NAME,
    OWNERS_NAME,
    TOKEN_URISTORAGE_NAME
} from "./constants.sol";
//solhint-disable

function _erc1155URIStorageTableId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_TABLE, namespace: namespace, name: TOKEN_URISTORAGE_NAME});
}

function _metadataTableId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_TABLE, namespace: namespace, name: METADATA_NAME});
}

function _operatorApprovalTableId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_TABLE, namespace: namespace, name: OPERATOR_APPROVAL_NAME});
}

function _ownersTableId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_TABLE, namespace: namespace, name: OWNERS_NAME});
}

function _totalSupplyTableId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_TABLE, namespace: namespace, name: TOTAL_SUPPLY_NAME});
}

function _erc1155SystemId(bytes14 namespace) pure returns (ResourceId) {
    return WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: ERC1155_SYSTEM_NAME});
}

function _erc1155URIStorageSystemId(bytes14 namespace) pure returns (ResourceId) {
    return
        WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: namespace, name: ERC1155URISTORAGE_SYSTEM_NAME});
}
