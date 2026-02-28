// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import {
    Characters,
    CombatEncounter,
    CombatEncounterData,
    Counters,
    EntitiesAtPosition,
    EncounterEntity,
    Position,
    SessionTimer,
    Spawned
} from "../codegen/index.sol";
import {SESSION_TIMEOUT} from "../../constants.sol";
import {UseFleeFunction, SessionNotTimedOut} from "../Errors.sol";
import {PauseLib} from "../libraries/PauseLib.sol";

contract MapRemovalSystem is System {
    function removeEntityFromBoard(bytes32 entityId) public {
        PauseLib.requireNotPaused();
        bytes32 encounterId = EncounterEntity.getEncounterId(entityId);

        // if entity is a character
        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            uint256 spawnedPlayers = Counters.get(address(this), 0);
            bool senderIsOwner = IWorld(_world()).UD__isValidOwner(entityId, _msgSender());
            // if sender is owner
            if (senderIsOwner) {
                // if character is in combat use the combat flee function
                if (encounterId != bytes32(0)) revert UseFleeFunction();
                Counters.set(address(this), 0, (spawnedPlayers - 1));
                // if caller is not a system
            } else if (bytes32(abi.encode(SystemRegistry.getSystemId(_msgSender()))) == bytes32(0)) {
                if ((SessionTimer.get(entityId) + SESSION_TIMEOUT) >= block.timestamp) revert SessionNotTimedOut();
                Counters.set(address(this), 0, (spawnedPlayers - 1));
                // Note: Access check removed to allow inter-system calls
            } else {
                // Inter-system call (e.g., from EncounterSystem)
                Counters.set(address(this), 0, (spawnedPlayers - 1));
            }
        } else {
            // Non-character entity (e.g., monster) - allow inter-system calls
        }

        (uint16 currentX, uint16 currentY) = IWorld(_world()).UD__getEntityPosition(entityId);
        bytes32[] memory entAtPos = IWorld(_world()).UD__getEntitiesAtPosition(currentX, currentY);

        for (uint256 i; i < entAtPos.length;) {
            if (entAtPos[i] == entityId) {
                bytes32 lastEnt = entAtPos[entAtPos.length - 1];
                EntitiesAtPosition.updateEntities(currentX, currentY, i, lastEnt);
                EntitiesAtPosition.popEntities(currentX, currentY);
                break;
            }
            {
                i++;
            }
        }
        Position.set(entityId, 0, 0);
        Spawned.setSpawned(entityId, false);

        bytes32[] memory emptyArray;

        // end combat for entity
        if (encounterId != bytes32(0)) {
            CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
            for (uint256 i; i < encounterData.attackers.length; i++) {
                EncounterEntity.setEncounterId(encounterData.attackers[i], bytes32(0));
                EncounterEntity.setAppliedStatusEffects(encounterData.attackers[i], emptyArray);
            }
            for (uint256 i; i < encounterData.defenders.length; i++) {
                EncounterEntity.setEncounterId(encounterData.defenders[i], bytes32(0));
                EncounterEntity.setAppliedStatusEffects(encounterData.defenders[i], emptyArray);
            }

            EncounterEntity.setDied(entityId, true);
            CombatEncounter.setEnd(encounterId, block.timestamp);
        }
    }

    function removeEntitiesFromBoard(bytes32[] calldata entityIds) public {
        for (uint256 i; i < entityIds.length; i++) {
            removeEntityFromBoard(entityIds[i]);
        }
    }
}
