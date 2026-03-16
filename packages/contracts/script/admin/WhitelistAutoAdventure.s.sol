// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Script.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {AllowedGameSystems} from "@codegen/index.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";

contract WhitelistAutoAdventure is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);

        ResourceId autoAdventureId = WorldResourceIdLib.encode(
            RESOURCE_SYSTEM,
            "UD",
            "AutoAdventureSy"
        );

        vm.startBroadcast();
        AllowedGameSystems.setAllowed(autoAdventureId, true);
        vm.stopBroadcast();

        bool allowed = AllowedGameSystems.getAllowed(autoAdventureId);
        console.log("AutoAdventureSystem whitelisted:", allowed);
    }
}
