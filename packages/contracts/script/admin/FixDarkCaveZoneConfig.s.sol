// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";

/**
 * @title FixDarkCaveZoneConfig
 * @notice Backfills zone completion + badge for the 2 characters who reached level 10
 *         but were skipped because Dark Cave maxLevel was incorrectly set to 20.
 *
 *         PREREQUISITE: Update ZoneConfig.maxLevel for Dark Cave BEFORE running this script:
 *           cast send $WORLD_ADDRESS "UD__adminSetZoneMaxLevel(uint256,uint256)" 1 10 \
 *             --private-key $PRIVATE_KEY --rpc-url $RPC_URL
 *         Or use storeSetField if no admin function exists (see below).
 *
 *         Usage:
 *         source .env.mainnet && FOUNDRY_PROFILE=script forge script \
 *           script/admin/FixDarkCaveZoneConfig.s.sol:FixDarkCaveZoneConfig \
 *           --sig "run(address)" $WORLD_ADDRESS \
 *           --rpc-url "$RPC_URL" --broadcast
 */
contract FixDarkCaveZoneConfig is Script {
    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        IWorld world = IWorld(_worldAddress);

        console.log("=== Fix Dark Cave Zone Conqueror Badge ===");
        console.log("World address:", _worldAddress);
        console.log("Deployer:", deployer);

        // Agentsmithy (rank 7) -- token 0x73, reached L10 after existing 6
        bytes32 char7 = 0xa3ed8c7b0a75a1465b487918d777f5fcd358f043000000000000000000000073;
        // Kirin (rank 8) -- token 0x77, reached L10 after Agentsmithy
        bytes32 char8 = 0x5a4b5547bfdc0922b45bec76e3129f9fa46195e5000000000000000000000077;

        vm.startBroadcast(deployerPrivateKey);

        console.log("  Backfilling Agentsmithy (rank 7)...");
        world.UD__backfillZoneCompletion(char7);

        console.log("  Backfilling Kirin (rank 8)...");
        world.UD__backfillZoneCompletion(char8);

        vm.stopBroadcast();

        console.log("=== Backfill Complete ===");
    }
}
