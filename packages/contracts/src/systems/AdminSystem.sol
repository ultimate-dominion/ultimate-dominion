// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    RandomNumbers,
    MatchEntity,
    ActionsData,
    Actions,
    Stats,
    StatsData,
    CombatEncounter,
    CombatEncounterData,
    CharacterEquipment,
    Admin,
    UltimateDominionConfig
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {RngRequestType, MobType, EncounterType, ActionType} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Mobs, MobsData} from "@tables/Mobs.sol";
import {MonsterStats, NPCStats} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {DEFAULT_MAX_TURNS} from "../../constants.sol";

contract AdminSystem is System {
    modifier onlyAdmin() {
        require(Admin.get(_msgSender()), "NOT AN ADMIN");
        _;
    }

    function clearBattleState(bytes32 entityId) public onlyAdmin {
        MatchEntity.setEncounterId(entityId, bytes32(0));
    }

    function setAdmin(address newAdmin, bool adminState) public onlyAdmin {
        Admin.set(newAdmin, adminState);
    }

    function adminDropGold(bytes32 characterId, uint256 goldAmount) public onlyAdmin {
        IWorld(_world()).UD__dropGold(characterId, goldAmount);
    }

    function adminDropItem(bytes32 characterId, uint256 itemId, uint256 amount) public onlyAdmin {
        IWorld(_world()).UD__dropItem(characterId, itemId, amount);
    }

    function adminSetStats(bytes32 entityId, StatsData memory desiredStats) public onlyAdmin {
        Stats.set(entityId, desiredStats);
    }
}
