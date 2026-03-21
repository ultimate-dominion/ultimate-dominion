// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    EncounterEntity,
    EncounterEntityData,
    EffectsData,
    Effects,
    Stats,
    CombatEncounter,
    StatsData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectValidity,
    StatusEffectValidityData,
    WorldStatusEffects,
    DamageOverTimeApplied,
    DamageOverTimeAppliedData,
    ComputedEffectMods,
    ComputedEffectModsData
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {EffectType, ResistanceStat} from "@codegen/common.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {EffectProcessor} from "@libraries/EffectProcessor.sol";
import {NonExistentIndex, InvalidEffect, InvalidEffectApplication, InvalidEffectType, EffectNotApplied, NotEffectType} from "../Errors.sol";
import {_requireSystemOrAdmin} from "../utils.sol";

contract EffectsSystem is System {
    using EffectProcessor for *;

    // world status effects change global stat state

    function checkWorldStatusEffects(bytes32 entityId) public {
        bytes32[] memory appliedEffects = WorldStatusEffects.get(entityId);
        bytes32 effectId;
        uint256 numberOfExpiredEffects;
        if (appliedEffects.length > 0) {
            for (uint256 i; i < appliedEffects.length; i++) {
                effectId = appliedEffects[i];
                bytes32 updatedEffectId = expireIfInvalid(entityId, effectId);
                if (!_isNotExpired(updatedEffectId)) {
                    WorldStatusEffects.updateAppliedStatusEffects(entityId, i, updatedEffectId);
                    numberOfExpiredEffects++;
                }
            }
        }

        // Cull expired effects — single pass instead of O(n²) re-reads
        // We pop from the end, so iterate backwards to avoid index shifting
        if (numberOfExpiredEffects > 0) {
            bytes32[] memory cullingEffects = WorldStatusEffects.get(entityId);
            for (uint256 j = cullingEffects.length; j > 0;) {
                j--;
                if (!_isNotExpired(cullingEffects[j])) {
                    cullExpiredWorldEffect(entityId, cullingEffects[j], j);
                }
            }
        }
    }

    // combat status effects are not applied to the global stats only calculated during each round

    function calculateCombatStatusEffects(bytes32 entityId, AdjustedCombatStats memory _incomingStats)
        public
        returns (AdjustedCombatStats memory _adjustedStats)
    {
        checkWorldStatusEffects(entityId);
        _adjustedStats = _calculateCombatStatusEffectsInternal(entityId, _incomingStats);
    }

    function _calculateCombatStatusEffectsInternal(bytes32 entityId, AdjustedCombatStats memory _incomingStats)
        internal
        returns (AdjustedCombatStats memory _adjustedStats)
    {
        StatusEffectStatsData memory statsData;
        bytes32 effectId;

        _adjustedStats = _incomingStats;

        EncounterEntityData memory encounterData = EncounterEntity.get(entityId);

        if (encounterData.encounterId != bytes32(0)) {
            for (uint256 i; i < encounterData.appliedStatusEffects.length; i++) {
                effectId = encounterData.appliedStatusEffects[i];
                bytes32 baseEffectId = EffectProcessor.getEffectStatId(effectId);

                // Check for computed percentage override first (class spells)
                ComputedEffectModsData memory computed = ComputedEffectMods.get(entityId, baseEffectId);
                if (computed.exists) {
                    statsData = StatusEffectStatsData({
                        strModifier: computed.strModifier,
                        agiModifier: computed.agiModifier,
                        intModifier: computed.intModifier,
                        armorModifier: computed.armorModifier,
                        hpModifier: computed.hpModifier,
                        damagePerTick: 0,
                        resistanceStat: ResistanceStat.None
                    });
                } else {
                    statsData = _getStatusEffectStats(baseEffectId);
                }

                bytes32 updatedEffectId = expireIfInvalid(entityId, effectId);
                if (_isNotExpired(updatedEffectId)) {
                    _adjustedStats = EffectProcessor.applyStatusEffectModifiers(_adjustedStats, statsData);
                } else {
                    EncounterEntity.updateAppliedStatusEffects(entityId, i, updatedEffectId);
                }
            }
        }
    }

    function calculateAllStatusEffects(bytes32 entityId) public returns (AdjustedCombatStats memory _adjustedStats) {
        // checkWorldStatusEffects is called once here; calculateCombatStatusEffects
        // uses the internal variant that skips the duplicate call (saves 3-8K gas/action)
        checkWorldStatusEffects(entityId);

        _adjustedStats = IWorld(_world()).UD__getCombatStats(entityId);

        _adjustedStats = _calculateCombatStatusEffectsInternal(entityId, _adjustedStats);
    }

    function cullExpiredWorldEffect(bytes32 entityId, bytes32 effectId, uint256 index) public {
        uint256 effectsLength = WorldStatusEffects.lengthAppliedStatusEffects(entityId);
        if (effectsLength <= index) revert NonExistentIndex();
        bytes32 worldStatusEffect = WorldStatusEffects.getItem(entityId, index);
        if (EffectProcessor.getEffectStatId(effectId) != EffectProcessor.getEffectStatId(worldStatusEffect)) revert InvalidEffect();
        AdjustedCombatStats memory _statInput = IWorld(_world()).UD__getCombatStats(entityId);

        if (worldStatusEffect != bytes32(0)) {
            if (!_isNotExpired(effectId) && worldStatusEffect == effectId) {
                StatusEffectStatsData memory effectStats = _getStatusEffectStats(effectId);
                if (effectsLength > 1) {
                    bytes32 lastEffectId = WorldStatusEffects.getItemAppliedStatusEffects(entityId, effectsLength - 1);
                    WorldStatusEffects.updateAppliedStatusEffects(entityId, index, lastEffectId);
                }
                WorldStatusEffects.popAppliedStatusEffects(entityId);
                _statInput.agility -= effectStats.agiModifier;
                _statInput.strength -= effectStats.strModifier;
                _statInput.intelligence -= effectStats.intModifier;
                _statInput.maxHp -= effectStats.hpModifier;
                _statInput.armor -= effectStats.armorModifier;
                IWorld(_world()).UD__setStats(entityId, _statInput);
            } else {
                revert InvalidEffect();
            }
        } else {
            revert InvalidEffect();
        }
    }

    function applyStatusEffect(bytes32 entityId, bytes32 effectId)
        public
        returns (AdjustedCombatStats memory _adjustedStats)
    {
        _requireSystemOrAdmin(_msgSender());
        bytes32 appliedEffectId =
            _getAppliedEffectId(effectId, CombatEncounter.getCurrentTurn(EncounterEntity.getEncounterId(entityId)));
        _adjustedStats = IWorld(_world()).UD__getCombatStats(entityId);
        StatusEffectValidityData memory effectValidity = StatusEffectValidity.get(effectId);
        StatusEffectStatsData memory effectStats = _getStatusEffectStats(effectId);
        bytes32 encounterId = EncounterEntity.getEncounterId(entityId);
        uint256 currentStacksCount = currentStacks(entityId, effectId);
        if (currentStacksCount < effectValidity.maxStacks) {
            if (effectValidity.validTurns != 0 && encounterId != bytes32(0)) {
                EncounterEntity.pushAppliedStatusEffects(entityId, appliedEffectId);
                checkWorldStatusEffects(entityId);
            } else if (effectValidity.validTime != 0 && encounterId == bytes32(0)) {
                _adjustedStats = EffectProcessor.applyStatusEffectModifiers(_adjustedStats, effectStats);
                checkWorldStatusEffects(entityId);
                IWorld(_world()).UD__setStats(entityId, _adjustedStats);
                WorldStatusEffects.pushAppliedStatusEffects(entityId, appliedEffectId);
            } else {
                revert InvalidEffectApplication();
            }
        }
    }

    function applyWorldEffects(bytes32 entityId) public returns (AdjustedCombatStats memory _adjustedStats) {
        _requireSystemOrAdmin(_msgSender());
        checkWorldStatusEffects(entityId);
        bytes32[] memory worldEffects = WorldStatusEffects.get(entityId);
        if (worldEffects.length > 0) {
            _adjustedStats = IWorld(_world()).UD__getCombatStats(entityId);
            StatusEffectStatsData memory effectStats;

            for (uint256 i; i < worldEffects.length; i++) {
                effectStats = _getStatusEffectStats(worldEffects[i]);
                _adjustedStats.agility += effectStats.agiModifier;
                _adjustedStats.strength += effectStats.strModifier;
                _adjustedStats.intelligence += effectStats.intModifier;
                _adjustedStats.armor += effectStats.armorModifier;
                _adjustedStats.maxHp += effectStats.hpModifier;
            }
            IWorld(_world()).UD__setStats(entityId, _adjustedStats);
        }
    }

    function currentStacks(bytes32 entityId, bytes32 effectId) public returns (uint256 _appliedStack) {
        StatusEffectValidityData memory effectValidity = StatusEffectValidity.get(effectId);
        if (effectValidity.validTurns != 0 && effectValidity.validTime == 0) {
            bytes32[] memory appliedEffects = EncounterEntity.getAppliedStatusEffects(entityId);
            for (uint256 i; i < appliedEffects.length; i++) {
                if (effectId == EffectProcessor.getEffectStatId(appliedEffects[i])) _appliedStack++;
            }
        } else if (effectValidity.validTime != 0 && effectValidity.validTurns == 0) {
            bytes32[] memory appliedEffects = WorldStatusEffects.getAppliedStatusEffects(entityId);
            for (uint256 i; i < appliedEffects.length; i++) {
                if (effectId == EffectProcessor.getEffectStatId(appliedEffects[i])) _appliedStack++;
            }
        } else {
            revert InvalidEffectType();
        }
    }

    function isValidEffect(bytes32 entityId, bytes32 appliedEffectId) public view returns (bool) {
        return _isNotExpired(expireIfInvalid(entityId, appliedEffectId));
    }
    function _isNotExpired(bytes32 appliedEffectId) internal pure returns (bool) {
        return EffectProcessor.isNotExpired(appliedEffectId);
    }

    function expireIfInvalid(bytes32 entityId, bytes32 appliedEffectId) public view returns (bytes32) {
        if (_isNotExpired(appliedEffectId)) {
            (bytes32 effectStatId, uint256 timestampApplied, uint256 expiredTime, uint256 turnApplied) =
                EffectProcessor.getAppliedEffectInfo(appliedEffectId);

            // since the applied effect has extra data in it if we strip that data, the resulting ID should not be the same as the original id
            if (bytes32(bytes8(appliedEffectId)) == appliedEffectId) revert EffectNotApplied();

            StatusEffectValidityData memory validityData = StatusEffectValidity.get(EffectProcessor.getEffectStatId(appliedEffectId));

            bool isValidTime;
            bool isValidTurn;

            if (validityData.validTime == 0 || block.timestamp - timestampApplied < validityData.validTime) {
                isValidTime = true;
            }

            if (
                validityData.validTurns == 0
                    || CombatEncounter.getCurrentTurn(EncounterEntity.getEncounterId(entityId)) - turnApplied
                        <= validityData.validTurns
            ) isValidTurn = true;

            if (isValidTime && isValidTurn) {
                return appliedEffectId;
            } else {
                return _expireStatusEffect(appliedEffectId);
            }
        } else {
            return appliedEffectId;
        }
    }

    function applyDamageOverTime(bytes32 encounterId, bytes32 entityId) public {
        _requireSystemOrAdmin(_msgSender());
        uint256 currentTurn = CombatEncounter.getCurrentTurn(encounterId);
        int256 totalDamage;
        bytes32[] memory appliedStatusEffects = EncounterEntity.getAppliedStatusEffects(entityId);

        if (appliedStatusEffects.length == 0) return;

        // Deduplicate effectStatIds to avoid quadratic damage (stacks^2 bug).
        // Each unique DoT effect should only be calculated once, with its stack count.
        bytes32[] memory processedIds = new bytes32[](appliedStatusEffects.length);
        int256[] memory damages = new int256[](appliedStatusEffects.length);
        uint256 processedCount;

        for (uint256 i; i < appliedStatusEffects.length; i++) {
            bytes32 effectStatId = EffectProcessor.getEffectStatId(appliedStatusEffects[i]);

            // Skip if already processed this effectStatId
            bool skip;
            for (uint256 j; j < processedCount; j++) {
                if (processedIds[j] == effectStatId) { skip = true; break; }
            }
            if (skip) continue;
            processedIds[processedCount] = effectStatId;

            StatusEffectStatsData memory effectStats = _getStatusEffectStats(effectStatId);
            uint256 stacks = EffectProcessor.calculateEffectStacks(effectStatId, appliedStatusEffects);
            int256 damageToApply = EffectProcessor.calculateDamageOverTime(effectStats, stacks);
            damages[processedCount] = damageToApply;
            totalDamage += damageToApply;
            processedCount++;
        }

        if (totalDamage != 0) {
            int256 currentHp = Stats.getCurrentHp(entityId) - totalDamage;
            if (currentHp < 0) currentHp = 0;
            Stats.setCurrentHp(entityId, currentHp);

            if (currentHp == 0) {
                EncounterEntity.setDied(entityId, true);
            }

            // Trim damages array to actual size
            int256[] memory trimmedDamages = new int256[](processedCount);
            for (uint256 k; k < processedCount; k++) {
                trimmedDamages[k] = damages[k];
            }

            DamageOverTimeAppliedData memory dotDamage =
                DamageOverTimeAppliedData({entityId: entityId, totalDamage: totalDamage, individualDamages: trimmedDamages});
            DamageOverTimeApplied.set(encounterId, currentTurn, dotDamage);
        }
    }

    function _getStatusEffectStats(bytes32 effectId)
        internal
        view
        returns (StatusEffectStatsData memory _statusEffectStats)
    {
        bytes32 statId = EffectProcessor.getEffectStatId(effectId);
        EffectsData memory effectsData = Effects.get(statId);
        if (effectsData.effectType != EffectType.StatusEffect || !effectsData.effectExists) revert NotEffectType();
        _statusEffectStats = StatusEffectStats.get(statId);
    }

    function _getAppliedEffectId(bytes32 effectId, uint256 turnApplied) internal view returns (bytes32) {
        return EffectProcessor.createAppliedEffectId(effectId, block.timestamp, turnApplied);
    }

    function _expireStatusEffect(bytes32 appliedEffectId) internal view returns (bytes32) {
        return EffectProcessor.markEffectAsExpired(appliedEffectId, block.timestamp);
    }
}
