// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {MobsByLevel, MobsByZoneLevel, BossSpawnConfig, ZoneBossConfig, ZoneMapConfig} from "@codegen/index.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IMobSystem, IWorldBossSystem} from "@world/IWorld.sol";
import {LibChunks} from "../libraries/LibChunks.sol";
import {NoMonsters} from "../Errors.sol";
import {_requireSystemOrAdmin} from "../utils.sol";

contract MapSpawnSystem is System {
    using LibChunks for uint256;

    function spawnOnTileEnter(uint256 zoneId, uint16 x, uint16 y) public {
        _requireSystemOrAdmin(_msgSender());

        // Distance from zone origin (always 0,0 in zone-relative coords)
        uint256 distanceFromHome = uint256(_chebyshevDistance(0, 0, x, y));
        if (distanceFromHome == 0) {
            return;
        }

        // Determine mob level range from zone config
        uint256 minLevel = ZoneMapConfig.getMinLevel(zoneId);
        uint256 maxLevel = ZoneMapConfig.getWidth(zoneId) > 0
            ? minLevel + 10  // Zone's level range spans 10 levels
            : 11;            // Fallback for unconfigured zones

        uint8 startLevel;
        uint8 endLevel;

        if (minLevel == 0) {
            // Unconfigured zone — use legacy distance-based scaling
            if (distanceFromHome < 5) {
                startLevel = 1;
                endLevel = 6;
            } else {
                startLevel = 6;
                endLevel = 11;
            }
        } else {
            // Zone-configured — scale within zone's level range
            uint256 half = (maxLevel - minLevel) / 2;
            if (distanceFromHome < 5) {
                startLevel = uint8(minLevel);
                endLevel = uint8(minLevel + half);
            } else {
                startLevel = uint8(minLevel + half);
                endLevel = uint8(maxLevel);
            }
        }

        // Try zone-scoped mob pool first, fall back to global MobsByLevel
        uint256[] memory availableMonsters = _getAvailableMonsters(zoneId, startLevel, endLevel);

        if (availableMonsters.length == 0) {
            // Fallback: try global MobsByLevel (backward compat for Z1 before backfill)
            availableMonsters = _getAvailableMonstersGlobal(startLevel, endLevel);
        }

        if (availableMonsters.length == 0) revert NoMonsters();

        uint32[] memory rng;
        rng = LibChunks.get8Chunks(block.prevrandao);

        uint256 spawnCount = rng[0] % 4;
        if (spawnCount > 0) {
            uint256[] memory mobIdsToSpawn = new uint256[](spawnCount);
            for (uint256 i; i < spawnCount; i++) {
                mobIdsToSpawn[i] = availableMonsters[uint256(rng[i] % availableMonsters.length)];
            }
            SystemSwitch.call(
                abi.encodeCall(
                    IMobSystem.UD__spawnMobs, (mobIdsToSpawn, zoneId, x, y)
                )
            );
        }

        // Boss spawn check — per-zone config, falls back to global singleton
        {
            uint256 bossMobId = ZoneBossConfig.getBossMobId(zoneId);
            uint256 chance = ZoneBossConfig.getSpawnChanceBp(zoneId);
            if (bossMobId == 0) {
                // Fallback to legacy singleton BossSpawnConfig
                bossMobId = BossSpawnConfig.getBossMobId();
                chance = BossSpawnConfig.getSpawnChanceBp();
            }
            if (bossMobId != 0 && chance > 0) {
                uint256 bossRoll = uint256(keccak256(abi.encodePacked(block.prevrandao, x, y, "boss"))) % 10000;
                if (bossRoll < chance) {
                    uint256[] memory bossSpawn = new uint256[](1);
                    bossSpawn[0] = bossMobId;
                    SystemSwitch.call(abi.encodeCall(IMobSystem.UD__spawnMobs, (bossSpawn, zoneId, x, y)));
                }
            }
        }

        // World boss lazy spawn check
        if (gasleft() > 200_000) {
            SystemSwitch.call(abi.encodeCall(IWorldBossSystem.UD__trySpawnWorldBosses, (zoneId)));
        }
    }

    function _getAvailableMonsters(uint256 zoneId, uint8 startLevel, uint8 endLevel) internal view returns (uint256[] memory) {
        uint256 numOfMobs = 0;
        for (uint256 i = startLevel; i < endLevel; i++) {
            numOfMobs += MobsByZoneLevel.lengthMobIds(zoneId, i);
        }

        uint256[] memory monsters = new uint256[](numOfMobs);
        uint256 idx = 0;
        for (uint256 i = startLevel; i < endLevel; i++) {
            uint256[] memory mobIds = MobsByZoneLevel.getMobIds(zoneId, i);
            for (uint256 j = 0; j < mobIds.length; j++) {
                monsters[idx] = mobIds[j];
                idx++;
            }
        }
        return monsters;
    }

    function _getAvailableMonstersGlobal(uint8 startLevel, uint8 endLevel) internal view returns (uint256[] memory) {
        uint256 numOfMobs = 0;
        for (uint256 i = startLevel; i < endLevel; i++) {
            numOfMobs += MobsByLevel.lengthMobIds(i);
        }

        uint256[] memory monsters = new uint256[](numOfMobs);
        uint256 idx = 0;
        for (uint256 i = startLevel; i < endLevel; i++) {
            uint256[] memory mobIds = MobsByLevel.getMobIds(i);
            for (uint256 j = 0; j < mobIds.length; j++) {
                monsters[idx] = mobIds[j];
                idx++;
            }
        }
        return monsters;
    }

    function _chebyshevDistance(uint256 x1, uint256 y1, uint256 x2, uint256 y2) internal pure returns (uint16) {
        return uint16(_max(_absDiff(x1, x2), _absDiff(y1, y2)));
    }

    function _absDiff(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a - b : b - a;
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }
}
