// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {NotAdmin} from "../Errors.sol";
import {
    EncounterEntity,
    EncounterEntityData,
    CombatEncounter,
    CombatEncounterData,
    Admin,
    UltimateDominionConfig
} from "@codegen/index.sol";

contract AdminSystem is System {
    modifier onlyAdmin() {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        _;
    }

    function setAdmin(address newAdmin, bool adminState) public onlyAdmin {
        Admin.set(newAdmin, adminState);
    }

    function setMaxPlayers(uint256 newMax) public onlyAdmin {
        UltimateDominionConfig.setMaxPlayers(newMax);
    }

    function adminClearEncounterState(bytes32 entityId) public onlyAdmin {
        bytes32[] memory empty;
        EncounterEntity.setEncounterId(entityId, bytes32(0));
        EncounterEntity.setAppliedStatusEffects(entityId, empty);
        EncounterEntity.setPvpTimer(entityId, 0);
        EncounterEntity.setDied(entityId, false);
    }

    function adminSetCombatEncounter(bytes32 encounterId, CombatEncounterData memory encounterData) public onlyAdmin {
        CombatEncounter.set(encounterId, encounterData);
    }

    function adminSetEncounterEntity(bytes32 entityId, EncounterEntityData memory encounterEntityData)
        public
        onlyAdmin
    {
        EncounterEntity.set(entityId, encounterEntityData);
    }

    function getSystemAddress(ResourceId systemId) public view returns (address) {
        return Systems.getSystem(systemId);
    }
}
