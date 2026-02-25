// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {NamespaceOwner} from "@latticexyz/world/src/codegen/tables/NamespaceOwner.sol";
import {ResourceAccess} from "@latticexyz/world/src/codegen/tables/ResourceAccess.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {_erc721SystemId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import {System} from "@latticexyz/world/src/System.sol";

bytes14 constant FRAGMENTS_NAMESPACE = "Fragments";

/**
 * @title FixFragmentAccessRootSystem
 * @notice Temporary root system that grants FragmentSystem access to mint Fragment NFTs.
 *         Root systems run via delegatecall with World context, bypassing namespace access checks.
 */
contract FixFragmentAccessRootSystem is System {
    function grantFragmentAccess(address fragmentSystemAddress) public {
        ResourceId fragmentsErc721SystemId = _erc721SystemId(FRAGMENTS_NAMESPACE);
        ResourceAccess.set(fragmentsErc721SystemId, fragmentSystemAddress, true);

        // Also transfer namespace ownership back to deployer so this doesn't happen again
        ResourceId fragmentsNamespaceId = WorldResourceIdLib.encodeNamespace(FRAGMENTS_NAMESPACE);
        NamespaceOwner.set(fragmentsNamespaceId, _msgSender());
    }
}

contract FixFragmentAccessRoot is Script {
    function run(address worldAddress) external {
        IWorld world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Get current FragmentSystem address
        ResourceId fragmentSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "FragmentSystem");
        address fragmentSystemAddress = Systems.getSystem(fragmentSystemId);
        console.log("FragmentSystem address:", fragmentSystemAddress);

        // Deploy the temporary root system
        FixFragmentAccessRootSystem fixSystem = new FixFragmentAccessRootSystem();
        console.log("Temporary root system deployed:", address(fixSystem));

        // Register it as a root system (reuse existing ID if already registered)
        ResourceId fixSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "FixFragAccess");
        world.registerSystem(fixSystemId, fixSystem, true);
        console.log("Registered as root system");

        // Call via world.call (avoids function selector registration conflicts)
        world.call(
            fixSystemId,
            abi.encodeCall(FixFragmentAccessRootSystem.grantFragmentAccess, (fragmentSystemAddress))
        );
        console.log("Access granted to FragmentSystem + namespace ownership returned to deployer");

        vm.stopBroadcast();
    }
}
