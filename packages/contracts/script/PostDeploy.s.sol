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

import {MockEntropy} from "@test/mocks/MockEntropy.sol";
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
import {
    ArmorStats,
    ArmorStatsData,
    WeaponStats,
    WeaponStatsData,
    ShopsData,
    StatRestrictions,
    StatRestrictionsData,
    SpellStatsData,
    SpellStats,
    ConsumableStats,
    ConsumableStatsData
} from "@codegen/index.sol";
import {_lootManagerSystemId} from "../src/utils.sol";
import {NoTransferHook} from "../src/NoTransferHook.sol";
import {NoTransferLastEquippedItemHook} from "../src/NoTransferLastEquippedItemHook.sol";
import {Classes, ItemType, MobType, EffectType} from "@codegen/common.sol";
import {
    MonsterStats,
    MonsterTemplateDetails,
    WeaponTemplateDetails,
    ArmorTemplateDetails,
    StarterItems,
    StarterEffects,
    PhysicalDamageTemplate,
    WeaponStatDetails,
    ArmorStatDetails,
    SpellTemplateDetails,
    ConsumableTemplateDetails
} from "@interfaces/Structs.sol";

import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";

import "forge-std/console.sol";
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

        // Start broadcasting transeffects from the deployer account
        vm.startBroadcast(deployerPrivateKey);
        UltimateDominionConfig.setMaxLevel(10);
        UltimateDominionConfig.setMaxMonsters(20);
        if (block.chainid == 31337) {
            // Set entropy contracts
            address mockEntropy = address(new MockEntropy());
            UltimateDominionConfig.setEntropy(mockEntropy);
            UltimateDominionConfig.setPythProvider(address(1));
        } else if (block.chainid == 84532) {
            UltimateDominionConfig.setEntropy(0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c);
            UltimateDominionConfig.setPythProvider(0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344);
        } else if (block.chainid == 8453) {
            UltimateDominionConfig.setEntropy(0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb);
            UltimateDominionConfig.setPythProvider(0x52DeaA1c84233F7bb8C8A45baeDE41091c616506);
        }

        uint16 height = uint16(10);
        uint16 width = uint16(10);
        MapConfig.set(width, height);
        // set deployer as admin
        Admin.set(vm.addr(deployerPrivateKey), true);

        //install puppet
        world.installModule(new PuppetModule(), new bytes(0));

        _addRngSystem();

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
            resourceIds.erc1155SystemId =
                WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: "Items", name: "ERC1155System"}); //_erc1155SystemId(ITEMS_NAMESPACE);
            resourceIds.erc1155NamespaceId = WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE);
            resourceIds.itemsSystemId =
                WorldResourceIdLib.encode({typeId: RESOURCE_SYSTEM, namespace: "UD", name: "ItemsSystem"});
            resourceIds.lootManagerSystemId = _lootManagerSystemId("UD");
        }

        address characterSystemAddress = Systems.getSystem(resourceIds.characterSystemId);
        address lootManagerSystemAddress = Systems.getSystem(resourceIds.lootManagerSystemId);
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
        NoTransferLastEquippedItemHook equippedItemTransferHook = new NoTransferLastEquippedItemHook(address(world));
        world.registerSystemHook(resourceIds.erc721SystemId, characterHook, BEFORE_CALL_SYSTEM);

        // Transfer characters namespace to World
        world.grantAccess(resourceIds.erc721SystemId, worldAddress);
        world.grantAccess(resourceIds.erc721SystemId, characterSystemAddress);
        world.transferOwnership(resourceIds.erc721NamespaceId, characterSystemAddress);

        address items = _deployErc1155(world, ITEMS_NAMESPACE);
        address itemsSystemAddress = Systems.getSystem(resourceIds.itemsSystemId);

        world.registerSystemHook(resourceIds.erc1155SystemId, equippedItemTransferHook, BEFORE_CALL_SYSTEM);
        world.grantAccess(resourceIds.erc1155SystemId, worldAddress);
        world.transferOwnership(resourceIds.erc1155NamespaceId, itemsSystemAddress);

        UltimateDominionConfig.setItems(address(items));
        //allow entropy system to call callback on Combat system
        world.grantAccess(resourceIds.combatSystemId, UltimateDominionConfig.getEntropy());
        _createStarterItems();
        _createEffects();
        _createShops();
        _createMonsters();
        address _marketplaceAddress = world.UD__marketplaceAddress();
        UltimateDominionConfig.setMarketplace(_marketplaceAddress);
        address _shopSystemAddress = world.UD__shopSystemAddress();
        UltimateDominionConfig.setShop(_shopSystemAddress);

        address _lootManagerAddress = Systems.getSystem(resourceIds.lootManagerSystemId);
        UltimateDominionConfig.setLootManager(_lootManagerAddress);

        setLevels();
        vm.stopBroadcast();
    }

    function _createEffects() internal {
        string memory json = vm.readFile("effects.json");
        bytes memory data = vm.parseJson(json);

        StarterEffects memory effectsData = abi.decode(data, (StarterEffects));

        for (uint256 i; i < effectsData.PhysicalDamages.length; i++) {
            bytes32 newEffectId = world.UD__createEffect(
                EffectType.PhysicalDamage,
                effectsData.PhysicalDamages[i].name,
                abi.encode(effectsData.PhysicalDamages[i].stats)
            );
            console.log("Physical action id: ", i + 1);
            console.logBytes32(newEffectId);
            require(newEffectId == effectsData.PhysicalDamages[i].effectId, "Physical effect Id mismatch");
        }

        for (uint256 i; i < effectsData.MagicDamages.length; i++) {
            bytes32 newEffectId = world.UD__createEffect(
                EffectType.MagicDamage, effectsData.MagicDamages[i].name, abi.encode(effectsData.MagicDamages[i].stats)
            );
            console.log("Magic action Id ", i + 1);
            console.logBytes32(newEffectId);
            require(newEffectId == effectsData.MagicDamages[i].effectId, "Magical effect Id mismatch");
        }

        for (uint256 i; i < effectsData.statusEffects.length; i++) {
            bytes32 newEffectId = world.UD__createEffect(
                EffectType.StatusEffect,
                effectsData.statusEffects[i].name,
                abi.encode(effectsData.statusEffects[i].stats, effectsData.statusEffects[i].validity)
            );
            console.log("Status Effect Id ", i + 1);
            console.logBytes32(newEffectId);
            require(newEffectId == effectsData.statusEffects[i].effectId, "status effect Id mismatch");
        }
    }

    function _deployErc1155(IWorld _world, bytes14 itemsNamespace) internal returns (address) {
        string memory json = vm.readFile("items.json");
        string memory metadataUriPrefix = json.readString(".metadataUriPrefix");

        IERC1155 _items = registerERC1155(_world, itemsNamespace, metadataUriPrefix);

        // ERC1155System erc1155System = new ERC1155System();
        // address itemsSystemAddress = Systems.getSystem(resourceIds.itemsSystemId);

        // _world.registerSystem(resourceIds.erc1155SystemId, erc1155System, false);
        // _world.grantAccess(resourceIds.erc1155SystemId, worldAddress);
        // world.transferOwnership(resourceIds.erc1155NamespaceId, itemsSystemAddress);
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
            resourceIds.rngSystemId,
            "entropyCallback(uint64,address,bytes32)",
            "entropyCallback(uint64,address,bytes32)"
        );
        world.registerRootFunctionSelector(
            resourceIds.rngSystemId,
            "_entropyCallback(uint64,address,bytes32)",
            "_entropyCallback(uint64,address,bytes32)"
        );
        world.registerRootFunctionSelector(resourceIds.rngSystemId, "getFee()", "getFee()");
        world.registerRootFunctionSelector(resourceIds.rngSystemId, "getEntropy()", "getEntropy()");
    }

    function _createStarterItems() internal {
        string memory json = vm.readFile("items.json");
        bytes memory data = vm.parseJson(json);

        StarterItems memory itemsData = abi.decode(data, (StarterItems));

        uint256[] memory warriorItemIds = new uint256[](3);
        uint256[] memory rogueItemIds = new uint256[](3);
        uint256[] memory mageItemIds = new uint256[](3);

        for (uint256 i = 0; i < itemsData.armor.length; i++) {
            ArmorTemplateDetails memory armorTemplate = itemsData.armor[i];

            ArmorStatsData memory newArmor = ArmorStatsData({
                agiModifier: armorTemplate.stats.agiModifier,
                armorModifier: armorTemplate.stats.armorModifier,
                hpModifier: armorTemplate.stats.hpModifier,
                intModifier: armorTemplate.stats.intModifier,
                minLevel: armorTemplate.stats.minLevel,
                strModifier: armorTemplate.stats.strModifier
            });

            uint256 starterArmorId = world.UD__createItem(
                ItemType.Armor,
                armorTemplate.initialSupply,
                armorTemplate.dropChance,
                armorTemplate.price,
                abi.encode(newArmor, armorTemplate.statRestrictions),
                armorTemplate.metadataUri
            );

            if (i == 0) {
                warriorItemIds[0] = starterArmorId;
            }
        }

        for (uint256 i = 0; i < itemsData.weapons.length; i++) {
            WeaponTemplateDetails memory weaponTemplate = itemsData.weapons[i];

            WeaponStatsData memory newWeapon = WeaponStatsData({
                agiModifier: weaponTemplate.stats.agiModifier,
                effects: weaponTemplate.stats.effects,
                hpModifier: weaponTemplate.stats.hpModifier,
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
                weaponTemplate.price,
                abi.encode(newWeapon, weaponTemplate.statRestrictions),
                weaponTemplate.metadataUri
            );

            if (i == 0) {
                warriorItemIds[1] = starterWeaponId;
                rogueItemIds[0] = starterWeaponId;
                mageItemIds[0] = starterWeaponId;
            }

            if (i == 5) {
                rogueItemIds[1] = starterWeaponId;
            }
        }

        for (uint256 i = 0; i < itemsData.spells.length; i++) {
            SpellTemplateDetails memory spellTemplate = itemsData.spells[i];

            SpellStatsData memory newSpell = SpellStatsData({
                effects: spellTemplate.stats.effects,
                maxDamage: spellTemplate.stats.maxDamage,
                minDamage: spellTemplate.stats.minDamage,
                minLevel: spellTemplate.stats.minLevel
            });

            uint256 starterSpellId = world.UD__createItem(
                ItemType.Spell,
                spellTemplate.initialSupply,
                spellTemplate.dropChance,
                spellTemplate.price,
                abi.encode(newSpell, spellTemplate.statRestrictions),
                spellTemplate.metadataUri
            );

            if (i == 0) {
                mageItemIds[1] = starterSpellId;
            }
        }

        for (uint256 i = 0; i < itemsData.consumables.length; i++) {
            ConsumableTemplateDetails memory consumablesTemplate = itemsData.consumables[i];

            ConsumableStatsData memory newConsumable = ConsumableStatsData({
                effects: consumablesTemplate.stats.effects,
                maxDamage: consumablesTemplate.stats.maxDamage,
                minDamage: consumablesTemplate.stats.minDamage,
                minLevel: consumablesTemplate.stats.minLevel
            });

            uint256 starterConsumableId = world.UD__createItem(
                ItemType.Consumable,
                consumablesTemplate.initialSupply,
                consumablesTemplate.dropChance,
                consumablesTemplate.price,
                abi.encode(newConsumable, consumablesTemplate.statRestrictions),
                consumablesTemplate.metadataUri
            );

            if (i == 0) {
                warriorItemIds[2] = starterConsumableId;
                rogueItemIds[2] = starterConsumableId;
                mageItemIds[2] = starterConsumableId;
            }
        }

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1;
        amounts[1] = 1;
        amounts[2] = 1;

        world.UD__setStarterItems(Classes.Warrior, warriorItemIds, amounts);
        world.UD__setStarterItems(Classes.Rogue, rogueItemIds, amounts);
        world.UD__setStarterItems(Classes.Mage, mageItemIds, amounts);
    }

    function _createShops() internal {
        uint256[] memory sellableItems = new uint256[](10);
        uint256[] memory buyableItems = new uint256[](10);
        uint256[] memory stock = new uint256[](10);
        for(uint i = 0; i < 10; ++i){
            sellableItems[i] = i;
            buyableItems[i] = i;
            stock[i] = 10;
        }

        ShopsData memory newShop = ShopsData({
            gold: 100 ether,
            maxGold: 100 ether,
            priceMarkup: 2000, // 20%
            priceMarkdown: 5000, // 50%
            restockTimestamp: 1725962400,
            sellableItems: sellableItems,
            buyableItems: buyableItems,
            restock: stock,
            stock: stock
        });

        uint256 shopMobId =
            world.UD__createMob(MobType.Shop, abi.encode(newShop), "https://github.com/raid-guild/ultimate-dominion");
        world.UD__spawnMob(shopMobId, 0, 0);
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
                strength: monsterTemplate.stats.strength
            });

            uint256 mobId = world.UD__createMob(MobType.Monster, abi.encode(newMonster), monsterTemplate.metadataUri);
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
