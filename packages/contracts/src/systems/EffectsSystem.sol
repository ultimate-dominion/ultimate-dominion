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
    PhysicalDamageStats,
    PhysicalDamageStatsData,
    MagicDamageStats,
    MagicDamageStatsData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectValidity,
    StatusEffectValidityData,
    WorldStatusEffects,
    DamageOverTimeApplied,
    DamageOverTimeAppliedData
} from "@codegen/index.sol";
import {IWorld} from "@world/IWorld.sol";
import {EffectType} from "@codegen/common.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {EffectProcessor} from "@libraries/EffectProcessor.sol";
import "forge-std/console.sol";

contract EffectsSystem is System {
    using EffectProcessor for *;
    function createEffect(EffectType effectType, string memory name, bytes memory effectStats)
        public
        returns (bytes32 effectStatsId)
    {
        _requireAccess(address(this), _msgSender());
        effectStatsId = bytes32(bytes8(keccak256(abi.encode(name))));

        require(!Effects.getEffectExists(effectStatsId), "Effect already exists");

        if (effectType == EffectType.PhysicalDamage) {
            PhysicalDamageStatsData memory physicalStats = abi.decode(effectStats, (PhysicalDamageStatsData));
            PhysicalDamageStats.set(effectStatsId, physicalStats);
        } else if (effectType == EffectType.MagicDamage) {
            MagicDamageStatsData memory magicStats = abi.decode(effectStats, (MagicDamageStatsData));
            MagicDamageStats.set(effectStatsId, magicStats);
        } else if (effectType == EffectType.StatusEffect) {
            (StatusEffectStatsData memory statusStats, StatusEffectValidityData memory validityData) =
                abi.decode(effectStats, (StatusEffectStatsData, StatusEffectValidityData));
            // a status effect that expires after a certain time cannot expire after a number of turns
            // combat effects and world effects cannot overlap
            // also a world effect cannot cause damage over time

            if (validityData.validTime != 0) {
                require(validityData.validTurns == 0, "INVALID EFFECT: TIME");
                require(statusStats.damagePerTick == 0, "INVALID EFFECT: WORLD EFFECT DAMAGE");
            } else if (validityData.validTime == 0) {
                require(validityData.validTurns != 0, "INVALID EFFECT: TURNS");
            }
            StatusEffectStats.set(effectStatsId, statusStats);
            StatusEffectValidity.set(effectStatsId, validityData);
        }
        Effects.set(effectStatsId, effectType, true);
    }

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

        // cull expired effects
        for (uint256 i; i < numberOfExpiredEffects; i++) {
            bytes32[] memory cullingEffects = WorldStatusEffects.get(entityId);
            for (uint256 j; j < cullingEffects.length; j++) {
                if (!_isNotExpired(cullingEffects[j])) {
                    cullExpiredWorldEffect(entityId, cullingEffects[j], j);
                    break;
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
        StatusEffectStatsData memory statsData;
        bytes32 effectId;

        _adjustedStats = _incomingStats;

        EncounterEntityData memory encounterData = EncounterEntity.get(entityId);

        if (encounterData.encounterId != bytes32(0)) {
            for (uint256 i; i < encounterData.appliedStatusEffects.length; i++) {
                effectId = encounterData.appliedStatusEffects[i];
                statsData = getStatusEffectStats(getEffectStatId(effectId));
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
        checkWorldStatusEffects(entityId);

        _adjustedStats = IWorld(_world()).UD__getCombatStats(entityId);

        _adjustedStats = calculateCombatStatusEffects(entityId, _adjustedStats);
    }

    function cullExpiredWorldEffect(bytes32 entityId, bytes32 effectId, uint256 index) public {
        uint256 effectsLength = WorldStatusEffects.lengthAppliedStatusEffects(entityId);
        require(effectsLength > index, "non existent index");
        bytes32 worldStatusEffect = WorldStatusEffects.getItem(entityId, index);
        require(getEffectStatId(effectId) == getEffectStatId(worldStatusEffect), "invalid effectId");
        AdjustedCombatStats memory _statInput = IWorld(_world()).UD__getCombatStats(entityId);

        if (worldStatusEffect != bytes32(0)) {
            if (!_isNotExpired(effectId) && worldStatusEffect == effectId) {
                StatusEffectStatsData memory effectStats = getStatusEffectStats(effectId);
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
                revert("Invalid effect");
            }
        } else {
            revert("invalid culling");
        }
    }

    function applyStatusEffect(bytes32 entityId, bytes32 effectId)
        public
        returns (AdjustedCombatStats memory _adjustedStats)
    {
        // Note: Access check removed to allow inter-system calls during combat
        bytes32 appliedEffectId =
            _getAppliedEffectId(effectId, CombatEncounter.getCurrentTurn(EncounterEntity.getEncounterId(entityId)));
        _adjustedStats = IWorld(_world()).UD__getCombatStats(entityId);
        StatusEffectValidityData memory effectValidity = StatusEffectValidity.get(effectId);
        StatusEffectStatsData memory effectStats = getStatusEffectStats(effectId);
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
                revert("invalid effect application");
            }
        }
    }

    function applyWorldEffects(bytes32 entityId) public returns (AdjustedCombatStats memory _adjustedStats) {
        // Note: Access check removed to allow inter-system calls from EquipmentSystem
        checkWorldStatusEffects(entityId);
        bytes32[] memory worldEffects = WorldStatusEffects.get(entityId);
        if (worldEffects.length > 0) {
            _adjustedStats = IWorld(_world()).UD__getCombatStats(entityId);
            StatusEffectStatsData memory effectStats;

            for (uint256 i; i < worldEffects.length; i++) {
                effectStats = getStatusEffectStats(worldEffects[i]);
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
                if (effectId == getEffectStatId(appliedEffects[i])) _appliedStack++;
            }
        } else if (effectValidity.validTime != 0 && effectValidity.validTurns == 0) {
            bytes32[] memory appliedEffects = WorldStatusEffects.getAppliedStatusEffects(entityId);
            for (uint256 i; i < appliedEffects.length; i++) {
                if (effectId == getEffectStatId(appliedEffects[i])) _appliedStack++;
            }
        } else {
            revert("invalid effect type");
        }
    }

    function isValidEffect(bytes32 entityId, bytes32 appliedEffectId) public view returns (bool) {
        return _isNotExpired(expireIfInvalid(entityId, appliedEffectId));
    }
    function _isNotExpired(bytes32 appliedEffectId) internal pure returns (bool) {
        return EffectProcessor.isNotExpired(appliedEffectId);
    }

    function expireIfInvalid(bytes32 entityId, bytes32 appliedEffectId) public view returns (bytes32) {
        this;
        if (_isNotExpired(appliedEffectId)) {
            (bytes32 effectStatId, uint256 timestampApplied, uint256 expiredTime, uint256 turnApplied) =
                getAppliedEffectInfo(appliedEffectId);

            // since the applied effect has extra data in it if we strip that data, the resulting ID should not be the same as the original id
            require(bytes32(bytes8(appliedEffectId)) != appliedEffectId, "effect not applied");

            StatusEffectValidityData memory validityData = StatusEffectValidity.get(getEffectStatId(appliedEffectId));

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
        // Note: Access check removed to allow inter-system calls from PvESystem/PvPSystem
        uint256 currentTurn = CombatEncounter.getCurrentTurn(encounterId);
        int256 totalDamage;
        bytes32[] memory appliedStatusEffects = EncounterEntity.getAppliedStatusEffects(entityId);

        int256[] memory damages = new int256[](appliedStatusEffects.length);

        if (appliedStatusEffects.length > 0) {
            for (uint256 i; i < appliedStatusEffects.length; i++) {
                StatusEffectStatsData memory effectStats = getStatusEffectStats(getEffectStatId(appliedStatusEffects[i]));
                uint256 stacks = EffectProcessor.calculateEffectStacks(getEffectStatId(appliedStatusEffects[i]), appliedStatusEffects);
                int256 damageToApply = EffectProcessor.calculateDamageOverTime(effectStats, stacks);
                damages[i] = damageToApply;
                totalDamage += damageToApply;
            }
        }

        if (totalDamage != 0) {
            int256 currentHp = Stats.getCurrentHp(entityId) - totalDamage;
            Stats.setCurrentHp(entityId, currentHp);
            
            DamageOverTimeAppliedData memory dotDamage =
                DamageOverTimeAppliedData({entityId: entityId, totalDamage: totalDamage, individualDamages: damages});
            DamageOverTimeApplied.set(encounterId, currentTurn, dotDamage);
        }
    }

    function getPhysicalDamageStats(bytes32 effectId)
        public
        view
        returns (PhysicalDamageStatsData memory _physicalDamageStats)
    {
        bytes32 statId = getEffectStatId(effectId);
        EffectsData memory effectsData = Effects.get(statId);
        require(
            effectsData.effectType == EffectType.PhysicalDamage && effectsData.effectExists, "Not Physical Damage type"
        );
        _physicalDamageStats = PhysicalDamageStats.get(statId);
    }

    function getMagicDamageStats(bytes32 effectId)
        public
        view
        returns (MagicDamageStatsData memory _magicDamageStats)
    {
        bytes32 statId = getEffectStatId(effectId);
        EffectsData memory effectsData = Effects.get(statId);
        require(effectsData.effectType == EffectType.MagicDamage && effectsData.effectExists, "Not Magic Damage type");
        _magicDamageStats = MagicDamageStats.get(statId);
    }

    function getStatusEffectStats(bytes32 effectId)
        public
        view
        returns (StatusEffectStatsData memory _statusEffectStats)
    {
        bytes32 statId = getEffectStatId(effectId);
        EffectsData memory effectsData = Effects.get(statId);
        require(effectsData.effectType == EffectType.StatusEffect && effectsData.effectExists, "Not Status Effect type");
        _statusEffectStats = StatusEffectStats.get(statId);
    }

    /**
     * @dev Separates an applied effect id into it's component parts
     */
    function getAppliedEffectInfo(bytes32 appliedEffectId)
        public
        pure
        returns (bytes32 _effectStatsId, uint256 _timestampApplied, uint256 _effectExpiredTime, uint256 _turnApplied)
    {
        return EffectProcessor.getAppliedEffectInfo(appliedEffectId);
    }

    /**
     * @dev returns the base stat id stripped of extra info
     */
    function getEffectStatId(bytes32 effectId) public pure returns (bytes32 _effectStatsId) {
        return EffectProcessor.getEffectStatId(effectId);
    }

    /**
     * @dev takes the applied statId and gets the block it was applied
     */
    function getEffectTimestamp(bytes32 appliedEffectId) public pure returns (uint256 _timestampApplied) {
        return EffectProcessor.getEffectTimestamp(appliedEffectId);
    }

    /**
     * @dev takes the applied statId and gets the timestamp it was applied
     */
    function getEffectExpired(bytes32 appliedEffectId) public pure returns (uint256 _effectExpiredTimestamp) {
        return EffectProcessor.getEffectExpired(appliedEffectId);
    }

    /**
     * @dev takes the applied statId and gets the turn it was applied
     */
    function getEffectTurnApplied(bytes32 appliedEffectId) public pure returns (uint256 _turnApplied) {
        return EffectProcessor.getEffectTurnApplied(appliedEffectId);
    }

    function _getAppliedEffectId(bytes32 effectId, uint256 turnApplied) internal view returns (bytes32) {
        return EffectProcessor.createAppliedEffectId(effectId, block.timestamp, turnApplied);
    }

    function _expireStatusEffect(bytes32 appliedEffectId) internal view returns (bytes32) {
        return EffectProcessor.markEffectAsExpired(appliedEffectId, block.timestamp);
    }
}
