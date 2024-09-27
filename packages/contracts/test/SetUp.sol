// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "forge-std/StdJson.sol";
import {MudTest} from "@latticexyz/world/test/MudTest.t.sol";
import {getKeysWithValue} from "@latticexyz/world-modules/src/modules/keyswithvalue/getKeysWithValue.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {IEntropy} from "@pythnetwork/IEntropy.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {
    Characters,
    CharactersData,
    UltimateDominionConfig,
    ArmorStatsData,
    WeaponStatsData,
    ConsumableStatsData,
    SpellStatsData,
    StatRestrictionsData,
    ShopsData
} from "@codegen/index.sol";
import {Classes, MobType, ItemType, EffectType} from "@codegen/common.sol";
import {_itemsSystemId, _lootManagerSystemId, _mobSystemId} from "../src/utils.sol";
import {MonsterStats} from "@interfaces/Structs.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_NAMESPACE} from "@latticexyz/world/src/worldResourceTypes.sol";
import {System} from "@latticexyz/world/src/System.sol";

contract SetUp is Test {
    using stdJson for string;

    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    address payable public alice;
    address payable public bob;
    uint256 public userNonce = 0;
    IWorld public world;
    address public worldAddress;
    IEntropy public entropy;

    IERC20Mintable public goldToken;
    IERC721Mintable public characterToken;
    IERC1155System public erc1155System;
    
    bytes32 shopId;
    bytes32 alicesCharacterId;
    bytes32 bobCharacterId;
    bytes32 public alicesRandomness = bytes32(keccak256(abi.encode("alicesRestaurant")));
    bytes32 basicActionIdStatsId;
    uint256 newArmorId;
    uint256 alsoNewArmorId;
    uint256 newWeaponId;
    uint256 alsoNewWeaponId;
    uint256 newSpellId;
    uint256 alsoNewSpellId;
    uint256 newConsumableId;

    bytes32 basicMagicDamageStatsId;

    function setUp() public virtual {
        vm.startPrank(deployer);
        string memory json = vm.readFile(string(abi.encodePacked(vm.projectRoot(), "/deploys/31337/latest.json")));
        worldAddress = json.readAddress(".worldAddress");
        vm.label(address(worldAddress), "World");
        StoreSwitch.setStoreAddress(worldAddress);

        world = IWorld(worldAddress);
        entropy = IEntropy(world.UD__getEntropy());
        alice = getUser();
        bob = getUser();
        goldToken = IERC20Mintable(world.UD__getGoldToken());
        characterToken = IERC721Mintable(world.UD__getCharacterToken());
        erc1155System = IERC1155System(world.UD__getItemsContract());

        basicMagicDamageStatsId = bytes32(bytes8(keccak256(abi.encode("basic magic attack"))));
        basicActionIdStatsId = bytes32(bytes8(keccak256(abi.encode("basic weapon attack"))));

        world.grantAccess(_mobSystemId("UD"), address(this));
        uint256[] memory sellableItems = new uint256[](10);
        uint256[] memory buyableItems = new uint256[](10);
        uint256[] memory stock = new uint256[](10);
        for(uint i = 0; i < 10; ++i){
            sellableItems[i] = i;
            buyableItems[i] = i;
            stock[i] = 5;
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

        uint256 shopMobId = world.UD__createMob(MobType.Shop, abi.encode(newShop), "https://github.com/raid-guild/ultimate-dominion");
        shopId = world.UD__spawnMob(shopMobId, 0, 0);

        uint256[] memory _inventory = new uint256[](1);
        _inventory[0] = 1;
        // create a starter armor
        StatRestrictionsData memory statRestrictions =
            StatRestrictionsData({minStrength: 0, minIntelligence: 0, minAgility: 0});
        bytes32[] memory effectIds = new bytes32[](1);
        effectIds[0] = basicActionIdStatsId;
        ArmorStatsData memory newArmor = ArmorStatsData({
            armorModifier: 1,
            minLevel: 0,
            strModifier: 1,
            agiModifier: 2,
            intModifier: 3,
            hpModifier: 4
        });

        WeaponStatsData memory newWeapon = WeaponStatsData({
            agiModifier: 2,
            intModifier: 3,
            hpModifier: 4,
            maxDamage: 0,
            minDamage: 0,
            minLevel: 0,
            strModifier: 1,
            effects: new bytes32[](0)
        });

        ConsumableStatsData memory newConsumable = ConsumableStatsData({
            minDamage: 0,
            maxDamage: 0,
            minLevel: 0,
            effects: new bytes32[](0)
        });
        SpellStatsData memory newSpell = SpellStatsData({
            minDamage: 0,
            maxDamage: 0,
            minLevel: 0,
            effects: new bytes32[](0)
        });
        vm.label(alice, "alice");
        vm.label(bob, "bob");
        vm.label(worldAddress, "world");
        vm.label(world.UD__getCharacterToken(), "character token");

        newArmorId = world.UD__createItem(
            ItemType.Armor, 10 ether, 100000000, 1 ether, abi.encode(newArmor, statRestrictions), "setup_armor_uri"
        );
        alsoNewArmorId = world.UD__createItem(
            ItemType.Armor, 10 ether, 100000000, 1 ether, abi.encode(newArmor, statRestrictions), "setup_armor_uri"
        );
        newWeaponId = world.UD__createItem(
            ItemType.Weapon, 10 ether, 100000000, 1 ether, abi.encode(newWeapon, statRestrictions), "setup_armor_uri"
        );
        alsoNewWeaponId = world.UD__createItem(
            ItemType.Weapon, 10 ether, 100000000, 1 ether, abi.encode(newWeapon, statRestrictions), "setup_armor_uri"
        );
        newConsumableId = world.UD__createItem(
            ItemType.Consumable, 10 ether, 100000000, 1 ether, abi.encode(newConsumable, statRestrictions), "setup_armor_uri"
        );
        newSpellId = world.UD__createItem(
            ItemType.Spell, 10 ether, 100000000, 1 ether, abi.encode(newSpell, statRestrictions), "setup_armor_uri"
        );
        alsoNewSpellId = world.UD__createItem(
            ItemType.Spell, 10 ether, 100000000, 1 ether, abi.encode(newSpell, statRestrictions), "setup_armor_uri"
        );
        world.grantAccess(_lootManagerSystemId("UD"), address(this));
        vm.stopPrank();

        vm.prank(alice);
        alicesCharacterId = world.UD__mintCharacter(alice, bytes32("Steve"), "setup_char_uri");

        vm.startPrank(bob);
        bobCharacterId = world.UD__mintCharacter(bob, bytes32("bob"), "setup_char_uri_bob/");
        uint256 fees = entropy.getFee(address(1));
        world.UD__rollStats{value: fees}(alicesRandomness, bobCharacterId, Classes.Mage);
        world.UD__enterGame(bobCharacterId);
        vm.stopPrank();
    }

    function getUser() internal returns (address payable) {
        address payable user = payable(address(uint160(uint256(keccak256(abi.encodePacked(userNonce++))))));
        vm.deal(user, 100 ether);
        return user;
    }
}
