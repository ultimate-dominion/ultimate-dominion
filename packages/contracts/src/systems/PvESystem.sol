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
    CombatOutcomeData,
    Position,
    Mobs,
    Spawned,
    MobsData,
    Counters,
    AttackOutcome,
    AttackOutcomeData
} from "@codegen/index.sol";
import {RngRequestType, MobType, Alignment, EncounterType} from "@codegen/common.sol";
import {MonsterStats, NPCStats, Attack, AdjustedCombatStats} from "@interfaces/Structs.sol";
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

    function executePvECombat(uint256 randomness, bytes32 encounterId, Attack[] memory attacks) public {
        // ensure this is an authorised call from the entropy contract
        _requireAccess(address(this), _msgSender());

        //get encounter data
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        uint256 numberOfExecutedAttacks;
        if (encounterData.attackersAreMobs) {
            // execute mob attacks
            numberOfExecutedAttacks = _executeMobAttack(encounterId, encounterData, randomness, 0);
        } else {
            //execute player attack
            numberOfExecutedAttacks = _executePlayerAttack(encounterId, encounterData, attacks, randomness, 0);
        }

        encounterData.currentTurn++;

        (bool encounterEnded, bool attackersWin) = IWorld(_world()).UD__checkForEncounterEnd(encounterData);

        if (encounterEnded) {
            _setCharacterSpawns(encounterData);
            IWorld(_world()).UD__endEncounter(encounterId, randomness, attackersWin);
        } else {
            if (encounterData.attackersAreMobs) {
                //execute player attack
                _executePlayerAttack(encounterId, encounterData, attacks, randomness, numberOfExecutedAttacks);
            } else {
                // execute mob attacks
                _executeMobAttack(encounterId, encounterData, randomness, numberOfExecutedAttacks);
            }

            CombatEncounter.set(encounterId, encounterData);

            (encounterEnded, attackersWin) = IWorld(_world()).UD__checkForEncounterEnd(encounterData);

            if (encounterEnded) {
                _setCharacterSpawns(encounterData);
                IWorld(_world()).UD__endEncounter(encounterId, randomness, attackersWin);
            }
        }
    }

    function _executeMobAttack(
        bytes32 encounterId,
        CombatEncounterData memory encounterData,
        uint256 randomness,
        uint256 numberOfExecutedAttacks
    ) internal returns (uint256 _numberOfExecutedAttacks) {
        uint256 randomNumber;

        _numberOfExecutedAttacks = encounterData.defenders.length;

        for (uint256 i; i < _numberOfExecutedAttacks; i++) {
            MonsterStats memory monsterStats = encounterData.attackersAreMobs
                ? IWorld(_world()).UD__getMonsterStats(encounterData.attackers[i])
                : IWorld(_world()).UD__getMonsterStats(encounterData.defenders[i]);

            AttackOutcomeData memory mobAction = _getCurrentAttackData(
                Attack({
                    attackerEntityId: encounterData.attackersAreMobs
                        ? encounterData.attackers[i]
                        : encounterData.defenders[i],
                    defenderEntityId: encounterData.attackersAreMobs
                        ? encounterData.defenders[i]
                        : encounterData.attackers[i],
                    itemId: monsterStats.inventory[0]
                })
            );
            randomNumber = uint256(keccak256(abi.encode(randomness, mobAction.attackerId, encounterData.currentTurn)));

            mobAction = IWorld(_world()).UD__executeAttack(mobAction, randomNumber);

            AttackOutcome.set(encounterId, encounterData.currentTurn, i + numberOfExecutedAttacks, mobAction);
        }
    }

    function _executePlayerAttack(
        bytes32 encounterId,
        CombatEncounterData memory encounterData,
        Attack[] memory attacks,
        uint256 randomness,
        uint256 numberOfExecutedAttacks
    ) internal returns (uint256 _numberOfExecutedAttacks) {
        uint256 randomNumber;
        _numberOfExecutedAttacks = attacks.length;
        // execute attacker effects
        for (uint256 i; i < _numberOfExecutedAttacks; i++) {
            Attack memory currentAction = attacks[i];

            randomNumber =
                uint256(keccak256(abi.encode(randomness, currentAction.attackerEntityId, encounterData.currentTurn)));

            AttackOutcomeData memory currentAttackData = _getCurrentAttackData(currentAction);

            // execute action
            currentAttackData = IWorld(_world()).UD__executeAttack(currentAttackData, randomNumber);
            // emit action data to offchain table
            AttackOutcome.set(encounterId, encounterData.currentTurn, i + numberOfExecutedAttacks, currentAttackData);
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

    function _getCurrentAttackData(Attack memory currentAttack)
        internal
        view
        returns (AttackOutcomeData memory currentAttackData)
    {
        bytes32[] memory effects = IWorld(_world()).UD__getItemEffects(currentAttack.itemId);
        bool[] memory hit = new bool[](effects.length);
        bool[] memory miss = new bool[](effects.length);
        bool[] memory crit = new bool[](effects.length);
        int256[] memory damagePerHit = new int256[](effects.length);
        currentAttackData = AttackOutcomeData({
            effectIds: effects,
            itemId: currentAttack.itemId,
            attackerId: currentAttack.attackerEntityId,
            defenderId: currentAttack.defenderEntityId,
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
