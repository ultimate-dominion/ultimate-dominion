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
import {GOLD_NAMESPACE, CHARACTERS_NAMESPACE, ITEMS_NAMESPACE, BADGES_NAMESPACE, FRAGMENTS_NAMESPACE, WORLD_NAMESPACE} from "../constants.sol";

/**
 * @title EnsureAccessSystem
 * @notice Root system that ensures all cross-namespace access grants are in place.
 *         Designed to be run after every `mud deploy` to fix orphaned grants.
 *
 *         Root systems run via delegatecall with World context, bypassing all access checks.
 *         This lets us fix namespace ownership and grants regardless of current state.
 *
 *         Idempotent — safe to run repeatedly. ResourceAccess.set(x, y, true) is a no-op
 *         if the grant already exists (just costs a small amount of gas).
 */
contract EnsureAccessSystem is System {
    function ensureAll(address deployer, address worldAddress) public {
        // ================================================================
        // Step 1: Restore namespace ownership to deployer
        // This ensures the deployer can manage grants in future deploys.
        // Characters namespace is transferred to CharacterCore at the end.
        // ================================================================
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

        // ================================================================
        // Step 2: Look up current system addresses from the World
        // These change after every `mud deploy` — never hardcode them.
        // ================================================================
        address characterCore = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "CharacterCore"));
        address charEnterSys = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "CharEnterSys"));
        address levelSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "LevelSystem"));
        address adminSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "AdminSystem"));
        address statSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "StatSystem"));
        address lootManager = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "LootManagerSyste"));
        address gasStation = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "GasStationSys"));
        address itemsSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "ItemsSystem"));
        address itemCreation = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "ItemCreationSys"));
        address fragmentSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "FragmentSystem"));
        address pveReward = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "PveRewardSystem"));
        address pvpReward = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "PvpRewardSystem"));
        address pvpSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "PvPSystem"));
        address shopSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "ShopSystem"));
        address marketplace = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "MarketplaceSys"));

        // ================================================================
        // Step 3: Build cross-namespace resource IDs
        // ================================================================
        ResourceId goldBalances = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "Balances");
        ResourceId goldTotalSupply = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "TotalSupply");
        ResourceId goldErc20System = _erc20SystemId(GOLD_NAMESPACE);
        ResourceId goldAllowances = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "Allowances");

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

        // ================================================================
        // Step 4: Gold namespace grants
        // ================================================================
        // CharacterEnterSystem — starter gold on enterGame (writes Balances + TotalSupply)
        ResourceAccess.set(goldBalances, charEnterSys, true);
        ResourceAccess.set(goldTotalSupply, charEnterSys, true);
        ResourceAccess.set(goldErc20System, charEnterSys, true);
        // LootManager — gold rewards from combat
        ResourceAccess.set(goldBalances, lootManager, true);
        ResourceAccess.set(goldTotalSupply, lootManager, true);
        ResourceAccess.set(goldErc20System, lootManager, true);
        // GasStation — gold→ETH swaps + goldTransfer
        ResourceAccess.set(goldBalances, gasStation, true);
        ResourceAccess.set(goldTotalSupply, gasStation, true);
        ResourceAccess.set(goldErc20System, gasStation, true);
        ResourceAccess.set(goldAllowances, gasStation, true);
        // ShopSystem — purchases via GoldLib.goldBurn/goldMint
        ResourceAccess.set(goldBalances, shopSystem, true);
        ResourceAccess.set(goldTotalSupply, shopSystem, true);
        ResourceAccess.set(goldErc20System, shopSystem, true);
        // PveRewardSystem — combat gold rewards via GoldLib.goldMint
        ResourceAccess.set(goldBalances, pveReward, true);
        ResourceAccess.set(goldTotalSupply, pveReward, true);
        ResourceAccess.set(goldErc20System, pveReward, true);
        // PvpRewardSystem — PvP gold redistribution via GoldLib.goldBurn/goldTransfer
        ResourceAccess.set(goldBalances, pvpReward, true);
        ResourceAccess.set(goldTotalSupply, pvpReward, true);
        ResourceAccess.set(goldErc20System, pvpReward, true);
        ResourceAccess.set(goldAllowances, pvpReward, true);
        // PvPSystem — flee gold burns/transfers via GoldLib
        ResourceAccess.set(goldBalances, pvpSystem, true);
        ResourceAccess.set(goldTotalSupply, pvpSystem, true);
        ResourceAccess.set(goldErc20System, pvpSystem, true);
        ResourceAccess.set(goldAllowances, pvpSystem, true);
        // MarketplaceSystem — gold transfers for trades
        ResourceAccess.set(goldNs, marketplace, true);
        ResourceAccess.set(goldBalances, marketplace, true);
        ResourceAccess.set(goldErc20System, marketplace, true);
        ResourceAccess.set(goldAllowances, marketplace, true);
        // World — delegatecall systems need World-level access
        ResourceAccess.set(goldNs, worldAddress, true);
        ResourceAccess.set(goldBalances, worldAddress, true);
        ResourceAccess.set(goldErc20System, worldAddress, true);
        ResourceAccess.set(goldAllowances, worldAddress, true);

        // ================================================================
        // Step 5: Items namespace grants
        // ================================================================
        // CharacterEnterSystem — starter items on enterGame
        ResourceAccess.set(itemsOwners, charEnterSys, true);
        // LootManager — loot drops
        ResourceAccess.set(itemsOwners, lootManager, true);
        ResourceAccess.set(itemsTotalSupply, lootManager, true);
        // ItemsSystem + ItemCreation + Admin — item management
        ResourceAccess.set(itemsNs, itemsSystem, true);
        ResourceAccess.set(itemsNs, itemCreation, true);
        ResourceAccess.set(itemsNs, adminSystem, true);
        ResourceAccess.set(itemsErc1155System, itemsSystem, true);
        // ShopSystem — selling items
        ResourceAccess.set(itemsOwners, shopSystem, true);
        // MarketplaceSystem — item trades
        ResourceAccess.set(itemsNs, marketplace, true);
        ResourceAccess.set(itemsErc1155System, marketplace, true);
        ResourceAccess.set(itemsOwners, marketplace, true);
        // World — delegatecall
        ResourceAccess.set(itemsNs, worldAddress, true);
        ResourceAccess.set(itemsOwners, worldAddress, true);
        ResourceAccess.set(itemsErc1155System, worldAddress, true);

        // ================================================================
        // Step 6: Characters namespace grants
        // ================================================================
        // CharacterCore gets namespace ownership (transferred in Step 8)
        // but also needs explicit ERC721System access
        ResourceAccess.set(charsErc721System, characterCore, true);
        // World — delegatecall
        ResourceAccess.set(charsErc721System, worldAddress, true);
        ResourceAccess.set(charsNs, worldAddress, true);

        // ================================================================
        // Step 7: Badges namespace grants
        // ================================================================
        address[4] memory badgeWriters = [levelSystem, adminSystem, statSystem, fragmentSystem];
        for (uint256 i = 0; i < 4; i++) {
            ResourceAccess.set(badgesErc721System, badgeWriters[i], true);
            ResourceAccess.set(badgesOwners, badgeWriters[i], true);
            ResourceAccess.set(badgesBalances, badgeWriters[i], true);
        }
        ResourceAccess.set(badgesNs, worldAddress, true);
        ResourceAccess.set(badgesErc721System, worldAddress, true);

        // ================================================================
        // Step 8: Fragments namespace grants
        // ================================================================
        ResourceAccess.set(fragsErc721System, fragmentSystem, true);
        ResourceAccess.set(fragsOwners, fragmentSystem, true);
        ResourceAccess.set(fragsBalances, fragmentSystem, true);
        ResourceAccess.set(fragsNs, worldAddress, true);
        ResourceAccess.set(fragsErc721System, worldAddress, true);

        // ================================================================
        // Step 9: Transfer Characters namespace to CharacterCore
        // CharacterCore needs namespace ownership to write Characters,
        // CharacterOwner, NameExists, Counters, and ERC721 tables.
        // ================================================================
        NamespaceOwner.set(charsNs, characterCore);
        ResourceAccess.set(charsNs, characterCore, true);
    }
}

