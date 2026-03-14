// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {Items, ConsumableStats} from "@codegen/index.sol";
import {ItemType} from "@codegen/common.sol";

/**
 * @title SetDropRatesV4
 * @notice Updates all item drop rates + rarity promotions for the V4 drop table redesign.
 *
 * Rate changes (gear):
 *   R0 800bp, R1 500bp (unchanged)
 *   R2 200→10bp, R3 50/10→2bp, R4 new→1bp
 *
 * Rate changes (consumables):
 *   Basic healing 40bp, Stat buffs 20bp, Standard healing 40bp,
 *   Premium healing 10bp, Tradeoff buffs 8bp, PvP/Tactical 4bp
 *
 * Rarity promotions: Drake's Cowl R3→R4
 *   (Trollhide Cleaver, Phasefang, Drakescale Staff already R4 from V3)
 *
 * Usage:
 *   forge script script/admin/SetDropRatesV4.s.sol \
 *     --sig "run(address)" <WORLD_ADDRESS> \
 *     --rpc-url <RPC> --broadcast --skip-simulation
 */
contract SetDropRatesV4 is Script {
    function run(address worldAddress) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        StoreSwitch.setStoreAddress(worldAddress);

        uint256 totalItems = IWorld(worldAddress).UD__getCurrentItemsCounter();
        console.log("=== SetDropRatesV4 ===");
        console.log("Total items:", totalItems);

        uint256 updated;

        for (uint256 i = 1; i <= totalItems; i++) {
            uint256 drop = Items.getDropChance(i);
            uint256 rarity = Items.getRarity(i);
            ItemType iType = Items.getItemType(i);

            // --- Items with dropChance 0 (V3 additions, monster weapons) ---
            if (drop == 0) {
                if (rarity == 4) {
                    // V3 epics (Trollhide Cleaver, Phasefang, Drakescale Staff): give them a drop rate
                    Items.setDropChance(i, 1);
                    updated++;
                    console.log("  R4 epic activated, id:", i);
                } else if (rarity == 3 && iType == ItemType.Armor) {
                    // Drake's Cowl: promote R3->R4 and activate
                    Items.setRarity(i, 4);
                    Items.setDropChance(i, 1);
                    updated++;
                    console.log("  Drake's Cowl promoted to R4, id:", i);
                }
                // else: monster weapons / non-droppable, skip
                continue;
            }

            // --- Gear (Armor + Weapon) ---
            if (iType == ItemType.Armor || iType == ItemType.Weapon) {
                uint256 newDrop = drop;
                if (rarity == 2) newDrop = 10;
                else if (rarity == 3) newDrop = 2;
                // rarity 0 (800bp), rarity 1 (500bp): unchanged

                if (newDrop != drop) {
                    Items.setDropChance(i, newDrop);
                    updated++;
                    console.log("  Gear updated, id:", i);
                }
                continue;
            }

            // --- Consumables ---
            if (iType == ItemType.Consumable) {
                if (rarity == 0) continue; // Junk (Rat Tooth etc.), keep at 800bp

                uint256 price = Items.getPrice(i);
                uint256 newDrop = drop;

                // Categorize by price (in wei, 1 gold = 1 ether)
                if (price == 10 ether) {
                    newDrop = 40; // Minor Health Potion
                } else if (price == 15 ether) {
                    newDrop = 40; // Antidote
                } else if (price == 20 ether) {
                    newDrop = 20; // Stat buffs (Fortifying Stew, Quickening Berries, Focusing Tea)
                } else if (price == 25 ether) {
                    // Distinguish Health Potion (healing, negative damage) from tradeoff buffs
                    int256 minDmg = ConsumableStats.getMinDamage(i);
                    if (minDmg < 0) {
                        newDrop = 40; // Health Potion
                    } else {
                        newDrop = 8; // Bloodrage Tonic, Stoneskin Salve, Trollblood Ale
                    }
                } else if (price == 35 ether) {
                    newDrop = 4; // Venom Vial, Spore Cloud, Sapping Poison
                } else if (price == 50 ether) {
                    newDrop = 4; // Flashpowder
                } else if (price == 60 ether) {
                    newDrop = 10; // Greater Health Potion
                }

                if (newDrop != drop) {
                    Items.setDropChance(i, newDrop);
                    updated++;
                    console.log("  Consumable updated, id:", i);
                }
            }
        }

        vm.stopBroadcast();
        console.log("Updated", updated, "items");
        console.log("=== SetDropRatesV4 Complete ===");
    }
}
