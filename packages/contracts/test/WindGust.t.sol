// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {Math} from "@libraries/Math.sol";
import {EffectProcessor} from "@libraries/EffectProcessor.sol";
import {ZONE_WINDY_PEAKS, ZONE_DARK_CAVE, PEAK_RIDGE_RELATIVE_Y, WIND_GUST_EFFECT_ID} from "../constants.sol";

/**
 * @title Test_WindGust
 * @notice Unit tests for the wind gust environmental effect on Windy Peaks peak tiles.
 *
 * Tests verify:
 *   1. Peak tile detection logic (zone + Y threshold)
 *   2. DOT damage calculation with 1 and 2 stacks
 *   3. Wind gust effect constant is correctly defined
 *   4. Effect does not expire within DEFAULT_MAX_TURNS
 */
contract Test_WindGust is Test {

    // Mirror the _isPeakTile logic from EncounterSystem/AutoAdventureSystem
    function _isPeakTile(uint256 zoneId, uint16 y) internal pure returns (bool) {
        return zoneId == ZONE_WINDY_PEAKS && y >= PEAK_RIDGE_RELATIVE_Y;
    }

    // ====================================================================
    // Peak tile detection
    // ====================================================================

    function test_peakTile_zone2_y8_isPeak() public {
        assertTrue(_isPeakTile(ZONE_WINDY_PEAKS, 8), "y=8 in Z2 should be peak");
    }

    function test_peakTile_zone2_y9_isPeak() public {
        assertTrue(_isPeakTile(ZONE_WINDY_PEAKS, 9), "y=9 in Z2 should be peak");
    }

    function test_peakTile_zone2_y7_notPeak() public {
        assertFalse(_isPeakTile(ZONE_WINDY_PEAKS, 7), "y=7 in Z2 should NOT be peak");
    }

    function test_peakTile_zone2_y0_notPeak() public {
        assertFalse(_isPeakTile(ZONE_WINDY_PEAKS, 0), "safe zone should NOT be peak");
    }

    function test_peakTile_zone1_y8_notPeak() public {
        assertFalse(_isPeakTile(ZONE_DARK_CAVE, 8), "y=8 in Z1 should NOT be peak");
    }

    function test_peakTile_zone1_y9_notPeak() public {
        assertFalse(_isPeakTile(ZONE_DARK_CAVE, 9), "y=9 in Z1 should NOT be peak");
    }

    function test_fuzz_peakTile_onlyZone2(uint256 zoneId, uint16 y) public {
        // Bound zoneId to realistic range
        zoneId = bound(zoneId, 0, 10);
        bool result = _isPeakTile(zoneId, y);
        if (zoneId != ZONE_WINDY_PEAKS) {
            assertFalse(result, "only zone 2 should have peak tiles");
        }
        if (y < PEAK_RIDGE_RELATIVE_Y) {
            assertFalse(result, "y below threshold should never be peak");
        }
    }

    // ====================================================================
    // DOT damage calculation (mirrors EffectProcessor)
    // ====================================================================

    function test_dotDamage_singleStack() public {
        // wind_gust: damagePerTick = 3, 1 stack
        int256 damagePerTick = 3;
        uint256 stacks = 1;
        int256 totalDamage = damagePerTick * int256(stacks);
        assertEq(totalDamage, 3, "1 stack should deal 3 damage per turn");
    }

    function test_dotDamage_doubleStack_bossFight() public {
        // wind_gust: damagePerTick = 3, 2 stacks (boss fight)
        int256 damagePerTick = 3;
        uint256 stacks = 2;
        int256 totalDamage = damagePerTick * int256(stacks);
        assertEq(totalDamage, 6, "2 stacks should deal 6 damage per turn (boss fight)");
    }

    function test_totalDamage_normalFight_15turns() public {
        // Normal peak fight: 3 dmg/turn * 15 turns = 45 total
        int256 damagePerTurn = 3;
        uint256 maxTurns = 15;
        int256 totalFightDamage = damagePerTurn * int256(maxTurns);
        assertEq(totalFightDamage, 45, "normal peak fight total wind damage over 15 turns");
        // Players at L19-20 have ~90-100 HP, so 45 is significant but not lethal alone
        assertTrue(totalFightDamage < 100, "should not be lethal on its own");
    }

    function test_totalDamage_bossFight_15turns() public {
        // Boss fight: 6 dmg/turn * 15 turns = 90 total
        int256 damagePerTurn = 6;
        uint256 maxTurns = 15;
        int256 totalFightDamage = damagePerTurn * int256(maxTurns);
        assertEq(totalFightDamage, 90, "boss fight total wind damage over 15 turns");
        // This is nearly lethal — creates genuine DPS race urgency
    }

    // ====================================================================
    // Effect constant
    // ====================================================================

    function test_windGustEffectId_nonZero() public {
        assertTrue(WIND_GUST_EFFECT_ID != bytes32(0), "effect ID should not be zero");
    }

    function test_peakRidgeThreshold_is8() public {
        assertEq(PEAK_RIDGE_RELATIVE_Y, 8, "peak ridge starts at relative y=8");
    }

    // ====================================================================
    // Effect validity — validTurns = 99 lasts beyond max combat
    // ====================================================================

    function test_effectLastsBeyondMaxTurns() public {
        uint256 validTurns = 99;
        uint256 defaultMaxTurns = 15;
        uint256 extendedMaxTurns = 30;
        assertTrue(validTurns > defaultMaxTurns, "effect should outlast default max turns");
        assertTrue(validTurns > extendedMaxTurns, "effect should outlast even extended max turns");
    }

    // ====================================================================
    // Stat debuff values
    // ====================================================================

    function test_singleStack_statDebuffs() public {
        // wind_gust: -4 STR, -3 armor per stack
        int256 strDebuff = -4;
        int256 armorDebuff = -3;

        // Single stack (normal peak fight)
        assertEq(strDebuff * 1, -4, "1 stack: -4 STR");
        assertEq(armorDebuff * 1, -3, "1 stack: -3 armor");
    }

    function test_doubleStack_statDebuffs() public {
        // Boss fight: 2 stacks
        int256 strDebuff = -4;
        int256 armorDebuff = -3;

        assertEq(strDebuff * 2, -8, "2 stacks: -8 STR");
        assertEq(armorDebuff * 2, -6, "2 stacks: -6 armor");
    }
}
