// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {MobsByZoneLevel} from "@codegen/index.sol";
import {ZONE_WINDY_PEAKS} from "../../constants.sol";

/**
 * @title RemoveWardenFromSpawnPool
 * @notice Removes Korrath's Warden from MobsByZoneLevel[2][20] so it only spawns
 *         via ZoneBossConfig probabilistic boss spawning.
 *
 * Usage:
 *   forge script script/admin/RemoveWardenFromSpawnPool.s.sol \
 *     --sig "run(address,uint256)" <WORLD_ADDRESS> <WARDEN_MOB_ID> \
 *     --rpc-url <RPC> --broadcast --skip-simulation
 */
contract RemoveWardenFromSpawnPool is Script {
    function run(address worldAddress, uint256 wardenMobId) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        StoreSwitch.setStoreAddress(worldAddress);

        uint256 level = 20;

        console.log("=== RemoveWardenFromSpawnPool ===");
        console.log("Zone: Windy Peaks (%d)", ZONE_WINDY_PEAKS);
        console.log("Level:", level);
        console.log("Warden mobId:", wardenMobId);

        uint256[] memory mobs = MobsByZoneLevel.getMobIds(ZONE_WINDY_PEAKS, level);
        console.log("  Current pool size:", mobs.length);

        uint256 newLen;
        for (uint256 i; i < mobs.length; i++) {
            if (mobs[i] != wardenMobId) {
                mobs[newLen] = mobs[i];
                newLen++;
            }
        }

        if (newLen < mobs.length) {
            uint256[] memory trimmed = new uint256[](newLen);
            for (uint256 i; i < newLen; i++) {
                trimmed[i] = mobs[i];
            }
            MobsByZoneLevel.setMobIds(ZONE_WINDY_PEAKS, level, trimmed);
            console.log("  Removed Warden, remaining pool size:", newLen);
        } else {
            console.log("  Warden not found in pool, skipping");
        }

        vm.stopBroadcast();
        console.log("=== Done ===");
    }
}
