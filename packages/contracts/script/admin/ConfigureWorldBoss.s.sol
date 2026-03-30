// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";

/**
 * @title ConfigureWorldBoss
 * @notice Configures Korrath's Warden as a world boss on Windy Peaks.
 *
 * Usage:
 *   forge script script/admin/ConfigureWorldBoss.s.sol \
 *     --sig "run(address)" <WORLD_ADDRESS> \
 *     --rpc-url <RPC> --broadcast --skip-simulation
 */
contract ConfigureWorldBoss is Script {
    function run(address worldAddress) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        IWorld world = IWorld(worldAddress);

        uint256 bossId = 1;
        uint256 mobId = 34;        // Korrath's Warden
        uint256 zoneId = 2;        // ZONE_WINDY_PEAKS
        uint16 spawnX = 5;         // Center of peak ridge
        uint16 spawnY = 109;       // Top row of Z2 (originY=100, zone-relative y=9)
        uint256 respawnSeconds = 3600; // 1 hour

        console.log("=== ConfigureWorldBoss: Korrath's Warden ===");
        console.log("  bossId:", bossId);
        console.log("  mobId:", mobId);
        console.log("  zone:", zoneId);
        console.log("  spawn: (%d, %d)", spawnX, spawnY);
        console.log("  respawn: %d seconds", respawnSeconds);

        world.UD__configureWorldBoss(bossId, mobId, zoneId, spawnX, spawnY, respawnSeconds);

        console.log("=== Done ===");
        vm.stopBroadcast();
    }
}
