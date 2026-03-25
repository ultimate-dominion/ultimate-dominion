// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {PvpSeason} from "@codegen/index.sol";

/**
 * @title DeployPvpSeason
 * @notice Initializes the first PvP season (90-day duration).
 *
 * Sets PvpSeason singleton: season 1, starts now, ends in 90 days.
 *
 * Prerequisites:
 * - World must be deployed with PvpSeason table
 *
 * Usage:
 *   forge script DeployPvpSeason --broadcast --sig "run(address)" <WORLD_ADDRESS>
 */
contract DeployPvpSeason is Script {
    IWorld public world;

    uint256 constant SEASON_DURATION = 90 days;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== DeployPvpSeason ===");

        uint256 seasonStart = block.timestamp;
        uint256 seasonEnd = block.timestamp + SEASON_DURATION;

        PvpSeason.set(1, seasonStart, seasonEnd);

        console.log("Season 1 started");
        console.log("  Start:", seasonStart);
        console.log("  End:  ", seasonEnd);
        console.log("  Duration: 90 days");

        vm.stopBroadcast();

        console.log("=== DeployPvpSeason Complete ===");
    }
}
