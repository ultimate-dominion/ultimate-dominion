// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";

/**
 * @title BackfillZoneCompletions
 * @notice Backfills zone completion records for characters that reached max level
 *         before the zone completion system was active.
 *
 *         Chronological order determined via binary search on Stats.level at
 *         historical blocks (CharacterLeveledUp events not deployed on-chain).
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

        IWorld world = IWorld(_worldAddress);

        console.log("=== Backfill Zone Completions ===");
        console.log("World address:", _worldAddress);
        console.log("Deployer:", deployer);

        // All level-10 characters in chronological order (block they hit L10)
        // 1. Tony    — block 43353128 (2026-03-14) — already backfilled as rank #1
        // 2. mokn    — block 43456709 (2026-03-16)
        // 3. Masterpiece — block 43496713 (2026-03-17)
        // 4. King    — block 43564087 (2026-03-19)
        // 5. Beardrew — block 43647489 (2026-03-21)
        // 6. Luno    — block 43686958 (2026-03-22)
        //
        // backfillZoneCompletion checks level >= maxLevel and !alreadyCompleted
        // internally, so already-completed characters (Tony) are safely skipped.
        bytes32[6] memory charIds = [
            bytes32(0xbcab369ca6dff9038c47739509568d1f6257a6fa00000000000000000000000f), // Tony
            bytes32(0xaf8275898f6c2190b7b19b197751365e9f93116e000000000000000000000001), // mokn
            bytes32(0x684f13964484e84fe2d251122d4a59c08fdae4a900000000000000000000000a), // Masterpiece
            bytes32(0x799127822cc7ba3dfc8e60af37e70f778a231cd2000000000000000000000010), // King
            bytes32(0x08866cd162d8d94ecf0b15240fc23e4c993b3555000000000000000000000028), // Beardrew
            bytes32(0xb3284ca329840411922042ba3ef35d951f335cce000000000000000000000058)  // Luno
        ];

        for (uint256 i = 0; i < charIds.length; i++) {
            world.UD__backfillZoneCompletion(charIds[i]);
        }

        vm.stopBroadcast();

        console.log("=== Backfill Complete ===");
    }
}
