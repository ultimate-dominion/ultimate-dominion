// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IWorld} from "@world/IWorld.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM, RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {NamespaceOwner} from "@latticexyz/world/src/codegen/tables/NamespaceOwner.sol";
import {ResourceAccess} from "@latticexyz/world/src/codegen/tables/ResourceAccess.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {_erc721SystemId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import {_erc20SystemId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {_erc1155SystemId} from "../src/utils.sol";
import {GOLD_NAMESPACE, CHARACTERS_NAMESPACE, ITEMS_NAMESPACE, BADGES_NAMESPACE, FRAGMENTS_NAMESPACE} from "../constants.sol";

/**
 * @title FixAccessRootSystem
 * @notice Temporary root system that restores namespace ownership and grants cross-namespace access.
 *         Root systems run via delegatecall with World context, bypassing all access checks.
 *         Used after upgrade deploys when namespace ownership was previously transferred away from deployer.
 */
contract FixAccessRootSystem is System {
    function fixAll(address deployer, address worldAddress) public {
        // --- Step 1: Restore namespace ownership to deployer ---
        // This lets future PostDeploy runs work correctly
        ResourceId goldNs = WorldResourceIdLib.encodeNamespace(GOLD_NAMESPACE);
        ResourceId itemsNs = WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE);
        ResourceId charsNs = WorldResourceIdLib.encodeNamespace(CHARACTERS_NAMESPACE);
        ResourceId badgesNs = WorldResourceIdLib.encodeNamespace(BADGES_NAMESPACE);
        ResourceId fragsNs = WorldResourceIdLib.encodeNamespace(FRAGMENTS_NAMESPACE);

        NamespaceOwner.set(goldNs, deployer);
        NamespaceOwner.set(itemsNs, deployer);
        NamespaceOwner.set(charsNs, deployer);
        NamespaceOwner.set(badgesNs, deployer);
        NamespaceOwner.set(fragsNs, deployer);

        // --- Step 2: Look up current system addresses ---
        address characterCore = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "CharacterCore"));
        address levelSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "LevelSystem"));
        address adminSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "AdminSystem"));
        address statSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "StatSystem"));
        address lootManager = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "LootManagerSyste"));
        address gasStation = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "GasStationSys"));
        address itemsSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ItemsSystem"));
        address itemCreation = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ItemCreationSys"));
        address fragmentSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "FragmentSystem"));
        address pveReward = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "PveRewardSystem"));
        address shopSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ShopSystem"));
        address marketplace = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MarketplaceSyste"));
        // New split systems — only write UD namespace tables, no cross-namespace grants needed
        // address encounterResolve = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "EncounterResSys"));
        // address mapRemoval = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MapRemovalSys"));

        // --- Step 3: Resource IDs for cross-namespace tables/systems ---
        ResourceId goldBalances = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "Balances");
        ResourceId goldTotalSupply = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "TotalSupply");
        ResourceId goldErc20System = _erc20SystemId(GOLD_NAMESPACE);

        ResourceId itemsOwners = WorldResourceIdLib.encode(RESOURCE_TABLE, ITEMS_NAMESPACE, "Owners");
        ResourceId itemsTotalSupply = WorldResourceIdLib.encode(RESOURCE_TABLE, ITEMS_NAMESPACE, "TotalSupply");
        ResourceId itemsErc1155System = _erc1155SystemId(ITEMS_NAMESPACE);

        ResourceId charsErc721System = _erc721SystemId(CHARACTERS_NAMESPACE);

        ResourceId badgesErc721System = _erc721SystemId(BADGES_NAMESPACE);
        ResourceId badgesOwners = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Owners");
        ResourceId badgesBalances = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Balances");

        ResourceId fragsErc721System = _erc721SystemId(FRAGMENTS_NAMESPACE);
        ResourceId fragsOwners = WorldResourceIdLib.encode(RESOURCE_TABLE, FRAGMENTS_NAMESPACE, "Owners");
        ResourceId fragsBalances = WorldResourceIdLib.encode(RESOURCE_TABLE, FRAGMENTS_NAMESPACE, "Balances");

        // --- Step 4: Grant Gold namespace access ---
        // CharacterCore needs Gold:Balances for enterGame gold grant
        ResourceAccess.set(goldBalances, characterCore, true);
        // LootManager needs Gold:Balances + TotalSupply for gold rewards
        ResourceAccess.set(goldBalances, lootManager, true);
        ResourceAccess.set(goldTotalSupply, lootManager, true);
        // GasStation needs Gold:Balances + TotalSupply for gold→ETH swaps
        ResourceAccess.set(goldBalances, gasStation, true);
        ResourceAccess.set(goldTotalSupply, gasStation, true);
        // ShopSystem needs Gold:Balances + TotalSupply for purchases
        ResourceAccess.set(goldBalances, shopSystem, true);
        ResourceAccess.set(goldTotalSupply, shopSystem, true);
        // PveRewardSystem needs Gold:Balances + TotalSupply for combat rewards
        ResourceAccess.set(goldBalances, pveReward, true);
        ResourceAccess.set(goldTotalSupply, pveReward, true);
        // MarketplaceSystem needs Gold namespace for gold transfers during purchases
        ResourceAccess.set(goldNs, marketplace, true);
        // World needs namespace access (for delegatecall systems)
        ResourceAccess.set(goldNs, worldAddress, true);
        ResourceAccess.set(goldBalances, worldAddress, true);
        ResourceAccess.set(goldErc20System, worldAddress, true);

        // --- Step 5: Grant Items namespace access ---
        // CharacterCore needs Items:Owners for enterGame starter items
        ResourceAccess.set(itemsOwners, characterCore, true);
        // LootManager needs Items:Owners + TotalSupply for loot drops
        ResourceAccess.set(itemsOwners, lootManager, true);
        ResourceAccess.set(itemsTotalSupply, lootManager, true);
        // ItemsSystem + ItemCreation need Items namespace
        ResourceAccess.set(itemsNs, itemsSystem, true);
        ResourceAccess.set(itemsNs, itemCreation, true);
        ResourceAccess.set(itemsNs, adminSystem, true);
        ResourceAccess.set(itemsErc1155System, itemsSystem, true);
        // MarketplaceSystem needs Items namespace + ERC1155 for listing/buying items
        ResourceAccess.set(itemsNs, marketplace, true);
        ResourceAccess.set(itemsErc1155System, marketplace, true);
        // World needs namespace access
        ResourceAccess.set(itemsNs, worldAddress, true);
        ResourceAccess.set(itemsOwners, worldAddress, true);
        ResourceAccess.set(itemsErc1155System, worldAddress, true);

        // --- Step 6: Grant Characters namespace access ---
        // CharacterCore needs Characters:ERC721System
        ResourceAccess.set(charsErc721System, characterCore, true);
        // World needs namespace access
        ResourceAccess.set(charsErc721System, worldAddress, true);
        ResourceAccess.set(charsNs, worldAddress, true);

        // --- Step 7: Grant Badges namespace access ---
        // LevelSystem, AdminSystem, StatSystem need Badges tables for minting
        address[3] memory badgeWriters = [levelSystem, adminSystem, statSystem];
        for (uint256 i = 0; i < 3; i++) {
            ResourceAccess.set(badgesErc721System, badgeWriters[i], true);
            ResourceAccess.set(badgesOwners, badgeWriters[i], true);
            ResourceAccess.set(badgesBalances, badgeWriters[i], true);
        }
        // World needs namespace access
        ResourceAccess.set(badgesNs, worldAddress, true);
        ResourceAccess.set(badgesErc721System, worldAddress, true);

        // --- Step 8: Grant Fragments namespace access ---
        ResourceAccess.set(fragsErc721System, fragmentSystem, true);
        ResourceAccess.set(fragsOwners, fragmentSystem, true);
        ResourceAccess.set(fragsBalances, fragmentSystem, true);
        ResourceAccess.set(fragsNs, worldAddress, true);
        ResourceAccess.set(fragsErc721System, worldAddress, true);
    }
}

contract FixAccessRoot is Script {
    function run(address worldAddress) external {
        IWorld world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Fix Access Root ===");
        console.log("World:", worldAddress);
        console.log("Deployer:", deployer);

        // Deploy the temporary root system
        FixAccessRootSystem fixSystem = new FixAccessRootSystem();
        console.log("Temporary root system deployed:", address(fixSystem));

        // Register it as a root system
        ResourceId fixSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "FixAccessRoot");
        world.registerSystem(fixSystemId, fixSystem, true);
        console.log("Registered as root system");

        // Call via world.call (bypasses function selector registration)
        world.call(
            fixSystemId,
            abi.encodeCall(FixAccessRootSystem.fixAll, (deployer, worldAddress))
        );
        console.log("All access grants applied + namespace ownership restored to deployer");

        vm.stopBroadcast();
    }
}
