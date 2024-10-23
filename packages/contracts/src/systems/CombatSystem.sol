// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {Math, WAD} from "@libraries/Math.sol";
import {LibChunks} from "@libraries/LibChunks.sol";
import {ArrayManagers} from "@libraries/ArrayManagers.sol";
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
            (hit, crit) = _calculateToHit(
                uint256(rnChunks[0]),
                attackStats.attackModifierBonus,
                attackStats.critChanceBonus,
                attacker.agility,
                defender.agility
            );
            if (hit) {
                damage = _calculateWeaponDamage(
                    attackStats, attacker.strength, defender.strength, weapon, rnChunks[2], crit
                ) - _calculateArmorModifier(defender.armor, attackStats.armorPenetration, damage);
                if (crit) {
                    damage = damage * int256(CRIT_MULTIPLIER);
                    crit = true;
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

    function _calculateArmorModifier(int256 armor, int256 armorPenetration, int256 damage)
        internal
        pure
        returns (int256 _totalArmorModifier)
    {
        if (armor - armorPenetration > 0) {
            _totalArmorModifier = (armor - armorPenetration) * int256(DEFENSE_MODIFIER);
        }
        // if total armor is greater than damage then overall damage should be 0
        if (damage - (int256(armor) - armorPenetration) < 0) {
            _totalArmorModifier = damage;
        }
    }

    function _calculateWeaponDamage(
        PhysicalDamageStatsData memory attackStats,
        int256 attackerStrength,
        int256 defenderStrength,
        WeaponStatsData memory weapon,
        uint64 randomNumber,
        bool crit
    ) internal pure returns (int256 _damage) {
        if (!crit) {
            int256 randomness = Math.toInt(randomNumber ^ 4);
            int256 baseDamage = (
                attackStats.bonusDamage
                    + int256(
                        randomness % weapon.maxDamage <= weapon.minDamage ? weapon.minDamage : randomness % weapon.maxDamage
                    )
            ) * int256(ATTACK_MODIFIER);
            _damage = _addStatBonus(attackerStrength, defenderStrength, baseDamage);
        } else {
            _damage = _addStatBonus(attackerStrength, defenderStrength, weapon.maxDamage * int256(ATTACK_MODIFIER));
        }
    }

    function _addStatBonus(int256 attackerStat, int256 defenderStat, int256 baseDamage)
        internal
        pure
        returns (int256 _totalDamage)
    {
        int256 baseDifference = (attackerStat * int256(ATTACK_MODIFIER)) - (defenderStat * int256(WAD));
        if (baseDifference > 0) {
            // uint256 multiplier = uint256(Math.wmul(baseDamage * int256(WAD), (attackerStat * int256(WAD) / 200))) ;
            int256 _unroundedDamage = baseDifference + baseDamage;

            _totalDamage = Math.roundInt(_unroundedDamage, int256(WAD)) / int256(WAD);
        } else if (baseDifference < 0 && Math.absolute(baseDifference / int256(WAD)) >= uint256(attackerStat)) {
            // if the stat difference is equal to or greater than the attackers base stat subtract difference from damage
            if (baseDamage + baseDifference > 0) {
                _totalDamage = (baseDamage + baseDifference) / int256(WAD);
            } else {
                // if damage is negative minimu damage is 1
                _totalDamage = 1;
            }
        } else {
            _totalDamage = baseDamage / int256(WAD);
        }
    }

    function _calculateToHit(
        uint256 attackRoll,
        int256 attackModifierBonus,
        int256 critChanceBonus,
        int256 attackerStat,
        int256 defenderStat
    ) internal view returns (bool attackLands, bool crit) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691

        uint256 hitDampener = (attackerStat > defenderStat ? ATTACKER_HIT_DAMPENER : DEFENDER_HIT_DAMPENER);

        int256 startingProbability = STARTING_HIT_PROBABILITY
            + int256(
                (((attackerStat - defenderStat) + attackModifierBonus) * 1000)
                    / int256(int256(Math.absolute(attackerStat - defenderStat) + hitDampener) * 10)
            );

        uint256 probability = uint256(uint256(startingProbability) > 98 ? 98 : uint256(startingProbability));

        attackLands = (attackRoll % 100) + 1 <= probability;

        if (attackLands) {
            crit = ((int256(attackRoll % 100) - critChanceBonus) + 1) < 5;
        }
    }

    function _getStatModifier(int256 stat, int256 modifierBonus) internal pure returns (uint256 multiplier) {
        multiplier = (((stat + modifierBonus) * int256(WAD)) / int256(PROFICIENCY_DENOMINATOR)) > 0
            ? uint256(((stat + modifierBonus) * int256(WAD)) / int256(PROFICIENCY_DENOMINATOR))
            : WAD;
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
            (hit, crit) = _calculateToHit(
                uint256(rnChunks[0]),
                attackStats.attackModifierBonus,
                attackStats.critChanceBonus,
                attacker.intelligence,
                defender.intelligence
            );
            if (hit) {
                damage = _calculateMagicDamage(
                    attackStats, spell, rnChunks[2], attacker.intelligence, defender.intelligence, crit
                );
                if (damage < 0) {
                    int256 currentHp = Stats.getCurrentHp(defenderId);
                    int256 maxHp = Stats.getMaxHp(defenderId);

                    if (currentHp - damage > int256(maxHp)) {
                        damage = -(maxHp - currentHp);
                    }
                }

                if (crit) {
                    damage = damage * int256(CRIT_MULTIPLIER);

                    if (damage < 0) {
                        int256 maxHp = Stats.getMaxHp(defenderId);
                        int256 currentHp = Stats.getCurrentHp(defenderId);

                        if (currentHp - damage > int256(maxHp)) {
                            damage = -(maxHp - currentHp);
                        }
                    }

                    crit = true;
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

    function _calculateMagicDamage(
        MagicDamageStatsData memory attackStats,
        SpellStatsData memory equippedSpell,
        uint64 rnChunk,
        int256 attackerIntelligence,
        int256 defenderIntelligence,
        bool crit
    ) internal pure returns (int256 _damage) {
        // if (equippedSpell.minDamage > 0 && equippedSpell.maxDamage > 0) {
        int256 baseDamage;
        if (!crit) {
            baseDamage = (
                attackStats.bonusDamage
                    + int256(
                        uint256(rnChunk) % uint256(equippedSpell.maxDamage) <= uint256(equippedSpell.minDamage)
                            ? equippedSpell.minDamage
                            : int256(uint256(rnChunk) % uint256(equippedSpell.maxDamage))
                    )
            ) * int256(ATTACK_MODIFIER);
        } else {
            baseDamage = (equippedSpell.maxDamage + attackStats.bonusDamage) * int256(ATTACK_MODIFIER);
        }
        _damage = (
            _addStatBonus(attackerIntelligence, defenderIntelligence, baseDamage)
                - int256(_addStatBonus(defenderIntelligence, defenderIntelligence, int256(DEFENSE_MODIFIER)))
        );
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
                (hit,) = _calculateToHit(
                    uint256(rnChunks[0]),
                    attackStats.attackModifierBonus,
                    attackStats.critChanceBonus,
                    attacker.strength,
                    defender.strength
                );
            } else if (resistanceStat == ResistanceStat.Agility) {
                (hit,) = _calculateToHit(
                    uint256(rnChunks[0]),
                    attackStats.attackModifierBonus,
                    attackStats.critChanceBonus,
                    attacker.agility,
                    defender.agility
                );
            } else if (resistanceStat == ResistanceStat.Intelligence) {
                (hit,) = _calculateToHit(
                    uint256(rnChunks[0]),
                    attackStats.attackModifierBonus,
                    attackStats.critChanceBonus,
                    attacker.intelligence,
                    defender.intelligence
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
