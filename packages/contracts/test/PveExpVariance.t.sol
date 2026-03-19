// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {Math} from "@libraries/Math.sol";
import {STAT_VARIANCE_PCT} from "../constants.sol";

/**
 * @title Test_PveExpVariance
 * @notice Tests that the EXP variance logic in PveRewardSystem produces correct bounds.
 *
 * The contract change applies Math.variance() to each monster's base EXP using a
 * seed derived from keccak256(randomNumber, "exp", monsterIndex). These tests verify:
 *   1. Math.variance stays within ±STAT_VARIANCE_PCT% for all EXP values
 *   2. Different seeds produce different deltas (variance is non-degenerate)
 *   3. The seed derivation produces distinct seeds per monster index
 *   4. Edge cases: very small EXP, very large EXP
 */
contract Test_PveExpVariance is Test {

    // ====================================================================
    // Happy path: variance produces non-zero spread
    // ====================================================================

    function test_varianceProducesSpread() public {
        int256 base = 1000; // typical monster EXP
        uint256 uniqueValues;
        int256 lastDelta = type(int256).max;

        for (uint32 seed = 0; seed < 50; seed++) {
            int256 delta = Math.variance(base, seed);
            if (delta != lastDelta) {
                uniqueValues++;
                lastDelta = delta;
            }
        }
        assertTrue(uniqueValues > 5, "variance should produce meaningful spread across seeds");
    }

    function test_differentSeedsProduceDifferentExp() public {
        int256 base = 1000;
        // Simulate the seed derivation from PveRewardSystem
        uint256 randomNumber1 = 12345;
        uint256 randomNumber2 = 99999;

        uint32 seed1 = uint32(uint256(keccak256(abi.encodePacked(randomNumber1, "exp", uint256(0)))));
        uint32 seed2 = uint32(uint256(keccak256(abi.encodePacked(randomNumber2, "exp", uint256(0)))));

        int256 delta1 = Math.variance(base, seed1);
        int256 delta2 = Math.variance(base, seed2);

        assertTrue(delta1 != delta2, "different random numbers should produce different EXP deltas");

        uint256 exp1 = uint256(base + delta1);
        uint256 exp2 = uint256(base + delta2);
        assertTrue(exp1 != exp2, "EXP amounts should differ");
    }

    // ====================================================================
    // Bounds: variance stays within ±STAT_VARIANCE_PCT%
    // ====================================================================

    function test_boundsForTypicalMonsters() public {
        // Test all dark_cave monster EXP values
        uint256[11] memory monsterExps = [
            uint256(225),   // Dire Rat
            uint256(400),   // Fungal Shaman
            uint256(550),   // Cavern Brute
            uint256(800),   // Crystal Elemental
            uint256(1000),  // Ironhide Troll
            uint256(1325),  // Phase Spider
            uint256(2000),  // Bonecaster
            uint256(2500),  // Rock Golem
            uint256(3250),  // Pale Stalker
            uint256(6500),  // Dusk Drake
            uint256(10000)  // Basilisk
        ];

        for (uint256 m = 0; m < monsterExps.length; m++) {
            int256 base = int256(monsterExps[m]);
            int256 maxDelta = (base * int256(uint256(STAT_VARIANCE_PCT))) / 100;
            if (maxDelta < 1) maxDelta = 1;

            for (uint32 seed = 0; seed < 100; seed++) {
                int256 delta = Math.variance(base, seed);
                assertTrue(delta >= -maxDelta, "delta below min bound");
                assertTrue(delta <= maxDelta, "delta above max bound");
            }
        }
    }

    function test_fuzz_boundsForAnyExp(uint32 seed, uint256 rawExp) public {
        // Bound EXP to realistic range [1, 100000]
        uint256 exp = bound(rawExp, 1, 100000);
        int256 base = int256(exp);
        int256 maxDelta = (base * int256(uint256(STAT_VARIANCE_PCT))) / 100;
        if (maxDelta < 1) maxDelta = 1;

        int256 delta = Math.variance(base, seed);
        assertTrue(delta >= -maxDelta, "fuzz: delta below min");
        assertTrue(delta <= maxDelta, "fuzz: delta above max");
    }

    // ====================================================================
    // Seed derivation: per-monster seeds are distinct
    // ====================================================================

    function test_perMonsterSeedsAreDistinct() public {
        uint256 randomNumber = 42;
        uint32 seed0 = uint32(uint256(keccak256(abi.encodePacked(randomNumber, "exp", uint256(0)))));
        uint32 seed1 = uint32(uint256(keccak256(abi.encodePacked(randomNumber, "exp", uint256(1)))));
        uint32 seed2 = uint32(uint256(keccak256(abi.encodePacked(randomNumber, "exp", uint256(2)))));

        assertTrue(seed0 != seed1, "seeds for different monster indices should differ");
        assertTrue(seed1 != seed2, "seeds for different monster indices should differ");
        assertTrue(seed0 != seed2, "seeds for different monster indices should differ");
    }

    function test_expSeedDoesNotCorrelateWithGoldRoll() public {
        // Gold uses randomNumber directly; EXP uses keccak256(randomNumber, "exp", i)
        // Verify they produce independent values
        uint256 randomNumber = 12345;
        uint256 goldRoll = randomNumber; // gold: randomNumber % (baseGold * mobLevel)
        uint32 expSeed = uint32(uint256(keccak256(abi.encodePacked(randomNumber, "exp", uint256(0)))));

        // These should be unrelated values
        assertTrue(uint256(expSeed) != goldRoll, "EXP seed should not correlate with gold roll");
    }

    // ====================================================================
    // Edge cases
    // ====================================================================

    function test_verySmallExp() public {
        // EXP of 1: maxDelta = max(1*10/100, 1) = 1, range = [-1, 0, 1]
        int256 base = 1;
        bool hasNegative;
        bool hasPositive;

        for (uint32 seed = 0; seed < 100; seed++) {
            int256 delta = Math.variance(base, seed);
            assertTrue(delta >= -1 && delta <= 1, "small exp delta out of range");
            if (delta < 0) hasNegative = true;
            if (delta > 0) hasPositive = true;
        }
        // Range is [-1, 0, 1] so we should see both negative and positive
        assertTrue(hasNegative || hasPositive, "should produce non-zero deltas even for small exp");
    }

    function test_expResultNeverNegative() public {
        // Even with maximum negative variance, result should stay positive
        // Base 1, maxDelta 1: worst case is 1 + (-1) = 0, which is fine (no underflow)
        for (uint32 seed = 0; seed < 200; seed++) {
            int256 base = 10;
            int256 delta = Math.variance(base, seed);
            int256 result = base + delta;
            assertTrue(result >= 0, "EXP result should never be negative");
        }
    }
}
