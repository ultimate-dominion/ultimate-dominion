// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {Math} from "@libraries/Math.sol";
import {STAT_VARIANCE_PCT, ELITE_REWARD_MULTIPLIER} from "../constants.sol";

/**
 * @title Test_StatCorrelatedXp
 * @notice Tests that spawned monster XP is derived from stat power, not independent variance.
 *
 * The contract formula (MobSystem.spawnMob):
 *   spawnedPower = strength + agility + intelligence + maxHp  (after variance)
 *   templatePower = template STR + AGI + INT + HP
 *   derivedXp = templateXp * spawnedPower / templatePower
 *   if (derivedXp < 1) derivedXp = 1
 *   [elite: derivedXp * ELITE_REWARD_MULTIPLIER / 100]
 */
contract Test_StatCorrelatedXp is Test {

    // Mirror the contract's XP derivation formula
    function _deriveXp(
        int256 spawnedStr, int256 spawnedAgi, int256 spawnedInt, int256 spawnedHp,
        int256 templateStr, int256 templateAgi, int256 templateInt, int256 templateHp,
        uint256 templateXp
    ) internal pure returns (uint256) {
        int256 spawnedPower = spawnedStr + spawnedAgi + spawnedInt + spawnedHp;
        int256 templatePower = templateStr + templateAgi + templateInt + templateHp;
        if (templatePower <= 0) templatePower = 1;
        int256 derivedXp = int256(templateXp) * spawnedPower / templatePower;
        if (derivedXp < 1) derivedXp = 1;
        return uint256(derivedXp);
    }

    // ====================================================================
    // Happy path: average stats produce base XP
    // ====================================================================

    function test_averageStatsGiveBaseXp() public {
        // Giant Rat: STR=8, AGI=6, INT=3, HP=20, XP=70
        uint256 xp = _deriveXp(8, 6, 3, 20, 8, 6, 3, 20, 70);
        assertEq(xp, 70, "no variance should give exact template XP");
    }

    function test_averageStatsGiveBaseXp_highLevel() public {
        // Umber Hulk: STR=34, AGI=26, INT=27, HP=47, XP=4000
        uint256 xp = _deriveXp(34, 26, 27, 47, 34, 26, 27, 47, 4000);
        assertEq(xp, 4000, "no variance should give exact template XP");
    }

    // ====================================================================
    // High stats = more XP
    // ====================================================================

    function test_highStatsGiveMoreXp() public {
        // Giant Rat template: STR=8, AGI=6, INT=3, HP=20, templatePower=37, XP=70
        // All stats at +25%: STR=10, AGI=8, INT=4, HP=25, spawnedPower=47
        uint256 xp = _deriveXp(10, 8, 4, 25, 8, 6, 3, 20, 70);
        // 70 * 47 / 37 = 88
        assertEq(xp, 88, "high-rolled stats should give more XP");
        assertTrue(xp > 70, "XP should exceed template for high-stat spawn");
    }

    // ====================================================================
    // Low stats = less XP
    // ====================================================================

    function test_lowStatsGiveLessXp() public {
        // Giant Rat all stats at -25%: STR=6, AGI=5, INT=2, HP=15, spawnedPower=28
        uint256 xp = _deriveXp(6, 5, 2, 15, 8, 6, 3, 20, 70);
        // 70 * 28 / 37 = 52
        assertEq(xp, 52, "low-rolled stats should give less XP");
        assertTrue(xp < 70, "XP should be below template for low-stat spawn");
    }

    // ====================================================================
    // Fuzz: XP never zero
    // ====================================================================

    function test_fuzz_xpNeverZero(uint32 s1, uint32 s2, uint32 s3, uint32 s4) public {
        // Giant Rat template
        int256 tStr = 8; int256 tAgi = 6; int256 tInt = 3; int256 tHp = 20;
        uint256 tXp = 70;

        int256 strVar = Math.variance(tStr, s1);
        int256 agiVar = Math.variance(tAgi, s2);
        int256 intVar = Math.variance(tInt, s3);
        int256 hpVar = Math.variance(tHp, s4);

        uint256 xp = _deriveXp(
            tStr + strVar, tAgi + agiVar, tInt + intVar, tHp + hpVar,
            tStr, tAgi, tInt, tHp, tXp
        );
        assertTrue(xp >= 1, "derived XP must always be >= 1");
    }

    // ====================================================================
    // Fuzz: XP stays within reasonable bounds
    // ====================================================================

    function test_fuzz_xpBoundsWithVariance(uint32 s1, uint32 s2, uint32 s3, uint32 s4) public {
        // Umber Hulk: STR=34, AGI=26, INT=27, HP=47, XP=4000
        int256 tStr = 34; int256 tAgi = 26; int256 tInt = 27; int256 tHp = 47;
        uint256 tXp = 4000;

        int256 strVar = Math.variance(tStr, s1);
        int256 agiVar = Math.variance(tAgi, s2);
        int256 intVar = Math.variance(tInt, s3);
        int256 hpVar = Math.variance(tHp, s4);

        uint256 xp = _deriveXp(
            tStr + strVar, tAgi + agiVar, tInt + intVar, tHp + hpVar,
            tStr, tAgi, tInt, tHp, tXp
        );

        // Worst case: all 4 stats at -25% -> 75% power -> 75% XP = 3000
        // Best case: all 4 stats at +25% -> 125% power -> 125% XP = 5000
        // Integer truncation can push floor slightly below 75%
        assertTrue(xp >= (tXp * 74 / 100), "XP should not drop below ~74% of template");
        assertTrue(xp <= (tXp * 126 / 100), "XP should not exceed ~126% of template");
    }

    // ====================================================================
    // HP-dominant monster: HP variance drives XP
    // ====================================================================

    function test_hpDominantMonster() public {
        // Hypothetical: STR=2, AGI=2, INT=2, HP=100, templatePower=106, XP=500
        // HP rolls +25% (125), others stay: spawnedPower=131
        uint256 xpHighHp = _deriveXp(2, 2, 2, 125, 2, 2, 2, 100, 500);
        // HP rolls -25% (75), others stay: spawnedPower=81
        uint256 xpLowHp = _deriveXp(2, 2, 2, 75, 2, 2, 2, 100, 500);

        // 500 * 131 / 106 = 617
        // 500 * 81 / 106 = 382
        assertTrue(xpHighHp > 600, "high HP should drive XP up significantly");
        assertTrue(xpLowHp < 400, "low HP should drive XP down significantly");
        assertTrue(xpHighHp > xpLowHp, "higher HP should always mean more XP");
    }

    // ====================================================================
    // Edge case: templatePower zero (safety guard)
    // ====================================================================

    function test_templatePowerZeroSafety() public {
        // All template stats 0 — should not revert, should return >= 1
        uint256 xp = _deriveXp(1, 1, 1, 1, 0, 0, 0, 0, 100);
        assertTrue(xp >= 1, "zero templatePower should not revert");
    }

    // ====================================================================
    // Elite multiplier applies to derived XP, not template
    // ====================================================================

    function test_eliteAppliesAfterDerivation() public {
        // Giant Rat high roll: derived XP = 88 (from test_highStatsGiveMoreXp)
        uint256 derivedXp = _deriveXp(10, 8, 4, 25, 8, 6, 3, 20, 70);
        uint256 eliteXp = derivedXp * ELITE_REWARD_MULTIPLIER / 100;

        // 88 * 150 / 100 = 132
        assertEq(eliteXp, 132, "elite should multiply derived XP");
        // Verify it's NOT 70 * 1.5 = 105 (template * elite)
        assertTrue(eliteXp != 105, "elite should NOT multiply template XP");
    }

    // ====================================================================
    // Correlation: stronger spawn always gives more XP
    // ====================================================================

    function test_strongerSpawnAlwaysGivesMoreXp() public {
        int256 tStr = 8; int256 tAgi = 6; int256 tInt = 3; int256 tHp = 20;
        uint256 tXp = 70;

        // Weak roll
        uint256 weakXp = _deriveXp(6, 5, 2, 15, tStr, tAgi, tInt, tHp, tXp);
        // Average roll
        uint256 avgXp = _deriveXp(8, 6, 3, 20, tStr, tAgi, tInt, tHp, tXp);
        // Strong roll
        uint256 strongXp = _deriveXp(10, 8, 4, 25, tStr, tAgi, tInt, tHp, tXp);

        assertTrue(strongXp > avgXp, "strong > average");
        assertTrue(avgXp > weakXp, "average > weak");
    }

    // ====================================================================
    // All Z1 monsters: verify derived XP is sane
    // ====================================================================

    function test_allZ1Monsters_averageGivesTemplateXp() public {
        // Template stats for all Z1 monsters (from monsters.json)
        // [STR, AGI, INT, HP, XP]
        int256[5][10] memory z1 = [
            [int256(8),  6,  3, 20,  70],   // Giant Rat
            [int256(2),  2,  8, 18,  60],   // Green Slime
            [int256(5), 10,  6, 22,  80],   // Kobold Scout
            [int256(4),  4, 12, 21, 100],   // Gray Ooze
            [int256(12), 6,  6, 26, 120],   // Cave Goblin
            [int256(8), 12,  6, 25, 135],   // Giant Bat
            [int256(15), 8,  7, 29, 150],   // Skeleton
            [int256(12),13,  7, 28, 155],   // Giant Spider
            [int256(9), 10, 15, 30, 205],   // Fire Beetle
            [int256(18), 9, 10, 32, 215]    // Orc Grunt
        ];

        for (uint256 i = 0; i < z1.length; i++) {
            uint256 xp = _deriveXp(
                z1[i][0], z1[i][1], z1[i][2], z1[i][3],
                z1[i][0], z1[i][1], z1[i][2], z1[i][3],
                uint256(z1[i][4])
            );
            assertEq(xp, uint256(z1[i][4]), "average stats should give exact template XP");
        }
    }
}
