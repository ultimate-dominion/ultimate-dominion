// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Counters, EntitiesAtPosition, Position, Spawned} from "@codegen/index.sol";
import {PLAYER_COUNTER_KEY} from "../../constants.sol";

/// @dev External library — deploys as a separate contract, called via DELEGATECALL.
///      Inlines the essential board-removal logic from MapSystem.removeEntityFromBoard
///      without the external calls to CharacterSystem (isValidCharacterId, isValidOwner)
///      or the redundant encounter-cleanup branch.
///      Saves 5+ CALL frames per dead entity on the kill turn.
library BoardCleanupLib {
    function removeFromBoard(bytes32 entityId, bool isCharacter) external {
        (uint16 x, uint16 y) = Position.get(entityId);
        bytes32[] memory entities = EntitiesAtPosition.getEntities(x, y);
        for (uint256 i; i < entities.length; i++) {
            if (entities[i] == entityId) {
                bytes32 last = entities[entities.length - 1];
                EntitiesAtPosition.updateEntities(x, y, i, last);
                EntitiesAtPosition.popEntities(x, y);
                break;
            }
        }
        Position.set(entityId, 0, 0);
        Spawned.setSpawned(entityId, false);
        if (isCharacter) {
            uint256 count = Counters.get(PLAYER_COUNTER_KEY, 0);
            if (count > 0) Counters.set(PLAYER_COUNTER_KEY, 0, count - 1);
        }
    }
}
