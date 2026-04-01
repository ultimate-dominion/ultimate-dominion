// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {
    CharacterEquipment,
    EncounterEntity,
    Effects,
    Stats,
    CombatEncounter,
    StatsData,
    ConsumableStats,
    ConsumableStatsData,
    ActionOutcome,
    ActionOutcomeData,
    CombatFlags
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {UserDelegationControl} from "@latticexyz/world/src/codegen/tables/UserDelegationControl.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {RngRequestType, EncounterType} from "@codegen/common.sol";
import {Action, CombatFlagsResult} from "@interfaces/Structs.sol";
import {IRngSystem} from "@interfaces/IRngSystem.sol";
import {_requireAccess, _requireSystemOrAdmin} from "../utils.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import {EffectProcessor} from "@libraries/EffectProcessor.sol";
import {
    NotItemOwner,
    InEncounter,
    InsufficientItemBalance,
    Unauthorized,
    CharacterDead,
    NotAtRestPosition,
    OnlyHealingInCombat
} from "../Errors.sol";

contract WorldActionSystem is System {
    function useWorldConsumableItem(bytes32 givingEntity, bytes32 receivingEntity, uint256 itemId) public {
        PauseLib.requireNotPaused();
        // Items are owned by the character owner (delegator), not the caller (session wallet)
        address characterOwner = IWorld(_world()).UD__getOwner(givingEntity);
        if (!IWorld(_world()).UD__isItemOwner(itemId, characterOwner)) revert NotItemOwner();
        if (EncounterEntity.getEncounterId(givingEntity) != bytes32(0)) revert InEncounter();
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
            CombatFlagsResult memory worldFlags;
            (action, worldFlags) = IWorld(_world()).UD__executeAction(action, randomNumber);
            ActionOutcome.set(givingEntity, 0, 0, action);
            CombatFlags.set(givingEntity, 0, 0, worldFlags.doubleStrike, worldFlags.spellDodged, worldFlags.blocked);
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
        if (IWorld(_world()).UD__getItemBalance(givingEntity, itemId) == 0) revert InsufficientItemBalance();
        StatsData memory stats = Stats.get(receivingEntity);
        _heal = IWorld(_world()).UD__getConsumableStats(itemId).maxDamage;
        if (stats.currentHp - _heal > int256(stats.maxHp)) {
            _heal = -(stats.maxHp - stats.currentHp);
        }
        stats.currentHp -= _heal;

        Stats.setCurrentHp(receivingEntity, stats.currentHp);
    }

    /**
     * @dev Rest by the crackling fire at the crossroads to restore HP to full.
     *      Free, but only usable at position (0,0) and outside combat.
     * @param characterId The character to heal
     */
    function rest(bytes32 characterId) public {
        PauseLib.requireNotPaused();
        address owner = IWorld(_world()).UD__getOwner(characterId);
        if (!_isOwnerOrDelegated(owner)) revert Unauthorized();
        if (EncounterEntity.getEncounterId(characterId) != bytes32(0)) revert InEncounter();
        if (Stats.getCurrentHp(characterId) <= 0) revert CharacterDead();

        (, uint16 x, uint16 y) = IWorld(_world()).UD__getEntityPosition(characterId);
        if (x != 0 || y != 0) revert NotAtRestPosition();

        int256 maxHp = Stats.getMaxHp(characterId) + CharacterEquipment.getHpBonus(characterId);
        if (maxHp < 1) maxHp = 1;
        Stats.setCurrentHp(characterId, maxHp);
    }

    function _isOwnerOrDelegated(address owner) internal view returns (bool) {
        if (_msgSender() == owner) return true;
        ResourceId delegationId = UserDelegationControl.getDelegationControlId(owner, _msgSender());
        return ResourceId.unwrap(delegationId) != bytes32(0);
    }

    /// @dev Deprecated — potions must now go through endTurn so they cost a turn.
    function useCombatConsumableItem(bytes32, uint256) public pure {
        revert("Use potions through endTurn");
    }

    /// @notice Apply a healing consumable and consume it. System-only.
    function applyCombatHeal(bytes32 characterId, uint256 itemId) public returns (int256 healAmount) {
        _requireSystemOrAdmin(_msgSender());
        healAmount = _applyHealingPotion(characterId, characterId, itemId);
        IWorld(_world()).UD__consumeItem(characterId, itemId);
    }

    /// @notice Apply an antidote consumable and consume it. System-only.
    function applyCombatCleanse(bytes32 characterId, uint256 itemId) public {
        _requireSystemOrAdmin(_msgSender());
        ConsumableStatsData memory cs = IWorld(_world()).UD__getConsumableStats(itemId);
        _cleanseEffects(characterId, cs.effects);
        IWorld(_world()).UD__consumeItem(characterId, itemId);
    }

    /**
     * @dev Remove applied status effects matching any of the given effectStatIds.
     * @param entityId The entity to cleanse
     * @param effectsToCleanse Array of effectStatIds to remove
     */
    function _cleanseEffects(bytes32 entityId, bytes32[] memory effectsToCleanse) internal {
        bytes32[] memory applied = EncounterEntity.getAppliedStatusEffects(entityId);
        if (applied.length == 0) return;

        // Build filtered array excluding matching effectStatIds
        bytes32[] memory remaining = new bytes32[](applied.length);
        uint256 count;
        for (uint256 i; i < applied.length; i++) {
            bytes32 effectStatId = EffectProcessor.getEffectStatId(applied[i]);
            bool shouldRemove;
            for (uint256 j; j < effectsToCleanse.length; j++) {
                if (effectStatId == effectsToCleanse[j]) {
                    shouldRemove = true;
                    break;
                }
            }
            if (!shouldRemove) {
                remaining[count++] = applied[i];
            }
        }

        // Resize and write back
        bytes32[] memory trimmed = new bytes32[](count);
        for (uint256 i; i < count; i++) {
            trimmed[i] = remaining[i];
        }
        EncounterEntity.setAppliedStatusEffects(entityId, trimmed);
    }
}
