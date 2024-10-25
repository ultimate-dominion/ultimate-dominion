// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
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
