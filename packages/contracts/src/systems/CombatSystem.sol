// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {Math, WAD} from "@libraries/Math.sol";
import {LibChunks} from "@libraries/LibChunks.sol";
import {ArrayManagers} from "@libraries/ArrayManagers.sol";
import {CombatMath} from "@libraries/CombatMath.sol";
import {
    Effects,
    EffectsData,
    EncounterEntity,
    Stats,
    StatsData,
    CombatEncounter,
    CombatEncounterData,
    ActionOutcome,
    ActionOutcomeData,
    WeaponStats,
    Items,
    WeaponStatsData,
    ConsumableStatsData,
    ConsumableStats,
    PhysicalDamageStats,
    PhysicalDamageStatsData,
    MagicDamageStats,
    MagicDamageStatsData,
    StatusEffectStats,
    StatusEffectTargeting,
    WeaponScaling,
    ClassMultipliers
} from "@codegen/index.sol";
import {ResistanceStat, EffectType, ItemType} from "@codegen/common.sol";
import {Action, AdjustedCombatStats} from "@interfaces/Structs.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {
    DEFENSE_MODIFIER,
    ATTACK_MODIFIER,
    CRIT_MULTIPLIER,
    PROFICIENCY_DENOMINATOR,
    STARTING_HIT_PROBABILITY,
    ATTACKER_HIT_DAMPENER,
    DEFENDER_HIT_DAMPENER,
    AGI_ATTACK_MODIFIER,
    CLASS_MULTIPLIER_BASE
} from "../../constants.sol";
import {_requireSystemOrAdmin} from "../utils.sol";
import {ActionNotFound, ItemNotEquipped, ActionTypeNotRecognized, InvalidMagicItemType, InvalidAction, UnrecognizedResistanceStat} from "../Errors.sol";

