// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    RandomNumbers,
    MatchEntity,
    ActionsData,
    Actions,
    Stats,
    CombatEncounter,
    CombatEncounterData
} from "@codegen/index.sol";
import {RngRequestType, MobType, EncounterType, ActionType} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Mobs, MobsData} from "@tables/Mobs.sol";
import {MonsterStats, NPCStats} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {DEFAULT_MAX_TURNS} from "../../constants.sol";

contract ActionSystem is System {
    function createAction(ActionType actionType, bytes memory actionStats) public returns (bytes32 actionId) {
        _requireOwner(address(this), _msgSender());
        actionId = keccak256(actionStats);
        require(
            Actions.getActionStats(actionId).length == 0 && uint8(Actions.getActionType(actionId)) == uint8(0),
            "Action already exists"
        );
        Actions.set(actionId, actionType, actionStats);
    }
}
