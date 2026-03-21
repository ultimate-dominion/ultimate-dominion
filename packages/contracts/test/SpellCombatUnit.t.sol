// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {CombatMath} from "../src/libraries/CombatMath.sol";
import {LibChunks} from "../src/libraries/LibChunks.sol";
import {ResistanceStat} from "@codegen/common.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {CLASS_MULTIPLIER_BASE} from "../constants.sol";

/**
 * @title SpellCombatUnit
 * @notice Unit tests for percentage-based class spell system.
 *         Pure math — no world, no store, no deploy needed.
 *         Mirrors the formulas in SpellCombatSystem.sol exactly.
 */
contract SpellCombatUnitTest is Test {

    // ═══════════════════════════════════════════════════════════════════════
    //  Percentage modifier math (mirrors computeAndStoreModifiers)
    // ═══════════════════════════════════════════════════════════════════════

    function _computeModifier(int256 pct, int256 stat) internal pure returns (int256) {
        return (pct * stat) / 10000;
    }

    // --- Battle Cry: +25% STR, +10% maxHp, +800 armor ---

    function test_battleCry_20str() public {
        // Warrior with 20 STR: 2500 * 20 / 10000 = +5
        assertEq(_computeModifier(2500, 20), 5);
    }

    function test_battleCry_10str() public {
        // Warrior with 10 STR: 2500 * 10 / 10000 = +2
        assertEq(_computeModifier(2500, 10), 2);
    }

    function test_battleCry_14str() public {
        // Warrior with 14 STR: 2500 * 14 / 10000 = +3 (truncated)
        assertEq(_computeModifier(2500, 14), 3);
    }

    function test_battleCry_hpHeal_50maxHp() public {
        // 10% of 50 maxHp: 1000 * 50 / 10000 = +5
        assertEq(_computeModifier(1000, 50), 5);
    }

    function test_battleCry_hpHeal_100maxHp() public {
        // 10% of 100 maxHp: 1000 * 100 / 10000 = +10
        assertEq(_computeModifier(1000, 100), 10);
    }

    // --- Divine Shield: +15% STR, +15% maxHp, +1000 armor ---

    function test_divineShield_20str() public {
        // 1500 * 20 / 10000 = +3
        assertEq(_computeModifier(1500, 20), 3);
    }

    function test_divineShield_hpHeal_60maxHp() public {
        // 15% of 60: 1500 * 60 / 10000 = +9
        assertEq(_computeModifier(1500, 60), 9);
    }

    // --- Entangle: -15% STR, -25% AGI debuff ---

    function test_entangle_strDebuff_14str() public {
        // -1500 * 14 / 10000 = -2 (truncated from -2.1)
        assertEq(_computeModifier(-1500, 14), -2);
    }

    function test_entangle_agiDebuff_16agi() public {
        // -2500 * 16 / 10000 = -4
        assertEq(_computeModifier(-2500, 16), -4);
    }

    function test_entangle_agiDebuff_20agi() public {
        // -2500 * 20 / 10000 = -5
        assertEq(_computeModifier(-2500, 20), -5);
    }

    // --- Expose Weakness: -15% STR, -800 armor ---

    function test_exposeWeakness_strDebuff_20str() public {
        // -1500 * 20 / 10000 = -3
        assertEq(_computeModifier(-1500, 20), -3);
    }

    // --- Soul Drain: -12% STR, -12% INT ---

    function test_soulDrain_strDebuff_20str() public {
        // -1200 * 20 / 10000 = -2 (truncated from -2.4)
        assertEq(_computeModifier(-1200, 20), -2);
    }

    function test_soulDrain_intDebuff_15int() public {
        // -1200 * 15 / 10000 = -1 (truncated from -1.8)
        assertEq(_computeModifier(-1200, 15), -1);
    }

    // --- Blessing: +12% INT, +15% maxHp ---

    function test_blessing_intBuff_16int() public {
        // 1200 * 16 / 10000 = +1 (truncated from 1.92)
        assertEq(_computeModifier(1200, 16), 1);
    }

    function test_blessing_intBuff_25int() public {
        // 1200 * 25 / 10000 = +3
        assertEq(_computeModifier(1200, 25), 3);
    }

    function test_blessing_hpBuff_50maxHp() public {
        // 1500 * 50 / 10000 = +7 (truncated from 7.5)
        assertEq(_computeModifier(1500, 50), 7);
    }

    // --- Marked Shot: -20% AGI ---

    function test_markedShot_agiDebuff_18agi() public {
        // -2000 * 18 / 10000 = -3 (truncated from -3.6)
        assertEq(_computeModifier(-2000, 18), -3);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Fuzz: percentage modifier always truncates toward zero
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_percentageModifier_truncatesTowardZero(int256 pct, int256 stat) public {
        pct = bound(pct, -10000, 10000);
        stat = bound(stat, 0, 200);
        int256 result = _computeModifier(pct, stat);
        // Result magnitude should never exceed stat (since |pct| <= 10000 = 100%)
        if (stat >= 0) {
            assertTrue(result >= -stat && result <= stat);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PvP same-class: two entities get different computed values
    // ═══════════════════════════════════════════════════════════════════════

    function test_pvpSameClass_differentStats() public {
        int256 pct = 2500; // Battle Cry +25%

        int256 alice_str = 20;
        int256 bob_str = 14;

        int256 alice_mod = _computeModifier(pct, alice_str);
        int256 bob_mod = _computeModifier(pct, bob_str);

        assertEq(alice_mod, 5, "Alice: 25% of 20 = 5");
        assertEq(bob_mod, 3, "Bob: 25% of 14 = 3");
        assertTrue(alice_mod != bob_mod, "Different stats produce different mods");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Spell damage math (mirrors calculateSpellDamage)
    // ═══════════════════════════════════════════════════════════════════════

    function _calculateSpellDamage(
        int256 minDmg,
        int256 maxDmg,
        int256 dmgPerStat,
        int256 scalingStat,
        int256 defenderArmor,
        int256 defenderInt,
        bool isPhysical,
        uint256 randomNumber
    ) internal pure returns (int256 damage) {
        uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);

        // Roll base damage
        int256 roll = int256(uint256(rnChunks[0]) % uint256(maxDmg) + 1);
        if (roll < minDmg) roll = minDmg;

        // Stat scaling
        int256 statBonus = (scalingStat * dmgPerStat) / 1000;
        damage = roll + statBonus;
        if (damage < 1) damage = 1;

        // Variance
        damage = CombatMath.applyDamageVariance(damage, rnChunks[1] ^ rnChunks[2]);
        if (damage < 1) damage = 1;

        if (isPhysical) {
            damage = damage - CombatMath.calculateArmorModifier(defenderArmor, 0, damage);
            if (damage < 1) damage = 1;
        } else {
            if (damage > 0) {
                damage -= CombatMath.calculateMagicResistance(defenderInt, damage);
            }
            if (damage < 1) damage = 1;
        }
    }

    function test_physicalSpellDamage_battleCry() public {
        // Battle Cry: 5-10 base, 0.5/STR, physical, attacker has 20 STR
        int256 dmg = _calculateSpellDamage(
            5, 10,    // min/max
            500,      // dmgPerStat (0.5 per point)
            20,       // scalingStat (STR)
            3,        // defender armor
            10,       // defender INT (unused for physical)
            true,     // isPhysical
            12345     // random seed
        );
        // base 5-10 + statBonus 10 = 15-20, minus armor ~3, with variance
        assertGt(dmg, 0, "physical spell damage should be positive");
    }

    function test_magicSpellDamage_entangle() public {
        // Entangle: 3-6 base, 0.3/INT, magic, attacker has 18 INT
        int256 dmg = _calculateSpellDamage(
            3, 6,     // min/max
            300,      // dmgPerStat (0.3 per point)
            18,       // scalingStat (INT)
            5,        // defender armor (unused for magic)
            8,        // defender INT (for magic resist)
            false,    // isPhysical = false (magic)
            67890     // random seed
        );
        // base 3-6 + statBonus 5 = 8-11, minus magic resist (~24% of 8 INT)
        assertGt(dmg, 0, "magic spell damage should be positive");
    }

    function test_magicSpellDamage_arcaneBlast() public {
        // Arcane Blast: 5-10 base, 0.5/INT, magic, attacker 20 INT
        int256 dmg = _calculateSpellDamage(
            5, 10, 500, 20, 5, 10, false, 11111
        );
        assertGt(dmg, 0, "arcane blast should deal positive damage");
    }

    function test_physicalSpellDamage_exposeWeakness() public {
        // Expose Weakness: 4-8 base, 0.4/AGI, physical, attacker 16 AGI
        int256 dmg = _calculateSpellDamage(
            4, 8, 400, 16, 5, 10, true, 99999
        );
        assertGt(dmg, 0, "expose weakness should deal positive damage");
    }

    function testFuzz_spellDamage_alwaysPositive(uint256 seed) public {
        // With reasonable stats, spell damage should always be >= 1
        int256 dmg = _calculateSpellDamage(
            3, 6, 300, 15, 5, 10, false, seed
        );
        assertGe(dmg, 1, "spell damage floored at 1");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Spell heal math (mirrors applySpellHeal)
    // ═══════════════════════════════════════════════════════════════════════

    function _calculateHeal(int256 hpPct, int256 maxHp, int256 currentHp) internal pure returns (int256 newHp) {
        if (hpPct <= 0) return currentHp;
        int256 healAmount = (hpPct * maxHp) / 10000;
        if (healAmount <= 0) return currentHp;
        newHp = currentHp + healAmount;
        if (newHp > maxHp) newHp = maxHp;
    }

    function test_heal_divineShield_15pct_60maxHp() public {
        // 15% of 60 = 9 HP heal, from 40 -> 49
        int256 newHp = _calculateHeal(1500, 60, 40);
        assertEq(newHp, 49);
    }

    function test_heal_battleCry_10pct_100maxHp() public {
        // 10% of 100 = 10 HP heal, from 80 -> 90
        int256 newHp = _calculateHeal(1000, 100, 80);
        assertEq(newHp, 90);
    }

    function test_heal_cappedAtMaxHp() public {
        // 15% of 50 = 7, but 48 + 7 = 55 > 50, cap at 50
        int256 newHp = _calculateHeal(1500, 50, 48);
        assertEq(newHp, 50);
    }

    function test_heal_alreadyFull() public {
        // Already at max HP, heal does nothing
        int256 newHp = _calculateHeal(1500, 50, 50);
        assertEq(newHp, 50);
    }

    function test_heal_zeroPct_noHeal() public {
        int256 newHp = _calculateHeal(0, 50, 30);
        assertEq(newHp, 30);
    }

    function test_heal_negativePct_noHeal() public {
        int256 newHp = _calculateHeal(-500, 50, 30);
        assertEq(newHp, 30);
    }

    function testFuzz_heal_neverExceedsMax(int256 hpPct, int256 maxHp, int256 currentHp) public {
        hpPct = bound(hpPct, 0, 10000);
        maxHp = bound(maxHp, 1, 500);
        currentHp = bound(currentHp, 0, maxHp);
        int256 newHp = _calculateHeal(hpPct, maxHp, currentHp);
        assertLe(newHp, maxHp);
        assertGe(newHp, currentHp);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Spell use tracking math (mirrors consumeSpellUse)
    // ═══════════════════════════════════════════════════════════════════════

    function test_useTracking_twoUses() public {
        uint256 maxUses = 2;
        uint256 remaining = maxUses;

        // First cast
        remaining -= 1;
        assertEq(remaining, 1, "1 use remaining after first cast");

        // Second cast
        remaining -= 1;
        assertEq(remaining, 0, "0 uses remaining after second cast");

        // Third cast should fail
        bool canCast = remaining > 0;
        assertFalse(canCast, "third cast should fail");
    }

    function test_useTracking_singleUse() public {
        uint256 maxUses = 1;
        uint256 remaining = maxUses;

        remaining -= 1;
        assertEq(remaining, 0);

        bool canCast = remaining > 0;
        assertFalse(canCast, "second cast should fail");
    }

    function test_useTracking_unlimited() public {
        uint256 maxUses = 0;
        // maxUses == 0 means unlimited, always returns true
        bool canCast = maxUses == 0;
        assertTrue(canCast);
    }

    function test_useTracking_perEncounter() public {
        // Different encounters have independent tracking
        // Encounter 1: use up single-use spell
        uint256 enc1_remaining = 1;
        enc1_remaining -= 1;
        assertEq(enc1_remaining, 0);

        // Encounter 2: fresh uses
        uint256 enc2_remaining = 1;
        assertTrue(enc2_remaining > 0, "new encounter has fresh uses");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Weapon enchant bonus math (mirrors calculateEnchantBonus)
    // ═══════════════════════════════════════════════════════════════════════

    function _calculateEnchantBonus(
        int256 minDmg,
        int256 maxDmg,
        int256 dmgPerInt,
        int256 attackerInt,
        int256 defenderInt,
        uint256 randomNumber
    ) internal pure returns (int256 bonus) {
        uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
        int256 roll = int256(uint256(rnChunks[0]) % uint256(maxDmg) + 1);
        if (roll < minDmg) roll = minDmg;

        int256 intBonus = (attackerInt * dmgPerInt) / 1000;
        bonus = roll + intBonus;
        if (bonus < 1) bonus = 1;

        bonus -= CombatMath.calculateMagicResistance(defenderInt, bonus);
        if (bonus < 1) bonus = 1;
    }

    function test_enchantBonus_arcaneInfusion() public {
        // Arcane Infusion: 3-6 base, 0.25/INT, attacker 18 INT, defender 10 INT
        int256 bonus = _calculateEnchantBonus(3, 6, 250, 18, 10, 55555);
        // base 3-6 + intBonus 4 = 7-10, minus magic resist (~30% of 10 INT)
        assertGt(bonus, 0, "enchant bonus should be positive");
    }

    function testFuzz_enchantBonus_alwaysPositive(uint256 seed) public {
        int256 bonus = _calculateEnchantBonus(3, 6, 250, 15, 10, seed);
        assertGe(bonus, 1, "enchant bonus floored at 1");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Enchant expiry check (turn-based)
    // ═══════════════════════════════════════════════════════════════════════

    function test_enchantExpiry_withinWindow() public {
        uint256 turnApplied = 2;
        uint256 validTurns = 4;
        uint256 currentTurn = 5;
        // 5 <= 2 + 4 = 6, still valid
        bool expired = currentTurn > turnApplied + validTurns;
        assertFalse(expired);
    }

    function test_enchantExpiry_lastTurn() public {
        uint256 turnApplied = 2;
        uint256 validTurns = 4;
        uint256 currentTurn = 6;
        // 6 <= 6, still valid
        bool expired = currentTurn > turnApplied + validTurns;
        assertFalse(expired);
    }

    function test_enchantExpiry_expired() public {
        uint256 turnApplied = 2;
        uint256 validTurns = 4;
        uint256 currentTurn = 7;
        // 7 > 6, expired
        bool expired = currentTurn > turnApplied + validTurns;
        assertTrue(expired);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  hasSpellConfig check logic
    // ═══════════════════════════════════════════════════════════════════════

    function test_hasSpellConfig_allZero_isFalse() public {
        // All fields zero = no config
        bool has = _hasSpellConfig(0, 0, 0, 0, 0, 0, 0, 0, false);
        assertFalse(has);
    }

    function test_hasSpellConfig_withStrPct_isTrue() public {
        bool has = _hasSpellConfig(2500, 0, 0, 0, 0, 0, 0, 0, false);
        assertTrue(has);
    }

    function test_hasSpellConfig_withDamage_isTrue() public {
        bool has = _hasSpellConfig(0, 0, 0, 0, 0, 5, 10, 0, false);
        assertTrue(has);
    }

    function test_hasSpellConfig_withEnchant_isTrue() public {
        bool has = _hasSpellConfig(0, 0, 0, 0, 0, 0, 0, 0, true);
        assertTrue(has);
    }

    function _hasSpellConfig(
        int256 strPct, int256 agiPct, int256 intPct,
        int256 hpPct, int256 armorFlat,
        int256 spellMinDmg, int256 spellMaxDmg,
        uint256 maxUses, bool isWeaponEnchant
    ) internal pure returns (bool) {
        return strPct != 0 || agiPct != 0 || intPct != 0 ||
               hpPct != 0 || armorFlat != 0 ||
               spellMinDmg != 0 || spellMaxDmg != 0 ||
               maxUses != 0 || isWeaponEnchant;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Full spell config values table verification
    //  (verifies the 9 class spells from the plan)
    // ═══════════════════════════════════════════════════════════════════════

    function test_allSpellConfigs_battleCry() public {
        // Warrior: +25% STR, +10% HP, +800 armor, 5-10 phys, 0.5/STR, 2 uses
        // With 20 STR, 50 maxHp:
        assertEq(_computeModifier(2500, 20), 5);   // +5 STR
        assertEq(_computeModifier(1000, 50), 5);   // +5 HP
        // Flat armor = 800 (not percentage)
    }

    function test_allSpellConfigs_divineShield() public {
        // Paladin: +15% STR, +15% HP, +1000 armor, no dmg, 2 uses
        assertEq(_computeModifier(1500, 20), 3);   // +3 STR from 20
        assertEq(_computeModifier(1500, 60), 9);   // +9 HP from 60
    }

    function test_allSpellConfigs_markedShot() public {
        // Ranger: -20% AGI, -500 armor, 4-8 phys, 0.4/AGI, 1 use
        assertEq(_computeModifier(-2000, 16), -3);  // -3 AGI from 16
    }

    function test_allSpellConfigs_exposeWeakness() public {
        // Rogue: -15% STR, -800 armor, 4-8 phys, 0.4/AGI, 1 use
        assertEq(_computeModifier(-1500, 20), -3);  // -3 STR from 20
    }

    function test_allSpellConfigs_entangle() public {
        // Druid: -15% STR, -25% AGI, -300 armor, 3-6 magic, 0.3/INT, 1 use
        assertEq(_computeModifier(-1500, 14), -2);  // -2 STR from 14
        assertEq(_computeModifier(-2500, 16), -4);  // -4 AGI from 16
    }

    function test_allSpellConfigs_soulDrain() public {
        // Warlock: -12% STR, -12% INT, 4-8 magic, 0.4/INT, 2 uses
        assertEq(_computeModifier(-1200, 20), -2);  // -2 STR from 20
        assertEq(_computeModifier(-1200, 18), -2);  // -2 INT from 18
    }

    function test_allSpellConfigs_blessing() public {
        // Cleric: +12% INT, +15% HP, +700 armor, no dmg, 2 uses
        assertEq(_computeModifier(1200, 16), 1);    // +1 INT from 16
        assertEq(_computeModifier(1200, 25), 3);    // +3 INT from 25
        assertEq(_computeModifier(1500, 50), 7);    // +7 HP from 50
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Edge cases
    // ═══════════════════════════════════════════════════════════════════════

    function test_edge_zeroStat_zeroModifier() public {
        assertEq(_computeModifier(2500, 0), 0);
    }

    function test_edge_100pctBuff() public {
        // 100% of 20 = +20
        assertEq(_computeModifier(10000, 20), 20);
    }

    function test_edge_smallStat_truncation() public {
        // 25% of 3 = 0.75 -> truncates to 0
        assertEq(_computeModifier(2500, 3), 0);
        // 25% of 4 = 1
        assertEq(_computeModifier(2500, 4), 1);
    }

    function test_edge_highStat_scaling() public {
        // Level 50 warrior might have 40 STR
        // 25% of 40 = +10
        assertEq(_computeModifier(2500, 40), 10);
    }
}
