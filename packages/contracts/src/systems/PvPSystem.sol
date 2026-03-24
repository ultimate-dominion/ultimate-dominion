// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    EncounterEntity,
    Effects,
    CharacterEquipment,
    CombatEncounter,
    CombatEncounterData,
    CombatOutcome,
    CombatOutcomeData,
    Position,
    Spawned,
    ActionOutcome,
    ActionOutcomeData,
    CombatFlags,
    Items,
    ConsumableStats,
    ConsumableStatsData
} from "@codegen/index.sol";
import {EncounterType, ItemType} from "@codegen/common.sol";
import {Action, CombatFlagsResult} from "@interfaces/Structs.sol";
import {PVP_TIMER, SMOKE_CLOAK_EFFECT_STAT_ID} from "../../constants.sol";
import {
    NoWeaponsEquipped,
    Unauthorized,
    NotInEncounter,
    CanOnlyFleeFirstTurn,
    InvalidFlee,
    UnrecognizedEncounterType,
    InvalidAction,
    OnlyHealingInCombat
} from "../Errors.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import {GoldLib} from "../libraries/GoldLib.sol";
import {_requireSystemOrAdmin} from "../utils.sol";

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
            if (entityX < 5 && entityY < 5) {
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
                if (entityX < 5 && entityY < 5) {
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
        // Require all combatants to have at least 1 weapon or spell equipped
        if (_isValidPvP) {
            for (uint256 i; i < attackers.length; i++) {
                if (CharacterEquipment.lengthEquippedWeapons(attackers[i])
                    + CharacterEquipment.lengthEquippedSpells(attackers[i]) == 0) {
                    revert NoWeaponsEquipped();
                }
            }
            for (uint256 i; i < defenders.length; i++) {
                if (CharacterEquipment.lengthEquippedWeapons(defenders[i])
                    + CharacterEquipment.lengthEquippedSpells(defenders[i]) == 0) {
                    revert NoWeaponsEquipped();
                }
            }
        }
        return _isValidPvP;
    }

    function executePvPCombat(uint256 prevRandao, bytes32 encounterId, Action[] memory effects) public {
        _requireSystemOrAdmin(_msgSender());

        uint256 randomNumber;
        //get encounter data
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        _validateActions(effects, encounterData.attackers, encounterData.defenders);
        ActionOutcomeData memory currentActionData;
        // execute attacker effects
        for (uint256 i; i < effects.length; i++) {
            Action memory currentAction = effects[i];

            // Consumable heal/cleanse — skip combat pipeline, apply directly
            if (Items.getItemType(currentAction.itemId) == ItemType.Consumable) {
                ConsumableStatsData memory cs = ConsumableStats.get(currentAction.itemId);
                if (cs.maxDamage == cs.minDamage && cs.maxDamage < 0) {
                    IWorld(_world()).UD__applyCombatHeal(currentAction.attackerEntityId, currentAction.itemId);
                } else if (cs.maxDamage == 0 && cs.minDamage == 0 && cs.effects.length > 0) {
                    IWorld(_world()).UD__applyCombatCleanse(currentAction.attackerEntityId, currentAction.itemId);
                } else {
                    revert OnlyHealingInCombat();
                }
                // Write ActionOutcome so client can render the heal in battle log
                ActionOutcomeData memory outcome = ActionOutcomeData({
                    effectIds: new bytes32[](0),
                    itemId: currentAction.itemId,
                    attackerId: currentAction.attackerEntityId,
                    defenderId: currentAction.attackerEntityId, // self-target signal
                    damagePerHit: new int256[](1),
                    hit: new bool[](1),
                    miss: new bool[](1),
                    crit: new bool[](1),
                    attackerDamageDelt: 0,
                    defenderDamageDelt: 0,
                    attackerDied: false,
                    defenderDied: false,
                    blockNumber: block.number,
                    timestamp: block.timestamp
                });
                outcome.hit[0] = true;
                ActionOutcome.set(encounterId, encounterData.currentTurn, i, outcome);
                continue;
            }

            randomNumber =
                uint256(keccak256(abi.encode(prevRandao, currentAction.attackerEntityId, encounterData.currentTurn)));

            currentActionData = _getCurrentActionData(currentAction);

            // execute action
            CombatFlagsResult memory pvpFlags;
            (currentActionData, pvpFlags) = IWorld(_world()).UD__executeAction(currentActionData, randomNumber);

            // emit action data to offchain tables
            ActionOutcome.set(encounterId, encounterData.currentTurn, i, currentActionData);
            CombatFlags.set(encounterId, encounterData.currentTurn, i, pvpFlags.doubleStrike, pvpFlags.spellDodged, pvpFlags.blocked);
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
        if (!IWorld(_world()).UD__isValidOwner(entityId, _msgSender())) revert Unauthorized();
        bytes32 encounterId = EncounterEntity.getEncounterId(entityId);
        if (encounterId == bytes32(0)) revert NotInEncounter();
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        bool entityIsDefender = IWorld(_world()).UD__isDefender(encounterId, entityId);
        if (entityIsDefender) {
            if (encounterData.currentTurn != 2) revert CanOnlyFleeFirstTurn();
        } else {
            if (!IWorld(_world()).UD__isAttacker(encounterId, entityId)) revert InvalidFlee();
            if (encounterData.currentTurn != 1) revert CanOnlyFleeFirstTurn();
        }
        bool hasSmokeCover = _hasStatusEffect(entityId, SMOKE_CLOAK_EFFECT_STAT_ID);
        if (encounterData.encounterType == EncounterType.PvE) {
            // PvE flee — burn 5% of wallet Gold (permanent sink)
            // Smoke Cloak (Flashpowder) negates the penalty entirely
            uint256 amountToLose;
            if (!hasSmokeCover) {
                address playerAddr = IWorld(_world()).UD__getOwnerAddress(entityId);
                uint256 walletGold = GoldLib.goldBalanceOf(playerAddr);
                if (walletGold > 0) {
                    amountToLose = walletGold / 20;
                    if (amountToLose > 0) {
                        GoldLib.goldBurn(_world(), playerAddr, amountToLose);
                    }
                }
            }

            CombatOutcomeData memory combatOutcome = CombatOutcomeData({
                endTime: block.timestamp,
                attackersWin: entityIsDefender,
                playerFled: true,
                expDropped: 0,
                goldDropped: amountToLose,
                itemsDropped: new uint256[](0)
            });
            CombatOutcome.set(encounterId, combatOutcome);
            CombatEncounter.setEnd(encounterId, block.timestamp);

            bytes32[] memory empty;
            for (uint256 i; i < encounterData.attackers.length; i++) {
                EncounterEntity.setEncounterId(encounterData.attackers[i], bytes32(0));
                EncounterEntity.setAppliedStatusEffects(encounterData.attackers[i], empty);
            }
            for (uint256 i; i < encounterData.defenders.length; i++) {
                EncounterEntity.setEncounterId(encounterData.defenders[i], bytes32(0));
                EncounterEntity.setAppliedStatusEffects(encounterData.defenders[i], empty);
            }
        } else if (encounterData.encounterType == EncounterType.PvP) {
            uint256 amountToDrop;
            bool attackersWin;
            // take 10% of wallet Gold — 5% burned (permanent sink), 5% to opponent
            // Smoke Cloak negates the penalty entirely
            if (!hasSmokeCover) {
                address playerAddr = IWorld(_world()).UD__getOwnerAddress(entityId);
                uint256 walletGold = GoldLib.goldBalanceOf(playerAddr);
                if (walletGold > 0) {
                    amountToDrop = walletGold / 10;
                    if (amountToDrop > 0) {
                        uint256 toBurn = amountToDrop / 2;
                        uint256 toOpponents = amountToDrop - toBurn;

                        GoldLib.goldBurn(_world(), playerAddr, toBurn);

                        bytes32[] memory opponents;
                        if (!entityIsDefender) {
                            opponents = encounterData.defenders;
                        } else {
                            attackersWin = true;
                            opponents = encounterData.attackers;
                        }
                        uint256 perOpponent = toOpponents / opponents.length;
                        for (uint256 i; i < opponents.length; i++) {
                            address opAddr = IWorld(_world()).UD__getOwnerAddress(opponents[i]);
                            GoldLib.goldTransfer(_world(), playerAddr, opAddr, perOpponent);
                        }
                        // Burn rounding dust so fleeing player loses exactly amountToDrop
                        uint256 fleeDust = toOpponents - perOpponent * opponents.length;
                        if (fleeDust > 0) GoldLib.goldBurn(_world(), playerAddr, fleeDust);
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
            revert UnrecognizedEncounterType();
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

    function _hasStatusEffect(bytes32 entityId, bytes8 targetEffectStatId) internal view returns (bool) {
        bytes32[] memory effects = EncounterEntity.getAppliedStatusEffects(entityId);
        for (uint256 i; i < effects.length; i++) {
            if (bytes8(effects[i]) == targetEffectStatId) return true;
        }
        return false;
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
