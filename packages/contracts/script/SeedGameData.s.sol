// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";

import {IWorld} from "@world/IWorld.sol";

// Import tables for direct writes
import {
    MapConfig,
    Admin,
    Levels,
    Counters,
    Effects,
    PhysicalDamageStats,
    PhysicalDamageStatsData,
    MagicDamageStats,
    MagicDamageStatsData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectValidity,
    StatusEffectValidityData,
    Items,
    ItemsData,
    WeaponStats,
    WeaponStatsData,
    ArmorStats,
    ArmorStatsData,
    SpellStats,
    SpellStatsData,
    ConsumableStats,
    ConsumableStatsData,
    StatRestrictions,
    StatRestrictionsData,
    StarterItems as StarterItemsTable,
    Mobs,
    MobsByLevel,
    Position,
    EntitiesAtPosition,
    Spawned,
    MobStats,
    MobStatsData,
    Stats,
    StatsData,
    Shops,
    ShopsData,
    UltimateDominionConfig
} from "@codegen/index.sol";

import {Classes, ItemType, MobType, EffectType} from "@codegen/common.sol";

// Import structs for JSON parsing
import {
    MonsterStats,
    MonsterTemplateDetails,
    WeaponTemplateDetails,
    ArmorTemplateDetails,
    ShopTemplate,
    StarterItems,
    StarterEffects,
    SpellTemplateDetails,
    ConsumableTemplateDetails
} from "@interfaces/Structs.sol";

// Import ERC1155 tables for minting
import {Owners} from "@erc1155/tables/Owners.sol";
import {TotalSupply} from "@erc1155/tables/TotalSupply.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {_ownersTableId, _totalSupplyTableId, _erc1155URIStorageTableId} from "@erc1155/utils.sol";
import {_lootManagerSystemId, _mobSystemId} from "../src/utils.sol";

import {ITEMS_NAMESPACE, WORLD_NAMESPACE} from "../constants.sol";

import "forge-std/StdJson.sol";

/**
 * @title SeedGameData
 * @notice Seeds game data (effects, items, shops, monsters) into a deployed world
 * @dev Uses direct table writes to bypass system access control checks
 *
 * Usage:
 *   forge script SeedGameData --broadcast --sig "run(address)" <WORLD_ADDRESS> --rpc-url <RPC_URL>
 */
