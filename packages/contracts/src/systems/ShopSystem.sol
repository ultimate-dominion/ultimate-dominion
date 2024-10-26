// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";

import {
    Shops,
    ShopsData,
    ShopSale,
    ShopSaleData,
    Items,
    EncounterEntity,
    WorldEncounter,
    WorldEncounterData,
    UltimateDominionConfig
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {_lootManagerSystemId} from "../utils.sol";
import {WORLD_NAMESPACE} from "../../constants.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";
import {ShopSellTemps} from "@interfaces/Structs.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import "forge-std/console.sol";

contract ShopSystem is System, ReentrancyGuard {
    /**
     * Buys an item from the shop
     * @param amount amount of the item to buy
     * @param shopId the shopId
     * @param itemIndex the index of the item in the buyableItems array
     * @param characterId the id of the character buying
     */
    function buy(uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId) public {
        bytes32 encounterId = EncounterEntity.getEncounterId(characterId);
        WorldEncounterData memory worldData = WorldEncounter.get(encounterId);
        // check that player is in encounter with the shop
        require(
            encounterId != bytes32(0) && worldData.start != 0 && worldData.end == 0 && worldData.entity == shopId
                && worldData.character == characterId,
            "invalid shop encounter"
        );
        // check that the character is the player
        require(IWorld(_world()).UD__isValidOwner(characterId, _msgSender()), "Cannot buy an item for someone else");

        // check that the players position is the same as the shop's position
        // Tried "isAtPosition", did not pass tests
        (uint16 characterX, uint16 characterY) = IWorld(_world()).UD__getEntityPosition(characterId);
        require(
            IWorld(_world()).UD__isAtPosition(shopId, characterX, characterY) == true,
            "Cannot buy from a shop at a distance"
        );

        // check if the shop has enough stock
        uint256[] memory buyable = Shops.getBuyableItems(shopId);
        uint256[] memory stock = Shops.getStock(shopId);
        require(stock[itemIndex] >= amount, "insufficient stock");

        // decrease stock by [amount]
        stock[itemIndex] = stock[itemIndex] - amount;
        Shops.setStock(shopId, stock);

        uint256 price = amount * itemMarkup(shopId, buyable[itemIndex]);

        // increase gold by [amount*price]
        Shops.setGold(shopId, Shops.getGold(shopId) + price);

        // take [amount*price] of the users' gold
        IERC20(UltimateDominionConfig.getGoldToken()).transferFrom(_msgSender(), _lootManagerAddress(), price);

        // give [amount] items
        IWorld(_world()).UD__dropItem(characterId, buyable[itemIndex], amount);

        ShopSale.set(
            shopId,
            characterId, // customerId
            buyable[itemIndex], // itemId
            block.timestamp, // timestamp
            true, // buyer
            price
        );
    }

    /**
     * Sells an item to the shop
     * @param amount amount of the item to sell
     * @param shopId the shopId
     * @param itemIndex the index of the item in the sellableItems array
     * @param characterId the characterId of the character selling
     */
    function sell(uint256 amount, bytes32 shopId, uint256 itemIndex, bytes32 characterId) public {
        bytes32 encounterId = EncounterEntity.getEncounterId(characterId);
        WorldEncounterData memory worldData = WorldEncounter.get(encounterId);
        ShopSellTemps memory sellTemps;
        // check that player is in encounter with the shop
        require(
            encounterId != bytes32(0) && worldData.start != 0 && worldData.end == 0 && worldData.entity == shopId
                && worldData.character == characterId,
            "invalid shop encounter"
        );
        // check that the character is the player
        require(IWorld(_world()).UD__isValidOwner(characterId, _msgSender()), "Cannot sell an item for someone else");
        (uint16 characterX, uint16 characterY) = IWorld(_world()).UD__getEntityPosition(characterId);
        require(
            IWorld(_world()).UD__isAtPosition(shopId, characterX, characterY) == true,
            "Cannot sell to a shop at a distance"
        );

        // check if the shop has enough gold
        sellTemps.stock = Shops.getStock(shopId);
        sellTemps.sellable = Shops.getSellableItems(shopId);
        require(
            Shops.getGold(shopId) >= amount * itemMarkdown(shopId, sellTemps.sellable[itemIndex]),
            "Shop does not have enough gold"
        );

        // increase stock by [amount]
        // decrease gold by [amount * price]
        sellTemps.stock[itemIndex] = sellTemps.stock[itemIndex] + amount;
        Shops.setStock(shopId, sellTemps.stock);

        sellTemps.price = amount * itemMarkdown(shopId, sellTemps.sellable[itemIndex]);
        Shops.setGold(shopId, Shops.getGold(shopId) - sellTemps.price);

        // take [amount] of the users' item
        sellTemps.sellableItems = Shops.getSellableItems(shopId);
        IERC1155System(UltimateDominionConfig.getItems()).transferFrom(
            _msgSender(), _lootManagerAddress(), sellTemps.sellableItems[itemIndex], amount
        );

        // give [amount*price] gold
        IWorld(_world()).UD__dropGoldToPlayer(characterId, sellTemps.price);

        ShopSale.set(
            shopId,
            characterId, // customerId
            sellTemps.sellable[itemIndex], // itemId
            block.timestamp, // timestamp
            false, // buyer
            sellTemps.price
        );
    }

    function canRestock(bytes32 shopId) public view returns (bool) {
        uint256 lastRecordedIntervalTimestamp = Shops.getRestockTimestamp(shopId);
        if (lastRecordedIntervalTimestamp > block.timestamp) return false;
        if (block.timestamp - lastRecordedIntervalTimestamp >= 12 hours) {
            return true;
        }
    }

    /**
     * Resets the shop inventory after 12 hours
     * @param shopId the shop Id
     */
    function restock(bytes32 shopId) public returns (bool) {
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

    /**
     * @dev this is a function to end the encounter with the shop, this is sent by the player when they exit the shop.
     * @dev there is no createShopEncounter function.  to start the encounter use the createEncounter function in the
     * encounter system.
     * @param encounterId the encounter ID you wish to end (must be an encounter with the shop)
     */
    function endShopEncounter(bytes32 encounterId) public {
        bytes32 characterId = WorldEncounter.getCharacter(encounterId);
        require(
            IWorld(_world()).UD__isValidCharacterId(characterId)
                && IWorld(_world()).UD__isValidOwner(characterId, _msgSender()),
            "can only exit your own shop"
        );

        IWorld(_world()).UD__endEncounter(encounterId, 0, false);
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

    function _lootManagerAddress() internal view returns (address) {
        return Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE));
    }
}
