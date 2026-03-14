// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {EntitiesAtPosition, Spawned} from "@codegen/index.sol";

/**
 * @title WipeMonsters
 * @notice Removes all non-character entities from the 10x10 map grid.
 *         Iterates every tile, identifies monsters (entities that are not valid characters),
 *         and calls adminRemoveEntity for each.
 *
 *         Usage:
 *           PRIVATE_KEY=0x... forge script script/admin/WipeMonsters.s.sol \
 *             --sig "run(address)" <worldAddress> \
 *             --broadcast --rpc-url $RPC_URL
 */
contract WipeMonsters is Script {
    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("ADMIN_KEY");
        IWorld world = IWorld(_worldAddress);

        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== Wipe Monsters ===");
        console.log("World:", _worldAddress);

        // Collect all monster entityIds first (avoid mutating arrays during iteration)
        bytes32[] memory monstersToRemove = new bytes32[](2000); // max 20 per tile * 100 tiles
        uint256 monsterCount;

        for (uint16 x = 0; x < 10; x++) {
            for (uint16 y = 0; y < 10; y++) {
                bytes32[] memory entities = EntitiesAtPosition.getEntities(x, y);
                for (uint256 i = 0; i < entities.length; i++) {
                    bytes32 entityId = entities[i];
                    // Characters have a valid ERC721 owner; monsters don't
                    bool isCharacter = world.UD__isValidCharacterId(entityId);
                    if (!isCharacter && Spawned.getSpawned(entityId)) {
                        monstersToRemove[monsterCount] = entityId;
                        monsterCount++;
                        console.log("  Monster at (%d, %d)", uint256(x), uint256(y));
                    }
                }
            }
        }

        console.log("Found %d monsters to remove", monsterCount);

        if (monsterCount == 0) {
            console.log("No monsters on map. Done.");
            return;
        }

        // Batch into chunks of 20 to avoid gas limits
        uint256 batchSize = 20;
        uint256 batches = (monsterCount + batchSize - 1) / batchSize;
        console.log("Removing in %d batches of %d", batches, batchSize);

        vm.startBroadcast(deployerPrivateKey);

        for (uint256 b = 0; b < batches; b++) {
            uint256 start = b * batchSize;
            uint256 end = start + batchSize;
            if (end > monsterCount) end = monsterCount;
            uint256 count = end - start;

            bytes32[] memory batch = new bytes32[](count);
            for (uint256 i = 0; i < count; i++) {
                batch[i] = monstersToRemove[start + i];
            }
            world.UD__removeEntitiesFromBoard(batch);
            console.log("  Batch %d: removed %d monsters", b + 1, count);
        }

        vm.stopBroadcast();

        console.log("Removed %d monsters", monsterCount);
        console.log("=== Done ===");
    }
}
