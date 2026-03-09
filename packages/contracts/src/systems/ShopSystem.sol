// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";
import {WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";

import {
    Characters,
    Shops,
    ShopsData,
    ShopSale,
    Items,
    EncounterEntity,
    WorldEncounter,
    WorldEncounterData,
    UltimateDominionConfig
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {_lootManagerSystemId} from "../utils.sol";
import {WORLD_NAMESPACE, CHARACTERS_NAMESPACE, ITEMS_NAMESPACE, GOLD_NAMESPACE, TAL_SHOP_X, TAL_SHOP_Y} from "../../constants.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {_balancesTableId as _goldBalancesTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {Position} from "@codegen/index.sol";
import {ShopSellTemps} from "@interfaces/Structs.sol";
import {ReentrancyGuard} from "@openzeppelin/utils/ReentrancyGuard.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {Owners as ERC1155Owners} from "@erc1155/tables/Owners.sol";
import {_ownersTableId} from "@erc1155/utils.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IFragmentSystem} from "@world/IFragmentSystem.sol";
import {
    InvalidShopEncounter,
    Unauthorized,
    NotAtShopPosition,
    OutOfStock,
    InsufficientItemBalance,
    ShopInsufficientGold,
    NotOwnShopEncounter,
    InvalidEncounter
} from "../Errors.sol";

contract ShopSystem is System, ReentrancyGuard {
    function _validateShopEncounter(bytes32 characterId, bytes32 shopId) internal view {
        bytes32 encounterId = EncounterEntity.getEncounterId(characterId);
        WorldEncounterData memory worldData = WorldEncounter.get(encounterId);
        if (
            encounterId == bytes32(0) || worldData.start == 0 || worldData.end != 0
                || worldData.entity != shopId || worldData.character != characterId
        ) revert InvalidShopEncounter();
        if (!IWorld(_world()).UD__isValidOwner(characterId, _msgSender())) revert Unauthorized();
        (uint16 characterX, uint16 characterY) = IWorld(_world()).UD__getEntityPosition(characterId);
        if (!IWorld(_world()).UD__isAtPosition(shopId, characterX, characterY)) revert NotAtShopPosition();
    }

    function buy(uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId) public nonReentrant {
        PauseLib.requireNotPaused();
        _validateShopEncounter(characterId, shopId);

        uint256[] memory buyable = Shops.getBuyableItems(shopId);
        uint256[] memory stock = Shops.getStock(shopId);
        if (stock[itemIndex] < amount) revert OutOfStock();

        stock[itemIndex] = stock[itemIndex] - amount;
        Shops.setStock(shopId, stock);

        uint256 price = amount * itemMarkup(shopId, buyable[itemIndex]);

        Shops.setGold(shopId, Shops.getGold(shopId) + price);

        // Gold goes to loot manager as shop reserve (sells draw from this pool)
        // Direct table write (bypasses ERC20 puppet) — allows Gold to be non-transferable via puppet
        address lootManager = _lootManagerAddress();
        ResourceId goldTableId = _goldBalancesTableId(GOLD_NAMESPACE);
        uint256 buyerGold = ERC20Balances.get(goldTableId, _msgSender());
        require(buyerGold >= price, "Insufficient gold");
        ERC20Balances.set(goldTableId, _msgSender(), buyerGold - price);
        ERC20Balances.set(goldTableId, lootManager, ERC20Balances.get(goldTableId, lootManager) + price);

        IWorld(_world()).UD__dropItem(characterId, buyable[itemIndex], amount);

        ShopSale.set(
            shopId,
            characterId,
            buyable[itemIndex],
            block.timestamp,
            true,
            price
        );
    }

    function sell(uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId) public nonReentrant {
        PauseLib.requireNotPaused();
        _validateShopEncounter(characterId, shopId);

        ShopSellTemps memory sellTemps;
        sellTemps.stock = Shops.getStock(shopId);
        sellTemps.sellable = Shops.getSellableItems(shopId);
        if (Shops.getGold(shopId) < amount * itemMarkdown(shopId, sellTemps.sellable[itemIndex])) {
            revert ShopInsufficientGold();
        }

        sellTemps.stock[itemIndex] = sellTemps.stock[itemIndex] + amount;
        Shops.setStock(shopId, sellTemps.stock);

        sellTemps.price = amount * itemMarkdown(shopId, sellTemps.sellable[itemIndex]);
        Shops.setGold(shopId, Shops.getGold(shopId) - sellTemps.price);

        // Transfer item: write directly to ERC1155 tables to bypass puppet authorization issues
        sellTemps.sellableItems = Shops.getSellableItems(shopId);
        {
            address seller = _msgSender();
            address lootManager = _lootManagerAddress();
            uint256 itemId = sellTemps.sellableItems[itemIndex];
            bytes14 ns = ITEMS_NAMESPACE;

            uint256 sellerBalance = ERC1155Owners.getBalance(_ownersTableId(ns), seller, itemId);
            if (sellerBalance < amount) revert InsufficientItemBalance();
            ERC1155Owners.setBalance(_ownersTableId(ns), seller, itemId, sellerBalance - amount);

            uint256 lmBalance = ERC1155Owners.getBalance(_ownersTableId(ns), lootManager, itemId);
            ERC1155Owners.setBalance(_ownersTableId(ns), lootManager, itemId, lmBalance + amount);
        }

        // Transfer gold from loot manager reserve (no minting)
        _transferGoldFromReserve(Characters.getOwner(characterId), sellTemps.price);

        ShopSale.set(
            shopId,
            characterId,
            sellTemps.sellable[itemIndex],
            block.timestamp,
            false,
            sellTemps.price
        );
    }

    /// @notice Sell any item to the shop by itemId (no sellable list restriction)
    function sellAny(uint256 amount, bytes32 shopId, uint256 itemId, bytes32 characterId) public nonReentrant {
        PauseLib.requireNotPaused();
        _validateShopEncounter(characterId, shopId);

        uint256 price = amount * itemMarkdown(shopId, itemId);
        if (Shops.getGold(shopId) < price) {
            revert ShopInsufficientGold();
        }

        Shops.setGold(shopId, Shops.getGold(shopId) - price);

        {
            address seller = _msgSender();
            address lootManager = _lootManagerAddress();
            bytes14 ns = ITEMS_NAMESPACE;

            uint256 sellerBalance = ERC1155Owners.getBalance(_ownersTableId(ns), seller, itemId);
            if (sellerBalance < amount) revert InsufficientItemBalance();
            ERC1155Owners.setBalance(_ownersTableId(ns), seller, itemId, sellerBalance - amount);

            uint256 lmBalance = ERC1155Owners.getBalance(_ownersTableId(ns), lootManager, itemId);
            ERC1155Owners.setBalance(_ownersTableId(ns), lootManager, itemId, lmBalance + amount);
        }

        // Transfer gold from loot manager reserve (no minting)
        _transferGoldFromReserve(Characters.getOwner(characterId), price);

        ShopSale.set(shopId, characterId, itemId, block.timestamp, false, price);
    }

    function canRestock(bytes32 shopId) public view returns (bool) {
        uint256 lastRecordedIntervalTimestamp = Shops.getRestockTimestamp(shopId);
        if (lastRecordedIntervalTimestamp > block.timestamp) return false;
        if (block.timestamp - lastRecordedIntervalTimestamp >= 12 hours) {
            return true;
        }
    }

    function restock(bytes32 shopId) public returns (bool) {
        PauseLib.requireNotPaused();
        if (canRestock(shopId)) {
            uint256 lastRecordedIntervalTimestamp = Shops.getRestockTimestamp(shopId);
            uint256 timeSinceLastInterval = (block.timestamp - lastRecordedIntervalTimestamp) % 12 hours;
            uint256 lastIntervalTimestamp = block.timestamp - timeSinceLastInterval;
            Shops.setRestockTimestamp(shopId, lastIntervalTimestamp + 12 hours);
            uint256[] memory stock = Shops.getRestock(shopId);
            uint256 gold = Shops.getMaxGold(shopId);
            Shops.setStock(shopId, stock);
            Shops.setGold(shopId, gold);
            return true;
        }
        return false;
    }

    function endShopEncounter(bytes32 encounterId) public {
        PauseLib.requireNotPaused();
        bytes32 characterId = WorldEncounter.getCharacter(encounterId);
        if (!_isValidCharacterId(characterId) || Characters.getOwner(characterId) != _msgSender()) {
            revert NotOwnShopEncounter();
        }

        // Fragment II: The Quartermaster - talk to Tal at (9,9)
        bytes32 shopEntityId = WorldEncounter.getEntity(encounterId);
        (uint16 shopX, uint16 shopY) = Position.get(shopEntityId);
        if (shopX == TAL_SHOP_X && shopY == TAL_SHOP_Y) {
            SystemSwitch.call(
                abi.encodeCall(IFragmentSystem.UD__triggerFragment, (characterId, 2, shopX, shopY))
            );
        }

        // Inline _endWorldEncounter logic to avoid cross-system IWorld call
        WorldEncounterData memory encounterData = WorldEncounter.get(encounterId);
        if (encounterData.end != 0 || encounterData.start == 0) revert InvalidEncounter();
        encounterData.end = block.timestamp;
        EncounterEntity.setEncounterId(encounterData.character, bytes32(0));
        WorldEncounter.set(encounterId, encounterData);
    }

    function itemStock(bytes32 shopId, uint256 itemIndex) external view returns (uint256) {
        return Shops.getStock(shopId)[itemIndex];
    }

    function itemBase(uint256 itemId) public view returns (uint256) {
        return Items.getPrice(itemId);
    }
    /**
     * Gets the markup price of an item
     * @param shopId the shopId
     */

    function itemMarkup(bytes32 shopId, uint256 itemId) public view returns (uint256) {
        return itemBase(itemId) + ((itemBase(itemId) * Shops.getPriceMarkup(shopId)) / 10_000);
    }

    /**
     * Gets the markdown price of an item
     * @param shopId the shopId
     */
    function itemMarkdown(bytes32 shopId, uint256 itemId) public view returns (uint256) {
        return (itemBase(itemId) * Shops.getPriceMarkdown(shopId)) / 10_000;
    }

    function isShop(bytes32 shopId) public view returns (bool) {
        ShopsData memory shopData = Shops.get(shopId);
        return (shopData.maxGold != 0 && shopData.stock.length != 0);
    }

    function shopSystemAddress() external view returns (address) {
        return address(this);
    }

    /// @dev Transfer gold from loot manager reserve to player (no minting, no supply change)
    function _transferGoldFromReserve(address to, uint256 amount) internal {
        address lootManager = _lootManagerAddress();
        ResourceId balancesTableId = _goldBalancesTableId(GOLD_NAMESPACE);

        uint256 reserveBalance = ERC20Balances.get(balancesTableId, lootManager);
        if (reserveBalance < amount) revert ShopInsufficientGold();
        ERC20Balances.set(balancesTableId, lootManager, reserveBalance - amount);

        uint256 playerBalance = ERC20Balances.get(balancesTableId, to);
        ERC20Balances.set(balancesTableId, to, playerBalance + amount);
    }

    function _lootManagerAddress() internal view returns (address) {
        return Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE));
    }

    function _isValidCharacterId(bytes32 characterId) private view returns (bool) {
        address ownerAddress = address(uint160(uint256(characterId) >> 96));
        uint256 tokenId = uint256(uint96(uint256(characterId)));
        return ERC721Owners.get(_charsOwnersTableId(), tokenId) == ownerAddress;
    }

    function _charsOwnersTableId() private pure returns (ResourceId) {
        return WorldResourceIdLib.encode(RESOURCE_TABLE, CHARACTERS_NAMESPACE, "Owners");
    }
}
