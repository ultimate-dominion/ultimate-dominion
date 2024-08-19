// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {StoreCore, EncodedLengths} from "@latticexyz/store/src/StoreCore.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {ResourceIdLib} from "@latticexyz/store/src/ResourceId.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {registerERC721} from "@latticexyz/world-modules/src/modules/erc721-puppet/registerERC721.sol";
import {ERC721System} from "@latticexyz/world-modules/src/modules/erc721-puppet/ERC721System.sol";
import {ERC721MetadataData} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/ERC721Metadata.sol";
import {BEFORE_CALL_SYSTEM} from "@latticexyz/world/src/systemHookTypes.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {ERC20MetadataData} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/ERC20Metadata.sol";
import {ERC20System} from "@latticexyz/world-modules/src/modules/erc20-puppet/ERC20System.sol";
import {registerERC20} from "@latticexyz/world-modules/src/modules/erc20-puppet/registerERC20.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {IAdapter} from "@interfaces/IAdapter.sol";
import {IRngSystem} from "@interfaces/IRngSystem.sol";
import {AdapterForTest} from "@test/mocks/AdapterForTest.sol";
import {IWorld} from "@world/IWorld.sol";
import {UltimateDominionConfig, Levels, MapConfig, Admin} from "@codegen/index.sol";
import {CharacterSystem} from "@systems/CharacterSystem.sol";
import {RngSystem} from "@systems/RngSystem.sol";
import {
    GOLD_NAMESPACE,
    CHARACTERS_NAMESPACE,
    ERC721_NAME,
    ERC721_SYMBOL,
    ITEMS_NAMESPACE,
    TOKEN_URI
} from "../constants.sol";
import {_lootManagerSystemId} from "../src/utils.sol";
import {NoTransferHook} from "../src/NoTransferHook.sol";
import {Classes, ItemType, MobType, ActionType} from "@codegen/common.sol";
import {
    WeaponStats,
    MonsterStats,
    MonsterTemplateDetails,
    WeaponTemplateDetails,
    ArmorTemplateDetails,
    ArmorStats,
    PhysicalAttackStats,
    StarterItems,
    StarterActions,
    PhysicalAttackTemplate
} from "@interfaces/Structs.sol";

import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";

import "forge-std/console2.sol";
import "forge-std/StdJson.sol";

struct ResourceIds {
    ResourceId erc721SystemId;
    ResourceId erc721NamespaceId;
    ResourceId characterSystemId;
    ResourceId erc20SystemId;
    ResourceId erc20NamespaceId;
    ResourceId rngSystemId;
    ResourceId erc1155SystemId;
    ResourceId erc1155NamespaceId;
    ResourceId itemsSystemId;
    ResourceId combatSystemId;
    ResourceId lootManagerSystemId;
    ResourceId adminSystemId;
    ResourceId pvpSystemId;
    ResourceId pveSystemId;
}

