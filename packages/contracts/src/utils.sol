// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { ResourceId } from "@latticexyz/store/src/ResourceId.sol";
import { RESOURCE_TABLE } from "@latticexyz/store/src/storeResourceTypes.sol";

import { WorldResourceIdLib } from "@latticexyz/world/src/WorldResourceId.sol";
import { RESOURCE_SYSTEM } from "@latticexyz/world/src/worldResourceTypes.sol";

bytes16 constant ERC20_SYSTEM_NAME = "ERC20System";
bytes16 constant ERC721_SYSTEM_NAME = "ERC721System";
bytes16 constant CHARACTER_SYSTEM_NAME = "CharacterSystem";

function _erc20SystemId(bytes14 namespace) pure returns (ResourceId) {
  return WorldResourceIdLib.encode({ typeId: RESOURCE_SYSTEM, namespace: namespace, name: ERC20_SYSTEM_NAME });
}

function _erc721SystemId(bytes14 namespace) pure returns (ResourceId) {
  return WorldResourceIdLib.encode({ typeId: RESOURCE_SYSTEM, namespace: namespace, name: ERC721_SYSTEM_NAME });
}

function _characterSystemId(bytes14 namespace) pure returns (ResourceId) {
  return WorldResourceIdLib.encode({ typeId: RESOURCE_SYSTEM, namespace: namespace, name: CHARACTER_SYSTEM_NAME });
}
