// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {BossSpawnConfig, MobsByLevel} from "@codegen/index.sol";

/**
 * @title ConfigureBossSpawn
 * @notice Removes Basilisk from MobsByLevel[10] (so it no longer spawns via normal map spawn)
 *         and sets BossSpawnConfig for probabilistic boss spawning on tile entry.
 *
 * Config: bossMobId=11, spawnChanceBp=2 (~1.3 spawns/day at 10 concurrent players)
 *
 * Usage:
 *   forge script script/admin/ConfigureBossSpawn.s.sol \
 *     --sig "run(address,uint256)" <WORLD_ADDRESS> <BASILISK_MOB_ID> \
 *     --rpc-url <RPC> --broadcast --skip-simulation
 */
contract ConfigureBossSpawn is Script {
    function run(address worldAddress, uint256 basiliskMobId) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        StoreSwitch.setStoreAddress(worldAddress);

        console.log("=== ConfigureBossSpawn ===");
        console.log("Basilisk mobId:", basiliskMobId);

        // Remove Basilisk from MobsByLevel[10]
        uint256[] memory level10Mobs = MobsByLevel.getMobIds(10);
        uint256 newLen;
        for (uint256 i; i < level10Mobs.length; i++) {
            if (level10Mobs[i] != basiliskMobId) {
                level10Mobs[newLen] = level10Mobs[i];
                newLen++;
            }
        }

        if (newLen < level10Mobs.length) {
            uint256[] memory trimmed = new uint256[](newLen);
            for (uint256 i; i < newLen; i++) {
                trimmed[i] = level10Mobs[i];
            }
            MobsByLevel.setMobIds(10, trimmed);
            console.log("  Removed Basilisk from MobsByLevel[10], remaining:", newLen);
        } else {
            console.log("  Basilisk not found in MobsByLevel[10], skipping removal");
        }

        // Set BossSpawnConfig
        uint256 spawnChanceBp = 2; // ~1.3 spawns/day at 10 concurrent players
        BossSpawnConfig.set(basiliskMobId, spawnChanceBp);
        console.log("  BossSpawnConfig set: mobId=%d, chanceBp=%d", basiliskMobId, spawnChanceBp);

        vm.stopBroadcast();
        console.log("=== ConfigureBossSpawn Complete ===");
    }
}
