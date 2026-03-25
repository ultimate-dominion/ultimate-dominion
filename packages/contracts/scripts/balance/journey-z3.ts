#!/usr/bin/env npx tsx
/**
 * Zone 3 Journey Sim — L21→L30 progression + multiplayer combat.
 * Validates Z3 balance with new effect types (silence, root, reflect)
 * and multi-combatant engine (2v1, 3v1 PvE elites, 2v2 PvP).
 *
 * Usage: npx tsx packages/contracts/scripts/balance/journey-z3.ts [flags]
 *   --summary      Show path averages only
 *   --verbose      Show gear details per level
 *   --blocked      Only show builds with <30% win rate
 *   --pvp-2v2      Run 2v2 PvP at L30
 *   --elite        Run 2v1/3v1 elite boss sim
 *   --solo         Run solo L21-30 journey (default)
 *   --spell3       Enable spell3 (L25+)
 *   --level N      Show specific level only
 *   --arch ID      Show specific archetype only
 *   --rounds N     Override max combat rounds
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadGameData } from "./loader.js";
import { applyOverrides, CLASS_SPELLS, WEAPONS_V4, ARMORS_WITH_SECONDARY_REQS, type SimFlags } from "./overrides.js";
import type {
  GameData, Weapon, Armor, Monster, Combatant, Archetype,
  StatProfile, CombatConstants, LevelingConstants, AdvancedClass,
  WeaponEffect, ClassSpell, Consumable, MonsterPhase,
  PartyAura, CcResistance, CcHistoryEntry, MultiCombatResult,
  BossTelegraph,
} from "./types.js";
import {
  totalStatPointsAtLevel,
  totalHpFromLeveling,
  buildProfile as _buildProfile,
  canEquip as _canEquip,
  canEquipArmor as _canEquipArmor,
  makeCombatant as _makeCombatant,
  makeMonsterCombatant as _makeMonsterCombatant,
  getDominant as _getDominant,
  statPointsForLevel,
  hpForLevel,
} from "./formulas.js";
import {
  resolveAttack as _resolveAttack,
  resolveAttackZ3,
  resolveDualMagicHit as _resolveDualMagicHit,
  resolveBreathAttack as _resolveBreathAttack,
  tickEffects,
  adjustCombatant,
  defaultRng,
  applyCcResistance,
  getCcDiminishedDuration,
  applySilence,
  applyRoot,
  applyReflect,
  isSilenced,
  isRooted,
  getReflectPct,
  type ActiveEffectInstance,
  type RngFn,
} from "./combat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
//  SIM CONSTANTS
// ============================================================

const SIM_ITERATIONS = 500;
let MAX_COMBAT_ROUNDS = 30; // Z3 target for multiplayer
const rng = defaultRng;

function randInt(min: number, max: number): number {
  return rng(min, max);
}

// ============================================================
//  ZONE 2 DATA (needed for L10-20 progression context)
//  Copied from journey-z2.ts — Z3 sim needs full L1-30 picture
// ============================================================

const Z2_MONSTERS: Monster[] = [
  { name: "Z2-L11-Rogue", level: 11, str: 10, agi: 20, int: 5, hp: 60, armor: 2, classType: 1, xp: 800, weaponMinDmg: 4, weaponMaxDmg: 7, weaponScaling: "agi", weaponIsMagic: false },
  { name: "Z2-L12-Mage", level: 12, str: 7, agi: 8, int: 21, hp: 60, armor: 2, classType: 2, xp: 1000, weaponMinDmg: 5, weaponMaxDmg: 8, weaponScaling: "str", weaponIsMagic: true },
  { name: "Z2-L13-Warrior", level: 13, str: 20, agi: 6, int: 3, hp: 68, armor: 4, classType: 0, xp: 1200, weaponMinDmg: 5, weaponMaxDmg: 9, weaponScaling: "str", weaponIsMagic: false },
  { name: "Z2-L14-Rogue", level: 14, str: 8, agi: 22, int: 5, hp: 68, armor: 2, classType: 1, xp: 1400, weaponMinDmg: 5, weaponMaxDmg: 9, weaponScaling: "agi", weaponIsMagic: false },
  { name: "Z2-L15-Warrior", level: 15, str: 22, agi: 8, int: 4, hp: 72, armor: 4, classType: 0, xp: 1600, weaponMinDmg: 5, weaponMaxDmg: 9, weaponScaling: "str", weaponIsMagic: false },
  { name: "Z2-L16-Mage", level: 16, str: 8, agi: 10, int: 23, hp: 65, armor: 3, classType: 2, xp: 1800, weaponMinDmg: 5, weaponMaxDmg: 9, weaponScaling: "str", weaponIsMagic: true },
  { name: "Z2-L17-Rogue", level: 17, str: 10, agi: 24, int: 8, hp: 70, armor: 3, classType: 1, xp: 2000, weaponMinDmg: 5, weaponMaxDmg: 9, weaponScaling: "agi", weaponIsMagic: false },
  { name: "Z2-L18-Warrior", level: 18, str: 23, agi: 12, int: 6, hp: 78, armor: 5, classType: 0, xp: 2200, weaponMinDmg: 6, weaponMaxDmg: 10, weaponScaling: "str", weaponIsMagic: false },
  { name: "Z2-L19-Mage", level: 19, str: 10, agi: 12, int: 24, hp: 68, armor: 3, classType: 2, xp: 2500, weaponMinDmg: 5, weaponMaxDmg: 9, weaponScaling: "str", weaponIsMagic: true },
  { name: "Z2-L20-Boss", level: 20, str: 26, agi: 12, int: 6, hp: 95, armor: 6, classType: 0, xp: 4000, weaponMinDmg: 7, weaponMaxDmg: 11, weaponScaling: "str", weaponIsMagic: false },
];

const Z2_MONSTER_EFFECTS: Record<string, WeaponEffect[]> = {
  "Z2-L11-Rogue": [{ type: "stat_debuff", name: "Slash Wound", strMod: 0, agiMod: 0, intMod: 0, armorMod: -2, duration: 3 }],
  "Z2-L12-Mage": [{ type: "stat_debuff", name: "Cold Touch", agiMod: -3, strMod: 0, intMod: 0, armorMod: 0, duration: 3 }],
  "Z2-L13-Warrior": [{ type: "stat_debuff", name: "Ground Pound", strMod: -2, agiMod: -2, intMod: 0, armorMod: 0, duration: 3 }],
  "Z2-L14-Rogue": [{ type: "stat_debuff", name: "Wind Gust", strMod: -3, agiMod: 0, intMod: 0, armorMod: -2, duration: 3 }],
  "Z2-L15-Warrior": [{ type: "dot", name: "Decay Bite", damagePerTick: 3, maxStacks: 1, duration: 4, cooldown: 0 }],
  "Z2-L16-Mage": [{ type: "magic_breath", name: "Lightning Bolt", minDmg: 5, maxDmg: 9, cooldown: 2 }],
  "Z2-L17-Rogue": [{ type: "dual_magic", name: "dual_magic" }, { type: "stat_debuff", name: "Corruption", strMod: -2, agiMod: 0, intMod: -2, armorMod: 0, duration: 3 }],
  "Z2-L18-Warrior": [{ type: "dot", name: "Venom Spit", damagePerTick: 3, maxStacks: 1, duration: 4, cooldown: 0 }],
  "Z2-L19-Mage": [{ type: "magic_breath", name: "Frost Breath", minDmg: 5, maxDmg: 9, cooldown: 2 }, { type: "dot", name: "Frostbite", damagePerTick: 2, maxStacks: 1, duration: 4, cooldown: 0 }],
  "Z2-L20-Boss": [{ type: "magic_breath", name: "Thunder Clap", minDmg: 5, maxDmg: 9, cooldown: 2 }, { type: "stat_debuff", name: "Ground Slam", strMod: -3, agiMod: -3, intMod: 0, armorMod: -2, duration: 3, cooldown: 3 }],
};

// Z2 weapons and armor — import from journey-z2 would be ideal but they're not exported.
// For Z3 sim, we only need these at L20 to establish baseline gear.
// The sim loads Z1 data via loadData() + overrides, Z2 data is injected here, Z3 data below.

const Z2_WEAPONS: Weapon[] = [
  // STR pure
  { name: "Z2-STR-R1", minDamage: 5, maxDamage: 8, strMod: 1, agiMod: 0, intMod: 0, hpMod: 2, scaling: "str", isMagic: false, minStr: 16, minAgi: 0, minInt: 0, rarity: 1, price: 40 },
  { name: "Z2-STR-R2", minDamage: 6, maxDamage: 10, strMod: 2, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 20, minAgi: 0, minInt: 0, rarity: 2, price: 80 },
  { name: "Z2-STR-R3", minDamage: 7, maxDamage: 12, strMod: 3, agiMod: 0, intMod: 0, hpMod: 4, scaling: "str", isMagic: false, minStr: 24, minAgi: 0, minInt: 0, rarity: 3, price: 150 },
  { name: "Z2-STR-R4", minDamage: 9, maxDamage: 14, strMod: 4, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 28, minAgi: 0, minInt: 0, rarity: 4, price: 300 },
  // AGI pure
  { name: "Z2-AGI-R1", minDamage: 4, maxDamage: 7, strMod: 0, agiMod: 1, intMod: 0, hpMod: 2, scaling: "agi", isMagic: false, minStr: 0, minAgi: 16, minInt: 0, rarity: 1, price: 40 },
  { name: "Z2-AGI-R2", minDamage: 5, maxDamage: 9, strMod: 0, agiMod: 2, intMod: 0, hpMod: 3, scaling: "agi", isMagic: false, minStr: 0, minAgi: 20, minInt: 0, rarity: 2, price: 80 },
  { name: "Z2-AGI-R3", minDamage: 6, maxDamage: 11, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4, scaling: "agi", isMagic: false, minStr: 0, minAgi: 24, minInt: 0, rarity: 3, price: 150 },
  { name: "Z2-AGI-R4", minDamage: 7, maxDamage: 13, strMod: 0, agiMod: 4, intMod: 0, hpMod: 5, scaling: "agi", isMagic: false, minStr: 0, minAgi: 28, minInt: 0, rarity: 4, price: 300 },
  // INT pure
  { name: "Z2-INT-R1", minDamage: 5, maxDamage: 8, strMod: 0, agiMod: 0, intMod: 1, hpMod: 2, scaling: "str", isMagic: true, minStr: 0, minAgi: 0, minInt: 16, rarity: 1, price: 40 },
  { name: "Z2-INT-R2", minDamage: 6, maxDamage: 10, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true, minStr: 0, minAgi: 0, minInt: 20, rarity: 2, price: 80 },
  { name: "Z2-INT-R3", minDamage: 8, maxDamage: 13, strMod: 0, agiMod: 0, intMod: 3, hpMod: 4, scaling: "str", isMagic: true, minStr: 0, minAgi: 0, minInt: 24, rarity: 3, price: 150 },
  { name: "Z2-INT-R4", minDamage: 10, maxDamage: 15, strMod: 0, agiMod: 0, intMod: 4, hpMod: 6, scaling: "str", isMagic: true, minStr: 0, minAgi: 0, minInt: 28, rarity: 4, price: 300 },
  // Hybrids
  { name: "Z2-STR/INT-Hybrid", minDamage: 5, maxDamage: 9, strMod: 2, agiMod: 0, intMod: 2, hpMod: 2, scaling: "str", isMagic: false, minStr: 18, minAgi: 0, minInt: 10, rarity: 3, price: 200 },
  { name: "Z2-AGI/INT-Hybrid", minDamage: 4, maxDamage: 8, strMod: 0, agiMod: 2, intMod: 2, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0, minAgi: 18, minInt: 10, rarity: 3, price: 200 },
  { name: "Z2-STR/AGI-Hybrid", minDamage: 6, maxDamage: 10, strMod: 2, agiMod: 2, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 18, minAgi: 6, minInt: 0, rarity: 3, price: 200 },
  { name: "Z2-AGI/STR-Hybrid", minDamage: 5, maxDamage: 9, strMod: 2, agiMod: 2, intMod: 0, hpMod: 2, scaling: "agi", isMagic: false, minStr: 8, minAgi: 18, minInt: 0, rarity: 3, price: 200 },
  { name: "Z2-INT/STR-Hybrid", minDamage: 6, maxDamage: 10, strMod: 1, agiMod: 0, intMod: 2, hpMod: 2, scaling: "str", isMagic: true, minStr: 6, minAgi: 0, minInt: 18, rarity: 3, price: 200 },
];

const Z2_ARMORS: Armor[] = [
  // Plate
  { name: "Z2-Plate-R1", armorValue: 5, strMod: 1, agiMod: -1, intMod: 0, hpMod: 3, minStr: 14, minAgi: 0, minInt: 0, armorType: "Plate", rarity: 1, price: 35 },
  { name: "Z2-Plate-R2", armorValue: 7, strMod: 2, agiMod: -1, intMod: 0, hpMod: 5, minStr: 18, minAgi: 0, minInt: 0, armorType: "Plate", rarity: 2, price: 70 },
  { name: "Z2-Plate-R3", armorValue: 9, strMod: 3, agiMod: -1, intMod: 0, hpMod: 8, minStr: 22, minAgi: 0, minInt: 0, armorType: "Plate", rarity: 3, price: 140 },
  { name: "Z2-Plate-R4", armorValue: 11, strMod: 4, agiMod: -1, intMod: 0, hpMod: 10, minStr: 26, minAgi: 0, minInt: 0, armorType: "Plate", rarity: 4, price: 280 },
  // Leather
  { name: "Z2-Leather-R1", armorValue: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 2, minStr: 0, minAgi: 14, minInt: 0, armorType: "Leather", rarity: 1, price: 35 },
  { name: "Z2-Leather-R2", armorValue: 4, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4, minStr: 0, minAgi: 18, minInt: 0, armorType: "Leather", rarity: 2, price: 70 },
  { name: "Z2-Leather-R3", armorValue: 5, strMod: 0, agiMod: 4, intMod: 0, hpMod: 6, minStr: 0, minAgi: 22, minInt: 0, armorType: "Leather", rarity: 3, price: 140 },
  { name: "Z2-Leather-R4", armorValue: 6, strMod: 0, agiMod: 5, intMod: 0, hpMod: 8, minStr: 0, minAgi: 26, minInt: 0, armorType: "Leather", rarity: 4, price: 280 },
  // Cloth
  { name: "Z2-Cloth-R1", armorValue: 2, strMod: 0, agiMod: 0, intMod: 2, hpMod: 5, minStr: 0, minAgi: 0, minInt: 14, armorType: "Cloth", rarity: 1, price: 35 },
  { name: "Z2-Cloth-R2", armorValue: 3, strMod: 0, agiMod: 0, intMod: 3, hpMod: 8, minStr: 0, minAgi: 0, minInt: 18, armorType: "Cloth", rarity: 2, price: 70 },
  { name: "Z2-Cloth-R3", armorValue: 4, strMod: 0, agiMod: 0, intMod: 4, hpMod: 12, minStr: 0, minAgi: 0, minInt: 22, armorType: "Cloth", rarity: 3, price: 140 },
  { name: "Z2-Cloth-R4", armorValue: 5, strMod: 0, agiMod: 0, intMod: 5, hpMod: 16, minStr: 0, minAgi: 0, minInt: 26, armorType: "Cloth", rarity: 4, price: 280 },
];

const Z2_WEAPON_EFFECTS: Record<string, WeaponEffect[]> = {
  "Z2-STR-R3": [{ type: "dot", name: "Bleed", damagePerTick: 2, maxStacks: 1, duration: 4, cooldown: 0 }],
  "Z2-AGI-R3": [{ type: "stat_debuff", name: "Hamstring", strMod: 0, agiMod: -3, intMod: 0, armorMod: 0, duration: 3 }],
  "Z2-INT-R3": [{ type: "stat_debuff", name: "Wither", strMod: -4, agiMod: 0, intMod: 0, armorMod: 0, duration: 4 }],
  "Z2-STR-R4": [{ type: "dot", name: "Deep Wound", damagePerTick: 3, maxStacks: 1, duration: 5, cooldown: 0 }, { type: "stat_debuff", name: "Crush", strMod: 0, agiMod: 0, intMod: 0, armorMod: -4, duration: 4 }],
  "Z2-AGI-R4": [{ type: "dot", name: "Lacerate", damagePerTick: 3, maxStacks: 1, duration: 5, cooldown: 0 }],
  "Z2-INT-R4": [{ type: "stat_debuff", name: "Enfeeble", strMod: -6, agiMod: 0, intMod: 0, armorMod: -3, duration: 5 }, { type: "dot", name: "Arcane Burn", damagePerTick: 3, maxStacks: 1, duration: 5, cooldown: 0 }],
  "Z2-STR/INT-Hybrid": [{ type: "dual_magic", name: "dual_magic" }],
  "Z2-AGI/INT-Hybrid": [{ type: "dual_magic", name: "dual_magic" }],
  "Z2-STR/AGI-Hybrid": [{ type: "dot", name: "Bleed", damagePerTick: 3, maxStacks: 1, duration: 4, cooldown: 0 }, { type: "stat_debuff", name: "Armor Rend", strMod: 0, agiMod: 0, intMod: 0, armorMod: -3, duration: 3 }],
  "Z2-AGI/STR-Hybrid": [{ type: "dot", name: "Venom Strike", damagePerTick: 3, maxStacks: 1, duration: 5, cooldown: 0 }],
  "Z2-INT/STR-Hybrid": [{ type: "dot", name: "Soulfire", damagePerTick: 2, maxStacks: 1, duration: 4, cooldown: 0 }, { type: "stat_debuff", name: "Weaken", strMod: -2, agiMod: 0, intMod: 0, armorMod: 0, duration: 3 }],
};

// ============================================================
//  ZONE 3 MONSTERS — L21-30
//  Design: teach new mechanics (silence/root/reflect) through PvE.
//  Class sequence: M, W, R, M, W(elite), R, M, W, R, M(elite boss)
// ============================================================

const Z3_MONSTERS: Monster[] = [
  // L21 — Mage. Teaches silence. Casts silence on hit, forcing players to pre-buff.
  { name: "Z3-L21-Mage", level: 21, str: 10, agi: 12, int: 28,
    hp: 85, armor: 3, classType: 2, xp: 3200,
    weaponMinDmg: 6, weaponMaxDmg: 10, weaponScaling: "str", weaponIsMagic: true },

  // L22 — Warrior. Teaches root. Stomps target, pinning AGI builds.
  { name: "Z3-L22-Warrior", level: 22, str: 26, agi: 8, int: 5,
    hp: 90, armor: 5, classType: 0, xp: 3600,
    weaponMinDmg: 6, weaponMaxDmg: 10, weaponScaling: "str", weaponIsMagic: false },

  // L23 — Rogue. Teaches reflect. Self-buffs reflect every 4 rounds — INT players must time spells.
  { name: "Z3-L23-Rogue", level: 23, str: 12, agi: 28, int: 8,
    hp: 80, armor: 3, classType: 1, xp: 4000,
    weaponMinDmg: 6, weaponMaxDmg: 10, weaponScaling: "agi", weaponIsMagic: false },

  // L24 — Mage. Silence + magic breath. DPS check — silence denies your spell, breath hurts.
  { name: "Z3-L24-Mage", level: 24, str: 10, agi: 14, int: 30,
    hp: 88, armor: 4, classType: 2, xp: 4500,
    weaponMinDmg: 7, weaponMaxDmg: 11, weaponScaling: "str", weaponIsMagic: true },

  // L25 — ELITE Warrior. First party-designed mob. Cleave + root.
  // Target: STR-path solos at ~60-80%, cross-path 2v1 pairs at 60%+.
  { name: "Z3-L25-Elite", level: 25, str: 30, agi: 15, int: 8,
    hp: 140, armor: 6, classType: 0, xp: 8000,
    weaponMinDmg: 7, weaponMaxDmg: 12, weaponScaling: "str", weaponIsMagic: false,
    isElite: true, partyHpScale: 0.5, cleave: true },

  // L26 — Rogue. Root + venom DoT. Anti-AGI gauntlet.
  { name: "Z3-L26-Rogue", level: 26, str: 12, agi: 28, int: 8,
    hp: 85, armor: 3, classType: 1, xp: 5500,
    weaponMinDmg: 7, weaponMaxDmg: 11, weaponScaling: "agi", weaponIsMagic: false },

  // L27 — Mage. Reflect + arcane breath + silence. Punishes blind nuking.
  { name: "Z3-L27-Mage", level: 27, str: 10, agi: 14, int: 33,
    hp: 92, armor: 4, classType: 2, xp: 6000,
    weaponMinDmg: 7, weaponMaxDmg: 12, weaponScaling: "str", weaponIsMagic: true },

  // L28 — Warrior. Root + stat debuff + high armor. The endurance test.
  // (No silence — too much CC on one mob for AGI/INT builds)
  { name: "Z3-L28-Warrior", level: 28, str: 30, agi: 10, int: 6,
    hp: 105, armor: 7, classType: 0, xp: 7000,
    weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: "str", weaponIsMagic: false },

  // L29 — Rogue. Fast + silence + bleed. Pre-boss DPS race.
  { name: "Z3-L29-Rogue", level: 29, str: 12, agi: 30, int: 8,
    hp: 88, armor: 4, classType: 1, xp: 7500,
    weaponMinDmg: 7, weaponMaxDmg: 12, weaponScaling: "agi", weaponIsMagic: false },

  // L30 — ELITE BOSS Mage. Multi-phase. Designed for 3v1.
  // Phase 1 (100-66%): root + breath. Phase 2 (66-33%): +silence. Phase 3 (<33%): +reflect + enrage.
  // Target: cross-path 3v1 trios at 70%+. Solo near-impossible.
  { name: "Z3-L30-Boss", level: 30, str: 18, agi: 16, int: 36,
    hp: 190, armor: 5, classType: 2, xp: 15000,
    weaponMinDmg: 8, weaponMaxDmg: 14, weaponScaling: "str", weaponIsMagic: true,
    isElite: true, partyHpScale: 0.75,
    phases: [
      { hpPct: 0.66, addEffects: ["silence", "arcane_breath"], telegraphText: "The air crackles with arcane energy..." },
      { hpPct: 0.33, addEffects: ["reflect"], enragePct: 0.15, telegraphText: "A mirror-like barrier forms around the creature..." },
    ],
  },
];

// Monster effects for Z3
const Z3_MONSTER_EFFECTS: Record<string, WeaponEffect[]> = {
  // L21 Mage: silence on hit (teaches silence mechanic)
  "Z3-L21-Mage": [
    { type: "silence", name: "Silencing Touch", duration: 2, cooldown: 3 },
  ],

  // L22 Warrior: root on hit (teaches root mechanic)
  "Z3-L22-Warrior": [
    { type: "root", name: "Ground Stomp", duration: 2, cooldown: 3 },
    { type: "stat_debuff", name: "Tremor", strMod: 0, agiMod: -3, intMod: 0, armorMod: -2, duration: 3 },
  ],

  // L23 Rogue: self-reflect every 4 rounds (teaches reflect mechanic)
  "Z3-L23-Rogue": [
    { type: "reflect", name: "Mirror Scales", duration: 2, cooldown: 4, reflectPct: 0.5 },
    { type: "dot", name: "Venom Fang", damagePerTick: 3, maxStacks: 1, duration: 4, cooldown: 0 },
  ],

  // L24 Mage: silence + breath
  "Z3-L24-Mage": [
    { type: "silence", name: "Mind Shatter", duration: 2, cooldown: 3 },
    { type: "magic_breath", name: "Arcane Torrent", minDmg: 7, maxDmg: 12, cooldown: 2 },
  ],

  // L25 Elite: root + cleave (boss has cleave flag on Monster)
  "Z3-L25-Elite": [
    { type: "root", name: "Seismic Slam", duration: 2, cooldown: 3 },
    { type: "stat_debuff", name: "Crushing Blow", strMod: -3, agiMod: -3, intMod: 0, armorMod: -2, duration: 3, cooldown: 3 },
  ],

  // L26 Rogue: root + venom DoT (reduced from 4/tick — too punishing for INT builds)
  "Z3-L26-Rogue": [
    { type: "root", name: "Web Trap", duration: 2, cooldown: 4 },
    { type: "dot", name: "Venom Injection", damagePerTick: 3, maxStacks: 1, duration: 4, cooldown: 0 },
  ],

  // L27 Mage: reflect + breath + silence
  "Z3-L27-Mage": [
    { type: "reflect", name: "Arcane Mirror", duration: 2, cooldown: 4, reflectPct: 0.6 },
    { type: "magic_breath", name: "Soul Bolt", minDmg: 8, maxDmg: 13, cooldown: 2 },
    { type: "silence", name: "Mana Drain", duration: 2, cooldown: 4 },
  ],

  // L28 Warrior: root + heavy stat debuff (no silence — already tested at L24/L27)
  "Z3-L28-Warrior": [
    { type: "root", name: "Iron Chains", duration: 2, cooldown: 4 },
    { type: "stat_debuff", name: "Overwhelming Force", strMod: -4, agiMod: -4, intMod: 0, armorMod: -3, duration: 3, cooldown: 3 },
  ],

  // L29 Rogue: silence + crit (no extra effect needed — just fast and lethal)
  "Z3-L29-Rogue": [
    { type: "silence", name: "Garrote", duration: 3, cooldown: 4 },
    { type: "dot", name: "Bleed Out", damagePerTick: 4, maxStacks: 1, duration: 5, cooldown: 0 },
  ],

  // L30 Boss: starts with root + breath, gains silence/reflect through phases
  "Z3-L30-Boss": [
    { type: "root", name: "Gravity Well", duration: 2, cooldown: 4 },
    { type: "magic_breath", name: "Void Beam", minDmg: 7, maxDmg: 12, cooldown: 3 },
    // Phase 2 adds: silence
    // Phase 3 adds: reflect + enrage
  ],
};

// ============================================================
//  ZONE 3 WEAPONS
//  Pure path: R1-R4 per stat. HP-gated divine weapons.
//  Hybrid: carry new effect types (silence, root, reflect).
// ============================================================

const Z3_WEAPONS: Weapon[] = [
  // ---- STR PURE PATH ----
  { name: "Z3-STR-R1", minDamage: 8, maxDamage: 12, strMod: 2, agiMod: 0, intMod: 0, hpMod: 3,
    scaling: "str", isMagic: false, minStr: 30, minAgi: 0, minInt: 0, rarity: 1, price: 80 },
  { name: "Z3-STR-R2", minDamage: 10, maxDamage: 14, strMod: 3, agiMod: 0, intMod: 0, hpMod: 4,
    scaling: "str", isMagic: false, minStr: 34, minAgi: 0, minInt: 0, rarity: 2, price: 160 },
  { name: "Z3-STR-R3", minDamage: 12, maxDamage: 17, strMod: 4, agiMod: 0, intMod: 0, hpMod: 5,
    scaling: "str", isMagic: false, minStr: 38, minAgi: 0, minInt: 0, rarity: 3, price: 300 },
  { name: "Z3-STR-R4", minDamage: 14, maxDamage: 20, strMod: 5, agiMod: 0, intMod: 0, hpMod: 6,
    scaling: "str", isMagic: false, minStr: 42, minAgi: 0, minInt: 0, rarity: 4, price: 600 },

  // ---- AGI PURE PATH ----
  { name: "Z3-AGI-R1", minDamage: 6, maxDamage: 10, strMod: 0, agiMod: 2, intMod: 0, hpMod: 3,
    scaling: "agi", isMagic: false, minStr: 0, minAgi: 30, minInt: 0, rarity: 1, price: 80 },
  { name: "Z3-AGI-R2", minDamage: 8, maxDamage: 13, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4,
    scaling: "agi", isMagic: false, minStr: 0, minAgi: 34, minInt: 0, rarity: 2, price: 160 },
  { name: "Z3-AGI-R3", minDamage: 10, maxDamage: 15, strMod: 0, agiMod: 4, intMod: 0, hpMod: 5,
    scaling: "agi", isMagic: false, minStr: 0, minAgi: 38, minInt: 0, rarity: 3, price: 300 },
  { name: "Z3-AGI-R4", minDamage: 12, maxDamage: 18, strMod: 0, agiMod: 5, intMod: 0, hpMod: 6,
    scaling: "agi", isMagic: false, minStr: 0, minAgi: 42, minInt: 0, rarity: 4, price: 600 },

  // ---- INT PURE PATH (magic) ----
  { name: "Z3-INT-R1", minDamage: 9, maxDamage: 13, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3,
    scaling: "str", isMagic: true, minStr: 0, minAgi: 0, minInt: 30, rarity: 1, price: 80 },
  { name: "Z3-INT-R2", minDamage: 11, maxDamage: 16, strMod: 0, agiMod: 0, intMod: 3, hpMod: 4,
    scaling: "str", isMagic: true, minStr: 0, minAgi: 0, minInt: 34, rarity: 2, price: 160 },
  { name: "Z3-INT-R3", minDamage: 14, maxDamage: 19, strMod: 0, agiMod: 0, intMod: 4, hpMod: 5,
    scaling: "str", isMagic: true, minStr: 0, minAgi: 0, minInt: 38, rarity: 3, price: 300 },
  { name: "Z3-INT-R4", minDamage: 16, maxDamage: 22, strMod: 0, agiMod: 0, intMod: 5, hpMod: 7,
    scaling: "str", isMagic: true, minStr: 0, minAgi: 0, minInt: 42, rarity: 4, price: 600 },

  // ---- HYBRID WEAPONS (R3) — carry new effect types ----

  // STR/INT Silencer: physical + silence on hit
  { name: "Z3-STR/INT-Silencer", minDamage: 10, maxDamage: 15, strMod: 3, agiMod: 0, intMod: 2, hpMod: 3,
    scaling: "str", isMagic: false, minStr: 32, minAgi: 0, minInt: 12, rarity: 3, price: 400 },

  // AGI/INT Reflector: physical + self-reflect on hit
  { name: "Z3-AGI/INT-Reflector", minDamage: 8, maxDamage: 13, strMod: 0, agiMod: 3, intMod: 2, hpMod: 2,
    scaling: "agi", isMagic: false, minStr: 0, minAgi: 32, minInt: 12, rarity: 3, price: 400 },

  // STR/AGI Anchor: physical + root on hit
  { name: "Z3-STR/AGI-Anchor", minDamage: 11, maxDamage: 16, strMod: 3, agiMod: 2, intMod: 0, hpMod: 4,
    scaling: "str", isMagic: false, minStr: 32, minAgi: 8, minInt: 0, rarity: 3, price: 400 },

  // AGI/STR Venomfang: venom DoT + brief root
  { name: "Z3-AGI/STR-Venomfang", minDamage: 9, maxDamage: 14, strMod: 2, agiMod: 3, intMod: 0, hpMod: 3,
    scaling: "agi", isMagic: false, minStr: 10, minAgi: 32, minInt: 0, rarity: 3, price: 400 },

  // INT/STR Soulblade: magic + dual magic + silence
  { name: "Z3-INT/STR-Soulblade", minDamage: 12, maxDamage: 17, strMod: 2, agiMod: 0, intMod: 3, hpMod: 3,
    scaling: "str", isMagic: true, minStr: 8, minAgi: 0, minInt: 32, rarity: 3, price: 400 },

  // ---- HP-GATED DIVINE WEAPONS ----

  // Divine R2: physical + holy smite (bonus magic damage scaling with HP)
  { name: "Z3-Divine-R2", minDamage: 9, maxDamage: 13, strMod: 2, agiMod: 0, intMod: 0, hpMod: 5,
    scaling: "str", isMagic: false, minStr: 20, minAgi: 0, minInt: 0, minHp: 60, rarity: 2, price: 200 },

  // Divine R3: physical + holy smite + party heal on kill
  { name: "Z3-Divine-R3", minDamage: 11, maxDamage: 16, strMod: 3, agiMod: 0, intMod: 0, hpMod: 8,
    scaling: "str", isMagic: false, minStr: 24, minAgi: 0, minInt: 0, minHp: 75, rarity: 3, price: 400,
    partyAura: { armorMod: 2 } },

  // Divine R4: physical + holy smite + guardian aura (+3 ARM to party)
  { name: "Z3-Divine-R4", minDamage: 13, maxDamage: 19, strMod: 4, agiMod: 0, intMod: 0, hpMod: 10,
    scaling: "str", isMagic: false, minStr: 28, minAgi: 0, minInt: 0, minHp: 90, rarity: 4, price: 700,
    partyAura: { armorMod: 3 } },
];

// Z3 weapon effects
const Z3_WEAPON_EFFECTS: Record<string, WeaponEffect[]> = {
  // Pure R2: minor effects
  "Z3-STR-R2": [{ type: "dot", name: "Bleed", damagePerTick: 3, maxStacks: 1, duration: 4, cooldown: 0 }],
  "Z3-AGI-R2": [{ type: "stat_debuff", name: "Hamstring", strMod: 0, agiMod: -4, intMod: 0, armorMod: 0, duration: 3 }],
  "Z3-INT-R2": [{ type: "stat_debuff", name: "Wither", strMod: -5, agiMod: 0, intMod: 0, armorMod: 0, duration: 4 }],

  // Pure R3: strong effects
  "Z3-STR-R3": [
    { type: "dot", name: "Deep Bleed", damagePerTick: 4, maxStacks: 1, duration: 5, cooldown: 0 },
    { type: "stat_debuff", name: "Armor Crush", strMod: 0, agiMod: 0, intMod: 0, armorMod: -4, duration: 4 },
  ],
  "Z3-AGI-R3": [{ type: "dot", name: "Lacerate", damagePerTick: 4, maxStacks: 1, duration: 5, cooldown: 0 }],
  "Z3-INT-R3": [
    { type: "stat_debuff", name: "Enfeeble", strMod: -6, agiMod: 0, intMod: 0, armorMod: -3, duration: 5 },
    { type: "dot", name: "Arcane Burn", damagePerTick: 3, maxStacks: 1, duration: 4, cooldown: 0 },
  ],

  // Pure R4: elite effects
  "Z3-STR-R4": [
    { type: "dot", name: "Mortal Wound", damagePerTick: 5, maxStacks: 1, duration: 5, cooldown: 0 },
    { type: "stat_debuff", name: "Shatter", strMod: 0, agiMod: -3, intMod: 0, armorMod: -6, duration: 5 },
  ],
  "Z3-AGI-R4": [
    { type: "dot", name: "Sever", damagePerTick: 5, maxStacks: 1, duration: 5, cooldown: 0 },
    { type: "stat_debuff", name: "Cripple", strMod: -5, agiMod: -4, intMod: 0, armorMod: 0, duration: 5 },
  ],
  "Z3-INT-R4": [
    { type: "stat_debuff", name: "Soul Rend", strMod: -8, agiMod: 0, intMod: 0, armorMod: -4, duration: 5 },
    { type: "dot", name: "Void Fire", damagePerTick: 5, maxStacks: 1, duration: 5, cooldown: 0 },
  ],

  // Hybrid weapons — new effect types
  "Z3-STR/INT-Silencer": [
    { type: "silence", name: "Silencing Strike", duration: 2, cooldown: 3 },
  ],
  "Z3-AGI/INT-Reflector": [
    { type: "reflect", name: "Mirror Edge", duration: 1, cooldown: 3, reflectPct: 0.5 },
  ],
  "Z3-STR/AGI-Anchor": [
    { type: "root", name: "Pinning Blow", duration: 2, cooldown: 3 },
  ],
  "Z3-AGI/STR-Venomfang": [
    { type: "dot", name: "Venom", damagePerTick: 4, maxStacks: 1, duration: 5, cooldown: 0 },
    { type: "root", name: "Venom Root", duration: 1, cooldown: 4 },
  ],
  "Z3-INT/STR-Soulblade": [
    { type: "dual_magic", name: "dual_magic" },
    { type: "silence", name: "Soul Silence", duration: 1, cooldown: 4 },
  ],

  // Divine weapons — holy smite (bonus magic damage, modeled as dual_magic)
  "Z3-Divine-R2": [{ type: "dual_magic", name: "Holy Smite" }],
  "Z3-Divine-R3": [{ type: "dual_magic", name: "Holy Smite" }],
  "Z3-Divine-R4": [{ type: "dual_magic", name: "Holy Smite" }],
};

// ============================================================
//  ZONE 3 ARMOR
// ============================================================

const Z3_ARMORS: Armor[] = [
  // ---- PLATE (STR) ----
  { name: "Z3-Plate-R1", armorValue: 8, strMod: 2, agiMod: -1, intMod: 0, hpMod: 5,
    minStr: 28, minAgi: 0, minInt: 0, armorType: "Plate", rarity: 1, price: 70 },
  { name: "Z3-Plate-R2", armorValue: 10, strMod: 3, agiMod: -1, intMod: 0, hpMod: 8,
    minStr: 32, minAgi: 0, minInt: 0, armorType: "Plate", rarity: 2, price: 140 },
  { name: "Z3-Plate-R3", armorValue: 13, strMod: 4, agiMod: -1, intMod: 0, hpMod: 10,
    minStr: 36, minAgi: 0, minInt: 0, armorType: "Plate", rarity: 3, price: 280 },
  { name: "Z3-Plate-R4", armorValue: 16, strMod: 6, agiMod: -1, intMod: 0, hpMod: 12,
    minStr: 40, minAgi: 0, minInt: 0, armorType: "Plate", rarity: 4, price: 560,
    partyAura: { armorMod: 2 } },

  // ---- LEATHER (AGI) ----
  { name: "Z3-Leather-R1", armorValue: 5, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4,
    minStr: 0, minAgi: 28, minInt: 0, armorType: "Leather", rarity: 1, price: 70 },
  { name: "Z3-Leather-R2", armorValue: 6, strMod: 0, agiMod: 4, intMod: 0, hpMod: 6,
    minStr: 0, minAgi: 32, minInt: 0, armorType: "Leather", rarity: 2, price: 140 },
  { name: "Z3-Leather-R3", armorValue: 7, strMod: 0, agiMod: 5, intMod: 0, hpMod: 8,
    minStr: 0, minAgi: 36, minInt: 0, armorType: "Leather", rarity: 3, price: 280 },
  { name: "Z3-Leather-R4", armorValue: 9, strMod: 0, agiMod: 7, intMod: 0, hpMod: 10,
    minStr: 0, minAgi: 40, minInt: 0, armorType: "Leather", rarity: 4, price: 560,
    ccResist: { rootReduction: 1 } },

  // ---- CLOTH (INT) ----
  { name: "Z3-Cloth-R1", armorValue: 3, strMod: 0, agiMod: 0, intMod: 3, hpMod: 7,
    minStr: 0, minAgi: 0, minInt: 28, armorType: "Cloth", rarity: 1, price: 70 },
  { name: "Z3-Cloth-R2", armorValue: 4, strMod: 0, agiMod: 0, intMod: 4, hpMod: 10,
    minStr: 0, minAgi: 0, minInt: 32, armorType: "Cloth", rarity: 2, price: 140 },
  { name: "Z3-Cloth-R3", armorValue: 5, strMod: 0, agiMod: 0, intMod: 5, hpMod: 14,
    minStr: 0, minAgi: 0, minInt: 36, armorType: "Cloth", rarity: 3, price: 280 },
  { name: "Z3-Cloth-R4", armorValue: 7, strMod: 0, agiMod: 0, intMod: 7, hpMod: 18,
    minStr: 0, minAgi: 0, minInt: 40, armorType: "Cloth", rarity: 4, price: 560,
    ccResist: { silenceReduction: 1 } },

  // ---- HP-GATED DIVINE ARMOR ----
  { name: "Z3-Divine-Armor-R2", armorValue: 7, strMod: 2, agiMod: 0, intMod: 0, hpMod: 5,
    minStr: 0, minAgi: 0, minInt: 0, minHp: 55, armorType: "Plate", rarity: 2, price: 150 },
  { name: "Z3-Divine-Armor-R3", armorValue: 10, strMod: 3, agiMod: 0, intMod: 0, hpMod: 8,
    minStr: 0, minAgi: 0, minInt: 0, minHp: 70, armorType: "Plate", rarity: 3, price: 300,
    partyAura: { dotReduction: 1 } },
  { name: "Z3-Divine-Armor-R4", armorValue: 13, strMod: 4, agiMod: 0, intMod: 0, hpMod: 12,
    minStr: 0, minAgi: 0, minInt: 0, minHp: 85, armorType: "Plate", rarity: 4, price: 600,
    partyAura: { armorMod: 2, dotReduction: 1 } },
];

// ============================================================
//  SPELL 3 — Multiplayer identity spells (unlock at L25)
//  Weak or useless solo, transformative in party.
// ============================================================

const CLASS_SPELLS_3: Record<string, ClassSpell> = {
  // Warrior: Iron Wall — Guard ally. Intercept attack, take 60% of damage.
  Warrior:  { name: "Iron Wall",        type: "guard",      guardDmgPct: 0.6, targetAlly: true, duration: 1, maxUses: 3 },

  // Paladin: Holy Aura — Party-wide +4 ARM, +10% HP heal.
  Paladin:  { name: "Holy Aura",        type: "party_buff", armorMod: 4, hpPct: 0.10, partyWide: true, duration: 6, maxUses: 2 },

  // Ranger: Pin Shot — Root target 3t (evasion→0, no double-strike) + physical damage.
  Ranger:   { name: "Pin Shot",         type: "root",       baseDmgMin: 5, baseDmgMax: 10, dmgPerAgi: 0.3, ccDuration: 3, duration: 3, maxUses: 2 },

  // Rogue: Throat Cut — Silence target 3t (no spells) + physical damage.
  Rogue:    { name: "Throat Cut",       type: "silence",    baseDmgMin: 5, baseDmgMax: 10, dmgPerAgi: 0.3, ccDuration: 3, duration: 3, maxUses: 2 },

  // Druid: Nature's Mirror — Apply Reflect to self or ally (2t, 60% return).
  Druid:    { name: "Nature's Mirror",  type: "reflect",    reflectPct: 0.6, targetAlly: true, duration: 2, maxUses: 2 },

  // Warlock: Soul Link — Damage to linked ally is split 50/50 with caster.
  Warlock:  { name: "Soul Link",        type: "soul_link",  targetAlly: true, duration: 6, maxUses: 1 },

  // Wizard: Arcane Barrier — Self-reflect 2t (75% return) + silence immunity.
  Wizard:   { name: "Arcane Barrier",   type: "reflect",    reflectPct: 0.75, duration: 2, maxUses: 2, silenceImmune: true },

  // Sorcerer: Haste — Target ally resolves first this round + 20% AGI buff.
  Sorcerer: { name: "Haste",           type: "speed_buff",  agiPct: 0.20, targetAlly: true, duration: 3, maxUses: 2 },

  // Cleric: Divine Intervention — Heal ally 40% max HP + cleanse all debuffs.
  Cleric:   { name: "Divine Intervention", type: "ally_heal", hpPct: 0.40, targetAlly: true, maxUses: 2 },
};

// ============================================================
//  Z2 SECOND SPELLS (copied from Z2 sim for continuity)
// ============================================================

const CLASS_SPELLS_2: Record<string, ClassSpell> = {
  Warrior:  { name: "Spell2-Warrior",  type: "damage_buff",   baseDmgMin: 8, baseDmgMax: 15, dmgPerStr: 0.5, armorMod: -5, duration: 3, maxUses: 1 },
  Paladin:  { name: "Spell2-Paladin",  type: "damage_debuff", baseDmgMin: 6, baseDmgMax: 12, dmgPerStr: 0.4, strPct: -0.15, armorMod: -3, duration: 6, maxUses: 1 },
  Ranger:   { name: "Spell2-Ranger",   type: "damage_debuff", baseDmgMin: 5, baseDmgMax: 10, dmgPerAgi: 0.35, armorMod: -6, duration: 6, maxUses: 1 },
  Rogue:    { name: "Spell2-Rogue",    type: "damage_buff",   baseDmgMin: 3, baseDmgMax: 6, dmgPerAgi: 0.3, agiPct: 0.15, duration: 5, maxUses: 2 },
  Druid:    { name: "Spell2-Druid",    type: "self_buff",     intPct: 0.12, armorMod: 6, hpPct: 0.20, duration: 6, maxUses: 2 },
  Warlock:  { name: "Spell2-Warlock",  type: "self_buff",     intPct: 0.12, armorMod: 10, hpPct: 0.20, duration: 8, maxUses: 2 },
  Wizard:   { name: "Spell2-Wizard",   type: "self_buff",     intPct: 0.20, armorMod: 15, hpPct: 0.25, duration: 10, maxUses: 2 },
  Sorcerer: { name: "Spell2-Sorcerer", type: "self_buff",     intPct: 0.15, armorMod: 12, hpPct: 0.20, duration: 10, maxUses: 2 },
  Cleric:   { name: "Spell2-Cleric",   type: "damage_debuff", baseDmgMin: 5, baseDmgMax: 10, dmgPerInt: 0.4, strPct: -0.15, agiPct: -0.15, armorMod: -5, duration: 8, maxUses: 2 },
};

// ============================================================
//  DROP LEVEL GATING — Z3 gear progression
//  R1 drops from L21-23 → available at L21
//  R2 drops from L24-26 → available at L24
//  R3 drops from L27-29 → available at L27
//  R4 drops from L30 boss → available at L30
// ============================================================

const Z3_WEAPON_DROP_LEVEL: Record<string, number> = {};
const Z3_ARMOR_DROP_LEVEL: Record<string, number> = {};

for (const w of Z3_WEAPONS) {
  if (w.rarity <= 1) Z3_WEAPON_DROP_LEVEL[w.name] = 21;
  else if (w.rarity <= 2) Z3_WEAPON_DROP_LEVEL[w.name] = 24;
  else if (w.rarity <= 3) Z3_WEAPON_DROP_LEVEL[w.name] = 27;
  else Z3_WEAPON_DROP_LEVEL[w.name] = 30;
}
for (const a of Z3_ARMORS) {
  if (a.rarity <= 1) Z3_ARMOR_DROP_LEVEL[a.name] = 21;
  else if (a.rarity <= 2) Z3_ARMOR_DROP_LEVEL[a.name] = 24;
  else if (a.rarity <= 3) Z3_ARMOR_DROP_LEVEL[a.name] = 27;
  else Z3_ARMOR_DROP_LEVEL[a.name] = 30;
}

// Z2 drop levels
const Z2_WEAPON_DROP_LEVEL: Record<string, number> = {};
const Z2_ARMOR_DROP_LEVEL: Record<string, number> = {};
for (const w of Z2_WEAPONS) {
  if (w.rarity <= 1) Z2_WEAPON_DROP_LEVEL[w.name] = 11;
  else if (w.rarity <= 2) Z2_WEAPON_DROP_LEVEL[w.name] = 14;
  else if (w.rarity <= 3) Z2_WEAPON_DROP_LEVEL[w.name] = 17;
  else Z2_WEAPON_DROP_LEVEL[w.name] = 20;
}
for (const a of Z2_ARMORS) {
  if (a.rarity <= 1) Z2_ARMOR_DROP_LEVEL[a.name] = 11;
  else if (a.rarity <= 2) Z2_ARMOR_DROP_LEVEL[a.name] = 14;
  else if (a.rarity <= 3) Z2_ARMOR_DROP_LEVEL[a.name] = 17;
  else Z2_ARMOR_DROP_LEVEL[a.name] = 20;
}

const ALL_DROP_LEVELS: Record<string, number> = { ...Z2_WEAPON_DROP_LEVEL, ...Z2_ARMOR_DROP_LEVEL, ...Z3_WEAPON_DROP_LEVEL, ...Z3_ARMOR_DROP_LEVEL };

function weaponsAvailableAtLevel(allWeapons: Weapon[], level: number): Weapon[] {
  return allWeapons.filter(w => {
    const dropLvl = ALL_DROP_LEVELS[w.name];
    if (dropLvl === undefined) return true; // DC weapon — always available
    return level >= dropLvl;
  });
}

function armorsAvailableAtLevel(allArmors: Armor[], level: number): Armor[] {
  return allArmors.filter(a => {
    const dropLvl = ALL_DROP_LEVELS[a.name];
    if (dropLvl === undefined) return true;
    return level >= dropLvl;
  });
}

// ============================================================
//  DATA LOADING
// ============================================================

function loadData(): GameData {
  const zonePath = resolve(__dirname, "../../zones/dark_cave");
  const constantsPath = resolve(__dirname, "./constants.json");
  const baseData = loadGameData(zonePath, constantsPath);
  const flags: SimFlags = {
    useRebalanced: false, useV2: false, useV3: true, useV4: false,
    useArmor: true, useSpells: true, useRetunedMonsters: true, useOnchain: false,
  };
  const data = applyOverrides(baseData, flags);

  // Match on-chain evasion cap
  data.combatConstants.evasionCap = 25;

  // Inject Z2 content
  data.weapons.push(...Z2_WEAPONS);
  data.armors.push(...Z2_ARMORS);
  for (const [name, effects] of Object.entries(Z2_WEAPON_EFFECTS)) data.weaponEffects[name] = effects;
  for (const [name, effects] of Object.entries(Z2_MONSTER_EFFECTS)) data.monsterWeaponEffects[name] = effects;

  // Inject Z3 content
  data.weapons.push(...Z3_WEAPONS);
  data.armors.push(...Z3_ARMORS);
  for (const [name, effects] of Object.entries(Z3_WEAPON_EFFECTS)) data.weaponEffects[name] = effects;
  for (const [name, effects] of Object.entries(Z3_MONSTER_EFFECTS)) data.monsterWeaponEffects[name] = effects;

  return data;
}

function buildArchetypes(data: GameData): Archetype[] {
  return Object.entries(data.archetypeConfigs).map(([id, cfg]) => {
    const className = cfg.class.charAt(0).toUpperCase() + cfg.class.slice(1);
    return {
      id, name: cfg.name, className,
      advClass: data.classes[cfg.class],
      race: data.races[cfg.race],
      startingArmor: data.startingArmors[cfg.armor],
      powerSource: data.powerSources[cfg.power],
      statPath: cfg.path,
      baseRoll: data.baseRolls[cfg.path],
    };
  });
}

// ============================================================
//  POWER SOURCE BONUS — Z3 adds L15 and L25 bonus levels
// ============================================================

function applyPowerSourceBonuses(
  str: number, agi: number, int_: number, hp: number,
  level: number, powerType: "divine" | "weave" | "physical",
  statPath: "str" | "agi" | "int",
): { str: number; agi: number; int: number; hp: number; extraPrimaryPts: number } {
  let extraPts = 0;
  const bonusLevels = [5, 15, 25]; // L5 (Z1), L15 (Z2), L25 (Z3)

  for (const bl of bonusLevels) {
    if (level < bl) break;
    if (powerType === "physical") extraPts += 1;
    else if (powerType === "weave") int_ += 1;
    else if (powerType === "divine") hp += 2;
  }

  return { str, agi, int: int_, hp, extraPrimaryPts: extraPts };
}

// ============================================================
//  EQUIP CHECKS — extended for HP-gated items
// ============================================================

function canEquipZ3(weapon: Weapon, profile: StatProfile): boolean {
  if (!_canEquip(weapon, profile)) return false;
  if (weapon.minHp && profile.hp < weapon.minHp) return false;
  return true;
}

function canEquipArmorZ3(armor: Armor, profile: StatProfile): boolean {
  if (!_canEquipArmor(armor, profile)) return false;
  if (armor.minHp && profile.hp < armor.minHp) return false;
  return true;
}

// ============================================================
//  GEAR SELECTION (extended from Z2 for Z3 content)
// ============================================================

function getWeaponEffects(weaponName: string, data: GameData): WeaponEffect[] {
  return data.weaponEffects[weaponName] || data.monsterWeaponEffects[weaponName] || [];
}

function estimateEffectValue(weaponName: string, data: GameData): number {
  const effects = getWeaponEffects(weaponName, data);
  let value = 0;
  for (const e of effects) {
    switch (e.type) {
      case "dot": value += (e.damagePerTick ?? 0) * (e.maxStacks ?? 1) * 1.2; break;
      case "stat_debuff":
        value += Math.abs(e.strMod ?? 0) * 0.8 + Math.abs(e.agiMod ?? 0) * 0.5 + Math.abs(e.intMod ?? 0) * 0.4;
        break;
      case "dual_magic": value += 4.0; break;
      case "silence": value += 5.0; break;   // high value — denies a turn
      case "root": value += 4.0; break;      // strips evasion
      case "reflect": value += 3.5; break;   // conditional but punishing
    }
  }
  return value;
}

interface GearLoadout {
  profile: StatProfile;
  weapon: Weapon;
  weapon2: Weapon | null;
  weapon3: Weapon | null;
  armor: Armor | null;
  armorRating: number;
}

function buildGearLoadout(arch: Archetype, level: number, data: GameData, availWeapons?: Weapon[], availArmors?: Armor[]): GearLoadout {
  const weaponPool = availWeapons ?? data.weapons;
  const armorPool = availArmors ?? data.armors;
  const cc = data.combatConstants;
  const lc = data.levelingConstants;
  const secondaryStats: ("str" | "agi" | "int")[] =
    arch.statPath === "str" ? ["agi", "int"] :
    arch.statPath === "agi" ? ["str", "int"] : ["str", "agi"];

  function getBaseStats() {
    let str = arch.baseRoll.str + arch.race.str + arch.startingArmor.str;
    let agi = arch.baseRoll.agi + arch.race.agi + arch.startingArmor.agi;
    let int_ = arch.baseRoll.int + arch.race.int + arch.startingArmor.int;
    let hp = lc.baseHp + arch.race.hp + arch.startingArmor.hp;
    hp += totalHpFromLeveling(level, lc);

    // Power source bonuses at L5, L15, L25
    const ps = applyPowerSourceBonuses(str, agi, int_, hp, level, arch.powerSource.type, arch.statPath);
    str = ps.str; agi = ps.agi; int_ = ps.int; hp = ps.hp;
    const extraPrimaryPt = ps.extraPrimaryPts;

    if (level >= 10) {
      str += arch.advClass.flatStr;
      agi += arch.advClass.flatAgi;
      int_ += arch.advClass.flatInt;
      hp += arch.advClass.flatHp;
    }

    return { str, agi, int: int_, hp, extraPrimaryPt };
  }

  const base = getBaseStats();
  const totalPoints = totalStatPointsAtLevel(level, lc) + base.extraPrimaryPt;

  let bestLoadout: GearLoadout | null = null;
  let bestScore = -Infinity;

  for (let offPath = 0; offPath <= 6; offPath++) {
    const primaryPoints = totalPoints - offPath;
    if (primaryPoints < 0) break;

    for (let s1 = offPath; s1 >= 0; s1--) {
      const s2 = offPath - s1;
      let str = base.str, agi = base.agi, int_ = base.int, hp = base.hp;

      if (arch.statPath === "str") str += primaryPoints;
      else if (arch.statPath === "agi") agi += primaryPoints;
      else int_ += primaryPoints;

      if (secondaryStats[0] === "str") str += s1;
      else if (secondaryStats[0] === "agi") agi += s1;
      else int_ += s1;

      if (secondaryStats[1] === "str") str += s2;
      else if (secondaryStats[1] === "agi") agi += s2;
      else int_ += s2;

      if (level >= 10 && arch.advClass.hpMult !== cc.classMultiplierBase) {
        hp = Math.floor((hp * arch.advClass.hpMult) / cc.classMultiplierBase);
      }

      const dom = _getDominant(str, agi, int_);
      const baseProfile: StatProfile = { str, agi, int: int_, hp, totalStats: str + agi + int_, primaryStat: dom.stat, dominantType: dom.type };

      // Select best armor
      const equippableArmor = armorPool.filter(a => canEquipArmorZ3(a, baseProfile));
      let armor: Armor | null = null;
      if (equippableArmor.length > 0) {
        const scoredArmor = equippableArmor.map(a => {
          let score = a.armorValue * 1.5 + a.hpMod;
          const pathBonus = arch.statPath === "str" ? a.strMod : arch.statPath === "agi" ? a.agiMod : a.intMod;
          score += pathBonus * 2.0 + (a.strMod + a.agiMod + a.intMod) * 0.3 + a.rarity * 0.1;
          // Bonus for CC resistance
          if (a.ccResist) {
            score += (a.ccResist.silenceReduction ?? 0) * 2.0 + (a.ccResist.rootReduction ?? 0) * 2.0;
          }
          // Bonus for party aura (value in multiplayer)
          if (a.partyAura) {
            score += (a.partyAura.armorMod ?? 0) * 1.0 + (a.partyAura.dotReduction ?? 0) * 1.5;
          }
          return { armor: a, score };
        });
        scoredArmor.sort((a, b) => b.score - a.score);
        armor = scoredArmor[0].armor;
      }

      let profile = baseProfile;
      let armorRating = 0;
      if (armor) {
        const s2 = profile.str + armor.strMod;
        const a2 = profile.agi + armor.agiMod;
        const i2 = profile.int + armor.intMod;
        const h2 = profile.hp + armor.hpMod;
        const d2 = _getDominant(s2, a2, i2);
        profile = { str: s2, agi: a2, int: i2, hp: h2, totalStats: s2 + a2 + i2, primaryStat: d2.stat, dominantType: d2.type };
        armorRating = armor.armorValue;
      }

      // Select best weapon
      const equippableWeapons = weaponPool.filter(w => canEquipZ3(w, profile));
      if (equippableWeapons.length === 0) continue;

      const scoredWeapons = equippableWeapons.map(w => {
        const avgDmg = (w.minDamage + w.maxDamage) / 2;
        const scalingMod = w.isMagic ? cc.attackModifier : w.scaling === "agi" ? cc.agiAttackModifier : cc.attackModifier;
        let attackerStat: number;
        if (w.isMagic) attackerStat = profile.int + w.intMod;
        else if (w.scaling === "agi") attackerStat = profile.agi + w.agiMod;
        else attackerStat = profile.str + w.strMod;

        const baseDmg = avgDmg * scalingMod;
        const statBonus = Math.max(0, attackerStat * scalingMod - 10) / 2;
        const classMult = w.isMagic ? arch.advClass.spellMult / 1000 : arch.advClass.physMult / 1000;
        const effectMult = 1 + estimateEffectValue(w.name, data) / 25;
        return { weapon: w, score: (baseDmg + statBonus) * classMult * effectMult + w.hpMod * 0.3 };
      });
      scoredWeapons.sort((a, b) => b.score - a.score);
      const weapon = scoredWeapons[0].weapon;

      // Score entire loadout
      const avgDmg = (weapon.minDamage + weapon.maxDamage) / 2;
      const scalingMod = weapon.isMagic ? cc.attackModifier : weapon.scaling === "agi" ? cc.agiAttackModifier : cc.attackModifier;
      let attackerStat: number;
      if (weapon.isMagic) attackerStat = profile.int + weapon.intMod;
      else if (weapon.scaling === "agi") attackerStat = profile.agi + weapon.agiMod;
      else attackerStat = profile.str + weapon.strMod;

      const dmgScore = avgDmg * scalingMod + Math.max(0, attackerStat * scalingMod - 10) / 2;
      const classMult = weapon.isMagic ? arch.advClass.spellMult / 1000 : arch.advClass.physMult / 1000;
      const effectMult = 1 + estimateEffectValue(weapon.name, data) / 25;
      const weaponScore = dmgScore * classMult * effectMult + weapon.hpMod * 0.3;
      const armorScore = armorRating * 1.5 + (armor?.hpMod ?? 0) * 0.3;
      const combatAgi = profile.agi + weapon.agiMod;
      let agiScore = Math.max(0, combatAgi - 10) * 0.15;
      if (weapon.scaling === "agi" && !weapon.isMagic && arch.statPath === "agi"
          && arch.advClass.physMult >= arch.advClass.spellMult) {
        agiScore += combatAgi * 0.35;
      }
      const magicBypassScore = weapon.isMagic ? 4.0 : 0;
      const combatStr = profile.str + weapon.strMod;
      const strDefScore = combatStr > 10 ? (combatStr - 10) * 0.25 : 0;

      // Secondary weapon selection
      const secondaryPool = equippableWeapons.filter(w => {
        if (w.name === weapon.name) return false;
        if (weapon.isMagic !== w.isMagic) return true;
        if (!weapon.isMagic && !w.isMagic && weapon.scaling !== w.scaling) return true;
        return false;
      });
      let weapon2: Weapon | null = null;
      if (secondaryPool.length > 0) {
        const scored2 = secondaryPool.map(w => {
          const avg = (w.minDamage + w.maxDamage) / 2;
          const sm = w.isMagic ? cc.attackModifier : w.scaling === "agi" ? cc.agiAttackModifier : cc.attackModifier;
          let stat: number;
          if (w.isMagic) stat = profile.int + w.intMod;
          else if (w.scaling === "agi") stat = profile.agi + w.agiMod;
          else stat = profile.str + w.strMod;
          const cm = w.isMagic ? arch.advClass.spellMult / 1000 : arch.advClass.physMult / 1000;
          const em = 1 + estimateEffectValue(w.name, data) / 25;
          const dps = (avg * sm + Math.max(0, stat * sm - 10) / 2) * cm * em;
          const coverageBonus = weapon.isMagic !== w.isMagic ? 3.0 : 1.0;
          return { weapon: w, score: dps * coverageBonus + w.hpMod * 0.3 };
        });
        scored2.sort((a, b) => b.score - a.score);
        weapon2 = scored2[0].weapon;
      }

      // Tertiary weapon
      let weapon3: Weapon | null = null;
      if (weapon2) {
        const coveredTypes = new Set<string>();
        for (const w of [weapon, weapon2]) {
          if (w.isMagic) coveredTypes.add("magic");
          else if (w.scaling === "agi") coveredTypes.add("agi-phys");
          else coveredTypes.add("str-phys");
        }
        const tertiaryPool = equippableWeapons.filter(w => {
          if (w.name === weapon.name || w.name === weapon2!.name) return false;
          const cat = w.isMagic ? "magic" : w.scaling === "agi" ? "agi-phys" : "str-phys";
          return !coveredTypes.has(cat);
        });
        if (tertiaryPool.length > 0) {
          const scored3 = tertiaryPool.map(w => {
            const avg = (w.minDamage + w.maxDamage) / 2;
            const sm = w.isMagic ? cc.attackModifier : w.scaling === "agi" ? cc.agiAttackModifier : cc.attackModifier;
            let stat: number;
            if (w.isMagic) stat = profile.int + w.intMod;
            else if (w.scaling === "agi") stat = profile.agi + w.agiMod;
            else stat = profile.str + w.strMod;
            const cm = w.isMagic ? arch.advClass.spellMult / 1000 : arch.advClass.physMult / 1000;
            const em = 1 + estimateEffectValue(w.name, data) / 25;
            return { weapon: w, score: (avg * sm + Math.max(0, stat * sm - 10) / 2) * cm * em + w.hpMod * 0.3 };
          });
          scored3.sort((a, b) => b.score - a.score);
          weapon3 = scored3[0].weapon;
        }
      }

      const totalScore = weaponScore + armorScore + agiScore + magicBypassScore + strDefScore;
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestLoadout = { profile, weapon, weapon2, weapon3, armor, armorRating };
      }
    }
  }

  return bestLoadout!;
}

// ============================================================
//  MULTI-COMBATANT COMBAT ENGINE
//  Simultaneous lock-in with speed-ordered resolution.
// ============================================================

export interface Spell3Tracker {
  spell: ClassSpell;
  usesRemaining: number;
  cooldownUntil: number; // round number when next cast is allowed
}

export interface PartyMember {
  combatant: Combatant;
  archetype: Archetype;
  gear: GearLoadout;
  hp: number;
  maxHp: number;
  effects: ActiveEffectInstance[];
  ccHistory: CcHistoryEntry[];
  threat: number;
  alive: boolean;
  spell3: Spell3Tracker | null;
  soulLinkedTo: number; // index of ally soul-linked to (-1 = none)
}

/** Build a PartyMember from archetype + level + data */
export function buildPartyMember(arch: Archetype, level: number, data: GameData, useSpell3 = false): PartyMember {
  const availWeapons = weaponsAvailableAtLevel(data.weapons, level);
  const availArmors = armorsAvailableAtLevel(data.armors, level);
  const gear = buildGearLoadout(arch, level, data, availWeapons, availArmors);

  // Spell3 replaces weapon3 in the 4-slot loadout (weapon, weapon2, armor, spell3)
  let spell3: Spell3Tracker | null = null;
  if (useSpell3 && level >= 25) {
    const spellDef = CLASS_SPELLS_3[arch.className];
    if (spellDef) {
      gear.weapon3 = null; // drop tertiary weapon for spell3 slot
      spell3 = { spell: spellDef, usesRemaining: spellDef.maxUses ?? 1, cooldownUntil: 0 };
    }
  }

  const combatant = _makeCombatant(gear.profile, gear.weapon, arch.advClass, gear.armorRating, arch.className);
  return {
    combatant, archetype: arch, gear,
    hp: combatant.maxHp, maxHp: combatant.maxHp,
    effects: [], ccHistory: [], threat: 0, alive: true,
    spell3, soulLinkedTo: -1,
  };
}

