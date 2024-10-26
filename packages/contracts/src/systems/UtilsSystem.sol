// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    UltimateDominionConfig,
    CombatEncounter,
    WorldEncounter,
    CombatEncounterData,
    EncounterEntity
} from "../codegen/index.sol";
import {EncounterType} from "../codegen/common.sol";
import {_lootManagerSystemId} from "../utils.sol";
import {WORLD_NAMESPACE} from "../../constants.sol";

contract UtilsSystem is System {
    function checkForEncounterEnd(CombatEncounterData memory encounterData)
        public
        view
        returns (bool _encounterEnded, bool _attackersWin)
    {
        uint256 deadDefenderCounter;
        uint256 deadAttackerCounter;
        for (uint256 i; i < encounterData.defenders.length; i++) {
            if (IWorld(_world()).UD__getDied(encounterData.defenders[i])) {
                deadDefenderCounter++;
            }
        }
        for (uint256 i; i < encounterData.attackers.length; i++) {
            if (IWorld(_world()).UD__getDied(encounterData.attackers[i])) {
                deadAttackerCounter++;
            }
        }

        _encounterEnded = (
            deadAttackerCounter == encounterData.attackers.length
                || deadDefenderCounter == encounterData.defenders.length
                || encounterData.currentTurn == encounterData.maxTurns
        );

        _attackersWin = deadDefenderCounter == encounterData.defenders.length;
    }

    function isParticipant(bytes32 playerId, bytes32 encounterId) public view returns (bool _isParticipant) {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        for (uint256 i; i < encounterData.attackers.length;) {
            if (playerId == encounterData.attackers[i]) {
                _isParticipant = true;
                break;
            }
            {
                i++;
            }
        }
        if (!_isParticipant) {
            for (uint256 i; i < encounterData.defenders.length;) {
                if (playerId == encounterData.defenders[i]) {
                    _isParticipant = true;
                    break;
                }
                {
                    i++;
                }
            }
        }
    }

    function isParticipant(address account, bytes32[] memory participants) public view returns (bool _isParticipant) {
        for (uint256 i; i < participants.length;) {
            if (account == IWorld(_world()).UD__getOwnerAddress(participants[i])) {
                _isParticipant = true;
                break;
            }
            {
                i++;
            }
        }
    }

    function getEncounterType(bytes32 encounterId) public view returns (EncounterType _encounterType) {
        if (CombatEncounter.getStart(encounterId) > 0) {
            _encounterType = CombatEncounter.getEncounterType(encounterId);
        } else if (WorldEncounter.getStart(encounterId) > 0) {
            _encounterType = EncounterType.World;
        } else {
            revert("not a valid encounter");
        }
    }

    function isAttacker(bytes32 encounterId, bytes32 entityId) public view returns (bool _isAttacker) {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        for (uint256 i; i < encounterData.attackers.length;) {
            if (entityId == encounterData.attackers[i]) {
                _isAttacker = true;
                break;
            }
            {
                i++;
            }
        }
    }

    function isDefender(bytes32 encounterId, bytes32 entityId) public view returns (bool _isDefender) {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        for (uint256 i; i < encounterData.defenders.length;) {
            if (entityId == encounterData.defenders[i]) {
                _isDefender = true;
                break;
            }
            {
                i++;
            }
        }
    }

    function isInEncounter(bytes32 entityId) public view returns (bool) {
        return EncounterEntity.getEncounterId(entityId) != bytes32(0);
    }
}
