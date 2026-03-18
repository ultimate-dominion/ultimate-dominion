// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IBaseWorld} from "@latticexyz/world/src/codegen/interfaces/IBaseWorld.sol";
import {NamespaceOwner} from "@latticexyz/world/src/codegen/tables/NamespaceOwner.sol";
import {WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";

import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";

import {ERC1155Module} from "./ERC1155Module.sol";
import {MODULE_NAMESPACE_ID, ERC1155_REGISTRY_TABLE_ID} from "./constants.sol";
import {IERC1155} from "./IERC1155.sol";

import {ERC1155MetadataURI} from "./tables/ERC1155MetadataURI.sol";
import {ERC1155Registry} from "./tables/ERC1155Registry.sol";
import "forge-std/console2.sol";

/**
 * @notice Register a new ERC1155 token with the given metaDataURI in a given namespace
 * @dev This function must be called within a Store context (i.e. using StoreSwitch.setStoreAddress())
 */
function registerERC1155(IBaseWorld world, bytes14 namespace, string memory metaDataURI) returns (IERC1155 token) {
    // Get the ERC1155 module
    address owner = NamespaceOwner.get(MODULE_NAMESPACE_ID);
    ERC1155Module erc1155Module = ERC1155Module(owner);
    if (address(erc1155Module) == address(0)) {
        erc1155Module = new ERC1155Module();
    }

    // Install the ERC1155 module with the provided args
    world.installModule(erc1155Module, abi.encode(namespace, metaDataURI));

    // Return the newly created ERC1155 token
    token = IERC1155(
        ERC1155Registry.getTokenAddress(ERC1155_REGISTRY_TABLE_ID, WorldResourceIdLib.encodeNamespace(namespace))
    );
}
