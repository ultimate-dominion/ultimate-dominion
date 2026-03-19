// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {IWorld} from "@world/IWorld.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {_erc1155URIStorageTableId} from "@erc1155/utils.sol";
import {ITEMS_NAMESPACE} from "../../constants.sol";

/**
 * @title FixV3URIsSystem
 * @notice Root system that adds missing type prefixes to V3 item metadata URIs.
 *         Runs via delegatecall with World context — bypasses access checks.
 */
contract FixV3URIsSystem is System {
    function fixAll() public {
        ResourceId tableId = _erc1155URIStorageTableId(ITEMS_NAMESPACE);

        // Items 76-82 were created by BalancePatchV3 without type prefixes.
        // On-chain values: "trollhide_cleaver", "phasefang", etc.
        // Expected:        "weapon:trollhide_cleaver", "weapon:phasefang", etc.

        ERC1155URIStorage.setUri(tableId, 76, "weapon:trollhide_cleaver");
        ERC1155URIStorage.setUri(tableId, 77, "weapon:phasefang");
        ERC1155URIStorage.setUri(tableId, 78, "weapon:drakescale_staff");
        ERC1155URIStorage.setUri(tableId, 79, "weapon:dire_rat_bite");
        ERC1155URIStorage.setUri(tableId, 80, "weapon:basilisk_fang");
        ERC1155URIStorage.setUri(tableId, 81, "weapon:basilisk_gaze");
        ERC1155URIStorage.setUri(tableId, 82, "armor:drakes_cowl");
    }
}

/**
 * @title FixV3URIs
 * @notice Deploys FixV3URIsSystem as root system and executes it.
 * @dev Run with:
 *   cd packages/contracts && forge script script/admin/FixV3URIs.s.sol \
 *     --sig "run(address)" 0x99d01939F58B965E6E84a1D167E710Abdf5764b0 \
 *     --rpc-url "https://rpc.ultimatedominion.com?token=..." \
 *     --private-key 0x... --broadcast --skip-simulation
 */
contract FixV3URIs is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);
        vm.startBroadcast();

        console.log("=== FixV3URIs ===");
        console.log("World:", worldAddress);

        // Deploy root system
        FixV3URIsSystem sys = new FixV3URIsSystem();
        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "FixV3URIs");

        IWorld(worldAddress).registerSystem(systemId, sys, true);
        console.log("Registered FixV3URIsSystem");

        // Execute via world.call (root system = delegatecall, full access)
        IWorld(worldAddress).call(
            systemId,
            abi.encodeCall(FixV3URIsSystem.fixAll, ())
        );
        console.log("All URI prefixes applied");

        vm.stopBroadcast();
        console.log("=== FixV3URIs Complete ===");
    }
}
