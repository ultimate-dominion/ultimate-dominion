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
    ZoneEntitiesAtPos,
    EncounterEntity,
    PositionV2,
    SessionConfig,
    SessionTimer,
    Spawned,
    WorldEncounter
} from "../codegen/index.sol";
import {SESSION_TIMEOUT, PLAYER_COUNTER_KEY} from "../../constants.sol";
import {UseFleeFunction, SessionNotTimedOut} from "../Errors.sol";
import {PauseLib} from "../libraries/PauseLib.sol";

contract MapRemovalSystem is System {
    function removeEntityFromBoard(bytes32 entityId) public {
        PauseLib.requireNotPaused();

        // If entity is not spawned, nothing to remove
        if (!Spawned.getSpawned(entityId)) return;

        bytes32 encounterId = EncounterEntity.getEncounterId(entityId);

        // if entity is a character
        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            uint256 spawnedPlayers = Counters.get(PLAYER_COUNTER_KEY, 0);
            bool senderIsOwner = IWorld(_world()).UD__isValidOwner(entityId, _msgSender());
            // if sender is owner
            if (senderIsOwner) {
                // if character is in combat use the combat flee function (shop encounters are ok to exit)
                if (encounterId != bytes32(0) && CombatEncounter.getStart(encounterId) != 0) revert UseFleeFunction();
                if (spawnedPlayers > 0) Counters.set(PLAYER_COUNTER_KEY, 0, (spawnedPlayers - 1));
                // if caller is not a system
            } else if (bytes32(abi.encode(SystemRegistry.getSystemId(_msgSender()))) == bytes32(0)) {
                // Use configurable timeout, falling back to constant if not set
                uint256 timeout = SessionConfig.getSessionTimeout();
                if (timeout == 0) timeout = SESSION_TIMEOUT;
                if ((SessionTimer.get(entityId) + timeout) >= block.timestamp) revert SessionNotTimedOut();
                if (spawnedPlayers > 0) Counters.set(PLAYER_COUNTER_KEY, 0, (spawnedPlayers - 1));
                // Note: Access check removed to allow inter-system calls
            } else {
                // Inter-system call (e.g., from EncounterSystem)
                if (spawnedPlayers > 0) Counters.set(PLAYER_COUNTER_KEY, 0, (spawnedPlayers - 1));
            }
        } else {
            // Non-character entity (e.g., monster) - allow inter-system calls
        }

        (uint256 zoneId, uint16 currentX, uint16 currentY) = PositionV2.get(entityId);
        bytes32[] memory entAtPos = ZoneEntitiesAtPos.getEntities(zoneId, currentX, currentY);

        for (uint256 i; i < entAtPos.length;) {
            if (entAtPos[i] == entityId) {
                bytes32 lastEnt = entAtPos[entAtPos.length - 1];
                ZoneEntitiesAtPos.updateEntities(zoneId, currentX, currentY, i, lastEnt);
                ZoneEntitiesAtPos.popEntities(zoneId, currentX, currentY);
                break;
            }
            {
                i++;
            }
        }
        PositionV2.set(entityId, 0, 0, 0);
        Spawned.setSpawned(entityId, false);

        bytes32[] memory emptyArray;

        // end encounter for entity (combat or shop)
        if (encounterId != bytes32(0)) {
            CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
            if (encounterData.start != 0) {
                // Combat encounter — clean up all participants
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
            } else {
                // World encounter (shop) — close it and unbind character
                WorldEncounter.setEnd(encounterId, block.timestamp);
                EncounterEntity.setEncounterId(entityId, bytes32(0));
            }
        }
    }

    function removeEntitiesFromBoard(bytes32[] calldata entityIds) public {
        for (uint256 i; i < entityIds.length; i++) {
            removeEntityFromBoard(entityIds[i]);
        }
    }
}
