// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;
import "forge-std/Script.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";

contract CheckSystems is Script {
    function run() external {
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        StoreSwitch.setStoreAddress(worldAddress);

        ResourceId encounterSysId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "EncounterSys");
        ResourceId encounterResSysId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "EncounterResSys");
        
        (address encounterAddr, bool encounterPublic) = Systems.get(encounterSysId);
        (address encounterResAddr, bool encounterResPublic) = Systems.get(encounterResSysId);
        
        console.log("EncounterSystem address:", encounterAddr);
        console.log("EncounterSystem public:", encounterPublic);
        console.log("EncounterResolveSystem address:", encounterResAddr);
        console.log("EncounterResolveSystem public:", encounterResPublic);
    }
}
