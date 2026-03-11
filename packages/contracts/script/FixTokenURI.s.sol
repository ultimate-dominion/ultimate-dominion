// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM, RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {TokenURI} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/TokenURI.sol";
import {CHARACTERS_NAMESPACE} from "../constants.sol";

contract FixTokenURISystem is System {
    function fix() public {
        ResourceId uriTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, CHARACTERS_NAMESPACE, "TokenURI");

        string memory uri1 = TokenURI.get(uriTableId, 1);
        string memory uri2 = TokenURI.get(uriTableId, 2);

        TokenURI.set(uriTableId, 3, uri1);
        TokenURI.set(uriTableId, 4, uri2);

        TokenURI.set(uriTableId, 1, "");
        TokenURI.set(uriTableId, 2, "");
    }
}

contract FixTokenURI is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== FixTokenURI ===");

        FixTokenURISystem fixSystem = new FixTokenURISystem();
        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "FixTokenURI");

        try IWorld(worldAddress).registerSystem(systemId, fixSystem, true) {
            console.log("Registered FixTokenURISystem");
        } catch {
            IWorld(worldAddress).registerSystem(systemId, fixSystem, true);
            console.log("Upgraded FixTokenURISystem");
        }

        IWorld(worldAddress).call(
            systemId,
            abi.encodeCall(FixTokenURISystem.fix, ())
        );
        console.log("TokenURIs fixed");

        vm.stopBroadcast();
    }
}
