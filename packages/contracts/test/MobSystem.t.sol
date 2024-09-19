pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType, MobType} from "@codegen/common.sol";
import {StatsData} from "@tables/Stats.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {UltimateDominionConfigSystem} from "@systems/UltimateDominionConfigSystem.sol";
import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155MetadataURI} from "@erc1155/IERC1155MetadataURI.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";
import {MonsterStats} from "@interfaces/Structs.sol";
import {Mobs, MobsData} from "@tables/Mobs.sol";
import {ResourceIdLib} from "@latticexyz/store/src/ResourceId.sol";
import {ResourceId, WorldResourceIdLib, WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {
    GOLD_NAMESPACE,
    CHARACTERS_NAMESPACE,
    ERC721_NAME,
    ERC721_SYMBOL,
    TOKEN_URI,
    ITEMS_NAMESPACE
} from "../constants.sol";
import {GasReporter} from "@latticexyz/gas-report/src/GasReporter.sol";
import {LibChunks} from "../src/libraries/LibChunks.sol";
import {_mobSystemId} from "../src/utils.sol";
/**
 * // all stats (except level and exp) are to the 10,000s place.  so 10_000 == 1;
 *     // hit points
 *     uint256 hp;
 *     // damage reduction %
 *     uint256 armor;
 *     // monster level
 *     uint256 level;
 *     // base damage
 *     uint256 baseDamage;
 *     // monster's class
 *     Classes class;
 *     // item ids of potential drops
 *     uint256[] inventory;
 *     // the amount of experience this monster is worth
 *     uint256 experience;
 */

contract Test_MobSystem is SetUp, GasReporter {
    using LibChunks for uint256;

    function setUp() public override {
        super.setUp();
        vm.prank(deployer);
        world.grantAccess(_mobSystemId("UD"), address(this));
    }

    function test_createMob() public {
        vm.startPrank(deployer);
        uint256[] memory _inventory = new uint256[](1);
        _inventory[0] = 1;
        MonsterStats memory newMonster = MonsterStats({
            agility: 1,
            armor: 1,
            class: Classes.Warrior,
            experience: 10,
            hitPoints: 10,
            intelligence: 1,
            inventory: _inventory,
            level: 1,
            strength: 1
        });
        uint256 newMobId = world.UD__createMob(MobType.Monster, abi.encode(newMonster), "test_monster_uri");

        MobsData memory newMob = world.UD__getMob(newMobId);
        assertEq(newMobId, 23);
        assertEq(uint8(newMob.mobType), uint8(MobType.Monster));
        assertEq(newMob.mobStats, abi.encode(newMonster));
        assertEq(newMob.mobMetadata, "test_monster_uri");
    }

    function test_getEntityId() public {
        bytes32 entityId = bytes32(abi.encodePacked(uint32(1), uint192(2), uint16(1), uint16(2)));

        assertEq(world.UD__spawnMob(1, 1, 2), entityId);
    }

    function test_getMobId() public {
        bytes32 entityId = world.UD__spawnMob(1, 1, 2);

        assertEq(world.UD__getMobId(entityId), 1);
    }

    function test_getMobPosition() public {
        bytes32 entityId = world.UD__spawnMob(1, 1, 2);
        (uint16 x, uint16 y) = world.UD__getMobPosition(entityId);
        assertEq(x, 1);
        assertEq(y, 2);
    }

    function test_getSpawnCounter() public {
        bytes32 entityId = world.UD__spawnMob(1, 1, 2);
        assertEq(world.UD__getSpawnCounter(entityId), 2);
    }

    function test_spawnMonsterOnMove() public {
        vm.startPrank(bob);
        world.UD__spawn(bobCharacterId);
        world.UD__move(bobCharacterId, 0, 1);
        bytes32[] memory ents = world.UD__getEntitiesAtPosition(0, 1);

        assertEq(world.UD__getEntitiesAtPosition(0, 0).length, 1, "incorrect entities at spawn");
        assertLt(ents.length, 7, "incorrect spawned monster lenth");
        assertEq(ents[0], bobCharacterId, "incorrect entity id for bob");
    }

    function test_removeEntity() public {
        vm.startPrank(bob);
        world.UD__spawn(bobCharacterId);
        world.UD__move(bobCharacterId, 0, 1);
        vm.stopPrank();
        vm.prank(alice);
        vm.expectRevert();
        world.UD__removeEntityFromBoard(bobCharacterId);

        // vm.prank(deployer);
        // world.UD__adminRemoveEntity(bobCharacterId);

        vm.warp(block.timestamp + 11 minutes);
        vm.prank(alice);
        world.UD__removeEntityFromBoard(bobCharacterId);
    }
}