contract CombatSystem is System {
    using Math for uint256;
    using Math for int256;

    // Combat triangle constants
    uint256 constant COMBAT_TRIANGLE_BONUS_PER_STAT = WAD / 25; // 4% per stat point difference
    uint256 constant COMBAT_TRIANGLE_MAX_BONUS = WAD * 40 / 100; // 40% cap

    /**
     * @notice Determine the dominant stat for an entity
     * @dev Returns 0 for STR, 1 for AGI, 2 for INT
     * @param stats The entity's combat stats
     * @return dominantStat The dominant stat type (0=STR, 1=AGI, 2=INT)
     * @return dominantValue The value of the dominant stat
     */
    function _getDominantStat(AdjustedCombatStats memory stats)
        internal
        pure
        returns (uint8 dominantStat, int256 dominantValue)
    {
        if (stats.strength >= stats.agility && stats.strength >= stats.intelligence) {
            return (0, stats.strength); // STR dominant
        } else if (stats.agility > stats.strength && stats.agility >= stats.intelligence) {
            return (1, stats.agility); // AGI dominant
        } else {
            return (2, stats.intelligence); // INT dominant
        }
    }

    /**
     * @notice Calculate combat triangle advantage modifier
     * @dev Combat Triangle: STR > AGI > INT > STR
     *      When attacker has advantage, applies: 1 + (attackerDominant - defenderDominant) * 0.04, capped at 40%
     * @param attacker Attacker's combat stats
     * @param defender Defender's combat stats
     * @return damageModifier The damage modifier in WAD format (1e18 = 100%)
     */
    function _calculateCombatTriangleModifier(
        AdjustedCombatStats memory attacker,
        AdjustedCombatStats memory defender
    ) internal pure returns (uint256 damageModifier) {
        (uint8 attackerDominant, int256 attackerValue) = _getDominantStat(attacker);
        (uint8 defenderDominant, int256 defenderValue) = _getDominantStat(defender);

        // Check if attacker has combat triangle advantage
        // STR (0) beats AGI (1), AGI (1) beats INT (2), INT (2) beats STR (0)
        bool hasAdvantage = false;
        if (attackerDominant == 0 && defenderDominant == 1) {
            hasAdvantage = true; // STR > AGI
        } else if (attackerDominant == 1 && defenderDominant == 2) {
            hasAdvantage = true; // AGI > INT
        } else if (attackerDominant == 2 && defenderDominant == 0) {
            hasAdvantage = true; // INT > STR
        }

        if (hasAdvantage) {
            // Calculate advantage bonus: 1 + (attackerStat - defenderStat) * 0.04, capped at 40%
            int256 statDifference = attackerValue - defenderValue;
            if (statDifference < 0) statDifference = 0; // Floor at 0 to prevent penalty

            uint256 bonus = uint256(statDifference) * COMBAT_TRIANGLE_BONUS_PER_STAT;
            if (bonus > COMBAT_TRIANGLE_MAX_BONUS) bonus = COMBAT_TRIANGLE_MAX_BONUS;
            return WAD + bonus;
        }

        // No advantage - return 1.0 (no modification)
        return WAD;
    }

    /**
     * @notice Apply combat triangle modifier to damage
     * @param baseDamage The base damage before modifier
     * @param attacker Attacker's combat stats
     * @param defender Defender's combat stats
     * @return finalDamage Damage after combat triangle modifier applied
     */
    function _applyCombatTriangle(
        int256 baseDamage,
        AdjustedCombatStats memory attacker,
        AdjustedCombatStats memory defender
    ) internal pure returns (int256 finalDamage) {
        uint256 damageModifier = _calculateCombatTriangleModifier(attacker, defender);
        // Apply modifier: damage * damageModifier / WAD
        finalDamage = (baseDamage * int256(damageModifier)) / int256(WAD);
    }

    function executeAction(ActionOutcomeData memory actionOutcomeData, uint256 randomNumber)
        public
        returns (ActionOutcomeData memory)
    {
        _requireSystemOrAdmin(_msgSender());

        // if the defender is alive and attacker is alive, execute the action
        if (!getDied(actionOutcomeData.attackerId) && !getDied(actionOutcomeData.defenderId)) {
            // Cache character validation and equip check before the loop (saves 5-10K gas/extra effect)
            bool attackerIsCharacter = IWorld(_world()).UD__isValidCharacterId(actionOutcomeData.attackerId);
            if (attackerIsCharacter) {
                if (!IWorld(_world()).UD__isEquipped(actionOutcomeData.attackerId, actionOutcomeData.itemId)) {
                    revert ItemNotEquipped();
                }
            }

            // Cache attacker/defender stats once before effects loop (saves 5-20K gas/extra effect)
            AdjustedCombatStats memory cachedAttacker = IWorld(_world()).UD__calculateAllStatusEffects(actionOutcomeData.attackerId);
            AdjustedCombatStats memory cachedDefender = IWorld(_world()).UD__calculateAllStatusEffects(actionOutcomeData.defenderId);

            // executeEffects
            for (uint256 i; i < actionOutcomeData.effectIds.length; i++) {
                // hash the random number with the attack number and the effectId to allow different attack outcomes in the same block
                randomNumber = uint256(keccak256(abi.encode(randomNumber, i, actionOutcomeData.effectIds[i])));

                EffectsData memory effectData = Effects.get(actionOutcomeData.effectIds[i]);
                if (!effectData.effectExists) revert ActionNotFound();
                //decode action data according to type
                if (effectData.effectType == EffectType.PhysicalDamage) {
                    // calculate damage
                    (actionOutcomeData.damagePerHit[i], actionOutcomeData.hit[i], actionOutcomeData.crit[i]) =
                    _calculatePhysicalEffect(
                        actionOutcomeData.effectIds[i],
                        actionOutcomeData.attackerId,
                        actionOutcomeData.defenderId,
                        actionOutcomeData.itemId,
                        randomNumber,
                        cachedAttacker,
                        cachedDefender
                    );
                    actionOutcomeData.attackerDamageDelt += actionOutcomeData.damagePerHit[i];
                    // if hit deduct damage
                    if (actionOutcomeData.hit[i]) {
                        int256 currentHp =
                            Stats.getCurrentHp(actionOutcomeData.defenderId) - int256(actionOutcomeData.damagePerHit[i]);
                        if (currentHp < 0) currentHp = 0;
                        if (currentHp <= 0) actionOutcomeData.defenderDied = true;
                        Stats.setCurrentHp(actionOutcomeData.defenderId, currentHp);
                    } else {
                        actionOutcomeData.miss[i] = true;
                    }
                } else if (effectData.effectType == EffectType.MagicDamage) {
                    // calculate damage
                    (actionOutcomeData.damagePerHit[i], actionOutcomeData.hit[i], actionOutcomeData.crit[i]) =
                    _calculateMagicEffect(
                        actionOutcomeData.effectIds[i],
                        actionOutcomeData.attackerId,
                        actionOutcomeData.defenderId,
                        actionOutcomeData.itemId,
                        randomNumber,
                        cachedAttacker,
                        cachedDefender
                    );
                    actionOutcomeData.attackerDamageDelt += actionOutcomeData.damagePerHit[i];
                    // if hit deduct damage
                    if (actionOutcomeData.hit[i]) {
                        int256 currentHp =
                            Stats.getCurrentHp(actionOutcomeData.defenderId) - int256(actionOutcomeData.damagePerHit[i]);
                        if (currentHp < 0) currentHp = 0;
                        if (currentHp <= 0) actionOutcomeData.defenderDied = true;
                        Stats.setCurrentHp(actionOutcomeData.defenderId, currentHp);
                    } else {
                        actionOutcomeData.miss[i] = true;
                    }
                } else if (effectData.effectType == EffectType.StatusEffect) {
                    // get statusEffect stats
                    // calculate damage

                    (actionOutcomeData.hit[i]) = _calculateStatusEffect(
                        actionOutcomeData.effectIds[i],
                        actionOutcomeData.attackerId,
                        actionOutcomeData.defenderId,
                        actionOutcomeData.itemId,
                        randomNumber,
                        cachedAttacker,
                        cachedDefender
                    );
                    // if combat consumable, consume the item
                    if (Items.getItemType(actionOutcomeData.itemId) == ItemType.Consumable) {
                        IWorld(_world()).UD__consumeItem(actionOutcomeData.attackerId, actionOutcomeData.itemId);
                    }
                } else {
                    revert ActionTypeNotRecognized();
                }
            }
            if (actionOutcomeData.defenderDied) {
                EncounterEntity.setDied(actionOutcomeData.defenderId, true);
            }
            if (actionOutcomeData.attackerDied) {
                EncounterEntity.setDied(actionOutcomeData.attackerId, true);
            }
        }
        return actionOutcomeData;
    }

    function getDied(bytes32 entityId) public view returns (bool isDied) {
        return EncounterEntity.getDied(entityId);
    }

    function getEncounter(bytes32 encounterId) public view returns (CombatEncounterData memory) {
        return CombatEncounter.get(encounterId);
    }

    function _calculatePhysicalEffect(
        bytes32 effectId,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 itemId,
        uint256 randomNumber,
        AdjustedCombatStats memory attacker,
        AdjustedCombatStats memory defender
    ) internal view returns (int256 damage, bool hit, bool crit) {
        // get weapon stats
        WeaponStatsData memory weapon = IWorld(_world()).UD__getWeaponStats(itemId);

        if (!IWorld(_world()).UD__checkItemEffect(itemId, effectId)) revert InvalidAction();

        PhysicalDamageStatsData memory attackStats = IWorld(_world()).UD__getPhysicalDamageStats(effectId);
        if (Stats.getCurrentHp(defenderId) > 0) {
            uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);

            // AGI crit bonus
            int256 agiCritBonus = CombatMath.calculateAgiCritBonus(attacker.agility);
            (hit, crit) = CombatMath.calculateToHit(
                uint256(rnChunks[0]),
                attackStats.attackModifierBonus,
                attackStats.critChanceBonus + agiCritBonus,
                attacker.agility,
                defender.agility
            );
            if (hit) {
                // Weapon stat routing
                bool usesAgi = WeaponScaling.getUsesAgi(itemId);
                int256 attackerPrimary = usesAgi ? attacker.agility : attacker.strength;
                int256 defenderPrimary = usesAgi ? defender.agility : defender.strength;
                uint256 scalingMod = usesAgi ? AGI_ATTACK_MODIFIER : ATTACK_MODIFIER;

                // Base damage with parameterized scaling
                damage = CombatMath.calculateWeaponDamage(
                    attackStats, attackerPrimary, defenderPrimary, weapon, rnChunks[2], crit, scalingMod
                );
                damage = damage - CombatMath.calculateArmorModifier(defender.armor, attackStats.armorPenetration, damage);
                damage = damage < int256(0) ? int256(0) : damage;

                // Crit multiplier
                damage = CombatMath.applyCriticalHit(damage, crit);

                // Class multipliers
                uint256 physMult = ClassMultipliers.getPhysicalDamageMultiplier(attackerId);
                if (physMult == 0) physMult = CLASS_MULTIPLIER_BASE;
                damage = (damage * int256(physMult)) / int256(CLASS_MULTIPLIER_BASE);
                if (crit) {
                    uint256 critMult = ClassMultipliers.getCritDamageMultiplier(attackerId);
                    if (critMult > CLASS_MULTIPLIER_BASE) {
                        damage = (damage * int256(critMult)) / int256(CLASS_MULTIPLIER_BASE);
                    }
                }

                // Combat triangle
                damage = _applyCombatTriangle(damage, attacker, defender);

                // Evasion (all physical attacks — AGI dodge check)
                if (CombatMath.calculateEvasionDodge(defender.agility, attacker.agility, rnChunks[3])) {
                    damage = 0;
                    hit = false;
                }

                // Double strike (AGI weapons only)
                if (hit && usesAgi && CombatMath.calculateDoubleStrike(attacker.agility, defender.agility, rnChunks[1])) {
                    damage = damage + damage / 2;
                }
            } else {
                damage = 0;
                hit = false;
            }
        } else {
            damage = 0;
            hit = false;
            crit = false;
        }
    }

    function _calculateMagicEffect(
        bytes32 effectId,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 itemId,
        uint256 randomNumber,
        AdjustedCombatStats memory attacker,
        AdjustedCombatStats memory defender
    ) internal view returns (int256 damage, bool hit, bool crit) {

        // Check item type - weapons with magic effects need different handling
        ItemType itemType = Items.getItemType(itemId);
        ConsumableStatsData memory magicItem;

        if (itemType == ItemType.Weapon) {
            // For weapons with magic effects (like monster Dark Magic), use weapon stats
            WeaponStatsData memory weapon = IWorld(_world()).UD__getWeaponStats(itemId);
            magicItem = ConsumableStatsData({
                minDamage: weapon.minDamage,
                maxDamage: weapon.maxDamage,
                minLevel: weapon.minLevel,
                effects: weapon.effects
            });
        } else if (itemType == ItemType.Consumable) {
            // For consumables with magic effects
            magicItem = IWorld(_world()).UD__getConsumableStats(itemId);
        } else {
            revert InvalidMagicItemType();
        }

        if (!IWorld(_world()).UD__checkItemEffect(itemId, effectId)) revert InvalidAction();

        MagicDamageStatsData memory attackStats = IWorld(_world()).UD__getMagicDamageStats(effectId);

        if (Stats.getCurrentHp(defenderId) > 0) {
            uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);

            // AGI crit bonus
            int256 agiCritBonus = CombatMath.calculateAgiCritBonus(attacker.agility);
            (hit, crit) = CombatMath.calculateToHit(
                uint256(rnChunks[0]),
                attackStats.attackModifierBonus,
                attackStats.critChanceBonus + agiCritBonus,
                attacker.intelligence,
                defender.intelligence
            );
            if (hit) {
                damage = CombatMath.calculateMagicDamage(
                    attackStats, magicItem, rnChunks[2], attacker.intelligence, defender.intelligence, crit, ATTACK_MODIFIER
                );
                int256 currentHp = Stats.getCurrentHp(defenderId);
                int256 maxHp = Stats.getMaxHp(defenderId);
                damage = CombatMath.calculateFinalMagicDamage(damage, currentHp, maxHp, crit);

                // Magic resistance
                if (damage > 0) {
                    damage -= CombatMath.calculateMagicResistance(defender.intelligence, damage);
                }

                // Class multipliers
                if (damage > 0) {
                    uint256 spellMult = ClassMultipliers.getSpellDamageMultiplier(attackerId);
                    if (spellMult == 0) spellMult = CLASS_MULTIPLIER_BASE;
                    damage = (damage * int256(spellMult)) / int256(CLASS_MULTIPLIER_BASE);
                } else if (damage < 0) {
                    uint256 healMult = ClassMultipliers.getHealingMultiplier(attackerId);
                    if (healMult == 0) healMult = CLASS_MULTIPLIER_BASE;
                    damage = (damage * int256(healMult)) / int256(CLASS_MULTIPLIER_BASE);
                }
                if (crit) {
                    uint256 critMult = ClassMultipliers.getCritDamageMultiplier(attackerId);
                    if (critMult > CLASS_MULTIPLIER_BASE) {
                        damage = (damage * int256(critMult)) / int256(CLASS_MULTIPLIER_BASE);
                    }
                }

                // Apply combat triangle modifier (STR > AGI > INT > STR)
                damage = _applyCombatTriangle(damage, attacker, defender);
            } else {
                damage = 0;
                hit = false;
            }
        } else {
            damage = 0;
            hit = false;
            crit = false;
        }
    }


    function _calculateStatusEffect(
        bytes32 effectId,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 itemId,
        uint256 randomNumber,
        AdjustedCombatStats memory attacker,
        AdjustedCombatStats memory defender
    ) internal returns (bool hit) {
        // get weapon stats
        ResistanceStat resistanceStat = IWorld(_world()).UD__getStatusEffectStats(effectId).resistanceStat;

        if (!IWorld(_world()).UD__checkItemEffect(itemId, effectId)) revert InvalidAction();

        PhysicalDamageStatsData memory attackStats;

        if (Stats.getCurrentHp(defenderId) > 0) {
            uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
            if (resistanceStat == ResistanceStat.None) {
                hit = true;
            } else if (resistanceStat == ResistanceStat.Strength) {
                hit = CombatMath.calculateStatusEffectHit(
                    uint256(rnChunks[0]),
                    attackStats.attackModifierBonus,
                    attackStats.critChanceBonus,
                    attacker.strength,
                    defender.strength,
                    resistanceStat
                );
            } else if (resistanceStat == ResistanceStat.Agility) {
                hit = CombatMath.calculateStatusEffectHit(
                    uint256(rnChunks[0]),
                    attackStats.attackModifierBonus,
                    attackStats.critChanceBonus,
                    attacker.agility,
                    defender.agility,
                    resistanceStat
                );
            } else if (resistanceStat == ResistanceStat.Intelligence) {
                hit = CombatMath.calculateStatusEffectHit(
                    uint256(rnChunks[0]),
                    attackStats.attackModifierBonus,
                    attackStats.critChanceBonus,
                    attacker.intelligence,
                    defender.intelligence,
                    resistanceStat
                );
            } else {
                revert UnrecognizedResistanceStat();
            }

            if (hit) {
                bytes32 targetId = StatusEffectTargeting.getTargetsSelf(effectId) ? attackerId : defenderId;
                IWorld(_world()).UD__applyStatusEffect(targetId, effectId);
            }
        }
    }
}
