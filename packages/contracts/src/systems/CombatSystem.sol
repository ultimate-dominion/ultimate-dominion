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
import {RngRequestType, MobType, Alignment, EncounterType} from "@codegen/common.sol";
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
                    // get attack stats
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
    ) internal view returns (int256 damage, bool hit, bool crit) {
        // get attacker
        AdjustedCombatStats memory attacker = IWorld(_world()).UD__applyEquipmentBonuses(attackerId);
        //get defender
        AdjustedCombatStats memory defender = IWorld(_world()).UD__applyEquipmentBonuses(defenderId);
        // get weapon stats
        WeaponStatsData memory weapon = IWorld(_world()).UD__getWeaponStats(itemId);

        require(IWorld(_world()).UD__checkItemAction(itemId, effectId), "INVALID ACTION");

        PhysicalDamageStatsData memory attackStats = PhysicalDamageStats.get(effectId);

        if (defender.currentHp > 0) {
            uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
            (hit, crit) = _calculatePhysicalEffectModifier(
                uint256(rnChunks[0]), uint256(rnChunks[1]), attackStats, attacker, defender
            );

            if (hit) {
                damage = _calculateWeaponDamage(attackStats, attacker, weapon, rnChunks[2])
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
        AdjustedCombatStats memory attacker,
        WeaponStatsData memory weapon,
        uint64 randomNumber
    ) internal view returns (int256 _damage) {
        int256 randomness = Math.toInt(randomNumber ^ 4);
        int256 baseDamage = attackStats.bonusDamage
            + int256(randomness % weapon.maxDamage <= weapon.minDamage ? weapon.minDamage : randomness % weapon.maxDamage);
        _damage = _getStatBonus(attacker.adjustedStrength, baseDamage) * int256(ATTACK_MODIFIER);
        console.log("DAMAGE");
        console.logInt(_damage);
    }

    function _getStatBonus(uint256 adjustedStat, int256 baseDamage) internal pure returns (int256 _totalDamage) {
        uint256 multiplier = Math.wmul(WAD, (uint256(adjustedStat) * 5 * WAD / 1000));
        _totalDamage = int256(Math.wmul(multiplier, baseDamage * int256(WAD)) / int256(WAD)) + baseDamage;
    }

    function _calculatePhysicalEffectModifier(
        uint256 attackRoll,
        uint256 defenseRoll,
        PhysicalDamageStatsData memory attackStats,
        AdjustedCombatStats memory attacker,
        AdjustedCombatStats memory defender
    ) internal view returns (bool attackLands, bool crit) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        uint256 attackTotal = (
            getStatModifier(attacker.adjustedAgility, attackStats.attackModifierBonus) * (((attackRoll) % 1000))
        ) / WAD * TO_HIT_MODIFIER;
        // attacker.agility + attackStats.attackModifierBonus + attackRoll * TO_HIT_MODIFIER
        uint256 defenseTotal =
            ((((defenseRoll) % 600) * getStatModifier(defender.adjustedAgility, 0)) / WAD) * DEFENSE_MODIFIER;
        attackLands = attackTotal >= defenseTotal;

        if (attackLands) {
            crit = uint256(int256(attackTotal) + attackStats.critChanceBonus) >= defenseTotal * CRIT_MODIFIER;
        }
    }

    function getStatModifier(uint256 stat, int256 modifierBonus) internal pure returns (uint256 multiplier) {
        multiplier = Math.add((stat / 2), modifierBonus) * WAD;
    }

    function _calculateMagicEffect(
        bytes32 effectId,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 spellId,
        uint256 randomNumber
    ) internal returns (int256 damage, bool hit, bool crit) {
        // get attacker
        AdjustedCombatStats memory attacker = IWorld(_world()).UD__applyEquipmentBonuses(attackerId);
        //get defender
        AdjustedCombatStats memory defender = IWorld(_world()).UD__applyEquipmentBonuses(defenderId);
        SpellStatsData memory spell = IWorld(_world()).UD__getSpellStats(spellId);

        require(IWorld(_world()).UD__checkItemAction(spellId, effectId), "INVALID ACTION");

        MagicDamageStatsData memory attackStats = MagicDamageStats.get(effectId);

        if (defender.currentHp > 0) {
            uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
            (hit, crit) = _calculateMagicEffectModifier(
                uint256(rnChunks[0]), uint256(rnChunks[1]), attackStats, attacker, defender
            );

            if (hit) {
                damage = _calculateMagicDamage(attackStats, spell, rnChunks[2], attacker, defender);
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
        AdjustedCombatStats memory attacker,
        AdjustedCombatStats memory defender
    ) internal returns (int256 _damage) {
        console.log("MAGIC!");
        if (equippedSpell.minDamage > 0 && equippedSpell.maxDamage > 0) {
            int256 baseDamage = attackStats.bonusDamage
                + int256(
                    uint256(rnChunk) % uint256(equippedSpell.maxDamage + 1) <= uint256(equippedSpell.minDamage)
                        ? equippedSpell.minDamage
                        : int256(uint256(rnChunk) % uint256(equippedSpell.maxDamage + 1))
                );

            _damage = _getStatBonus(attacker.adjustedIntelligence, baseDamage) * int256(ATTACK_MODIFIER)
                - int256(
                    (
                        int256(defender.adjustedIntelligence) > 0
                            ? uint256(int256(defender.adjustedIntelligence))
                            : uint256(0)
                    ) * DEFENSE_MODIFIER
                );
        } else if (equippedSpell.minDamage < 0 && equippedSpell.maxDamage < 0) {
            _damage = (
                (
                    attackStats.bonusDamage
                        + int256(
                            uint256(rnChunk) % uint256(equippedSpell.maxDamage + 1) <= uint256(equippedSpell.minDamage + 1)
                                ? equippedSpell.minDamage
                                : -int256(uint256(rnChunk) % uint256(equippedSpell.maxDamage))
                        )
                ) * int256(ATTACK_MODIFIER)
            );
        }
    }

    function _calculateMagicEffectModifier(
        uint256 attackRoll,
        uint256 defenseRoll,
        MagicDamageStatsData memory attackStats,
        AdjustedCombatStats memory attacker,
        AdjustedCombatStats memory defender
    ) internal view returns (bool attackLands, bool crit) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        uint256 attackTotal = (
            getStatModifier(attacker.adjustedIntelligence, attackStats.attackModifierBonus) * (((attackRoll) % 1000))
                / WAD
        ) * TO_HIT_MODIFIER;
        // attacker.agility + attackStats.attackModifierBonus + attackRoll * TO_HIT_MODIFIER
        uint256 defenseTotal =
            ((((defenseRoll) % 600) * getStatModifier(defender.adjustedIntelligence, 0)) / WAD) * DEFENSE_MODIFIER;
        attackLands = attackTotal >= defenseTotal;

        if (attackLands) {
            crit = uint256(int256(attackTotal) + attackStats.critChanceBonus) >= defenseTotal * CRIT_MODIFIER;
        }
    }
}
