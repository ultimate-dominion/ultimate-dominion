// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM, RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {Counters} from "@codegen/index.sol";
import {Characters, CharactersData} from "@codegen/index.sol";
import {CHARACTERS_NAMESPACE, WORLD_NAMESPACE} from "../constants.sol";

/**
 * @title FixCounterCollisionSystem
 * @notice Root system to fix tokenId collision from CharacterCore system upgrade.
 *
 * The CharacterCore upgrade reset Counters(address(this), 0) → new characters
 * got tokenIds 1,2 again, overwriting ERC721Owners for the original character.
 *
 * Fix: reassign new characters to tokenIds 3,4 and restore original ownership.
 */
contract FixCounterCollisionSystem is System {
    function fix(address charCoreAddr) public {
        ResourceId ownersTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, CHARACTERS_NAMESPACE, "Owners");

        address origOwner = 0x3dba700B60F0c5B6F262Bf837859Cb478e6DF592;
        address newOwner1 = 0x224D735477d817B60914Ff86156a74e87F86002e;
        address newOwner2 = 0xc6Df67C03a86c7863D9686DC661B8AA726F896b6;

        // Old entityIds (colliding tokenIds)
        bytes32 oldEntity1 = bytes32(uint256(uint160(newOwner1)) << 96 | 1);
        bytes32 oldEntity2 = bytes32(uint256(uint160(newOwner2)) << 96 | 2);

        // New entityIds (non-colliding tokenIds 3 and 4)
        bytes32 newEntity1 = bytes32(uint256(uint160(newOwner1)) << 96 | 3);
        bytes32 newEntity2 = bytes32(uint256(uint160(newOwner2)) << 96 | 4);

        // Step 1: Move Characters data to new entityIds with updated tokenIds
        CharactersData memory data1 = Characters.get(oldEntity1);
        data1.tokenId = 3;
        Characters.set(newEntity1, data1);
        Characters.deleteRecord(oldEntity1);

        CharactersData memory data2 = Characters.get(oldEntity2);
        data2.tokenId = 4;
        Characters.set(newEntity2, data2);
        Characters.deleteRecord(oldEntity2);

        // Step 2: Fix ERC721Owners
        ERC721Owners.set(ownersTableId, 1, origOwner);   // Restore pechuga
        ERC721Owners.set(ownersTableId, 3, newOwner1);   // BugFixr at new tokenId
        ERC721Owners.set(ownersTableId, 4, newOwner2);   // Other at new tokenId
        ERC721Owners.set(ownersTableId, 2, address(0));   // Clear stale entry

        // Step 3: Fix the counter so next mint gets tokenId=5
        Counters.setCounter(charCoreAddr, 0, 4);
    }
}

contract FixCounterCollision is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== FixCounterCollision ===");
        console.log("World:", worldAddress);

        address charCoreAddr = Systems.getSystem(
            WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "CharacterCore")
        );
        console.log("CharacterCore system:", charCoreAddr);

        FixCounterCollisionSystem fixSystem = new FixCounterCollisionSystem();

        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "FixCounter");
        try IWorld(worldAddress).registerSystem(systemId, fixSystem, true) {
            console.log("Registered FixCounterCollisionSystem");
        } catch {
            IWorld(worldAddress).registerSystem(systemId, fixSystem, true);
            console.log("Upgraded FixCounterCollisionSystem");
        }

        IWorld(worldAddress).call(
            systemId,
            abi.encodeCall(FixCounterCollisionSystem.fix, (charCoreAddr))
        );
        console.log("Fix applied successfully");

        vm.stopBroadcast();
    }
}
