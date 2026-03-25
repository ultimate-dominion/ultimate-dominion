// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {MobsByLevel, MobsByZoneLevel, EntitiesAtPosition, BossSpawnConfig, ZoneMapConfig} from "@codegen/index.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IMobSystem} from "@world/IWorld.sol";
import {LibChunks} from "../libraries/LibChunks.sol";
import {NoMonsters} from "../Errors.sol";
import {_requireSystemOrAdmin} from "../utils.sol";
import {ZONE_DARK_CAVE} from "../../constants.sol";

contract MapSpawnSystem is System {
    using LibChunks for uint256;

    function spawnOnTileEnter(uint16 x, uint16 y) public {
        _requireSystemOrAdmin(_msgSender());

        // Derive zone from tile coordinates
        uint256 zoneId = _deriveZoneFromPosition(x, y);
        uint16 originX = 0;
        uint16 originY = 0;
        uint16 zoneWidth = ZoneMapConfig.getWidth(zoneId);
        if (zoneWidth > 0) {
            originX = ZoneMapConfig.getOriginX(zoneId);
            originY = ZoneMapConfig.getOriginY(zoneId);
        }

        // Distance from zone origin (not global 0,0)
        uint256 distanceFromHome = uint256(_chebyshevDistance(originX, originY, x, y));
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
                    IMobSystem.UD__spawnMobs, (mobIdsToSpawn, x, y)
                )
            );
        }

        // Boss spawn check — flat probability on every tile entry
        {
            uint256 bossMobId = BossSpawnConfig.getBossMobId();
            if (bossMobId != 0) {
                uint256 chance = BossSpawnConfig.getSpawnChanceBp();
                uint256 bossRoll = uint256(keccak256(abi.encodePacked(block.prevrandao, x, y, "boss"))) % 10000;
                if (bossRoll < chance) {
                    uint256[] memory bossSpawn = new uint256[](1);
                    bossSpawn[0] = bossMobId;
                    SystemSwitch.call(abi.encodeCall(IMobSystem.UD__spawnMobs, (bossSpawn, x, y)));
                }
            }
        }
    }

    /// @notice Derive zone ID from raw tile coordinates by matching against ZoneMapConfig origins.
    /// @dev Checks zones 1-10 (expandable). Falls back to ZONE_DARK_CAVE if no match.
    function _deriveZoneFromPosition(uint16 x, uint16 y) internal view returns (uint256) {
        // Check configured zones (1-10 for now — cheap reads, no loops over all zones)
        for (uint256 zId = 1; zId <= 10; zId++) {
            uint16 w = ZoneMapConfig.getWidth(zId);
            if (w == 0) continue; // unconfigured
            uint16 ox = ZoneMapConfig.getOriginX(zId);
            uint16 oy = ZoneMapConfig.getOriginY(zId);
            uint16 h = ZoneMapConfig.getHeight(zId);
            if (x >= ox && x < ox + w && y >= oy && y < oy + h) {
                return zId;
            }
        }
        return ZONE_DARK_CAVE;
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
