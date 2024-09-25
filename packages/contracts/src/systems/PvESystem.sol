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
    EncounterEntity,
    EncounterEntityData,
    Stats,
    StatsData,
    Effects,
    EffectsData,
    Items,
    CharacterEquipment,
    CharacterEquipmentData,
    CombatEncounter,
    CombatEncounterData,
    CombatOutcome,
    MobStats,
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
import {MonsterStats, NPCStats, Action, AdjustedCombatStats} from "@interfaces/Structs.sol";
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
import "forge-std/console.sol";

contract PvESystem is System {
    function isValidPvE(bytes32[] memory attackers, bytes32[] memory defenders, uint16 x, uint16 y)
        public
        view
        returns (bool _isValidPvE, bool _attackersAreMobs)
    {
        _isValidPvE = true;
        _attackersAreMobs;
        for (uint256 i; i < attackers.length; i++) {
            if (!IWorld(_world()).UD__isValidCharacterId(attackers[i])) {
                _attackersAreMobs = true;
            }
            if (!IWorld(_world()).UD__isAtPosition(attackers[i], x, y)) {
                _isValidPvE = false;
                break;
            }
        }
        if (_attackersAreMobs && _isValidPvE) {
            for (uint256 i; i < defenders.length;) {
                if (!IWorld(_world()).UD__isValidCharacterId(defenders[i])) {
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
        } else if (!_attackersAreMobs && _isValidPvE) {
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
        return (_isValidPvE, _attackersAreMobs);
    }

    function executePvECombat(uint256 randomness, bytes32 encounterId, Action[] memory attacks) public {
        // ensure this is an authorised call from the entropy contract
        _requireAccess(address(this), _msgSender());

        //get encounter data
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        // if this isn't the first turn increment turn
        if (encounterData.currentTurn != 1) {
            encounterData.currentTurn++;
            CombatEncounter.setCurrentTurn(encounterId, encounterData.currentTurn);
        }
        uint256 numberOfExecutedActions;
        if (encounterData.attackersAreMobs) {
            // execute mob attacks
            numberOfExecutedActions = _executeMobAction(encounterId, encounterData, randomness, 0);
        } else {
            //execute player attack
            numberOfExecutedActions = _executePlayerAction(encounterId, encounterData, attacks, randomness, 0);
        }

        for (uint256 i; i < encounterData.defenders.length; i++) {
            // apply damage over time to defenders & attackers
            IWorld(_world()).UD__applyDamageOverTime(encounterId, encounterData.defenders[i]);
        }

        (bool encounterEnded, bool attackersWin) = IWorld(_world()).UD__checkForEncounterEnd(encounterData);
        // check it encouner has ended
        if (encounterEnded) {
            // if ended end encounter
            _setCharacterSpawns(encounterData);
            IWorld(_world()).UD__endEncounter(encounterId, randomness, attackersWin);
        } else {
            encounterData.currentTurn++;
            CombatEncounter.setCurrentTurn(encounterId, encounterData.currentTurn);
            // set encounter data

            // if not execute defender attack
            if (encounterData.attackersAreMobs) {
                //execute player attack
                _executePlayerAction(encounterId, encounterData, attacks, randomness, numberOfExecutedActions);
            } else {
                // execute mob attacks
                _executeMobAction(encounterId, encounterData, randomness, numberOfExecutedActions);
            }

            for (uint256 i; i < encounterData.attackers.length; i++) {
                // apply damage over time to attackers
                IWorld(_world()).UD__applyDamageOverTime(encounterId, encounterData.attackers[i]);
            }
            CombatEncounter.set(encounterId, encounterData);
            (encounterEnded, attackersWin) = IWorld(_world()).UD__checkForEncounterEnd(encounterData);

            if (encounterEnded) {
                _setCharacterSpawns(encounterData);
                IWorld(_world()).UD__endEncounter(encounterId, randomness, attackersWin);
            }
        }
    }

    function _executeMobAction(
        bytes32 encounterId,
        CombatEncounterData memory encounterData,
        uint256 randomness,
        uint256 numberOfExecutedActions
    ) internal returns (uint256 _numberOfExecutedActions) {
        uint256 randomNumber;

        _numberOfExecutedActions = encounterData.defenders.length;

        for (uint256 i; i < _numberOfExecutedActions; i++) {
            uint256 monsterWeapon = encounterData.attackersAreMobs
                ? MobStats.getItemInventory(encounterData.attackers[i], 0)
                : MobStats.getItemInventory(encounterData.defenders[i], 0);

            ActionOutcomeData memory mobAction = _getCurrentActionData(
                Action({
                    attackerEntityId: encounterData.attackersAreMobs
                        ? encounterData.attackers[i]
                        : encounterData.defenders[i],
                    defenderEntityId: encounterData.attackersAreMobs
                        ? encounterData.defenders[i]
                        : encounterData.attackers[i],
                    itemId: monsterWeapon
                })
            );

            randomNumber = uint256(keccak256(abi.encode(randomness, mobAction.attackerId, encounterData.currentTurn)));
            mobAction = IWorld(_world()).UD__executeAction(mobAction, randomNumber);

            // set offchain table
            ActionOutcome.set(encounterId, encounterData.currentTurn, i + numberOfExecutedActions, mobAction);
        }
    }

    function _executePlayerAction(
        bytes32 encounterId,
        CombatEncounterData memory encounterData,
        Action[] memory attacks,
        uint256 randomness,
        uint256 numberOfExecutedActions
    ) internal returns (uint256 _numberOfExecutedActions) {
        uint256 randomNumber;
        _numberOfExecutedActions = attacks.length;
        // execute attacker effects
        for (uint256 i; i < _numberOfExecutedActions; i++) {
            Action memory currentAction = attacks[i];

            randomNumber =
                uint256(keccak256(abi.encode(randomness, currentAction.attackerEntityId, encounterData.currentTurn)));

            ActionOutcomeData memory currentActionData = _getCurrentActionData(currentAction);

            // execute action
            currentActionData = IWorld(_world()).UD__executeAction(currentActionData, randomNumber);
            // emit action data to offchain table
            ActionOutcome.set(encounterId, encounterData.currentTurn, i + numberOfExecutedActions, currentActionData);
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
        bytes32[] memory effects = IWorld(_world()).UD__getItemEffects(currentAction.itemId);
        bool[] memory hit = new bool[](effects.length);
        bool[] memory miss = new bool[](effects.length);
        bool[] memory crit = new bool[](effects.length);
        int256[] memory damagePerHit = new int256[](effects.length);
        currentActionData = ActionOutcomeData({
            effectIds: effects,
            itemId: currentAction.itemId,
            attackerId: currentAction.attackerEntityId,
            defenderId: currentAction.defenderEntityId,
            damagePerHit: damagePerHit,
            hit: hit,
            miss: miss,
            crit: crit,
            attackerDamageDelt: 0,
            defenderDamageDelt: 0,
            attackerDied: false,
            defenderDied: false,
            blockNumber: block.number,
            timestamp: block.timestamp
        });
    }
}
