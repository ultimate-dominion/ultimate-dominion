// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ZoneConfig, ZoneMapConfig} from "@codegen/index.sol";
import {BADGE_ZONE_CONQUEROR_BASE, MAX_LEVEL, EARLY_GAME_CAP, ZONE_DARK_CAVE, ZONE_WINDY_PEAKS} from "../../constants.sol";

/**
 * @title ConfigureZones
 * @notice Sets up zone configuration for the Zone Conqueror badge system and zone map configs.
 *         Run after deploy: forge script script/admin/ConfigureZones.s.sol --sig "run(address)" <worldAddress> --broadcast --rpc-url $RPC_URL
 */
contract ConfigureZones is Script {
    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Configure Zones ===");
        console.log("World address:", _worldAddress);
        console.log("Deployer:", deployer);

        // ── Zone 1: Dark Cave ──
        uint256 existingMaxLevel = ZoneConfig.getMaxLevel(ZONE_DARK_CAVE);
        if (existingMaxLevel == 0) {
            ZoneConfig.set(ZONE_DARK_CAVE, EARLY_GAME_CAP, BADGE_ZONE_CONQUEROR_BASE);
            console.log("  Dark Cave ZoneConfig: zoneId=1, maxLevel=%d, badgeBase=100", EARLY_GAME_CAP);
        } else {
            console.log("  Dark Cave ZoneConfig already set, maxLevel:", existingMaxLevel);
        }

        // ZoneMapConfig for Dark Cave: 10x10 grid at origin (0, 0), minLevel = 1
        if (ZoneMapConfig.getWidth(ZONE_DARK_CAVE) == 0) {
            ZoneMapConfig.set(ZONE_DARK_CAVE, 10, 10, 0, 0, 1);
            console.log("  Dark Cave ZoneMapConfig: 10x10 at (0,0), minLevel=1");
        } else {
            console.log("  Dark Cave ZoneMapConfig already set");
        }

        // ── Zone 2: Windy Peaks ──
        uint256 existingZ2MaxLevel = ZoneConfig.getMaxLevel(ZONE_WINDY_PEAKS);
        if (existingZ2MaxLevel == 0) {
            // Zone 2 badge base = BADGE_ZONE_CONQUEROR_BASE + 1 (101 for zone 2)
            ZoneConfig.set(ZONE_WINDY_PEAKS, MAX_LEVEL, BADGE_ZONE_CONQUEROR_BASE + 1);
            console.log("  Windy Peaks ZoneConfig: zoneId=2, maxLevel=%d, badgeBase=101", MAX_LEVEL);
        } else {
            console.log("  Windy Peaks ZoneConfig already set, maxLevel:", existingZ2MaxLevel);
        }

        // ZoneMapConfig for Windy Peaks: 10x10 grid at origin (0, 0), minLevel = 10
        if (ZoneMapConfig.getWidth(ZONE_WINDY_PEAKS) == 0) {
            ZoneMapConfig.set(ZONE_WINDY_PEAKS, 10, 10, 0, 0, 10);
            console.log("  Windy Peaks ZoneMapConfig: 10x10 at (0,0), minLevel=10");
        } else {
            console.log("  Windy Peaks ZoneMapConfig already set");
        }

        vm.stopBroadcast();

        console.log("=== Zone Configuration Complete ===");
    }
}
