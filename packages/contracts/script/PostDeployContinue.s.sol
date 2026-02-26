// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM, RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {_erc1155SystemId} from "../src/utils.sol";
import {GOLD_NAMESPACE, ITEMS_NAMESPACE, WORLD_NAMESPACE, DEFAULT_ETH_PER_GOLD, DEFAULT_MAX_GOLD_PER_SWAP, DEFAULT_GAS_COOLDOWN, GAME_DELEGATION_NAME} from "../constants.sol";
import {GasStationConfig, AllowedGameSystems, Paused, MapConfig, Admin, Levels} from "@codegen/index.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {GameDelegationControl} from "../src/systems/GameDelegationControl.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {_ownersTableId, _totalSupplyTableId} from "@erc1155/utils.sol";
import {_lootManagerSystemId} from "../src/utils.sol";

/**
 * @title PostDeployContinue
 * @notice Continuation script for PostDeploy - runs only steps that didn't complete
 *         in the initial PostDeploy run (steps 7-10: grant access, seed, gasstation, delegation, transfer)
 */
contract PostDeployContinue is Script {
    IWorld public world;
    address public deployer;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("PostDeploy Continuation");
        console.log("World:", _worldAddress);
        console.log("Deployer:", deployer);

        // Step 7: Grant access for game data seeding
        _grantDeployerAccess();

        // Step 8: Seed game data
        console.log("");
        console.log(">>> Seeding Game Data <<<");
        _seedGameData();

        // Step 9: Configure GasStation
        _configureGasStation();

        // Step 9.5: Configure GameDelegationControl whitelist
        _configureGameDelegation();

        // Step 10: Transfer namespace ownership
        _transferItemsOwnership();

        vm.stopBroadcast();

        console.log("");
        console.log("PostDeploy continuation COMPLETE");
    }

    function _grantDeployerAccess() internal {
        console.log("Granting deployer access...");

        ResourceId udNamespaceId = WorldResourceIdLib.encodeNamespace("UD");
        ResourceId effectsSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "EffectsSystem");
        ResourceId itemsSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ItemsSystem");
        ResourceId mobSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MobSystem");

        world.grantAccess(udNamespaceId, deployer);
        console.log("  Granted UD namespace access");

        world.grantAccess(effectsSystemId, deployer);
        console.log("  Granted EffectsSystem access");

        world.grantAccess(itemsSystemId, deployer);
        console.log("  Granted ItemsSystem access");

        world.grantAccess(mobSystemId, deployer);
        console.log("  Granted MobSystem access");

        // Grant LootManagerSystem access to Items namespace tables
        ResourceId lootManagerSystemId = _lootManagerSystemId(WORLD_NAMESPACE);
        address lootManagerAddress = Systems.getSystem(lootManagerSystemId);
        console.log("  LootManagerSystem address:", lootManagerAddress);

        ResourceId itemsOwnersTableId = _ownersTableId(ITEMS_NAMESPACE);
        world.grantAccess(itemsOwnersTableId, lootManagerAddress);
        console.log("  Granted Items:Owners table access to LootManagerSystem");

        ResourceId itemsTotalSupplyTableId = _totalSupplyTableId(ITEMS_NAMESPACE);
        world.grantAccess(itemsTotalSupplyTableId, lootManagerAddress);
        console.log("  Granted Items:TotalSupply table access to LootManagerSystem");

        ResourceId goldBalancesTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "Balances");
        world.grantAccess(goldBalancesTableId, lootManagerAddress);
        console.log("  Granted Gold:Balances table access to LootManagerSystem");

        ResourceId goldTotalSupplyTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "TotalSupply");
        world.grantAccess(goldTotalSupplyTableId, lootManagerAddress);
        console.log("  Granted Gold:TotalSupply table access to LootManagerSystem");

        // Grant AdminSystem access
        ResourceId adminSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "AdminSystem");
        address adminSystemAddress = Systems.getSystem(adminSystemId);
        console.log("  AdminSystem address:", adminSystemAddress);

        ResourceId itemsNamespaceId = WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE);
        world.grantAccess(itemsNamespaceId, adminSystemAddress);
        console.log("  Granted Items namespace access to AdminSystem");

        Admin.set(adminSystemAddress, true);
        console.log("  AdminSystem added to Admin table");

        // Grant ItemsSystem access
        ResourceId itemsSystemResourceId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ItemsSystem");
        address itemsSystemAddress = Systems.getSystem(itemsSystemResourceId);
        console.log("  ItemsSystem address:", itemsSystemAddress);

        world.grantAccess(itemsNamespaceId, itemsSystemAddress);
        console.log("  Granted Items namespace access to ItemsSystem");

        ResourceId erc1155SystemId = _erc1155SystemId(ITEMS_NAMESPACE);
        world.grantAccess(erc1155SystemId, itemsSystemAddress);
        console.log("  Granted ERC1155System access to ItemsSystem");

        Admin.set(itemsSystemAddress, true);
        console.log("  ItemsSystem added to Admin table");

        // Grant ItemCreationSystem access
        ResourceId itemCreationSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ItemCreationSys");
        address itemCreationSystemAddress = Systems.getSystem(itemCreationSystemId);
        world.grantAccess(itemsNamespaceId, itemCreationSystemAddress);
        console.log("  Granted Items namespace access to ItemCreationSystem");
        Admin.set(itemCreationSystemAddress, true);
        console.log("  ItemCreationSystem added to Admin table");

        // Grant MarketplaceSystem access
        ResourceId marketplaceSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MarketplaceSyste");
        address marketplaceSystemAddress = Systems.getSystem(marketplaceSystemId);
        console.log("  MarketplaceSystem address:", marketplaceSystemAddress);

        world.grantAccess(itemsNamespaceId, marketplaceSystemAddress);
        console.log("  Granted Items namespace access to MarketplaceSystem");

        world.grantAccess(erc1155SystemId, marketplaceSystemAddress);
        console.log("  Granted ERC1155System access to MarketplaceSystem");

        ResourceId goldNamespaceId = WorldResourceIdLib.encodeNamespace(GOLD_NAMESPACE);
        world.grantAccess(goldNamespaceId, marketplaceSystemAddress);
        console.log("  Granted Gold namespace access to MarketplaceSystem");

        // Grant MobSystem admin
        ResourceId mobSystemResourceId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MobSystem");
        address mobSystemAddress = Systems.getSystem(mobSystemResourceId);
        console.log("  MobSystem address:", mobSystemAddress);
        Admin.set(mobSystemAddress, true);
        console.log("  MobSystem added to Admin table");

        // Set max players and system addresses
        UltimateDominionConfig.setMaxPlayers(100);
        console.log("  Max players: 100");

        UltimateDominionConfig.setLootManager(address(world));
        console.log("  LootManager address:", address(world));

        ResourceId shopSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "ShopSystem");
        address shopSysAddr = Systems.getSystem(shopSystemId);
        require(shopSysAddr != address(0), "ShopSystem not registered");
        UltimateDominionConfig.setShop(shopSysAddr);
        console.log("  Shop address:", shopSysAddr);

        UltimateDominionConfig.setMarketplace(address(world));
        console.log("  Marketplace address:", address(world));

        UltimateDominionConfig.setFeeRecipient(deployer);
        console.log("  Fee recipient:", deployer);
        UltimateDominionConfig.setFeePercent(300);
        console.log("  Fee percent: 3% (300 basis points)");
    }

    function _seedGameData() internal {
        address lootManagerAddress = address(world);
        console.log("LootManager/World address for items:", lootManagerAddress);

        address itemsCounterAddress = UltimateDominionConfig.getItems();
        console.log("Items contract address:", itemsCounterAddress);

        MapConfig.set(uint16(10), uint16(10));
        console.log("Map config set: 10 x 10");

        Admin.set(deployer, true);
        console.log("Admin set");

        Paused.set(false);
        console.log("Pause state initialized (unpaused)");

        _setLevels();
        console.log("Level requirements set");

        console.log("Infrastructure seeding complete!");
    }

    function _setLevels() internal {
        Levels.setExperience(1, 300);
        Levels.setExperience(2, 900);
        Levels.setExperience(3, 2700);
        Levels.setExperience(4, 6500);
        Levels.setExperience(5, 14000);
        Levels.setExperience(6, 23000);
        Levels.setExperience(7, 34000);
        Levels.setExperience(8, 48000);
        Levels.setExperience(9, 64000);
        Levels.setExperience(10, 85000);

        uint256 baseExp = 85000;
        for (uint256 level = 11; level <= 50; level++) {
            baseExp = baseExp + (level * 5000);
            Levels.setExperience(level, baseExp);
        }
        for (uint256 level = 51; level <= 100; level++) {
            baseExp = baseExp + (level * 15000);
            Levels.setExperience(level, baseExp);
        }
    }

    function _configureGasStation() internal {
        console.log("Configuring GasStation...");

        ResourceId gasStationSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "GasStationSys");
        address gasStationAddress = Systems.getSystem(gasStationSystemId);
        console.log("  GasStationSystem address:", gasStationAddress);

        ResourceId goldBalancesTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "Balances");
        world.grantAccess(goldBalancesTableId, gasStationAddress);
        console.log("  Granted Gold:Balances table access to GasStation");

        ResourceId goldTotalSupplyTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "TotalSupply");
        world.grantAccess(goldTotalSupplyTableId, gasStationAddress);
        console.log("  Granted Gold:TotalSupply table access to GasStation");

        GasStationConfig.set(DEFAULT_ETH_PER_GOLD, DEFAULT_MAX_GOLD_PER_SWAP, DEFAULT_GAS_COOLDOWN, true);
        console.log("  GasStation config set");
    }

    function _configureGameDelegation() internal {
        console.log("Configuring GameDelegationControl...");

        GameDelegationControl gameDelegation = new GameDelegationControl();
        ResourceId gameDelegationId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", GAME_DELEGATION_NAME);
        world.registerSystem(gameDelegationId, System(address(gameDelegation)), true);
        console.log("  GameDelegationControl registered at:", address(gameDelegation));

        console.log("Configuring whitelist...");
        bytes14 ns = "UD";

        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "CharacterCore"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "StatSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "LevelSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "ImplicitClassSys"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "EquipmentCore"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "EquipmentSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "WeaponSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "ArmorSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "AccessorySystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "ConsumableSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "MapSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "MapSpawnSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "CombatSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "PvESystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "PvPSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "EncounterSys"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "ShopSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "MarketplaceSys"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "GasStationSys"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "LootManagerSyste"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "PveRewardSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "PvpRewardSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "WorldActionSys"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "FragmentSystem"), true);
        AllowedGameSystems.setAllowed(WorldResourceIdLib.encode(RESOURCE_SYSTEM, ns, "UtilsSystem"), true);

        console.log("  25 gameplay systems whitelisted");
    }

    function _transferItemsOwnership() internal {
        console.log("Transferring namespace ownership to World...");

        ResourceId itemsNamespaceId = WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE);
        world.transferOwnership(itemsNamespaceId, address(world));
        console.log("  Transferred Items namespace ownership to World");

        ResourceId goldNamespaceId = WorldResourceIdLib.encodeNamespace(GOLD_NAMESPACE);
        world.transferOwnership(goldNamespaceId, address(world));
        console.log("  Transferred Gold namespace ownership to World");
    }
}
