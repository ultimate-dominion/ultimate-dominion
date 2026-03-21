// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {IWorld} from "@world/IWorld.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import {WorldContextConsumer} from "@latticexyz/world/src/WorldContext.sol";
import {
    UltimateDominionConfig,
    AdvancedClassItems,
    AdvancedClassItemsData,
    CharacterEquipment,
    Items
} from "@codegen/index.sol";
import {AdvancedClass, ItemType} from "@codegen/common.sol";
import {ERC1155Holder} from "@openzeppelin/token/ERC1155/utils/ERC1155Holder.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {_requireAccess, _requireSystemOrAdmin} from "../utils.sol";
import {ITEMS_NAMESPACE} from "../../constants.sol";
import {GoldLib} from "../libraries/GoldLib.sol";
import {Owners} from "@erc1155/tables/Owners.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {_ownersTableId, _totalSupplyTableId} from "@erc1155/utils.sol";
import {InsufficientBalance} from "../Errors.sol";

contract LootManagerSystem is ERC1155Holder, System {
    function supportsInterface(bytes4 interfaceId)
        public
        pure
        virtual
        override(ERC1155Holder, WorldContextConsumer)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    // all items and gold will be managed by this system.  ownership of both contracts will be on this system and permissions
    // distribute will be managed here.

    function _goldToken() internal view returns (IERC20Mintable goldToken) {
        goldToken = IERC20Mintable(UltimateDominionConfig.getGoldToken());
    }

    /**
     * @notice Issue class-specific items when a character selects their advanced class at level 10
     * @param characterId The character receiving the items
     * @param advancedClass The selected advanced class
     */
    function issueAdvancedClassItems(bytes32 characterId, AdvancedClass advancedClass) public {
        _requireSystemOrAdmin(_msgSender());
        // This function is called from CharacterSystem.selectAdvancedClass which validates ownership
        AdvancedClassItemsData memory classItems = AdvancedClassItems.get(advancedClass);

        // If no items configured for this class, skip
        if (classItems.itemIds.length == 0) {
            return;
        }

        address owner = IWorld(_world()).UD__getOwner(characterId);

        // Mint items directly via table writes (bypasses cross-namespace access issues)
        for (uint256 i; i < classItems.itemIds.length; i++) {
            _mintItemDirect(owner, classItems.itemIds[i], classItems.amounts[i]);
        }
    }

    function dropGoldToPlayer(bytes32 characterId, uint256 amount) public {
        _requireSystemOrAdmin(_msgSender());
        address recipient = IWorld(_world()).UD__getOwnerAddress(characterId);
        GoldLib.goldMint(_world(), recipient, amount);
    }

    function transferGold(address player, uint256 amount) public {
        _requireSystemOrAdmin(_msgSender());
        GoldLib.goldMint(_world(), player, amount);
    }

    function dropItem(bytes32 characterId, uint256 itemId, uint256 amount) public {
        _requireSystemOrAdmin(_msgSender());
        // Write directly to ERC1155 tables to bypass puppet authorization issues
        address to = IWorld(_world()).UD__getOwner(characterId);

        // Get table IDs for Items namespace
        bytes14 namespace = ITEMS_NAMESPACE;

        // Update recipient balance
        uint256 currentBalance = Owners.getBalance(_ownersTableId(namespace), to, itemId);
        Owners.setBalance(_ownersTableId(namespace), to, itemId, currentBalance + amount);

        // Update total supply
        uint256 currentSupply = TotalSupply.getTotalSupply(_totalSupplyTableId(namespace), itemId);
        TotalSupply.setTotalSupply(_totalSupplyTableId(namespace), itemId, currentSupply + amount);
    }

    function dropItems(bytes32[] memory characterIds, uint256[] memory itemIds, uint256[] memory amounts) public {
        _requireSystemOrAdmin(_msgSender());
        for (uint256 i; i < itemIds.length; i++) {
            dropItem(characterIds[i], itemIds[i], amounts[i]);
        }
    }

    function setGoldApproval(address spender, uint256 value) public {
        _requireAccess(address(this), _msgSender());
        _goldToken().approve(spender, value);
    }

    function setItemsApproval(address spender, bool approval) public {
        _requireAccess(address(this), _msgSender());
        IERC1155System(UltimateDominionConfig.getItems()).setApprovalForAll(spender, approval);
    }

    function consumeItem(bytes32 characterId, uint256 itemId) public {
        address playerAddr = IWorld(_world()).UD__getOwnerAddress(characterId);
        if (_msgSender() == playerAddr) {
            // consoom
        } else {
            _requireAccess(address(this), _msgSender());
        }

        // Burn the item directly via table writes (bypasses ERC1155 approval requirement)
        _burnItemDirect(playerAddr, itemId, 1);

        // Clean up stale equipped entry if balance hit 0
        uint256 remainingBalance = Owners.getBalance(_ownersTableId(ITEMS_NAMESPACE), playerAddr, itemId);
        if (remainingBalance == 0 && Items.getItemType(itemId) == ItemType.Consumable) {
            uint256[] memory equipped = CharacterEquipment.getEquippedConsumables(characterId);
            for (uint256 i = 0; i < equipped.length; i++) {
                if (equipped[i] == itemId) {
                    // Shift elements left and pop (same pattern as unequipItem)
                    for (uint256 j = i; j < equipped.length - 1; j++) {
                        equipped[j] = equipped[j + 1];
                    }
                    equipped[equipped.length - 1] = itemId;
                    CharacterEquipment.setEquippedConsumables(characterId, equipped);
                    CharacterEquipment.popEquippedConsumables(characterId);
                    break;
                }
            }
        }
    }

    /**
     * @dev Mint items directly via table writes (bypasses ERC1155System cross-namespace call issues)
     */
    function _mintItemDirect(address to, uint256 itemId, uint256 amount) internal {
        // Update owner balance
        uint256 currentBalance = Owners.getBalance(_ownersTableId(ITEMS_NAMESPACE), to, itemId);
        Owners.setBalance(_ownersTableId(ITEMS_NAMESPACE), to, itemId, currentBalance + amount);

        // Update total supply
        uint256 currentSupply = TotalSupply.getTotalSupply(_totalSupplyTableId(ITEMS_NAMESPACE), itemId);
        TotalSupply.setTotalSupply(_totalSupplyTableId(ITEMS_NAMESPACE), itemId, currentSupply + amount);
    }

    /**
     * @dev Burn items directly via table writes (bypasses ERC1155 approval requirement)
     * Used when consuming items - no approval needed since we're decrementing balance directly
     */
    function _burnItemDirect(address from, uint256 itemId, uint256 amount) internal {
        ResourceId ownersTableId = _ownersTableId(ITEMS_NAMESPACE);
        ResourceId totalSupplyTableId = _totalSupplyTableId(ITEMS_NAMESPACE);

        // Update owner balance
        uint256 currentBalance = Owners.getBalance(ownersTableId, from, itemId);
        if (currentBalance < amount) revert InsufficientBalance();
        Owners.setBalance(ownersTableId, from, itemId, currentBalance - amount);

        // Update total supply
        uint256 currentSupply = TotalSupply.getTotalSupply(totalSupplyTableId, itemId);
        TotalSupply.setTotalSupply(totalSupplyTableId, itemId, currentSupply - amount);
    }
}
