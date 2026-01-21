// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { IWorld } from "@world/IWorld.sol";
import { Classes } from "@codegen/common.sol";
import { ResourceId, WorldResourceIdLib } from "@latticexyz/world/src/WorldResourceId.sol";
import { RESOURCE_SYSTEM } from "@latticexyz/world/src/worldResourceTypes.sol";

contract SeedStarterItems is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        IWorld world = IWorld(worldAddress);

        console.log("Seeding StarterItems on world:", worldAddress);

        // Grant caller access to ItemsSystem if needed
        address caller = vm.addr(deployerPrivateKey);
        ResourceId itemsSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ItemsSystem");
        world.grantAccess(itemsSystemId, caller);

        uint256[] memory warriorItems = new uint256[](1);
        uint256[] memory warriorAmts = new uint256[](1);
        warriorItems[0] = 6; // Rusty Axe
        warriorAmts[0] = 1;
        world.UD__setStarterItems(Classes.Warrior, warriorItems, warriorAmts);

        uint256[] memory rogueItems = new uint256[](1);
        uint256[] memory rogueAmts = new uint256[](1);
        rogueItems[0] = 9; // Throwing Dagger
        rogueAmts[0] = 1;
        world.UD__setStarterItems(Classes.Rogue, rogueItems, rogueAmts);

        uint256[] memory mageItems = new uint256[](1);
        uint256[] memory mageAmts = new uint256[](1);
        mageItems[0] = 8; // Novice Staff
        mageAmts[0] = 1;
        world.UD__setStarterItems(Classes.Mage, mageItems, mageAmts);

        console.log("StarterItems seeded");

        vm.stopBroadcast();
    }
}


