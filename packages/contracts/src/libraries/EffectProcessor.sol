// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {
    StatusEffectStatsData,
    StatusEffectValidityData,
    PhysicalDamageStatsData,
    MagicDamageStatsData
} from "@codegen/index.sol";
import {EffectType} from "@codegen/common.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";

/**
 * @title EffectProcessor
 * @notice External library — deployed as a separate contract, called via DELEGATECALL.
 * @dev Consuming systems get ~30-byte delegatecall stubs instead of inlining 340+ lines.
 */
library EffectProcessor {

    // ── Private helpers (inlined into this library's bytecode only) ──

    function _getEffectStatId(bytes32 appliedEffectId) private pure returns (bytes32) {
        return bytes32(bytes8(appliedEffectId));
    }

    function _getEffectTimestamp(bytes32 appliedEffectId) private pure returns (uint256) {
        return uint256(uint64(bytes8(appliedEffectId << 64)));
    }

    function _getEffectExpired(bytes32 appliedEffectId) private pure returns (uint256) {
        return uint256(uint64(bytes8(appliedEffectId << 128)));
    }

    function _getEffectTurnApplied(bytes32 appliedEffectId) private pure returns (uint256) {
        return uint256(uint64(bytes8(appliedEffectId << 192)));
    }

    function _getAppliedEffectInfo(bytes32 appliedEffectId)
        private
        pure
        returns (bytes32 effectStatId, uint256 timestampApplied, uint256 effectExpiredTime, uint256 turnApplied)
    {
        effectStatId = _getEffectStatId(appliedEffectId);
        timestampApplied = _getEffectTimestamp(appliedEffectId);
        effectExpiredTime = _getEffectExpired(appliedEffectId);
        turnApplied = _getEffectTurnApplied(appliedEffectId);
    }

    function _calculateEffectStacks(bytes32 effectId, bytes32[] memory appliedEffects)
        private
        pure
        returns (uint256 stackCount)
    {
        stackCount = 0;
        for (uint256 i = 0; i < appliedEffects.length; i++) {
            if (effectId == _getEffectStatId(appliedEffects[i])) {
                stackCount++;
            }
        }
    }

    // ── External functions (consumers get delegatecall stubs) ──

    /**
     * @notice Calculate effect duration based on validity data
     */
    function calculateEffectDuration(
        StatusEffectValidityData memory validityData,
        uint256 currentTime,
        uint256 appliedTime
    ) external pure returns (uint256 duration) {
        if (validityData.validTime > 0) {
            if (currentTime >= appliedTime) {
                uint256 elapsed = currentTime - appliedTime;
                if (elapsed >= validityData.validTime) {
                    duration = 0;
                } else {
                    duration = validityData.validTime - elapsed;
                }
            } else {
                duration = validityData.validTime;
            }
        } else {
            duration = 0;
        }
    }

    /**
     * @notice Calculate number of effect stacks for an entity
     */
    function calculateEffectStacks(bytes32 effectId, bytes32[] memory appliedEffects)
        external
        pure
        returns (uint256 stackCount)
    {
        return _calculateEffectStacks(effectId, appliedEffects);
    }

    /**
     * @notice Process effect interactions and conflicts
     */
    function processEffectInteractions(
        bytes32[] memory existingEffects,
        bytes32 newEffectId,
        uint256 maxStacks
    ) external pure returns (bool canApply, uint256[] memory conflicts) {
        uint256 currentStacks = _calculateEffectStacks(newEffectId, existingEffects);
        canApply = currentStacks < maxStacks;
        conflicts = new uint256[](0);
    }

    /**
     * @notice Apply status effect modifiers to combat stats
     */
    function applyStatusEffectModifiers(
        AdjustedCombatStats memory baseStats,
        StatusEffectStatsData memory effectStats
    ) external pure returns (AdjustedCombatStats memory adjustedStats) {
        adjustedStats = baseStats;
        adjustedStats.agility += effectStats.agiModifier;
        adjustedStats.intelligence += effectStats.intModifier;
        adjustedStats.strength += effectStats.strModifier;
        adjustedStats.maxHp += effectStats.hpModifier;
        adjustedStats.armor += effectStats.armorModifier;
        adjustedStats.currentHp = baseStats.currentHp;
    }

    /**
     * @notice Remove status effect modifiers from combat stats
     */
    function removeStatusEffectModifiers(
        AdjustedCombatStats memory baseStats,
        StatusEffectStatsData memory effectStats
    ) external pure returns (AdjustedCombatStats memory adjustedStats) {
        adjustedStats = baseStats;
        adjustedStats.agility -= effectStats.agiModifier;
        adjustedStats.intelligence -= effectStats.intModifier;
        adjustedStats.strength -= effectStats.strModifier;
        adjustedStats.maxHp -= effectStats.hpModifier;
        adjustedStats.armor -= effectStats.armorModifier;
        adjustedStats.currentHp = baseStats.currentHp;
    }

    /**
     * @notice Calculate damage over time for an effect
     */
    function calculateDamageOverTime(
        StatusEffectStatsData memory effectStats,
        uint256 stacks
    ) external pure returns (int256 totalDamage) {
        totalDamage = effectStats.damagePerTick * int256(stacks);
    }

    /**
     * @notice Validate effect application based on validity rules
     */
    function validateEffectApplication(
        StatusEffectValidityData memory validityData,
        StatusEffectStatsData memory effectStats,
        bool isInCombat
    ) external pure returns (bool isValid) {
        if (validityData.validTime > 0) {
            isValid = !isInCombat && effectStats.damagePerTick == 0;
        } else if (validityData.validTurns > 0) {
            isValid = isInCombat;
        } else {
            isValid = false;
        }
    }

    /**
     * @notice Check if an effect has expired based on time
     */
    function isEffectExpiredByTime(
        uint256 appliedTime,
        uint256 currentTime,
        StatusEffectValidityData memory validityData
    ) external pure returns (bool isExpired) {
        if (validityData.validTime == 0) {
            isExpired = false;
        } else {
            isExpired = currentTime - appliedTime >= validityData.validTime;
        }
    }

    /**
     * @notice Check if an effect has expired based on turns
     */
    function isEffectExpiredByTurns(
        uint256 appliedTurn,
        uint256 currentTurn,
        StatusEffectValidityData memory validityData
    ) external pure returns (bool isExpired) {
        if (validityData.validTurns == 0) {
            isExpired = false;
        } else {
            isExpired = currentTurn - appliedTurn > validityData.validTurns;
        }
    }

    /**
     * @notice Calculate effect priority for stacking rules
     */
    function calculateEffectPriority(StatusEffectStatsData memory effectStats)
        external
        pure
        returns (uint256 priority)
    {
        priority = uint256(effectStats.strModifier + effectStats.agiModifier + effectStats.intModifier);
    }

    /**
     * @notice Get the base effect ID from an applied effect ID
     */
    function getEffectStatId(bytes32 appliedEffectId) external pure returns (bytes32 effectId) {
        return _getEffectStatId(appliedEffectId);
    }

    /**
     * @notice Extract timestamp from applied effect ID
     */
    function getEffectTimestamp(bytes32 appliedEffectId) external pure returns (uint256 timestamp) {
        return _getEffectTimestamp(appliedEffectId);
    }

    /**
     * @notice Extract expiration time from applied effect ID
     */
    function getEffectExpired(bytes32 appliedEffectId) external pure returns (uint256 expiredTime) {
        return _getEffectExpired(appliedEffectId);
    }

    /**
     * @notice Extract turn applied from applied effect ID
     */
    function getEffectTurnApplied(bytes32 appliedEffectId) external pure returns (uint256 turnApplied) {
        return _getEffectTurnApplied(appliedEffectId);
    }

    /**
     * @notice Create an applied effect ID with metadata
     */
    function createAppliedEffectId(
        bytes32 effectId,
        uint256 timestamp,
        uint256 turnApplied
    ) external pure returns (bytes32 appliedEffectId) {
        return bytes32(
            abi.encodePacked(
                bytes8(effectId),
                bytes8(uint64(timestamp)),
                bytes8(uint64(0)),
                bytes8(uint64(turnApplied))
            )
        );
    }

    /**
     * @notice Mark an effect as expired
     */
    function markEffectAsExpired(bytes32 appliedEffectId, uint256 currentTime)
        external
        pure
        returns (bytes32 expiredEffectId)
    {
        (bytes32 effectStatId, uint256 timestampApplied, uint256 expiredTime, uint256 turnApplied) =
            _getAppliedEffectInfo(appliedEffectId);

        if (expiredTime == 0) {
            expiredTime = currentTime;
            return bytes32(
                abi.encodePacked(
                    bytes8(effectStatId),
                    bytes8(uint64(timestampApplied)),
                    bytes8(uint64(expiredTime)),
                    bytes8(uint64(turnApplied))
                )
            );
        } else {
            return appliedEffectId;
        }
    }

    /**
     * @notice Extract all information from an applied effect ID
     */
    function getAppliedEffectInfo(bytes32 appliedEffectId)
        external
        pure
        returns (
            bytes32 effectStatId,
            uint256 timestampApplied,
            uint256 effectExpiredTime,
            uint256 turnApplied
        )
    {
        return _getAppliedEffectInfo(appliedEffectId);
    }

    /**
     * @notice Check if an effect is not expired
     */
    function isNotExpired(bytes32 appliedEffectId) external pure returns (bool) {
        return _getEffectExpired(appliedEffectId) == 0;
    }
}
