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
    DEFENDER_HIT_DAMPENER
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
     * @param attackerStrength Attacker's strength stat
     * @param defenderStrength Defender's strength stat
     * @param weapon Weapon stats
     * @param randomNumber Random number for damage variation
     * @param crit Whether this is a critical hit
     * @return damage Calculated weapon damage
     */
    function calculateWeaponDamage(
        PhysicalDamageStatsData memory attackStats,
        int256 attackerStrength,
        int256 defenderStrength,
        WeaponStatsData memory weapon,
        uint64 randomNumber,
        bool crit
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
            ) * int256(ATTACK_MODIFIER);
            damage = addStatBonus(attackerStrength, defenderStrength, baseDamage);
        } else {
            damage = addStatBonus(attackerStrength, defenderStrength, weapon.maxDamage * int256(ATTACK_MODIFIER));
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
     * @return damage Calculated magic damage
     */
    function calculateMagicDamage(
        MagicDamageStatsData memory attackStats,
        ConsumableStatsData memory consumable,
        uint64 rnChunk,
        int256 attackerIntelligence,
        int256 defenderIntelligence,
        bool crit
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
            ) * int256(ATTACK_MODIFIER);
        } else {
            baseDamage = (consumable.maxDamage + attackStats.bonusDamage) * int256(ATTACK_MODIFIER);
        }
        damage = addStatBonus(attackerIntelligence, defenderIntelligence, baseDamage);

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
        return calculateMagicDamage(attackStats, consumable, rnChunk, attackerIntelligence, defenderIntelligence, crit);
    }

    /**
     * @notice Add stat-based damage bonus/penalty
     * @param attackerStat Attacker's relevant stat
     * @param defenderStat Defender's relevant stat
     * @param baseDamage Base damage before stat modifications
     * @return totalDamage Final damage after stat calculations
     */
    function addStatBonus(int256 attackerStat, int256 defenderStat, int256 baseDamage)
        internal
        pure
        returns (int256 totalDamage)
    {
        int256 baseDifference = (attackerStat * int256(ATTACK_MODIFIER)) - (defenderStat * int256(WAD));
        if (baseDifference > 0) {
            int256 _unroundedDamage = baseDifference + baseDamage;
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
        multiplier = (((stat + modifierBonus) * int256(WAD)) / int256(PROFICIENCY_DENOMINATOR)) > 0
            ? uint256(((stat + modifierBonus) * int256(WAD)) / int256(PROFICIENCY_DENOMINATOR))
            : WAD;
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
