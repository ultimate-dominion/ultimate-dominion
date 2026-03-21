// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {
    Effects,
    SpellConfig,
    SpellConfigData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectTargeting,
    StatusEffectValidity,
    StatusEffectValidityData,
    SpellScaling
} from "@codegen/index.sol";
import {EffectType, ResistanceStat} from "@codegen/common.sol";

/**
 * @title DeployClassSpellsV2
 * @notice Populates SpellConfig for all 9 class spells with percentage-based scaling.
 *         Updates existing StatusEffectStats entries to act as fallback/placeholder
 *         (ComputedEffectMods overrides them at cast time).
 *
 * Prerequisites:
 * - World must be deployed with new SpellConfig table
 * - DeployClassSpells (V1) must have already created the base effects and spell items
 *
 * Usage:
 *   forge script DeployClassSpellsV2 --broadcast --sig "run(address)" <WORLD_ADDRESS>
 */
contract DeployClassSpellsV2 is Script {
    IWorld public world;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== DeployClassSpellsV2 - Percentage-Based Spell System ===");

        _deploySpellConfigs();
        _updateStatusEffectStats();
        _updateStatusEffectValidity();

        vm.stopBroadcast();

        console.log("=== DeployClassSpellsV2 Complete ===");
    }

    function _effectId(string memory name) internal pure returns (bytes32) {
        return bytes32(bytes8(keccak256(abi.encode(name))));
    }

    function _deploySpellConfigs() internal {
        console.log("Deploying SpellConfig entries...");

        // Warrior - Battle Cry: +25% STR buff, +10% maxHp heal, +800 armor, 5-10 phys dmg, 0.5/STR, 2 uses
        SpellConfig.set(_effectId("battle_cry"), SpellConfigData({
            strPct: 2500, agiPct: 0, intPct: 0, hpPct: 1000,
            armorFlat: 800, spellMinDamage: 5, spellMaxDamage: 10,
            dmgPerStat: 500, dmgScalingStat: ResistanceStat.Strength,
            dmgIsPhysical: true, maxUses: 2, isWeaponEnchant: false
        }));
        console.log("  battle_cry SpellConfig set");

        // Paladin - Divine Shield: +15% STR buff, +15% maxHp heal, +1000 armor, no dmg, 2 uses
        SpellConfig.set(_effectId("divine_shield"), SpellConfigData({
            strPct: 1500, agiPct: 0, intPct: 0, hpPct: 1500,
            armorFlat: 1000, spellMinDamage: 0, spellMaxDamage: 0,
            dmgPerStat: 0, dmgScalingStat: ResistanceStat.None,
            dmgIsPhysical: false, maxUses: 2, isWeaponEnchant: false
        }));
        console.log("  divine_shield SpellConfig set");

        // Ranger - Marked Shot: -20% AGI debuff, -500 armor, 4-8 phys dmg, 0.4/AGI, 1 use
        SpellConfig.set(_effectId("marked_shot"), SpellConfigData({
            strPct: 0, agiPct: -2000, intPct: 0, hpPct: 0,
            armorFlat: -500, spellMinDamage: 4, spellMaxDamage: 8,
            dmgPerStat: 400, dmgScalingStat: ResistanceStat.Agility,
            dmgIsPhysical: true, maxUses: 1, isWeaponEnchant: false
        }));
        console.log("  marked_shot SpellConfig set");

        // Rogue - Expose Weakness: -15% STR debuff, -800 armor, 4-8 phys dmg, 0.4/AGI, 1 use
        SpellConfig.set(_effectId("expose_weakness"), SpellConfigData({
            strPct: -1500, agiPct: 0, intPct: 0, hpPct: 0,
            armorFlat: -800, spellMinDamage: 4, spellMaxDamage: 8,
            dmgPerStat: 400, dmgScalingStat: ResistanceStat.Agility,
            dmgIsPhysical: true, maxUses: 1, isWeaponEnchant: false
        }));
        console.log("  expose_weakness SpellConfig set");

        // Druid - Entangle: -15% STR, -25% AGI debuff, -300 armor, 3-6 magic dmg, 0.3/INT, 1 use
        SpellConfig.set(_effectId("entangle"), SpellConfigData({
            strPct: -1500, agiPct: -2500, intPct: 0, hpPct: 0,
            armorFlat: -300, spellMinDamage: 3, spellMaxDamage: 6,
            dmgPerStat: 300, dmgScalingStat: ResistanceStat.Intelligence,
            dmgIsPhysical: false, maxUses: 1, isWeaponEnchant: false
        }));
        console.log("  entangle SpellConfig set");

        // Warlock - Soul Drain: -12% STR, -12% INT debuff, 4-8 magic dmg, 0.4/INT, 2 uses
        SpellConfig.set(_effectId("soul_drain_curse"), SpellConfigData({
            strPct: -1200, agiPct: 0, intPct: -1200, hpPct: 0,
            armorFlat: 0, spellMinDamage: 4, spellMaxDamage: 8,
            dmgPerStat: 400, dmgScalingStat: ResistanceStat.Intelligence,
            dmgIsPhysical: false, maxUses: 2, isWeaponEnchant: false
        }));
        console.log("  soul_drain_curse SpellConfig set");

        // Wizard - Arcane Blast: pure damage, 5-10 magic, 0.5/INT, 3 uses
        // Note: arcane_blast_damage is a MagicDamage effect, not a StatusEffect.
        // SpellConfig is only for StatusEffect type effects. Wizard uses existing magic damage path.
        // We set config on arcane_blast_damage anyway for the maxUses tracking if needed.
        // Actually — Arcane Blast has no status effect, it's pure damage via MagicDamage effect type.
        // The spell use tracking needs to happen in the MagicDamage path too if we want to limit uses.
        // For now, Wizard's Arcane Blast works via the existing magic damage path and doesn't need SpellConfig.
        // Skip — Wizard uses existing MagicDamage effect type directly.

        // Sorcerer - Arcane Infusion: weapon enchant, 3-6 magic, 0.25/INT, 1 use
        SpellConfig.set(_effectId("arcane_infusion"), SpellConfigData({
            strPct: 0, agiPct: 0, intPct: 0, hpPct: 0,
            armorFlat: 0, spellMinDamage: 3, spellMaxDamage: 6,
            dmgPerStat: 250, dmgScalingStat: ResistanceStat.Intelligence,
            dmgIsPhysical: false, maxUses: 1, isWeaponEnchant: true
        }));
        console.log("  arcane_infusion SpellConfig set");

        // Cleric - Blessing: +12% INT buff, +15% maxHp heal, +700 armor, no dmg, 2 uses
        SpellConfig.set(_effectId("blessing"), SpellConfigData({
            strPct: 0, agiPct: 0, intPct: 1200, hpPct: 1500,
            armorFlat: 700, spellMinDamage: 0, spellMaxDamage: 0,
            dmgPerStat: 0, dmgScalingStat: ResistanceStat.None,
            dmgIsPhysical: false, maxUses: 2, isWeaponEnchant: false
        }));
        console.log("  blessing SpellConfig set");

        console.log("All SpellConfig entries deployed");
    }

    function _updateStatusEffectStats() internal {
        console.log("Updating StatusEffectStats (flat values as fallback)...");

        // For spells with SpellConfig, the flat StatusEffectStats values serve as a fallback.
        // ComputedEffectMods will override them at runtime.
        // We still need valid entries for the effects system to not revert.

        // New effects for redesigned spells (Ranger, Rogue, Sorcerer)
        // Marked Shot (replaces hunters_mark for Ranger)
        bytes32 markedShot = _effectId("marked_shot");
        StatusEffectStats.set(markedShot, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.Agility,
            strModifier: 0
        }));
        StatusEffectTargeting.set(markedShot, false);
        Effects.set(markedShot, EffectType.StatusEffect, true);
        console.log("  marked_shot effect created");

        // Expose Weakness (replaces shadowstep for Rogue)
        bytes32 exposeWeakness = _effectId("expose_weakness");
        StatusEffectStats.set(exposeWeakness, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.Strength,
            strModifier: 0
        }));
        StatusEffectTargeting.set(exposeWeakness, false);
        Effects.set(exposeWeakness, EffectType.StatusEffect, true);
        console.log("  expose_weakness effect created");

        // Arcane Infusion (replaces arcane_surge for Sorcerer)
        bytes32 arcaneInfusion = _effectId("arcane_infusion");
        StatusEffectStats.set(arcaneInfusion, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.None,
            strModifier: 0
        }));
        StatusEffectTargeting.set(arcaneInfusion, true);
        Effects.set(arcaneInfusion, EffectType.StatusEffect, true);
        console.log("  arcane_infusion effect created");

        console.log("StatusEffectStats updated");
    }

    function _updateStatusEffectValidity() internal {
        console.log("Updating StatusEffectValidity...");

        // All existing effects keep their validTurns.
        // New effects need validity entries.
        StatusEffectValidity.set(_effectId("marked_shot"), StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 4
        }));

        StatusEffectValidity.set(_effectId("expose_weakness"), StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 3
        }));

        StatusEffectValidity.set(_effectId("arcane_infusion"), StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 4
        }));

        console.log("StatusEffectValidity updated");
    }
}
