// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";
import {RESOURCE_SYSTEM, RESOURCE_NAMESPACE} from "@latticexyz/world/src/worldResourceTypes.sol";

bytes14 constant MODULE_NAMESPACE = "erc1155puppet";
ResourceId constant MODULE_NAMESPACE_ID =
    ResourceId.wrap(bytes32(abi.encodePacked(RESOURCE_NAMESPACE, MODULE_NAMESPACE)));
bytes16 constant TOKEN_APPROVALSTORAGE_NAME = "ApprovalStorage";
bytes16 constant TOKEN_URISTORAGE_NAME = "URIStorage";
bytes16 constant METADATA_NAME = "MetadataURI";
bytes16 constant OPERATOR_APPROVAL_NAME = "OperatorApproval";
bytes16 constant OWNERS_NAME = "Owners";
bytes16 constant TOTAL_SUPPLY_NAME = "TotalSupply";

bytes16 constant ERC1155_SYSTEM_NAME = "ERC1155System";
bytes16 constant ERC1155URISTORAGE_SYSTEM_NAME = "URIStorageSystem";

ResourceId constant ERC1155_REGISTRY_TABLE_ID =
    ResourceId.wrap(bytes32(abi.encodePacked(RESOURCE_TABLE, MODULE_NAMESPACE, bytes16("ERC1155Registry"))));
