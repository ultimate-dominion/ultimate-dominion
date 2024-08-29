// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {Math, WAD} from "@libraries/Math.sol";
import {LibChunks} from "@libraries/LibChunks.sol";
import {ArrayManagers} from "@libraries/ArrayManagers.sol";
import {
    Effects,
    EffectsData,
    RandomNumbers,
    EncounterEntity,
    EncounterEntityData,
    Stats,
    StatsData,
    Effects,
    EffectsData,
    Items,
    CharacterEquipment,
    CharacterEquipmentData,
    CombatEncounter,
    CombatEncounterData,
    CombatOutcome,
    CombatOutcomeData,
    Position,
    Mobs,
    Spawned,
    MobsData,
    Counters,
    AttackOutcome,
    AttackOutcomeData,
    ArmorStats,
    ArmorStatsData,
    WeaponStats,
    WeaponStatsData,
    StatRestrictions,
    StatRestrictionsData,
    SpellStatsData,
    SpellStats,
    ConsumableStats,
    PhysicalDamageStats,
    PhysicalDamageStatsData,
    MagicDamageStats,
    MagicDamageStatsData
} from "@codegen/index.sol";
import {RngRequestType, MobType, Alignment, EncounterType, ResistanceStat} from "@codegen/common.sol";
import {MonsterStats, NPCStats, Attack, AdjustedCombatStats} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {
    DEFAULT_MAX_TURNS,
    TO_HIT_MODIFIER,
    DEFENSE_MODIFIER,
    ATTACK_MODIFIER,
    CRIT_MODIFIER,
    CRIT_MULTIPLIER,
    BASE_GOLD_DROP,
    PRECISION
} from "../../constants.sol";
import "forge-std/console.sol";