contract PostDeploy is Script {
    using stdJson for string;

    IWorld public world;
    ResourceIds public resourceIds;
    address public worldAddress;

    function run(address _worldAddress) external {
        worldAddress = _worldAddress;
        world = IWorld(worldAddress);
        // Specify a store so that you can use tables directly in PostDeploy
        StoreSwitch.setStoreAddress(worldAddress);

        // Load the private key from the `PRIVATE_KEY` environment variable (in .env)
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Start broadcasting transactions from the deployer account
        vm.startBroadcast(deployerPrivateKey);
        if (block.chainid == 31337) {
            // Set mock Vrng contracts for anvil
            address adapterForTest = address(new AdapterForTest());
            UltimateDominionConfig.setRandcastAdapter(adapterForTest);
            // redstone garnet
        } else if (block.chainid == 84532) {
            UltimateDominionConfig.setRandcastAdapter(0x323488A9Ad7463081F109468B4E50a5084e91295);
            //redstone mainnet
        } else if (block.chainid == 8453) {
            UltimateDominionConfig.setRandcastAdapter(0x6F8bA6Ab1BAf1833a88ca42E7b71c4fbE76b759D);
            // op sepolia
        } else if (block.chainid == 11155420) {
            UltimateDominionConfig.setRandcastAdapter(0x25Aed37669a783Bb5dE1D40279C7Fe5339C13F5D);
        } else if (block.chainid == 17069) {
            UltimateDominionConfig.setRandcastAdapter(0x323488A9Ad7463081F109468B4E50a5084e91295);
        } else if (block.chainid == 690) {
            UltimateDominionConfig.setRandcastAdapter(0x5D7bb19fC0856f5bc74b66f2c7b0258c1aeafD7f);
        }

        uint16 height = uint16(10);
        uint16 width = uint16(10);
        MapConfig.set(width, height);
        // set deployer as admin
        Admin.set(vm.addr(deployerPrivateKey), true);

        //install puppet
        world.installModule(new PuppetModule(), new bytes(0));

        _addRngSystem();

        // create randcast subscription
        IAdapter(UltimateDominionConfig.getRandcastAdapter()).createSubscription();
        // fund the subscription from deployer wallet with .001 eth;
        IRngSystem(address(world)).fundSubscription{value: 0.001 ether}();

        // install gold module
        IERC20Mintable goldToken = registerERC20(
            world, GOLD_NAMESPACE, ERC20MetadataData({decimals: 18, name: "GoldToken", symbol: unicode"🜚"})
        );

        UltimateDominionConfig.setGoldToken(address(goldToken));

        // characters
        IERC721Mintable characters = registerERC721(
            world,
            CHARACTERS_NAMESPACE,
            ERC721MetadataData({name: ERC721_NAME, symbol: ERC721_SYMBOL, baseURI: TOKEN_URI})
        );

        UltimateDominionConfig.setCharacterToken(address(characters));

        {
            resourceIds.erc20NamespaceId = WorldResourceIdLib.encodeNamespace(GOLD_NAMESPACE);
            resourceIds.erc20SystemId =
                WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: "Gold", name: "GoldToken"});

            resourceIds.characterSystemId =
                WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: "UD", name: "CharacterSystem"});
            resourceIds.adminSystemId =
                WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: "UD", name: "AdminSystem"});

            resourceIds.erc721NamespaceId = WorldResourceIdLib.encodeNamespace(CHARACTERS_NAMESPACE);

            resourceIds.erc721SystemId =
                WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: "Characters", name: "ERC721System"});
            resourceIds.combatSystemId =
                WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: "UD", name: "CombatSystem"});
            resourceIds.erc1155SystemId = _erc1155SystemId(ITEMS_NAMESPACE);
            resourceIds.erc1155NamespaceId = WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE);
            resourceIds.itemsSystemId =
                WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: "UD", name: "ItemsSystem"});
            resourceIds.lootManagerSystemId = _lootManagerSystemId("UD");
            resourceIds.pvpSystemId =
                WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: "UD", name: "PvPSystem"});
            resourceIds.pveSystemId =
                WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: "UD", name: "PvESystem"});
        }

        address characterSystemAddress = Systems.getSystem(resourceIds.characterSystemId);

        System goldSystemContract = new ERC20System();

        world.registerSystem(resourceIds.erc20SystemId, goldSystemContract, true);
        // grant world access to erc20 namespace
        IWorld(worldAddress).grantAccess(resourceIds.erc20NamespaceId, worldAddress);
        //grant character system access to loot manager
        IWorld(worldAddress).grantAccess(resourceIds.lootManagerSystemId, characterSystemAddress);
        //grant Admin system access to lootManager
        IWorld(worldAddress).grantAccess(resourceIds.lootManagerSystemId, Systems.getSystem(resourceIds.adminSystemId));

        //register mint function selector on world
        IWorld(worldAddress).registerFunctionSelector(resourceIds.erc20SystemId, "mint(address,uint256)");

        // transfer erc20 contract ownership to the loot manager system
        world.transferOwnership(resourceIds.erc20NamespaceId, Systems.getSystem(resourceIds.lootManagerSystemId));

        // System systemContract = new ERC721System();

        // world.registerSystem(resourceIds.erc721SystemId, systemContract, true);

        NoTransferHook characterHook = new NoTransferHook();

        world.registerSystemHook(resourceIds.erc721SystemId, characterHook, BEFORE_CALL_SYSTEM);

        // Transfer characters namespace to World
        world.grantAccess(resourceIds.erc721SystemId, worldAddress);
        world.grantAccess(resourceIds.erc721SystemId, characterSystemAddress);
        world.transferOwnership(resourceIds.erc721NamespaceId, characterSystemAddress);

        address items = _deployErc1155(world, ITEMS_NAMESPACE);

        UltimateDominionConfig.setItems(address(items));
        //allow entropy system to call callback on Combat system
        world.grantAccess(resourceIds.combatSystemId, UltimateDominionConfig.getRandcastAdapter());
        world.grantAccess(resourceIds.pvpSystemId, UltimateDominionConfig.getRandcastAdapter());
        world.grantAccess(resourceIds.pveSystemId, UltimateDominionConfig.getRandcastAdapter());
        _createStarterItems();
        _createActions();
        _createMonsters();

        setLevels();
        vm.stopBroadcast();
    }

    function _createActions() internal {
        string memory json = vm.readFile("actions.json");
        bytes memory data = vm.parseJson(json);

        StarterActions memory actionsData = abi.decode(data, (StarterActions));

        for (uint256 i; i < actionsData.physicalAttacks.length; i++) {
            bytes32 newActionId = world.UD__createAction(
                ActionType.PhysicalAttack,
                actionsData.physicalAttacks[i].name,
                abi.encode(actionsData.physicalAttacks[i].stats)
            );
            console2.log("Physical action id: ", i + 1);
            console2.logBytes32(newActionId);
            require(newActionId == actionsData.physicalAttacks[i].actionId, "Physical action Id mismatch");
        }

        for (uint256 i; i < actionsData.magicAttacks.length; i++) {
            bytes32 newActionId = world.UD__createAction(
                ActionType.PhysicalAttack,
                actionsData.magicAttacks[i].name,
                abi.encode(actionsData.magicAttacks[i].stats)
            );
            console2.log("Magic action Id ", i + 1);
            console2.logBytes32(newActionId);
            require(newActionId == actionsData.magicAttacks[i].actionId, "Magical action Id mismatch");
        }
    }

    function _deployErc1155(IWorld _world, bytes14 itemsNamespace) internal returns (address) {
        string memory json = vm.readFile("items.json");
        string memory metadataUriPrefix = json.readString(".metadataUriPrefix");

        IERC1155 _items = registerERC1155(_world, itemsNamespace, metadataUriPrefix);

        // ERC1155System erc1155System = new ERC1155System();
        address itemsSystemAddress = Systems.getSystem(resourceIds.itemsSystemId);

        // _world.registerSystem(resourceIds.erc1155SystemId, erc1155System, false);
        _world.grantAccess(resourceIds.erc1155SystemId, worldAddress);
        world.transferOwnership(resourceIds.erc1155NamespaceId, itemsSystemAddress);
        return address(_items);
    }

    function _addRngSystem() internal {
        System rngSystem = new RngSystem();

        resourceIds.rngSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "RngSystem");

        world.registerSystem(resourceIds.rngSystemId, rngSystem, true);
        world.registerRootFunctionSelector(
            resourceIds.rngSystemId, "getRng(bytes32,uint8,bytes)", "getRng(bytes32,uint8,bytes)"
        );
        world.registerRootFunctionSelector(
            resourceIds.rngSystemId, "fulfillRandomness(bytes32,uint256)", "fulfillRandomness(bytes32,uint256)"
        );
        world.registerRootFunctionSelector(
            resourceIds.rngSystemId, "_fulfillRandomness(bytes32,uint256)", "_fulfillRandomness(bytes32,uint256)"
        );
        world.registerRootFunctionSelector(resourceIds.rngSystemId, "estimateFee()", "estimateFee()");
        world.registerRootFunctionSelector(resourceIds.rngSystemId, "getEntropy()", "getEntropy()");
        world.registerRootFunctionSelector(resourceIds.rngSystemId, "createSubscription()", "createSubscription()");
        world.registerRootFunctionSelector(
            resourceIds.rngSystemId, "requiredTxGas(address,uint256,bytes)", "requiredTxGas(address,uint256,bytes)"
        );
        world.registerRootFunctionSelector(resourceIds.rngSystemId, "fundSubscription()", "fundSubscription()");
    }

    function _createStarterItems() internal {
        string memory json = vm.readFile("items.json");
        bytes memory data = vm.parseJson(json);

        StarterItems memory itemsData = abi.decode(data, (StarterItems));

        uint256[] memory warriorItemIds = new uint256[](2);
        uint256[] memory rogueItemIds = new uint256[](2);
        uint256[] memory mageItemIds = new uint256[](2);

        for (uint256 i = 0; i < itemsData.armor.length; i++) {
            ArmorTemplateDetails memory armorTemplate = itemsData.armor[i];

            ArmorStats memory newArmor = ArmorStats({
                agiModifier: armorTemplate.stats.agiModifier,
                armorModifier: armorTemplate.stats.armorModifier,
                classRestrictions: armorTemplate.stats.classRestrictions,
                hitPointModifier: armorTemplate.stats.hitPointModifier,
                intModifier: armorTemplate.stats.intModifier,
                minLevel: armorTemplate.stats.minLevel,
                strModifier: armorTemplate.stats.strModifier
            });

            uint256 starterArmorId = world.UD__createItem(
                ItemType.Armor,
                armorTemplate.initialSupply,
                armorTemplate.dropChance,
                abi.encode(newArmor),
                armorTemplate.metadataUri
            );

            if (i == 0) {
                warriorItemIds[0] = starterArmorId;
                rogueItemIds[0] = starterArmorId;
                mageItemIds[0] = starterArmorId;
            }
        }

        for (uint256 i = 0; i < itemsData.weapons.length; i++) {
            WeaponTemplateDetails memory weaponTemplate = itemsData.weapons[i];

            WeaponStats memory newWeapon = WeaponStats({
                agiModifier: weaponTemplate.stats.agiModifier,
                classRestrictions: weaponTemplate.stats.classRestrictions,
                hitPointModifier: weaponTemplate.stats.hitPointModifier,
                intModifier: weaponTemplate.stats.intModifier,
                maxDamage: weaponTemplate.stats.maxDamage,
                minDamage: weaponTemplate.stats.minDamage,
                minLevel: weaponTemplate.stats.minLevel,
                strModifier: weaponTemplate.stats.strModifier
            });

            uint256 starterWeaponId = world.UD__createItem(
                ItemType.Weapon,
                weaponTemplate.initialSupply,
                weaponTemplate.dropChance,
                abi.encode(newWeapon),
                weaponTemplate.metadataUri
            );

            if (i == 0) {
                warriorItemIds[1] = starterWeaponId;
            }
            if (i == 1) {
                rogueItemIds[1] = starterWeaponId;
            }
            if (i == 2) {
                mageItemIds[1] = starterWeaponId;
            }
        }

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        world.UD__setStarterItems(Classes.Warrior, warriorItemIds, amounts);
        world.UD__setStarterItems(Classes.Rogue, rogueItemIds, amounts);
        world.UD__setStarterItems(Classes.Mage, mageItemIds, amounts);
    }

    function _createMonsters() internal {
        string memory json = vm.readFile("monsters.json");
        bytes memory monsterStatsData = vm.parseJson(json, ".monsters");

        MonsterTemplateDetails[] memory monsterTemplateDetails =
            abi.decode(monsterStatsData, (MonsterTemplateDetails[]));

        for (uint256 i = 0; i < monsterTemplateDetails.length; i++) {
            MonsterTemplateDetails memory monsterTemplate = monsterTemplateDetails[i];

            MonsterStats memory newMonster = MonsterStats({
                agility: monsterTemplate.stats.agility,
                armor: monsterTemplate.stats.armor,
                class: monsterTemplate.stats.class,
                experience: monsterTemplate.stats.experience,
                hitPoints: monsterTemplate.stats.hitPoints,
                level: monsterTemplate.stats.level,
                intelligence: monsterTemplate.stats.intelligence,
                inventory: monsterTemplate.stats.inventory,
                strength: monsterTemplate.stats.strength,
                actions: monsterTemplate.stats.actions
            });

            world.UD__createMob(MobType.Monster, abi.encode(newMonster), monsterTemplate.metadataUri);
        }
    }

    function setLevels() internal {
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
        Levels.setExperience(11, 100000);
        Levels.setExperience(12, 120000);
        Levels.setExperience(13, 140000);
        Levels.setExperience(14, 165000);
        Levels.setExperience(15, 195000);
        Levels.setExperience(16, 225000);
        Levels.setExperience(17, 265000);
        Levels.setExperience(18, 305000);
        Levels.setExperience(19, 355000);
    }
}
