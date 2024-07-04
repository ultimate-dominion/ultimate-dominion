// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Characters, MapConfig, Position, Spawned, MobsByLevel, EntitiesAtPosition} from "../codegen/index.sol";
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
        _moveEntity(entityId, currentX, currentY, x, y);
        _spawnOnTileEnter(x, y);
    }

    function spawn(bytes32 entityId) public {
        address owner = Characters.getOwner(entityId);
        require(_msgSender() == owner, "Only the owner can spawn a character");

        require(!Spawned.getSpawned(entityId), "Character already spawned");

        Position.set(entityId, 0, 0);
        Spawned.setSpawned(entityId, true);
        EntitiesAtPosition.pushEntities(0, 0, entityId);
    }

    function distance(uint16 fromX, uint16 fromY, uint16 toX, uint16 toY) internal pure returns (uint16) {
        uint16 deltaX = fromX > toX ? fromX - toX : toX - fromX;
        uint16 deltaY = fromY > toY ? fromY - toY : toY - fromY;
        return deltaX + deltaY;
    }

    function getEntitiesAtPosition(uint16 x, uint16 y) public view returns (bytes32[] memory entitiesAtPosition) {
        return EntitiesAtPosition.getEntities(x, y);
    }

    function _spawnOnTileEnter(uint16 x, uint16 y) internal {
        uint256 distanceFromHome = uint256(distance(0, 0, x, y));
        uint256[] memory availableMonsters = MobsByLevel.getMobIds(distanceFromHome);
        uint32[] memory rng;
        // TODO for testing, remove for deployment
        if (block.chainid == 31337) {
            rng = LibChunks.get8Chunks(block.timestamp ** 8);
        } else {
            rng = LibChunks.get8Chunks(block.prevrandao);
        }

        for (uint256 i; i < (rng[rng.length - 1] % 6); i++) {
            SystemSwitch.call(
                abi.encodeCall(
                    IMobSystem.UD__spawnMob, (availableMonsters[uint256(rng[i] % availableMonsters.length)], x, y)
                )
            );
        }
    }

    function _moveEntity(bytes32 entityId, uint16 currentX, uint16 currentY, uint16 x, uint16 y) internal {
        bytes32[] memory entAtPos = getEntitiesAtPosition(currentX, currentY);
        bool entityWasAtPosition;
        for (uint256 i; i < entAtPos.length;) {
            if (entAtPos[i] == entityId) {
                entityWasAtPosition = true;
                bytes32 lastEnt = entAtPos[entAtPos.length - 1];
                EntitiesAtPosition.updateEntities(currentX, currentX, i, lastEnt);
                EntitiesAtPosition.popEntities(currentX, currentX);
                break;
            }
            {
                i++;
            }
        }
        require(entityWasAtPosition, "Entity was not at that position");
        Position.set(entityId, x, y);
        EntitiesAtPosition.pushEntities(x, y, entityId);
    }
}
