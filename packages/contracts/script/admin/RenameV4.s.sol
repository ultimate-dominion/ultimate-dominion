// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {IWorld} from "@world/IWorld.sol";
import {Mobs} from "@codegen/index.sol";

/**
 * @title RenameV4System
 * @notice Renames Z1 + Z2 monster metadataUri to D&D archetype names.
 *         Beta world has duplicate zone loads, so we rename all instances.
 */
contract RenameV4System is System {
    function renameAll() public {
        // --- Z1 Dark Cave (first load: mobs 2-10) ---
        Mobs.setMobMetadata(2,  "monster:kobold");
        Mobs.setMobMetadata(3,  "monster:goblin");
        Mobs.setMobMetadata(4,  "monster:giant_spider");
        Mobs.setMobMetadata(5,  "monster:skeleton");
        Mobs.setMobMetadata(6,  "monster:goblin_shaman");
        Mobs.setMobMetadata(7,  "monster:gelatinous_ooze");
        Mobs.setMobMetadata(8,  "monster:bugbear");
        Mobs.setMobMetadata(9,  "monster:carrion_crawler");
        Mobs.setMobMetadata(10, "monster:hook_horror");

        // --- Z1 Dark Cave (second load: mobs 14-22) ---
        Mobs.setMobMetadata(14, "monster:kobold");
        Mobs.setMobMetadata(15, "monster:goblin");
        Mobs.setMobMetadata(16, "monster:giant_spider");
        Mobs.setMobMetadata(17, "monster:skeleton");
        Mobs.setMobMetadata(18, "monster:goblin_shaman");
        Mobs.setMobMetadata(19, "monster:gelatinous_ooze");
        Mobs.setMobMetadata(20, "monster:bugbear");
        Mobs.setMobMetadata(21, "monster:carrion_crawler");
        Mobs.setMobMetadata(22, "monster:hook_horror");

        // --- Z1 Dark Cave (third load: mobs 36-44) ---
        Mobs.setMobMetadata(36, "monster:kobold");
        Mobs.setMobMetadata(37, "monster:goblin");
        Mobs.setMobMetadata(38, "monster:giant_spider");
        Mobs.setMobMetadata(39, "monster:skeleton");
        Mobs.setMobMetadata(40, "monster:goblin_shaman");
        Mobs.setMobMetadata(41, "monster:gelatinous_ooze");
        Mobs.setMobMetadata(42, "monster:bugbear");
        Mobs.setMobMetadata(43, "monster:carrion_crawler");
        Mobs.setMobMetadata(44, "monster:hook_horror");

        // --- Z2 Windy Peaks (first load: mobs 25-33) ---
        Mobs.setMobMetadata(25, "monster:dire_wolf");
        Mobs.setMobMetadata(26, "monster:harpy");
        Mobs.setMobMetadata(27, "monster:ogre");
        Mobs.setMobMetadata(28, "monster:worg");
        Mobs.setMobMetadata(29, "monster:orc");
        Mobs.setMobMetadata(30, "monster:orc_shaman");
        Mobs.setMobMetadata(31, "monster:troll");
        Mobs.setMobMetadata(32, "monster:griffon");
        Mobs.setMobMetadata(33, "monster:manticore");

        // --- Z2 Windy Peaks (partial second load: mobs 47-52) ---
        Mobs.setMobMetadata(47, "monster:dire_wolf");
        Mobs.setMobMetadata(48, "monster:harpy");
        Mobs.setMobMetadata(49, "monster:ogre");
        Mobs.setMobMetadata(50, "monster:worg");
        Mobs.setMobMetadata(51, "monster:orc");
        Mobs.setMobMetadata(52, "monster:orc_shaman");

        // --- Z2 Windy Peaks (third load: mobs 56-64) ---
        Mobs.setMobMetadata(56, "monster:dire_wolf");
        Mobs.setMobMetadata(57, "monster:harpy");
        Mobs.setMobMetadata(58, "monster:ogre");
        Mobs.setMobMetadata(59, "monster:worg");
        Mobs.setMobMetadata(60, "monster:orc");
        Mobs.setMobMetadata(61, "monster:orc_shaman");
        Mobs.setMobMetadata(62, "monster:troll");
        Mobs.setMobMetadata(63, "monster:griffon");
        Mobs.setMobMetadata(64, "monster:manticore");
    }
}

/**
 * @title RenameV4
 * @notice Deploys RenameV4System as root system and executes it.
 * @dev Run with:
 *   cd packages/contracts && bash -c 'set -a && source .env && set +a && \
 *     forge script script/admin/RenameV4.s.sol \
 *     --sig "run(address)" $(grep WORLD_ADDRESS .env | cut -d= -f2) \
 *     --rpc-url $(grep RPC_URL .env | cut -d= -f2) \
 *     --private-key $(grep PRIVATE_KEY .env | cut -d= -f2) \
 *     --broadcast --skip-simulation'
 */
contract RenameV4 is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        vm.startBroadcast();

        console.log("=== RenameV4: D&D Archetype Roster ===");
        console.log("World:", worldAddress);

        // Deploy root system
        RenameV4System sys = new RenameV4System();
        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "RenameV4");

        IWorld(worldAddress).registerSystem(systemId, sys, true);
        console.log("Registered RenameV4System");

        // Execute via world.call (root system = delegatecall, full access)
        IWorld(worldAddress).call(
            systemId,
            abi.encodeCall(RenameV4System.renameAll, ())
        );
        console.log("All 51 monster renames applied");

        vm.stopBroadcast();
        console.log("=== RenameV4 Complete ===");
    }
}
