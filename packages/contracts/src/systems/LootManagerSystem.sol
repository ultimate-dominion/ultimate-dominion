// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {IERC20System} from "@latticexyz/world-modules/src/interfaces/IERC20System.sol";
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
    CharacterEquipmentData
} from "@codegen/index.sol";
import {ItemType, Classes} from "@codegen/common.sol";
import {AccessControlLib} from "@latticexyz/world-modules/src/utils/AccessControlLib.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import {
    _erc1155SystemId,
    _characterSystemId,
    _requireOwner,
    _requireAccess,
    _requireAccess,
    _lootManagerSystemId
} from "../utils.sol";
import {ITEMS_NAMESPACE, WORLD_NAMESPACE} from "../../constants.sol";
import {WeaponStats, ArmorStats} from "@interfaces/Structs.sol";
import {
    _metadataTableId,
    _erc1155URIStorageTableId,
    _totalSupplyTableId,
    _operatorApprovalTableId,
    _ownersTableId
} from "@erc1155/utils.sol";
import "forge-std/console2.sol";

contract LootManagerSystem is System {
    // all items and gold will be managed by this system.  ownership of both contracts will be on this system and permissions
    // distribute will be managed here.

    function _goldToken() internal view returns (IERC20System goldToken) {
        goldToken = IERC20System(UltimateDominionConfig.getGoldToken());
    }

    function issueStarterItems(bytes32 characterId) public {
        require(_msgSender() == Systems.getSystem(_characterSystemId(WORLD_NAMESPACE)), "ITEMS: Invalid System");
        StarterItemsData memory starterItems = IWorld(_world()).UD__getStarterItems(Stats.getClass(characterId));

        address owner = IWorld(_world()).UD__getOwner(characterId);

        for (uint256 i; i < starterItems.itemIds.length; i++) {
            IERC1155System(UltimateDominionConfig.getItems()).safeTransferFrom(
                address(this), owner, starterItems.itemIds[i], starterItems.amounts[i], ""
            );
        }
    }

    function dropGold(bytes32 characterId, uint256 amount) public {
        AccessControlLib.requireAccess(_lootManagerSystemId(WORLD_NAMESPACE), _msgSender());
        _goldToken().mint(IWorld(_world()).UD__getOwner(characterId), amount);
    }

    function dropItem(uint256 itemId, uint256 amount, bytes32 characterId) public {
        AccessControlLib.requireAccess(_lootManagerSystemId(WORLD_NAMESPACE), _msgSender());
        address to = IWorld(_world()).UD__getOwner(characterId);
        IERC1155System(UltimateDominionConfig.getItems()).transferFrom(address(this), to, itemId, amount);
    }

    function dropItems(uint256[] memory itemIds, uint256[] memory amounts, bytes32[] memory characterIds) public {
        for (uint256 i; i < itemIds.length; i++) {
            dropItem(itemIds[i], amounts[i], characterIds[i]);
        }
    }
}
