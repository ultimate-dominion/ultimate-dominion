// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";

import {
    Shops, Items, UltimateDominionConfig
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {TokenType, OrderStatus} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {_requireOwner, _requireAccess, _lootManagerSystemId} from "../utils.sol";
import {_erc1155SystemId, _erc20SystemId } from "../utils.sol";
import {ITEMS_NAMESPACE, WORLD_NAMESPACE, GOLD_NAMESPACE} from "../../constants.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { WorldContextConsumer } from "@latticexyz/world/src/WorldContext.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControlLib} from "@latticexyz/world-modules/src/utils/AccessControlLib.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";

contract ShopSystem is System, ReentrancyGuard {
    /**
     * Buys an item from the shop
     * @param amount amount of the item to buy
     * @param shopId the shopId
     * @param itemIndex the index of the item in the buyableItems array
     * @param characterId the id of the character buying
     */
    function buy(uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId) public nonReentrant {
        // check that the character is the player
        require(IWorld(_world()).UD__isValidOwner(characterId, _msgSender()), "Cannot buy an item for someone else");

        // check that the players position is the same as the shop's position
        (uint16 characterX, uint16 characterY)= IWorld(_world()).UD__getMobPosition(shopId);
        require(IWorld(_world()).UD__isAtPosition(shopId, characterX, characterY) == true, "Cannot buy from a shop at a distance");

        // check if the shop has enough stock
        uint256[] memory buyable = Shops.getBuyableItems(shopId);
        uint256[] memory stock = Shops.getStock(shopId);
        require(stock[itemIndex] > amount, "insufficient stock");

        // decrease stock by [amount]
        stock[itemIndex] = stock[itemIndex] - amount;
        Shops.setStock(shopId, stock);

        // increase gold by [amount*price]
        Shops.setGold(shopId, Shops.getGold(shopId) + (amount * itemMarkup(shopId, buyable[itemIndex])));

        // take [amount*price] of the users' gold
        IERC20(UltimateDominionConfig.getGoldToken()).transferFrom(_msgSender(), lootManagerAddress(), amount * itemMarkup(shopId, buyable[itemIndex]));

        // give [amount] items
        IWorld(_world()).UD__dropItem(characterId, buyable[itemIndex], amount);
    }

    /**
     * Sells an item to the shop
     * @param amount amount of the item to sell
     * @param shopId the shopId
     * @param itemIndex the index of the item in the sellableItems array
     * @param characterId the characterId of the character selling
     */
    function sell(uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId) public nonReentrant {
        // check that the character is the player
        require(IWorld(_world()).UD__isValidOwner(characterId, _msgSender()), "Cannot buy an item for someone else");

        // check that the players position is the same as the shop's position
        (uint16 characterX, uint16 characterY)= IWorld(_world()).UD__getMobPosition(shopId);
        (uint16 shopX, uint16 shopY) = IWorld(_world()).UD__getMobPosition(shopId);
        require(characterX == shopX && characterY == shopY, "Cannot buy from a shop from a distance");

        // check if the shop has enough gold
        uint256[] memory stock = Shops.getStock(shopId);
        uint256[] memory sellable = Shops.getSellableItems(shopId);
        require(Shops.getGold(shopId) >= amount * itemMarkdown(shopId, sellable[itemIndex]), "Shop does not have enough gold");

        // increase stock by [amount]
        // decrease gold by [amount * price]
        stock[itemIndex] = stock[itemIndex + amount];
        Shops.setStock(shopId, stock);
        Shops.setGold(shopId, Shops.getGold(shopId) - (amount * itemMarkdown(shopId, sellable[itemIndex])));

        // // take [amount] of the users' item
        uint256[] memory sellableItems = Shops.getSellableItems(shopId);
        IERC1155(UltimateDominionConfig.getItems()).safeTransferFrom(_msgSender(), lootManagerAddress(), sellableItems[itemIndex], amount, "");

        // give [amount*price] gold
        IWorld(_world()).UD__dropGold(characterId, amount * itemMarkdown(shopId, sellable[itemIndex]));
    }

    /**
     * Resets the shop inventory after 12 hours
     * @param shopId the shop Id
     */
    function restock(bytes32 shopId) public {
        require(canRestock(shopId), "You must wait 12 hours to restock");

        uint256[] memory stock = Shops.getRestock(shopId);
        uint256 gold = Shops.getMaxGold(shopId);

        Shops.setStock(shopId, stock);
        Shops.setGold(shopId, gold);
        Shops.setRestockTimestamp(shopId, block.timestamp);
    }

    function canRestock(bytes32 shopId) public view returns(bool) {
        uint256 lastRecordedIntervalTimestamp = Shops.getRestockTimestamp(shopId);
        uint256 timeSinceLastInterval = (block.timestamp - lastRecordedIntervalTimestamp) % 12 hours;
        uint256 lastIntervalTimestamp = block.timestamp - timeSinceLastInterval;
        return lastIntervalTimestamp >= 12 hours;
    }

    function itemStock(bytes32 shopId, uint256 itemIndex) public view returns(uint256) {
        return Shops.getStock(shopId)[itemIndex];
    }

    function itemBase(uint256 itemId) public view returns (uint256){
        return Items.getPrice(itemId);
    }
    /**
     * Gets the markup price of an item
     * @param shopId the shopId
     */
    function itemMarkup(bytes32 shopId, uint256 itemId) public view returns (uint256){
        return itemBase(itemId) + ((itemBase(itemId) * Shops.getPriceMarkup(shopId)) / 10000);
    }

    /**
     * Gets the markdown price of an item
     * @param shopId the shopId
     */
    function itemMarkdown(bytes32 shopId, uint256 itemId) public view returns (uint256){
        return (itemBase(itemId) * Shops.getPriceMarkdown(shopId))/ 10000;
    }

    function shopSystemAddress() external view returns (address){
        return address(this);
    }

    function lootManagerAddress() internal view returns (address){
        return Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE));
    }
}