/**
 * Spell3 casting AI — decides whether to cast spell3 this round.
 * Returns true if spell3 was cast (skip normal attack for this member).
 */
export function trycastSpell3(
  pm: PartyMember,
  party: PartyMember[],
  mob: Combatant,
  mobEffects: ActiveEffectInstance[],
  mobCcHistory: CcHistoryEntry[],
  round: number,
  cc: CombatConstants,
  totalDmgDealt: { value: number },
  totalDmgTaken: { value: number },
): boolean {
  if (!pm.spell3 || pm.spell3.usesRemaining <= 0 || pm.spell3.cooldownUntil > round) return false;
  if (isSilenced(pm.effects)) return false; // silenced = can't cast

  const spell = pm.spell3.spell;
  const aliveAllies = party.filter(p => p.alive && p !== pm);
  const pmIdx = party.indexOf(pm);

  switch (spell.type) {
    case "guard": {
      // Guard: cast when an ally is below 50% HP (protect them)
      const wounded = aliveAllies.find(a => a.hp < a.maxHp * 0.5);
      if (!wounded && aliveAllies.length > 0) {
        // Also guard the squishiest ally if it's round 1-2 (preemptive)
        if (round > 2) return false;
      }
      const target = wounded ?? aliveAllies[0];
      if (!target) return false;
      // Guardian absorbs guardDmgPct of damage meant for target for 1 round
      // Modeled as a temporary effect — tracked in simulatePartyPvE via guardTarget field
      // We'll mark this on the PM and handle in the damage phase
      pm.spell3.usesRemaining--;
      pm.spell3.cooldownUntil = round + 2;
      return true;
    }

    case "party_buff": {
      // Holy Aura: cast early for maximum uptime (round 1 or 2)
      if (round > 3 && aliveAllies.every(a => a.hp > a.maxHp * 0.6)) return false;
      // Apply armor buff to all allies + heal
      for (const ally of [...aliveAllies, pm]) {
        if (!ally.alive) continue;
        // Armor buff as effect
        if (!ally.effects.some(e => e.name === spell.name)) {
          ally.effects.push({
            name: spell.name, type: "stat_debuff", // reuse stat_debuff type for buff
            turnsRemaining: spell.duration ?? 6,
            damagePerTick: 0, strMod: 0, agiMod: 0, intMod: 0,
            armorMod: spell.armorMod ?? 0,
          });
        }
        // Heal
        if (spell.hpPct) {
          const heal = Math.floor(ally.maxHp * spell.hpPct);
          ally.hp = Math.min(ally.maxHp, ally.hp + heal);
        }
      }
      pm.spell3.usesRemaining--;
      pm.spell3.cooldownUntil = round + (spell.duration ?? 6);
      return true;
    }

    case "root": {
      // Pin Shot: root the boss + deal damage. Cast on cooldown.
      const dur = getCcDiminishedDuration(spell.ccDuration ?? 3, "root", mobCcHistory, round);
      if (dur <= 0) return false; // immune, don't waste
      applyRoot(mobEffects, dur, spell.name);
      mobCcHistory.push({ type: "root", appliedRound: round });
      // Deal spell damage
      const dmg = randInt(spell.baseDmgMin ?? 5, spell.baseDmgMax ?? 10)
        + Math.floor((spell.dmgPerAgi ?? 0) * pm.combatant.agi);
      mob.hp -= dmg;
      totalDmgDealt.value += dmg;
      pm.threat += dmg;
      pm.spell3.usesRemaining--;
      pm.spell3.cooldownUntil = round + 2;
      return true;
    }

    case "silence": {
      // Throat Cut: silence the boss + deal damage. Cast on cooldown.
      const dur = getCcDiminishedDuration(spell.ccDuration ?? 3, "silence", mobCcHistory, round);
      if (dur <= 0) return false;
      applySilence(mobEffects, dur, spell.name);
      mobCcHistory.push({ type: "silence", appliedRound: round });
      const dmg = randInt(spell.baseDmgMin ?? 5, spell.baseDmgMax ?? 10)
        + Math.floor((spell.dmgPerAgi ?? 0) * pm.combatant.agi);
      mob.hp -= dmg;
      totalDmgDealt.value += dmg;
      pm.threat += dmg;
      pm.spell3.usesRemaining--;
      pm.spell3.cooldownUntil = round + 2;
      return true;
    }

    case "reflect": {
      // Nature's Mirror / Arcane Barrier: apply reflect to self or squishiest ally
      // Cast when boss is using magic or preemptively
      if (spell.targetAlly && aliveAllies.length > 0) {
        // Target squishiest ally (lowest armor)
        const target = aliveAllies.sort((a, b) => a.combatant.armor - b.combatant.armor)[0];
        applyReflect(target.effects, spell.duration ?? 2, spell.reflectPct ?? 0.6, spell.name);
      } else {
        applyReflect(pm.effects, spell.duration ?? 2, spell.reflectPct ?? 0.75, spell.name);
      }
      pm.spell3.usesRemaining--;
      pm.spell3.cooldownUntil = round + (spell.duration ?? 2) + 1;
      return true;
    }

    case "soul_link": {
      // Soul Link: link to squishiest ally (lowest HP%). Cast once, early.
      if (pm.soulLinkedTo >= 0) return false; // already linked
      if (aliveAllies.length === 0) return false;
      const target = aliveAllies.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      const targetIdx = party.indexOf(target);
      pm.soulLinkedTo = targetIdx;
      // Soul link effect tracked via soulLinkedTo field, duration handled in combat
      pm.effects.push({
        name: spell.name, type: "stat_debuff",
        turnsRemaining: spell.duration ?? 6,
        damagePerTick: 0, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0,
      });
      pm.spell3.usesRemaining--;
      return true;
    }

    case "speed_buff": {
      // Haste: target highest-DPS ally for AGI boost
      if (aliveAllies.length === 0) return false;
      const target = aliveAllies.sort((a, b) => b.threat - a.threat)[0];
      if (!target.effects.some(e => e.name === spell.name)) {
        // AGI boost modeled as stat buff
        const agiBoost = Math.floor(target.combatant.agi * (spell.agiPct ?? 0.20));
        target.effects.push({
          name: spell.name, type: "stat_debuff",
          turnsRemaining: spell.duration ?? 3,
          damagePerTick: 0, strMod: 0, agiMod: agiBoost, intMod: 0, armorMod: 0,
        });
      }
      pm.spell3.usesRemaining--;
      pm.spell3.cooldownUntil = round + (spell.duration ?? 3);
      return true;
    }

    case "ally_heal": {
      // Divine Intervention: heal ally below 40% HP + cleanse debuffs
      const critical = aliveAllies.find(a => a.hp < a.maxHp * 0.4);
      if (!critical) {
        // Also heal self if below 40%
        if (pm.hp >= pm.maxHp * 0.4) return false;
        const heal = Math.floor(pm.maxHp * (spell.hpPct ?? 0.40));
        pm.hp = Math.min(pm.maxHp, pm.hp + heal);
        pm.effects = pm.effects.filter(e => e.type !== "dot" && e.type !== "stat_debuff" || e.armorMod > 0);
        pm.spell3.usesRemaining--;
        return true;
      }
      const heal = Math.floor(critical.maxHp * (spell.hpPct ?? 0.40));
      critical.hp = Math.min(critical.maxHp, critical.hp + heal);
      // Cleanse debuffs (remove dots and negative stat_debuffs)
      critical.effects = critical.effects.filter(e =>
        e.type !== "dot" && !(e.type === "stat_debuff" && (e.strMod < 0 || e.agiMod < 0 || e.intMod < 0 || e.armorMod < 0))
      );
      pm.spell3.usesRemaining--;
      return true;
    }

    default:
      return false;
  }
}

