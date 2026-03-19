// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {Classes, MobType} from "@codegen/common.sol";
import {BossSpawnConfig, MobsByLevel, EntitiesAtPosition} from "@codegen/index.sol";
import {MonsterStats} from "@interfaces/Structs.sol";
import {_mobSystemId} from "../src/utils.sol";

/**
 * @title Test_MapSpawnBoss
 * @notice Tests for the V4 boss spawn system in MapSpawnSystem
 *
 * Cases:
 *   1. Roll fail — no boss spawns when roll exceeds chance
 *   2. Roll success — boss spawns when roll is under chance
 *   3. Any tile — boss can spawn on inner tiles (not just outer zone)
 *   4. Disabled config — bossMobId=0 means no boss spawn check
 */
contract Test_MapSpawnBoss is SetUp {
    uint256 bossMobId;

    function setUp() public override {
        super.setUp();

        vm.startPrank(deployer);
        world.grantAccess(_mobSystemId("UD"), address(this));

        // Create a boss mob
        uint256[] memory inv = new uint256[](2);
        inv[0] = 1;
        inv[1] = 1;
        MonsterStats memory boss = MonsterStats({
            agility: 12,
            armor: 4,
            class: Classes.Warrior,
            experience: 10000,
            hasBossAI: true,
            hitPoints: 100,
            intelligence: 10,
            inventory: inv,
            level: 10,
            strength: 20
        });
        bossMobId = world.UD__createMob(MobType.Monster, abi.encode(boss), "test_boss");

        // Remove boss from MobsByLevel so it doesn't spawn normally
        // (the createMob adds it to MobsByLevel[10])
        uint256[] memory level10 = MobsByLevel.getMobIds(10);
        uint256 newLen;
        for (uint256 i; i < level10.length; i++) {
            if (level10[i] != bossMobId) {
                level10[newLen] = level10[i];
                newLen++;
            }
        }
        uint256[] memory trimmed = new uint256[](newLen);
        for (uint256 i; i < newLen; i++) {
            trimmed[i] = level10[i];
        }
        MobsByLevel.setMobIds(10, trimmed);

        vm.stopPrank();
    }

    function test_disabledConfig_noBossSpawn() public {
        // BossSpawnConfig not set → bossMobId = 0 → no boss spawn check
        uint256 configuredBoss = BossSpawnConfig.getBossMobId();
        assertEq(configuredBoss, 0, "boss should not be configured");

        // Move bob to trigger spawns
        vm.startPrank(bob);
        world.UD__spawn(bobCharacterId);
        world.UD__move(bobCharacterId, 0, 1);
        vm.stopPrank();

        // Verify no boss spawned (only bob + regular spawns)
        bytes32[] memory entities = world.UD__getEntitiesAtPosition(0, 1);
        for (uint256 i; i < entities.length; i++) {
            if (entities[i] != bobCharacterId) {
                uint256 mobId = world.UD__getMobId(entities[i]);
                assertTrue(mobId != bossMobId, "boss should not have spawned");
            }
        }
    }

    function test_bossSpawn_configured() public {
        vm.startPrank(deployer);
        // Set boss spawn with 10000bp (100% chance) to guarantee spawn
        BossSpawnConfig.set(bossMobId, 10000);
        vm.stopPrank();

        // Move bob to trigger spawns
        vm.startPrank(bob);
        world.UD__spawn(bobCharacterId);
        world.UD__move(bobCharacterId, 0, 1);
        vm.stopPrank();

        // Verify boss spawned
        bytes32[] memory entities = world.UD__getEntitiesAtPosition(0, 1);
        bool bossFound = false;
        for (uint256 i; i < entities.length; i++) {
            if (entities[i] != bobCharacterId) {
                uint256 mobId = world.UD__getMobId(entities[i]);
                if (mobId == bossMobId) {
                    bossFound = true;
                    break;
                }
            }
        }
        assertTrue(bossFound, "boss should have spawned at 100% chance");
    }

    function test_bossSpawn_innerTile() public {
        vm.startPrank(deployer);
        // Set boss spawn with 100% chance
        BossSpawnConfig.set(bossMobId, 10000);
        vm.stopPrank();

        // Move bob to an inner tile (distance < 5)
        vm.startPrank(bob);
        world.UD__spawn(bobCharacterId);
        world.UD__move(bobCharacterId, 1, 0);
        world.UD__move(bobCharacterId, 2, 0);
        vm.stopPrank();

        // Verify boss can spawn on inner tile
        bytes32[] memory entities = world.UD__getEntitiesAtPosition(2, 0);
        bool bossFound = false;
        for (uint256 i; i < entities.length; i++) {
            if (entities[i] != bobCharacterId) {
                uint256 mobId = world.UD__getMobId(entities[i]);
                if (mobId == bossMobId) {
                    bossFound = true;
                    break;
                }
            }
        }
        assertTrue(bossFound, "boss should spawn on inner tile too");
    }

    function test_bossSpawn_rollFail() public {
        vm.startPrank(deployer);
        // Set boss spawn with 0bp (0% chance) — should never spawn
        BossSpawnConfig.set(bossMobId, 0);
        vm.stopPrank();

        vm.startPrank(bob);
        world.UD__spawn(bobCharacterId);
        world.UD__move(bobCharacterId, 0, 1);
        vm.stopPrank();

        bytes32[] memory entities = world.UD__getEntitiesAtPosition(0, 1);
        for (uint256 i; i < entities.length; i++) {
            if (entities[i] != bobCharacterId) {
                uint256 mobId = world.UD__getMobId(entities[i]);
                assertTrue(mobId != bossMobId, "boss should not spawn at 0% chance");
            }
        }
    }
}
