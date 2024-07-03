// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import "forge-std/StdJson.sol";
import {MudTest} from "@latticexyz/world/test/MudTest.t.sol";
import {getKeysWithValue} from "@latticexyz/world-modules/src/modules/keyswithvalue/getKeysWithValue.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {IEntropy} from "@pythnetwork/IEntropy.sol";
import {IERC1155System} from "@erc1155/IERC1155System.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";
import {Characters, CharactersData, UltimateDominionConfig} from "@codegen/index.sol";
import {Classes, MobType, ItemType} from "@codegen/common.sol";
import {_itemsSystemId} from "../src/utils.sol";
import {WeaponStats, MonsterStats, ArmorStats} from "@interfaces/Structs.sol";
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
    uint256 starterMobId;

    IERC20Mintable public goldToken;
    IERC721Mintable public characterToken;
    IERC1155System public erc1155System;

    bytes32 alicesCharacterId;
    bytes32 bobCharacterId;
    bytes32 public alicesRandomness = bytes32(keccak256(abi.encode("alicesRestaurant")));

    uint256 newArmorId;

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

        uint256[] memory _inventory = new uint256[](1);
        _inventory[0] = 1;

        MonsterStats memory newMonster = MonsterStats({
            hitPoints: 10,
            armor: 1,
            strength: 1,
            agility: 1,
            intelligence: 1,
            level: 1,
            experience: 10,
            class: Classes.Warrior,
            inventory: _inventory
        });
        starterMobId = world.UD__createMob(MobType.Monster, abi.encode(newMonster), "test_monster_uri");
        // create a starter armor
        uint8[] memory classRestrictions = new uint8[](0);
        ArmorStats memory newArmor = ArmorStats({
            armorModifier: 1,
            classRestrictions: classRestrictions,
            minLevel: 0,
            strModifier: 1,
            agiModifier: 2,
            intModifier: 3,
            hitPointModifier: 4
        });

        vm.label(alice, "alice");
        vm.label(bob, "bob");
        vm.label(worldAddress, "world");
        vm.label(world.UD__getCharacterToken(), "character token");

        newArmorId = world.UD__createItem(ItemType.Armor, 10 ether, abi.encode(newArmor), "setup_armor_uri");

        world.grantAccess(_itemsSystemId("UD"), address(this));

        vm.stopPrank();

        vm.prank(alice);
        alicesCharacterId = world.UD__mintCharacter(alice, bytes32("Steve"), "setup_char_uri");

        vm.startPrank(bob);
        bobCharacterId = world.UD__mintCharacter(bob, bytes32("bob"), "setup_char_uri_bob/");
        uint256 fees = entropy.getFee(address(1));
        world.UD__rollStats{value: fees}(alicesRandomness, bobCharacterId, Classes.Rogue);
        world.UD__enterGame(bobCharacterId);
        vm.stopPrank();
    }

    function getUser() internal returns (address payable) {
        address payable user = payable(address(uint160(uint256(keccak256(abi.encodePacked(userNonce++))))));
        vm.deal(user, 100 ether);
        return user;
    }
}
