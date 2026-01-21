// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {CombatMath} from "../src/libraries/CombatMath.sol";
import {PhysicalDamageStatsData, MagicDamageStatsData, WeaponStatsData, ConsumableStatsData} from "@codegen/index.sol";
import {ResistanceStat} from "@codegen/common.sol";

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
            15, // attackerStrength
            10, // defenderStrength
            weapon,
            12345, // randomNumber
            false // crit
        );
        
        // Should be positive damage
        assertTrue(damage > 0);
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
            false // crit
        );
        
        // Should be positive damage
        assertTrue(damage > 0);
    }

    function testAddStatBonus() public {
        int256 damage = CombatMath.addStatBonus(
            15, // attackerStat
            10, // defenderStat
            100 // baseDamage
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
}
