// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ZoneConfig, CharacterZoneCompletion, ZoneCompletions} from "@codegen/index.sol";
import {ZONE_DARK_CAVE, EARLY_GAME_CAP} from "../../constants.sol";

/**
 * @title FixDarkCaveZoneConfig
 * @notice Fixes Dark Cave ZoneConfig maxLevel from 20 → 10 (EARLY_GAME_CAP) and
 *         backfills zone completion + badge for the remaining 4 characters who
 *         reached level 10 but were skipped because maxLevel was incorrectly set to 20.
 *
 *         Characters must be passed in chronological order of when they reached level 10
 *         (earliest first). They will receive ranks 7–10 since 6 completions already exist.
 *
 *         Usage:
 *         source .env.mainnet && forge script script/admin/FixDarkCaveZoneConfig.s.sol \
 *           --sig "run(address,bytes32,bytes32,bytes32,bytes32)" \
 *           $WORLD_ADDRESS $CHAR_7 $CHAR_8 $CHAR_9 $CHAR_10 \
 *           --rpc-url "$RPC_URL" --broadcast
 */
contract FixDarkCaveZoneConfig is Script {
    function run(
        address _worldAddress,
        bytes32 char7,
        bytes32 char8,
        bytes32 char9,
        bytes32 char10
    ) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        StoreSwitch.setStoreAddress(_worldAddress);
        IWorld world = IWorld(_worldAddress);

        console.log("=== Fix Dark Cave Zone Config ===");
        console.log("World address:", _worldAddress);
        console.log("Deployer:", deployer);

        // ── Step 1: Fix ZoneConfig maxLevel ──
        uint256 currentMaxLevel = ZoneConfig.getMaxLevel(ZONE_DARK_CAVE);
        console.log("  Current Dark Cave maxLevel:", currentMaxLevel);
        require(currentMaxLevel == 20, "Unexpected maxLevel — already patched?");

        vm.startBroadcast(deployerPrivateKey);

        ZoneConfig.setMaxLevel(ZONE_DARK_CAVE, EARLY_GAME_CAP);
        console.log("  Updated Dark Cave maxLevel:", EARLY_GAME_CAP);

        // Verify existing completions before backfill
        bytes32[] memory existing = ZoneCompletions.getCompletedCharacters(ZONE_DARK_CAVE);
        console.log("  Existing DC completions:", existing.length);
        require(existing.length == 6, "Expected 6 existing completions");

        // ── Step 2: Backfill remaining 4 characters (ranks 7–10) ──
        bytes32[4] memory charIds = [char7, char8, char9, char10];

        for (uint256 i = 0; i < charIds.length; i++) {
            console.log("  Backfilling character (rank %d):", existing.length + i + 1);
            world.UD__backfillZoneCompletion(charIds[i]);
        }

        vm.stopBroadcast();

        // ── Verify ──
        bytes32[] memory afterCompletions = ZoneCompletions.getCompletedCharacters(ZONE_DARK_CAVE);
        console.log("  DC completions after backfill:", afterCompletions.length);
        require(afterCompletions.length == 10, "Expected 10 completions after backfill");

        console.log("=== Fix Complete ===");
    }
}
