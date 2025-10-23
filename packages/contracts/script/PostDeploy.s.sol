// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { PostDeployCoreGameState } from "./PostDeploy-CoreGameState.s.sol";

contract PostDeploy is Script {
    function run(address _worldAddress) external {
        console.log("PostDeploy script running for world at:", _worldAddress);
        
        // Set the world address environment variable for our modular scripts
        vm.setEnv("WORLD_ADDRESS", vm.toString(_worldAddress));
        
        // Call our modular core game state initialization
        PostDeployCoreGameState coreGameState = new PostDeployCoreGameState();
        coreGameState.run();
        
        console.log("PostDeploy completed successfully!");
    }
}