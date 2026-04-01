// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ZoneMapConfig} from "@codegen/index.sol";
import {ZONE_WINDY_PEAKS} from "../../constants.sol";

/**
 * @notice Updates Windy Peaks minLevel from 11 to 10 on an already-configured world.
 *         ConfigureZones.s.sol skips zones that already have width > 0, so this
 *         one-off script patches the minLevel directly.
 *
 * @dev Run with:
 *   source .env.beta && forge script script/admin/SetWindyPeaksMinLevel.s.sol \
 *     --sig "run(address)" $WORLD_ADDRESS --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
 */
contract SetWindyPeaksMinLevel is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        uint256 oldMinLevel = ZoneMapConfig.getMinLevel(ZONE_WINDY_PEAKS);
        console.log("Windy Peaks (zone %d) minLevel: %d -> 10", ZONE_WINDY_PEAKS, oldMinLevel);

        ZoneMapConfig.setMinLevel(ZONE_WINDY_PEAKS, 10);

        vm.stopBroadcast();
        console.log("Done.");
    }
}
