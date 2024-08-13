// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    RandomNumbers,
    EncounterEntity,
    ActionsData,
    Actions,
    Stats,
    CombatEncounter,
    CombatEncounterData,
    CharacterEquipment
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {RngRequestType, MobType, EncounterType, ActionType, Classes} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Mobs, MobsData} from "@tables/Mobs.sol";
import {MonsterStats, NPCStats, MagicAttackStats, PhysicalAttackStats} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {DEFAULT_MAX_TURNS} from "../../constants.sol";

contract ActionSystem is System {
    function createAction(ActionType actionType, string memory name, bytes memory actionStats)
        public
        returns (bytes32 actionId)
    {
        _requireOwner(address(this), _msgSender());
        actionId = keccak256(abi.encode(name));
        require(
            Actions.getActionStats(actionId).length == 0 && uint8(Actions.getActionType(actionId)) == uint8(0),
            "Action already exists"
        );
        Actions.set(actionId, actionType, actionStats);
    }

    function checkActionRestrictions(bytes32 entityId, bytes32 actionId) public view returns (bool) {
        ActionsData memory action = Actions.get(actionId);
        Classes class = Stats.getClass(entityId);
        bool isClass;
        bool isEquipped;
        if (uint8(action.actionType) == uint8(1)) {
            PhysicalAttackStats memory attackStats = abi.decode(action.actionStats, (PhysicalAttackStats));
            for (uint256 i; i < attackStats.classRestrictions.length;) {
                if (uint8(class) == attackStats.classRestrictions[i]) {
                    isClass = true;
                    break;
                }
                {
                    i++;
                }
            }
            return isClass;
        } else if (uint8(action.actionType) == uint8(2)) {
            bytes32[] memory equippedSpells = CharacterEquipment.getEquippedSpells(entityId);
            MagicAttackStats memory magicStats = abi.decode(action.actionStats, (MagicAttackStats));
            for (uint256 i; i < magicStats.classRestrictions.length;) {
                if (magicStats.classRestrictions[i] == uint8(class)) {
                    isClass = true;
                    break;
                }
                {
                    i++;
                }
            }
            if (isClass) {
                // check that spell is equipped
                for (uint256 i; i < equippedSpells.length;) {
                    if (equippedSpells[i] == actionId) {
                        isEquipped = true;
                        break;
                    }
                    {
                        i++;
                    }
                }

                // if the spell is equipped or not the itemRestriction can be gotten,
                // because if it is an equippable spell it shouldn't have item restrictions. so isEquipped should be false.
                for (uint256 i; i < magicStats.itemRestrictions.length;) {
                    if (IWorld(_world()).UD__getItemBalance(entityId, magicStats.itemRestrictions[i]) > 0) {
                        isEquipped = true;
                        break;
                    }
                    {
                        i++;
                    }
                }
            }
            return isClass && isEquipped;
        } else {
            return isClass && isEquipped;
        }
    }
}
