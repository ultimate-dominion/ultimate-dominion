// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Characters, MapConfig, Position, Spawned, MobsByLevel} from "../codegen/index.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IMobSystem} from "@world/IWorld.sol";
import {LibChunks} from "../libraries/LibChunks.sol";

contract MapSystem is System {
    using LibChunks for uint256;

    function move(bytes32 entityId, uint16 x, uint16 y) public {
        address owner = Characters.getOwner(entityId);
        require(_msgSender() == owner, "Only the owner can move a character");

        require(Spawned.getSpawned(entityId), "Character not spawned");

        (uint16 currentX, uint16 currentY) = Position.get(entityId);
        (uint16 height, uint16 width) = MapConfig.get();

        require(x < width, "X out of bounds");
        require(y < height, "Y out of bounds");
        require(distance(currentX, currentY, x, y) == 1, "Can only move 1 tile at a time");
        uint16 distanceFromHome = distance(0, 0, x, y);
        uint256 availableMonsters = MobsByLevel.getMobIds(distanceFromHome);
        uint32[] rng = block.prevrandao.get8Chunks();
        for (uint256 i; i < (rng[rng.length - 1] % 6); i++) {
            SystemSwitch.call(
                abi.encodeCall(
                    IMobSystem.UD__spawnMob, (availableMonsters[uint256(rng[i] % availableMonsters.length)], x, y)
                )
            );
        }
        Position.set(entityId, x, y);
    }

    function spawn(bytes32 entityId) public {
        address owner = Characters.getOwner(entityId);
        require(_msgSender() == owner, "Only the owner can spawn a character");

        require(!Spawned.getSpawned(entityId), "Character already spawned");

        Position.set(entityId, 0, 0);
        Spawned.setSpawned(entityId, true);
    }

    function distance(uint16 fromX, uint16 fromY, uint16 toX, uint16 toY) internal pure returns (uint16) {
        uint16 deltaX = fromX > toX ? fromX - toX : toX - fromX;
        uint16 deltaY = fromY > toY ? fromY - toY : toY - fromY;
        return deltaX + deltaY;
    }
}
