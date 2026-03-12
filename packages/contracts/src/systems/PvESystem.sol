// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Stats,
    StatsData,
    Effects,
    CombatEncounter,
    CombatEncounterData,
    CharacterEquipment,
    MobStats,
    Position,
    Spawned,
    ActionOutcome,
    ActionOutcomeData
} from "@codegen/index.sol";
import {NoWeaponsEquipped, InvalidAction} from "../Errors.sol";
import {Action} from "@interfaces/Structs.sol";
import {_requireSystemOrAdmin} from "../utils.sol";

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
        // Require player characters to have at least 1 weapon or spell equipped
        if (_isValidPvE) {
            bytes32[] memory players = _attackersAreMobs ? defenders : attackers;
            for (uint256 i; i < players.length; i++) {
                if (CharacterEquipment.lengthEquippedWeapons(players[i])
                    + CharacterEquipment.lengthEquippedSpells(players[i]) == 0) {
                    revert NoWeaponsEquipped();
                }
            }
        }
        return (_isValidPvE, _attackersAreMobs);
    }

    function executePvECombat(uint256 randomness, bytes32 encounterId, Action[] memory attacks) public {
        _requireSystemOrAdmin(_msgSender());

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
            bytes32 mobEntity = encounterData.attackersAreMobs
                ? encounterData.attackers[i]
                : encounterData.defenders[i];
            bytes32 defenderEntity = encounterData.attackersAreMobs
                ? encounterData.defenders[i]
                : encounterData.attackers[i];

            uint256 monsterWeapon;
            if (MobStats.getHasBossAI(mobEntity)) {
                // Boss AI: pick weapon that counters defender's dominant stat
                int256 defStr = Stats.getStrength(defenderEntity);
                int256 defAgi = Stats.getAgility(defenderEntity);
                int256 defInt = Stats.getIntelligence(defenderEntity);
                // INT-dominant → physical (slot 0) exploits low armor/STR
                // STR/AGI-dominant → magic (slot 1) exploits low INT, bypasses evasion
                monsterWeapon = (defInt >= defStr && defInt >= defAgi)
                    ? MobStats.getItemInventory(mobEntity, 0)
                    : MobStats.getItemInventory(mobEntity, 1);
            } else {
                monsterWeapon = MobStats.getItemInventory(mobEntity, 0);
            }

            ActionOutcomeData memory mobAction = _getCurrentActionData(
                Action({
                    attackerEntityId: mobEntity,
                    defenderEntityId: defenderEntity,
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
        _validateActions(attacks, encounterData.attackers, encounterData.defenders);
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
        bytes32[] memory players = encounterData.attackersAreMobs
            ? encounterData.defenders
            : encounterData.attackers;
        for (uint256 i; i < players.length; i++) {
            if (IWorld(_world()).UD__getDied(players[i])) {
                Spawned.set(players[i], false);
            }
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

    /// @dev Validates that each action's attacker and defender are on opposite teams
    function _validateActions(Action[] memory actions, bytes32[] memory teamA, bytes32[] memory teamB) internal pure {
        for (uint256 i; i < actions.length; i++) {
            bool valid = (
                _isInArray(actions[i].attackerEntityId, teamA) && _isInArray(actions[i].defenderEntityId, teamB)
            ) || (
                _isInArray(actions[i].attackerEntityId, teamB) && _isInArray(actions[i].defenderEntityId, teamA)
            );
            if (!valid) revert InvalidAction();
        }
    }

    function _isInArray(bytes32 id, bytes32[] memory arr) internal pure returns (bool) {
        for (uint256 j; j < arr.length; j++) {
            if (arr[j] == id) return true;
        }
        return false;
    }
}
