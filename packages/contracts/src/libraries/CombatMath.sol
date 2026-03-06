// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Math, WAD} from "./Math.sol";
import {LibChunks} from "./LibChunks.sol";
import {
    PhysicalDamageStatsData,
    MagicDamageStatsData,
    WeaponStatsData,
    ConsumableStatsData
} from "@codegen/index.sol";
import {ResistanceStat} from "@codegen/common.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {
    DEFENSE_MODIFIER,
    ATTACK_MODIFIER,
    CRIT_MULTIPLIER,
    PROFICIENCY_DENOMINATOR,
    STARTING_HIT_PROBABILITY,
    ATTACKER_HIT_DAMPENER,
    DEFENDER_HIT_DAMPENER,
    EVASION_CAP,
    DOUBLE_STRIKE_CAP
} from "../../constants.sol";

/**
 * @title CombatMath
 * @notice Library containing all combat calculation functions extracted from CombatSystem
 * @dev This library reduces contract size by moving mathematical operations out of the main system
 */
library CombatMath {
    using Math for uint256;
    using Math for int256;

    /**
     * @notice Calculate hit and critical hit probability for an attack
     * @param attackRoll Random number for attack roll (0-99)
     * @param attackModifierBonus Bonus to attack modifier
     * @param critChanceBonus Bonus to critical hit chance
     * @param attackerStat Attacker's relevant stat (STR/AGI/INT)
     * @param defenderStat Defender's relevant stat (STR/AGI/INT)
     * @return attackLands Whether the attack hits
     * @return crit Whether the attack is a critical hit
     */
    function calculateToHit(
        uint256 attackRoll,
        int256 attackModifierBonus,
        int256 critChanceBonus,
        int256 attackerStat,
        int256 defenderStat
    ) internal pure returns (bool attackLands, bool crit) {
        uint256 hitDampener = (attackerStat > defenderStat ? ATTACKER_HIT_DAMPENER : DEFENDER_HIT_DAMPENER);

        int256 startingProbability = STARTING_HIT_PROBABILITY
            + int256(
                (((attackerStat - defenderStat) + attackModifierBonus) * 1000)
                    / int256(int256(Math.absolute(attackerStat - defenderStat) + hitDampener) * 10)
            );

        uint256 probability;
        if (startingProbability < 5) {
            probability = 5; // minimum 5% hit chance
        } else if (startingProbability > 98) {
            probability = 98; // maximum 98% hit chance
        } else {
            probability = uint256(startingProbability);
        }

        attackLands = (attackRoll % 100) + 1 <= probability;

        if (attackLands) {
            crit = ((int256(attackRoll % 100) - critChanceBonus) + 1) < 5;
        }
    }

    /**
     * @notice Calculate armor damage reduction
     * @param armor Defender's armor value
     * @param armorPenetration Attacker's armor penetration
     * @param damage Base damage before armor reduction
     * @return totalArmorModifier Total damage reduction from armor
     */
    function calculateArmorModifier(int256 armor, int256 armorPenetration, int256 damage)
        internal
        pure
        returns (int256 totalArmorModifier)
    {
        if (armor - armorPenetration > 0) {
            totalArmorModifier = (armor - armorPenetration) * int256(DEFENSE_MODIFIER);
        }
        // if total armor is greater than damage then overall damage should be 0
        if (damage - (int256(armor) - armorPenetration) < 0) {
            totalArmorModifier = damage;
        }
    }

    /**
     * @notice Calculate weapon damage for physical attacks
     * @param attackStats Physical damage stats for the attack
     * @param attackerStat Attacker's primary stat (STR or AGI)
     * @param defenderStat Defender's primary stat (STR or AGI)
     * @param weapon Weapon stats
     * @param randomNumber Random number for damage variation
     * @param crit Whether this is a critical hit
     * @param attackModifier Scaling modifier (ATTACK_MODIFIER for STR, AGI_ATTACK_MODIFIER for AGI)
     * @return damage Calculated weapon damage
     */
    function calculateWeaponDamage(
        PhysicalDamageStatsData memory attackStats,
        int256 attackerStat,
        int256 defenderStat,
        WeaponStatsData memory weapon,
        uint64 randomNumber,
        bool crit,
        uint256 attackModifier
    ) internal pure returns (int256 damage) {
        if (!crit) {
            int256 randomness = Math.toInt(randomNumber ^ 4);
            int256 baseDamage = (
                attackStats.bonusDamage
                    + int256(
                        randomness % weapon.maxDamage + 1 <= weapon.minDamage
                            ? weapon.minDamage
                            : randomness % weapon.maxDamage + 1
                    )
            ) * int256(attackModifier);
            damage = addStatBonus(attackerStat, defenderStat, baseDamage, attackModifier);
        } else {
            damage = addStatBonus(attackerStat, defenderStat, weapon.maxDamage * int256(attackModifier), attackModifier);
        }
    }

    /**
     * @notice Calculate magic damage for consumable/magic attacks
     * @param attackStats Magic damage stats for the attack
     * @param consumable Consumable stats (or weapon stats converted to consumable format)
     * @param rnChunk Random number chunk for damage variation
     * @param attackerIntelligence Attacker's intelligence stat
     * @param defenderIntelligence Defender's intelligence stat
     * @param crit Whether this is a critical hit
     * @param attackModifier Scaling modifier (always ATTACK_MODIFIER for magic)
     * @return damage Calculated magic damage
     */
    function calculateMagicDamage(
        MagicDamageStatsData memory attackStats,
        ConsumableStatsData memory consumable,
        uint64 rnChunk,
        int256 attackerIntelligence,
        int256 defenderIntelligence,
        bool crit,
        uint256 attackModifier
    ) internal pure returns (int256 damage) {
        int256 baseDamage;
        if (!crit) {
            baseDamage = (
                attackStats.bonusDamage
                    + int256(
                        uint256(rnChunk) % uint256(consumable.maxDamage) + 1 <= uint256(consumable.minDamage)
                            ? consumable.minDamage
                            : int256(uint256(rnChunk) % uint256(consumable.maxDamage) + 1)
                    )
            ) * int256(attackModifier);
        } else {
            baseDamage = (consumable.maxDamage + attackStats.bonusDamage) * int256(attackModifier);
        }
        damage = addStatBonus(attackerIntelligence, defenderIntelligence, baseDamage, attackModifier);

        if (damage < int256(0) && consumable.maxDamage > int256(0)) {
            damage = int256(0);
        }
    }

    /**
     * @notice Calculate magic damage for consumable attacks (alias for backwards compatibility)
     */
    function calculateMagicDamageFromConsumable(
        MagicDamageStatsData memory attackStats,
        ConsumableStatsData memory consumable,
        uint64 rnChunk,
        int256 attackerIntelligence,
        int256 defenderIntelligence,
        bool crit
    ) internal pure returns (int256 damage) {
        return calculateMagicDamage(attackStats, consumable, rnChunk, attackerIntelligence, defenderIntelligence, crit, ATTACK_MODIFIER);
    }

    /**
     * @notice Add stat-based damage bonus/penalty
     * @param attackerStat Attacker's relevant stat
     * @param defenderStat Defender's relevant stat
     * @param baseDamage Base damage before stat modifications
     * @param attackModifier The attack scaling modifier
     * @return totalDamage Final damage after stat calculations
     */
    function addStatBonus(int256 attackerStat, int256 defenderStat, int256 baseDamage, uint256 attackModifier)
        internal
        pure
        returns (int256 totalDamage)
    {
        int256 baseDifference = (attackerStat * int256(attackModifier)) - (defenderStat * int256(WAD));
        if (baseDifference > 0) {
            // Halve the stat bonus to prevent one-shot kills at high stat advantages
            int256 _unroundedDamage = (baseDifference / 2) + baseDamage;
            totalDamage = Math.roundInt(_unroundedDamage, int256(WAD)) / int256(WAD);
        } else if (
            baseDamage > int256(0) && baseDifference < int256(0)
                && Math.absolute(baseDifference / int256(WAD)) >= uint256(attackerStat)
        ) {
            // if the stat difference is equal to or greater than the attackers base stat subtract difference from damage
            if (baseDamage + baseDifference > int256(0)) {
                totalDamage = (baseDamage + baseDifference) / int256(WAD);
            } else {
                // if damage is negative minimum damage is 1
                totalDamage = 1;
            }
        } else {
            totalDamage = baseDamage / int256(WAD);
        }
    }

    /**
     * @notice Get stat modifier for proficiency calculations
     * @param stat Character's stat value
     * @param modifierBonus Bonus modifier to the stat
     * @return multiplier Calculated stat multiplier
     */
    function getStatModifier(int256 stat, int256 modifierBonus) internal pure returns (uint256 multiplier) {
        int256 scaled = ((stat + modifierBonus) * int256(WAD)) / int256(PROFICIENCY_DENOMINATOR);
        multiplier = scaled > 0 ? uint256(scaled) : WAD;
    }

    /**
     * @notice Calculate status effect hit chance based on resistance stat
     * @param attackRoll Random number for attack roll
     * @param attackModifierBonus Bonus to attack modifier
     * @param critChanceBonus Bonus to critical hit chance (unused for status effects)
     * @param attackerStat Attacker's relevant stat
     * @param defenderStat Defender's relevant stat
     * @param resistanceStat What stat the defender resists with
     * @return hit Whether the status effect hits
     */
    function calculateStatusEffectHit(
        uint256 attackRoll,
        int256 attackModifierBonus,
        int256 critChanceBonus,
        int256 attackerStat,
        int256 defenderStat,
        ResistanceStat resistanceStat
    ) internal pure returns (bool hit) {
        if (resistanceStat == ResistanceStat.None) {
            hit = true;
        } else {
            (hit,) = calculateToHit(attackRoll, attackModifierBonus, critChanceBonus, attackerStat, defenderStat);
        }
    }

    /**
     * @notice Calculate AGI-based crit bonus
     * @param attackerAgi Attacker's agility stat
     * @return bonus Additional crit chance from AGI
     */
    function calculateAgiCritBonus(int256 attackerAgi) internal pure returns (int256) {
        return attackerAgi > 0 ? attackerAgi / 4 : int256(0);
    }

    /**
     * @notice Calculate evasion dodge chance based on AGI differential
     * @param defenderAgi Defender's agility stat
     * @param attackerAgi Attacker's agility stat
     * @param rnChunk Random number chunk for roll
     * @return dodged Whether the attack was evaded
     */
    function calculateEvasionDodge(int256 defenderAgi, int256 attackerAgi, uint64 rnChunk)
        internal
        pure
        returns (bool)
    {
        if (defenderAgi <= attackerAgi) return false;
        uint256 dodgeChance = uint256(defenderAgi - attackerAgi) / 3;
        if (dodgeChance > EVASION_CAP) dodgeChance = EVASION_CAP;
        return (uint256(rnChunk) % 100) < dodgeChance;
    }

    /**
     * @notice Calculate double strike chance for AGI weapons
     * @param attackerAgi Attacker's agility stat
     * @param defenderAgi Defender's agility stat
     * @param rnChunk Random number chunk for roll
     * @return triggered Whether double strike triggers
     */
    function calculateDoubleStrike(int256 attackerAgi, int256 defenderAgi, uint64 rnChunk)
        internal
        pure
        returns (bool)
    {
        if (attackerAgi <= defenderAgi) return false;
        uint256 chance = uint256(attackerAgi - defenderAgi) * 2;
        if (chance > DOUBLE_STRIKE_CAP) chance = DOUBLE_STRIKE_CAP;
        return (uint256(rnChunk) % 100) < chance;
    }

    /**
     * @notice Calculate magic resistance from INT
     * @param defenderIntelligence Defender's intelligence stat
     * @param damage Incoming magic damage
     * @return resist Amount of damage resisted
     */
    function calculateMagicResistance(int256 defenderIntelligence, int256 damage)
        internal
        pure
        returns (int256)
    {
        if (damage <= 0) return int256(0);
        // 2% damage reduction per INT point, capped at 40%
        int256 resistPct = defenderIntelligence * 2;
        if (resistPct > 40) resistPct = 40;
        if (resistPct < 0) resistPct = 0;
        int256 resist = (damage * resistPct) / 100;
        if (resist >= damage) resist = damage - 1;
        return resist;
    }

    /**
     * @notice Apply critical hit multiplier to damage
     * @param damage Base damage
     * @param crit Whether this is a critical hit
     * @return finalDamage Damage after critical hit multiplier
     */
    function applyCriticalHit(int256 damage, bool crit) internal pure returns (int256 finalDamage) {
        if (crit) {
            finalDamage = damage * int256(CRIT_MULTIPLIER);
        } else {
            finalDamage = damage;
        }
    }

    /**
     * @notice Calculate final physical damage including armor and critical hits
     * @param baseDamage Base weapon damage
     * @param armor Defender's armor
     * @param armorPenetration Attacker's armor penetration
     * @param crit Whether this is a critical hit
     * @return finalDamage Final damage after all modifications
     */
    function calculateFinalPhysicalDamage(
        int256 baseDamage,
        int256 armor,
        int256 armorPenetration,
        bool crit
    ) internal pure returns (int256 finalDamage) {
        int256 damageAfterArmor = baseDamage - calculateArmorModifier(armor, armorPenetration, baseDamage);
        damageAfterArmor = damageAfterArmor < int256(0) ? int256(0) : damageAfterArmor;
        finalDamage = applyCriticalHit(damageAfterArmor, crit);
    }

    /**
     * @notice Calculate final magic damage including critical hits and healing caps
     * @param baseDamage Base magic damage
     * @param currentHp Defender's current HP
     * @param maxHp Defender's max HP
     * @param crit Whether this is a critical hit
     * @return finalDamage Final damage after all modifications
     */
    function calculateFinalMagicDamage(
        int256 baseDamage,
        int256 currentHp,
        int256 maxHp,
        bool crit
    ) internal pure returns (int256 finalDamage) {
        finalDamage = baseDamage;

        // Handle healing (negative damage)
        if (finalDamage < 0) {
            if (currentHp - finalDamage > maxHp) {
                finalDamage = -(maxHp - currentHp);
            }
        }

        // Apply critical hit
        if (crit) {
            finalDamage = applyCriticalHit(finalDamage, true);

            // Re-apply healing cap after crit
            if (finalDamage < 0) {
                if (currentHp - finalDamage > maxHp) {
                    finalDamage = -(maxHp - currentHp);
                }
            }
        }
    }
}
