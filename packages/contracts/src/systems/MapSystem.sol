// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Characters, MapConfig, Position, Spawned } from "../codegen/index.sol";

contract MapSystem is System {
  function move(uint256 characterId, uint32 x, uint32 y) public {
    address owner = Characters.getOwner(characterId);
    require(_msgSender() == owner, "Only the owner can move a character");

    require(Spawned.getSpawned(characterId), "Character not spawned");

    (uint32 currentX, uint32 currentY) = Position.get(characterId);
    (uint32 height, uint32 width) = MapConfig.get();

    require(x < width, "X out of bounds");
    require(y < height, "Y out of bounds");
    require(distance(currentX, currentY, x, y) == 1, "Can only move 1 tile at a time");

    Position.set(characterId, x, y);
  }

  function spawn(uint256 characterId) public {
    address owner = Characters.getOwner(characterId);
    require(_msgSender() == owner, "Only the owner can spawn a character");

    require(!Spawned.getSpawned(characterId), "Character already spawned");

    Position.set(characterId, 0, 0);
    Spawned.setSpawned(characterId, true);
  }

  function distance(uint32 fromX, uint32 fromY, uint32 toX, uint32 toY) internal pure returns (uint32) {
    uint32 deltaX = fromX > toX ? fromX - toX : toX - fromX;
    uint32 deltaY = fromY > toY ? fromY - toY : toY - fromY;
    return deltaX + deltaY;
  }
}
