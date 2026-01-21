// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Test} from "forge-std/Test.sol";
import {EquipmentUtils} from "@libraries/EquipmentUtils.sol";
import {StatsData, WeaponStatsData, ArmorStatsData} from "@codegen/index.sol";
import {Classes, PowerSource, Race, ArmorType, AdvancedClass} from "@codegen/common.sol";

contract EquipmentUtilsTest is Test {
    using EquipmentUtils for StatsData;

    function test_validateEquipmentRequirements_passesWhenAllMinsMet() public {
        StatsData memory stats = StatsData({
            strength: 10,
            agility: 8,
            class: Classes.Warrior,
            intelligence: 7,
            maxHp: 20,
            currentHp: 20,
            experience: 0,
            level: 1,
            powerSource: PowerSource.None,
            race: Race.None,
            startingArmor: ArmorType.None,
            advancedClass: AdvancedClass.None,
            hasSelectedAdvancedClass: false
        });

        bool ok = EquipmentUtils.validateEquipmentRequirements(stats, 5, 5, 5);
        assertTrue(ok, "requirements should pass");
    }

    function test_validateEquipmentRequirements_failsWhenBelowMin() public {
        StatsData memory stats = StatsData({
            strength: 4,
            agility: 8,
            class: Classes.Warrior,
            intelligence: 7,
            maxHp: 20,
            currentHp: 20,
            experience: 0,
            level: 1,
            powerSource: PowerSource.None,
            race: Race.None,
            startingArmor: ArmorType.None,
            advancedClass: AdvancedClass.None,
            hasSelectedAdvancedClass: false
        });

        bool ok = EquipmentUtils.validateEquipmentRequirements(stats, 5, 5, 5);
        assertFalse(ok, "requirements should fail when str below min");
    }

    function test_calculateEquipmentBonuses_appliesSumOfModifiers() public {
        StatsData memory baseStats = StatsData({
            strength: 5,
            agility: 5,
            class: Classes.Warrior,
            intelligence: 5,
            maxHp: 10,
            currentHp: 10,
            experience: 0,
            level: 1,
            powerSource: PowerSource.None,
            race: Race.None,
            startingArmor: ArmorType.None,
            advancedClass: AdvancedClass.None,
            hasSelectedAdvancedClass: false
        });

        WeaponStatsData memory weapon = WeaponStatsData({
            agiModifier: 1,
            intModifier: 2,
            hpModifier: 0,
            maxDamage: 5,
            minDamage: 1,
            minLevel: 1,
            strModifier: 3,
            effects: new bytes32[](0)
        });

        ArmorStatsData memory armor = ArmorStatsData({
            agiModifier: 2,
            armorModifier: 0,
            hpModifier: 4,
            intModifier: 1,
            minLevel: 1,
            strModifier: 2,
            armorType: ArmorType.Cloth
        });

        StatsData memory out = EquipmentUtils.calculateEquipmentBonuses(baseStats, weapon, armor);
        assertEq(out.strength, 5 + 3 + 2, "strength bonus");
        assertEq(out.agility, 5 + 1 + 2, "agility bonus");
        assertEq(out.intelligence, 5 + 2 + 1, "int bonus");
        assertEq(out.maxHp, 10 + 4, "hp bonus from armor");
    }

    function test_validateEquipmentCompatibility_levelGate() public {
        assertTrue(EquipmentUtils.validateEquipmentCompatibility(5, 1), "level 5 >= 1");
        assertFalse(EquipmentUtils.validateEquipmentCompatibility(0, 1), "level 0 < 1");
    }

    function test_calculateDurability_boundsAtZero() public {
        assertEq(EquipmentUtils.calculateDurability(10, 3), 7, "10-3");
        assertEq(EquipmentUtils.calculateDurability(2, 5), 0, "cannot go negative");
    }
}


