// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {CombatMath} from "../src/libraries/CombatMath.sol";
import {PhysicalDamageStatsData, MagicDamageStatsData, WeaponStatsData, ConsumableStatsData} from "@codegen/index.sol";
import {ResistanceStat} from "@codegen/common.sol";
import {ATTACK_MODIFIER, AGI_ATTACK_MODIFIER, EVASION_CAP, DOUBLE_STRIKE_CAP} from "../constants.sol";

contract CombatMathTest is Test {
    function testCalculateToHit() public {
        // Test basic hit calculation
        (bool hit, bool crit) = CombatMath.calculateToHit(
            50, // attackRoll
            0,  // attackModifierBonus
            0,  // critChanceBonus
            10, // attackerStat
            5   // defenderStat
        );

        // With attacker stat higher than defender, should hit
        assertTrue(hit);
    }

    function testCalculateArmorModifier() public {
        int256 armor = 10;
        int256 armorPenetration = 2;
        int256 damage = 15;

        int256 armorModifier = CombatMath.calculateArmorModifier(armor, armorPenetration, damage);

        // Should reduce damage by (10-2) = 8
        assertEq(armorModifier, 8);
    }

    function testCalculateWeaponDamage() public {
        PhysicalDamageStatsData memory attackStats = PhysicalDamageStatsData({
            attackModifierBonus: 0,
            critChanceBonus: 0,
            bonusDamage: 5,
            armorPenetration: 0
        });

        WeaponStatsData memory weapon = WeaponStatsData({
            agiModifier: 0,
            intModifier: 0,
            hpModifier: 0,
            maxDamage: 20,
            minDamage: 10,
            minLevel: 1,
            strModifier: 0,
            effects: new bytes32[](0)
        });

        int256 damage = CombatMath.calculateWeaponDamage(
            attackStats,
            15, // attackerStat
            10, // defenderStat
            weapon,
            12345, // randomNumber
            false, // crit
            ATTACK_MODIFIER
        );

        // Should be positive damage
        assertTrue(damage > 0);
    }

    function testWeaponDamageAgiScaling() public {
        PhysicalDamageStatsData memory attackStats = PhysicalDamageStatsData({
            attackModifierBonus: 0,
            critChanceBonus: 0,
            bonusDamage: 0,
            armorPenetration: 0
        });

        WeaponStatsData memory weapon = WeaponStatsData({
            agiModifier: 0,
            intModifier: 0,
            hpModifier: 0,
            maxDamage: 20,
            minDamage: 10,
            minLevel: 1,
            strModifier: 0,
            effects: new bytes32[](0)
        });

        // STR scaling (1.2x)
        int256 strDamage = CombatMath.calculateWeaponDamage(
            attackStats, 15, 10, weapon, 12345, false, ATTACK_MODIFIER
        );

        // AGI scaling (1.0x — V3 changed from 0.9x)
        int256 agiDamage = CombatMath.calculateWeaponDamage(
            attackStats, 15, 10, weapon, 12345, false, AGI_ATTACK_MODIFIER
        );

        // V3: AGI modifier is 1.0, STR is 1.2. STR should still do more damage.
        assertTrue(strDamage >= agiDamage);
        assertTrue(agiDamage > 0);

        // Verify AGI_ATTACK_MODIFIER is now 1.0 ether
        assertEq(AGI_ATTACK_MODIFIER, 1.0 ether);
    }

    function testCalculateMagicDamage() public {
        MagicDamageStatsData memory attackStats = MagicDamageStatsData({
            attackModifierBonus: 0,
            bonusDamage: 3,
            critChanceBonus: 0
        });

        ConsumableStatsData memory consumable = ConsumableStatsData({
            minDamage: 8,
            maxDamage: 16,
            minLevel: 1,
            effects: new bytes32[](0)
        });

        int256 damage = CombatMath.calculateMagicDamage(
            attackStats,
            consumable,
            54321, // rnChunk
            12, // attackerIntelligence
            8,  // defenderIntelligence
            false, // crit
            ATTACK_MODIFIER
        );

        // Should be positive damage
        assertTrue(damage > 0);
    }

    function testAddStatBonus_AttackerAdvantage() public {
        // attackerStat=15, defenderStat=10, baseDamage=5 WAD
        // baseDiff = 15*1.2e18 - 10*1e18 = 18e18 - 10e18 = 8e18
        // damage = (8e18/2 + 5e18) / 1e18 = 9e18 / 1e18 = 9
        int256 damage = CombatMath.addStatBonus(15, 10, 5 ether, ATTACK_MODIFIER);
        assertEq(damage, 9);
    }

    function testAddStatBonus_DefenderAdvantage_PenaltyApplied() public {
        // Cavern Brute scenario: attacker STR=9, defender STR=12
        // baseDamage = 2 * 1.2e18 = 2.4e18 (weapon roll of 2 with ATTACK_MODIFIER)
        // baseDiff = 9*1.2e18 - 12*1e18 = 10.8e18 - 12e18 = -1.2e18
        // damage = (2.4e18 + (-1.2e18/2)) / 1e18 = (2.4e18 - 0.6e18) / 1e18 = 1.8e18 / 1e18 = 1
        int256 damage = CombatMath.addStatBonus(9, 12, 2.4 ether, ATTACK_MODIFIER);
        assertEq(damage, 1);
    }

    function testAddStatBonus_DefenderAdvantage_FloorAt1() public {
        // Big defender advantage with small weapon: should floor at 1
        // attacker=5, defender=20, baseDamage=1.2e18
        // baseDiff = 5*1.2e18 - 20*1e18 = 6e18 - 20e18 = -14e18
        // damage = (1.2e18 + (-14e18/2)) / 1e18 = (1.2e18 - 7e18) / 1e18 = -5.8e18 -> floor at 1
        int256 damage = CombatMath.addStatBonus(5, 20, 1.2 ether, ATTACK_MODIFIER);
        assertEq(damage, 1);
    }

    function testAddStatBonus_EqualStats() public {
        // Equal stats: no bonus or penalty, just base damage
        // attacker=10, defender=10, baseDamage=3.6e18
        // baseDiff = 10*1.2e18 - 10*1e18 = 12e18 - 10e18 = 2e18 > 0 (attacker gets slight edge from 1.2x modifier)
        int256 damage = CombatMath.addStatBonus(10, 10, 3.6 ether, ATTACK_MODIFIER);
        assertTrue(damage >= 3, "equal stats with 1.2x modifier should give slight bonus");
    }

    function testAddStatBonus_ModerateDefenderAdvantage_NotIgnored() public {
        // Previously this fell into the dead zone (no penalty). Now penalty always applies.
        // attacker=9, defender=14, baseDamage=2.4e18
        // baseDiff = 9*1.2e18 - 14*1e18 = 10.8e18 - 14e18 = -3.2e18
        // damage = (2.4e18 + (-3.2e18/2)) / 1e18 = (2.4e18 - 1.6e18) / 1e18 = 0.8e18 / 1e18 = 0 -> floor at 1
        int256 damage = CombatMath.addStatBonus(9, 14, 2.4 ether, ATTACK_MODIFIER);
        assertEq(damage, 1);
    }

    function testAddStatBonus_SmallDefenderAdvantage() public {
        // attacker=10, defender=13, baseDamage=6e18
        // baseDiff = 10*1.2e18 - 13*1e18 = 12e18 - 13e18 = -1e18
        // damage = (6e18 + (-1e18/2)) / 1e18 = 5.5e18 / 1e18 = 5
        int256 damage = CombatMath.addStatBonus(10, 13, 6 ether, ATTACK_MODIFIER);
        assertEq(damage, 5);
    }

    function testGetStatModifier() public {
        uint256 statModifier = CombatMath.getStatModifier(20, 5);

        // Should be positive modifier
        assertTrue(statModifier > 0);
    }

    function testCalculateStatusEffectHit() public {
        bool hit = CombatMath.calculateStatusEffectHit(
            50, // attackRoll
            0,  // attackModifierBonus
            0,  // critChanceBonus
            10, // attackerStat
            5,  // defenderStat
            ResistanceStat.Strength
        );

        // Should hit with higher attacker stat
        assertTrue(hit);
    }

    function testApplyCriticalHit() public {
        int256 damage = 100;

        int256 critDamage = CombatMath.applyCriticalHit(damage, true);

        // Should double damage on crit
        assertEq(critDamage, damage * 2);

        int256 normalDamage = CombatMath.applyCriticalHit(damage, false);

        // Should be same damage without crit
        assertEq(normalDamage, damage);
    }

    function testCalculateFinalPhysicalDamage() public {
        int256 baseDamage = 100 ether; // Use WAD units
        int256 armor = 20;
        int256 armorPenetration = 5;
        bool crit = true;

        int256 finalDamage = CombatMath.calculateFinalPhysicalDamage(
            baseDamage,
            armor,
            armorPenetration,
            crit
        );

        // Should be positive damage
        assertTrue(finalDamage > 0);

        // Test without crit
        int256 normalDamage = CombatMath.calculateFinalPhysicalDamage(
            baseDamage,
            armor,
            armorPenetration,
            false
        );

        // Normal damage should be less than crit damage
        assertTrue(normalDamage < finalDamage);
    }

    function testCalculateFinalMagicDamage() public {
        int256 baseDamage = 50;
        int256 currentHp = 80;
        int256 maxHp = 100;
        bool crit = false;

        int256 finalDamage = CombatMath.calculateFinalMagicDamage(
            baseDamage,
            currentHp,
            maxHp,
            crit
        );

        // Should be positive damage
        assertTrue(finalDamage > 0);
    }

    // === AGI/INT rebalance tests ===

    function testAgiCritBonus() public {
        // Positive AGI should give crit bonus
        int256 bonus = CombatMath.calculateAgiCritBonus(20);
        assertEq(bonus, 5); // 20 / 4 = 5

        // Zero AGI should give no bonus
        assertEq(CombatMath.calculateAgiCritBonus(0), 0);

        // Negative AGI should give no bonus
        assertEq(CombatMath.calculateAgiCritBonus(-5), 0);
    }

    function testEvasionDodge() public {
        // Defender AGI > Attacker AGI: chance to dodge
        // defAGI=20, atkAGI=10, diff=10 -> dodge chance = 10*2 = 20%
        // Equal STR: no STR reduction
        // rnChunk=15 -> 15%100=15 < 20 -> dodge
        assertTrue(CombatMath.calculateEvasionDodge(20, 10, 10, 10, 15));

        // rnChunk=50 -> 50%100=50, not < 20 -> no dodge
        assertFalse(CombatMath.calculateEvasionDodge(20, 10, 10, 10, 50));

        // Equal AGI: no dodge possible
        assertFalse(CombatMath.calculateEvasionDodge(10, 10, 10, 10, 0));

        // Lower defender AGI: no dodge
        assertFalse(CombatMath.calculateEvasionDodge(5, 10, 10, 10, 0));
    }

    function testEvasionDodgeCap_V3() public {
        // Evasion cap is 35
        assertEq(EVASION_CAP, 35);

        // defAGI=200, atkAGI=0, diff=200 -> uncapped=400, capped=35
        // Equal STR: no STR reduction
        // rnChunk=34 -> 34 < 35 -> dodge (within cap)
        assertTrue(CombatMath.calculateEvasionDodge(200, 0, 10, 10, 34));
        // rnChunk=35 -> 35 < 35 is false -> no dodge (cap works)
        assertFalse(CombatMath.calculateEvasionDodge(200, 0, 10, 10, 35));
    }

    function testEvasionDodge_STRReduction() public {
        // defAGI=20, atkAGI=10, diff=10 -> base dodge = 10*2 = 20%
        // atkSTR=20, defSTR=10, strDiff=10 -> reduction=10
        // effective dodge = 20 - 10 = 10%
        // rnChunk=9 -> 9 < 10 -> dodge
        assertTrue(CombatMath.calculateEvasionDodge(20, 10, 20, 10, 9));
        // rnChunk=10 -> 10 < 10 is false -> no dodge
        assertFalse(CombatMath.calculateEvasionDodge(20, 10, 20, 10, 10));
    }

    function testEvasionDodge_STRReductionCap() public {
        // STR reduction capped at 15
        // defAGI=30, atkAGI=10, diff=20 -> base dodge = 20*2 = 40
        // atkSTR=50, defSTR=10, strDiff=40 -> reduction=min(40,15)=15
        // dodge after STR = 40 - 15 = 25 (below evasion cap 35, no cap applied)
        // effective dodge = 25%
        assertTrue(CombatMath.calculateEvasionDodge(30, 10, 50, 10, 24));
        assertFalse(CombatMath.calculateEvasionDodge(30, 10, 50, 10, 25));
    }

    function testEvasionDodge_STRCanEliminateDodge() public {
        // defAGI=13, atkAGI=10, diff=3 -> base dodge = 3*2 = 6%
        // atkSTR=20, defSTR=10, strDiff=10 -> reduction=10
        // 10 >= 6 -> return false immediately (dodge eliminated)
        assertFalse(CombatMath.calculateEvasionDodge(13, 10, 20, 10, 0));
    }

    function testEvasionDodge_NegativeSTR() public {
        // Negative attacker STR should not cause underflow or weird behavior
        // defAGI=15, atkAGI=10, diff=5 -> base dodge = 10%
        // atkSTR=-5, defSTR=10: attacker STR not > defender STR, no reduction
        // rnChunk=5 -> 5 < 10 -> dodge
        assertTrue(CombatMath.calculateEvasionDodge(15, 10, -5, 10, 5));
        // rnChunk=10 -> 10 < 10 is false -> no dodge
        assertFalse(CombatMath.calculateEvasionDodge(15, 10, -5, 10, 10));
    }

    function testEvasionDodge_ZeroSTRBothSides() public {
        // defAGI=15, atkAGI=10, diff=5 -> base dodge = 10%
        // atkSTR=0, defSTR=0: no reduction (not >)
        assertTrue(CombatMath.calculateEvasionDodge(15, 10, 0, 0, 9));
        assertFalse(CombatMath.calculateEvasionDodge(15, 10, 0, 0, 10));
    }

    function testEvasionDodge_ExactZeroAfterSTR() public {
        // defAGI=15, atkAGI=10, diff=5 -> base dodge = 10%
        // atkSTR=20, defSTR=10, strDiff=10 -> reduction=10
        // 10 >= 10 -> return false (dodge exactly eliminated)
        assertFalse(CombatMath.calculateEvasionDodge(15, 10, 20, 10, 0));
    }

    function testEvasionDodge_OneAGIDifference() public {
        // defAGI=11, atkAGI=10, diff=1 -> base dodge = 2%
        // Equal STR: no reduction
        assertTrue(CombatMath.calculateEvasionDodge(11, 10, 10, 10, 1));
        assertFalse(CombatMath.calculateEvasionDodge(11, 10, 10, 10, 2));
    }

    function testDoubleStrike_OneAGIDifference() public {
        // atkAGI=11, defAGI=10, diff=1 -> chance = 1*3 = 3%
        assertTrue(CombatMath.calculateDoubleStrike(11, 10, 2));
        assertFalse(CombatMath.calculateDoubleStrike(11, 10, 3));
    }

    function testBlock_ExactlySTR10() public {
        // STR=10: (10-10)*2 = 0%, never blocks
        assertFalse(CombatMath.calculateBlock(10, 0));
    }

    function testDoubleStrike() public {
        // Attacker AGI > Defender AGI: chance to double strike
        // atkAGI=20, defAGI=10, diff=10 -> chance = 10*3 = 30%
        // rnChunk=25 -> 25%100=25 < 30 -> triggers
        assertTrue(CombatMath.calculateDoubleStrike(20, 10, 25));

        // rnChunk=50 -> 50 < 30 false -> no trigger
        assertFalse(CombatMath.calculateDoubleStrike(20, 10, 50));

        // Equal AGI: no double strike
        assertFalse(CombatMath.calculateDoubleStrike(10, 10, 0));

        // Lower attacker AGI: no double strike
        assertFalse(CombatMath.calculateDoubleStrike(5, 10, 0));
    }

    function testDoubleStrikeCap_V3() public {
        // Double strike cap is 40
        assertEq(DOUBLE_STRIKE_CAP, 40);

        // atkAGI=20, defAGI=0, diff=20 -> uncapped=60, capped=40
        assertTrue(CombatMath.calculateDoubleStrike(20, 0, 39));
        assertFalse(CombatMath.calculateDoubleStrike(20, 0, 40));
    }

    function testMagicResistance_V3() public {
        // V3: 3% per INT point (was 2%), still capped at 40%
        // defINT=10, damage=100 -> resistPct=min(30,40)=30 -> resist=100*30/100=30
        assertEq(CombatMath.calculateMagicResistance(10, 100), 30);

        // defINT=14, damage=100 -> resistPct=min(42,40)=40 -> resist=100*40/100=40
        // But capped at damage-1: resist = min(40, 99) = 40
        assertEq(CombatMath.calculateMagicResistance(14, 100), 40);

        // High INT, low damage -> capped at damage-1
        // defINT=100, damage=5 -> resistPct=40 -> resist=5*40/100=2
        assertEq(CombatMath.calculateMagicResistance(100, 5), 2);

        // No resistance on zero/negative damage
        assertEq(CombatMath.calculateMagicResistance(20, 0), 0);
        assertEq(CombatMath.calculateMagicResistance(20, -5), 0);

        // Negative INT: no resistance
        assertEq(CombatMath.calculateMagicResistance(-5, 10), 0);
    }

    function testCritBaseChance_V3() public {
        // V3: crit threshold < 6 (was < 5), so 5% base crit
        // attackRoll=4 -> (4%100 - 0) + 1 = 5, 5 < 6 = true -> crit
        (bool hit1, bool crit1) = CombatMath.calculateToHit(
            4,  // attackRoll
            0,  // attackModifierBonus
            0,  // critChanceBonus
            10, // attackerStat
            5   // defenderStat
        );
        assertTrue(hit1, "should hit");
        assertTrue(crit1, "roll 4 should crit with threshold < 6");

        // attackRoll=5 -> (5%100 - 0) + 1 = 6, 6 < 6 = false -> no crit
        (bool hit2, bool crit2) = CombatMath.calculateToHit(
            5,  // attackRoll
            0,  // attackModifierBonus
            0,  // critChanceBonus
            10, // attackerStat
            5   // defenderStat
        );
        assertTrue(hit2, "should hit");
        assertFalse(crit2, "roll 5 should NOT crit with threshold < 6");
    }

    // === Block mechanic tests (V3 new) ===

    function testBlock_STRBelow10_NeverBlocks() public {
        // STR <= 10: never blocks
        assertFalse(CombatMath.calculateBlock(10, 0));
        assertFalse(CombatMath.calculateBlock(5, 0));
        assertFalse(CombatMath.calculateBlock(0, 0));
        assertFalse(CombatMath.calculateBlock(-5, 0));
    }

    function testBlock_STR11_2Percent() public {
        // STR=11: (11-10)*2 = 2% chance
        // rnChunk=1 -> 1%100=1 < 2 -> blocks
        assertTrue(CombatMath.calculateBlock(11, 1));
        // rnChunk=2 -> 2%100=2 < 2 is false -> no block
        assertFalse(CombatMath.calculateBlock(11, 2));
    }

    function testBlock_STR20_20Percent() public {
        // STR=20: (20-10)*2 = 20% chance
        assertTrue(CombatMath.calculateBlock(20, 19));   // 19 < 20 -> blocks
        assertFalse(CombatMath.calculateBlock(20, 20));  // 20 < 20 is false
    }

    function testBlock_Cap35Percent() public {
        // STR=25: (25-10)*2 = 30% -> below new cap of 35
        assertTrue(CombatMath.calculateBlock(25, 29));   // 29 < 30 -> blocks
        assertFalse(CombatMath.calculateBlock(25, 30));  // 30 < 30 is false

        // STR=27: (27-10)*2 = 34% -> below cap
        assertTrue(CombatMath.calculateBlock(27, 33));   // 33 < 34 -> blocks
        assertFalse(CombatMath.calculateBlock(27, 34));  // 34 < 34 is false

        // STR=50: (50-10)*2 = 80% -> capped at 35%
        assertTrue(CombatMath.calculateBlock(50, 34));   // 34 < 35 -> blocks
        assertFalse(CombatMath.calculateBlock(50, 35));  // still capped at 35
    }

    function testBlock_ProcAtExactThreshold() public {
        // STR=15: (15-10)*2 = 10% chance
        // rnChunk=9 -> 9 < 10 -> blocks (exact boundary)
        assertTrue(CombatMath.calculateBlock(15, 9));
        // rnChunk=10 -> 10 < 10 is false
        assertFalse(CombatMath.calculateBlock(15, 10));
    }

    // === Minimum damage floor tests ===
    // CombatMath.calculateFinalPhysicalDamage can return 0 when armor > damage.
    // The floor of 1 is enforced in PhysicalCombat/MagicCombat (the System layer).
    // These tests verify the CombatMath behavior that the System floor catches.

    function testFinalPhysicalDamage_ArmorExceedsDamage_ReturnsZero() public {
        // baseDamage=2, armor=10, armorPen=0, no crit
        // armorModifier = min((10-0)*DEFENSE_MOD/WAD, 2) = 2 (capped at damage)
        // damageAfterArmor = 2 - 2 = 0
        int256 damage = CombatMath.calculateFinalPhysicalDamage(2, 10, 0, false);
        assertEq(damage, 0, "CombatMath returns 0 when armor fully absorbs - System layer floors to 1");
    }

    function testFinalPhysicalDamage_ArmorPenReducesArmor() public {
        // baseDamage=5, armor=10, armorPen=8, no crit
        // effective armor = 10-8 = 2 -> armorMod = 2*DEFENSE_MOD/WAD = 2
        // damageAfterArmor = 5 - 2 = 3
        int256 damage = CombatMath.calculateFinalPhysicalDamage(5, 10, 8, false);
        assertEq(damage, 3, "armor pen should reduce effective armor");
    }

    function testFinalMagicDamage_ZeroBaseDamage() public {
        // baseDamage=0: should return 0 (System layer floors to 1)
        int256 damage = CombatMath.calculateFinalMagicDamage(0, 50, 100, false);
        assertEq(damage, 0, "CombatMath returns 0 for zero base - System layer floors to 1");
    }

    function testAddStatBonus_MassiveDefenderAdvantage_FlooredAt1() public {
        // attacker=1, defender=50, baseDamage=1.2e18
        // baseDiff = 1*1.2e18 - 50*1e18 = 1.2e18 - 50e18 = -48.8e18
        // abs(baseDiff/WAD) = 48 >= attackerStat(1) -> penalty branch
        // baseDamage + baseDiff = 1.2e18 + (-48.8e18) < 0 -> floor at 1
        int256 damage = CombatMath.addStatBonus(1, 50, 1.2 ether, ATTACK_MODIFIER);
        assertEq(damage, 1, "massive stat disadvantage should floor at 1");
    }
}
