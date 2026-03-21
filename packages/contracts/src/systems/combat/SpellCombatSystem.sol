// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    SpellConfig,
    SpellConfigData,
    ComputedEffectMods,
    ComputedEffectModsData,
    WeaponEnchant,
    WeaponEnchantData,
    SpellUsesTracking,
    SpellUsesTrackingData,
    Stats,
    StatusEffectValidity,
    CombatEncounter,
    EncounterEntity,
    ClassMultipliers
} from "@codegen/index.sol";
import {ResistanceStat} from "@codegen/common.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {CombatMath} from "@libraries/CombatMath.sol";
import {LibChunks} from "@libraries/LibChunks.sol";
import {Math, WAD} from "@libraries/Math.sol";
import {_requireSystemOrAdmin} from "../../utils.sol";
import {CLASS_MULTIPLIER_BASE} from "../../../constants.sol";

error SpellUsesExhausted();

contract SpellCombatSystem is System {
    using Math for int256;

    /// @notice Compute percentage-based modifiers from caster/target stats and store them.
    /// @dev Self-buffs use caster stats; debuffs use target stats (determined by caller).
    ///      Writes to ComputedEffectMods so EffectsSystem reads computed values instead of flat.
    function computeAndStoreModifiers(
        bytes32 targetEntityId,
        bytes32 effectId,
        AdjustedCombatStats memory sourceStats
    ) public {
        _requireSystemOrAdmin(_msgSender());
        SpellConfigData memory cfg = SpellConfig.get(effectId);

        int256 strMod = (cfg.strPct * sourceStats.strength) / 10000;
        int256 agiMod = (cfg.agiPct * sourceStats.agility) / 10000;
        int256 intMod = (cfg.intPct * sourceStats.intelligence) / 10000;
        int256 hpMod = (cfg.hpPct * sourceStats.maxHp) / 10000;
        int256 armorMod = cfg.armorFlat;

        ComputedEffectMods.set(targetEntityId, effectId, ComputedEffectModsData({
            strModifier: strMod,
            agiModifier: agiMod,
            intModifier: intMod,
            armorModifier: armorMod,
            hpModifier: hpMod,
            exists: true
        }));
    }

    /// @notice Calculate upfront spell damage (physical or magic path).
    function calculateSpellDamage(
        bytes32 effectId,
        bytes32 attackerId,
        AdjustedCombatStats memory attackerStats,
        AdjustedCombatStats memory defenderStats,
        uint256 randomNumber
    ) public view returns (int256 damage) {
        SpellConfigData memory cfg = SpellConfig.get(effectId);
        if (cfg.spellMinDamage == 0 && cfg.spellMaxDamage == 0) return 0;

        uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);

        // Roll base damage
        int256 roll = int256(uint256(rnChunks[0]) % uint256(cfg.spellMaxDamage) + 1);
        if (roll < cfg.spellMinDamage) roll = cfg.spellMinDamage;

        // Add stat scaling
        int256 scalingStat = _getScalingStat(attackerStats, cfg.dmgScalingStat);
        int256 statBonus = (scalingStat * cfg.dmgPerStat) / 1000;
        damage = roll + statBonus;
        if (damage < 1) damage = 1;

        // Apply variance ±25%
        damage = CombatMath.applyDamageVariance(damage, rnChunks[1] ^ rnChunks[2]);
        if (damage < 1) damage = 1;

        if (cfg.dmgIsPhysical) {
            // Physical path: armor reduction + physMult
            damage = damage - CombatMath.calculateArmorModifier(defenderStats.armor, 0, damage);
            if (damage < 1) damage = 1;

            uint256 physMult = ClassMultipliers.getPhysicalDamageMultiplier(attackerId);
            if (physMult == 0) physMult = CLASS_MULTIPLIER_BASE;
            damage = (damage * int256(physMult)) / int256(CLASS_MULTIPLIER_BASE);
        } else {
            // Magic path: magic resist + spellMult
            if (damage > 0) {
                damage -= CombatMath.calculateMagicResistance(defenderStats.intelligence, damage);
            }
            if (damage < 1) damage = 1;

            uint256 spellMult = ClassMultipliers.getSpellDamageMultiplier(attackerId);
            if (spellMult == 0) spellMult = CLASS_MULTIPLIER_BASE;
            damage = (damage * int256(spellMult)) / int256(CLASS_MULTIPLIER_BASE);
        }

        if (damage < 1) damage = 1;
    }

    /// @notice Store weapon enchant config on entity (Sorcerer's Arcane Infusion).
    function applyWeaponEnchant(
        bytes32 entityId,
        bytes32 effectId,
        uint256 currentTurn
    ) public {
        _requireSystemOrAdmin(_msgSender());
        SpellConfigData memory cfg = SpellConfig.get(effectId);
        uint256 validTurns = StatusEffectValidity.getValidTurns(effectId);

        WeaponEnchant.set(entityId, WeaponEnchantData({
            effectId: effectId,
            bonusDmgMin: cfg.spellMinDamage,
            bonusDmgMax: cfg.spellMaxDamage,
            dmgPerInt: cfg.dmgPerStat,
            turnApplied: currentTurn,
            validTurns: validTurns
        }));
    }

    /// @notice Calculate bonus damage from active weapon enchant on attacker.
    /// @return bonus The bonus magic damage (0 if no enchant or expired).
    function calculateEnchantBonus(
        bytes32 attackerId,
        AdjustedCombatStats memory attackerStats,
        AdjustedCombatStats memory defenderStats,
        uint256 randomNumber
    ) public view returns (int256 bonus) {
        WeaponEnchantData memory enchant = WeaponEnchant.get(attackerId);
        if (enchant.effectId == bytes32(0)) return 0;

        // Check expiry
        bytes32 encounterId = EncounterEntity.getEncounterId(attackerId);
        if (encounterId == bytes32(0)) return 0;
        uint256 currentTurn = CombatEncounter.getCurrentTurn(encounterId);
        if (enchant.validTurns > 0 && currentTurn > enchant.turnApplied + enchant.validTurns) {
            return 0;
        }

        // Roll enchant damage
        uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
        int256 roll = int256(uint256(rnChunks[0]) % uint256(enchant.bonusDmgMax) + 1);
        if (roll < enchant.bonusDmgMin) roll = enchant.bonusDmgMin;

        // INT scaling using cached attacker stats
        int256 intBonus = (attackerStats.intelligence * enchant.dmgPerInt) / 1000;
        bonus = roll + intBonus;
        if (bonus < 1) bonus = 1;

        // Magic resist
        bonus -= CombatMath.calculateMagicResistance(defenderStats.intelligence, bonus);
        if (bonus < 1) bonus = 1;

        // Spell damage multiplier
        uint256 spellMult = ClassMultipliers.getSpellDamageMultiplier(attackerId);
        if (spellMult == 0) spellMult = CLASS_MULTIPLIER_BASE;
        bonus = (bonus * int256(spellMult)) / int256(CLASS_MULTIPLIER_BASE);
        if (bonus < 1) bonus = 1;
    }

    /// @notice Consume one spell use. Returns false if exhausted.
    function consumeSpellUse(
        bytes32 encounterId,
        bytes32 entityId,
        bytes32 effectId
    ) public returns (bool canCast) {
        _requireSystemOrAdmin(_msgSender());
        SpellConfigData memory cfg = SpellConfig.get(effectId);
        if (cfg.maxUses == 0) return true; // unlimited

        SpellUsesTrackingData memory tracking = SpellUsesTracking.get(encounterId, entityId, effectId);

        if (!tracking.initialized) {
            // First cast this encounter — initialize
            SpellUsesTracking.set(encounterId, entityId, effectId, SpellUsesTrackingData({
                usesRemaining: cfg.maxUses - 1,
                initialized: true
            }));
            return true;
        }

        if (tracking.usesRemaining == 0) return false;

        SpellUsesTracking.setUsesRemaining(encounterId, entityId, effectId, tracking.usesRemaining - 1);
        return true;
    }

    /// @notice Heal caster for hpPct% of maxHp, capped at maxHp.
    function applySpellHeal(
        bytes32 entityId,
        int256 hpPct,
        int256 maxHp
    ) public {
        _requireSystemOrAdmin(_msgSender());
        if (hpPct <= 0) return;

        int256 healAmount = (hpPct * maxHp) / 10000;
        if (healAmount <= 0) return;

        int256 currentHp = Stats.getCurrentHp(entityId);
        int256 newHp = currentHp + healAmount;
        if (newHp > maxHp) newHp = maxHp;
        Stats.setCurrentHp(entityId, newHp);
    }

    /// @notice Check if a SpellConfig exists for this effectId.
    function hasSpellConfig(bytes32 effectId) public view returns (bool) {
        SpellConfigData memory cfg = SpellConfig.get(effectId);
        // A spell config exists if any percentage, damage, or flag is set
        return cfg.strPct != 0 || cfg.agiPct != 0 || cfg.intPct != 0 ||
               cfg.hpPct != 0 || cfg.armorFlat != 0 ||
               cfg.spellMinDamage != 0 || cfg.spellMaxDamage != 0 ||
               cfg.maxUses != 0 || cfg.isWeaponEnchant;
    }

    /// @notice Clean up enchant and computed mods for an entity after encounter.
    function cleanupEntitySpellState(bytes32 entityId, bytes32[] memory appliedEffectIds) public {
        _requireSystemOrAdmin(_msgSender());
        // Clear weapon enchant
        WeaponEnchant.deleteRecord(entityId);

        // Clear computed effect mods for each applied effect
        for (uint256 i; i < appliedEffectIds.length; i++) {
            bytes32 baseEffectId = bytes32(bytes8(appliedEffectIds[i]));
            ComputedEffectMods.deleteRecord(entityId, baseEffectId);
        }
    }

    function _getScalingStat(AdjustedCombatStats memory stats, ResistanceStat scalingStat)
        internal
        pure
        returns (int256)
    {
        if (scalingStat == ResistanceStat.Strength) return stats.strength;
        if (scalingStat == ResistanceStat.Agility) return stats.agility;
        return stats.intelligence; // default to INT
    }
}
