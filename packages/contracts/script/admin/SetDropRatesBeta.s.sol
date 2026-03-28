// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Items} from "@codegen/index.sol";
import {ItemType} from "@codegen/common.sol";

/**
 * @title SetDropRatesBeta
 * @notice Cranks up all drop rates for beta testing. DO NOT run on production.
 *
 * Beta rates (per 100,000):
 *   R0 80000 (80%)  — up from 8000
 *   R1 70000 (70%)  — up from 5000
 *   R2 60000 (60%)  — up from 10
 *   R3 55000 (55%)  — up from 2
 *   R4 50000 (50%)  — up from 1
 *
 * Consumables: 50000+ across the board
 *
 * Usage:
 *   FOUNDRY_PROFILE=script forge script script/admin/SetDropRatesBeta.s.sol \
 *     --sig "run(address,uint256)" 0xDc34AC3b06fa0ed899696A72B7706369864E5678 <TOTAL_ITEMS> \
 *     --rpc-url $RPC_URL --broadcast --skip-simulation
 */
contract SetDropRatesBeta is Script {
    function run(address worldAddress, uint256 totalItems) external {
        // Safety: refuse to run on production world
        require(
            worldAddress != 0x99d01939F58B965E6E84a1D167E710Abdf5764b0,
            "REFUSING TO RUN ON PRODUCTION WORLD"
        );

        StoreSwitch.setStoreAddress(worldAddress);
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        console.log("=== SetDropRatesBeta ===");
        console.log("Total items:", totalItems);

        uint256 updated;

        for (uint256 i = 1; i <= totalItems; i++) {
            uint256 drop = Items.getDropChance(i);
            uint256 rarity = Items.getRarity(i);
            ItemType iType = Items.getItemType(i);

            // Skip non-droppable items (monster weapons, etc.)
            if (drop == 0) continue;

            // --- Gear (Armor + Weapon) ---
            if (iType == ItemType.Armor || iType == ItemType.Weapon) {
                uint256 newDrop = drop;
                if (rarity == 0) newDrop = 80000;       // 80%
                else if (rarity == 1) newDrop = 70000;  // 70%
                else if (rarity == 2) newDrop = 60000;  // 60%
                else if (rarity == 3) newDrop = 55000;  // 55%
                else if (rarity == 4) newDrop = 50000;  // 50%

                if (newDrop != drop) {
                    Items.setDropChance(i, newDrop);
                    updated++;
                    console.log("  Gear boosted, id:", i, "rarity:", rarity);
                }
                continue;
            }

            // --- Consumables: 50% across the board ---
            if (iType == ItemType.Consumable) {
                uint256 newDrop = 50000; // 50%

                if (newDrop != drop) {
                    Items.setDropChance(i, newDrop);
                    updated++;
                    console.log("  Consumable boosted, id:", i);
                }
            }
        }

        vm.stopBroadcast();
        console.log("Updated", updated, "items");
        console.log("=== SetDropRatesBeta Complete ===");
    }
}
