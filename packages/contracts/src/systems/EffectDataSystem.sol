// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    EffectsData,
    Effects,
    PhysicalDamageStats,
    PhysicalDamageStatsData,
    MagicDamageStats,
    MagicDamageStatsData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectTargeting,
    StatusEffectValidity,
    StatusEffectValidityData
} from "@codegen/index.sol";
import {EffectType} from "@codegen/common.sol";
import {_requireAccess} from "../utils.sol";
import {EffectProcessor} from "@libraries/EffectProcessor.sol";
import {InvalidEffectConfig, NotEffectType} from "../Errors.sol";

contract EffectDataSystem is System {
    function createEffect(EffectType effectType, string memory name, bytes memory effectStats)
        public
        returns (bytes32 effectStatsId)
    {
        _requireAccess(address(this), _msgSender());
        effectStatsId = bytes32(bytes8(keccak256(abi.encode(name))));

        // Skip if effect already exists (idempotent operation)
        if (Effects.getEffectExists(effectStatsId)) {
            return effectStatsId;
        }

        if (effectType == EffectType.PhysicalDamage) {
            PhysicalDamageStatsData memory physicalStats = abi.decode(effectStats, (PhysicalDamageStatsData));
            PhysicalDamageStats.set(effectStatsId, physicalStats);
        } else if (effectType == EffectType.MagicDamage) {
            MagicDamageStatsData memory magicStats = abi.decode(effectStats, (MagicDamageStatsData));
            MagicDamageStats.set(effectStatsId, magicStats);
        } else if (effectType == EffectType.StatusEffect) {
            (StatusEffectStatsData memory statusStats, StatusEffectValidityData memory validityData, bool targetsSelf) =
                abi.decode(effectStats, (StatusEffectStatsData, StatusEffectValidityData, bool));

            if (validityData.validTime != 0) {
                if (validityData.validTurns != 0) revert InvalidEffectConfig();
                if (statusStats.damagePerTick != 0) revert InvalidEffectConfig();
            } else if (validityData.validTime == 0) {
                if (validityData.validTurns == 0) revert InvalidEffectConfig();
            }
            StatusEffectStats.set(effectStatsId, statusStats);
            StatusEffectValidity.set(effectStatsId, validityData);
            StatusEffectTargeting.set(effectStatsId, targetsSelf);
        }
        Effects.set(effectStatsId, effectType, true);
    }

    function getPhysicalDamageStats(bytes32 effectId)
        public
        view
        returns (PhysicalDamageStatsData memory _physicalDamageStats)
    {
        bytes32 statId = EffectProcessor.getEffectStatId(effectId);
        EffectsData memory effectsData = Effects.get(statId);
        if (effectsData.effectType != EffectType.PhysicalDamage || !effectsData.effectExists) revert NotEffectType();
        _physicalDamageStats = PhysicalDamageStats.get(statId);
    }

    function getMagicDamageStats(bytes32 effectId)
        public
        view
        returns (MagicDamageStatsData memory _magicDamageStats)
    {
        bytes32 statId = EffectProcessor.getEffectStatId(effectId);
        EffectsData memory effectsData = Effects.get(statId);
        if (effectsData.effectType != EffectType.MagicDamage || !effectsData.effectExists) revert NotEffectType();
        _magicDamageStats = MagicDamageStats.get(statId);
    }

    function getStatusEffectStats(bytes32 effectId)
        public
        view
        returns (StatusEffectStatsData memory _statusEffectStats)
    {
        bytes32 statId = EffectProcessor.getEffectStatId(effectId);
        EffectsData memory effectsData = Effects.get(statId);
        if (effectsData.effectType != EffectType.StatusEffect || !effectsData.effectExists) revert NotEffectType();
        _statusEffectStats = StatusEffectStats.get(statId);
    }

    function getAppliedEffectInfo(bytes32 appliedEffectId)
        public
        pure
        returns (bytes32 _effectStatsId, uint256 _timestampApplied, uint256 _effectExpiredTime, uint256 _turnApplied)
    {
        return EffectProcessor.getAppliedEffectInfo(appliedEffectId);
    }

    function getEffectStatId(bytes32 effectId) public pure returns (bytes32 _effectStatsId) {
        return EffectProcessor.getEffectStatId(effectId);
    }

    function getEffectTimestamp(bytes32 appliedEffectId) public pure returns (uint256 _timestampApplied) {
        return EffectProcessor.getEffectTimestamp(appliedEffectId);
    }

    function getEffectExpired(bytes32 appliedEffectId) public pure returns (uint256 _effectExpiredTimestamp) {
        return EffectProcessor.getEffectExpired(appliedEffectId);
    }

    function getEffectTurnApplied(bytes32 appliedEffectId) public pure returns (uint256 _turnApplied) {
        return EffectProcessor.getEffectTurnApplied(appliedEffectId);
    }
}