contract SeedGameData is Script {
    using stdJson for string;

    IWorld public world;
    address public lootManagerAddress;

    // Counter addresses (used as keys in Counters table)
    address internal itemsCounterAddress;
    address internal mobCounterAddress;

    /**
     * @notice Main entry point when called from PostDeploy (no broadcast management)
     * @dev Assumes caller has already started broadcast and has necessary access
     */
    function run(address _worldAddress) external {
        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("Seeding game data for world at:", _worldAddress);

        // Get LootManager address for item minting
        lootManagerAddress = Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE));
        console.log("LootManager address:", lootManagerAddress);

        // Get Items contract address (used as counter key)
        itemsCounterAddress = UltimateDominionConfig.getItems();
        console.log("Items contract address:", itemsCounterAddress);

        // Set map config
        uint16 height = uint16(10);
        uint16 width = uint16(10);
        MapConfig.set(width, height);
        console.log("Map config set:", width, "x", height);

        // Set deployer as admin
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        Admin.set(vm.addr(deployerPrivateKey), true);
        console.log("Admin set");

        // Create effects first (items reference them)
        _createEffects();
        console.log("Effects created");

        // Create items (armor, weapons, spells, consumables)
        _createStarterItems();
        console.log("Items created");

        // Create shops
        _createShops();
        console.log("Shops created");

        // Create monsters
        _createMonsters();
        console.log("Monsters created");

        // Set level experience requirements
        _setLevels();
        console.log("Level requirements set");

        console.log("Game data seeding complete!");
    }

    /**
     * @notice Standalone entry point (manages own broadcast)
     * @dev Use this when running SeedGameData as a separate script
     */
    function runStandalone(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("Seeding game data for world at:", _worldAddress);

        // Get LootManager address for item minting
        lootManagerAddress = Systems.getSystem(_lootManagerSystemId(WORLD_NAMESPACE));
        console.log("LootManager address:", lootManagerAddress);

        // Get Items contract address (used as counter key)
        itemsCounterAddress = UltimateDominionConfig.getItems();
        console.log("Items contract address:", itemsCounterAddress);

        // Set map config
        uint16 height = uint16(10);
        uint16 width = uint16(10);
        MapConfig.set(width, height);
        console.log("Map config set:", width, "x", height);

        // Set deployer as admin
        Admin.set(vm.addr(deployerPrivateKey), true);
        console.log("Admin set");

        // Create effects first (items reference them)
        _createEffects();
        console.log("Effects created");

        // Create items (armor, weapons, spells, consumables)
        _createStarterItems();
        console.log("Items created");

        // Create shops
        _createShops();
        console.log("Shops created");

        // Create monsters
        _createMonsters();
        console.log("Monsters created");

        // Set level experience requirements
        _setLevels();
        console.log("Level requirements set");

        console.log("Game data seeding complete!");

        vm.stopBroadcast();
    }

    function _setLevels() internal {
        // Early game (1-10): Fast progression
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

        // Mid game (11-50): Moderate progression
        uint256 baseExp = 85000;
        for (uint256 level = 11; level <= 50; level++) {
            baseExp = baseExp + (level * 5000);
            Levels.setExperience(level, baseExp);
        }

        // Late game (51-100): Slow progression
        for (uint256 level = 51; level <= 100; level++) {
            baseExp = baseExp + (level * 15000);
            Levels.setExperience(level, baseExp);
        }

        console.log("Level requirements set");
    }

    /**
     * @notice Create effects by writing directly to tables
     */
    function _createEffects() internal {
        string memory json = vm.readFile("effects.json");
        bytes memory data = vm.parseJson(json);

        StarterEffects memory effectsData = abi.decode(data, (StarterEffects));

        // Create Physical Damage effects
        for (uint256 i; i < effectsData.PhysicalDamages.length; i++) {
            bytes32 effectId = bytes32(bytes8(keccak256(abi.encode(effectsData.PhysicalDamages[i].name))));

            // Write to PhysicalDamageStats table
            PhysicalDamageStats.set(effectId, effectsData.PhysicalDamages[i].stats);

            // Write to Effects table
            Effects.set(effectId, EffectType.PhysicalDamage, true);

            console.log("Physical effect created:", i + 1);
            require(effectId == effectsData.PhysicalDamages[i].effectId, "Physical effect Id mismatch");
        }

        // Create Magic Damage effects
        for (uint256 i; i < effectsData.MagicDamages.length; i++) {
            bytes32 effectId = bytes32(bytes8(keccak256(abi.encode(effectsData.MagicDamages[i].name))));

            // Write to MagicDamageStats table
            MagicDamageStats.set(effectId, effectsData.MagicDamages[i].stats);

            // Write to Effects table
            Effects.set(effectId, EffectType.MagicDamage, true);

            console.log("Magic effect created:", i + 1);
            require(effectId == effectsData.MagicDamages[i].effectId, "Magical effect Id mismatch");
        }

        // Create Status effects
        for (uint256 i; i < effectsData.statusEffects.length; i++) {
            bytes32 effectId = bytes32(bytes8(keccak256(abi.encode(effectsData.statusEffects[i].name))));

            // Validate status effect
            StatusEffectValidityData memory validityData = effectsData.statusEffects[i].validity;
            if (validityData.validTime != 0) {
                require(validityData.validTurns == 0, "INVALID EFFECT: TIME");
                require(effectsData.statusEffects[i].stats.damagePerTick == 0, "INVALID EFFECT: WORLD EFFECT DAMAGE");
            } else if (validityData.validTime == 0) {
                require(validityData.validTurns != 0, "INVALID EFFECT: TURNS");
            }

            // Write to StatusEffectStats table
            StatusEffectStats.set(effectId, effectsData.statusEffects[i].stats);

            // Write to StatusEffectValidity table
            StatusEffectValidity.set(effectId, validityData);

            // Write to Effects table
            Effects.set(effectId, EffectType.StatusEffect, true);

            console.log("Status effect created:", i + 1);
            require(effectId == effectsData.statusEffects[i].effectId, "Status effect Id mismatch");
        }
    }

    /**
     * @notice Create items by writing directly to tables
     */
    function _createStarterItems() internal {
        string memory json = vm.readFile("items.json");
        bytes memory data = vm.parseJson(json);

        StarterItems memory itemsData = abi.decode(data, (StarterItems));

        uint256[] memory warriorItemIds = new uint256[](2);
        uint256[] memory rogueItemIds = new uint256[](2);
        uint256[] memory mageItemIds = new uint256[](2);

        // Create armor
        for (uint256 i = 0; i < itemsData.armor.length; i++) {
            ArmorTemplateDetails memory armorTemplate = itemsData.armor[i];

            uint256 itemId = _incrementItemsCounter();

            ArmorStatsData memory newArmor = ArmorStatsData({
                agiModifier: armorTemplate.stats.agiModifier,
                armorModifier: armorTemplate.stats.armorModifier,
                hpModifier: armorTemplate.stats.hpModifier,
                intModifier: armorTemplate.stats.intModifier,
                minLevel: armorTemplate.stats.minLevel,
                strModifier: armorTemplate.stats.strModifier,
                armorType: armorTemplate.stats.armorType
            });

            // Write to ArmorStats table
            ArmorStats.set(itemId, newArmor);

            // Write to StatRestrictions table
            StatRestrictions.set(itemId, armorTemplate.statRestrictions);

            // Write to Items table
            ItemsData memory newItem = ItemsData({
                itemType: ItemType.Armor,
                dropChance: armorTemplate.dropChance,
                price: armorTemplate.price,
                stats: abi.encode(newArmor, armorTemplate.statRestrictions)
            });
            Items.set(itemId, newItem);

            // Mint supply to LootManager
            _mintItem(itemId, armorTemplate.initialSupply);

            // Set token URI
            _setTokenUri(itemId, armorTemplate.metadataUri);

            console.log("Armor created:", armorTemplate.name, "id:", itemId);

            if (i == 0) {
                warriorItemIds[0] = itemId;
            }
        }

        // Create weapons
        for (uint256 i = 0; i < itemsData.weapons.length; i++) {
            WeaponTemplateDetails memory weaponTemplate = itemsData.weapons[i];

            uint256 itemId = _incrementItemsCounter();

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

            // Write to WeaponStats table
            WeaponStats.set(itemId, newWeapon);

            // Write to StatRestrictions table
            StatRestrictions.set(itemId, weaponTemplate.statRestrictions);

            // Write to Items table
            ItemsData memory newItem = ItemsData({
                itemType: ItemType.Weapon,
                dropChance: weaponTemplate.dropChance,
                price: weaponTemplate.price,
                stats: abi.encode(newWeapon, weaponTemplate.statRestrictions)
            });
            Items.set(itemId, newItem);

            // Mint supply to LootManager
            _mintItem(itemId, weaponTemplate.initialSupply);

            // Set token URI
            _setTokenUri(itemId, weaponTemplate.metadataUri);

            console.log("Weapon created:", weaponTemplate.name, "id:", itemId);

            if (i == 0) {
                warriorItemIds[1] = itemId;
                rogueItemIds[0] = itemId;
                mageItemIds[0] = itemId;
            }

            if (i == 5) {
                rogueItemIds[1] = itemId;
            }
        }

        // Create spells
        for (uint256 i = 0; i < itemsData.spells.length; i++) {
            SpellTemplateDetails memory spellTemplate = itemsData.spells[i];

            uint256 itemId = _incrementItemsCounter();

            SpellStatsData memory newSpell = SpellStatsData({
                effects: spellTemplate.stats.effects,
                maxDamage: spellTemplate.stats.maxDamage,
                minDamage: spellTemplate.stats.minDamage,
                minLevel: spellTemplate.stats.minLevel
            });

            // Write to SpellStats table
            SpellStats.set(itemId, newSpell);

            // Write to StatRestrictions table
            StatRestrictions.set(itemId, spellTemplate.statRestrictions);

            // Write to Items table
            ItemsData memory newItem = ItemsData({
                itemType: ItemType.Spell,
                dropChance: spellTemplate.dropChance,
                price: spellTemplate.price,
                stats: abi.encode(newSpell, spellTemplate.statRestrictions)
            });
            Items.set(itemId, newItem);

            // Mint supply to LootManager
            _mintItem(itemId, spellTemplate.initialSupply);

            // Set token URI
            _setTokenUri(itemId, spellTemplate.metadataUri);

            console.log("Spell created:", spellTemplate.name, "id:", itemId);

            if (i == 0) {
                mageItemIds[1] = itemId;
            }
        }

        // Create consumables
        for (uint256 i = 0; i < itemsData.consumables.length; i++) {
            ConsumableTemplateDetails memory consumablesTemplate = itemsData.consumables[i];

            uint256 itemId = _incrementItemsCounter();

            ConsumableStatsData memory newConsumable = ConsumableStatsData({
                effects: consumablesTemplate.stats.effects,
                maxDamage: consumablesTemplate.stats.maxDamage,
                minDamage: consumablesTemplate.stats.minDamage,
                minLevel: consumablesTemplate.stats.minLevel
            });

            // Write to ConsumableStats table
            ConsumableStats.set(itemId, newConsumable);

            // Write to StatRestrictions table
            StatRestrictions.set(itemId, consumablesTemplate.statRestrictions);

            // Write to Items table
            ItemsData memory newItem = ItemsData({
                itemType: ItemType.Consumable,
                dropChance: consumablesTemplate.dropChance,
                price: consumablesTemplate.price,
                stats: abi.encode(newConsumable, consumablesTemplate.statRestrictions)
            });
            Items.set(itemId, newItem);

            // Mint supply to LootManager
            _mintItem(itemId, consumablesTemplate.initialSupply);

            // Set token URI
            _setTokenUri(itemId, consumablesTemplate.metadataUri);

            console.log("Consumable created:", consumablesTemplate.name, "id:", itemId);
        }

        // Set starter items for each class
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        StarterItemsTable.set(Classes.Warrior, warriorItemIds, amounts);
        console.log("Warrior starter items set");

        StarterItemsTable.set(Classes.Rogue, rogueItemIds, amounts);
        console.log("Rogue starter items set");

        StarterItemsTable.set(Classes.Mage, mageItemIds, amounts);
        console.log("Mage starter items set");
    }

    /**
     * @notice Create shops by writing directly to tables
     */
    function _createShops() internal {
        string memory json = vm.readFile("shops.json");
        bytes memory shopTemplatesBytes = vm.parseJson(json, ".shops");

        ShopTemplate[] memory shopTemplates = abi.decode(shopTemplatesBytes, (ShopTemplate[]));

        for (uint256 i = 0; i < shopTemplates.length; i++) {
            ShopTemplate memory shopTemplate = shopTemplates[i];

            ShopsData memory newShop = ShopsData({
                gold: shopTemplate.gold,
                maxGold: shopTemplate.maxGold,
                priceMarkup: shopTemplate.priceMarkup,
                priceMarkdown: shopTemplate.priceMarkdown,
                restockTimestamp: shopTemplate.restockTimestamp,
                sellableItems: shopTemplate.sellableItems,
                buyableItems: shopTemplate.buyableItems,
                restock: shopTemplate.restock,
                stock: shopTemplate.stock
            });

            // Create mob
            uint256 mobId = _incrementMobId();
            Mobs.set(mobId, MobType.Shop, abi.encode(newShop), "https://github.com/raid-guild/ultimate-dominion");

            // Spawn mob at location
            uint16 x = uint16(shopTemplate.location[0]);
            uint16 y = uint16(shopTemplate.location[1]);
            bytes32 entityId = bytes32(abi.encodePacked(uint32(mobId), uint192(_incrementMobCounter(mobId)), x, y));

            // Write shop data
            Shops.set(entityId, newShop);

            // Write position
            Position.set(entityId, x, y);
            EntitiesAtPosition.pushEntities(x, y, entityId);
            Spawned.set(entityId, true);

            console.log("Shop created at:", shopTemplate.location[0], ",", shopTemplate.location[1]);
        }
    }

    /**
     * @notice Create monsters by writing directly to tables
     */
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

            // Create mob template (don't spawn yet)
            uint256 mobId = _incrementMobId();
            Mobs.set(mobId, MobType.Monster, abi.encode(newMonster), monsterTemplate.metadataUri);

            // Add to MobsByLevel
            MobsByLevel.pushMobIds(newMonster.level, mobId);

            console.log("Monster created:", monsterTemplate.name, "id:", mobId);
        }
    }

    // ============ Helper functions ============

    /**
     * @notice Increment items counter and return new item ID
     */
    function _incrementItemsCounter() internal returns (uint256) {
        uint256 itemId = Counters.getCounter(itemsCounterAddress, 0) + 1;
        Counters.setCounter(itemsCounterAddress, 0, itemId);
        return itemId;
    }

    /**
     * @notice Increment mob ID counter and return new mob ID
     * @dev Uses MobSystem address as counter key (same as MobSystem does)
     */
    function _incrementMobId() internal returns (uint256) {
        // Get MobSystem address for counter key
        if (mobCounterAddress == address(0)) {
            mobCounterAddress = Systems.getSystem(_mobSystemId(WORLD_NAMESPACE));
            console.log("MobSystem address:", mobCounterAddress);
        }
        uint256 mobId = Counters.getCounter(mobCounterAddress, 0) + 1;
        Counters.setCounter(mobCounterAddress, 0, mobId);
        return mobId;
    }

    /**
     * @notice Increment spawn counter for a specific mob
     */
    function _incrementMobCounter(uint256 mobId) internal returns (uint256) {
        uint256 mobCounter = Counters.getCounter(mobCounterAddress, mobId) + 1;
        require(mobCounter < type(uint192).max, "MOB SYSTEM: Cannot spawn this monster any more");
        Counters.setCounter(mobCounterAddress, mobId, mobCounter);
        return mobCounter;
    }

    /**
     * @notice Mint items to LootManager by writing directly to ERC1155 tables
     */
    function _mintItem(uint256 itemId, uint256 supply) internal {
        ResourceId ownersTableId = _ownersTableId(ITEMS_NAMESPACE);
        ResourceId totalSupplyTableId = _totalSupplyTableId(ITEMS_NAMESPACE);

        // Set owner balance
        Owners.setBalance(ownersTableId, lootManagerAddress, itemId, supply);

        // Set total supply (currentSupply and totalSupply)
        TotalSupply.set(totalSupplyTableId, itemId, supply, supply);
    }

    /**
     * @notice Set token URI by writing directly to ERC1155URIStorage table
     */
    function _setTokenUri(uint256 itemId, string memory uri) internal {
        ResourceId uriStorageTableId = _erc1155URIStorageTableId(ITEMS_NAMESPACE);
        ERC1155URIStorage.setUri(uriStorageTableId, itemId, uri);
    }
}
