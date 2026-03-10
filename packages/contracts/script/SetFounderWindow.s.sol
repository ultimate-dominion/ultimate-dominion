// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;
import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
contract SetFounderWindow is Script {
    function run() external {
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        StoreSwitch.setStoreAddress(worldAddress);
        vm.startBroadcast(privateKey);
        uint256 thirtyDays = block.timestamp + 30 days;
        UltimateDominionConfig.setFounderWindowEnd(thirtyDays);
        console.log("Founder window set to:", thirtyDays);
        vm.stopBroadcast();
    }
}
