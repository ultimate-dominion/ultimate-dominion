// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";
import {StandardDelegationsModule} from "@latticexyz/world-modules/src/modules/std-delegations/StandardDelegationsModule.sol";

contract InstallDelegationModule is Script {
    function run() external {
        // Get the world address from the command line
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        console.log("Installing StandardDelegationsModule on world at:", worldAddress);
        
        IWorld world = IWorld(worldAddress);
        
        // Deploy the StandardDelegationsModule
        StandardDelegationsModule delegationModule = new StandardDelegationsModule();
        console.log("StandardDelegationsModule deployed at:", address(delegationModule));
        
        // Install it as a root module
        vm.startBroadcast();
        world.installRootModule(delegationModule, new bytes(0));
        vm.stopBroadcast();
        
        console.log("StandardDelegationsModule installed successfully!");
    }
}
