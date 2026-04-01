// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "forge-std/StdJson.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {ResourceAccess} from "@latticexyz/world/src/codegen/tables/ResourceAccess.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {
    Stats,
    StatsData,
    MobStats,
    WeaponStatsData,
    ArmorStatsData,
    ConsumableStatsData,
    StatRestrictionsData,
    ShopsData,
    PhysicalDamageStatsData,
    MagicDamageStatsData
} from "@codegen/index.sol";
import {Classes, MobType, ItemType, EffectType, ArmorType} from "@codegen/common.sol";
import {MonsterStats} from "@interfaces/Structs.sol";
import {_mobSystemId, _lootManagerSystemId, _itemsSystemId, _erc1155SystemId} from "../../src/utils.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_NAMESPACE, RESOURCE_TABLE, RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {_erc20SystemId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {GOLD_NAMESPACE, ITEMS_NAMESPACE, WORLD_NAMESPACE} from "../../constants.sol";

/**
 * @title V3SetUp
 * @notice Self-contained test setup for V3 combat tests.
 *         Does NOT parse items.json — creates all game content inline.
 */
contract V3SetUp is Test {
    using stdJson for string;

    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    address payable public alice;
    address payable public bob;
    uint256 public userNonce = 0;
    IWorld public world;
    address public worldAddress;

    bytes32 public alicesCharacterId;
    bytes32 public bobCharacterId;

    // Effect IDs (deterministic from name hash)
    bytes32 public physicalAttackEffectId;
    bytes32 public magicAttackEffectId;

    // Item IDs (sequential from createItem)
    uint256 public physicalWeaponId;
    uint256 public magicWeaponId;
    uint256 public basicArmorId;
    uint256 public basicConsumableId;

    // Monster mob IDs (sequential from createMob)
    // 1 = shop, 2..N = monsters
    uint256 public dirRatMobId;       // level 1 physical mob
    uint256 public weakMageMobId;     // level 3 magic mob
    uint256 public midLevelMobId;     // level 5 physical mob
    uint256 public basiliskMobId;     // level 10 boss (2 weapons)

    bytes32 public shopId;

    function setUp() public virtual {
        vm.startPrank(deployer);

        // Connect to deployed world
        worldAddress = vm.envAddress("WORLD_ADDRESS");
        vm.label(worldAddress, "World");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        // Grant access
        world.grantAccess(_mobSystemId("UD"), address(this));
        ResourceId udNamespaceId = WorldResourceIdLib.encodeNamespace("UD");
        world.grantAccess(udNamespaceId, address(this));
        world.grantAccess(_lootManagerSystemId("UD"), address(this));

        // Grant cross-namespace access (normally done by EnsureAccess root system)
        _grantCrossNamespaceAccess();

        // Create effects
        _createEffects();

        // Create items
        _createItems();

        // Create shop
        _createShop();

        // Create monsters
        _createMonsters();

        // Set up starter items
        world.UD__setStarterItemPool(basicArmorId, true);
        world.UD__setStarterItemPool(physicalWeaponId, true);

        vm.stopPrank();

        // Create test characters
        alice = _getUser();
        bob = _getUser();
        vm.label(alice, "alice");
        vm.label(bob, "bob");

        vm.prank(alice);
        alicesCharacterId = world.UD__mintCharacter(alice, bytes32("Alice"), "test_uri");

        vm.startPrank(bob);
        bobCharacterId = world.UD__mintCharacter(bob, bytes32("Bob"), "test_uri_bob");
        world.UD__rollStats(keccak256("bob_rng"), bobCharacterId, Classes.Mage);
        world.UD__enterGame(bobCharacterId, physicalWeaponId, basicArmorId);
        vm.stopPrank();
    }

    function _createEffects() internal {
        // Physical attack effect
        PhysicalDamageStatsData memory physStats = PhysicalDamageStatsData({
            armorPenetration: 0,
            attackModifierBonus: 0,
            bonusDamage: 5,
            critChanceBonus: 0
        });
        physicalAttackEffectId = world.UD__createEffect(
            EffectType.PhysicalDamage, "basic weapon attack", abi.encode(physStats)
        );

        // Magic attack effect
        MagicDamageStatsData memory magicStats = MagicDamageStatsData({
            attackModifierBonus: 0,
            bonusDamage: 5,
            critChanceBonus: 0
        });
        magicAttackEffectId = world.UD__createEffect(
            EffectType.MagicDamage, "basic magic attack", abi.encode(magicStats)
        );
    }

    function _createItems() internal {
        StatRestrictionsData memory noRestrictions = StatRestrictionsData({
            minStrength: 0, minIntelligence: 0, minAgility: 0
        });

        // Physical weapon with attack effect
        bytes32[] memory physEffects = new bytes32[](1);
        physEffects[0] = physicalAttackEffectId;
        WeaponStatsData memory physWeapon = WeaponStatsData({
            agiModifier: 0, intModifier: 0, hpModifier: 0,
            maxDamage: 10, minDamage: 3, minLevel: 0, strModifier: 1,
            effects: physEffects
        });
        physicalWeaponId = world.UD__createItem(
            ItemType.Weapon, 1e18, 1000, 10 ether, 1,
            abi.encode(physWeapon, noRestrictions), "test_phys_weapon"
        );

        // Magic weapon with magic effect
        bytes32[] memory magicEffects = new bytes32[](1);
        magicEffects[0] = magicAttackEffectId;
        WeaponStatsData memory magWeapon = WeaponStatsData({
            agiModifier: 0, intModifier: 1, hpModifier: 0,
            maxDamage: 10, minDamage: 3, minLevel: 0, strModifier: 0,
            effects: magicEffects
        });
        magicWeaponId = world.UD__createItem(
            ItemType.Weapon, 1e18, 1000, 10 ether, 1,
            abi.encode(magWeapon, noRestrictions), "test_magic_weapon"
        );

        // Basic armor
        ArmorStatsData memory armor = ArmorStatsData({
            armorModifier: 1, minLevel: 0, strModifier: 0,
            agiModifier: 0, intModifier: 0, hpModifier: 0,
            armorType: ArmorType.Cloth
        });
        basicArmorId = world.UD__createItem(
            ItemType.Armor, 1e18, 1000, 5 ether, 1,
            abi.encode(armor, noRestrictions), "test_armor"
        );

        // Consumable (heal potion)
        ConsumableStatsData memory consumable = ConsumableStatsData({
            minDamage: 0, maxDamage: 0, minLevel: 0, effects: new bytes32[](0)
        });
        basicConsumableId = world.UD__createItem(
            ItemType.Consumable, 1e18, 1000, 5 ether, 1,
            abi.encode(consumable, noRestrictions), "test_consumable"
        );
    }

    function _createShop() internal {
        uint256[] memory sellable = new uint256[](4);
        uint256[] memory buyable = new uint256[](4);
        uint256[] memory stock = new uint256[](4);
        for (uint256 i; i < 4; i++) {
            sellable[i] = i;
            buyable[i] = i;
            stock[i] = 5;
        }
        ShopsData memory shop = ShopsData({
            gold: 1000 ether, maxGold: 1000 ether,
            priceMarkup: 2000, priceMarkdown: 5000,
            restockTimestamp: 1725962400,
            sellableItems: sellable, buyableItems: buyable,
            restock: stock, stock: stock
        });
        uint256 shopMobId = world.UD__createMob(MobType.Shop, abi.encode(shop), "test_shop");
        shopId = world.UD__spawnMob(shopMobId, 1, 0, 0);
    }

    function _createMonsters() internal {
        // All monsters get both weapons in their inventory so drops work
        uint256[] memory bothWeapons = new uint256[](2);
        bothWeapons[0] = physicalWeaponId;
        bothWeapons[1] = magicWeaponId;

        // Dire Rat — level 1, physical (class 0 = Warrior)
        dirRatMobId = world.UD__createMob(
            MobType.Monster,
            abi.encode(MonsterStats({
                agility: 6, armor: 0, class: Classes.Warrior,
                experience: 225, hasBossAI: false, hitPoints: 10, intelligence: 2,
                inventory: bothWeapons, level: 1, strength: 3
            })),
            "monster:dire_rat"
        );

        // Weak Mage — level 3, magic (class 2 = Mage)
        weakMageMobId = world.UD__createMob(
            MobType.Monster,
            abi.encode(MonsterStats({
                agility: 4, armor: 1, class: Classes.Mage,
                experience: 550, hasBossAI: false, hitPoints: 18, intelligence: 9,
                inventory: bothWeapons, level: 3, strength: 3
            })),
            "monster:cavern_brute"
        );

        // Mid-level — level 5, physical (class 0 = Warrior)
        midLevelMobId = world.UD__createMob(
            MobType.Monster,
            abi.encode(MonsterStats({
                agility: 6, armor: 2, class: Classes.Warrior,
                experience: 1000, hasBossAI: false, hitPoints: 26, intelligence: 5,
                inventory: bothWeapons, level: 5, strength: 11
            })),
            "monster:ironhide_troll"
        );

        // Basilisk — level 10, boss (class 0 = Warrior), 2 distinct weapons
        // slot 0 = physical, slot 1 = magic
        basiliskMobId = world.UD__createMob(
            MobType.Monster,
            abi.encode(MonsterStats({
                agility: 12, armor: 4, class: Classes.Warrior,
                experience: 10000, hasBossAI: true, hitPoints: 100, intelligence: 10,
                inventory: bothWeapons, level: 10, strength: 20
            })),
            "monster:basilisk"
        );
    }

    function _grantCrossNamespaceAccess() internal {
        // Look up system addresses (change every deploy)
        address charEnterSys = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "CharEnterSys"));
        address lootManager = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "LootManagerSyste"));
        address itemsSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "ItemsSystem"));
        address itemCreation = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "ItemCreationSys"));
        address shopSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "ShopSystem"));
        address pveReward = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "PveRewardSystem"));
        address adminSystem = Systems.getSystem(WorldResourceIdLib.encode(RESOURCE_SYSTEM, WORLD_NAMESPACE, "AdminSystem"));

        // Build cross-namespace resource IDs
        ResourceId goldNs = WorldResourceIdLib.encodeNamespace(GOLD_NAMESPACE);
        ResourceId goldBalances = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "Balances");
        ResourceId goldTotalSupply = WorldResourceIdLib.encode(RESOURCE_TABLE, GOLD_NAMESPACE, "TotalSupply");
        ResourceId goldErc20System = _erc20SystemId(GOLD_NAMESPACE);

        ResourceId itemsNs = WorldResourceIdLib.encodeNamespace(ITEMS_NAMESPACE);
        ResourceId itemsOwners = WorldResourceIdLib.encode(RESOURCE_TABLE, ITEMS_NAMESPACE, "Owners");
        ResourceId itemsTotalSupply = WorldResourceIdLib.encode(RESOURCE_TABLE, ITEMS_NAMESPACE, "TotalSupply");
        ResourceId itemsErc1155System = _erc1155SystemId(ITEMS_NAMESPACE);

        // Gold namespace grants (deployer owns Gold namespace from MinimalPostDeploy)
        world.grantAccess(goldBalances, charEnterSys);
        world.grantAccess(goldTotalSupply, charEnterSys);
        world.grantAccess(goldBalances, lootManager);
        world.grantAccess(goldTotalSupply, lootManager);
        world.grantAccess(goldBalances, shopSystem);
        world.grantAccess(goldTotalSupply, shopSystem);
        world.grantAccess(goldBalances, pveReward);
        world.grantAccess(goldTotalSupply, pveReward);
        world.grantAccess(goldNs, worldAddress);
        world.grantAccess(goldBalances, worldAddress);
        world.grantAccess(goldErc20System, worldAddress);

        // Items namespace grants (deployer owns Items namespace from MinimalPostDeploy)
        world.grantAccess(itemsOwners, charEnterSys);
        world.grantAccess(itemsOwners, lootManager);
        world.grantAccess(itemsTotalSupply, lootManager);
        world.grantAccess(itemsNs, itemsSystem);
        world.grantAccess(itemsNs, itemCreation);
        world.grantAccess(itemsNs, adminSystem);
        world.grantAccess(itemsErc1155System, itemsSystem);
        world.grantAccess(itemsOwners, shopSystem);
        world.grantAccess(itemsNs, worldAddress);
        world.grantAccess(itemsOwners, worldAddress);
        world.grantAccess(itemsErc1155System, worldAddress);

        // Characters namespace: already configured by MinimalPostDeploy
        // (ownership transferred to CharacterCore, ERC721System access granted to World)
    }

    function _getUser() internal returns (address payable) {
        address payable user = payable(address(uint160(uint256(keccak256(abi.encodePacked(userNonce++))))));
        vm.deal(user, 100 ether);
        return user;
    }
}
