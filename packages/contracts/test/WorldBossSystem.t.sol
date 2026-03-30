// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {WorldBossV2, Counters, Admin, EntitiesAtPosition, Spawned, Position} from "@codegen/index.sol";
import {WorldBossV2System} from "@systems/WorldBossV2System.sol";
import {MapSpawnSystem} from "@systems/MapSpawnSystem.sol";
import {ZONE_WINDY_PEAKS, WORLD_BOSS_COUNTER_ID} from "../constants.sol";

/**
 * @title Test_WorldBossV2System
 * @notice Tests for persistent world boss spawning with respawn timers.
 *
 * Fork-based tests against beta world. Registers the new WorldBossV2System
 * and upgraded MapSpawnSystem in setUp, then tests config, spawn, cooldown, and death.
 */
contract Test_WorldBossV2System is Test {
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

        // Deploy and register WorldBossV2System
        WorldBossV2System wbs = new WorldBossV2System();
        ResourceId wbsId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "WorldBossV2Sys");
        world.registerSystem(wbsId, wbs, true);

        // Deploy and register upgraded MapSpawnSystem
        MapSpawnSystem mss = new MapSpawnSystem();
        ResourceId mssId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MapSpawnSystem");
        world.registerSystem(mssId, mss, true);

        vm.stopPrank();
    }

    // ── Configuration ──

    function test_configureWorldBossV2_setAndGet() public {
        vm.prank(deployer);
        world.UD__configureWorldBossV2(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);

        assertEq(WorldBossV2.getMobId(WARDEN_BOSS_ID), WARDEN_MOB_ID, "mobId");
        assertEq(WorldBossV2.getZoneId(WARDEN_BOSS_ID), ZONE_WINDY_PEAKS, "zoneId");
        assertEq(WorldBossV2.getSpawnX(WARDEN_BOSS_ID), SPAWN_X, "spawnX");
        assertEq(WorldBossV2.getSpawnY(WARDEN_BOSS_ID), SPAWN_Y, "spawnY");
        assertEq(WorldBossV2.getRespawnSeconds(WARDEN_BOSS_ID), RESPAWN_SECONDS, "respawnSeconds");
        assertTrue(WorldBossV2.getActive(WARDEN_BOSS_ID), "active");
        assertEq(WorldBossV2.getEntityId(WARDEN_BOSS_ID), bytes32(0), "entityId should be 0 before spawn");
    }

    function test_configureWorldBossV2_updatesCounter() public {
        vm.prank(deployer);
        world.UD__configureWorldBossV2(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);

        uint256 counter = Counters.getCounter(address(world), WORLD_BOSS_COUNTER_ID);
        assertEq(counter, WARDEN_BOSS_ID, "counter should match bossId");
    }

    function test_configureWorldBossV2_onlyAdmin() public {
        address notAdmin = address(0xdead);
        vm.prank(notAdmin);
        vm.expectRevert();
        world.UD__configureWorldBossV2(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
    }

    // ── Spawn ──

    function test_trySpawnWorldBossV2es_spawnsOnFirstEntry() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBossV2(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);

        // Trigger spawn — no lastKilledAt, should spawn immediately
        world.UD__trySpawnWorldBossV2es(ZONE_WINDY_PEAKS);

        bytes32 entityId = WorldBossV2.getEntityId(WARDEN_BOSS_ID);
        assertTrue(entityId != bytes32(0), "boss should be spawned");
        assertTrue(Spawned.getSpawned(entityId), "entity should be marked spawned");

        (uint16 ex, uint16 ey) = Position.get(entityId);
        assertEq(ex, SPAWN_X, "entity x");
        assertEq(ey, SPAWN_Y, "entity y");
        vm.stopPrank();
    }

    function test_trySpawnWorldBossV2es_noDoubleSpawn() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBossV2(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
        world.UD__trySpawnWorldBossV2es(ZONE_WINDY_PEAKS);

        bytes32 firstEntityId = WorldBossV2.getEntityId(WARDEN_BOSS_ID);

        // Second call should not re-spawn
        world.UD__trySpawnWorldBossV2es(ZONE_WINDY_PEAKS);

        bytes32 secondEntityId = WorldBossV2.getEntityId(WARDEN_BOSS_ID);
        assertEq(firstEntityId, secondEntityId, "entityId should not change");
        vm.stopPrank();
    }

    function test_trySpawnWorldBossV2es_wrongZone_skipped() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBossV2(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);

        // Trigger for zone 1 — Warden is in zone 2, should not spawn
        world.UD__trySpawnWorldBossV2es(1);

        bytes32 entityId = WorldBossV2.getEntityId(WARDEN_BOSS_ID);
        assertEq(entityId, bytes32(0), "boss should not spawn in wrong zone");
        vm.stopPrank();
    }

    function test_trySpawnWorldBossV2es_inactive_skipped() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBossV2(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
        world.UD__setWorldBossV2Active(WARDEN_BOSS_ID, false);

        world.UD__trySpawnWorldBossV2es(ZONE_WINDY_PEAKS);

        bytes32 entityId = WorldBossV2.getEntityId(WARDEN_BOSS_ID);
        assertEq(entityId, bytes32(0), "inactive boss should not spawn");
        vm.stopPrank();
    }

    // ── Death + Respawn ──

    function test_onWorldBossV2Death_clearsState() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBossV2(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
        world.UD__trySpawnWorldBossV2es(ZONE_WINDY_PEAKS);

        bytes32 entityId = WorldBossV2.getEntityId(WARDEN_BOSS_ID);
        assertTrue(entityId != bytes32(0), "boss should be alive");

        // Simulate death
        world.UD__onWorldBossV2Death(entityId);

        assertEq(WorldBossV2.getEntityId(WARDEN_BOSS_ID), bytes32(0), "entityId should be cleared");
        assertTrue(WorldBossV2.getLastKilledAt(WARDEN_BOSS_ID) > 0, "lastKilledAt should be set");
        vm.stopPrank();
    }

    function test_trySpawnWorldBossV2es_respectsCooldown() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBossV2(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
        world.UD__trySpawnWorldBossV2es(ZONE_WINDY_PEAKS);

        bytes32 entityId = WorldBossV2.getEntityId(WARDEN_BOSS_ID);
        world.UD__onWorldBossV2Death(entityId);

        // Try to spawn during cooldown — should not spawn
        world.UD__trySpawnWorldBossV2es(ZONE_WINDY_PEAKS);
        assertEq(WorldBossV2.getEntityId(WARDEN_BOSS_ID), bytes32(0), "should not spawn during cooldown");
        vm.stopPrank();
    }

    function test_trySpawnWorldBossV2es_spawnsAfterCooldown() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBossV2(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
        world.UD__trySpawnWorldBossV2es(ZONE_WINDY_PEAKS);

        bytes32 entityId = WorldBossV2.getEntityId(WARDEN_BOSS_ID);
        world.UD__onWorldBossV2Death(entityId);

        // Warp past cooldown
        vm.warp(block.timestamp + RESPAWN_SECONDS + 1);

        world.UD__trySpawnWorldBossV2es(ZONE_WINDY_PEAKS);
        bytes32 newEntityId = WorldBossV2.getEntityId(WARDEN_BOSS_ID);
        assertTrue(newEntityId != bytes32(0), "boss should respawn after cooldown");
        assertTrue(newEntityId != entityId, "should be a new entity");
        vm.stopPrank();
    }

    function test_onWorldBossV2Death_nonBossEntity_noop() public {
        vm.startPrank(deployer);
        world.UD__configureWorldBossV2(WARDEN_BOSS_ID, WARDEN_MOB_ID, ZONE_WINDY_PEAKS, SPAWN_X, SPAWN_Y, RESPAWN_SECONDS);
        world.UD__trySpawnWorldBossV2es(ZONE_WINDY_PEAKS);

        bytes32 bossEntityId = WorldBossV2.getEntityId(WARDEN_BOSS_ID);

        // Call with a random non-boss entityId — should be a no-op
        bytes32 fakeEntity = bytes32(uint256(0xdeadbeef));
        world.UD__onWorldBossV2Death(fakeEntity);

        // Boss should still be alive
        assertEq(WorldBossV2.getEntityId(WARDEN_BOSS_ID), bossEntityId, "boss should be unaffected");
        vm.stopPrank();
    }
}
