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

        // Warrior - Battle Cry: +25% STR buff, +10% maxHp heal, +8 armor, 5-10 phys dmg, 0.5/STR, 2 uses
        SpellConfig.set(_effectId("battle_cry"), SpellConfigData({
            strPct: 2500, agiPct: 0, intPct: 0, hpPct: 1000,
            armorFlat: 8, spellMinDamage: 5, spellMaxDamage: 10,
            dmgPerStat: 500, dmgScalingStat: ResistanceStat.Strength,
            dmgIsPhysical: true, maxUses: 2, isWeaponEnchant: false
        }));
        console.log("  battle_cry SpellConfig set");

        // Paladin - Divine Shield: +15% STR buff, +15% maxHp heal, +10 armor, no dmg, 2 uses
        SpellConfig.set(_effectId("divine_shield"), SpellConfigData({
            strPct: 1500, agiPct: 0, intPct: 0, hpPct: 1500,
            armorFlat: 10, spellMinDamage: 0, spellMaxDamage: 0,
            dmgPerStat: 0, dmgScalingStat: ResistanceStat.None,
            dmgIsPhysical: false, maxUses: 2, isWeaponEnchant: false
        }));
        console.log("  divine_shield SpellConfig set");

        // Ranger - Marked Shot (uses OLD hunters_mark effectId for existing player items):
        // -20% AGI debuff, -5 armor, 4-8 phys dmg, 0.4/AGI, unlimited uses
        SpellConfig.set(_effectId("hunters_mark"), SpellConfigData({
            strPct: 0, agiPct: -2000, intPct: 0, hpPct: 0,
            armorFlat: -5, spellMinDamage: 4, spellMaxDamage: 8,
            dmgPerStat: 400, dmgScalingStat: ResistanceStat.Agility,
            dmgIsPhysical: true, maxUses: 0, isWeaponEnchant: false
        }));
        console.log("  hunters_mark -> Marked Shot SpellConfig set");

        // Rogue - Expose Weakness (uses OLD shadowstep effectId for existing player items):
        // -15% STR debuff, -8 armor, 4-8 phys dmg, 0.4/AGI, unlimited uses
        SpellConfig.set(_effectId("shadowstep"), SpellConfigData({
            strPct: -1500, agiPct: 0, intPct: 0, hpPct: 0,
            armorFlat: -8, spellMinDamage: 4, spellMaxDamage: 8,
            dmgPerStat: 400, dmgScalingStat: ResistanceStat.Agility,
            dmgIsPhysical: true, maxUses: 0, isWeaponEnchant: false
        }));
        console.log("  shadowstep -> Expose Weakness SpellConfig set");

        // Druid - Entangle: -15% STR, -25% AGI debuff, -3 armor, 3-6 magic dmg, 0.3/INT, unlimited uses
        SpellConfig.set(_effectId("entangle"), SpellConfigData({
            strPct: -1500, agiPct: -2500, intPct: 0, hpPct: 0,
            armorFlat: -3, spellMinDamage: 3, spellMaxDamage: 6,
            dmgPerStat: 300, dmgScalingStat: ResistanceStat.Intelligence,
            dmgIsPhysical: false, maxUses: 0, isWeaponEnchant: false
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

        // Wizard - Arcane Blast: 5-10 magic dmg, 0.5/INT, 3 uses
        // Uses MagicDamage effect path. CombatSystem checks hasSpellConfig for maxUses tracking.
        SpellConfig.set(_effectId("arcane_blast_damage"), SpellConfigData({
            strPct: 0, agiPct: 0, intPct: 0, hpPct: 0,
            armorFlat: 0, spellMinDamage: 5, spellMaxDamage: 10,
            dmgPerStat: 500, dmgScalingStat: ResistanceStat.Intelligence,
            dmgIsPhysical: false, maxUses: 3, isWeaponEnchant: false
        }));
        console.log("  arcane_blast_damage SpellConfig set");

        // Sorcerer - Arcane Infusion (uses OLD arcane_surge_damage effectId for existing player items):
        // weapon enchant, 3-6 magic, 0.25/INT, unlimited uses
        SpellConfig.set(_effectId("arcane_surge_damage"), SpellConfigData({
            strPct: 0, agiPct: 0, intPct: 0, hpPct: 0,
            armorFlat: 0, spellMinDamage: 3, spellMaxDamage: 6,
            dmgPerStat: 250, dmgScalingStat: ResistanceStat.Intelligence,
            dmgIsPhysical: false, maxUses: 0, isWeaponEnchant: true
        }));
        console.log("  arcane_surge_damage -> Arcane Infusion SpellConfig set");

        // Cleric - Blessing: +12% INT buff, +15% maxHp heal, +7 armor, no dmg, 2 uses
        SpellConfig.set(_effectId("blessing"), SpellConfigData({
            strPct: 0, agiPct: 0, intPct: 1200, hpPct: 1500,
            armorFlat: 7, spellMinDamage: 0, spellMaxDamage: 0,
            dmgPerStat: 0, dmgScalingStat: ResistanceStat.None,
            dmgIsPhysical: false, maxUses: 2, isWeaponEnchant: false
        }));
        console.log("  blessing SpellConfig set");

        console.log("All SpellConfig entries deployed");
    }

    function _updateStatusEffectStats() internal {
        console.log("Updating StatusEffectStats (zero fallbacks for V2 spells)...");

        // V2 uses ComputedEffectMods (percentage-based, computed at cast time).
        // StatusEffectStats serves as fallback — set to zero so V2 path always wins.
        // Existing V1 entries for battle_cry, divine_shield, entangle, soul_drain_curse,
        // blessing, hunters_mark, shadowstep already exist from V1 deploy.
        // arcane_surge_damage is a MagicDamage effect — its StatusEffect fallback for
        // Arcane Infusion (weapon enchant) needs to exist as StatusEffect type.

        // Arcane Surge → Arcane Infusion: change effect type from MagicDamage to StatusEffect
        // so the spell system can process it as a weapon enchant
        bytes32 arcaneSurge = _effectId("arcane_surge_damage");
        StatusEffectStats.set(arcaneSurge, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.None,
            strModifier: 0
        }));
        StatusEffectTargeting.set(arcaneSurge, true); // self-targeting (weapon enchant)
        Effects.set(arcaneSurge, EffectType.StatusEffect, true);
        console.log("  arcane_surge_damage -> StatusEffect (Arcane Infusion)");

        console.log("StatusEffectStats updated");
    }

    function _updateStatusEffectValidity() internal {
        console.log("Updating StatusEffectValidity to sim targets...");

        // Update ALL spell durations to match sim CLASS_SPELLS values
        StatusEffectValidity.set(_effectId("battle_cry"), StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 8
        }));
        StatusEffectValidity.set(_effectId("divine_shield"), StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 8
        }));
        StatusEffectValidity.set(_effectId("hunters_mark"), StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 8
        }));
        StatusEffectValidity.set(_effectId("shadowstep"), StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 8
        }));
        StatusEffectValidity.set(_effectId("entangle"), StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 8
        }));
        // Soul Drain: 5t (already correct, but set explicitly)
        StatusEffectValidity.set(_effectId("soul_drain_curse"), StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 5
        }));
        // Arcane Infusion (on arcane_surge_damage effectId): 10t
        StatusEffectValidity.set(_effectId("arcane_surge_damage"), StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 10
        }));
        // Blessing: 6t (already correct, but set explicitly)
        StatusEffectValidity.set(_effectId("blessing"), StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 6
        }));

        console.log("StatusEffectValidity updated");
    }
}
