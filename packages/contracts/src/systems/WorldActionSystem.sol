// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {
    EncounterEntity,
    Effects,
    Stats,
    CombatEncounter,
    StatsData,
    ConsumableStats,
    ConsumableStatsData,
    ActionOutcome,
    ActionOutcomeData
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {RngRequestType, EncounterType} from "@codegen/common.sol";
import {Action} from "@interfaces/Structs.sol";
import {IRngSystem} from "@interfaces/IRngSystem.sol";
import {_requireAccess} from "../utils.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import "forge-std/console.sol";

contract WorldActionSystem is System {
    function useWorldConsumableItem(bytes32 givingEntity, bytes32 receivingEntity, uint256 itemId) public {
        PauseLib.requireNotPaused();
        // Items are owned by the character owner (delegator), not the caller (session wallet)
        address characterOwner = IWorld(_world()).UD__getOwner(givingEntity);
        require(IWorld(_world()).UD__isItemOwner(itemId, characterOwner), "you do not own this item");
        require(EncounterEntity.getEncounterId(givingEntity) == bytes32(0), "cannot use in an encounter");
        ConsumableStatsData memory consumableStats = IWorld(_world()).UD__getConsumableStats(itemId);
        Action[] memory actions = new Action[](consumableStats.effects.length);
        Action memory tempAction;
        for (uint256 i; i < consumableStats.effects.length; i++) {
            tempAction.attackerEntityId = givingEntity;
            tempAction.defenderEntityId = receivingEntity;
            tempAction.itemId = itemId;
            actions[i] = tempAction;
        }
        // if min / max damage are negative and equal consume item and apply health potion bypassing the combat system.

        if (consumableStats.maxDamage > 0) {
            _requestWorldRng(givingEntity, actions);
        } else if (consumableStats.maxDamage == consumableStats.minDamage && consumableStats.maxDamage < 0) {
            _applyHealingPotion(givingEntity, receivingEntity, itemId);
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

    function _applyHealingPotion(bytes32 givingEntity, bytes32 receivingEntity, uint256 itemId)
        internal
        returns (int256 _heal)
    {
        require(IWorld(_world()).UD__getItemBalance(givingEntity, itemId) > 0, "You do not own a healing potion.");
        StatsData memory stats = Stats.get(receivingEntity);
        _heal = IWorld(_world()).UD__getConsumableStats(itemId).maxDamage;
        if (stats.currentHp - _heal > int256(stats.maxHp)) {
            _heal = -(stats.maxHp - stats.currentHp);
        }
        stats.currentHp -= _heal;

        Stats.setCurrentHp(receivingEntity, stats.currentHp);
    }

    /**
     * @dev Use a healing consumable during combat. Only works for instant healing items (negative maxDamage).
     * @param characterId The character using the consumable
     * @param itemId The consumable item ID
     */
    function useCombatConsumableItem(bytes32 characterId, uint256 itemId) public {
        PauseLib.requireNotPaused();
        // Items are owned by the character owner (delegator), not the caller (session wallet)
        address characterOwner = IWorld(_world()).UD__getOwner(characterId);
        require(IWorld(_world()).UD__isItemOwner(itemId, characterOwner), "you do not own this item");

        // Get consumable stats
        ConsumableStatsData memory consumableStats = IWorld(_world()).UD__getConsumableStats(itemId);

        // Only allow instant healing items during combat (negative maxDamage = healing)
        require(
            consumableStats.maxDamage == consumableStats.minDamage && consumableStats.maxDamage < 0,
            "Only instant healing items can be used in combat"
        );

        // Apply the healing
        _applyHealingPotion(characterId, characterId, itemId);

        // Consume the item
        IWorld(_world()).UD__consumeItem(characterId, itemId);

        console.log("WorldActionSystem: Used combat consumable", itemId);
    }
}
