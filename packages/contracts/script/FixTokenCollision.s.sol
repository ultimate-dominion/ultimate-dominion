// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM, RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {StoreCore} from "@latticexyz/store/src/StoreCore.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {Characters, Spawned, Stats, EncounterEntity} from "@codegen/index.sol";

/**
 * @title FixTokenCollisionSystem
 * @notice Root system to clean up pre-upgrade character records whose ERC721
 *         token IDs were overwritten by the post-upgrade character counter reset.
 *         Affected characters: Obitus (token 1), mokn (token 2).
 */
contract FixTokenCollisionSystem is System {
    function fix() public {
        // Pre-upgrade characters whose ERC721 ownership was overwritten:
        // - Obitus: 0x805895d8ff83bb240381292ebac6b3bd56e60f48 + token 1
        // - mokn:   0xb3ccf8cecf3ecd0d816ac026d86cbabc5e22a764 + token 2
        bytes32 obitusId = bytes32(
            (uint256(uint160(0x805895D8fF83bb240381292EbAc6B3bD56e60f48)) << 96) | 1
        );
        bytes32 moknId = bytes32(
            (uint256(uint160(0xB3cCF8CEcF3ECD0D816aC026d86cbABC5e22A764)) << 96) | 2
        );

        // Delete Characters table records (the main lookup table)
        Characters.deleteRecord(obitusId);
        Characters.deleteRecord(moknId);
        console.log("Deleted Characters records for Obitus and mokn");

        // Clean up related tables so there's no orphaned data
        Spawned.deleteRecord(obitusId);
        Spawned.deleteRecord(moknId);
        console.log("Deleted Spawned records");

        Stats.deleteRecord(obitusId);
        Stats.deleteRecord(moknId);
        console.log("Deleted Stats records");

        EncounterEntity.deleteRecord(obitusId);
        EncounterEntity.deleteRecord(moknId);
        console.log("Deleted EncounterEntity records");
    }
}

contract FixTokenCollision is Script {
    function run(address worldAddress) external {
        IWorld world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Fix Token Collision ===");
        console.log("World:", worldAddress);

        // Deploy and register as root system
        FixTokenCollisionSystem fixSystem = new FixTokenCollisionSystem();
        ResourceId fixSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "FixTokenCollisn");
        world.registerSystem(fixSystemId, fixSystem, true);
        console.log("Root system registered");

        // Execute
        world.call(
            fixSystemId,
            abi.encodeCall(FixTokenCollisionSystem.fix, ())
        );
        console.log("Broken character records cleaned up");

        vm.stopBroadcast();
    }
}
