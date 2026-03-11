// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;
import "forge-std/Script.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Counters} from "@codegen/index.sol";
import {CHARACTER_TOKEN_COUNTER_KEY} from "../constants.sol";

/// @notice Initialize the stable character token counter after migrating from address(this).
contract InitCounter is Script {
    function run() external {
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        StoreSwitch.setStoreAddress(worldAddress);

        uint256 current = Counters.getCounter(CHARACTER_TOKEN_COUNTER_KEY, 0);
        console.log("Current counter value:", current);

        if (current == 0) {
            vm.startBroadcast();
            // Set to 3 — 2 ERC721 tokens exist (tokenId 1 & 2), +1 safety
            Counters.setCounter(CHARACTER_TOKEN_COUNTER_KEY, 0, 3);
            vm.stopBroadcast();
            console.log("Counter initialized to 3");
        } else {
            console.log("Counter already initialized, skipping");
        }
    }
}
