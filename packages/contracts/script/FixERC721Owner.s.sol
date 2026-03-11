// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM, RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {CHARACTERS_NAMESPACE} from "../constants.sol";

/**
 * @notice Fix ERC721 Owners table for pechuga after tokenId collision.
 *         Registers a temporary root system to write to the Characters namespace.
 */
contract FixERC721OwnerSystem is System {
    function fix() public {
        ResourceId ownersTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, CHARACTERS_NAMESPACE, "Owners");
        // Restore ERC721 tokenId 1 ownership to pechuga's wallet
        ERC721Owners.set(ownersTableId, 1, 0xA50f7B2d929a01dE39c933CFf795D082A0575adC);
    }
}

contract FixERC721Owner is Script {
    function run() external {
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        StoreSwitch.setStoreAddress(worldAddress);

        vm.startBroadcast();

        console.log("=== FixERC721Owner ===");
        console.log("World:", worldAddress);

        FixERC721OwnerSystem fixSystem = new FixERC721OwnerSystem();
        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "FixERC721Own");

        try IWorld(worldAddress).registerSystem(systemId, fixSystem, true) {
            console.log("Registered FixERC721OwnerSystem");
        } catch {
            IWorld(worldAddress).registerSystem(systemId, fixSystem, true);
            console.log("Upgraded FixERC721OwnerSystem");
        }

        IWorld(worldAddress).call(
            systemId,
            abi.encodeCall(FixERC721OwnerSystem.fix, ())
        );
        console.log("ERC721 Owners[1] restored to pechuga");

        vm.stopBroadcast();
    }
}