/**
 * Boss targeting AI — weighted threat table.
 * Prefers: highest threat > lowest HP > squishiest (least armor).
 * Taunt overrides everything.
 */
function bossPickTarget(party: PartyMember[], round: number): number {
  const alive = party.map((p, i) => ({ p, i })).filter(x => x.p.alive);
  if (alive.length === 0) return 0;
  if (alive.length === 1) return alive[0].i;

  // Score each target
  const scored = alive.map(({ p, i }) => {
    let score = p.threat * 2;                    // threat weight
    score += (1 - p.hp / p.maxHp) * 30;          // focus wounded targets
    score += (10 - p.combatant.armor) * 2;       // prefer squishy
    // Randomness for unpredictability
    score += randInt(0, 15);
    return { index: i, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].index;
}

/**
 * Simulate a multi-combatant PvE fight.
 * Party of 1-3 players vs a single monster (optionally elite with phases).
 */
export function simulatePartyPvE(
  party: PartyMember[],
  monster: Monster,
  data: GameData,
): MultiCombatResult {
  const cc = data.combatConstants;
  const partySize = party.length;

  // Scale boss HP for party size
  let bossHp = monster.hp;
  if (monster.isElite && partySize > 1) {
    bossHp = Math.floor(monster.hp * (1 + (partySize - 1) * (monster.partyHpScale ?? 0.7)));
  }

  const mob = _makeMonsterCombatant(monster, !!Z3_MONSTER_EFFECTS[monster.name]);
  mob.hp = bossHp;
  mob.maxHp = bossHp;

  const mobEffects: ActiveEffectInstance[] = [];
  const mobCcHistory: CcHistoryEntry[] = [];

  // Monster weapon effects
  const mWeaponEffects = getWeaponEffects(mob.weapon.name, data);
  const mBreathEffect = mWeaponEffects.find(e => e.type === "magic_breath");
  const mBreathCooldown = { lastUsed: -999 };

  // Track which phase effects are active
  let activePhaseIndex = -1;

  let rounds = 0;
  let totalDmgDealt = 0;
  let totalDmgTaken = 0;

  // Reset party state
  for (const pm of party) {
    pm.hp = pm.maxHp;
    pm.effects = [];
    pm.ccHistory = [];
    pm.threat = 0;
    pm.alive = true;
    pm.soulLinkedTo = -1;
    if (pm.spell3) {
      pm.spell3.usesRemaining = pm.spell3.spell.maxUses ?? 1;
      pm.spell3.cooldownUntil = 0;
    }
  }

  while (rounds < MAX_COMBAT_ROUNDS) {
    rounds++;
    const aliveParty = party.filter(p => p.alive);
    if (aliveParty.length === 0 || mob.hp <= 0) break;

    // Check phase transitions
    if (monster.phases) {
      for (let pi = activePhaseIndex + 1; pi < monster.phases.length; pi++) {
        const phase = monster.phases[pi];
        if (mob.hp / mob.maxHp <= phase.hpPct) {
          activePhaseIndex = pi;
          if (phase.enragePct) {
            mob.physMult = Math.floor(1000 * (1 + phase.enragePct));
            mob.spellMult = Math.floor(1000 * (1 + phase.enragePct));
          }
        }
      }
    }

    // Tick effects for all combatants
    for (const pm of aliveParty) {
      const dot = tickEffects(pm.effects);
      pm.hp -= dot;
      totalDmgTaken += dot;
      if (pm.hp <= 0) { pm.alive = false; continue; }
    }
    const mobDot = tickEffects(mobEffects);
    mob.hp -= mobDot;
    totalDmgDealt += mobDot;
    if (mob.hp <= 0) break;

    // --- Party members act (speed-ordered by AGI) ---
    const orderedParty = aliveParty
      .filter(p => p.alive)
      .sort((a, b) => b.combatant.agi - a.combatant.agi);

    // Check soul link damage sharing — clear expired links
    for (const pm of aliveParty) {
      if (pm.soulLinkedTo >= 0) {
        const linkEffect = pm.effects.find(e => e.name === "Soul Link");
        if (!linkEffect || linkEffect.turnsRemaining <= 0) pm.soulLinkedTo = -1;
      }
    }

    for (const pm of orderedParty) {
      if (mob.hp <= 0) break;
      if (!pm.alive) continue;

      // Try spell3 first — if cast, skip normal attack
      const dmgTrackers = { value: 0 };
      const takenTrackers = { value: 0 };
      const castSpell3 = trycastSpell3(
        pm, party, mob, mobEffects, mobCcHistory,
        rounds, cc, dmgTrackers, takenTrackers,
      );
      if (castSpell3) {
        totalDmgDealt += dmgTrackers.value;
        totalDmgTaken += takenTrackers.value;
        continue; // spell3 consumes the action
      }

      const adj = adjustCombatant(pm.combatant, pm.effects);
      const adjMob = adjustCombatant(mob, mobEffects);

      // Attack with best weapon, applying new effect types
      const defRooted = isRooted(mobEffects);
      const defReflect = getReflectPct(mobEffects);

      const { damage, reflected } = resolveAttackZ3(adj, adjMob, cc, rng, defRooted, defReflect);
      mob.hp -= damage;
      totalDmgDealt += damage;
      pm.threat += damage;

      // Reflected damage hits the attacker
      if (reflected > 0) {
        pm.hp -= reflected;
        totalDmgTaken += reflected;
        if (pm.hp <= 0) { pm.alive = false; }
      }

      // Apply weapon effects on hit
      if (damage > 0) {
        const effects = getWeaponEffects(pm.gear.weapon.name, data);
        for (const e of effects) {
          if (e.type === "dot") {
            const existing = mobEffects.find(x => x.name === e.name);
            if (existing) existing.turnsRemaining = e.duration ?? 3;
            else mobEffects.push({ name: e.name, type: "dot", turnsRemaining: e.duration ?? 3,
              damagePerTick: e.damagePerTick ?? 0, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0 });
          } else if (e.type === "stat_debuff") {
            if (!mobEffects.some(x => x.name === e.name))
              mobEffects.push({ name: e.name, type: "stat_debuff", turnsRemaining: e.duration ?? 3,
                damagePerTick: 0, strMod: e.strMod ?? 0, agiMod: e.agiMod ?? 0, intMod: e.intMod ?? 0, armorMod: e.armorMod ?? 0 });
          } else if (e.type === "silence") {
            const dur = getCcDiminishedDuration(e.duration ?? 2, "silence", mobCcHistory, rounds);
            if (dur > 0) {
              applySilence(mobEffects, dur, e.name);
              mobCcHistory.push({ type: "silence", appliedRound: rounds });
            }
          } else if (e.type === "root") {
            const dur = getCcDiminishedDuration(e.duration ?? 2, "root", mobCcHistory, rounds);
            if (dur > 0) {
              applyRoot(mobEffects, dur, e.name);
              mobCcHistory.push({ type: "root", appliedRound: rounds });
            }
          } else if (e.type === "dual_magic" && mob.hp > 0) {
            const dualDmg = _resolveDualMagicHit(adj, adjMob, cc, rng);
            mob.hp -= dualDmg;
            totalDmgDealt += dualDmg;
            pm.threat += dualDmg;
          }
        }
      }
    }

    if (mob.hp <= 0) break;

    // --- Monster acts ---
    const targetIdx = bossPickTarget(party, rounds);
    const target = party[targetIdx];
    if (!target || !target.alive) continue;

    const adjMob = adjustCombatant(mob, mobEffects);
    const adjTarget = adjustCombatant(target.combatant, target.effects);

    // Check if monster is silenced (can't use breath/special)
    const mobSilenced = isSilenced(mobEffects);

    // Main attack — with guard interception and soul link sharing
    const targetRooted = isRooted(target.effects);
    const targetReflect = getReflectPct(target.effects);
    const { damage: mDmg, reflected: mReflected } = resolveAttackZ3(adjMob, adjTarget, cc, rng, targetRooted, targetReflect);

    // Guard interception: check if any ally is guarding the target
    const guardian = party.find((p, i) =>
      p.alive && i !== targetIdx && p.spell3?.spell.type === "guard"
      && p.spell3.cooldownUntil > rounds // guard was cast recently (active this round)
    );

    if (guardian && guardian.spell3) {
      const guardPct = guardian.spell3.spell.guardDmgPct ?? 0.6;
      const guardedDmg = Math.max(1, Math.floor(mDmg * guardPct));
      const targetDmg = mDmg - guardedDmg;
      guardian.hp -= guardedDmg;
      target.hp -= targetDmg;
      totalDmgTaken += mDmg;
      if (guardian.hp <= 0) guardian.alive = false;
    } else {
      // Soul link sharing: if target has a soul-linked warlock, split damage 50/50
      const linker = party.find(p => p.alive && p.soulLinkedTo === targetIdx);
      if (linker) {
        const splitDmg = Math.max(1, Math.floor(mDmg * 0.5));
        target.hp -= splitDmg;
        linker.hp -= (mDmg - splitDmg);
        totalDmgTaken += mDmg;
        if (linker.hp <= 0) linker.alive = false;
      } else {
        target.hp -= mDmg;
        totalDmgTaken += mDmg;
      }
    }

    if (mReflected > 0) {
      mob.hp -= mReflected;
      totalDmgDealt += mReflected;
    }

    // Monster weapon effects on hit
    if (mDmg > 0) {
      const mEffects = getWeaponEffects(mob.weapon.name, data);
      for (const e of mEffects) {
        if (e.type === "dot") {
          const existing = target.effects.find(x => x.name === e.name);
          if (existing) existing.turnsRemaining = e.duration ?? 3;
          else target.effects.push({ name: e.name, type: "dot", turnsRemaining: e.duration ?? 3,
            damagePerTick: e.damagePerTick ?? 0, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0 });
        } else if (e.type === "stat_debuff" && (!e.cooldown || (rounds % (e.cooldown + 1)) === 0)) {
          if (!target.effects.some(x => x.name === e.name))
            target.effects.push({ name: e.name, type: "stat_debuff", turnsRemaining: e.duration ?? 3,
              damagePerTick: 0, strMod: e.strMod ?? 0, agiMod: e.agiMod ?? 0, intMod: e.intMod ?? 0, armorMod: e.armorMod ?? 0 });
        } else if (e.type === "silence" && !mobSilenced && (!e.cooldown || (rounds % (e.cooldown + 1)) === 0)) {
          const dur = getCcDiminishedDuration(e.duration ?? 2, "silence", target.ccHistory, rounds);
          const resistStat = target.combatant.int;
          const armorResist = target.gear.armor?.ccResist?.silenceReduction ?? 0;
          const finalDur = applyCcResistance(dur, resistStat, armorResist);
          if (finalDur > 0) {
            applySilence(target.effects, finalDur, e.name);
            target.ccHistory.push({ type: "silence", appliedRound: rounds });
          }
        } else if (e.type === "root" && (!e.cooldown || (rounds % (e.cooldown + 1)) === 0)) {
          const dur = getCcDiminishedDuration(e.duration ?? 2, "root", target.ccHistory, rounds);
          const resistStat = target.combatant.str;
          const armorResist = target.gear.armor?.ccResist?.rootReduction ?? 0;
          const finalDur = applyCcResistance(dur, resistStat, armorResist);
          if (finalDur > 0) {
            applyRoot(target.effects, finalDur, e.name);
            target.ccHistory.push({ type: "root", appliedRound: rounds });
          }
        } else if (e.type === "reflect" && (!e.cooldown || (rounds % (e.cooldown + 1)) === 0)) {
          // Monster self-reflect
          applyReflect(mobEffects, e.duration ?? 2, e.reflectPct ?? 0.5, e.name);
        }
      }
    }

    if (target.hp <= 0) target.alive = false;

    // Cleave: hit a second target
    if (monster.cleave && party.filter(p => p.alive).length > 1) {
      const otherAlive = party.filter((p, i) => p.alive && i !== targetIdx);
      if (otherAlive.length > 0) {
        const cleaveTarget = otherAlive[randInt(0, otherAlive.length - 1)];
        const adjCleave = adjustCombatant(cleaveTarget.combatant, cleaveTarget.effects);
        // Cleave does 60% damage
        const cleaveRooted = isRooted(cleaveTarget.effects);
        const cleaveReflect = getReflectPct(cleaveTarget.effects);
        const { damage: cDmg, reflected: cRef } = resolveAttackZ3(adjMob, adjCleave, cc, rng, cleaveRooted, cleaveReflect);
        const cleaveDmg = Math.max(1, Math.floor(cDmg * 0.6));
        cleaveTarget.hp -= cleaveDmg;
        totalDmgTaken += cleaveDmg;
        if (cRef > 0) { mob.hp -= Math.floor(cRef * 0.6); totalDmgDealt += Math.floor(cRef * 0.6); }
        if (cleaveTarget.hp <= 0) cleaveTarget.alive = false;
      }
    }

    // Breath attack (if not silenced)
    if (!mobSilenced && mBreathEffect && target.alive && (rounds - mBreathCooldown.lastUsed) >= (mBreathEffect.cooldown ?? 2)) {
      const bDmg = _resolveBreathAttack(adjMob, adjTarget, mBreathEffect, cc, rng);
      // Check reflect for breath (it's magic)
      const breathReflect = getReflectPct(target.effects);
      target.hp -= bDmg;
      totalDmgTaken += bDmg;
      if (breathReflect > 0) {
        const breathReflected = Math.max(1, Math.floor(bDmg * breathReflect));
        mob.hp -= breathReflected;
        totalDmgDealt += breathReflected;
      }
      mBreathCooldown.lastUsed = rounds;
      if (target.hp <= 0) target.alive = false;
    }
  }

  const allDead = party.every(p => !p.alive);
  const bossDown = mob.hp <= 0;
  const winningSide = bossDown ? "party" : allDead ? "enemies" : "draw";

  return {
    winningSide,
    rounds,
    partyHpRemaining: party.map(p => Math.max(0, p.hp)),
    totalDamageDealt: totalDmgDealt,
    totalDamageTaken: totalDmgTaken,
  };
}

// ============================================================
//  2v2 PVP ENGINE
//  Simultaneous lock-in — each team attacks the other.
//  Speed-ordered resolution. First team to have both members die loses.
// ============================================================

/**
 * Simulate a 2v2 PvP fight. Returns 1 if team1 wins, 2 if team2 wins, 0 for draw.
 */
export function simulate2v2PvP(
  team1: PartyMember[],
  team2: PartyMember[],
  cc: CombatConstants,
  data?: GameData,
): number {
  // Reset all
  for (const pm of [...team1, ...team2]) {
    pm.hp = pm.maxHp;
    pm.effects = [];
    pm.ccHistory = [];
    pm.threat = 0;
    pm.alive = true;
    pm.soulLinkedTo = -1;
    if (pm.spell3) {
      pm.spell3.usesRemaining = pm.spell3.spell.maxUses ?? 1;
      pm.spell3.cooldownUntil = 0;
    }
  }

  let rounds = 0;

  while (rounds < MAX_COMBAT_ROUNDS) {
    rounds++;

    const t1alive = team1.filter(p => p.alive);
    const t2alive = team2.filter(p => p.alive);
    if (t1alive.length === 0 || t2alive.length === 0) break;

    // Tick effects
    for (const pm of [...t1alive, ...t2alive]) {
      const dot = tickEffects(pm.effects);
      pm.hp -= dot;
      if (pm.hp <= 0) pm.alive = false;
    }

    // Gather all alive combatants, sort by AGI (speed-ordered resolution)
    const allAlive: { pm: PartyMember; teamIdx: 1 | 2 }[] = [
      ...team1.filter(p => p.alive).map(pm => ({ pm, teamIdx: 1 as const })),
      ...team2.filter(p => p.alive).map(pm => ({ pm, teamIdx: 2 as const })),
    ];
    allAlive.sort((a, b) => b.pm.combatant.agi - a.pm.combatant.agi);

    for (const { pm, teamIdx } of allAlive) {
      if (!pm.alive) continue;
      const enemies = (teamIdx === 1 ? team2 : team1).filter(e => e.alive);
      if (enemies.length === 0) break;

      // Pick target: focus lowest HP enemy
      const target = enemies.sort((a, b) => a.hp - b.hp)[0];
      if (!target || !target.alive) continue;

      const adj = adjustCombatant(pm.combatant, pm.effects);
      const adjTarget = adjustCombatant(target.combatant, target.effects);

      const defRooted = isRooted(target.effects);
      const defReflect = getReflectPct(target.effects);

      const { damage, reflected } = resolveAttackZ3(adj, adjTarget, cc, rng, defRooted, defReflect);
      target.hp -= damage;
      if (reflected > 0) {
        pm.hp -= reflected;
        if (pm.hp <= 0) pm.alive = false;
      }
      if (target.hp <= 0) target.alive = false;

      // Apply weapon effects (dots, stat debuffs, CC)
      if (damage > 0 && data) {
        const wEffects = getWeaponEffects(pm.gear.weapon.name, data);
        for (const e of wEffects) {
          if (e.type === "dot") {
            const ex = target.effects.find(x => x.name === e.name);
            if (ex) ex.turnsRemaining = e.duration ?? 3;
            else target.effects.push({ name: e.name, type: "dot", turnsRemaining: e.duration ?? 3,
              damagePerTick: e.damagePerTick ?? 0, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0 });
          } else if (e.type === "stat_debuff" && !target.effects.some(x => x.name === e.name)) {
            target.effects.push({ name: e.name, type: "stat_debuff", turnsRemaining: e.duration ?? 3,
              damagePerTick: 0, strMod: e.strMod ?? 0, agiMod: e.agiMod ?? 0, intMod: e.intMod ?? 0, armorMod: e.armorMod ?? 0 });
          } else if (e.type === "silence") {
            const dur = getCcDiminishedDuration(e.duration ?? 2, "silence", target.ccHistory, rounds);
            const finalDur = applyCcResistance(dur, target.combatant.int, target.gear.armor?.ccResist?.silenceReduction ?? 0);
            if (finalDur > 0) {
              applySilence(target.effects, finalDur, e.name);
              target.ccHistory.push({ type: "silence", appliedRound: rounds });
            }
          } else if (e.type === "root") {
            const dur = getCcDiminishedDuration(e.duration ?? 2, "root", target.ccHistory, rounds);
            const finalDur = applyCcResistance(dur, target.combatant.str, target.gear.armor?.ccResist?.rootReduction ?? 0);
            if (finalDur > 0) {
              applyRoot(target.effects, finalDur, e.name);
              target.ccHistory.push({ type: "root", appliedRound: rounds });
            }
          } else if (e.type === "dual_magic" && target.alive) {
            const dualDmg = _resolveDualMagicHit(adj, adjTarget, cc, rng);
            target.hp -= dualDmg;
            if (target.hp <= 0) target.alive = false;
          }
        }
      }
    }

    // Check win conditions
    if (team1.every(p => !p.alive)) return 2;
    if (team2.every(p => !p.alive)) return 1;
  }

  // Draw: team with more surviving HP% wins
  const t1hpPct = team1.reduce((s, p) => s + Math.max(0, p.hp) / p.maxHp, 0) / team1.length;
  const t2hpPct = team2.reduce((s, p) => s + Math.max(0, p.hp) / p.maxHp, 0) / team2.length;
  return t1hpPct > t2hpPct ? 1 : t2hpPct > t1hpPct ? 2 : 0;
}

// ============================================================
//  JOURNEY SIM RUNNER
// ============================================================

function runJourney() {
  const args = new Set(process.argv.slice(2));
  const showSummaryOnly = args.has("--summary");
  const showBlockedOnly = args.has("--blocked");
  const showElite = args.has("--elite");
  const showPvP2v2 = args.has("--pvp-2v2");
  const useSpell3 = args.has("--spell3");
  const filterArch = process.argv.find(a => a.startsWith("--arch="))?.split("=")[1];
  const filterLevel = process.argv.find(a => a.startsWith("--level="))?.split("=")[1];
  const roundsOverride = process.argv.find(a => a.startsWith("--rounds="))?.split("=")[1];

  if (roundsOverride) {
    (MAX_COMBAT_ROUNDS as any) = parseInt(roundsOverride);
    console.log(`[OVERRIDE] MAX_COMBAT_ROUNDS = ${MAX_COMBAT_ROUNDS}`);
  }

  const data = loadData();
  const archetypes = buildArchetypes(data);

  console.log(`=== ZONE 3 JOURNEY SIM — L21-30 ===`);
  console.log(`${SIM_ITERATIONS} iterations per matchup. ${MAX_COMBAT_ROUNDS} round cap. Spell3: ${useSpell3 ? "ON" : "OFF"}.\n`);

  // Stat progression reference
  if (!showSummaryOnly) {
    console.log("--- STAT PROGRESSION REFERENCE (L20-30) ---");
    console.log("Level  StatPts  TotalPts  HPGain  TotalHP(base)");
    for (let l = 20; l <= 30; l++) {
      const sp = statPointsForLevel(l, data.levelingConstants);
      const tp = totalStatPointsAtLevel(l, data.levelingConstants);
      const hg = hpForLevel(l, data.levelingConstants);
      const th = totalHpFromLeveling(l, data.levelingConstants);
      console.log(`  ${String(l).padStart(2)}      ${sp}        ${String(tp).padStart(2)}        ${hg}       ${th}`);
    }
    console.log();
  }

  // ---- SOLO JOURNEY L21-30 ----
  const results: Record<string, { level: number; winRate: number; weapon: string; armor: string; stats: StatProfile }[]> = {};
  const blocked: { archId: string; level: number; winRate: number; weapon: string }[] = [];
  const pathWinRates: Record<string, number[]> = { str: [], agi: [], int: [] };
  const levelWinRates: Record<number, number[]> = {};

  for (const arch of archetypes) {
    if (filterArch && arch.id !== filterArch) continue;

    results[arch.id] = [];
    const archResults: string[] = [];

    for (let level = 21; level <= 30; level++) {
      if (filterLevel && level !== parseInt(filterLevel)) continue;

      const monster = Z3_MONSTERS.find(m => m.level === level);
      if (!monster) continue;

      // Skip elite monsters for solo journey (they're designed for parties)
      if (monster.isElite) continue;

      const availWeapons = weaponsAvailableAtLevel(data.weapons, level);
      const availArmors = armorsAvailableAtLevel(data.armors, level);
      const gear = buildGearLoadout(arch, level, data, availWeapons, availArmors);
      if (!gear) continue;

      const player = _makeCombatant(gear.profile, gear.weapon, arch.advClass, gear.armorRating, arch.className);
      const mob = _makeMonsterCombatant(monster, !!Z3_MONSTER_EFFECTS[monster.name]);

      // Simple solo sim using Z3 attack resolution (respects silence/root/reflect from monster effects)
      let wins = 0;
      for (let i = 0; i < SIM_ITERATIONS; i++) {
        let pHp = player.maxHp;
        let mHp = mob.maxHp;
        let r = 0;
        const pEffects: ActiveEffectInstance[] = [];
        const mEffects: ActiveEffectInstance[] = [];
        const pCcHistory: CcHistoryEntry[] = [];
        const mBreathCd = { lastUsed: -999 };
        const mWeaponEffects = getWeaponEffects(mob.weapon.name, data);
        const mBreath = mWeaponEffects.find(e => e.type === "magic_breath");

        while (r < MAX_COMBAT_ROUNDS && pHp > 0 && mHp > 0) {
          r++;

          // Tick effects
          pHp -= tickEffects(pEffects);
          mHp -= tickEffects(mEffects);
          if (pHp <= 0 || mHp <= 0) break;

          const adjP = adjustCombatant(player, pEffects);
          const adjM = adjustCombatant(mob, mEffects);

          // Player attacks (if not silenced — silence only blocks spells, not attacks)
          const mRooted = isRooted(mEffects);
          const mReflect = getReflectPct(mEffects);
          const { damage: pDmg, reflected: pRef } = resolveAttackZ3(adjP, adjM, data.combatConstants, rng, mRooted, mReflect);
          mHp -= pDmg;
          if (pRef > 0) pHp -= pRef;

          // Player weapon effects
          if (pDmg > 0) {
            const effects = getWeaponEffects(gear.weapon.name, data);
            for (const e of effects) {
              if (e.type === "dot") {
                const ex = mEffects.find(x => x.name === e.name);
                if (ex) ex.turnsRemaining = e.duration ?? 3;
                else mEffects.push({ name: e.name, type: "dot", turnsRemaining: e.duration ?? 3, damagePerTick: e.damagePerTick ?? 0, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0 });
              } else if (e.type === "stat_debuff" && !mEffects.some(x => x.name === e.name)) {
                mEffects.push({ name: e.name, type: "stat_debuff", turnsRemaining: e.duration ?? 3, damagePerTick: 0, strMod: e.strMod ?? 0, agiMod: e.agiMod ?? 0, intMod: e.intMod ?? 0, armorMod: e.armorMod ?? 0 });
              } else if (e.type === "dual_magic" && mHp > 0) {
                mHp -= _resolveDualMagicHit(adjP, adjM, data.combatConstants, rng);
              } else if (e.type === "silence") {
                const dur = getCcDiminishedDuration(e.duration ?? 2, "silence", [], r);
                if (dur > 0) applySilence(mEffects, dur, e.name);
              } else if (e.type === "root") {
                const dur = getCcDiminishedDuration(e.duration ?? 2, "root", [], r);
                if (dur > 0) applyRoot(mEffects, dur, e.name);
              }
            }
          }

          if (mHp <= 0) break;

          // Monster attacks
          const pRooted = isRooted(pEffects);
          const pReflect = getReflectPct(pEffects);
          const { damage: mDmg, reflected: mRef } = resolveAttackZ3(adjM, adjP, data.combatConstants, rng, pRooted, pReflect);
          pHp -= mDmg;
          if (mRef > 0) mHp -= mRef;

          // Monster weapon effects
          if (mDmg > 0) {
            for (const e of mWeaponEffects) {
              if (e.type === "dot") {
                const ex = pEffects.find(x => x.name === e.name);
                if (ex) ex.turnsRemaining = e.duration ?? 3;
                else pEffects.push({ name: e.name, type: "dot", turnsRemaining: e.duration ?? 3, damagePerTick: e.damagePerTick ?? 0, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0 });
              } else if (e.type === "stat_debuff" && (!e.cooldown || (r % (e.cooldown + 1)) === 0)) {
                if (!pEffects.some(x => x.name === e.name))
                  pEffects.push({ name: e.name, type: "stat_debuff", turnsRemaining: e.duration ?? 3, damagePerTick: 0, strMod: e.strMod ?? 0, agiMod: e.agiMod ?? 0, intMod: e.intMod ?? 0, armorMod: e.armorMod ?? 0 });
              } else if (e.type === "silence" && (!e.cooldown || (r % (e.cooldown + 1)) === 0)) {
                const dur = getCcDiminishedDuration(e.duration ?? 2, "silence", pCcHistory, r);
                const finalDur = applyCcResistance(dur, player.int, 0);
                if (finalDur > 0) {
                  applySilence(pEffects, finalDur, e.name);
                  pCcHistory.push({ type: "silence", appliedRound: r });
                }
              } else if (e.type === "root" && (!e.cooldown || (r % (e.cooldown + 1)) === 0)) {
                const dur = getCcDiminishedDuration(e.duration ?? 2, "root", pCcHistory, r);
                const finalDur = applyCcResistance(dur, player.str, 0);
                if (finalDur > 0) {
                  applyRoot(pEffects, finalDur, e.name);
                  pCcHistory.push({ type: "root", appliedRound: r });
                }
              } else if (e.type === "reflect" && (!e.cooldown || (r % (e.cooldown + 1)) === 0)) {
                applyReflect(mEffects, e.duration ?? 2, e.reflectPct ?? 0.5, e.name);
              }
            }
          }

          // Breath attack
          if (mBreath && pHp > 0 && !isSilenced(mEffects) && (r - mBreathCd.lastUsed) >= (mBreath.cooldown ?? 2)) {
            const bDmg = _resolveBreathAttack(adjM, adjP, mBreath, data.combatConstants, rng);
            const bReflect = getReflectPct(pEffects);
            pHp -= bDmg;
            if (bReflect > 0) mHp -= Math.max(1, Math.floor(bDmg * bReflect));
            mBreathCd.lastUsed = r;
          }
        }

        if (mHp <= 0 && pHp > 0) wins++;
      }

      const winRate = wins / SIM_ITERATIONS;
      results[arch.id].push({ level, winRate, weapon: gear.weapon.name, armor: gear.armor?.name ?? "none", stats: gear.profile });
      pathWinRates[arch.statPath].push(winRate);
      if (!levelWinRates[level]) levelWinRates[level] = [];
      levelWinRates[level].push(winRate);

      if (winRate < 0.30) blocked.push({ archId: arch.id, level, winRate, weapon: gear.weapon.name });

      const pct = (winRate * 100).toFixed(0).padStart(3);
      const stats = `${String(gear.profile.str).padStart(2)}/${String(gear.profile.agi).padStart(2)}/${String(gear.profile.int).padStart(2)} HP${String(gear.profile.hp).padStart(3)} ARM${String(gear.armorRating).padStart(2)}`;
      const wpn = gear.weapon.name.padEnd(24);
      const arm = (gear.armor?.name ?? "none").padEnd(20);
      const bar = winRate >= 0.7 ? "##" : winRate >= 0.5 ? "==" : winRate >= 0.3 ? "--" : "XX";
      archResults.push(`  L${String(level).padStart(2)}: ${pct}% ${bar} | ${stats} | ${wpn} | ${arm} | vs ${monster.name}`);
    }

    if (!showSummaryOnly && !showBlockedOnly) {
      console.log(`\n${arch.id} (${arch.name}, ${arch.className}, ${arch.statPath.toUpperCase()})`);
      for (const line of archResults) console.log(line);
    }
  }

  // Blocked builds
  if (blocked.length > 0) {
    console.log("\n--- BLOCKED BUILDS (< 30% win rate) ---");
    for (const b of blocked) console.log(`  ${b.archId} at L${b.level}: ${(b.winRate * 100).toFixed(0)}% (weapon: ${b.weapon})`);
  } else {
    console.log("\n--- NO BLOCKED BUILDS ---");
  }

  // Path averages
  console.log("\n--- PATH AVERAGES (L21-30 solo, non-elite) ---");
  for (const path of ["str", "agi", "int"] as const) {
    const rates = pathWinRates[path];
    if (rates.length === 0) continue;
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    console.log(`  ${path.toUpperCase()}: ${(avg * 100).toFixed(1)}% avg win rate`);
  }

  // Level averages
  console.log("\n--- LEVEL AVERAGES ---");
  for (let l = 21; l <= 30; l++) {
    const rates = levelWinRates[l];
    if (!rates || rates.length === 0) continue;
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    console.log(`  L${String(l).padStart(2)}: ${(avg * 100).toFixed(1)}% avg (${(min * 100).toFixed(0)}-${(max * 100).toFixed(0)}%)`);
  }

  // Monster reference
  console.log("\n--- Z3 MONSTER REFERENCE ---");
  for (const m of Z3_MONSTERS) {
    const cls = m.classType === 0 ? "W" : m.classType === 1 ? "R" : "M";
    const elite = m.isElite ? " [ELITE]" : "";
    const effects = Z3_MONSTER_EFFECTS[m.name] || [];
    const effectNames = effects.map(e => e.name).join(", ") || "none";
    console.log(`  L${m.level} ${cls}${elite}: STR${m.str} AGI${m.agi} INT${m.int} HP${m.hp} ARM${m.armor} Wpn${m.weaponMinDmg}-${m.weaponMaxDmg} | ${effectNames}`);
  }

  // ============================================================
  //  ELITE BOSS SIM (--elite flag)
  //  Tests solo, 2v1, and 3v1 party fights against L25 and L30 elites.
  // ============================================================
  if (showElite) {
    console.log("\n\n=== ELITE BOSS SIM (MULTIPLAYER PVE) ===");
    console.log(`${SIM_ITERATIONS} iterations. ${MAX_COMBAT_ROUNDS} rounds. Spell3: ${useSpell3 ? "ON" : "OFF"}.\n`);

    const elites = Z3_MONSTERS.filter(m => m.isElite);

    for (const elite of elites) {
      console.log(`\n--- ${elite.name} (L${elite.level}, HP${elite.hp}, partyScale ${elite.partyHpScale}) ---`);

      const level = elite.level;

      // Solo results
      console.log("\n  [SOLO]");
      const soloResults: { arch: Archetype; winRate: number }[] = [];

      for (const arch of archetypes) {
        if (filterArch && arch.id !== filterArch) continue;

        const pm = buildPartyMember(arch, level, data, useSpell3);
        let wins = 0;
        for (let i = 0; i < SIM_ITERATIONS; i++) {
          const result = simulatePartyPvE([pm], elite, data);
          if (result.winningSide === "party") wins++;
        }
        const wr = wins / SIM_ITERATIONS;
        soloResults.push({ arch, winRate: wr });
        const bar = wr >= 0.5 ? "==" : wr >= 0.3 ? "--" : "XX";
        console.log(`    ${arch.id.padEnd(6)} ${bar} ${(wr * 100).toFixed(0)}%`);
      }

      // Pick representative archetypes per path for pair/trio testing
      const strArchs = archetypes.filter(a => a.statPath === "str").slice(0, 3);
      const agiArchs = archetypes.filter(a => a.statPath === "agi").slice(0, 3);
      const intArchs = archetypes.filter(a => a.statPath === "int").slice(0, 3);
      const reps = [...strArchs, ...agiArchs, ...intArchs];

      // 2v1 — cross-path pairs
      console.log("\n  [2v1] Cross-path pairs:");
      const pairResults: { pair: string; winRate: number }[] = [];

      for (let i = 0; i < reps.length; i++) {
        for (let j = i + 1; j < reps.length; j++) {
          const a1 = reps[i];
          const a2 = reps[j];
          if (a1.statPath === a2.statPath) continue;

          const pm1 = buildPartyMember(a1, level, data, useSpell3);
          const pm2 = buildPartyMember(a2, level, data, useSpell3);
          let wins = 0;
          for (let k = 0; k < SIM_ITERATIONS; k++) {
            const result = simulatePartyPvE([pm1, pm2], elite, data);
            if (result.winningSide === "party") wins++;
          }
          const wr = wins / SIM_ITERATIONS;
          const pairName = `${a1.id} + ${a2.id}`;
          pairResults.push({ pair: pairName, winRate: wr });
          const bar = wr >= 0.7 ? "##" : wr >= 0.5 ? "==" : wr >= 0.3 ? "--" : "XX";
          console.log(`    ${a1.id.padEnd(6)} + ${a2.id.padEnd(6)} ${bar} ${(wr * 100).toFixed(0)}%`);
        }
      }

      // 2v1 summary
      if (pairResults.length > 0) {
        const avgPair = pairResults.reduce((s, r) => s + r.winRate, 0) / pairResults.length;
        const minPair = Math.min(...pairResults.map(r => r.winRate));
        const belowTarget = pairResults.filter(r => r.winRate < 0.6);
        console.log(`\n  [2v1 SUMMARY] Avg: ${(avgPair * 100).toFixed(1)}% | Min: ${(minPair * 100).toFixed(0)}% | Below 60%: ${belowTarget.length}/${pairResults.length}`);
        if (belowTarget.length > 0) {
          for (const b of belowTarget) console.log(`    WARN: ${b.pair} = ${(b.winRate * 100).toFixed(0)}%`);
        }
      }

      // 3v1 — cross-path trios (one from each path)
      console.log("\n  [3v1] Cross-path trios:");
      const trioResults: { trio: string; winRate: number }[] = [];

      for (const s of strArchs) {
        for (const a of agiArchs) {
          for (const i of intArchs) {
            const pm1 = buildPartyMember(s, level, data, useSpell3);
            const pm2 = buildPartyMember(a, level, data, useSpell3);
            const pm3 = buildPartyMember(i, level, data, useSpell3);
            let wins = 0;
            for (let k = 0; k < SIM_ITERATIONS; k++) {
              const result = simulatePartyPvE([pm1, pm2, pm3], elite, data);
              if (result.winningSide === "party") wins++;
            }
            const wr = wins / SIM_ITERATIONS;
            const trioName = `${s.id} + ${a.id} + ${i.id}`;
            trioResults.push({ trio: trioName, winRate: wr });
            const bar = wr >= 0.7 ? "##" : wr >= 0.5 ? "==" : wr >= 0.3 ? "--" : "XX";
            console.log(`    ${s.id.padEnd(6)} + ${a.id.padEnd(6)} + ${i.id.padEnd(6)} ${bar} ${(wr * 100).toFixed(0)}%`);
          }
        }
      }

      // 3v1 summary
      if (trioResults.length > 0) {
        const avgTrio = trioResults.reduce((s, r) => s + r.winRate, 0) / trioResults.length;
        const minTrio = Math.min(...trioResults.map(r => r.winRate));
        const belowTarget = trioResults.filter(r => r.winRate < 0.7);
        console.log(`\n  [3v1 SUMMARY] Avg: ${(avgTrio * 100).toFixed(1)}% | Min: ${(minTrio * 100).toFixed(0)}% | Below 70%: ${belowTarget.length}/${trioResults.length}`);
        if (belowTarget.length > 0) {
          for (const b of belowTarget) console.log(`    WARN: ${b.trio} = ${(b.winRate * 100).toFixed(0)}%`);
        }
      }
    }
  }

  // ============================================================
  //  2v2 PVP SIM (--pvp-2v2 flag)
  //  Tests cross-path 2-player pairs fighting each other.
  // ============================================================
  if (showPvP2v2) {
    console.log("\n\n=== 2v2 PVP SIM — L30 ===");
    console.log(`${SIM_ITERATIONS} iterations. ${MAX_COMBAT_ROUNDS} rounds. Spell3: ${useSpell3 ? "ON" : "OFF"}.\n`);

    const pvpLevel = 30;

    // Pick representative archetypes per path
    const strArchs = archetypes.filter(a => a.statPath === "str").slice(0, 3);
    const agiArchs = archetypes.filter(a => a.statPath === "agi").slice(0, 3);
    const intArchs = archetypes.filter(a => a.statPath === "int").slice(0, 3);
    const reps = [...strArchs, ...agiArchs, ...intArchs];

    // Build all cross-path pairs
    interface PvpPair { a1: Archetype; a2: Archetype; label: string; }
    const pairs: PvpPair[] = [];
    for (let i = 0; i < reps.length; i++) {
      for (let j = i + 1; j < reps.length; j++) {
        if (reps[i].statPath === reps[j].statPath) continue;
        pairs.push({ a1: reps[i], a2: reps[j], label: `${reps[i].id}+${reps[j].id}` });
      }
    }

    // Match every pair against every other pair
    const pvpResults: { team1: string; team2: string; winRate: number }[] = [];

    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const t1 = pairs[i];
        const t2 = pairs[j];

        let t1wins = 0;
        for (let k = 0; k < SIM_ITERATIONS; k++) {
          const pm1a = buildPartyMember(t1.a1, pvpLevel, data, useSpell3);
          const pm1b = buildPartyMember(t1.a2, pvpLevel, data, useSpell3);
          const pm2a = buildPartyMember(t2.a1, pvpLevel, data, useSpell3);
          const pm2b = buildPartyMember(t2.a2, pvpLevel, data, useSpell3);

          // Simulate by running both teams against a "dummy" — or use direct PvP sim
          // For 2v2 PvP we simulate as simultaneous turns: each team attacks the other
          const result = simulate2v2PvP(
            [pm1a, pm1b], [pm2a, pm2b], data.combatConstants, data,
          );
          if (result === 1) t1wins++;
        }
        const wr = t1wins / SIM_ITERATIONS;
        pvpResults.push({ team1: t1.label, team2: t2.label, winRate: wr });
      }
    }

    // Aggregate win rates per pair (how often each pair wins across all matchups)
    const pairWinRates: Record<string, { wins: number; total: number }> = {};
    for (const p of pairs) {
      pairWinRates[p.label] = { wins: 0, total: 0 };
    }
    for (const r of pvpResults) {
      pairWinRates[r.team1].total++;
      pairWinRates[r.team2].total++;
      pairWinRates[r.team1].wins += r.winRate;
      pairWinRates[r.team2].wins += (1 - r.winRate);
    }

    // Sort by average win rate
    const ranked = Object.entries(pairWinRates)
      .map(([label, { wins, total }]) => ({ label, avgWr: total > 0 ? wins / total : 0 }))
      .sort((a, b) => b.avgWr - a.avgWr);

    console.log("--- 2v2 PVP RANKINGS (avg win rate across all matchups) ---");
    for (const r of ranked) {
      const bar = r.avgWr >= 0.6 ? "##" : r.avgWr >= 0.45 ? "==" : "--";
      console.log(`  ${r.label.padEnd(16)} ${bar} ${(r.avgWr * 100).toFixed(1)}%`);
    }

    // Check balance spread
    const allWrs = ranked.map(r => r.avgWr);
    const spread = Math.max(...allWrs) - Math.min(...allWrs);
    console.log(`\n  Spread: ${(spread * 100).toFixed(1)}pp (target: <20pp for healthy meta)`);
    console.log(`  Top: ${ranked[0].label} ${(ranked[0].avgWr * 100).toFixed(1)}%`);
    console.log(`  Bottom: ${ranked[ranked.length - 1].label} ${(ranked[ranked.length - 1].avgWr * 100).toFixed(1)}%`);
  }
}

// Run (only when executed directly, not when imported)
const isDirectRun = process.argv[1]?.includes("journey-z3");
if (isDirectRun) runJourney();

// Exports for testing
export { loadData, buildArchetypes, CLASS_SPELLS_3, Z3_MONSTERS };
