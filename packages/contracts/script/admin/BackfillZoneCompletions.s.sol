// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Stats, CharacterZoneCompletion} from "@codegen/index.sol";
import {ZONE_DARK_CAVE, MAX_LEVEL} from "../../constants.sol";

/**
 * @title BackfillZoneCompletions
 * @notice Backfills zone completion records for characters that reached max level
 *         before the zone completion system was active.
 *
 *         Usage (with cast workaround for macOS forge bug):
 *         source .env.mainnet && forge script script/admin/BackfillZoneCompletions.s.sol \
 *           --sig "run(address)" <worldAddress> --rpc-url "$RPC_URL"
 *         Then use cast send to broadcast each tx from broadcast/ artifacts.
 */
contract BackfillZoneCompletions is Script {
    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        StoreSwitch.setStoreAddress(_worldAddress);
        IWorld world = IWorld(_worldAddress);

        console.log("=== Backfill Zone Completions ===");
        console.log("World address:", _worldAddress);
        console.log("Deployer:", deployer);

        // Tony's character ID --only player at level 10 as of 2026-03-14
        bytes32 tonyCharId = bytes32(0xbcab369ca6dff9038c47739509568d1f6257a6fa00000000000000000000000f);

        uint256 level = Stats.getLevel(tonyCharId);
        console.log("Tony level:", level);

        bool alreadyCompleted = CharacterZoneCompletion.getCompleted(tonyCharId, ZONE_DARK_CAVE);
        if (alreadyCompleted) {
            console.log("Tony already has zone completion recorded --skipping");
        } else {
            console.log("Backfilling Tony zone completion...");
            world.UD__backfillZoneCompletion(tonyCharId);
            console.log("Done --Tony is now Zone Conqueror #1");
        }

        vm.stopBroadcast();

        console.log("=== Backfill Complete ===");
    }
}
