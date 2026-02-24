// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Test} from "forge-std/Test.sol";
import {EffectProcessor} from "../src/libraries/EffectProcessor.sol";
import {
    StatusEffectStatsData,
    StatusEffectValidityData
} from "@codegen/index.sol";
import {ResistanceStat} from "@codegen/common.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";

contract EffectProcessorTest is Test {
    function setUp() public {}

    function testCalculateEffectDuration() public {
        StatusEffectValidityData memory validityData = StatusEffectValidityData({
            cooldown: 0,
            maxStacks: 3,
            validTime: 3600, // 1 hour
            validTurns: 0
        });

        uint256 currentTime = 2000; // Use a reasonable timestamp
        uint256 appliedTime = 200; // Applied 1800 seconds ago
        
        uint256 duration = EffectProcessor.calculateEffectDuration(validityData, currentTime, appliedTime);
        assertEq(duration, 1800); // 3600 - 1800 = 1800 remaining

        // Test turn-based effect
        validityData.validTime = 0;
        validityData.validTurns = 5;
        duration = EffectProcessor.calculateEffectDuration(validityData, currentTime, appliedTime);
        assertEq(duration, 0); // Turn-based effects don't have time duration
    }

    function testCalculateEffectStacks() public {
        bytes32 effectId = keccak256("test_effect");
        bytes32[] memory appliedEffects = new bytes32[](3);
        uint256 currentTime = 2000;
        appliedEffects[0] = EffectProcessor.createAppliedEffectId(effectId, currentTime, 1);
        appliedEffects[1] = EffectProcessor.createAppliedEffectId(keccak256("other_effect"), currentTime, 1);
        appliedEffects[2] = EffectProcessor.createAppliedEffectId(effectId, currentTime, 2);

        // Use only the first 8 bytes of the effectId for comparison
        uint256 stackCount = EffectProcessor.calculateEffectStacks(bytes8(effectId), appliedEffects);
        assertEq(stackCount, 2);
    }

    function testProcessEffectInteractions() public {
        bytes32 effectId = keccak256("test_effect");
        bytes32[] memory existingEffects = new bytes32[](2);
        uint256 currentTime = 2000;
        existingEffects[0] = EffectProcessor.createAppliedEffectId(effectId, currentTime, 1);
        existingEffects[1] = EffectProcessor.createAppliedEffectId(effectId, currentTime, 2);

        (bool canApply, uint256[] memory conflicts) = EffectProcessor.processEffectInteractions(
            existingEffects,
            bytes8(effectId), // Use only the first 8 bytes
            3 // maxStacks
        );
        assertTrue(canApply);
        assertEq(conflicts.length, 0);

        // Test max stacks exceeded
        (canApply, conflicts) = EffectProcessor.processEffectInteractions(
            existingEffects,
            bytes8(effectId), // Use only the first 8 bytes
            2 // maxStacks
        );
        assertFalse(canApply);
    }

    function testApplyStatusEffectModifiers() public {
        AdjustedCombatStats memory baseStats = AdjustedCombatStats({
            strength: 10,
            agility: 8,
            intelligence: 6,
            armor: 15,
            maxHp: 100,
            currentHp: 80
        });

        StatusEffectStatsData memory effectStats = StatusEffectStatsData({
            agiModifier: 1,
            armorModifier: 5,
            damagePerTick: 0,
            hpModifier: 20,
            intModifier: 3,
            resistanceStat: ResistanceStat.None,
            strModifier: 2
        });

        AdjustedCombatStats memory adjustedStats = EffectProcessor.applyStatusEffectModifiers(
            baseStats,
            effectStats
        );

        assertEq(adjustedStats.strength, 12);
        assertEq(adjustedStats.agility, 9);
        assertEq(adjustedStats.intelligence, 9);
        assertEq(adjustedStats.armor, 20);
        assertEq(adjustedStats.maxHp, 120);
        assertEq(adjustedStats.currentHp, 80); // Should remain unchanged
    }

    function testRemoveStatusEffectModifiers() public {
        AdjustedCombatStats memory baseStats = AdjustedCombatStats({
            strength: 12,
            agility: 9,
            intelligence: 9,
            armor: 20,
            maxHp: 120,
            currentHp: 80
        });

        StatusEffectStatsData memory effectStats = StatusEffectStatsData({
            agiModifier: 1,
            armorModifier: 5,
            damagePerTick: 0,
            hpModifier: 20,
            intModifier: 3,
            resistanceStat: ResistanceStat.None,
            strModifier: 2
        });

        AdjustedCombatStats memory adjustedStats = EffectProcessor.removeStatusEffectModifiers(
            baseStats,
            effectStats
        );

        assertEq(adjustedStats.strength, 10);
        assertEq(adjustedStats.agility, 8);
        assertEq(adjustedStats.intelligence, 6);
        assertEq(adjustedStats.armor, 15);
        assertEq(adjustedStats.maxHp, 100);
        assertEq(adjustedStats.currentHp, 80); // Should remain unchanged
    }

    function testCalculateDamageOverTime() public {
        StatusEffectStatsData memory effectStats = StatusEffectStatsData({
            agiModifier: 0,
            armorModifier: 0,
            damagePerTick: 5,
            hpModifier: 0,
            intModifier: 0,
            resistanceStat: ResistanceStat.None,
            strModifier: 0
        });

        int256 totalDamage = EffectProcessor.calculateDamageOverTime(effectStats, 3);
        assertEq(totalDamage, 15); // 5 * 3 stacks
    }

    function testValidateEffectApplication() public {
        StatusEffectValidityData memory validityData = StatusEffectValidityData({
            cooldown: 0,
            maxStacks: 3,
            validTime: 3600,
            validTurns: 0
        });

        StatusEffectStatsData memory effectStats = StatusEffectStatsData({
            agiModifier: 0,
            armorModifier: 0,
            damagePerTick: 0,
            hpModifier: 0,
            intModifier: 0,
            resistanceStat: ResistanceStat.None,
            strModifier: 0
        });

        // Time-based effect, not in combat
        bool isValid = EffectProcessor.validateEffectApplication(validityData, effectStats, false);
        assertTrue(isValid);

        // Time-based effect, in combat (should be invalid)
        isValid = EffectProcessor.validateEffectApplication(validityData, effectStats, true);
        assertFalse(isValid);

        // Turn-based effect
        validityData.validTime = 0;
        validityData.validTurns = 5;
        isValid = EffectProcessor.validateEffectApplication(validityData, effectStats, true);
        assertTrue(isValid);

        // Turn-based effect, not in combat (should be invalid)
        isValid = EffectProcessor.validateEffectApplication(validityData, effectStats, false);
        assertFalse(isValid);
    }

    function testIsEffectExpiredByTime() public {
        StatusEffectValidityData memory validityData = StatusEffectValidityData({
            cooldown: 0,
            maxStacks: 3,
            validTime: 3600, // 1 hour
            validTurns: 0
        });

        uint256 currentTime = 5000;
        uint256 appliedTime = 2000; // 3000 seconds ago (3000 < 3600, so not expired)
        bool isExpired = EffectProcessor.isEffectExpiredByTime(appliedTime, currentTime, validityData);
        assertFalse(isExpired);

        appliedTime = 0; // 5000 seconds ago (5000 > 3600, so expired)
        isExpired = EffectProcessor.isEffectExpiredByTime(appliedTime, currentTime, validityData);
        assertTrue(isExpired);

        // Turn-based effect should not expire by time
        validityData.validTime = 0;
        validityData.validTurns = 5;
        isExpired = EffectProcessor.isEffectExpiredByTime(appliedTime, currentTime, validityData);
        assertFalse(isExpired);
    }

    function testIsEffectExpiredByTurns() public {
        StatusEffectValidityData memory validityData = StatusEffectValidityData({
            cooldown: 0,
            maxStacks: 3,
            validTime: 0,
            validTurns: 3
        });

        uint256 appliedTurn = 5;
        uint256 currentTurn = 7;
        bool isExpired = EffectProcessor.isEffectExpiredByTurns(appliedTurn, currentTurn, validityData);
        assertFalse(isExpired); // 7 - 5 = 2, which is <= 3, so not expired

        currentTurn = 9;
        isExpired = EffectProcessor.isEffectExpiredByTurns(appliedTurn, currentTurn, validityData);
        assertTrue(isExpired); // 9 - 5 = 4, which is > 3, so expired

        // Time-based effect should not expire by turns
        validityData.validTime = 3600;
        validityData.validTurns = 0;
        isExpired = EffectProcessor.isEffectExpiredByTurns(appliedTurn, currentTurn, validityData);
        assertFalse(isExpired);
    }

    function testCalculateEffectPriority() public {
        StatusEffectStatsData memory effectStats = StatusEffectStatsData({
            agiModifier: 3,
            armorModifier: 0,
            damagePerTick: 0,
            hpModifier: 0,
            intModifier: 2,
            resistanceStat: ResistanceStat.None,
            strModifier: 5
        });

        uint256 priority = EffectProcessor.calculateEffectPriority(effectStats);
        assertEq(priority, 10); // 5 + 3 + 2
    }

    function testEffectIdOperations() public {
        bytes32 effectId = keccak256("test_effect");
        uint256 timestamp = 2000;
        uint256 turnApplied = 5;

        bytes32 appliedEffectId = EffectProcessor.createAppliedEffectId(effectId, timestamp, turnApplied);

        // Test getEffectStatId
        bytes32 extractedId = EffectProcessor.getEffectStatId(appliedEffectId);
        assertEq(extractedId, bytes8(effectId));

        // Test getEffectTimestamp
        uint256 extractedTimestamp = EffectProcessor.getEffectTimestamp(appliedEffectId);
        assertEq(extractedTimestamp, timestamp);

        // Test getEffectTurnApplied
        uint256 extractedTurn = EffectProcessor.getEffectTurnApplied(appliedEffectId);
        assertEq(extractedTurn, turnApplied);

        // Test getEffectExpired (should be 0 initially)
        uint256 expiredTime = EffectProcessor.getEffectExpired(appliedEffectId);
        assertEq(expiredTime, 0);

        // Test isNotExpired
        bool isNotExpired = EffectProcessor.isNotExpired(appliedEffectId);
        assertTrue(isNotExpired);
    }

    function testMarkEffectAsExpired() public {
        bytes32 effectId = keccak256("test_effect");
        uint256 timestamp = 1000;
        uint256 turnApplied = 5;
        uint256 currentTime = 2000;

        bytes32 appliedEffectId = EffectProcessor.createAppliedEffectId(effectId, timestamp, turnApplied);
        bytes32 expiredEffectId = EffectProcessor.markEffectAsExpired(appliedEffectId, currentTime);

        // Should now be expired
        uint256 expiredTime = EffectProcessor.getEffectExpired(expiredEffectId);
        assertTrue(expiredTime > 0);

        // Should not be expired anymore
        bool isNotExpired = EffectProcessor.isNotExpired(expiredEffectId);
        assertFalse(isNotExpired);
    }

    function testGetAppliedEffectInfo() public {
        bytes32 effectId = keccak256("test_effect");
        uint256 timestamp = 1000;
        uint256 turnApplied = 5;

        bytes32 appliedEffectId = EffectProcessor.createAppliedEffectId(effectId, timestamp, turnApplied);

        (
            bytes32 extractedId,
            uint256 extractedTimestamp,
            uint256 extractedExpiredTime,
            uint256 extractedTurn
        ) = EffectProcessor.getAppliedEffectInfo(appliedEffectId);

        assertEq(extractedId, bytes8(effectId));
        assertEq(extractedTimestamp, timestamp);
        assertEq(extractedExpiredTime, 0); // Not expired initially
        assertEq(extractedTurn, turnApplied);
    }
}
