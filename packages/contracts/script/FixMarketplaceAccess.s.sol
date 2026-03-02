// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM, RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {ResourceAccess} from "@latticexyz/world/src/codegen/tables/ResourceAccess.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {_ownersTableId} from "@erc1155/utils.sol";
import {_balancesTableId as _goldBalancesTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";

bytes14 constant ITEMS_NAMESPACE = "Items";
bytes14 constant GOLD_NAMESPACE = "Gold";

/**
 * @title FixMarketplaceAccessSystem
 * @notice Root system that grants MarketplaceSystem table-level access.
 *         Root systems run via delegatecall with World context, bypassing access checks.
 */
contract FixMarketplaceAccessSystem is System {
    function fix() public {
        // Look up current MarketplaceSystem address (mud.config name: "MarketplaceSys")
        ResourceId marketplaceSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MarketplaceSys");
        address marketplace = Systems.getSystem(marketplaceSystemId);
        require(marketplace != address(0), "MarketplaceSystem not registered");
        console.log("MarketplaceSystem address:", marketplace);

        // Grant Items:Owners table access (for _transferItemDirect)
        ResourceId itemsOwners = _ownersTableId(ITEMS_NAMESPACE);
        ResourceAccess.set(itemsOwners, marketplace, true);
        console.log("Granted Items:Owners table access");

        // Grant Gold:Balances table access (for _transferGoldDirect)
        ResourceId goldBalances = _goldBalancesTableId(GOLD_NAMESPACE);
        ResourceAccess.set(goldBalances, marketplace, true);
        console.log("Granted Gold:Balances table access");
    }
}

/**
 * @title FixMarketplaceAccess
 * @notice Deploys a temporary root system to grant MarketplaceSystem table-level
 *         access to Items:Owners and Gold:Balances. Needed because the deployer
 *         doesn't own the Items/Gold namespaces directly.
 *
 *  Usage (beta):
 *    source .env.testnet && forge script script/FixMarketplaceAccess.s.sol \
 *      --sig "run(address)" $WORLD_ADDRESS --broadcast --rpc-url $RPC_URL
 */
contract FixMarketplaceAccess is Script {
    function run(address worldAddress) external {
        IWorld world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        vm.startBroadcast();

        console.log("=== Fix Marketplace Access ===");
        console.log("World:", worldAddress);

        // Deploy temporary root system
        FixMarketplaceAccessSystem fixSystem = new FixMarketplaceAccessSystem();
        console.log("Temporary root system deployed:", address(fixSystem));

        // Register as root system (root = runs via delegatecall, bypasses access control)
        ResourceId fixSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "FixMktAccess");
        world.registerSystem(fixSystemId, fixSystem, true);
        console.log("Registered as root system");

        // Call via world.call (bypasses function selector registration)
        world.call(fixSystemId, abi.encodeCall(FixMarketplaceAccessSystem.fix, ()));
        console.log("Access grants applied!");

        vm.stopBroadcast();
    }
}
