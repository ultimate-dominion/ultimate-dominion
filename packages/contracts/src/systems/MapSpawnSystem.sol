// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {MobsByLevel, EntitiesAtPosition, BossSpawnConfig} from "@codegen/index.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IMobSystem} from "@world/IWorld.sol";
import {LibChunks} from "../libraries/LibChunks.sol";
import {NoMonsters} from "../Errors.sol";
import {_requireSystemOrAdmin} from "../utils.sol";

contract MapSpawnSystem is System {
    using LibChunks for uint256;

    function spawnOnTileEnter(uint16 x, uint16 y) public {
        _requireSystemOrAdmin(_msgSender());
        uint256 distanceFromHome = uint256(_chebyshevDistance(0, 0, x, y));
        if (distanceFromHome == 0) {
            return;
        }

        uint8 startLevel = 0;
        uint8 endLevel = 0;

        if (distanceFromHome < 5) {
            startLevel = 1;
            endLevel = 6;
        } else {
            startLevel = 6;
            endLevel = 11;
        }

        uint256 numOfMobs = 0;
        for (uint256 i = startLevel; i < endLevel; i++) {
            numOfMobs += MobsByLevel.lengthMobIds(i);
        }

        uint256[] memory availableMonsters = new uint256[](numOfMobs);
        uint256 index = 0;

        for (uint256 i = startLevel; i < endLevel; i++) {
            uint256[] memory mobIds = MobsByLevel.getMobIds(i);
            for (uint256 j = 0; j < mobIds.length; j++) {
                availableMonsters[index] = mobIds[j];
                index++;
            }
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
