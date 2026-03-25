// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {MobsByLevel, MobsByZoneLevel} from "@codegen/index.sol";
import {ZONE_DARK_CAVE} from "../../constants.sol";

/**
 * @title BackfillMobsByZoneLevel
 * @notice Copies existing MobsByLevel entries into MobsByZoneLevel for Zone 1 (Dark Cave).
 *         This is a one-time migration. After this, zone-loader handles new zones.
 *
 *         Usage: source .env.testnet && forge script script/admin/BackfillMobsByZoneLevel.s.sol \
 *                --sig "run(address)" $WORLD_ADDRESS --broadcast --rpc-url $RPC_URL --private-key $PRIVATE_KEY
 */
contract BackfillMobsByZoneLevel is Script {
    function run(address _worldAddress) external {
        vm.startBroadcast();
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Backfill MobsByZoneLevel for Dark Cave ===");
        console.log("World:", _worldAddress);

        uint256 totalMobs = 0;

        // Dark Cave monsters span levels 1-10
        for (uint256 level = 1; level <= 10; level++) {
            uint256[] memory mobIds = MobsByLevel.getMobIds(level);
            if (mobIds.length == 0) continue;

            // Check if already backfilled (idempotent)
            uint256 existing = MobsByZoneLevel.lengthMobIds(ZONE_DARK_CAVE, level);
            if (existing > 0) {
                console.log("  Level %d: already has %d mobs, skipping", level, existing);
                continue;
            }

            for (uint256 i = 0; i < mobIds.length; i++) {
                MobsByZoneLevel.pushMobIds(ZONE_DARK_CAVE, level, mobIds[i]);
                totalMobs++;
            }
            console.log("  Level %d: registered %d mobs", level, mobIds.length);
        }

        vm.stopBroadcast();
        console.log("=== Done: %d total mobs registered in zone %d ===", totalMobs, ZONE_DARK_CAVE);
    }
}
