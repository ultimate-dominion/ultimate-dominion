// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    EncounterEntity,
    CombatEncounter,
    CombatEncounterData,
    CombatOutcome,
    CombatOutcomeData,
    WorldEncounter,
    WorldEncounterData,
    WorldStatusEffects
} from "@codegen/index.sol";
import {EncounterType} from "@codegen/common.sol";
import {InvalidEncounter, EncounterAlreadyOver, InvalidEncounterType} from "../Errors.sol";
import {BoardCleanupLib} from "../libraries/BoardCleanupLib.sol";

contract EncounterResolveSystem is System {
    function endEncounter(bytes32 encounterId, uint256 randomNumber, bool attackersWin) public {
        // Inline getEncounterType to avoid cross-system IWorld call
        EncounterType encounterType;
        if (CombatEncounter.getStart(encounterId) > 0) {
            encounterType = CombatEncounter.getEncounterType(encounterId);
        } else if (WorldEncounter.getStart(encounterId) > 0) {
            encounterType = EncounterType.World;
        } else {
            revert InvalidEncounter();
        }

        if (encounterType == EncounterType.PvP || encounterType == EncounterType.PvE) {
            _endCombatEncounter(encounterId, randomNumber, attackersWin);
        } else if (encounterType == EncounterType.World) {
            _endWorldEncounter(encounterId);
        }
    }

    function _endCombatEncounter(bytes32 encounterId, uint256 randomNumber, bool attackersWin) internal {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        if (CombatEncounter.getEnd(encounterId) != 0) revert EncounterAlreadyOver();

        CombatEncounter.setEnd(encounterId, block.timestamp);
        encounterData.end = block.timestamp;

        uint256 expAmount;
        uint256 goldAmount;
        uint256[] memory itemsDropped;
        CombatOutcomeData memory combatOutcome;

        if (encounterData.encounterType == EncounterType.PvE) {
            (expAmount, goldAmount, itemsDropped) = IWorld(_world()).UD__distributePveRewards(encounterId, randomNumber);
        } else if (encounterData.encounterType == EncounterType.PvP) {
            (expAmount, goldAmount, itemsDropped) = IWorld(_world()).UD__distributePvpRewards(encounterId, randomNumber);
        } else {
            revert InvalidEncounterType();
        }

        combatOutcome = CombatOutcomeData({
            endTime: block.timestamp,
            attackersWin: attackersWin,
            playerFled: false,
            expDropped: expAmount,
            goldDropped: goldAmount,
            itemsDropped: itemsDropped
        });

        CombatOutcome.set(encounterId, combatOutcome);

        bool isPvE = encounterData.encounterType == EncounterType.PvE;
        _cleanupEntities(encounterData.attackers, !isPvE || !encounterData.attackersAreMobs);
        _cleanupEntities(encounterData.defenders, !isPvE || encounterData.attackersAreMobs);
    }

    function _endWorldEncounter(bytes32 encounterId) internal {
        WorldEncounterData memory encounterData = WorldEncounter.get(encounterId);
        if (encounterData.end != 0 || encounterData.start == 0) revert InvalidEncounter();

        encounterData.end = block.timestamp;
        EncounterEntity.setEncounterId(encounterData.character, bytes32(0));
        WorldEncounter.set(encounterId, encounterData);
    }

    function _cleanupEntities(bytes32[] memory entities, bool areCharacters) internal {
        bytes32[] memory emptyArray = new bytes32[](0);
        for (uint256 i; i < entities.length; i++) {
            bytes32 entityId = entities[i];
            EncounterEntity.setEncounterId(entityId, bytes32(0));
            EncounterEntity.setAppliedStatusEffects(entityId, emptyArray);
            if (EncounterEntity.getDied(entityId)) {
                BoardCleanupLib.removeFromBoard(entityId, areCharacters);
                EncounterEntity.setDied(entityId, true);
                WorldStatusEffects.setAppliedStatusEffects(entityId, emptyArray);
            }
        }
    }
}
