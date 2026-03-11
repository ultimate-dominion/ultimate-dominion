// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {SessionConfig} from "@codegen/index.sol";

contract SetSessionConfig is Script {
    function run() external {
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        StoreSwitch.setStoreAddress(worldAddress);

        vm.startBroadcast(privateKey);

        SessionConfig.setSessionTimeout(300); // 5 minutes
        console.log("SessionConfig.sessionTimeout set to 300 seconds");

        vm.stopBroadcast();
    }
}
