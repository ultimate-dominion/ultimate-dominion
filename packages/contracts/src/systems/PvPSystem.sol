// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    EncounterEntity,
    Effects,
    CombatEncounter,
    CombatEncounterData,
    CombatOutcome,
    CombatOutcomeData,
    Position,
    Spawned,
    ActionOutcome,
    ActionOutcomeData,
    AdventureEscrow
} from "@codegen/index.sol";
import {EncounterType} from "@codegen/common.sol";
import {Action} from "@interfaces/Structs.sol";
import {PVP_TIMER} from "../../constants.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
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

            if (EncounterEntity.getPvpTimer(attackers[i]) > block.timestamp - PVP_TIMER) {
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
                if (EncounterEntity.getPvpTimer(defenders[i]) > block.timestamp - PVP_TIMER) {
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
        // Note: Access check removed - this function is called via SystemSwitch from RngSystem
        // which changes _msgSender(). Authorization is handled by RngSystem.

        uint256 randomNumber;
        //get encounter data
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        ActionOutcomeData memory currentActionData;
        // execute attacker effects
        for (uint256 i; i < effects.length; i++) {
            Action memory currentAction = effects[i];
            randomNumber =
                uint256(keccak256(abi.encode(prevRandao, currentAction.attackerEntityId, encounterData.currentTurn)));

            currentActionData = _getCurrentActionData(currentAction);

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

    function fleePvp(bytes32 entityId) public {
        PauseLib.requireNotPaused();
        require(IWorld(_world()).UD__isValidOwner(entityId, _msgSender()), "Cannot flee another's character");
        bytes32 encounterId = EncounterEntity.getEncounterId(entityId);
        require(encounterId != bytes32(0), "use removeEntityFromMap to logout");
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        bool entityIsDefender = IWorld(_world()).UD__isDefender(encounterId, entityId);
        if (entityIsDefender) {
            require(encounterData.currentTurn == 2, "can only flee on your first turn");
        } else {
            require(IWorld(_world()).UD__isAttacker(encounterId, entityId), "invalid fleeing");
            require(encounterData.currentTurn == 1, "can only flee on your first turn");
        }
        if (encounterData.encounterType == EncounterType.PvE) {
            revert("cannot flee from pve");
        } else if (encounterData.encounterType == EncounterType.PvP) {
            uint256 amountToDrop;
            bool attackersWin;
            // take 25% of escrow gold
            uint256 escrowBalance = AdventureEscrow.get(entityId);
            if (escrowBalance > 4) {
                amountToDrop = escrowBalance / 4;
                AdventureEscrow.set(entityId, (escrowBalance - amountToDrop));
                // if quitter is attacker
                if (!entityIsDefender) {
                    // split the money up amongst the defenders
                    for (uint256 i; i < encounterData.defenders.length; i++) {
                        IWorld(_world()).UD__increaseEscrowBalance(
                            encounterData.defenders[i], amountToDrop / encounterData.defenders.length
                        );
                    }
                    // if quitter is defender
                } else if (entityIsDefender) {
                    attackersWin = true;
                    // split the money up amongst the attackers
                    for (uint256 i; i < encounterData.attackers.length; i++) {
                        IWorld(_world()).UD__increaseEscrowBalance(
                            encounterData.attackers[i], amountToDrop / encounterData.attackers.length
                        );
                    }
                }
            }
            // set pvp timer
            EncounterEntity.setPvpTimer(entityId, block.timestamp);

            CombatOutcomeData memory combatOutcome = CombatOutcomeData({
                endTime: block.timestamp,
                attackersWin: attackersWin,
                playerFled: true,
                expDropped: 0,
                goldDropped: amountToDrop,
                itemsDropped: new uint256[](0)
            });

            CombatOutcome.set(encounterId, combatOutcome);
            CombatEncounter.setEnd(encounterId, block.timestamp);

            bytes32[] memory empty;
            // reset encounter entities
            for (uint256 i; i < encounterData.attackers.length; i++) {
                EncounterEntity.setEncounterId(encounterData.attackers[i], bytes32(0));
                EncounterEntity.setAppliedStatusEffects(encounterData.attackers[i], empty);
            }
            for (uint256 i; i < encounterData.defenders.length; i++) {
                EncounterEntity.setEncounterId(encounterData.defenders[i], bytes32(0));
                EncounterEntity.setAppliedStatusEffects(encounterData.defenders[i], empty);
            }
        } else {
            revert("Unrecognized encounter type");
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