contract CombatSystem is System {
    using Math for uint256;
    using Math for int256;

    function executeAttack(AttackOutcomeData memory attackOutcomeData, uint256 randomNumber)
        public
        returns (AttackOutcomeData memory)
    {
        _requireAccess(address(this), _msgSender());
        // if the defender is alive and attacker is alive, execute the action
        if (!getDied(attackOutcomeData.attackerId) && !getDied(attackOutcomeData.defenderId)) {
            // executeEffects
            for (uint256 i; i < attackOutcomeData.effectIds.length; i++) {
                EffectsData memory effectData = Effects.get(attackOutcomeData.effectIds[i]);

                require(effectData.effectExists, "action does not exist");
                //decode action data according to type
                if (uint8(effectData.effectType) == 1) {
                    // calculate damage

                    (attackOutcomeData.damagePerHit[i], attackOutcomeData.hit[i], attackOutcomeData.crit[i]) =
                    _calculatePhysicalEffect(
                        attackOutcomeData.effectIds[i],
                        attackOutcomeData.attackerId,
                        attackOutcomeData.defenderId,
                        attackOutcomeData.itemId,
                        randomNumber
                    );
                    attackOutcomeData.attackerDamageDelt += attackOutcomeData.damagePerHit[i];
                    // if hit deduct damage
                    if (attackOutcomeData.hit[i]) {
                        int256 currentHp = Stats.getCurrentHp(attackOutcomeData.defenderId)
                            - int256(attackOutcomeData.damagePerHit[i] / int256(ATTACK_MODIFIER));
                        if (currentHp <= 0) attackOutcomeData.defenderDied = true;
                        Stats.setCurrentHp(attackOutcomeData.defenderId, currentHp);
                    } else {
                        attackOutcomeData.miss[i] = true;
                    }
                } else if (uint8(effectData.effectType) == 2) {
                    // calculate damage

                    (attackOutcomeData.damagePerHit[i], attackOutcomeData.hit[i], attackOutcomeData.crit[i]) =
                    _calculateMagicEffect(
                        attackOutcomeData.effectIds[i],
                        attackOutcomeData.attackerId,
                        attackOutcomeData.defenderId,
                        attackOutcomeData.itemId,
                        randomNumber
                    );
                    attackOutcomeData.attackerDamageDelt += attackOutcomeData.damagePerHit[i];
                    // if hit deduct damage
                    if (attackOutcomeData.hit[i]) {
                        int256 currentHp = Stats.getCurrentHp(attackOutcomeData.defenderId)
                            - int256(attackOutcomeData.damagePerHit[i] / int256(ATTACK_MODIFIER));
                        if (currentHp <= 0) attackOutcomeData.defenderDied = true;
                        Stats.setCurrentHp(attackOutcomeData.defenderId, currentHp);
                    } else {
                        attackOutcomeData.miss[i] = true;
                    }
                } else if (uint8(effectData.effectType) == 3) {
                    // get statusEffect stats
                    // calculate damage

                    (attackOutcomeData.hit[i]) = _calculateStatusEffect(
                        attackOutcomeData.effectIds[i],
                        attackOutcomeData.attackerId,
                        attackOutcomeData.defenderId,
                        attackOutcomeData.itemId,
                        randomNumber
                    );
                } else {
                    revert("action type not recognized");
                }
            }
            if (attackOutcomeData.defenderDied) {
                EncounterEntity.setDied(attackOutcomeData.defenderId, true);
            }
            if (attackOutcomeData.attackerDied) {
                EncounterEntity.setDied(attackOutcomeData.attackerId, true);
            }
        }
        return attackOutcomeData;
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
        AdjustedCombatStats memory attacker = applyEquipmentAndStatusEffects(attackerId);
        //get defender
        AdjustedCombatStats memory defender = applyEquipmentAndStatusEffects(defenderId);
        // get weapon stats
        WeaponStatsData memory weapon = IWorld(_world()).UD__getWeaponStats(itemId);

        require(IWorld(_world()).UD__checkItemEffect(itemId, effectId), "INVALID ACTION");

        PhysicalDamageStatsData memory attackStats = IWorld(_world()).UD__getPhysicalDamageStats(effectId);

        if (defender.currentHp > 0) {
            uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
            (hit, crit) = _calculateActionModifier(
                uint256(rnChunks[0]),
                uint256(rnChunks[1]),
                attackStats.attackModifierBonus,
                attackStats.critChanceBonus,
                attacker.adjustedAgility,
                defender.adjustedAgility
            );

            if (hit) {
                damage = _calculateWeaponDamage(attackStats, attacker.adjustedStrength, weapon, rnChunks[2], crit)
                    - int256(
                        (
                            int256(defender.adjustedArmor) - attackStats.armorPenetration > 0
                                ? uint256(int256(defender.adjustedArmor) - attackStats.armorPenetration)
                                : uint256(0)
                        ) * DEFENSE_MODIFIER
                    );
                console.log("HIT!");
                if (crit) {
                    console.log("CRIT!");
                    damage = damage * int256(CRIT_MULTIPLIER);
                    crit = true;
                }
            } else {
                console.log("MISS!");
                damage = 0;
                hit = false;
            }
        } else {
            damage = 0;
            hit = false;
            crit = false;
        }
    }

    function _calculateWeaponDamage(
        PhysicalDamageStatsData memory attackStats,
        int256 attackerStrength,
        WeaponStatsData memory weapon,
        uint64 randomNumber,
        bool crit
    ) internal view returns (int256 _damage) {
        if (!crit) {
            int256 randomness = Math.toInt(randomNumber ^ 4);
            int256 baseDamage = attackStats.bonusDamage
                + int256(
                    randomness % weapon.maxDamage <= weapon.minDamage ? weapon.minDamage : randomness % weapon.maxDamage
                );
            _damage = _getStatBonus(attackerStrength, baseDamage) * int256(ATTACK_MODIFIER);
        } else {
            _damage = weapon.maxDamage;
        }
        console.log("DAMAGE");
        console.logInt(_damage);
    }

    function _getStatBonus(int256 adjustedStat, int256 baseDamage) internal pure returns (int256 _totalDamage) {
        if (adjustedStat > 0) {
            uint256 multiplier = uint256(Math.wmul(WAD, (adjustedStat * int256(5) * int256(WAD) / int256(1000))));
            _totalDamage = int256(Math.wmul(multiplier, baseDamage * int256(WAD)) / int256(WAD)) + baseDamage;
        } else {
            // if you have a negative adjusted stat.  do half damage
            _totalDamage = baseDamage / 2;
        }
    }

    function _calculateActionModifier(
        uint256 attackRoll,
        uint256 defenseRoll,
        int256 attackModifierBonus,
        int256 critChanceBonus,
        int256 attackerStat,
        int256 defenderStat
    ) internal view returns (bool attackLands, bool crit) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        uint256 attackTotal =
            (getStatModifier(attackerStat, attackModifierBonus) * (((attackRoll) % 1000))) / WAD * TO_HIT_MODIFIER;
        // attacker.agility + attackStats.attackModifierBonus + attackRoll * TO_HIT_MODIFIER
        uint256 defenseTotal = ((((defenseRoll) % 400) * getStatModifier(defenderStat, 0)) / WAD) * DEFENSE_MODIFIER;
        attackLands = attackTotal >= defenseTotal;

        if (attackLands) {
            crit = uint256(int256(attackTotal) + critChanceBonus) >= defenseTotal * CRIT_MODIFIER;
        }
    }

    function getStatModifier(int256 stat, int256 modifierBonus) internal pure returns (uint256 multiplier) {
        multiplier =
            (stat / int256(2) + modifierBonus) > 0 ? uint256((stat / int256(2) + modifierBonus) * int256(WAD)) : WAD;
    }

    function _calculateMagicEffect(
        bytes32 effectId,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 spellId,
        uint256 randomNumber
    ) internal returns (int256 damage, bool hit, bool crit) {
        // get attacker
        AdjustedCombatStats memory attacker = applyEquipmentAndStatusEffects(attackerId);
        //get defender
        AdjustedCombatStats memory defender = applyEquipmentAndStatusEffects(defenderId);
        SpellStatsData memory spell = IWorld(_world()).UD__getSpellStats(spellId);

        require(IWorld(_world()).UD__checkItemEffect(spellId, effectId), "INVALID ACTION");

        MagicDamageStatsData memory attackStats = IWorld(_world()).UD__getMagicDamageStats(effectId);

        if (defender.currentHp > 0) {
            uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
            (hit, crit) = _calculateActionModifier(
                uint256(rnChunks[0]),
                uint256(rnChunks[1]),
                attackStats.attackModifierBonus,
                attackStats.critChanceBonus,
                attacker.adjustedIntelligence,
                defender.adjustedIntelligence
            );

            if (hit) {
                damage = _calculateMagicDamage(
                    attackStats, spell, rnChunks[2], attacker.adjustedIntelligence, defender.adjustedIntelligence, crit
                );
                console.log("Magic damage");
                console.logInt(damage);
                if (crit) {
                    console.log("CRIT!");
                    damage = damage * int256(CRIT_MULTIPLIER);
                    crit = true;
                }
            } else {
                console.log("MISS!");
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
    ) internal view returns (int256 _damage) {
        console.log("MAGIC!");

        if (equippedSpell.minDamage > 0 && equippedSpell.maxDamage > 0) {
            int256 baseDamage;
            if (!crit) {
                baseDamage = attackStats.bonusDamage
                    + int256(
                        uint256(rnChunk) % uint256(equippedSpell.maxDamage) <= uint256(equippedSpell.minDamage)
                            ? equippedSpell.minDamage
                            : int256(uint256(rnChunk) % uint256(equippedSpell.maxDamage))
                    );
            } else {
                baseDamage = equippedSpell.maxDamage + attackStats.bonusDamage;
            }
            _damage = _getStatBonus(attackerIntelligence, baseDamage) * int256(ATTACK_MODIFIER)
                - int256((defenderIntelligence > 0 ? defenderIntelligence : int256(0)) * int256(DEFENSE_MODIFIER));
        } else if (equippedSpell.minDamage < 0 && equippedSpell.maxDamage < 0) {
            if (!crit) {
                _damage = (
                    (
                        attackStats.bonusDamage
                            + int256(
                                uint256(rnChunk) % uint256(equippedSpell.maxDamage) <= uint256(equippedSpell.minDamage)
                                    ? equippedSpell.minDamage
                                    : -int256(uint256(rnChunk) % uint256(equippedSpell.maxDamage))
                            )
                    ) * int256(ATTACK_MODIFIER)
                );
            } else {
                _damage = equippedSpell.maxDamage + attackStats.bonusDamage;
            }
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
        AdjustedCombatStats memory attacker = applyEquipmentAndStatusEffects(attackerId);
        //get defender
        AdjustedCombatStats memory defender = applyEquipmentAndStatusEffects(defenderId);
        // get weapon stats
        ResistanceStat resistanceStat = IWorld(_world()).UD__getStatusEffectStats(effectId).resistanceStat;

        require(IWorld(_world()).UD__checkItemEffect(itemId, effectId), "INVALID EFFECT");

        PhysicalDamageStatsData memory attackStats;

        if (defender.currentHp > 0) {
            uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
            if (resistanceStat == ResistanceStat.None) {
                hit = true;
            } else if (resistanceStat == ResistanceStat.Strength) {
                (hit,) = _calculateActionModifier(
                    uint256(rnChunks[0]),
                    uint256(rnChunks[1]),
                    attackStats.attackModifierBonus,
                    attackStats.critChanceBonus,
                    attacker.adjustedStrength,
                    defender.adjustedStrength
                );
            } else if (resistanceStat == ResistanceStat.Agility) {
                (hit,) = _calculateActionModifier(
                    uint256(rnChunks[0]),
                    uint256(rnChunks[1]),
                    attackStats.attackModifierBonus,
                    attackStats.critChanceBonus,
                    attacker.adjustedAgility,
                    defender.adjustedAgility
                );
            } else if (resistanceStat == ResistanceStat.Intelligence) {
                (hit,) = _calculateActionModifier(
                    uint256(rnChunks[0]),
                    uint256(rnChunks[1]),
                    attackStats.attackModifierBonus,
                    attackStats.critChanceBonus,
                    attacker.adjustedIntelligence,
                    defender.adjustedIntelligence
                );
            } else {
                revert("Unrecognized resistance stat");
            }

            if (hit) {
                IWorld(_world()).UD__applyStatusEffect(defenderId, effectId);
            }
        }
    }

    function applyEquipmentAndStatusEffects(bytes32 entityId)
        public
        returns (AdjustedCombatStats memory _adjustedStats)
    {
        AdjustedCombatStats memory entityEquipmentStats = IWorld(_world()).UD__applyEquipmentBonuses(entityId);

        _adjustedStats = IWorld(_world()).UD__calculateAllStatusEffects(entityId, entityEquipmentStats);
    }
}
