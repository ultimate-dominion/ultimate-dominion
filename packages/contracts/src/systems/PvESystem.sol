// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {Math} from "@libraries/Math.sol";
import {LibChunks} from "@libraries/LibChunks.sol";
import {ArrayManagers} from "@libraries/ArrayManagers.sol";
import {
    RandomNumbers,
    MatchEntity,
    MatchEntityData,
    Stats,
    StatsData,
    Actions,
    ActionsData,
    Items,
    CharacterEquipment,
    CharacterEquipmentData,
    CombatEncounter,
    CombatEncounterData,
    CombatOutcome,
    CombatOutcomeData,
    Position,
    Mobs,
    Spawned,
    MobsData,
    Counters,
    ActionOutcome,
    ActionOutcomeData
} from "@codegen/index.sol";
import {RngRequestType, MobType, Alignment, EncounterType} from "@codegen/common.sol";
import {
    MonsterStats,
    WeaponStats,
    NPCStats,
    Action,
    PhysicalAttackStats,
    AdjustedCombatStats
} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {
    DEFAULT_MAX_TURNS,
    TO_HIT_MODIFIER,
    DEFENSE_MODIFIER,
    ATTACK_MODIFIER,
    CRIT_MODIFIER,
    BASE_GOLD_DROP
} from "../../constants.sol";
import "forge-std/console2.sol";

contract PvESystem is System {
    function isValidPvE(bytes32[] memory attackers, bytes32[] memory defenders, uint16 x, uint16 y)
        public
        view
        returns (bool _isValidPvE)
    {
        _isValidPvE = true;
        for (uint256 i; i < attackers.length;) {
            if (!IWorld(_world()).UD__isValidCharacterId(attackers[i])) {
                _isValidPvE = false;
                break;
            }
            if (!IWorld(_world()).UD__isAtPosition(attackers[i], x, y)) {
                _isValidPvE = false;
                break;
            }
            {
                i++;
            }
        }
        if (_isValidPvE) {
            for (uint256 i; i < defenders.length;) {
                if (IWorld(_world()).UD__isValidCharacterId(defenders[i])) {
                    _isValidPvE = false;
                    break;
                }
                if (!IWorld(_world()).UD__isAtPosition(defenders[i], x, y)) {
                    _isValidPvE = false;
                    break;
                }
                {
                    i++;
                }
            }
        }
        return _isValidPvE;
    }

    function executePvECombat(uint256 prevRandao, bytes32 encounterId, Action[] memory actions) public {
        // ensure this is an authorised call from the entropy contract
        _requireAccess(address(this), _msgSender());

        uint256 randomNumber;
        //get encounter data
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        // execute attacker actions
        for (uint256 i; i < actions.length; i++) {
            Action memory currentAction = actions[i];

            randomNumber =
                uint256(keccak256(abi.encode(prevRandao, currentAction.attackerEntityId, encounterData.currentTurn)));

            ActionOutcomeData memory currentActionData = _getCurrentActionData(currentAction);

            // execute action
            currentActionData = IWorld(_world()).UD__executeAction(currentActionData, randomNumber);
            // emit action data to offchain table
            ActionOutcome.set(encounterId, encounterData.currentTurn, i, currentActionData);
        }

        encounterData.currentTurn++;

        (bool matchEnded, bool attackersWin) = IWorld(_world()).UD__checkForMatchEnd(encounterData);

        if (matchEnded) {
            _setCharacterSpawns(encounterData);
            IWorld(_world()).UD__endMatch(encounterId, randomNumber, attackersWin);
        } else {
            // execute defender attacks
            for (uint256 i; i < encounterData.defenders.length; i++) {
                MonsterStats memory monsterStats = IWorld(_world()).UD__getMonsterStats(encounterData.defenders[i]);
                ActionOutcomeData memory defenderAction = _getCurrentActionData(
                    Action({
                        attackerEntityId: encounterData.defenders[i],
                        defenderEntityId: encounterData.attackers[i],
                        actionId: monsterStats.actions[0],
                        weaponId: monsterStats.inventory[0]
                    })
                );
                randomNumber =
                    uint256(keccak256(abi.encode(prevRandao, defenderAction.attackerId, encounterData.currentTurn)));

                defenderAction = IWorld(_world()).UD__executeAction(defenderAction, randomNumber);

                ActionOutcome.set(encounterId, encounterData.currentTurn, i + actions.length, defenderAction);
            }

            CombatEncounter.set(encounterId, encounterData);

            (matchEnded, attackersWin) = IWorld(_world()).UD__checkForMatchEnd(encounterData);

            if (matchEnded) {
                _setCharacterSpawns(encounterData);
                IWorld(_world()).UD__endMatch(encounterId, randomNumber, attackersWin);
            }
        }
    }

    function _setCharacterSpawns(CombatEncounterData memory encounterData) internal {
        bytes32 tempEntId;
        for (uint256 i; i < encounterData.attackers.length; i++) {
            tempEntId = encounterData.attackers[i];
            if (IWorld(_world()).UD__isValidCharacterId(tempEntId) && IWorld(_world()).UD__getDied(tempEntId)) {
                _setSpawned(tempEntId, false);
            }
        }
        for (uint256 i; i < encounterData.defenders.length; i++) {
            tempEntId = encounterData.defenders[i];
            if (IWorld(_world()).UD__isValidCharacterId(tempEntId) && IWorld(_world()).UD__getDied(tempEntId)) {
                _setSpawned(tempEntId, false);
            }
        }
    }

    function _setSpawned(bytes32 entityId, bool spawned) internal {
        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            Spawned.set(entityId, spawned);
        }
    }

    function _getCurrentActionData(Action memory currentAction)
        internal
        view
        returns (ActionOutcomeData memory currentActionData)
    {
        currentActionData = ActionOutcomeData({
            actionId: currentAction.actionId,
            weaponId: currentAction.weaponId,
            attackerId: currentAction.attackerEntityId,
            defenderId: currentAction.defenderEntityId,
            hit: false,
            miss: false,
            crit: false,
            attackerDamageDelt: 0,
            defenderDamageDelt: 0,
            attackerDied: false,
            defenderDied: false,
            blockNumber: block.number,
            timestamp: block.timestamp
        });
    }
}
