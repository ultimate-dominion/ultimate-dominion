// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {
    RandomNumbers,
    EncounterEntity,
    EffectsData,
    Effects,
    Stats,
    StatsData,
    MobStats,
    Characters,
    CombatEncounter,
    CombatEncounterData,
    CharacterEquipment,
    Admin,
    UltimateDominionConfig,
    EntitiesAtPosition,
    Position
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {RngRequestType, MobType, EncounterType, EffectType} from "@codegen/common.sol";
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

    function adminClearBattleState(bytes32 entityId) public onlyAdmin {
        EncounterEntity.setEncounterId(entityId, bytes32(0));
    }

    function adminSetCombatEncounter(bytes32 encounterId, CombatEncounterData memory encounterData) public onlyAdmin {
        CombatEncounter.set(encounterId, encounterData);
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
        Characters.setBaseStats(entityId, abi.encode(desiredStats));
        Stats.set(entityId, desiredStats);
    }

    function adminRemoveEntity(bytes32 entityId) public onlyAdmin {
        IWorld(_world()).UD__removeEntityFromBoard(entityId);
    }

    function adminMoveEntity(bytes32 entityId, uint16 x, uint16 y) public onlyAdmin {
        (uint16 currentX, uint16 currentY) = IWorld(_world()).UD__getEntityPosition(entityId);
        bytes32[] memory entAtPos = IWorld(_world()).UD__getEntitiesAtPosition(currentX, currentY);
        bool entityWasAtPosition;
        for (uint256 i; i < entAtPos.length;) {
            if (entAtPos[i] == entityId) {
                entityWasAtPosition = true;
                bytes32 lastEnt = entAtPos[entAtPos.length - 1];
                EntitiesAtPosition.updateEntities(currentX, currentY, i, lastEnt);
                EntitiesAtPosition.popEntities(currentX, currentY);
                break;
            }
            {
                i++;
            }
        }
        require(entityWasAtPosition, "Entity not at position");
        Position.set(entityId, x, y);
        EntitiesAtPosition.pushEntities(x, y, entityId);
    }

    function getSystemAddress(ResourceId systemId) public view returns (address) {
        return Systems.getSystem(systemId);
    }

    function adminApplyStatusEffect(bytes32 entityId, bytes32 statusEffectId) public onlyAdmin {
        IWorld(_world()).UD__applyStatusEffect(entityId, statusEffectId);
    }
}
