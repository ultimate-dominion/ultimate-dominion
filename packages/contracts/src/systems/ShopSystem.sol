// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";

import {
    Shops, UltimateDominionConfig
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
        (uint16 shopX, uint16 shopY) = IWorld(_world()).UD__getMobPosition(shopId);
        require(characterX == shopX && characterY == shopY, "Cannot buy from a shop from a distance");
        // check if the shop has enough stock
        uint256[] memory buyableItems = Shops.getBuyableItems(shopId);
        address items = UltimateDominionConfig.getItems();
        uint256[] memory stock = Shops.getStock(shopId);
        require(stock[itemIndex] > amount, "insufficient stock");
        // increase gold by [amount*price]
        // decrease stock by [amount]
        stock[itemIndex] = stock[itemIndex - amount];
        Shops.setStock(shopId, stock);
        Shops.setGold(shopId, amount * itemMarkup(shopId, itemIndex));
        // take [amount*price] of the users' gold
        IERC20(UltimateDominionConfig.getGoldToken()).transferFrom(_msgSender(), address(this), amount * itemMarkup(shopId, itemIndex));
        // // give [amount] items
        AccessControlLib.requireAccess(_lootManagerSystemId(WORLD_NAMESPACE), _msgSender());
        IERC1155System(UltimateDominionConfig.getItems()).transferFrom(address(this), _msgSender(), buyableItems[itemIndex], amount);
        
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
        require(Shops.getGold(shopId) >= amount * itemMarkdown(shopId, itemIndex), "Shop does not have enough gold");
        // increase stock by [amount]
        // decrease gold by [amount * price]
        uint256[] memory stock = Shops.getStock(shopId);
        stock[itemIndex] = stock[itemIndex + amount];
        Shops.setStock(shopId, stock);
        Shops.setGold(shopId, amount * itemMarkdown(shopId, itemIndex));
        // // take [amount] of the users' item
        uint256[] memory sellableItems = Shops.getSellableItems(shopId);

        AccessControlLib.requireAccess(_lootManagerSystemId(WORLD_NAMESPACE), _msgSender());
        IERC1155(UltimateDominionConfig.getItems()).safeTransferFrom(_msgSender(), address(this), sellableItems[itemIndex], amount, "");
        // give [amount*price] gold
        IERC20(UltimateDominionConfig.getGoldToken()).transfer( _msgSender(), amount * itemMarkdown(shopId, itemIndex));
    }

    /**
     * Resets the shop inventory after 12 hours
     * @param shopId the shop Id
     */
    function restock(bytes32 shopId) public nonReentrant {
        require(Shops.getTimestamp(shopId) + 12 hours < block.timestamp, "You must wait 12 hours to restock");
        uint256[] memory stock = Shops.getRestock(shopId);
        uint256 gold = Shops.getMaxGold(shopId);
        Shops.setStock(shopId, stock);
        Shops.setGold(shopId, gold);
        Shops.setTimestamp(shopId, block.timestamp);
    }

    /**
     * Gets the markup price of an item
     * @param shopId the shopId
     * @param itemIndex tbd
     */
    function itemMarkup(bytes32 shopId, uint256 itemIndex) public view returns (uint256){
        return 100 * Shops.getPriceMarkup(shopId) / 10000;
    }
    /**
     * Gets the markdown price of an item
     * @param shopId the shopId
     * @param itemIndex tbd
     */
    function itemMarkdown(bytes32 shopId, uint256 itemIndex) public view returns (uint256){
        return 100 * Shops.getPriceMarkdown(shopId)/ 10000;
    }
    function shopSystemAddress() external view returns (address){
        return address(this);
    }
}