/**
 * @title EnsureAccess
 * @notice Forge script that deploys EnsureAccessSystem as a root system and calls it.
 *
 * Usage:
 *   source .env.testnet && forge script script/EnsureAccess.s.sol \
 *     --sig "run(address)" $WORLD_ADDRESS \
 *     --rpc-url $RPC_URL --broadcast
 *
 * Run after every `mud deploy` to ensure cross-namespace access grants are in place.
 */
contract EnsureAccess is Script {
    function run(address worldAddress) external {
        StoreSwitch.setStoreAddress(worldAddress);

        // Use --private-key CLI flag for broadcast — avoids .env conflicts.
        // forge auto-loads .env (Anvil key) which overrides shell-sourced
        // .env.testnet / .env.mainnet. Using vm.startBroadcast() without
        // args reads from --private-key, bypassing that conflict entirely.
        vm.startBroadcast();
        address deployer = msg.sender;

        console.log("=== EnsureAccess ===");
        console.log("World:", worldAddress);
        console.log("Deployer:", deployer);

        // Deploy the root system
        EnsureAccessSystem accessSystem = new EnsureAccessSystem();

        // Register as root system (reuse FixAccessRoot slot if exists)
        ResourceId systemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "EnsureAccess");
        try IWorld(worldAddress).registerSystem(systemId, accessSystem, true) {
            console.log("Registered EnsureAccessSystem");
        } catch {
            // Already registered — upgrade to new implementation
            IWorld(worldAddress).registerSystem(systemId, accessSystem, true);
            console.log("Upgraded EnsureAccessSystem");
        }

        // Call via world.call (root system, bypasses function selectors)
        IWorld(worldAddress).call(
            systemId,
            abi.encodeCall(EnsureAccessSystem.ensureAll, (deployer, worldAddress))
        );
        console.log("All cross-namespace access grants applied");

        vm.stopBroadcast();
    }
}
