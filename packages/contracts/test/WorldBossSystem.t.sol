// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {WorldBoss, Counters, Admin, EntitiesAtPosition, Spawned, Position} from "@codegen/index.sol";
import {WorldBossSystem} from "@systems/WorldBossSystem.sol";
import {MapSpawnSystem} from "@systems/MapSpawnSystem.sol";
import {ZONE_WINDY_PEAKS, WORLD_BOSS_COUNTER_ID} from "../constants.sol";

/**
 * @title Test_WorldBossSystem
 * @notice Tests for persistent world boss spawning with respawn timers.
 *
 * Fork-based tests against beta world. Registers the new WorldBossSystem
 * and upgraded MapSpawnSystem in setUp, then tests config, spawn, cooldown, and death.
 */
contract Test_WorldBossSystem is Test {
    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    IWorld public world;

    uint256 constant WARDEN_BOSS_ID = 1;
    uint256 constant WARDEN_MOB_ID = 34;
    uint16 constant SPAWN_X = 5;
    uint16 constant SPAWN_Y = 109;
    uint256 constant RESPAWN_SECONDS = 3600;

    function setUp() public {
        vm.startPrank(deployer);
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        // Deploy and register WorldBossSystem
        WorldBossSystem wbs = new WorldBossSystem();
        ResourceId wbsId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "WorldBossSys");
        world.registerSystem(wbsId, wbs, true);

        // Deploy and register upgraded MapSpawnSystem
        MapSpawnSystem mss = new MapSpawnSystem();
        ResourceId mssId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MapSpawnSystem");
        world.registerSystem(mssId, mss, true);

        vm.stopPrank();
    }

    // ── Configuration ──

    function test_configureWorldBoss_setAndGet() public {
        vm.prank(deployer);
        world.UD__configureWorldBoss(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);

        assertEq(WorldBoss.getMobId(WARDEN_BOSS_ID), WARDEN_MOB_ID, "mobId");
        assertEq(WorldBoss.getZoneId(WARDEN_BOSS_ID), ZONE_WINDY_PEAKS, "zoneId");
        assertEq(WorldBoss.getSpawnX(WARDEN_BOSS_ID), SPAWN_X, "spawnX");
        assertEq(WorldBoss.getSpawnY(WARDEN_BOSS_ID), SPAWN_Y, "spawnY");
        assertEq(WorldBoss.getRespawnSeconds(WARDEN_BOSS_ID), RESPAWN_SECONDS, "respawnSeconds");
        assertTrue(WorldBoss.getActive(WARDEN_BOSS_ID), "active");
        assertEq(WorldBoss.getEntityId(WARDEN_BOSS_ID), bytes32(0), "entityId should be 0 before spawn");
    }

    function test_configureWorldBoss_updatesCounter() public {
        vm.prank(deployer);
        world.UD__configureWorldBoss(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);

        uint256 counter = Counters.getCounter(address(world), WORLD_BOSS_COUNTER_ID);
        assertEq(counter, WARDEN_BOSS_ID, "counter should match bossId");
    }

    function test_configureWorldBoss_onlyAdmin() public {
        address notAdmin = address(0xdead);
        vm.prank(notAdmin);
        vm.expectRevert();
        world.UD__configureWorldBoss(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
    }

    // ── Spawn ──

    function test_trySpawnWorldBosses_spawnsOnFirstEntry() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBoss(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);

        // Trigger spawn — no lastKilledAt, should spawn immediately
        world.UD__trySpawnWorldBosses(ZONE_WINDY_PEAKS);

        bytes32 entityId = WorldBoss.getEntityId(WARDEN_BOSS_ID);
        assertTrue(entityId != bytes32(0), "boss should be spawned");
        assertTrue(Spawned.getSpawned(entityId), "entity should be marked spawned");

        (uint16 ex, uint16 ey) = Position.get(entityId);
        assertEq(ex, SPAWN_X, "entity x");
        assertEq(ey, SPAWN_Y, "entity y");
        vm.stopPrank();
    }

    function test_trySpawnWorldBosses_noDoubleSpawn() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBoss(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
        world.UD__trySpawnWorldBosses(ZONE_WINDY_PEAKS);

        bytes32 firstEntityId = WorldBoss.getEntityId(WARDEN_BOSS_ID);

        // Second call should not re-spawn
        world.UD__trySpawnWorldBosses(ZONE_WINDY_PEAKS);

        bytes32 secondEntityId = WorldBoss.getEntityId(WARDEN_BOSS_ID);
        assertEq(firstEntityId, secondEntityId, "entityId should not change");
        vm.stopPrank();
    }

    function test_trySpawnWorldBosses_wrongZone_skipped() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBoss(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);

        // Trigger for zone 1 — Warden is in zone 2, should not spawn
        world.UD__trySpawnWorldBosses(1);

        bytes32 entityId = WorldBoss.getEntityId(WARDEN_BOSS_ID);
        assertEq(entityId, bytes32(0), "boss should not spawn in wrong zone");
        vm.stopPrank();
    }

    function test_trySpawnWorldBosses_inactive_skipped() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBoss(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
        world.UD__setWorldBossActive(WARDEN_BOSS_ID, false);

        world.UD__trySpawnWorldBosses(ZONE_WINDY_PEAKS);

        bytes32 entityId = WorldBoss.getEntityId(WARDEN_BOSS_ID);
        assertEq(entityId, bytes32(0), "inactive boss should not spawn");
        vm.stopPrank();
    }

    // ── Death + Respawn ──

    function test_onWorldBossDeath_clearsState() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBoss(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
        world.UD__trySpawnWorldBosses(ZONE_WINDY_PEAKS);

        bytes32 entityId = WorldBoss.getEntityId(WARDEN_BOSS_ID);
        assertTrue(entityId != bytes32(0), "boss should be alive");

        // Simulate death
        world.UD__onWorldBossDeath(entityId);

        assertEq(WorldBoss.getEntityId(WARDEN_BOSS_ID), bytes32(0), "entityId should be cleared");
        assertTrue(WorldBoss.getLastKilledAt(WARDEN_BOSS_ID) > 0, "lastKilledAt should be set");
        vm.stopPrank();
    }

    function test_trySpawnWorldBosses_respectsCooldown() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBoss(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
        world.UD__trySpawnWorldBosses(ZONE_WINDY_PEAKS);

        bytes32 entityId = WorldBoss.getEntityId(WARDEN_BOSS_ID);
        world.UD__onWorldBossDeath(entityId);

        // Try to spawn during cooldown — should not spawn
        world.UD__trySpawnWorldBosses(ZONE_WINDY_PEAKS);
        assertEq(WorldBoss.getEntityId(WARDEN_BOSS_ID), bytes32(0), "should not spawn during cooldown");
        vm.stopPrank();
    }

    function test_trySpawnWorldBosses_spawnsAfterCooldown() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBoss(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
        world.UD__trySpawnWorldBosses(ZONE_WINDY_PEAKS);

        bytes32 entityId = WorldBoss.getEntityId(WARDEN_BOSS_ID);
        world.UD__onWorldBossDeath(entityId);

        // Warp past cooldown
        vm.warp(block.timestamp + RESPAWN_SECONDS + 1);

        world.UD__trySpawnWorldBosses(ZONE_WINDY_PEAKS);
        bytes32 newEntityId = WorldBoss.getEntityId(WARDEN_BOSS_ID);
        assertTrue(newEntityId != bytes32(0), "boss should respawn after cooldown");
        assertTrue(newEntityId != entityId, "should be a new entity");
        vm.stopPrank();
    }

    function test_onWorldBossDeath_nonBossEntity_noop() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBoss(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
        world.UD__trySpawnWorldBosses(ZONE_WINDY_PEAKS);

        bytes32 bossEntityId = WorldBoss.getEntityId(WARDEN_BOSS_ID);

        // Call with a random non-boss entityId — should be a no-op
        bytes32 fakeEntity = bytes32(uint256(0xdeadbeef));
        world.UD__onWorldBossDeath(fakeEntity);

        // Boss should still be alive
        assertEq(WorldBoss.getEntityId(WARDEN_BOSS_ID), bossEntityId, "boss should be unaffected");
        vm.stopPrank();
    }
}
