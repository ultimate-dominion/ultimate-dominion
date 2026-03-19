// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, MobType} from "@codegen/common.sol";
import {Mobs, MobStats, MobStatsData} from "@codegen/index.sol";
import {MonsterStats} from "@interfaces/Structs.sol";
import {_mobSystemId} from "../src/utils.sol";

/**
 * @title Test_MobInventoryTrim
 * @notice Tests for the V4 spawned inventory trim in MobSystem.spawnMob()
 *
 * Cases:
 *   1. Non-boss gets 1 weapon — spawned inventory has only index 0
 *   2. Boss gets 2 weapons — spawned inventory has index 0 and 1
 *   3. Template inventory preserved — drops still read full template
 */
contract Test_MobInventoryTrim is SetUp {
    uint256 normalMobId;
    uint256 bossMobId;

    function setUp() public override {
        super.setUp();

        vm.startPrank(deployer);
        world.grantAccess(_mobSystemId("UD"), address(this));

        // Create a normal monster with 5-item inventory
        uint256[] memory normalInv = new uint256[](5);
        normalInv[0] = 1; // combat weapon
        normalInv[1] = 2;
        normalInv[2] = 3;
        normalInv[3] = 4;
        normalInv[4] = 5;
        MonsterStats memory normalMonster = MonsterStats({
            agility: 5,
            armor: 0,
            class: Classes.Warrior,
            experience: 100,
            hasBossAI: false,
            hitPoints: 10,
            intelligence: 2,
            inventory: normalInv,
            level: 1,
            strength: 5
        });
        normalMobId = world.UD__createMob(MobType.Monster, abi.encode(normalMonster), "test_normal_mob");

        // Create a boss monster with 5-item inventory
        uint256[] memory bossInv = new uint256[](5);
        bossInv[0] = 10; // combat weapon 1
        bossInv[1] = 11; // combat weapon 2
        bossInv[2] = 12;
        bossInv[3] = 13;
        bossInv[4] = 14;
        MonsterStats memory bossMonster = MonsterStats({
            agility: 12,
            armor: 4,
            class: Classes.Warrior,
            experience: 10000,
            hasBossAI: true,
            hitPoints: 100,
            intelligence: 10,
            inventory: bossInv,
            level: 10,
            strength: 20
        });
        bossMobId = world.UD__createMob(MobType.Monster, abi.encode(bossMonster), "test_boss_mob");

        vm.stopPrank();
    }

    function test_nonBoss_singleWeapon() public {
        vm.prank(deployer);
        bytes32 entityId = world.UD__spawnMob(normalMobId, 3, 3);

        // Spawned MobStats should have only 1 item (combat weapon at index 0)
        MobStatsData memory spawned = MobStats.get(entityId);
        assertEq(spawned.inventory.length, 1, "non-boss should have 1 weapon");
        assertEq(spawned.inventory[0], 1, "should be the first item (combat weapon)");
    }

    function test_boss_twoWeapons() public {
        vm.prank(deployer);
        bytes32 entityId = world.UD__spawnMob(bossMobId, 4, 4);

        // Spawned MobStats should have 2 items (boss uses index 0+1)
        MobStatsData memory spawned = MobStats.get(entityId);
        assertEq(spawned.inventory.length, 2, "boss should have 2 weapons");
        assertEq(spawned.inventory[0], 10, "first weapon");
        assertEq(spawned.inventory[1], 11, "second weapon");
    }

    function test_templatePreserved() public {
        vm.prank(deployer);
        world.UD__spawnMob(normalMobId, 3, 3);

        // Template (Mobs table) should still have full 5-item inventory
        MonsterStats memory template = abi.decode(Mobs.getMobStats(normalMobId), (MonsterStats));
        assertEq(template.inventory.length, 5, "template should retain full inventory");
        assertEq(template.inventory[0], 1, "template weapon 0");
        assertEq(template.inventory[4], 5, "template item 4");
    }

    function test_bossTemplatePreserved() public {
        vm.prank(deployer);
        world.UD__spawnMob(bossMobId, 4, 4);

        // Template should still have full 5-item inventory
        MonsterStats memory template = abi.decode(Mobs.getMobStats(bossMobId), (MonsterStats));
        assertEq(template.inventory.length, 5, "boss template should retain full inventory");
    }
}
