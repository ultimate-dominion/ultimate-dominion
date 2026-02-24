// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {_erc721SystemId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";

bytes14 constant FRAGMENTS_NAMESPACE = "Fragments";

contract FixFragmentAccess is Script {
    function run(address worldAddress) external {
        IWorld world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        vm.startBroadcast();

        // Get FragmentSystem address
        ResourceId fragmentSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "FragmentSystem");
        address fragmentSystemAddress = Systems.getSystem(fragmentSystemId);
        console.log("FragmentSystem address:", fragmentSystemAddress);

        // Grant access to Fragments:ERC721System
        ResourceId fragmentsErc721SystemId = _erc721SystemId(FRAGMENTS_NAMESPACE);
        console.log("Granting access to Fragments:ERC721System...");

        try world.grantAccess(fragmentsErc721SystemId, fragmentSystemAddress) {
            console.log("Access granted!");
        } catch Error(string memory reason) {
            console.log("Grant failed:", reason);
        } catch {
            console.log("Grant failed with unknown error - might already have access or no permission");
        }

        // Also try granting to World address (since systems run via delegatecall)
        try world.grantAccess(fragmentsErc721SystemId, worldAddress) {
            console.log("Also granted access to World!");
        } catch {
            console.log("World access already granted or failed");
        }

        vm.stopBroadcast();
    }
}
