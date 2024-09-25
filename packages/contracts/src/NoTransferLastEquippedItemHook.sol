// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {SystemHook} from "@latticexyz/world/src/SystemHook.sol";
import {IWorld} from "@world/IWorld.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import "forge-std/console.sol";

contract NoTransferLastEquippedItemHook is SystemHook {
    address worldAddress;
    bytes4 constant transferFromSelector = IERC1155System.transferFrom.selector; //bytes4(keccak256("transferFrom(address,address,uint256,uint256,bytes)"));
    bytes4 constant safeTransferFromSelectorWBytes =
        bytes4(keccak256("safeTransferFrom(address,address,uint256,uint256,bytes)"));
    bytes4 constant safeTransferFromSelector = bytes4(keccak256("safeTransferFrom(address,address,uint256,uint256)"));
    bytes4 constant safeBatchTransferSelector =
        bytes4(keccak256("safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)"));

    constructor(address _world) {
        worldAddress = _world;
    }

    function onBeforeCallSystem(address, ResourceId, bytes calldata callData) public view {
        bytes4 selector = bytes4(callData);
        if (selector == safeTransferFromSelectorWBytes) {
            (address from, address to, uint256 tokenId, uint256 amount, bytes memory _bytes) =
                abi.decode(callData[4:], (address, address, uint256, uint256, bytes));

            bytes32 characterId = IWorld(worldAddress).UD__getCharacterIdFromOwnerAddress(from);

            if (IWorld(worldAddress).UD__isEquipped(characterId, tokenId)) {
                uint256 balance = IERC1155System(IWorld(worldAddress).UD__getItemsContract()).balanceOf(from, tokenId);
                require(balance - amount >= 1, "Transfer Bytes: Must Unequip item to transfer.");
            }
        } else if (selector == transferFromSelector || selector == safeTransferFromSelector) {
            //safe transfer check

            (address from, address to, uint256 tokenId, uint256 amount) =
                abi.decode(callData[4:], (address, address, uint256, uint256));
            bytes32 characterId = IWorld(worldAddress).UD__getCharacterIdFromOwnerAddress(from);

            if (IWorld(worldAddress).UD__isEquipped(characterId, tokenId)) {
                uint256 balance = IERC1155System(IWorld(worldAddress).UD__getItemsContract()).balanceOf(from, tokenId);
                require(balance - amount >= 1, "Transfer: Must Unequip item to transfer.");
            }
        } else if (selector == safeBatchTransferSelector) {
            // batch transfer check

            (address from, address to, uint256[] memory tokenId, uint256[] memory amount) =
                abi.decode(callData[4:], (address, address, uint256[], uint256[]));
            bytes32 characterId = IWorld(worldAddress).UD__getCharacterIdFromOwnerAddress(from);
            for (uint256 i; i < tokenId.length; i++) {
                if (IWorld(worldAddress).UD__isEquipped(characterId, tokenId[i])) {
                    uint256 balance =
                        IERC1155System(IWorld(worldAddress).UD__getItemsContract()).balanceOf(from, tokenId[i]);
                    require(balance - amount[i] >= 1, "Batch: Must Unequip item to transfer.");
                }
            }
        }
    }

    function onAfterCallSystem(address, ResourceId, bytes memory) public {}
}
