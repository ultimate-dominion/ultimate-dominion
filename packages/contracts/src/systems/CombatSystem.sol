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
    Effects,
    EffectsData,
    CombatEncounter,
    CombatEncounterData,
    ActionOutcome,
    ActionOutcomeData,
    WeaponStats,
    Items,
    WeaponStatsData,
    SpellStatsData,
    SpellStats,
    PhysicalDamageStats,
    PhysicalDamageStatsData,
    MagicDamageStats,
    MagicDamageStatsData
} from "@codegen/index.sol";
import {ResistanceStat, EffectType, ItemType} from "@codegen/common.sol";
import {Action, AdjustedCombatStats} from "@interfaces/Structs.sol";
import {_requireAccess} from "../utils.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {
    DEFENSE_MODIFIER,
    ATTACK_MODIFIER,
    CRIT_MULTIPLIER,
    PROFICIENCY_DENOMINATOR,
    STARTING_HIT_PROBABILITY,
    ATTACKER_HIT_DAMPENER,
    DEFENDER_HIT_DAMPENER
} from "../../constants.sol";
import "forge-std/console.sol";

contract CombatSystem is System {
    using Math for uint256;
    using Math for int256;

    function executeAction(ActionOutcomeData memory actionOutcomeData, uint256 randomNumber)
        public
        returns (ActionOutcomeData memory)
    {
        _requireAccess(address(this), _msgSender());

        // if the defender is alive and attacker is alive, execute the action
        if (!getDied(actionOutcomeData.attackerId) && !getDied(actionOutcomeData.defenderId)) {
            // executeEffects
            for (uint256 i; i < actionOutcomeData.effectIds.length; i++) {
                // hash the random number with the attack number and the effectId to allow different attack outcomes in the same block
                randomNumber = uint256(keccak256(abi.encode(randomNumber, i, actionOutcomeData.effectIds[i])));

                EffectsData memory effectData = Effects.get(actionOutcomeData.effectIds[i]);
                require(effectData.effectExists, "action does not exist");
                // if actor is a character.  require item is equipped
                if (
                    IWorld(_world()).UD__isValidCharacterId(actionOutcomeData.attackerId)
                        && Items.getItemType(actionOutcomeData.itemId) != ItemType.Consumable
                ) {
                    require(
                        IWorld(_world()).UD__isEquipped(actionOutcomeData.attackerId, actionOutcomeData.itemId),
                        "Item not equipped"
                    );
                }
                //decode action data according to type
                if (effectData.effectType == EffectType.PhysicalDamage) {
                    // calculate damage
                    (actionOutcomeData.damagePerHit[i], actionOutcomeData.hit[i], actionOutcomeData.crit[i]) =
                    _calculatePhysicalEffect(
                        actionOutcomeData.effectIds[i],
                        actionOutcomeData.attackerId,
                        actionOutcomeData.defenderId,
                        actionOutcomeData.itemId,
                        randomNumber
                    );
                    actionOutcomeData.attackerDamageDelt += actionOutcomeData.damagePerHit[i];
                    // if hit deduct damage
                    if (actionOutcomeData.hit[i]) {
                        int256 currentHp =
                            Stats.getCurrentHp(actionOutcomeData.defenderId) - int256(actionOutcomeData.damagePerHit[i]);
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
                        randomNumber
                    );
                    actionOutcomeData.attackerDamageDelt += actionOutcomeData.damagePerHit[i];
                    // if hit deduct damage
                    if (actionOutcomeData.hit[i]) {
                        int256 currentHp =
                            Stats.getCurrentHp(actionOutcomeData.defenderId) - int256(actionOutcomeData.damagePerHit[i]);

                        Stats.setCurrentHp(actionOutcomeData.defenderId, currentHp);
                        if (currentHp <= 0) actionOutcomeData.defenderDied = true;
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
                        randomNumber
                    );
                    // if combat consumable, consume the item
                    // IWorld(_world()).UD__consumeItem(actionOutcomeData.attackerId, actionOutcomeData.itemId);
                } else {
                    revert("action type not recognized");
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
        uint256 randomNumber
    ) internal returns (int256 damage, bool hit, bool crit) {
        // get attacker
        AdjustedCombatStats memory attacker = IWorld(_world()).UD__calculateAllStatusEffects(attackerId);
        //get defender
        AdjustedCombatStats memory defender = IWorld(_world()).UD__calculateAllStatusEffects(defenderId);
        // get weapon stats
        WeaponStatsData memory weapon = IWorld(_world()).UD__getWeaponStats(itemId);

        require(IWorld(_world()).UD__checkItemEffect(itemId, effectId), "INVALID ACTION");

        PhysicalDamageStatsData memory attackStats = IWorld(_world()).UD__getPhysicalDamageStats(effectId);
        if (Stats.getCurrentHp(defenderId) > 0) {
            uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
            (hit, crit) = CombatMath.calculateToHit(
                uint256(rnChunks[0]),
                attackStats.attackModifierBonus,
                attackStats.critChanceBonus,
                attacker.agility,
                defender.agility
            );
            if (hit) {
                damage = CombatMath.calculateWeaponDamage(
                    attackStats, attacker.strength, defender.strength, weapon, rnChunks[2], crit
                ) - CombatMath.calculateArmorModifier(defender.armor, attackStats.armorPenetration, damage);

                damage = damage < int256(0) ? int256(0) : damage;

                damage = CombatMath.applyCriticalHit(damage, crit);
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
        uint256 spellId,
        uint256 randomNumber
    ) internal returns (int256 damage, bool hit, bool crit) {
        // get attacker
        AdjustedCombatStats memory attacker = IWorld(_world()).UD__calculateAllStatusEffects(attackerId);
        //get defender
        AdjustedCombatStats memory defender = IWorld(_world()).UD__calculateAllStatusEffects(defenderId);
        // get spell data
        SpellStatsData memory spell = IWorld(_world()).UD__getSpellStats(spellId);

        require(IWorld(_world()).UD__checkItemEffect(spellId, effectId), "INVALID ACTION");

        MagicDamageStatsData memory attackStats = IWorld(_world()).UD__getMagicDamageStats(effectId);

        if (Stats.getCurrentHp(defenderId) > 0) {
            uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
            (hit, crit) = CombatMath.calculateToHit(
                uint256(rnChunks[0]),
                attackStats.attackModifierBonus,
                attackStats.critChanceBonus,
                attacker.intelligence,
                defender.intelligence
            );
            if (hit) {
                damage = CombatMath.calculateMagicDamage(
                    attackStats, spell, rnChunks[2], attacker.intelligence, defender.intelligence, crit
                );
                int256 currentHp = Stats.getCurrentHp(defenderId);
                int256 maxHp = Stats.getMaxHp(defenderId);
                damage = CombatMath.calculateFinalMagicDamage(damage, currentHp, maxHp, crit);
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
        uint256 randomNumber
    ) internal returns (bool hit) {
        // get attacker
        AdjustedCombatStats memory attacker = IWorld(_world()).UD__calculateAllStatusEffects(attackerId);
        //get defender
        AdjustedCombatStats memory defender = IWorld(_world()).UD__calculateAllStatusEffects(defenderId);
        // get weapon stats
        ResistanceStat resistanceStat = IWorld(_world()).UD__getStatusEffectStats(effectId).resistanceStat;

        require(IWorld(_world()).UD__checkItemEffect(itemId, effectId), "INVALID EFFECT");

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
                revert("Unrecognized resistance stat");
            }

            if (hit) {
                IWorld(_world()).UD__applyStatusEffect(defenderId, effectId);
            }
        }
    }
}
