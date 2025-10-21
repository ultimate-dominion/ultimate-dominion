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
 * @notice Library containing all effect processing logic and calculations extracted from EffectsSystem
 * @dev This library centralizes effect calculations for reusability and maintainability
 */
library EffectProcessor {
    /**
     * @notice Calculate effect duration based on validity data
     * @param validityData Effect validity configuration
     * @param currentTime Current block timestamp
     * @param appliedTime Time when effect was applied
     * @return duration Calculated duration in seconds
     */
    function calculateEffectDuration(
        StatusEffectValidityData memory validityData,
        uint256 currentTime,
        uint256 appliedTime
    ) internal pure returns (uint256 duration) {
        if (validityData.validTime > 0) {
            // For time-based effects, return the remaining duration
            if (currentTime >= appliedTime) {
                uint256 elapsed = currentTime - appliedTime;
                if (elapsed >= validityData.validTime) {
                    duration = 0; // Effect has expired
                } else {
                    duration = validityData.validTime - elapsed; // Remaining duration
                }
            } else {
                duration = validityData.validTime; // Effect not yet applied
            }
        } else {
            // For turn-based effects, duration is calculated differently
            duration = 0; // Turn-based effects don't have time duration
        }
    }

    /**
     * @notice Calculate number of effect stacks for an entity
     * @param effectId Base effect ID
     * @param appliedEffects Array of applied effects
     * @return stackCount Number of stacks of this effect
     */
    function calculateEffectStacks(bytes32 effectId, bytes32[] memory appliedEffects)
        internal
        pure
        returns (uint256 stackCount)
    {
        stackCount = 0;
        for (uint256 i = 0; i < appliedEffects.length; i++) {
            if (effectId == getEffectStatId(appliedEffects[i])) {
                stackCount++;
            }
        }
    }

    /**
     * @notice Process effect interactions and conflicts
     * @param existingEffects Array of existing effects
     * @param newEffectId New effect to apply
     * @param maxStacks Maximum allowed stacks
     * @return canApply Whether the new effect can be applied
     * @return conflicts Array of conflicting effect indices
     */
    function processEffectInteractions(
        bytes32[] memory existingEffects,
        bytes32 newEffectId,
        uint256 maxStacks
    ) internal pure returns (bool canApply, uint256[] memory conflicts) {
        uint256 currentStacks = calculateEffectStacks(newEffectId, existingEffects);
        canApply = currentStacks < maxStacks;
        
        // For now, no conflicts are detected - this could be expanded
        conflicts = new uint256[](0);
    }

    /**
     * @notice Apply status effect modifiers to combat stats
     * @param baseStats Base combat stats
     * @param effectStats Status effect stats
     * @return adjustedStats Stats with effect modifiers applied
     */
    function applyStatusEffectModifiers(
        AdjustedCombatStats memory baseStats,
        StatusEffectStatsData memory effectStats
    ) internal pure returns (AdjustedCombatStats memory adjustedStats) {
        adjustedStats = baseStats;
        adjustedStats.agility += effectStats.agiModifier;
        adjustedStats.intelligence += effectStats.intModifier;
        adjustedStats.strength += effectStats.strModifier;
        adjustedStats.maxHp += effectStats.hpModifier;
        adjustedStats.armor += effectStats.armorModifier;
        adjustedStats.currentHp = baseStats.currentHp; // Current HP typically not modified by effects
    }

    /**
     * @notice Remove status effect modifiers from combat stats
     * @param baseStats Base combat stats
     * @param effectStats Status effect stats
     * @return adjustedStats Stats with effect modifiers removed
     */
    function removeStatusEffectModifiers(
        AdjustedCombatStats memory baseStats,
        StatusEffectStatsData memory effectStats
    ) internal pure returns (AdjustedCombatStats memory adjustedStats) {
        adjustedStats = baseStats;
        adjustedStats.agility -= effectStats.agiModifier;
        adjustedStats.intelligence -= effectStats.intModifier;
        adjustedStats.strength -= effectStats.strModifier;
        adjustedStats.maxHp -= effectStats.hpModifier;
        adjustedStats.armor -= effectStats.armorModifier;
        adjustedStats.currentHp = baseStats.currentHp; // Current HP typically not modified by effects
    }

    /**
     * @notice Calculate damage over time for an effect
     * @param effectStats Status effect stats
     * @param stacks Number of effect stacks
     * @return totalDamage Total damage to apply
     */
    function calculateDamageOverTime(
        StatusEffectStatsData memory effectStats,
        uint256 stacks
    ) internal pure returns (int256 totalDamage) {
        totalDamage = effectStats.damagePerTick * int256(stacks);
    }

    /**
     * @notice Validate effect application based on validity rules
     * @param validityData Effect validity configuration
     * @param effectStats Effect stats data
     * @param isInCombat Whether the entity is in combat
     * @return isValid Whether the effect can be applied
     */
    function validateEffectApplication(
        StatusEffectValidityData memory validityData,
        StatusEffectStatsData memory effectStats,
        bool isInCombat
    ) internal pure returns (bool isValid) {
        if (validityData.validTime > 0) {
            // Time-based effect
            isValid = !isInCombat && effectStats.damagePerTick == 0;
        } else if (validityData.validTurns > 0) {
            // Turn-based effect
            isValid = isInCombat;
        } else {
            isValid = false;
        }
    }

    /**
     * @notice Check if an effect has expired based on time
     * @param appliedTime Time when effect was applied
     * @param currentTime Current block timestamp
     * @param validityData Effect validity configuration
     * @return isExpired Whether the effect has expired
     */
    function isEffectExpiredByTime(
        uint256 appliedTime,
        uint256 currentTime,
        StatusEffectValidityData memory validityData
    ) internal pure returns (bool isExpired) {
        if (validityData.validTime == 0) {
            isExpired = false; // Turn-based effects don't expire by time
        } else {
            isExpired = currentTime - appliedTime >= validityData.validTime;
        }
    }

    /**
     * @notice Check if an effect has expired based on turns
     * @param appliedTurn Turn when effect was applied
     * @param currentTurn Current turn number
     * @param validityData Effect validity configuration
     * @return isExpired Whether the effect has expired
     */
    function isEffectExpiredByTurns(
        uint256 appliedTurn,
        uint256 currentTurn,
        StatusEffectValidityData memory validityData
    ) internal pure returns (bool isExpired) {
        if (validityData.validTurns == 0) {
            isExpired = false; // Time-based effects don't expire by turns
        } else {
            isExpired = currentTurn - appliedTurn > validityData.validTurns;
        }
    }

    /**
     * @notice Calculate effect priority for stacking rules
     * @param effectStats Status effect stats
     * @return priority Effect priority (higher number = higher priority)
     */
    function calculateEffectPriority(StatusEffectStatsData memory effectStats)
        internal
        pure
        returns (uint256 priority)
    {
        // Simple priority calculation based on effect strength
        priority = uint256(effectStats.strModifier + effectStats.agiModifier + effectStats.intModifier);
    }

    /**
     * @notice Get the base effect ID from an applied effect ID
     * @param appliedEffectId Applied effect ID with metadata
     * @return effectId Base effect ID
     */
    function getEffectStatId(bytes32 appliedEffectId) internal pure returns (bytes32 effectId) {
        return bytes32(bytes8(appliedEffectId));
    }

    /**
     * @notice Extract timestamp from applied effect ID
     * @param appliedEffectId Applied effect ID
     * @return timestamp Time when effect was applied
     */
    function getEffectTimestamp(bytes32 appliedEffectId) internal pure returns (uint256 timestamp) {
        // Extract bytes 8-15 (timestamp is in the second 8-byte segment)
        // Use left shift by 64 bits, then take the first 8 bytes
        timestamp = uint256(uint64(bytes8(appliedEffectId << 64)));
    }

    /**
     * @notice Extract expiration time from applied effect ID
     * @param appliedEffectId Applied effect ID
     * @return expiredTime Time when effect expired (0 if not expired)
     */
    function getEffectExpired(bytes32 appliedEffectId) internal pure returns (uint256 expiredTime) {
        // Extract bytes 16-23 (expired time is in the third 8-byte segment)
        // Use left shift by 128 bits, then take the first 8 bytes
        expiredTime = uint256(uint64(bytes8(appliedEffectId << 128)));
    }

    /**
     * @notice Extract turn applied from applied effect ID
     * @param appliedEffectId Applied effect ID
     * @return turnApplied Turn when effect was applied
     */
    function getEffectTurnApplied(bytes32 appliedEffectId) internal pure returns (uint256 turnApplied) {
        // Extract bytes 24-31 (turn applied is in the fourth 8-byte segment)
        // Use left shift by 192 bits, then take the first 8 bytes
        turnApplied = uint256(uint64(bytes8(appliedEffectId << 192)));
    }

    /**
     * @notice Create an applied effect ID with metadata
     * @param effectId Base effect ID
     * @param timestamp Current timestamp
     * @param turnApplied Current turn
     * @return appliedEffectId Applied effect ID with metadata
     */
    function createAppliedEffectId(
        bytes32 effectId,
        uint256 timestamp,
        uint256 turnApplied
    ) internal pure returns (bytes32 appliedEffectId) {
        // Pack the data: effectId (32 bytes) + timestamp (8 bytes) + expired time (8 bytes) + turn applied (8 bytes)
        // But we need to fit this into 32 bytes, so we'll use a different approach
        // We'll use the first 8 bytes of effectId as the base, then pack the rest
        return bytes32(
            abi.encodePacked(
                bytes8(effectId),
                bytes8(uint64(timestamp)),
                bytes8(uint64(0)), // Not expired initially
                bytes8(uint64(turnApplied))
            )
        );
    }

    /**
     * @notice Mark an effect as expired
     * @param appliedEffectId Applied effect ID
     * @param currentTime Current timestamp
     * @return expiredEffectId Effect ID marked as expired
     */
    function markEffectAsExpired(bytes32 appliedEffectId, uint256 currentTime)
        internal
        pure
        returns (bytes32 expiredEffectId)
    {
        (bytes32 effectStatId, uint256 timestampApplied, uint256 expiredTime, uint256 turnApplied) =
            getAppliedEffectInfo(appliedEffectId);
        
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
     * @param appliedEffectId Applied effect ID
     * @return effectStatId Base effect ID
     * @return timestampApplied Time when applied
     * @return effectExpiredTime Time when expired (0 if not expired)
     * @return turnApplied Turn when applied
     */
    function getAppliedEffectInfo(bytes32 appliedEffectId)
        internal
        pure
        returns (
            bytes32 effectStatId,
            uint256 timestampApplied,
            uint256 effectExpiredTime,
            uint256 turnApplied
        )
    {
        effectStatId = getEffectStatId(appliedEffectId);
        timestampApplied = getEffectTimestamp(appliedEffectId);
        effectExpiredTime = getEffectExpired(appliedEffectId);
        turnApplied = getEffectTurnApplied(appliedEffectId);
    }

    /**
     * @notice Check if an effect is not expired
     * @param appliedEffectId Applied effect ID
     * @return isNotExpired Whether the effect is still active
     */
    function isNotExpired(bytes32 appliedEffectId) internal pure returns (bool) {
        return getEffectExpired(appliedEffectId) == 0;
    }
}
