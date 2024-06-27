pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, ItemType, MobType} from "@codegen/common.sol";
import {CharacterStatsData} from "@tables/CharacterStats.sol";
import {PuppetModule} from "@latticexyz/world-modules/src/modules/puppet/PuppetModule.sol";
import {UltimateDominionConfig, PositionData} from "@codegen/index.sol";
import {UltimateDominionConfigSystem} from "@systems/UltimateDominionConfigSystem.sol";
import {ERC1155Module} from "@erc1155/ERC1155Module.sol";
import {ERC1155System} from "@erc1155/ERC1155System.sol";
import {IERC1155MetadataURI} from "@erc1155/IERC1155MetadataURI.sol";
import {IERC1155} from "@erc1155/IERC1155.sol";
import {registerERC1155} from "@erc1155/registerERC1155.sol";
import {_erc1155SystemId} from "@erc1155/utils.sol";
import {WeaponStats, MonsterStats} from "@interfaces/Structs.sol";
import {MobsData} from "@tables/Mobs.sol";
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
import {_mobSystemId} from "../src/utils.sol";
import "forge-std/console2.sol";
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
            hp: 10000,
            armor: 10000,
            level: 1,
            experience: 10000,
            baseDamage: 10000,
            class: Classes.Warrior,
            inventory: _inventory
        });
        uint256 newMobId = world.UD__createMob(MobType.Monster, abi.encode(newMonster), "test_monster_uri");

        MobsData memory newMob = world.UD__getMob(newMobId);
        assertEq(newMobId, 2);
        assertEq(uint8(newMob.mobType), uint8(MobType.Monster));
        assertEq(newMob.mobStats, abi.encode(newMonster));
        assertEq(newMob.mobMetadata, "test_monster_uri");
    }

    function test_getEntityId() public {
        PositionData memory posDat = PositionData({x: 1, y: 2});
        bytes32 entityId = bytes32(abi.encodePacked(uint32(starterMobId), uint192(1), posDat.x, posDat.y));

        assertEq(world.UD__spawnMob(1, posDat), entityId);
    }

    function test_getMobId() public {
        PositionData memory posDat = PositionData({x: 1, y: 2});
        bytes32 entityId = world.UD__spawnMob(starterMobId, posDat);

        assertEq(world.UD__getMobId(entityId), starterMobId);
    }

    function test_getMobPosition() public {
        PositionData memory posDat = PositionData({x: 1, y: 2});
        bytes32 entityId = world.UD__spawnMob(starterMobId, posDat);
        (uint16 x, uint16 y) = world.UD__getMobPosition(entityId);
        assertEq(x, 1);
        assertEq(y, 2);
    }

    function test_getSpawnCounter() public {
        PositionData memory posDat = PositionData({x: 1, y: 2});
        bytes32 entityId = world.UD__spawnMob(starterMobId, posDat);
        assertEq(world.UD__getSpawnCounter(entityId), 1);
    }
}
