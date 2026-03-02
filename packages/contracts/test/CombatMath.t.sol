// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {CombatMath} from "../src/libraries/CombatMath.sol";
import {PhysicalDamageStatsData, MagicDamageStatsData, WeaponStatsData, ConsumableStatsData} from "@codegen/index.sol";
import {ResistanceStat} from "@codegen/common.sol";
import {ATTACK_MODIFIER, AGI_ATTACK_MODIFIER} from "../constants.sol";

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

        // Should reduce damage by (10-2) * 1 ether = 8 ether (in WAD units)
        assertEq(armorModifier, 8 ether);
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

        // AGI scaling (0.9x)
        int256 agiDamage = CombatMath.calculateWeaponDamage(
            attackStats, 15, 10, weapon, 12345, false, AGI_ATTACK_MODIFIER
        );

        // STR scaling should produce higher damage than AGI scaling
        assertTrue(strDamage > agiDamage);
        assertTrue(agiDamage > 0);
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

    function testAddStatBonus() public {
        int256 damage = CombatMath.addStatBonus(
            15, // attackerStat
            10, // defenderStat
            100, // baseDamage
            ATTACK_MODIFIER
        );

        // Should be positive damage
        assertTrue(damage > 0);
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

    // === New AGI/INT rebalance tests ===

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
        // defAGI=20, atkAGI=10, diff=10 -> dodge chance = 10/3 = 3%
        // rnChunk=1 -> 1%100=1 < 3 -> dodge
        assertTrue(CombatMath.calculateEvasionDodge(20, 10, 1));

        // rnChunk=50 -> 50%100=50, not < 3 -> no dodge
        assertFalse(CombatMath.calculateEvasionDodge(20, 10, 50));

        // Equal AGI: no dodge possible
        assertFalse(CombatMath.calculateEvasionDodge(10, 10, 0));

        // Lower defender AGI: no dodge
        assertFalse(CombatMath.calculateEvasionDodge(5, 10, 0));

        // Cap test: defAGI=100, atkAGI=0, diff=100 -> uncapped=33, capped=25
        // rnChunk=24 -> 24 < 25 -> dodge
        assertTrue(CombatMath.calculateEvasionDodge(100, 0, 24));
        // rnChunk=25 -> 25 < 25 is false -> no dodge (cap works)
        assertFalse(CombatMath.calculateEvasionDodge(100, 0, 25));
    }

    function testDoubleStrike() public {
        // Attacker AGI > Defender AGI: chance to double strike
        // atkAGI=20, defAGI=10, diff=10 -> chance = 10*2 = 20%
        // rnChunk=15 -> 15%100=15 < 20 -> triggers
        assertTrue(CombatMath.calculateDoubleStrike(20, 10, 15));

        // rnChunk=50 -> 50 < 20 false -> no trigger
        assertFalse(CombatMath.calculateDoubleStrike(20, 10, 50));

        // Equal AGI: no double strike
        assertFalse(CombatMath.calculateDoubleStrike(10, 10, 0));

        // Lower attacker AGI: no double strike
        assertFalse(CombatMath.calculateDoubleStrike(5, 10, 0));

        // Cap test: atkAGI=50, defAGI=0, diff=50 -> uncapped=100, capped=25
        assertTrue(CombatMath.calculateDoubleStrike(50, 0, 24));
        assertFalse(CombatMath.calculateDoubleStrike(50, 0, 25));
    }

    function testMagicResistance() public {
        // Normal case: defINT=25, damage=10 -> resist = 25/5 = 5
        assertEq(CombatMath.calculateMagicResistance(25, 10), 5);

        // Resist can't exceed damage-1: defINT=100, damage=5 -> resist=20 but capped to 4
        assertEq(CombatMath.calculateMagicResistance(100, 5), 4);

        // No resistance on zero/negative damage
        assertEq(CombatMath.calculateMagicResistance(20, 0), 0);
        assertEq(CombatMath.calculateMagicResistance(20, -5), 0);

        // Negative INT: no resistance
        assertEq(CombatMath.calculateMagicResistance(-5, 10), 0);
    }
}
