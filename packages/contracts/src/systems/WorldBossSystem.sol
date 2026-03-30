// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {WorldBossV2, Counters, Admin, Spawned} from "@codegen/index.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IMobSystem} from "@world/IWorld.sol";
import {NotAdmin} from "../Errors.sol";
import {_requireSystemOrAdmin} from "../utils.sol";
import {WORLD_BOSS_COUNTER_ID} from "../../constants.sol";
import {BoardCleanupLib} from "../libraries/BoardCleanupLib.sol";

contract WorldBossSystem is System {
    modifier onlyAdmin() {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        _;
    }

    // ============ Admin Functions ============

    /// @notice Create or update a world boss configuration.
    function configureWorldBoss(
        uint256 bossId,
        uint256 mobId,
        uint256 zoneId,
        uint16 spawnX,
        uint16 spawnY,
        uint256 respawnSeconds
    ) external onlyAdmin {
        // Auto-increment counter if this is a new boss
        uint256 currentCount = Counters.getCounter(_world(), WORLD_BOSS_COUNTER_ID);
        if (bossId > currentCount) {
            Counters.setCounter(_world(), WORLD_BOSS_COUNTER_ID, bossId);
        }

        WorldBossV2.setMobId(bossId, mobId);
        WorldBossV2.setZoneId(bossId, zoneId);
        WorldBossV2.setSpawnX(bossId, spawnX);
        WorldBossV2.setSpawnY(bossId, spawnY);
        WorldBossV2.setRespawnSeconds(bossId, respawnSeconds);
        WorldBossV2.setActive(bossId, true);
    }

    /// @notice Toggle a world boss on or off.
    function setWorldBossActive(uint256 bossId, bool active) external onlyAdmin {
        WorldBossV2.setActive(bossId, active);
    }

    /// @notice Force-despawn a live world boss.
    function despawnWorldBoss(uint256 bossId) external onlyAdmin {
        bytes32 entityId = WorldBossV2.getEntityId(bossId);
        if (entityId != bytes32(0)) {
            BoardCleanupLib.removeFromBoard(entityId, false);
            WorldBossV2.setEntityId(bossId, bytes32(0));
        }
    }

    // ============ System-Callable Functions ============

    /// @notice Check and spawn any world bosses due for respawn in this zone.
    /// @dev Called from MapSpawnSystem on tile entry. Lazy spawn — no cron needed.
    function trySpawnWorldBosses(uint256 zoneId) external {
        _requireSystemOrAdmin(_msgSender());

        uint256 totalBosses = Counters.getCounter(_world(), WORLD_BOSS_COUNTER_ID);
        for (uint256 i = 1; i <= totalBosses; i++) {
            if (!WorldBossV2.getActive(i)) continue;
            if (WorldBossV2.getZoneId(i) != zoneId) continue;
            if (WorldBossV2.getEntityId(i) != bytes32(0)) continue; // already alive

            uint256 lastKilled = WorldBossV2.getLastKilledAt(i);
            uint256 respawn = WorldBossV2.getRespawnSeconds(i);
            if (lastKilled > 0 && block.timestamp < lastKilled + respawn) continue; // cooldown

            // Spawn the boss at its fixed position
            uint256 mobId = WorldBossV2.getMobId(i);
            uint16 sx = WorldBossV2.getSpawnX(i);
            uint16 sy = WorldBossV2.getSpawnY(i);

            bytes memory returnData = SystemSwitch.call(
                abi.encodeCall(IMobSystem.UD__spawnMob, (mobId, zoneId, sx, sy))
            );
            bytes32 newEntityId = abi.decode(returnData, (bytes32));

            WorldBossV2.setEntityId(i, newEntityId);
            WorldBossV2.setSpawnedAt(i, block.timestamp);
        }
    }

    /// @notice Called when a mob entity dies. Updates world boss state if applicable.
    /// @dev Called from EncounterResolveSystem during cleanup. No-op for non-boss entities.
    function onWorldBossDeath(bytes32 entityId) external {
        _requireSystemOrAdmin(_msgSender());

        uint256 totalBosses = Counters.getCounter(_world(), WORLD_BOSS_COUNTER_ID);
        for (uint256 i = 1; i <= totalBosses; i++) {
            if (WorldBossV2.getEntityId(i) == entityId) {
                WorldBossV2.setEntityId(i, bytes32(0));
                WorldBossV2.setLastKilledAt(i, block.timestamp);
                return;
            }
        }
    }
}
