// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ZoneConfig} from "@codegen/index.sol";
import {BADGE_ZONE_CONQUEROR_BASE, MAX_LEVEL, ZONE_DARK_CAVE} from "../../constants.sol";

/**
 * @title ConfigureZones
 * @notice Sets up zone configuration for the Zone Conqueror badge system.
 *         Run after deploy: forge script script/ConfigureZones.s.sol --sig "run(address)" <worldAddress> --broadcast --rpc-url $RPC_URL
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

        // Configure Dark Cave: zone 1, max level = MAX_LEVEL (100), badge base = BADGE_ZONE_CONQUEROR_BASE (100)
        uint256 existingMaxLevel = ZoneConfig.getMaxLevel(ZONE_DARK_CAVE);
        if (existingMaxLevel == 0) {
            ZoneConfig.set(ZONE_DARK_CAVE, MAX_LEVEL, BADGE_ZONE_CONQUEROR_BASE);
            console.log("  Dark Cave configured: zoneId=1, maxLevel=100, badgeBase=100");
        } else {
            console.log("  Dark Cave already configured, maxLevel:", existingMaxLevel);
        }

        vm.stopBroadcast();

        console.log("=== Zone Configuration Complete ===");
    }
}
