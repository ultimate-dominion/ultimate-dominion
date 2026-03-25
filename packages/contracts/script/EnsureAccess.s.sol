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
import {GoldERC20System} from "../src/systems/GoldERC20System.sol";

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
    function _sys(bytes16 name) internal view returns (address) {
        return Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, name));
    }

    function ensureAll(address deployer, address worldAddress) public {
        _ensureNamespaceOwnership(deployer);
        _ensureGoldAccess(worldAddress);
        _ensureItemsAccess(worldAddress);
        _ensureCharactersAccess(worldAddress);
        _ensureBadgesAccess(worldAddress);
        _ensureFragmentsAccess(worldAddress);
        _transferCharacterNamespace();
    }

    function _ensureNamespaceOwnership(address deployer) internal {
        NamespaceOwner.set(WorldResourceIdLib.encodeNamespace(GOLD_NAMESPACE), deployer);
        NamespaceOwner.set(WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE), deployer);
        NamespaceOwner.set(WorldResourceIdLib.encodeNamespace(CHARACTERS_NAMESPACE), deployer);
        NamespaceOwner.set(WorldResourceIdLib.encodeNamespace(BADGES_NAMESPACE), deployer);
        NamespaceOwner.set(WorldResourceIdLib.encodeNamespace(FRAGMENTS_NAMESPACE), deployer);
    }

    function _ensureGoldAccess(address worldAddress) internal {
        ResourceId goldNs = WorldResourceIdLib.encodeNamespace(GOLD_NAMESPACE);
        ResourceAccess.set(goldNs, _sys("CharEnterSys"), true);
        ResourceAccess.set(goldNs, _sys("LootManagerSyste"), true);
        ResourceAccess.set(goldNs, _sys("GasStationSys"), true);
        ResourceAccess.set(goldNs, _sys("ShopSystem"), true);
        ResourceAccess.set(goldNs, _sys("PveRewardSystem"), true);
        ResourceAccess.set(goldNs, _sys("PvpRewardSystem"), true);
        ResourceAccess.set(goldNs, _sys("PvPSystem"), true);
        ResourceAccess.set(goldNs, _sys("MarketplaceSys"), true);
        // Phase 3-5: DurabilitySystem (repair), RespecSystem (respec), GuildSystem (treasury)
        ResourceAccess.set(goldNs, _sys("DurabilitySys"), true);
        ResourceAccess.set(goldNs, _sys("RespecSystem"), true);
        ResourceAccess.set(goldNs, _sys("GuildSystem"), true);
        ResourceAccess.set(goldNs, worldAddress, true);
    }

    function _ensureItemsAccess(address worldAddress) internal {
        ResourceId itemsNs = WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE);
        ResourceId itemsOwners = WorldResourceIdLib.encode(RESOURCE_TABLE, ITEMS_NAMESPACE, "Owners");
        ResourceId itemsTotalSupply = WorldResourceIdLib.encode(RESOURCE_TABLE, ITEMS_NAMESPACE, "TotalSupply");
        ResourceId itemsErc1155System = _erc1155SystemId(ITEMS_NAMESPACE);

        address charEnterSys = _sys("CharEnterSys");
        address lootManager = _sys("LootManagerSyste");
        address itemsSystem = _sys("ItemsSystem");
        address itemCreation = _sys("ItemCreationSys");
        address adminSystem = _sys("AdminSystem");
        address shopSystem = _sys("ShopSystem");
        address marketplace = _sys("MarketplaceSys");

        ResourceAccess.set(itemsOwners, charEnterSys, true);
        ResourceAccess.set(itemsOwners, lootManager, true);
        ResourceAccess.set(itemsTotalSupply, lootManager, true);
        ResourceAccess.set(itemsNs, itemsSystem, true);
        ResourceAccess.set(itemsNs, itemCreation, true);
        ResourceAccess.set(itemsNs, adminSystem, true);
        ResourceAccess.set(itemsErc1155System, itemsSystem, true);
        ResourceAccess.set(itemsOwners, shopSystem, true);
        ResourceAccess.set(itemsNs, marketplace, true);
        ResourceAccess.set(itemsErc1155System, marketplace, true);
        ResourceAccess.set(itemsOwners, marketplace, true);
        ResourceAccess.set(itemsNs, worldAddress, true);
        ResourceAccess.set(itemsOwners, worldAddress, true);
        ResourceAccess.set(itemsErc1155System, worldAddress, true);
    }

    function _ensureCharactersAccess(address worldAddress) internal {
        ResourceId charsNs = WorldResourceIdLib.encodeNamespace(CHARACTERS_NAMESPACE);
        ResourceId charsErc721System = _erc721SystemId(CHARACTERS_NAMESPACE);
        ResourceAccess.set(charsErc721System, _sys("CharacterCore"), true);
        ResourceAccess.set(charsErc721System, worldAddress, true);
        ResourceAccess.set(charsNs, worldAddress, true);
    }

    function _ensureBadgesAccess(address worldAddress) internal {
        ResourceId badgesNs = WorldResourceIdLib.encodeNamespace(BADGES_NAMESPACE);
        ResourceId badgesErc721System = _erc721SystemId(BADGES_NAMESPACE);
        ResourceId badgesOwners = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Owners");
        ResourceId badgesBalances = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Balances");

        address[5] memory writers = [
            _sys("LevelSystem"), _sys("AdminSystem"), _sys("StatSystem"),
            _sys("FragmentSystem"), _sys("ZoneTransSys")
        ];
        for (uint256 i = 0; i < 5; i++) {
            ResourceAccess.set(badgesErc721System, writers[i], true);
            ResourceAccess.set(badgesOwners, writers[i], true);
            ResourceAccess.set(badgesBalances, writers[i], true);
        }
        ResourceAccess.set(badgesNs, worldAddress, true);
        ResourceAccess.set(badgesErc721System, worldAddress, true);
    }

    function _ensureFragmentsAccess(address worldAddress) internal {
        ResourceId fragsNs = WorldResourceIdLib.encodeNamespace(FRAGMENTS_NAMESPACE);
        ResourceId fragsErc721System = _erc721SystemId(FRAGMENTS_NAMESPACE);
        ResourceId fragsOwners = WorldResourceIdLib.encode(RESOURCE_TABLE, FRAGMENTS_NAMESPACE, "Owners");
        ResourceId fragsBalances = WorldResourceIdLib.encode(RESOURCE_TABLE, FRAGMENTS_NAMESPACE, "Balances");
        address fragmentSystem = _sys("FragmentSystem");
        ResourceAccess.set(fragsErc721System, fragmentSystem, true);
        ResourceAccess.set(fragsOwners, fragmentSystem, true);
        ResourceAccess.set(fragsBalances, fragmentSystem, true);
        ResourceAccess.set(fragsNs, worldAddress, true);
        ResourceAccess.set(fragsErc721System, worldAddress, true);
    }

    function _transferCharacterNamespace() internal {
        ResourceId charsNs = WorldResourceIdLib.encodeNamespace(CHARACTERS_NAMESPACE);
        address characterCore = _sys("CharacterCore");
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

        // Deploy and register GoldERC20System — replaces the default ERC20System
        // for the Gold namespace with one that checks access instead of ownership
        // for mint/burn. This enables cross-namespace GoldLib calls.
        GoldERC20System goldSystem = new GoldERC20System();
        ResourceId goldErc20SystemId = _erc20SystemId(GOLD_NAMESPACE);
        IWorld(worldAddress).registerSystem(goldErc20SystemId, goldSystem, true);
        console.log("Registered GoldERC20System at", address(goldSystem));

        vm.stopBroadcast();
    }
}
