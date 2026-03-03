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
    AdventureEscrow,
    CharacterEquipment,
    Items
} from "@codegen/index.sol";
import {AdvancedClass, ItemType} from "@codegen/common.sol";
import {ERC1155Holder} from "@openzeppelin/token/ERC1155/utils/ERC1155Holder.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {_requireAccess, _requireSystemOrAdmin} from "../utils.sol";
import {ITEMS_NAMESPACE, GOLD_NAMESPACE} from "../../constants.sol";
import {Owners} from "@erc1155/tables/Owners.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {_ownersTableId, _totalSupplyTableId} from "@erc1155/utils.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {TotalSupply as ERC20TotalSupply} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/TotalSupply.sol";
import {_balancesTableId as _goldBalancesTableId, _totalSupplyTableId as _goldTotalSupplyTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {NotAtSpawn, InsufficientBalance} from "../Errors.sol";
import {PauseLib} from "../libraries/PauseLib.sol";

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

    function dropGoldToEscrow(bytes32 characterId, uint256 amount) public {
        _requireSystemOrAdmin(_msgSender());
        // Only update escrow balance - no minting needed since World has pre-minted gold supply
        // Actual gold transfer happens when player withdraws from escrow at spawn
        uint256 currentBalance = AdventureEscrow.get(characterId);
        AdventureEscrow.set(characterId, currentBalance + amount);
    }

    function dropGoldToPlayer(bytes32 characterId, uint256 amount) public {
        _requireSystemOrAdmin(_msgSender());
        // Mint gold directly to player (mint-on-demand model - no pre-minted supply needed)
        address recipient = IWorld(_world()).UD__getOwnerAddress(characterId);
        _mintGoldDirect(recipient, amount);
    }

    function transferGold(address player, uint256 amount) public {
        _requireSystemOrAdmin(_msgSender());
        // Mint gold directly to player (mint-on-demand model)
        _mintGoldDirect(player, amount);
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

    function depositToEscrow(bytes32 characterId, uint256 amount) public returns (uint256 _balance) {
        PauseLib.requireNotPaused();
        if (IWorld(_world()).UD__isValidOwner(characterId, _msgSender())) {
            if (!IWorld(_world()).UD__isAtPosition(characterId, 0, 0)) revert NotAtSpawn();
        } else {
            _requireAccess(address(this), _msgSender());
        }
        // Burn gold from player (escrow is virtual, actual gold burned on deposit)
        address player = IWorld(_world()).UD__getOwner(characterId);
        _burnGoldDirect(player, amount);
        _addEscrowBalance(characterId, amount);
    }

    function increaseEscrowBalance(bytes32 characterId, uint256 amount) public returns (uint256 newBalance) {
        _requireSystemOrAdmin(_msgSender());
        _addEscrowBalance(characterId, amount);
    }

    function _addEscrowBalance(bytes32 characterId, uint256 amount) internal {
        uint256 currentBalance = getEscrowBalance(characterId);
        uint256 balance = currentBalance + amount;
        AdventureEscrow.set(characterId, (balance));
    }

    function withdrawFromEscrow(bytes32 characterId, uint256 amount) public returns (uint256 _balance) {
        PauseLib.requireNotPaused();
        if (IWorld(_world()).UD__isValidOwner(characterId, _msgSender())) {
            if (!IWorld(_world()).UD__isAtPosition(characterId, 0, 0)) revert NotAtSpawn();
        } else {
            _requireAccess(address(this), _msgSender());
        }
        _withdrawEscrowBalance(characterId, amount);
        // Mint gold directly to player (escrow is virtual, actual gold minted on withdraw)
        _mintGoldDirect(IWorld(_world()).UD__getOwner(characterId), amount);
    }

    function _withdrawEscrowBalance(bytes32 characterId, uint256 amount) internal {
        uint256 currentBalance = getEscrowBalance(characterId);
        if (currentBalance < amount) revert InsufficientBalance();
        uint256 balance = currentBalance - amount;
        AdventureEscrow.set(characterId, (balance));
    }

    function getEscrowBalance(bytes32 characterId) public view returns (uint256 _balance) {
        return AdventureEscrow.get(characterId);
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
     * @dev Mint gold directly via table writes (mint-on-demand model)
     * No pre-minted supply needed - gold is created when players earn it
     */
    function _mintGoldDirect(address to, uint256 amount) internal {
        ResourceId balancesTableId = _goldBalancesTableId(GOLD_NAMESPACE);
        ResourceId totalSupplyTableId = _goldTotalSupplyTableId(GOLD_NAMESPACE);

        // Update recipient balance
        uint256 currentBalance = ERC20Balances.get(balancesTableId, to);
        ERC20Balances.set(balancesTableId, to, currentBalance + amount);

        // Update total supply
        uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
        ERC20TotalSupply.set(totalSupplyTableId, currentSupply + amount);
    }

    /**
     * @dev Burn gold directly via table writes
     * Used when gold exits circulation (deposits to escrow, future gold sinks)
     */
    function _burnGoldDirect(address from, uint256 amount) internal {
        ResourceId balancesTableId = _goldBalancesTableId(GOLD_NAMESPACE);
        ResourceId totalSupplyTableId = _goldTotalSupplyTableId(GOLD_NAMESPACE);

        // Update sender balance
        uint256 currentBalance = ERC20Balances.get(balancesTableId, from);
        if (currentBalance < amount) revert InsufficientBalance();
        ERC20Balances.set(balancesTableId, from, currentBalance - amount);

        // Update total supply
        uint256 currentSupply = ERC20TotalSupply.get(totalSupplyTableId);
        ERC20TotalSupply.set(totalSupplyTableId, currentSupply - amount);
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
