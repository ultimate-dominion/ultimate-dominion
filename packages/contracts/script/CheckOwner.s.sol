// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;
import "forge-std/Script.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {NamespaceOwner} from "@latticexyz/world/src/codegen/tables/NamespaceOwner.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_NAMESPACE} from "@latticexyz/world/src/worldResourceTypes.sol";

contract CheckOwner is Script {
    function run() external {
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        StoreSwitch.setStoreAddress(worldAddress);
        
        ResourceId rootNs = WorldResourceIdLib.encodeNamespace("");
        ResourceId worldNs = WorldResourceIdLib.encodeNamespace("world");
        ResourceId udNs = WorldResourceIdLib.encodeNamespace("UD");
        
        address rootOwner = NamespaceOwner.get(rootNs);
        address worldOwner = NamespaceOwner.get(worldNs);
        address udOwner = NamespaceOwner.get(udNs);
        
        console.log("Root namespace owner:", rootOwner);
        console.log("World namespace owner:", worldOwner);
        console.log("UD namespace owner:", udOwner);
        console.log("Deployer:", 0xF282dcCB96301C26fc68AA02e7253F90e7D8770f);
    }
}
