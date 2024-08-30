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

contract PvPSystem is System {
    function isValidPvP(bytes32[] memory attackers, bytes32[] memory defenders, uint16 x, uint16 y)
        public
        view
        returns (bool _isValidPvP)
    {
        _isValidPvP = true;
        uint16 entityX;
        uint16 entityY;
        for (uint256 i; i < attackers.length;) {
            (entityX, entityY) = IWorld(_world()).UD__getEntityPosition(attackers[i]);
            if (!IWorld(_world()).UD__isValidCharacterId(attackers[i])) {
                _isValidPvP = false;
                break;
            }
            if (entityX != x || entityY != y) {
                _isValidPvP = false;
                break;
            }
            if (entityX >= 5 || entityY >= 5) {
                // intentionally left empty
            }
            else {
                _isValidPvP = false;
                break;
            }
            {
                i++;
            }
        }
        if (_isValidPvP) {
            for (uint256 i; i < defenders.length;) {
                (entityX, entityY) = IWorld(_world()).UD__getEntityPosition(defenders[i]);
                if (!IWorld(_world()).UD__isValidCharacterId(defenders[i])) {
                    _isValidPvP = false;
                    break;
                }
                if (entityX != x || entityY != y) {
                    _isValidPvP = false;
                    break;
                }
                if (entityX >= 5 || entityY >= 5) {
                    // intentionally left empty
                }
                else {
                    _isValidPvP = false;
                    break;
                }
                {
                    i++;
                }
            }
        }
        return _isValidPvP;
    }

    function executePvPCombat(uint256 prevRandao, bytes32 encounterId, Action[] memory effects) public {
        // ensure this is an authorised call from the entropy contract
        _requireAccess(address(this), _msgSender());

        uint256 randomNumber;
        //get encounter data
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        ActionOutcomeData memory currentActionData;
        // execute attacker effects
        for (uint256 i; i < effects.length; i++) {
            Action memory currentEffect = effects[i];

            randomNumber =
                uint256(keccak256(abi.encode(prevRandao, currentEffect.attackerEntityId, encounterData.currentTurn)));

            currentActionData = _getCurrentActionData(currentEffect);

            // execute action
            currentActionData = IWorld(_world()).UD__executeAction(currentActionData, randomNumber);

            // emit action data to offchain table
            ActionOutcome.set(encounterId, encounterData.currentTurn, i, currentActionData);
        }

        encounterData.currentTurnTimer = block.timestamp;
        encounterData.currentTurn++;

        CombatEncounter.set(encounterId, encounterData);
        (bool encounterEnded, bool attackersWin) = IWorld(_world()).UD__checkForEncounterEnd(encounterData);

        if (encounterEnded) {
            _setCharacterSpawns(encounterData);
            IWorld(_world()).UD__endEncounter(encounterId, randomNumber, attackersWin);
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
