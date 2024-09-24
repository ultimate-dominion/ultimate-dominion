// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {
    RandomNumbers,
    EncounterEntity,
    EncounterEntityData,
    EffectsData,
    Effects,
    Stats,
    CombatEncounter,
    CombatEncounterData,
    CharacterEquipment,
    StatsData,
    PhysicalDamageStats,
    PhysicalDamageStatsData,
    MagicDamageStats,
    MagicDamageStatsData,
    ConsumableStats,
    ConsumableStatsData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectValidity,
    StatusEffectValidityData,
    WorldStatusEffects,
    ActionOutcome,
    ActionOutcomeData
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {RngRequestType, MobType, EncounterType, EffectType, Classes} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Mobs, MobsData} from "@tables/Mobs.sol";
import {MonsterStats, AdjustedCombatStats, Action} from "@interfaces/Structs.sol";
import {IRngSystem} from "@interfaces/IRngSystem.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {DEFAULT_MAX_TURNS} from "../../constants.sol";

contract WorldActionSystem is System {
    function useWorldConsumableItem(bytes32 givingEntity, bytes32 receivingEntity, uint256 itemId) public {
        require(IWorld(_world()).UD__isValidOwner(givingEntity, _msgSender()), "Cannot consume another's item");
        require(IWorld(_world()).UD__isItemOwner(itemId, _msgSender()), "you do not own this item");
        require(EncounterEntity.getEncounterId(givingEntity) == bytes32(0), "cannot use in an encounter");
        // require(IWorld(_world()).UD__isEquipped(givingEntity, itemId), "item is not equipped");
        ConsumableStatsData memory consumableStats = IWorld(_world()).UD__getConsumableStats(itemId);
        Action[] memory actions = new Action[](consumableStats.effects.length);
        Action memory tempAction;
        for (uint256 i; i < consumableStats.effects.length; i++) {
            tempAction.attackerEntityId = givingEntity;
            tempAction.defenderEntityId = receivingEntity;
            tempAction.itemId = itemId;
            actions[i] = tempAction;
        }

        if (consumableStats.maxDamage > 0) {
            _requestWorldRng(givingEntity, actions);
        } else {
            _executeWorldActions(0, givingEntity, actions);
        }
        IWorld(_world()).UD__consumeItem(givingEntity, itemId);
    }

    function executeWorldRngActions(uint256 randomNumber, bytes32 givingEntity, Action[] memory actions) public {
        _requireAccess(address(this), _msgSender());
        _executeWorldActions(randomNumber, givingEntity, actions);
    }

    function _executeWorldActions(uint256 randomNumber, bytes32 givingEntity, Action[] memory actions) internal {
        for (uint256 i; i < actions.length; i++) {
            ActionOutcomeData memory action = _getCurrentActionData(actions[i]);
            action = IWorld(_world()).UD__executeAction(action, randomNumber);
            ActionOutcome.set(givingEntity, 0, 0, action);
        }
    }

    function _requestWorldRng(bytes32 consumerId, Action[] memory actions) internal {
        CombatEncounter.setEncounterType(consumerId, EncounterType.World);
        SystemSwitch.call(
            abi.encodeCall(IRngSystem.getRng, (consumerId, RngRequestType.World, abi.encode(consumerId, actions)))
        );
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
