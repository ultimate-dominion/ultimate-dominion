// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { IWorld } from "@world/IWorld.sol";
import { StandardDelegationsModule } from "@latticexyz/world-modules/src/modules/std-delegations/StandardDelegationsModule.sol";

contract InstallStandardDelegationsModule is Script {
    function run() external {
        // Get the world address from environment variable
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        console.log("Installing StandardDelegationsModule on world at:", worldAddress);
        
        // Start broadcasting transactions
        vm.startBroadcast();
        
        IWorld world = IWorld(worldAddress);
        
        // Deploy the StandardDelegationsModule
        StandardDelegationsModule module = new StandardDelegationsModule();
        console.log("StandardDelegationsModule deployed at:", address(module));
        
        // Install the module as a root module
        world.installRootModule(module, "");
        console.log("StandardDelegationsModule installed successfully");
        
        vm.stopBroadcast();
    }
}
