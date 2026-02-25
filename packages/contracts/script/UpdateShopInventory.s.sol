// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";
import {ShopsData} from "@codegen/index.sol";

/**
 * @notice Update Grizzled Merchant shop inventory:
 *   - SELL: Uncommon gear (armor + weapons) + consumables
 *   - BUY: All of the above + starter gear (so players can sell starters back)
 *   - NO spells (removed from game)
 *   - NO starter gear for sale
 *
 * Usage:
 *   forge script script/UpdateShopInventory.s.sol --rpc-url <rpc> --broadcast
 */
contract UpdateShopInventory is Script {
    function run() external {
        address worldAddress = 0x83cda5E98B2fC5F5319775b8790ccc7bB46Adc7c;
        bytes32 shopEntityId = 0x0000000b00000000000000000000000000000000000000000000000100090009;

        // === Items the shop SELLS to players (uncommon gear + consumables) ===
        uint256[] memory sellableItems = new uint256[](14);
        uint256[] memory stock = new uint256[](14);
        uint256[] memory restock = new uint256[](14);

        // Consumables
        sellableItems[0] = 33; stock[0] = 20; restock[0] = 20;  // Minor Health Potion
        sellableItems[1] = 34; stock[1] = 10; restock[1] = 10;  // Health Potion
        sellableItems[2] = 35; stock[2] = 5;  restock[2] = 5;   // Greater Health Potion
        sellableItems[3] = 36; stock[3] = 10; restock[3] = 10;  // Fortifying Stew
        sellableItems[4] = 37; stock[4] = 10; restock[4] = 10;  // Quickening Berries
        sellableItems[5] = 38; stock[5] = 10; restock[5] = 10;  // Focusing Tea
        sellableItems[6] = 39; stock[6] = 15; restock[6] = 15;  // Antidote
        sellableItems[7] = 40; stock[7] = 5;  restock[7] = 5;   // Smoke Bomb

        // Uncommon Armor (rarity 1)
        sellableItems[8]  = 4;  stock[8]  = 3; restock[8]  = 3; // Padded Armor (STR)
        sellableItems[9]  = 5;  stock[9]  = 3; restock[9]  = 3; // Leather Jerkin (AGI)
        sellableItems[10] = 6;  stock[10] = 3; restock[10] = 3; // Apprentice Robes (INT)

        // Uncommon Weapons (rarity 1)
        sellableItems[11] = 16; stock[11] = 3; restock[11] = 3; // Iron Axe (STR)
        sellableItems[12] = 17; stock[12] = 3; restock[12] = 3; // Hunting Bow (AGI)
        sellableItems[13] = 18; stock[13] = 3; restock[13] = 3; // Apprentice Staff (INT)

        // === Items the shop BUYS from players (all sellable + starter gear) ===
        uint256[] memory buyableItems = new uint256[](20);

        // Same 14 items from sellable
        for (uint256 i = 0; i < 14; i++) {
            buyableItems[i] = sellableItems[i];
        }

        // Starter gear (buy only — shop doesn't sell these)
        buyableItems[14] = 1;  // Tattered Cloth
        buyableItems[15] = 2;  // Worn Leather Vest
        buyableItems[16] = 3;  // Rusty Chainmail
        buyableItems[17] = 13; // Broken Sword
        buyableItems[18] = 14; // Worn Shortbow
        buyableItems[19] = 15; // Cracked Wand

        ShopsData memory newShop = ShopsData({
            gold: 2000 ether,
            maxGold: 2000 ether,
            priceMarkup: 2000,     // 20% markup on buys
            priceMarkdown: 5000,   // 50% of base on sells
            restockTimestamp: 0,
            sellableItems: sellableItems,
            buyableItems: buyableItems,
            restock: restock,
            stock: stock
        });

        vm.startBroadcast();
        IWorld(worldAddress).UD__adminUpdateShop(shopEntityId, newShop);
        vm.stopBroadcast();

        console.log("Shop updated successfully!");
        console.log("Sellable items:", sellableItems.length);
        console.log("Buyable items:", buyableItems.length);
    }
}
