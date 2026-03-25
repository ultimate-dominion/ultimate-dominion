#!/usr/bin/env npx tsx
/**
 * Zone 2 Journey Sim — L10→L20 progression for all 27 archetypes.
 * Validates Windy Peaks balance with Option B conservative scaling.
 *
 * ** READ BALANCE_RULES.md BEFORE EVERY SESSION **
 *
 * Usage: npx tsx packages/contracts/scripts/balance/journey-z2.ts [flags]
 *   --summary     Show path averages only (default: full per-archetype output)
 *   --verbose     Show gear details per level
 *   --blocked     Only show builds with <30% win rate at any level
 *   --pvp         Run PvP cross-archetype at L20
 *   --pots        Run L20 boss sim with consumable loadouts
 *   --spell2      Enable second spells (best of spell1/spell2 per matchup)
 *   --equip-audit Off-path stat cost per archetype/rarity tier (equip gates)
 *   --economy     Full gold economy sim: income, repairs, consumables, inflation
 *   --dau N       DAU for inflation projections (default: 50)
 *   --level N     Show detailed output for specific level only
 *   --arch ID     Show specific archetype only (e.g., WAR-S)
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadGameData } from "./loader.js";
import { applyOverrides, CLASS_SPELLS, WEAPONS_V4, ARMORS_WITH_SECONDARY_REQS, type SimFlags } from "./overrides.js";
import type {
  GameData, Weapon, Armor, Monster, Combatant, Archetype,
  StatProfile, CombatConstants, LevelingConstants, AdvancedClass,
  WeaponEffect, ClassSpell, Consumable,
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
  resolveDualMagicHit as _resolveDualMagicHit,
  resolveBreathAttack as _resolveBreathAttack,
  tickEffects,
  adjustCombatant,
  defaultRng,
  type ActiveEffectInstance,
  type RngFn,
} from "./combat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
//  ZONE 2 MONSTERS — Windy Peaks (L11-20)
//  Option B: conservative stat scaling, mechanical difficulty
//  Class sequence: R, M, W, R, W, M, R, W, M, W(boss)
//  (irregular — no exploitable pattern)
// ============================================================

const Z2_MONSTERS: Monster[] = [
  // L11 — Rogue. Fast mountain predator. Entry mob. Slash wound debuff.
  // Target: 85-90% WR. Step up from Z1 — HP/damage bump over DC L10.
  { name: "Ridge Stalker", level: 11, str: 15, agi: 27, int: 7,
    hp: 95, armor: 4, classType: 1, xp: 800,
    weaponMinDmg: 7, weaponMaxDmg: 12, weaponScaling: "agi", weaponIsMagic: false },

  // L12 — Mage. Frost caster. Magic damage + cold debuff (AGI reduction).
  // Target: 80-90% WR. Magic bypasses armor — threatens STR tanks.
  { name: "Frost Wraith", level: 12, str: 10, agi: 11, int: 28,
    hp: 90, armor: 3, classType: 2, xp: 1000,
    weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: "str", weaponIsMagic: true },

  // L13 — Warrior. Rock golem. Moderate armor, pure physical. DPS check.
  // Target: 80-85% WR. Tanky but fair.
  { name: "Granite Sentinel", level: 13, str: 24, agi: 8, int: 5,
    hp: 100, armor: 5, classType: 0, xp: 1200,
    weaponMinDmg: 8, weaponMaxDmg: 12, weaponScaling: "str", weaponIsMagic: false },

  // L14 — Rogue. Wind creature. Very evasive + wind gust debuff.
  // Target: 80-85% WR. Evasion makes hits unreliable, gust strips armor.
  { name: "Gale Phantom", level: 14, str: 12, agi: 29, int: 7,
    hp: 100, armor: 4, classType: 1, xp: 1400,
    weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: "agi", weaponIsMagic: false },

  // L15 — Warrior. Decay-touched beast. HP + poison DoT. Endurance test.
  // Target: 75-85% WR. DoT does the work — base stats don't need to be extreme.
  { name: "Blighthorn", level: 15, str: 25, agi: 10, int: 6,
    hp: 100, armor: 5, classType: 0, xp: 1600,
    weaponMinDmg: 7, weaponMaxDmg: 12, weaponScaling: "str", weaponIsMagic: false },

  // L16 — Mage. Storm caster. Magic + lightning breath attack. DPS check.
  // Target: 75-85% WR. Breath + base magic = dual damage sources.
  { name: "Storm Shrike", level: 16, str: 10, agi: 12, int: 29,
    hp: 90, armor: 4, classType: 2, xp: 1800,
    weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: "str", weaponIsMagic: true },

  // L17 — Rogue. Corrupted faction scout. Dual magic + corruption debuff.
  // Target: 75-80% WR. Dual magic + corruption makes this a gear check.
  { name: "Hollow Scout", level: 17, str: 14, agi: 30, int: 10,
    hp: 100, armor: 5, classType: 1, xp: 2000,
    weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: "agi", weaponIsMagic: false },

  // L18 — Warrior. Mountain beast. Physical + bleed DoT.
  // Target: 70-80% WR. DoT + sustained physical, not stat-wall.
  { name: "Ironpeak Charger", level: 18, str: 27, agi: 14, int: 8,
    hp: 105, armor: 6, classType: 0, xp: 2200,
    weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: "str", weaponIsMagic: false },

  // L19 — Mage. Heat wraith. Breath attack + burn DoT. Hard pre-boss.
  // Target: 70-80% WR. Breath + DoT compound, don't need extreme INT.
  { name: "Peakfire Wraith", level: 19, str: 12, agi: 14, int: 29,
    hp: 90, armor: 4, classType: 2, xp: 2500,
    weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: "str", weaponIsMagic: true },

  // L20 — Warrior. ZONE BOSS. War-touched soldier. Thunder breath + ground slam.
  // Target: 65-75% WR avg. Low ARM (5) so AGI can penetrate. Moderate breath.
  { name: "Korrath's Warden", level: 20, str: 29, agi: 14, int: 7,
    hp: 125, armor: 5, classType: 0, xp: 4000,
    weaponMinDmg: 9, weaponMaxDmg: 14, weaponScaling: "str", weaponIsMagic: false },
];

// Monster weapon effects (keyed by monster name)
// Effects buffed to compound over longer fights — armor strip, DoTs, stat drain
const Z2_MONSTER_EFFECTS: Record<string, WeaponEffect[]> = {
  // L11 Ridge Stalker: slash wound — strips armor, makes subsequent hits hurt more
  "Ridge Stalker": [
    { type: "stat_debuff", name: "Slash Wound", strMod: 0, agiMod: 0, intMod: 0, armorMod: -3, duration: 4 },
  ],
  // L12 Frost Wraith: cold touch — slows target, reduces evasion
  "Frost Wraith": [
    { type: "stat_debuff", name: "Cold Touch", agiMod: -4, strMod: 0, intMod: 0, armorMod: 0, duration: 3 },
  ],
  // L13 Granite Sentinel: ground pound — weakens + shakes loose defenses
  "Granite Sentinel": [
    { type: "stat_debuff", name: "Ground Pound", strMod: -3, agiMod: -3, intMod: 0, armorMod: -2, duration: 3 },
  ],
  // L14 Gale Phantom: wind gust — weakens physical defense + strips armor
  "Gale Phantom": [
    { type: "stat_debuff", name: "Wind Gust", strMod: -4, agiMod: 0, intMod: 0, armorMod: -3, duration: 3 },
  ],
  // L15 Blighthorn: decay bite — poison DoT, higher tick damage
  "Blighthorn": [
    { type: "dot", name: "Decay Bite", damagePerTick: 4, maxStacks: 1, duration: 5, cooldown: 0 },
  ],
  // L16 Storm Shrike: lightning breath — harder-hitting magic burst
  "Storm Shrike": [
    { type: "magic_breath", name: "Lightning Bolt", minDmg: 7, maxDmg: 12, cooldown: 2 },
  ],
  // L17 Hollow Scout: dual magic + corruption debuff (drains STR and INT)
  "Hollow Scout": [
    { type: "dual_magic", name: "dual_magic" },
    { type: "stat_debuff", name: "Corruption", strMod: -3, agiMod: 0, intMod: -3, armorMod: 0, duration: 4 },
  ],
  // L18 Ironpeak Charger: gore — bleed DoT
  "Ironpeak Charger": [
    { type: "dot", name: "Gore", damagePerTick: 4, maxStacks: 1, duration: 5, cooldown: 0 },
  ],
  // L19 Peakfire Wraith: searing breath + burn DoT — dual threat
  "Peakfire Wraith": [
    { type: "magic_breath", name: "Searing Breath", minDmg: 8, maxDmg: 13, cooldown: 2 },
    { type: "dot", name: "Burn", damagePerTick: 3, maxStacks: 1, duration: 5, cooldown: 0 },
  ],
  // L20 Korrath's Warden: thunder breath + ground slam
  "Korrath's Warden": [
    { type: "magic_breath", name: "Thunder Clap", minDmg: 6, maxDmg: 11, cooldown: 2 },
    { type: "stat_debuff", name: "Ground Slam", strMod: -3, agiMod: -3, intMod: 0, armorMod: -2, duration: 3, cooldown: 3 },
  ],
};

// ============================================================
//  ZONE 2 WEAPONS — Placeholder names, focus on stats
//  Pure weapons: primary stat gate only
//  Hybrid weapons: dual stat gate + unique effects
// ============================================================

const Z2_WEAPONS: Weapon[] = [
  // ---- STR PURE PATH ----
  { name: "Ridgestone Hammer", minDamage: 5, maxDamage: 8, strMod: 1, agiMod: 0, intMod: 0, hpMod: 2,
    scaling: "str", isMagic: false, minStr: 16, minAgi: 0, minInt: 0, rarity: 1, price: 40 },
  { name: "Peak Cleaver", minDamage: 6, maxDamage: 10, strMod: 2, agiMod: 0, intMod: 0, hpMod: 3,
    scaling: "str", isMagic: false, minStr: 20, minAgi: 0, minInt: 0, rarity: 2, price: 80 },
  { name: "Windforged Axe", minDamage: 7, maxDamage: 12, strMod: 3, agiMod: 0, intMod: 0, hpMod: 4,
    scaling: "str", isMagic: false, minStr: 24, minAgi: 0, minInt: 0, rarity: 3, price: 150 },
  { name: "Warden's Maul", minDamage: 9, maxDamage: 14, strMod: 4, agiMod: 0, intMod: 0, hpMod: 5,
    scaling: "str", isMagic: false, minStr: 28, minAgi: 0, minInt: 0, rarity: 4, price: 300 },

  // ---- AGI PURE PATH — HP mods added to close survivability gap vs STR ----
  { name: "Scrub Bow", minDamage: 4, maxDamage: 7, strMod: 0, agiMod: 1, intMod: 0, hpMod: 2,
    scaling: "agi", isMagic: false, minStr: 0, minAgi: 16, minInt: 0, rarity: 1, price: 40 },
  { name: "Gale Bow", minDamage: 5, maxDamage: 9, strMod: 0, agiMod: 2, intMod: 0, hpMod: 3,
    scaling: "agi", isMagic: false, minStr: 0, minAgi: 20, minInt: 0, rarity: 2, price: 80 },
  { name: "Stormfeather Bow", minDamage: 6, maxDamage: 11, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4,
    scaling: "agi", isMagic: false, minStr: 0, minAgi: 24, minInt: 0, rarity: 3, price: 150 },
  { name: "Peakwind Longbow", minDamage: 7, maxDamage: 13, strMod: 0, agiMod: 4, intMod: 0, hpMod: 5,
    scaling: "agi", isMagic: false, minStr: 0, minAgi: 28, minInt: 0, rarity: 4, price: 300 },

  // ---- INT PURE PATH (magic) — HP mods added to close survivability gap vs STR ----
  { name: "Frozen Shard", minDamage: 5, maxDamage: 8, strMod: 0, agiMod: 0, intMod: 1, hpMod: 2,
    scaling: "str", isMagic: true, minStr: 0, minAgi: 0, minInt: 16, rarity: 1, price: 40 },
  { name: "Rime Staff", minDamage: 6, maxDamage: 10, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3,
    scaling: "str", isMagic: true, minStr: 0, minAgi: 0, minInt: 20, rarity: 2, price: 80 },
  { name: "Stormglass Rod", minDamage: 8, maxDamage: 13, strMod: 0, agiMod: 0, intMod: 3, hpMod: 4,
    scaling: "str", isMagic: true, minStr: 0, minAgi: 0, minInt: 24, rarity: 3, price: 150 },
  { name: "Wraith Beacon", minDamage: 10, maxDamage: 15, strMod: 0, agiMod: 0, intMod: 4, hpMod: 6,
    scaling: "str", isMagic: true, minStr: 0, minAgi: 0, minInt: 28, rarity: 4, price: 300 },

  // ---- HYBRID WEAPONS (harder to equip, unique effects) ----

  // STR/INT hybrid — dual magic (physical + magic hit per round)
  // STR build needs ~4 off-path INT (base 6 → 10)
  { name: "Warden's Ember", minDamage: 5, maxDamage: 9, strMod: 2, agiMod: 0, intMod: 2, hpMod: 2,
    scaling: "str", isMagic: false, minStr: 18, minAgi: 0, minInt: 10, rarity: 3, price: 200 },

  // AGI/INT hybrid — dual magic (fast strikes + magic burst)
  // AGI build needs ~3 off-path INT (base 7 → 10)
  { name: "Windweaver", minDamage: 4, maxDamage: 8, strMod: 0, agiMod: 2, intMod: 2, hpMod: 0,
    scaling: "agi", isMagic: false, minStr: 0, minAgi: 18, minInt: 10, rarity: 3, price: 200 },

  // STR/AGI hybrid — bleed DoT + armor strip
  // STR build needs ~3 off-path AGI (base 3 → 6). Very expensive for Dwarf/Plate builds.
  { name: "Ridgefang", minDamage: 6, maxDamage: 10, strMod: 2, agiMod: 2, intMod: 0, hpMod: 3,
    scaling: "str", isMagic: false, minStr: 18, minAgi: 6, minInt: 0, rarity: 3, price: 200 },

  // AGI/STR hybrid — venom strike
  // AGI build needs ~3 off-path STR (base 5 → 8)
  { name: "Viperstrike", minDamage: 5, maxDamage: 9, strMod: 2, agiMod: 2, intMod: 0, hpMod: 2,
    scaling: "agi", isMagic: false, minStr: 8, minAgi: 18, minInt: 0, rarity: 3, price: 200 },

  // INT/STR hybrid — spellblade (magic + bleed)
  // INT build needs ~3 off-path STR (base 3 → 6)
  { name: "Ashveil Staff", minDamage: 6, maxDamage: 10, strMod: 1, agiMod: 0, intMod: 2, hpMod: 2,
    scaling: "str", isMagic: true, minStr: 6, minAgi: 0, minInt: 18, rarity: 3, price: 200 },
];

// Weapon effects for player weapons (keyed by weapon name)
const Z2_WEAPON_EFFECTS: Record<string, WeaponEffect[]> = {
  // R3 pure weapons get minor effects
  "Windforged Axe": [
    { type: "dot", name: "Bleed", damagePerTick: 2, maxStacks: 1, duration: 4, cooldown: 0 },
  ],
  "Stormfeather Bow": [
    { type: "stat_debuff", name: "Hamstring", strMod: 0, agiMod: -3, intMod: 0, armorMod: 0, duration: 3 },
  ],
  "Stormglass Rod": [
    // Anti-STR: reduces STR (cuts damage + block chance). INT's counter to tanks.
    { type: "stat_debuff", name: "Wither", strMod: -4, agiMod: 0, intMod: 0, armorMod: 0, duration: 4 },
  ],
  // R4 pure weapons get strong effects
  "Warden's Maul": [
    { type: "dot", name: "Deep Wound", damagePerTick: 3, maxStacks: 1, duration: 5, cooldown: 0 },
    { type: "stat_debuff", name: "Crush", strMod: 0, agiMod: 0, intMod: 0, armorMod: -4, duration: 4 },
  ],
  "Peakwind Longbow": [
    { type: "dot", name: "Lacerate", damagePerTick: 3, maxStacks: 1, duration: 5, cooldown: 0 },
  ],
  "Wraith Beacon": [
    // Anti-STR: heavy STR reduction (cuts damage + block) + DoT. INT's tank-buster.
    { type: "stat_debuff", name: "Enfeeble", strMod: -6, agiMod: 0, intMod: 0, armorMod: -3, duration: 5 },
    { type: "dot", name: "Arcane Burn", damagePerTick: 3, maxStacks: 1, duration: 5, cooldown: 0 },
  ],
  // Hybrid weapons — unique effects that justify the off-path cost
  "Warden's Ember": [
    { type: "dual_magic", name: "dual_magic" },
  ],
  "Windweaver": [
    { type: "dual_magic", name: "dual_magic" },
  ],
  "Ridgefang": [
    { type: "dot", name: "Bleed", damagePerTick: 3, maxStacks: 1, duration: 4, cooldown: 0 },
    { type: "stat_debuff", name: "Armor Rend", strMod: 0, agiMod: 0, intMod: 0, armorMod: -3, duration: 3 },
  ],
  "Viperstrike": [
    { type: "dot", name: "Venom Strike", damagePerTick: 3, maxStacks: 1, duration: 5, cooldown: 0 },
  ],
  "Ashveil Staff": [
    { type: "dot", name: "Soulfire", damagePerTick: 2, maxStacks: 1, duration: 4, cooldown: 0 },
    { type: "stat_debuff", name: "Weaken", strMod: -2, agiMod: 0, intMod: 0, armorMod: 0, duration: 3 },
  ],
};

// ============================================================
//  ZONE 2 ARMOR
//  3 types × 3+ rarity tiers. Stat requirements gate progression.
// ============================================================

const Z2_ARMORS: Armor[] = [
  // ---- PLATE (STR builds) ----
  { name: "Peakstone Mail", armorValue: 5, strMod: 1, agiMod: -1, intMod: 0, hpMod: 3,
    minStr: 14, minAgi: 0, minInt: 0, armorType: "Plate", rarity: 1, price: 35 },
  { name: "Ridgeforged Plate", armorValue: 7, strMod: 2, agiMod: -1, intMod: 0, hpMod: 5,
    minStr: 18, minAgi: 0, minInt: 0, armorType: "Plate", rarity: 2, price: 70 },
  { name: "Windsworn Plate", armorValue: 9, strMod: 3, agiMod: -1, intMod: 0, hpMod: 8,
    minStr: 22, minAgi: 0, minInt: 0, armorType: "Plate", rarity: 3, price: 140 },
  { name: "Warden's Bulwark", armorValue: 11, strMod: 4, agiMod: -1, intMod: 0, hpMod: 10,
    minStr: 26, minAgi: 0, minInt: 0, armorType: "Plate", rarity: 4, price: 280 },

  // ---- LEATHER (AGI builds) — modest HP to partially close gap vs plate ----
  { name: "Mountain Hide", armorValue: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 2,
    minStr: 0, minAgi: 14, minInt: 0, armorType: "Leather", rarity: 1, price: 35 },
  { name: "Galebound Leather", armorValue: 4, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4,
    minStr: 0, minAgi: 18, minInt: 0, armorType: "Leather", rarity: 2, price: 70 },
  { name: "Stormhide Vest", armorValue: 5, strMod: 0, agiMod: 4, intMod: 0, hpMod: 6,
    minStr: 0, minAgi: 22, minInt: 0, armorType: "Leather", rarity: 3, price: 140 },
  { name: "Phantom Shroud", armorValue: 6, strMod: 0, agiMod: 5, intMod: 0, hpMod: 8,
    minStr: 0, minAgi: 26, minInt: 0, armorType: "Leather", rarity: 4, price: 280 },

  // ---- CLOTH (INT builds) — high HP to compensate for low ARM. Closes survivability gap vs plate. ----
  { name: "Frostweave Robe", armorValue: 2, strMod: 0, agiMod: 0, intMod: 2, hpMod: 5,
    minStr: 0, minAgi: 0, minInt: 14, armorType: "Cloth", rarity: 1, price: 35 },
  { name: "Mistcloak", armorValue: 3, strMod: 0, agiMod: 0, intMod: 3, hpMod: 8,
    minStr: 0, minAgi: 0, minInt: 18, armorType: "Cloth", rarity: 2, price: 70 },
  { name: "Wraith Vestments", armorValue: 4, strMod: 0, agiMod: 0, intMod: 4, hpMod: 12,
    minStr: 0, minAgi: 0, minInt: 22, armorType: "Cloth", rarity: 3, price: 140 },
  { name: "Ember Mantle", armorValue: 5, strMod: 0, agiMod: 0, intMod: 5, hpMod: 16,
    minStr: 0, minAgi: 0, minInt: 26, armorType: "Cloth", rarity: 4, price: 280 },
];

// ============================================================
//  DROP LEVEL GATING — models realistic gear progression
//  R1 drops from L11-13 mobs → available at L11
//  R2 drops from L14-16 mobs → available at L14
//  R3 drops from L17-19 mobs → available at L17
//  R4 drops from L20 boss   → available at L20
// ============================================================

const Z2_WEAPON_DROP_LEVEL: Record<string, number> = {};
const Z2_ARMOR_DROP_LEVEL: Record<string, number> = {};

// Tag Z2 gear with drop levels based on rarity
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

function weaponsAvailableAtLevel(allWeapons: Weapon[], level: number): Weapon[] {
  return allWeapons.filter(w => {
    const dropLvl = Z2_WEAPON_DROP_LEVEL[w.name];
    if (dropLvl === undefined) return true; // DC weapon — always available
    return level >= dropLvl;
  });
}

function armorsAvailableAtLevel(allArmors: Armor[], level: number): Armor[] {
  return allArmors.filter(a => {
    const dropLvl = Z2_ARMOR_DROP_LEVEL[a.name];
    if (dropLvl === undefined) return true; // DC armor — always available
    return level >= dropLvl;
  });
}

// ============================================================
//  SIM INFRASTRUCTURE
// ============================================================

const SIM_ITERATIONS = 500;
let MAX_COMBAT_ROUNDS = 15; // matches on-chain DEFAULT_MAX_TURNS
const rng = defaultRng;

function randInt(min: number, max: number): number {
  return rng(min, max);
}

// ============================================================
//  ECONOMY CONSTANTS & FUNCTIONS
//  See docs/ECONOMY_TUNING_GUIDE.md for rationale
//  Canonical source: economy.ts (imported here)
// ============================================================

import {
  ECONOMY,
  avgGoldPerKill as _avgGoldPerKill,
  avgVendorGoldPerFight as _avgVendorGoldPerFight,
  repairCostPerFight as _repairCostPerFight,
  consumableCostPerFight as _consumableCostPerFight,
  netGoldPerFight as _netGoldPerFight,
  marketplaceIncomePerFight as _marketplaceIncomePerFight,
  guildTaxPerMemberPerDay as _guildTaxPerMemberPerDay,
  totalGuildSinkPerDay as _totalGuildSinkPerDay,
  guildRepairSavingsPerDay as _guildRepairSavingsPerDay,
  netGuildCostPerMemberPerDay as _netGuildCostPerMemberPerDay,
  dailyGrossIncome as _dailyGrossIncome,
  completeBurnRate as _completeBurnRate,
} from "./economy.js";

interface GearLoadout {
  profile: StatProfile;
  weapon: Weapon;
  weapon2: Weapon | null;  // secondary weapon (different damage type for coverage)
  weapon3: Weapon | null;  // tertiary weapon (third triangle angle — STR/AGI/INT coverage)
  armor: Armor | null;
  armorRating: number;
}

interface FightResult {
  won: boolean;
  rounds: number;
  damageDealt: number;
  remainingHp: number;     // for multi-fight endurance tracking
  maxHp: number;           // player's max HP at fight time
}

function loadData(useV4: boolean = false): GameData {
  const zonePath = resolve(__dirname, "../../zones/dark_cave");
  const constantsPath = resolve(__dirname, "./constants.json");
  const baseData = loadGameData(zonePath, constantsPath);
  const flags: SimFlags = {
    useRebalanced: false,
    useV2: false,
    useV3: !useV4,
    useV4: useV4,
    useArmor: true,
    useSpells: true,
    useRetunedMonsters: true,
    useOnchain: false,
  };
  const data = applyOverrides(baseData, flags);

  // Match on-chain evasion cap (overrides.ts uses 35, on-chain is 25)
  data.combatConstants.evasionCap = 25;

  // Inject Zone 2 content
  data.weapons.push(...Z2_WEAPONS);
  data.armors.push(...Z2_ARMORS);
  // Do NOT add Z2 monsters to data.monsters — we look them up directly from Z2_MONSTERS

  // Inject Zone 2 weapon effects (player weapons)
  for (const [name, effects] of Object.entries(Z2_WEAPON_EFFECTS)) {
    data.weaponEffects[name] = effects;
  }

  // Inject Zone 2 monster weapon effects
  for (const [name, effects] of Object.entries(Z2_MONSTER_EFFECTS)) {
    data.monsterWeaponEffects[name] = effects;
  }

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
//  GEAR SELECTION (borrowed from engine, extended for Z2)
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
    }
  }
  return value;
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

    let extraPrimaryPt = 0;
    if (level >= lc.powerSourceBonusLevel) {
      if (arch.powerSource.type === "physical") extraPrimaryPt = 1;
      else if (arch.powerSource.type === "weave") int_ += 1;
      else if (arch.powerSource.type === "divine") hp += 2;
    }

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

  for (let offPath = 0; offPath <= 5; offPath++) {
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
      const equippableArmor = armorPool.filter(a => _canEquipArmor(a, baseProfile));
      let armor: Armor | null = null;
      if (equippableArmor.length > 0) {
        const scoredArmor = equippableArmor.map(a => {
          let score = a.armorValue * 1.5 + a.hpMod;
          const pathBonus = arch.statPath === "str" ? a.strMod : arch.statPath === "agi" ? a.agiMod : a.intMod;
          score += pathBonus * 2.0 + (a.strMod + a.agiMod + a.intMod) * 0.3 + a.rarity * 0.1;
          return { armor: a, score };
        });
        scoredArmor.sort((a, b) => b.score - a.score);
        armor = scoredArmor[0].armor;
      }

      // Apply armor to profile
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
      const equippableWeapons = weaponPool.filter(w => _canEquip(w, profile));
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
      // Magic bypass only valuable if INT is high enough to deal meaningful magic damage.
      // Scale from 0 (INT ≤ 12) to 4.0 (INT ≥ 20). Prevents STR builds from picking magic weapons.
      const magicBypassScore = weapon.isMagic ? Math.max(0, Math.min(4.0, (profile.int - 12) * 0.5)) : 0;
      const combatStr = profile.str + weapon.strMod;
      const strDefScore = combatStr > 10 ? (combatStr - 10) * 0.25 : 0;

      // Pick secondary weapon: different damage type than primary for coverage
      // If primary is physical → secondary should be magic (or vice versa)
      // If primary is STR physical → secondary could be AGI physical (different scaling) or magic
      const secondaryPool = equippableWeapons.filter(w => {
        if (w.name === weapon.name) return false;
        // Prefer different damage type (magic vs physical)
        if (weapon.isMagic !== w.isMagic) return true;
        // Or different scaling stat (STR vs AGI for physical)
        if (!weapon.isMagic && !w.isMagic && weapon.scaling !== w.scaling) return true;
        return false;
      });
      let weapon2: Weapon | null = null;
      if (secondaryPool.length > 0) {
        // Score secondaries: prioritize type coverage > effects > raw DPS
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
          // Bonus for type coverage (magic vs physical)
          const coverageBonus = weapon.isMagic !== w.isMagic ? 3.0 : 1.0;
          return { weapon: w, score: dps * coverageBonus + w.hpMod * 0.3 };
        });
        scored2.sort((a, b) => b.score - a.score);
        weapon2 = scored2[0].weapon;
      }

      // Pick tertiary weapon: third triangle angle (need all 3 of STR-phys, AGI-phys, INT-magic)
      // weapon3 completes triangle coverage: whatever damage category w1 and w2 don't cover
      let weapon3: Weapon | null = null;
      if (weapon2) {
        const coveredTypes = new Set<string>();
        // Categorize w1 and w2
        for (const w of [weapon, weapon2]) {
          if (w.isMagic) coveredTypes.add("magic");
          else if (w.scaling === "agi") coveredTypes.add("agi-phys");
          else coveredTypes.add("str-phys");
        }
        // Find a weapon covering the missing category
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
//  COMBAT SIM (with class spells)
// ============================================================

function resolveSpellDamage(
  spell: ClassSpell, caster: Combatant, target: Combatant, cc: CombatConstants,
): { finalDmg: number; isPhysical: boolean } {
  const baseDmg = randInt(spell.baseDmgMin ?? 0, spell.baseDmgMax ?? 0);
  const isPhysical = !!(spell.dmgPerStr || spell.dmgPerAgi);

  if (isPhysical) {
    const statScale = spell.dmgPerStr
      ? Math.floor(caster.str * spell.dmgPerStr)
      : Math.floor(caster.agi * (spell.dmgPerAgi ?? 0));
    const rawDmg = baseDmg + statScale;
    const afterArmor = Math.max(1, rawDmg - Math.max(0, target.armor));
    return { finalDmg: Math.max(1, Math.floor(afterArmor * caster.physMult / 1000)), isPhysical: true };
  } else {
    const intScale = Math.floor(caster.int * (spell.dmgPerInt ?? 0));
    const rawDmg = baseDmg + intScale;
    const resistPct = Math.min(target.int * cc.magicResistPerInt, cc.magicResistCap);
    return { finalDmg: Math.max(1, Math.floor(rawDmg * (1 - resistPct / 100) * caster.spellMult / 1000)), isPhysical: false };
  }
}

function resolveSpell(
  spell: ClassSpell, caster: Combatant, target: Combatant,
  casterEffects: ActiveEffectInstance[], targetEffects: ActiveEffectInstance[],
  cc: CombatConstants,
): { casterHpDelta: number; targetHpDelta: number; dmgDealt: number } {
  let casterHpDelta = 0, targetHpDelta = 0, dmgDealt = 0;

  if (spell.type === "self_buff") {
    const strMod = Math.floor((spell.strPct ?? 0) * caster.str);
    const agiMod = Math.floor((spell.agiPct ?? 0) * caster.agi);
    const intMod = Math.floor((spell.intPct ?? 0) * caster.int);
    casterEffects.push({ name: spell.name, type: "self_buff", turnsRemaining: spell.duration ?? 3,
      damagePerTick: 0, strMod, agiMod, intMod, armorMod: spell.armorMod ?? 0 });
    if (spell.hpPct) casterHpDelta = Math.floor(spell.hpPct * caster.maxHp);
  } else if (spell.type === "magic_damage") {
    const { finalDmg } = resolveSpellDamage(spell, caster, target, cc);
    targetHpDelta = -finalDmg; dmgDealt = finalDmg;
  } else if (spell.type === "damage_debuff") {
    const { finalDmg } = resolveSpellDamage(spell, caster, target, cc);
    targetHpDelta = -finalDmg; dmgDealt = finalDmg;
    const strMod = Math.floor((spell.strPct ?? 0) * target.str);
    const agiMod = Math.floor((spell.agiPct ?? 0) * target.agi);
    const intMod = Math.floor((spell.intPct ?? 0) * target.int);
    targetEffects.push({ name: spell.name, type: "stat_debuff", turnsRemaining: spell.duration ?? 3,
      damagePerTick: 0, strMod, agiMod, intMod, armorMod: spell.armorMod ?? 0 });
  } else if (spell.type === "damage_buff") {
    const { finalDmg } = resolveSpellDamage(spell, caster, target, cc);
    targetHpDelta = -finalDmg; dmgDealt = finalDmg;
    const strMod = Math.floor((spell.strPct ?? 0) * caster.str);
    const agiMod = Math.floor((spell.agiPct ?? 0) * caster.agi);
    const intMod = Math.floor((spell.intPct ?? 0) * caster.int);
    casterEffects.push({ name: spell.name, type: "self_buff", turnsRemaining: spell.duration ?? 3,
      damagePerTick: 0, strMod, agiMod, intMod, armorMod: spell.armorMod ?? 0 });
    if (spell.hpPct) casterHpDelta = Math.floor(spell.hpPct * caster.maxHp);
  } else if (spell.type === "weapon_enchant") {
    casterEffects.push({ name: spell.name, type: "weapon_enchant", turnsRemaining: spell.duration ?? 8,
      damagePerTick: 0, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0,
      bonusMagicDmgMin: spell.baseDmgMin ?? 0, bonusMagicDmgMax: spell.baseDmgMax ?? 0,
      bonusMagicDmgPerInt: spell.dmgPerInt ?? 0 });
  }
  return { casterHpDelta, targetHpDelta, dmgDealt };
}

// ============================================================
//  SECOND SPELLS (Z2 unlock — one per class)
//  Design: complement spell 1. If spell 1 is offense, spell 2 is defense.
//  Sim picks whichever spell has higher win rate per matchup.
// ============================================================

const CLASS_SPELLS_2: Record<string, ClassSpell> = {
  // STR classes — already dominant. Spell 2 is offense/utility.
  Warrior:  { name: "Spell2-Warrior",  type: "damage_buff",   baseDmgMin: 8, baseDmgMax: 15, dmgPerStr: 0.5, armorMod: -5, duration: 3, maxUses: 1 },
    // Reckless: big burst + self -5 ARM for 3t. Glass cannon option.
  Paladin:  { name: "Spell2-Paladin",  type: "damage_debuff", baseDmgMin: 6, baseDmgMax: 12, dmgPerStr: 0.4, strPct: -0.15, armorMod: -3, duration: 6, maxUses: 1 },
    // Smite: phys burst + weaken target STR + strip armor. Anti-warrior.

  // AGI classes — need armor bypass vs boss.
  Ranger:   { name: "Spell2-Ranger",   type: "damage_debuff", baseDmgMin: 5, baseDmgMax: 10, dmgPerAgi: 0.35, armorMod: -6, duration: 6, maxUses: 1 },
    // Piercing Shot: phys dmg + heavy armor strip (-6). Stacks with Marked Shot's -5 ARM.
  Rogue:    { name: "Spell2-Rogue",    type: "damage_buff",   baseDmgMin: 3, baseDmgMax: 6, dmgPerAgi: 0.3, agiPct: 0.15, duration: 5, maxUses: 2 },
    // Toxic Blade: phys dmg + self +15% AGI. Sustained DPS boost.

  // Hybrid: Druid can go any path.
  Druid:    { name: "Spell2-Druid",    type: "self_buff",     intPct: 0.12, armorMod: 6, hpPct: 0.20, duration: 6, maxUses: 2 },
    // Nature's Embrace: heal + armor + INT. Survivability.

  // INT classes — defensive spell2s for PvP survivability at 30 rounds.
  Warlock:  { name: "Spell2-Warlock",  type: "self_buff",     intPct: 0.12, armorMod: 10, hpPct: 0.20, duration: 8, maxUses: 2 },
    // Dark Pact: steal life force. +10 ARM, +12% INT, +20% HP heal. Recastable.
  Wizard:   { name: "Spell2-Wizard",   type: "self_buff",     intPct: 0.20, armorMod: 15, hpPct: 0.25, duration: 10, maxUses: 2 },
    // Frost Barrier: +15 ARM, +20% INT, +25% HP. Long duration, recastable.
  Sorcerer: { name: "Spell2-Sorcerer", type: "self_buff",     intPct: 0.15, armorMod: 12, hpPct: 0.20, duration: 10, maxUses: 2 },
    // Arcane Ward: +12 ARM, +15% INT, +20% HP. Long duration, recastable.
  Cleric:   { name: "Spell2-Cleric",   type: "damage_debuff", baseDmgMin: 5, baseDmgMax: 10, dmgPerInt: 0.4, strPct: -0.15, agiPct: -0.15, armorMod: -5, duration: 8, maxUses: 2 },
    // Radiance: magic dmg + heavy weaken (-15% STR/AGI, -5 ARM). Offensive debuff.
};

// ============================================================
//  WEAPON SWAP AI (shared by PvE and PvP)
// ============================================================

function pickWeaponForTarget(
  weapons: Weapon[], target: Combatant, targetEffects: ActiveEffectInstance[], data: GameData,
): Weapon {
  if (weapons.length === 1) return weapons[0];
  let best = weapons[0];
  let bestScore = -Infinity;
  for (const w of weapons) {
    let score = (w.minDamage + w.maxDamage) / 2;
    // Magic bypasses armor — huge vs armored targets
    if (w.isMagic) score += Math.max(0, target.armor - 2) * 1.5;
    else score -= Math.min(target.armor, score * 0.5);
    // Prefer weapon whose effects aren't already active on target
    const effects = getWeaponEffects(w.name, data);
    const allActive = effects.every(e =>
      e.type === "dot" || e.type === "stat_debuff"
        ? targetEffects.some(te => te.name === e.name && te.turnsRemaining > 1)
        : false
    );
    if (allActive && effects.length > 0) score -= 3;
    if (!allActive && effects.length > 0) score += 2;
    if (score > bestScore) { bestScore = score; best = w; }
  }
  return best;
}

// Apply weapon effects on hit (shared helper)
function applyWeaponEffectsOnHit(
  weaponName: string, targetEffects: ActiveEffectInstance[], data: GameData,
) {
  const effects = getWeaponEffects(weaponName, data);
  for (const e of effects) {
    if (e.type === "dot") {
      const existing = targetEffects.find(x => x.name === e.name);
      if (existing) { existing.turnsRemaining = e.duration ?? 3; }
      else {
        targetEffects.push({ name: e.name, type: "dot", turnsRemaining: e.duration ?? 3,
          damagePerTick: e.damagePerTick ?? 0, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0 });
      }
    } else if (e.type === "stat_debuff") {
      if (!targetEffects.some(x => x.name === e.name)) {
        targetEffects.push({ name: e.name, type: "stat_debuff", turnsRemaining: e.duration ?? 3,
          damagePerTick: 0, strMod: e.strMod ?? 0, agiMod: e.agiMod ?? 0,
          intMod: e.intMod ?? 0, armorMod: e.armorMod ?? 0 });
      }
    }
  }
  return effects;
}

// ============================================================
//  COMBAT SIM — full loadout support (spells, consumables, multi-weapon)
// ============================================================

function simulateFight(
  player: Combatant, mob: Combatant,
  loadout: CombatLoadout,
  extraWeapons: Weapon[],  // weapon2, weapon3 (if loadout.weaponCount > 1)
  data: GameData,
  startingHp?: number,     // for multi-fight endurance (carry HP from last fight)
): FightResult {
  const cc = data.combatConstants;

  // Apply pre-combat stat buffs from consumables
  const buffedPlayer = applyConsumablePreBuffs(player, loadout.consumables);

  // Build weapon array based on loadout
  const weapons: Weapon[] = [buffedPlayer.weapon];
  for (let i = 0; i < Math.min(loadout.weaponCount - 1, extraWeapons.length); i++) {
    weapons.push(extraWeapons[i]);
  }

  // Extract consumable slots by type
  const healSlot = getHealSlot(loadout.consumables);
  const debuffThrows = getDebuffThrows(loadout.consumables);
  const tradeoffBuffs = getTradeoffBuffs(loadout.consumables);
  const cleanseSlot = getCleanse(loadout.consumables);

  let pHp = startingHp ?? buffedPlayer.maxHp;
  let mHp = mob.maxHp;
  let rounds = 0;
  let totalDmg = 0;

  const pEffects: ActiveEffectInstance[] = [];
  const mEffects: ActiveEffectInstance[] = [];

  // Monster weapon effects
  const mWeaponEffects = getWeaponEffects(mob.weapon.name, data);
  const mHasEffects = mWeaponEffects.length > 0;
  const mHasDualMagic = mWeaponEffects.some(e => e.type === "dual_magic");
  const mBreathEffect = mWeaponEffects.find(e => e.type === "magic_breath");
  const mBreathCooldown = { lastUsed: -999 };

  // Spell tracking: queue all loadout spells, cast one per turn
  const spellQueue = [...loadout.spells];
  const spellTrackers: { spell: ClassSpell; uses: number }[] = [];

  // Cast first spell pre-combat
  let turnsSkipped = 0;
  if (spellQueue.length > 0) {
    const s = spellQueue.shift()!;
    turnsSkipped = 1;
    spellTrackers.push({ spell: s, uses: (s.maxUses ?? 1) - 1 });
    const r = resolveSpell(s, buffedPlayer, mob, pEffects, mEffects, cc);
    pHp = Math.min(buffedPlayer.maxHp, pHp + r.casterHpDelta);
    mHp += r.targetHpDelta;
    totalDmg += r.dmgDealt;
    if (mHp <= 0) return { won: true, rounds: 0, damageDealt: totalDmg, remainingHp: Math.max(0, pHp), maxHp: buffedPlayer.maxHp };
  }

  while (rounds < MAX_COMBAT_ROUNDS && pHp > 0 && mHp > 0) {
    rounds++;

    // Tick effects
    const pDot = tickEffects(pEffects);
    const mDot = tickEffects(mEffects);
    pHp -= pDot;
    mHp -= mDot;
    totalDmg += mDot;
    if (pHp <= 0 || mHp <= 0) break;

    // Adjust stats for effects
    const adjPlayer = adjustCombatant(buffedPlayer, pEffects);
    const adjMob = adjustCombatant(mob, mEffects);

    // Player's turn — action priority
    let playerUsedAction = rounds <= turnsSkipped;

    // 1. Cast queued spell (second spell on turn 2)
    if (!playerUsedAction && spellQueue.length > 0) {
      const s = spellQueue.shift()!;
      spellTrackers.push({ spell: s, uses: (s.maxUses ?? 1) - 1 });
      const r = resolveSpell(s, adjPlayer, adjMob, pEffects, mEffects, cc);
      pHp = Math.min(buffedPlayer.maxHp, pHp + r.casterHpDelta);
      mHp += r.targetHpDelta;
      totalDmg += r.dmgDealt;
      turnsSkipped++;
      playerUsedAction = true;
    }

    // 2. Recast expired spells (if uses remain)
    if (!playerUsedAction) {
      for (const tracker of spellTrackers) {
        if (tracker.uses <= 0) continue;
        const s = tracker.spell;
        const shouldRecast = (s.type === "self_buff" || s.type === "damage_buff")
          ? !pEffects.some(e => e.name === s.name)
          : (s.type === "damage_debuff" || s.type === "debuff")
          ? !mEffects.some(e => e.name === s.name)
          : (s.type === "magic_damage");
        if (shouldRecast) {
          tracker.uses--;
          const r = resolveSpell(s, adjPlayer, adjMob, pEffects, mEffects, cc);
          pHp = Math.min(buffedPlayer.maxHp, pHp + r.casterHpDelta);
          mHp += r.targetHpDelta;
          totalDmg += r.dmgDealt;
          playerUsedAction = true;
          break;
        }
      }
    }

    // 3. Apply debuff throwable (if target not already debuffed by it)
    if (!playerUsedAction && debuffThrows.length > 0) {
      for (const dt of debuffThrows) {
        const alreadyActive = mEffects.some(e => e.name === dt.name);
        if (!alreadyActive) {
          // Apply debuff to target
          if (dt.targetDot && dt.targetDot > 0) {
            mEffects.push({ name: dt.name, type: "dot", turnsRemaining: dt.effectDuration ?? 8,
              damagePerTick: dt.targetDot, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0 });
          }
          if ((dt.targetStrMod ?? 0) !== 0 || (dt.targetAgiMod ?? 0) !== 0 ||
              (dt.targetIntMod ?? 0) !== 0 || (dt.targetArmorMod ?? 0) !== 0) {
            mEffects.push({ name: dt.name + "_debuff", type: "stat_debuff",
              turnsRemaining: dt.effectDuration ?? 8, damagePerTick: 0,
              strMod: dt.targetStrMod ?? 0, agiMod: dt.targetAgiMod ?? 0,
              intMod: dt.targetIntMod ?? 0, armorMod: dt.targetArmorMod ?? 0 });
          }
          playerUsedAction = true;
          break;
        }
      }
    }

    // 4. Apply tradeoff buff (if not already active)
    if (!playerUsedAction && tradeoffBuffs.length > 0) {
      for (const tb of tradeoffBuffs) {
        const alreadyActive = pEffects.some(e => e.name === tb.name);
        if (!alreadyActive) {
          pEffects.push({ name: tb.name, type: "self_buff",
            turnsRemaining: tb.selfDuration ?? 3, damagePerTick: 0,
            strMod: tb.selfStrMod ?? 0, agiMod: tb.selfAgiMod ?? 0,
            intMod: tb.selfIntMod ?? 0, armorMod: tb.selfArmorMod ?? 0 });
          playerUsedAction = true;
          break;
        }
      }
    }

    // 5. Cleanse (if debuffed and cleanse available)
    if (!playerUsedAction && cleanseSlot) {
      const hasDebuff = pEffects.some(e => e.type === "dot" || e.type === "stat_debuff");
      if (hasDebuff) {
        // Remove all debuffs (DoTs and stat debuffs applied by enemy)
        for (let i = pEffects.length - 1; i >= 0; i--) {
          if (pEffects[i].type === "dot" || pEffects[i].type === "stat_debuff") {
            pEffects.splice(i, 1);
          }
        }
        playerUsedAction = true;
      }
    }

    // 6. Heal (if HP < 50% and heal slot equipped — infinite uses, costs a turn)
    if (!playerUsedAction && healSlot && pHp < buffedPlayer.maxHp * 0.50) {
      pHp = Math.min(buffedPlayer.maxHp, pHp + (healSlot.healAmount ?? 0));
      playerUsedAction = true;
    }

    // 7. Weapon attack — pick best weapon via swap AI
    if (!playerUsedAction) {
      const activeWeapon = pickWeaponForTarget(weapons, adjMob, mEffects, data);
      const swappedPlayer = activeWeapon.name !== adjPlayer.weapon.name
        ? { ...adjPlayer, weapon: activeWeapon } : adjPlayer;
      const pDmg = _resolveAttack(swappedPlayer, adjMob, cc, rng);
      mHp -= pDmg;
      totalDmg += pDmg;

      // Apply weapon effects on hit
      if (pDmg > 0) {
        const wEffects = applyWeaponEffectsOnHit(activeWeapon.name, mEffects, data);
        // Dual magic
        if (wEffects.some(e => e.type === "dual_magic") && mHp > 0) {
          const dualDmg = _resolveDualMagicHit(swappedPlayer, adjMob, cc, rng);
          mHp -= dualDmg;
          totalDmg += dualDmg;
        }
      }

      // Weapon enchant bonus damage
      const enchant = pEffects.find(e => e.type === "weapon_enchant");
      if (enchant && mHp > 0 && pDmg > 0) {
        const bonusBase = randInt(enchant.bonusMagicDmgMin ?? 0, enchant.bonusMagicDmgMax ?? 0);
        const bonusInt = Math.floor(adjPlayer.int * (enchant.bonusMagicDmgPerInt ?? 0));
        const resistPct = Math.min(adjMob.int * cc.magicResistPerInt, cc.magicResistCap);
        const enchantDmg = Math.max(1, Math.floor((bonusBase + bonusInt) * (1 - resistPct / 100)));
        mHp -= enchantDmg;
        totalDmg += enchantDmg;
      }
    }

    if (mHp <= 0) break;

    // Monster's turn
    const mDmg = _resolveAttack(adjMob, adjPlayer, cc, rng);
    pHp -= mDmg;

    // Monster weapon effects on hit
    if (mDmg > 0 && mHasEffects) {
      applyWeaponEffectsOnHit(mob.weapon.name, pEffects, data);
    }

    // Monster dual magic
    if (mHasDualMagic && pHp > 0) {
      const dualDmg = _resolveDualMagicHit(adjMob, adjPlayer, cc, rng);
      pHp -= dualDmg;
    }

    // Monster breath attack
    if (mBreathEffect && pHp > 0 && (rounds - mBreathCooldown.lastUsed) >= (mBreathEffect.cooldown ?? 2)) {
      const bDmg = _resolveBreathAttack(adjMob, adjPlayer, mBreathEffect, cc, rng);
      pHp -= bDmg;
      mBreathCooldown.lastUsed = rounds;
    }
  }

  const won = mHp <= 0 && pHp > 0;
  return { won, rounds, damageDealt: totalDmg, remainingHp: Math.max(0, pHp), maxHp: buffedPlayer.maxHp };
}

// ============================================================
//  SYMMETRIC PVP COMBAT — both sides get spells, pots, effects
// ============================================================

// ============================================================
//  4-SLOT LOADOUT SYSTEM
//  Armor = free. 4 slots for: weapon + spells + consumables.
//  Consumable slots are TYPES, not individual items:
//    - Heal pot: 1 slot = infinite heals of that tier per fight (costs a turn)
//    - Stat buff: 1 slot = pre-combat +5 to one stat (free, no turn cost)
//    - Debuff throwable: 1 slot = apply debuff to target (costs a turn, reapply when expired)
//    - Tradeoff buff: 1 slot = self-buff with downside (costs a turn, reapply when expired)
// ============================================================

interface ConsumableSlot {
  type: "heal" | "stat_buff" | "debuff_throw" | "tradeoff_buff" | "cleanse";
  name: string;
  // Heal
  healAmount?: number;           // HP per use (15/35/75)
  // Stat buff (pre-combat, free)
  buffStr?: number;
  buffAgi?: number;
  buffInt?: number;
  // Debuff throwable (applied to target, costs a turn)
  targetStrMod?: number;
  targetAgiMod?: number;
  targetIntMod?: number;
  targetArmorMod?: number;
  targetDot?: number;            // DoT damage per tick
  effectDuration?: number;       // turns
  effectMaxStacks?: number;
  // Tradeoff self-buff (costs a turn)
  selfStrMod?: number;
  selfAgiMod?: number;
  selfIntMod?: number;
  selfArmorMod?: number;
  selfDuration?: number;
  // Economy
  goldCost: number;              // per-fight cost (consumable price)
}

// Real consumable types from items.json/effects.json
const CONSUMABLE_TYPES: ConsumableSlot[] = [
  // Heal pots
  { type: "heal", name: "Minor HP",   healAmount: 15, goldCost: 10 },
  { type: "heal", name: "Health Pot",  healAmount: 35, goldCost: 25 },
  { type: "heal", name: "Greater HP",  healAmount: 75, goldCost: 60 },
  // Stat buffs (pre-combat, free, 600s)
  { type: "stat_buff", name: "Fort. Stew",    buffStr: 5, goldCost: 20 },
  { type: "stat_buff", name: "Quick. Berries", buffAgi: 5, goldCost: 20 },
  { type: "stat_buff", name: "Focus. Tea",     buffInt: 5, goldCost: 20 },
  // Debuff throwables (target, costs a turn, 8 turns)
  { type: "debuff_throw", name: "Sapping Poison", targetStrMod: -8, effectDuration: 8, goldCost: 35 },
  { type: "debuff_throw", name: "Spore Cloud",    targetIntMod: -8, effectDuration: 8, goldCost: 35 },
  { type: "debuff_throw", name: "Venom Vial",     targetDot: 3, effectDuration: 8, effectMaxStacks: 2, goldCost: 35 },
  // Tradeoff self-buffs (self, costs a turn, 3 turns)
  { type: "tradeoff_buff", name: "Bloodrage",  selfStrMod: 6, selfArmorMod: -4, selfDuration: 3, goldCost: 25 },
  { type: "tradeoff_buff", name: "Stoneskin",  selfAgiMod: -4, selfArmorMod: 6, selfDuration: 3, goldCost: 25 },
  { type: "tradeoff_buff", name: "Trollblood", selfStrMod: 8, selfAgiMod: -3, selfIntMod: -5, selfDuration: 3, goldCost: 25 },
];

interface CombatLoadout {
  name: string;
  weaponCount: number;           // 1, 2, or 3 weapons equipped
  spells: ClassSpell[];          // 0-2 spells (each takes a slot)
  consumables: ConsumableSlot[]; // 0-3 consumable slots
  goldCostPerFight: number;      // total consumable cost
}

// Derive combat-time consumable info from ConsumableSlot[]
function getPreBuffs(consumables: ConsumableSlot[]): { str: number; agi: number; int: number } {
  let str = 0, agi = 0, int_ = 0;
  for (const c of consumables) {
    if (c.type === "stat_buff") {
      str += c.buffStr ?? 0;
      agi += c.buffAgi ?? 0;
      int_ += c.buffInt ?? 0;
    }
  }
  return { str, agi, int: int_ };
}

function getHealSlot(consumables: ConsumableSlot[]): ConsumableSlot | undefined {
  return consumables.find(c => c.type === "heal");
}

function getDebuffThrows(consumables: ConsumableSlot[]): ConsumableSlot[] {
  return consumables.filter(c => c.type === "debuff_throw");
}

function getTradeoffBuffs(consumables: ConsumableSlot[]): ConsumableSlot[] {
  return consumables.filter(c => c.type === "tradeoff_buff");
}

function getCleanse(consumables: ConsumableSlot[]): ConsumableSlot | undefined {
  return consumables.find(c => c.type === "cleanse");
}

// Apply pre-combat stat buffs from consumables
function applyConsumablePreBuffs(player: Combatant, consumables: ConsumableSlot[]): Combatant {
  const buffs = getPreBuffs(consumables);
  if (buffs.str === 0 && buffs.agi === 0 && buffs.int === 0) return player;
  const newStr = player.str + buffs.str;
  const newAgi = player.agi + buffs.agi;
  const newInt = player.int + buffs.int;
  const dom = _getDominant(newStr, newAgi, newInt);
  return {
    ...player,
    str: newStr, agi: newAgi, int: newInt,
    dominantType: dom.type, dominantStat: dom.stat,
  };
}

// Pick the best consumable of a given type for an archetype's stat path
function bestConsumableForPath(type: ConsumableSlot["type"], path: "str" | "agi" | "int"): ConsumableSlot | undefined {
  const candidates = CONSUMABLE_TYPES.filter(c => c.type === type);
  if (candidates.length === 0) return undefined;
  if (type === "stat_buff") {
    // Pick the buff matching the archetype's primary stat
    return candidates.find(c =>
      (path === "str" && (c.buffStr ?? 0) > 0) ||
      (path === "agi" && (c.buffAgi ?? 0) > 0) ||
      (path === "int" && (c.buffInt ?? 0) > 0)
    ) ?? candidates[0];
  }
  if (type === "heal") {
    // Best heal = highest amount
    return [...candidates].sort((a, b) => (b.healAmount ?? 0) - (a.healAmount ?? 0))[0];
  }
  if (type === "debuff_throw") {
    // Pick the debuff that counters the most common threat
    // STR builds want to weaken INT targets → Spore Cloud (-INT)
    // AGI builds want to weaken STR targets → Sapping Poison (-STR)
    // INT builds want to weaken STR targets → Sapping Poison (-STR)
    // Or Venom Vial for DoT pressure. Try all in PvP — for defaults, use path-based pick.
    if (path === "str") return candidates.find(c => c.name === "Spore Cloud") ?? candidates[0];
    return candidates.find(c => c.name === "Sapping Poison") ?? candidates[0];
  }
  if (type === "tradeoff_buff") {
    // STR: Bloodrage (+STR -ARM) or Trollblood (+STR -AGI -INT)
    // AGI: none ideal — Stoneskin (+ARM -AGI) is anti-synergy. Skip or use Bloodrage for mixed builds
    // INT: Stoneskin (+ARM -AGI) is fine — INT doesn't need AGI
    if (path === "str") return candidates.find(c => c.name === "Bloodrage") ?? candidates[0];
    if (path === "int") return candidates.find(c => c.name === "Stoneskin") ?? candidates[0];
    return undefined; // AGI builds don't have a good tradeoff buff
  }
  return candidates[0];
}

function buildCombatLoadouts(
  spell1: ClassSpell | undefined,
  spell2: ClassSpell | undefined,
  path: "str" | "agi" | "int",
  hasWeapon2: boolean,
  hasWeapon3: boolean,
): CombatLoadout[] {
  const loadouts: CombatLoadout[] = [];

  // Pre-resolve best consumables for this path
  const healSlot = bestConsumableForPath("heal", path)!;
  const buffSlot = bestConsumableForPath("stat_buff", path)!;
  const debuffSlot = bestConsumableForPath("debuff_throw", path);
  const tradeoffSlot = bestConsumableForPath("tradeoff_buff", path);

  // Helper to build a loadout
  function L(name: string, wc: number, spells: ClassSpell[], consumables: ConsumableSlot[]): CombatLoadout {
    const total = wc + spells.length + consumables.length;
    if (total !== 4) throw new Error(`Loadout "${name}" has ${total} slots, expected 4`);
    return {
      name, weaponCount: wc, spells, consumables,
      goldCostPerFight: consumables.reduce((sum, c) => sum + c.goldCost, 0),
    };
  }

  const s1 = spell1 ? [spell1] : [];
  const s2 = spell2 ? [spell2] : [];
  const s12 = (spell1 && spell2) ? [spell1, spell2] : [];

  // === 1 WEAPON (3 remaining) ===
  // Pure sustain
  loadouts.push(L("1w+3heal", 1, [], [healSlot, healSlot, healSlot]));
  // Buff + sustain
  loadouts.push(L("1w+buff+2heal", 1, [], [buffSlot, healSlot, healSlot]));
  // Debuff + sustain
  if (debuffSlot) loadouts.push(L("1w+debuff+2heal", 1, [], [debuffSlot, healSlot, healSlot]));
  // Tradeoff + sustain
  if (tradeoffSlot) loadouts.push(L("1w+trade+2heal", 1, [], [tradeoffSlot, healSlot, healSlot]));
  // Full utility: debuff + tradeoff + heal
  if (debuffSlot && tradeoffSlot) loadouts.push(L("1w+debuff+trade+heal", 1, [], [debuffSlot, tradeoffSlot, healSlot]));
  // Spell + sustain
  if (spell1) {
    loadouts.push(L("1w+s1+2heal", 1, s1, [healSlot, healSlot]));
    loadouts.push(L("1w+s1+buff+heal", 1, s1, [buffSlot, healSlot]));
    if (debuffSlot) loadouts.push(L("1w+s1+debuff+heal", 1, s1, [debuffSlot, healSlot]));
  }
  if (spell2) {
    loadouts.push(L("1w+s2+2heal", 1, s2, [healSlot, healSlot]));
    loadouts.push(L("1w+s2+buff+heal", 1, s2, [buffSlot, healSlot]));
  }
  // Dual spell
  if (spell1 && spell2) {
    loadouts.push(L("1w+2s+heal", 1, s12, [healSlot]));
    loadouts.push(L("1w+2s+buff", 1, s12, [buffSlot]));
  }

  // === 2 WEAPONS (2 remaining) ===
  if (hasWeapon2) {
    loadouts.push(L("2w+2heal", 2, [], [healSlot, healSlot]));
    loadouts.push(L("2w+buff+heal", 2, [], [buffSlot, healSlot]));
    if (debuffSlot) loadouts.push(L("2w+debuff+heal", 2, [], [debuffSlot, healSlot]));
    if (spell1) {
      loadouts.push(L("2w+s1+heal", 2, s1, [healSlot]));
      loadouts.push(L("2w+s1+buff", 2, s1, [buffSlot]));
    }
    if (spell2) loadouts.push(L("2w+s2+heal", 2, s2, [healSlot]));
    if (spell1 && spell2) loadouts.push(L("2w+2s", 2, s12, []));
  }

  // === 3 WEAPONS — triangle-counter hybrid builds (1 remaining) ===
  if (hasWeapon3) {
    loadouts.push(L("3w+heal", 3, [], [healSlot]));
    loadouts.push(L("3w+buff", 3, [], [buffSlot]));
    if (spell1) loadouts.push(L("3w+s1", 3, s1, []));
    if (debuffSlot) loadouts.push(L("3w+debuff", 3, [], [debuffSlot]));
  }

  return loadouts;
}

function simulatePvP(
  p1: Combatant, p2: Combatant,
  p1ExtraWeapons: Weapon[], p2ExtraWeapons: Weapon[],
  p1Loadout: CombatLoadout, p2Loadout: CombatLoadout,
  data: GameData,
): { p1Wins: boolean; draw: boolean } {
  const cc = data.combatConstants;

  // Apply pre-combat stat buffs from consumables
  const bp1 = applyConsumablePreBuffs(p1, p1Loadout.consumables);
  const bp2 = applyConsumablePreBuffs(p2, p2Loadout.consumables);

  // Build weapon arrays based on loadout weaponCount
  const p1Weapons: Weapon[] = [bp1.weapon];
  for (let i = 0; i < Math.min(p1Loadout.weaponCount - 1, p1ExtraWeapons.length); i++) {
    p1Weapons.push(p1ExtraWeapons[i]);
  }
  const p2Weapons: Weapon[] = [bp2.weapon];
  for (let i = 0; i < Math.min(p2Loadout.weaponCount - 1, p2ExtraWeapons.length); i++) {
    p2Weapons.push(p2ExtraWeapons[i]);
  }

  // Extract consumable slots
  const p1Heal = getHealSlot(p1Loadout.consumables);
  const p2Heal = getHealSlot(p2Loadout.consumables);
  const p1DebuffThrows = getDebuffThrows(p1Loadout.consumables);
  const p2DebuffThrows = getDebuffThrows(p2Loadout.consumables);
  const p1TradeoffBuffs = getTradeoffBuffs(p1Loadout.consumables);
  const p2TradeoffBuffs = getTradeoffBuffs(p2Loadout.consumables);
  const p1Cleanse = getCleanse(p1Loadout.consumables);
  const p2Cleanse = getCleanse(p2Loadout.consumables);

  let p1Hp = bp1.maxHp;
  let p2Hp = bp2.maxHp;
  let rounds = 0;

  const p1Effects: ActiveEffectInstance[] = [];
  const p2Effects: ActiveEffectInstance[] = [];

  // Spell tracking
  const p1SpellQueue = [...p1Loadout.spells];
  const p2SpellQueue = [...p2Loadout.spells];
  const p1SpellTrackers: { spell: ClassSpell; uses: number }[] = [];
  const p2SpellTrackers: { spell: ClassSpell; uses: number }[] = [];

  // Cast first spell pre-combat (both sides simultaneously)
  let p1TurnsSkipped = 0, p2TurnsSkipped = 0;
  if (p1SpellQueue.length > 0) {
    const s = p1SpellQueue.shift()!;
    p1TurnsSkipped = 1;
    p1SpellTrackers.push({ spell: s, uses: (s.maxUses ?? 1) - 1 });
    const r = resolveSpell(s, bp1, bp2, p1Effects, p2Effects, cc);
    p1Hp = Math.min(bp1.maxHp, p1Hp + r.casterHpDelta);
    p2Hp += r.targetHpDelta;
  }
  if (p2SpellQueue.length > 0) {
    const s = p2SpellQueue.shift()!;
    p2TurnsSkipped = 1;
    p2SpellTrackers.push({ spell: s, uses: (s.maxUses ?? 1) - 1 });
    const r = resolveSpell(s, bp2, bp1, p2Effects, p1Effects, cc);
    p2Hp = Math.min(bp2.maxHp, p2Hp + r.casterHpDelta);
    p1Hp += r.targetHpDelta;
  }

  if (p1Hp <= 0 && p2Hp <= 0) return { p1Wins: false, draw: true };
  if (p1Hp <= 0) return { p1Wins: false, draw: false };
  if (p2Hp <= 0) return { p1Wins: true, draw: false };

  function doPvPTurn(
    attacker: Combatant, defender: Combatant,
    aHp: number, dHp: number,
    aEffects: ActiveEffectInstance[], dEffects: ActiveEffectInstance[],
    aWeapons: Weapon[],
    aSpellTrackers: { spell: ClassSpell; uses: number }[],
    aSpellQueue: ClassSpell[],
    aTurnsSkipped: number,
    aHealSlot: ConsumableSlot | undefined,
    aDebuffThrows: ConsumableSlot[],
    aTradeoffBuffs: ConsumableSlot[],
    aCleanse: ConsumableSlot | undefined,
    round: number,
  ): { aHp: number; dHp: number; turnsSkipped: number } {
    // Tick effects
    const aDot = tickEffects(aEffects);
    const dDot = tickEffects(dEffects);
    aHp -= aDot;
    dHp -= dDot;
    if (aHp <= 0 || dHp <= 0) return { aHp, dHp, turnsSkipped: aTurnsSkipped };

    const adjA = adjustCombatant(attacker, aEffects);
    const adjD = adjustCombatant(defender, dEffects);

    let usedAction = round <= aTurnsSkipped;

    // 1. Cast queued spell
    if (!usedAction && aSpellQueue.length > 0) {
      const s = aSpellQueue.shift()!;
      aSpellTrackers.push({ spell: s, uses: (s.maxUses ?? 1) - 1 });
      const r = resolveSpell(s, adjA, adjD, aEffects, dEffects, cc);
      aHp = Math.min(attacker.maxHp, aHp + r.casterHpDelta);
      dHp += r.targetHpDelta;
      aTurnsSkipped++;
      usedAction = true;
    }

    // 2. Spell recast
    if (!usedAction) {
      for (const tracker of aSpellTrackers) {
        if (tracker.uses <= 0) continue;
        const s = tracker.spell;
        const shouldRecast = (s.type === "self_buff" || s.type === "damage_buff")
          ? !aEffects.some(e => e.name === s.name)
          : (s.type === "damage_debuff" || s.type === "debuff")
          ? !dEffects.some(e => e.name === s.name)
          : (s.type === "magic_damage");
        if (shouldRecast) {
          tracker.uses--;
          const r = resolveSpell(s, adjA, adjD, aEffects, dEffects, cc);
          aHp = Math.min(attacker.maxHp, aHp + r.casterHpDelta);
          dHp += r.targetHpDelta;
          usedAction = true;
          break;
        }
      }
    }

    // 3. Debuff throwable
    if (!usedAction && aDebuffThrows.length > 0) {
      for (const dt of aDebuffThrows) {
        const alreadyActive = dEffects.some(e => e.name === dt.name || e.name === dt.name + "_debuff");
        if (!alreadyActive) {
          if (dt.targetDot && dt.targetDot > 0) {
            dEffects.push({ name: dt.name, type: "dot", turnsRemaining: dt.effectDuration ?? 8,
              damagePerTick: dt.targetDot, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0 });
          }
          if ((dt.targetStrMod ?? 0) !== 0 || (dt.targetAgiMod ?? 0) !== 0 ||
              (dt.targetIntMod ?? 0) !== 0 || (dt.targetArmorMod ?? 0) !== 0) {
            dEffects.push({ name: dt.name + "_debuff", type: "stat_debuff",
              turnsRemaining: dt.effectDuration ?? 8, damagePerTick: 0,
              strMod: dt.targetStrMod ?? 0, agiMod: dt.targetAgiMod ?? 0,
              intMod: dt.targetIntMod ?? 0, armorMod: dt.targetArmorMod ?? 0 });
          }
          usedAction = true;
          break;
        }
      }
    }

    // 4. Tradeoff buff
    if (!usedAction && aTradeoffBuffs.length > 0) {
      for (const tb of aTradeoffBuffs) {
        if (!aEffects.some(e => e.name === tb.name)) {
          aEffects.push({ name: tb.name, type: "self_buff",
            turnsRemaining: tb.selfDuration ?? 3, damagePerTick: 0,
            strMod: tb.selfStrMod ?? 0, agiMod: tb.selfAgiMod ?? 0,
            intMod: tb.selfIntMod ?? 0, armorMod: tb.selfArmorMod ?? 0 });
          usedAction = true;
          break;
        }
      }
    }

    // 5. Cleanse
    if (!usedAction && aCleanse) {
      const hasDebuff = aEffects.some(e => e.type === "dot" || e.type === "stat_debuff");
      if (hasDebuff) {
        for (let i = aEffects.length - 1; i >= 0; i--) {
          if (aEffects[i].type === "dot" || aEffects[i].type === "stat_debuff") {
            aEffects.splice(i, 1);
          }
        }
        usedAction = true;
      }
    }

    // 6. Heal (infinite uses, costs a turn)
    if (!usedAction && aHealSlot && aHp < attacker.maxHp * 0.50) {
      aHp = Math.min(attacker.maxHp, aHp + (aHealSlot.healAmount ?? 0));
      usedAction = true;
    }

    // 7. Weapon attack — pick best weapon via swap AI
    if (!usedAction) {
      const activeWeapon = pickWeaponForTarget(aWeapons, adjD, dEffects, data);
      const swappedA = activeWeapon.name !== adjA.weapon.name
        ? { ...adjA, weapon: activeWeapon } : adjA;
      const dmg = _resolveAttack(swappedA, adjD, cc, rng);
      dHp -= dmg;
      if (dmg > 0) {
        const wEffects = applyWeaponEffectsOnHit(activeWeapon.name, dEffects, data);
        if (wEffects.some(e => e.type === "dual_magic") && dHp > 0) {
          dHp -= _resolveDualMagicHit(swappedA, adjD, cc, rng);
        }
      }
      const enchant = aEffects.find(e => e.type === "weapon_enchant");
      if (enchant && dHp > 0 && dmg > 0) {
        const bonusBase = randInt(enchant.bonusMagicDmgMin ?? 0, enchant.bonusMagicDmgMax ?? 0);
        const bonusInt = Math.floor(adjA.int * (enchant.bonusMagicDmgPerInt ?? 0));
        const resistPct = Math.min(adjD.int * cc.magicResistPerInt, cc.magicResistCap);
        dHp -= Math.max(1, Math.floor((bonusBase + bonusInt) * (1 - resistPct / 100)));
      }
    }

    return { aHp, dHp, turnsSkipped: aTurnsSkipped };
  }

  while (rounds < MAX_COMBAT_ROUNDS && p1Hp > 0 && p2Hp > 0) {
    rounds++;

    const t1 = doPvPTurn(bp1, bp2, p1Hp, p2Hp, p1Effects, p2Effects,
      p1Weapons, p1SpellTrackers, p1SpellQueue, p1TurnsSkipped,
      p1Heal, p1DebuffThrows, p1TradeoffBuffs, p1Cleanse, rounds);
    p1Hp = t1.aHp; p2Hp = t1.dHp; p1TurnsSkipped = t1.turnsSkipped;
    if (p1Hp <= 0 || p2Hp <= 0) break;

    const t2 = doPvPTurn(bp2, bp1, p2Hp, p1Hp, p2Effects, p1Effects,
      p2Weapons, p2SpellTrackers, p2SpellQueue, p2TurnsSkipped,
      p2Heal, p2DebuffThrows, p2TradeoffBuffs, p2Cleanse, rounds);
    p2Hp = t2.aHp; p1Hp = t2.dHp; p2TurnsSkipped = t2.turnsSkipped;
  }

  if (p1Hp > 0 && p2Hp > 0) return { p1Wins: false, draw: true };
  if (p1Hp <= 0 && p2Hp <= 0) return { p1Wins: false, draw: true };
  return { p1Wins: p2Hp <= 0 && p1Hp > 0, draw: false };
}

// ============================================================
//  JOURNEY SIM RUNNER
// ============================================================

function runJourney() {
  // Parse CLI flags (before loadData — some flags affect data loading)
  const args = new Set(process.argv.slice(2));
  const useV4Flag = args.has("--v4");
  const showSummaryOnly = args.has("--summary");
  const showVerbose = args.has("--verbose");
  const showBlockedOnly = args.has("--blocked");
  const showPvP = args.has("--pvp");
  const useSpell2 = args.has("--spell2");
  const filterArch = process.argv.find(a => a.startsWith("--arch="))?.split("=")[1];
  const filterLevel = process.argv.find(a => a.startsWith("--level="))?.split("=")[1];

  const data = loadData(useV4Flag);
  const archetypes = buildArchetypes(data);
  const cc = data.combatConstants;

  // Combat constant overrides for tuning
  const blockMagicOverride = process.argv.find(a => a.startsWith("--block-magic="))?.split("=")[1];
  const magicResistOverride = process.argv.find(a => a.startsWith("--magic-resist="))?.split("=")[1];
  const roundsOverride = process.argv.find(a => a.startsWith("--rounds="))?.split("=")[1];

  if (blockMagicOverride !== undefined) {
    data.combatConstants.blockReductionMagic = parseFloat(blockMagicOverride);
    console.log(`[OVERRIDE] blockReductionMagic = ${data.combatConstants.blockReductionMagic}`);
  }
  if (magicResistOverride !== undefined) {
    data.combatConstants.magicResistPerInt = parseFloat(magicResistOverride);
    console.log(`[OVERRIDE] magicResistPerInt = ${data.combatConstants.magicResistPerInt}`);
  }
  if (roundsOverride !== undefined) {
    (MAX_COMBAT_ROUNDS as any) = parseInt(roundsOverride);
    console.log(`[OVERRIDE] MAX_COMBAT_ROUNDS = ${MAX_COMBAT_ROUNDS}`);
  }

  // Print stat progression reference
  const gearLabel = useV4Flag ? "V4" : "V3";
  console.log(`=== ZONE 2 JOURNEY SIM — Option B (${gearLabel} gear) ===`);
  console.log(`Compressed scaling: stat points on even levels only (L11+), 1 HP/level`);
  console.log(`${SIM_ITERATIONS} iterations per matchup. ${MAX_COMBAT_ROUNDS} round cap. Spells: ON.\n`);

  if (!showSummaryOnly) {
    console.log("--- STAT PROGRESSION REFERENCE ---");
    console.log("Level  StatPts  TotalPts  HPGain  TotalHP(base)");
    for (let l = 10; l <= 20; l++) {
      const sp = statPointsForLevel(l, data.levelingConstants);
      const tp = totalStatPointsAtLevel(l, data.levelingConstants);
      const hg = hpForLevel(l, data.levelingConstants);
      const th = totalHpFromLeveling(l, data.levelingConstants);
      console.log(`  ${String(l).padStart(2)}      ${sp}        ${String(tp).padStart(2)}        ${hg}       ${th}`);
    }
    console.log();
  }

  // Results storage
  const results: Record<string, { level: number; winRate: number; weapon: string; armor: string; stats: StatProfile }[]> = {};
  const blocked: { archId: string; level: number; winRate: number; weapon: string }[] = [];

  // Path averages
  const pathWinRates: Record<string, number[]> = { str: [], agi: [], int: [] };
  const levelWinRates: Record<number, number[]> = {};

  for (const arch of archetypes) {
    if (filterArch && arch.id !== filterArch) continue;

    results[arch.id] = [];
    const archResults: string[] = [];

    for (let level = 10; level <= 20; level++) {
      if (filterLevel && level !== parseInt(filterLevel)) continue;

      // Level-filtered gear pools
      const availWeapons = weaponsAvailableAtLevel(data.weapons, level);
      const availArmors = armorsAvailableAtLevel(data.armors, level);
      const gear = buildGearLoadout(arch, level, data, availWeapons, availArmors);

      // Use Z2 monsters for L11+, DC for L10
      const monster = level >= 11
        ? Z2_MONSTERS.find(m => m.level === level)
        : data.monsters.find(m => m.level === level);
      if (!monster || !gear) continue;

      const player = _makeCombatant(gear.profile, gear.weapon, arch.advClass, gear.armorRating, arch.className);
      const mob = _makeMonsterCombatant(monster, !!data.monsterWeaponEffects[monster.name]);

      // Get class spells
      const spell1 = CLASS_SPELLS[arch.className];
      const spell2 = useSpell2 && level >= 15 ? CLASS_SPELLS_2[arch.className] : undefined;

      // Build extra weapons array for multi-weapon loadouts
      const extraWeapons: Weapon[] = [];
      if (gear.weapon2) extraWeapons.push(gear.weapon2);
      if (gear.weapon3) extraWeapons.push(gear.weapon3);

      // Build all loadout permutations and pick the best for this matchup
      const loadouts = buildCombatLoadouts(
        level >= 10 ? spell1 : undefined,
        spell2,
        arch.statPath,
        !!gear.weapon2,
        !!gear.weapon3,
      );

      let bestWins = 0;
      let bestLoadoutName = "none";
      for (const loadout of loadouts) {
        let w = 0;
        for (let i = 0; i < SIM_ITERATIONS; i++) {
          if (simulateFight(player, mob, loadout, extraWeapons, data).won) w++;
        }
        if (w > bestWins) {
          bestWins = w;
          bestLoadoutName = loadout.name;
        }
      }
      const winRate = bestWins / SIM_ITERATIONS;

      results[arch.id].push({ level, winRate, weapon: gear.weapon.name, armor: gear.armor?.name ?? "none", stats: gear.profile });
      pathWinRates[arch.statPath].push(winRate);
      if (!levelWinRates[level]) levelWinRates[level] = [];
      levelWinRates[level].push(winRate);

      if (winRate < 0.30) {
        blocked.push({ archId: arch.id, level, winRate, weapon: gear.weapon.name });
      }

      const pct = (winRate * 100).toFixed(0).padStart(3);
      const stats = `${String(gear.profile.str).padStart(2)}/${String(gear.profile.agi).padStart(2)}/${String(gear.profile.int).padStart(2)} HP${String(gear.profile.hp).padStart(3)} ARM${String(gear.armorRating).padStart(2)}`;
      const wpn = gear.weapon.name.padEnd(22);
      const arm = (gear.armor?.name ?? "none").padEnd(16);
      const bar = winRate >= 0.7 ? "##" : winRate >= 0.5 ? "==" : winRate >= 0.3 ? "--" : "XX";
      const lout = bestLoadoutName.padEnd(18);
      archResults.push(`  L${String(level).padStart(2)}: ${pct}% ${bar} | ${stats} | ${wpn} | ${arm} | ${lout} | vs ${monster.name}`);
    }

    if (!showSummaryOnly && !showBlockedOnly) {
      console.log(`\n${arch.id} (${arch.name}, ${arch.className}, ${arch.statPath.toUpperCase()})`);
      for (const line of archResults) console.log(line);
    }
  }

  // Blocked builds
  if (blocked.length > 0) {
    console.log("\n--- BLOCKED BUILDS (< 30% win rate) ---");
    for (const b of blocked) {
      console.log(`  ${b.archId} at L${b.level}: ${(b.winRate * 100).toFixed(0)}% (weapon: ${b.weapon})`);
    }
  } else {
    console.log("\n--- NO BLOCKED BUILDS ---");
  }

  // Path averages
  console.log("\n--- PATH AVERAGES (L10-20) ---");
  for (const path of ["str", "agi", "int"] as const) {
    const rates = pathWinRates[path];
    if (rates.length === 0) continue;
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    console.log(`  ${path.toUpperCase()}: ${(avg * 100).toFixed(1)}% avg win rate`);
  }

  // Level averages
  console.log("\n--- LEVEL AVERAGES ---");
  for (let l = 10; l <= 20; l++) {
    const rates = levelWinRates[l];
    if (!rates || rates.length === 0) continue;
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    console.log(`  L${String(l).padStart(2)}: ${(avg * 100).toFixed(1)}% avg (${(min * 100).toFixed(0)}-${(max * 100).toFixed(0)}%)`);
  }

  // Monster summary
  console.log("\n--- MONSTER REFERENCE ---");
  for (const m of Z2_MONSTERS) {
    const cls = m.classType === 0 ? "W" : m.classType === 1 ? "R" : "M";
    const effects = Z2_MONSTER_EFFECTS[m.name] || [];
    const effectNames = effects.map(e => e.name).join(", ") || "none";
    console.log(`  L${m.level} ${cls}: STR${m.str} AGI${m.agi} INT${m.int} HP${m.hp} ARM${m.armor} Wpn${m.weaponMinDmg}-${m.weaponMaxDmg} | ${effectNames}`);
  }

  // ============================================================
  //  BOSS SIM WITH POTS (--pots flag)
  // ============================================================
  if (args.has("--pots")) {
    const boss = Z2_MONSTERS.find(m => m.level === 20)!;
    const mob = _makeMonsterCombatant(boss, !!Z2_MONSTER_EFFECTS[boss.name]);

    // Build loadouts: naked, 2xHP50, 2xHP100, path_buff+2xHP50, path_buff+2xHP100
    const spell2Active = useSpell2;
    console.log("\n\n=== L20 BOSS SIM WITH CONSUMABLES ===");
    console.log(`Boss: STR${boss.str} AGI${boss.agi} INT${boss.int} HP${boss.hp} ARM${boss.armor} | ${MAX_COMBAT_ROUNDS} rounds`);
    console.log(`Spell2: ${spell2Active ? "ON (best of spell1/spell2)" : "OFF"}`);
    console.log(`Loadouts: naked, 2xHP50, 2xHP100, +7stat+2xHP50, +7stat+2xHP100\n`);

    const bossBlocked: string[] = [];
    const bossPathRates: Record<string, number[]> = {};

    for (const arch of archetypes) {
      if (filterArch && arch.id !== filterArch) continue;

      const availWeapons = weaponsAvailableAtLevel(data.weapons, 20);
      const availArmors = armorsAvailableAtLevel(data.armors, 20);
      const gear = buildGearLoadout(arch, 20, data, availWeapons, availArmors);
      if (!gear) continue;

      const player = _makeCombatant(gear.profile, gear.weapon, arch.advClass, gear.armorRating, arch.className);
      const spell1 = CLASS_SPELLS[arch.className];
      const spell2 = CLASS_SPELLS_2[arch.className];
      const extraWeapons: Weapon[] = [];
      if (gear.weapon2) extraWeapons.push(gear.weapon2);
      if (gear.weapon3) extraWeapons.push(gear.weapon3);

      // Build boss loadouts using ConsumableSlot system
      const pathHeal = bestConsumableForPath("heal", arch.statPath)!;
      const pathBuff = bestConsumableForPath("stat_buff", arch.statPath)!;
      const pathDebuff = bestConsumableForPath("debuff_throw", arch.statPath);
      const bossLoadouts: CombatLoadout[] = [
        { name: "naked", weaponCount: 1, spells: spell1 ? [spell1] : [], consumables: [], goldCostPerFight: 0 },
        { name: "s1+2heal", weaponCount: 1, spells: spell1 ? [spell1] : [], consumables: [pathHeal, pathHeal], goldCostPerFight: pathHeal.goldCost * 2 },
        { name: "s1+buff+heal", weaponCount: 1, spells: spell1 ? [spell1] : [], consumables: [pathBuff, pathHeal], goldCostPerFight: pathBuff.goldCost + pathHeal.goldCost },
        ...(pathDebuff ? [{ name: "s1+debuff+heal", weaponCount: 1, spells: spell1 ? [spell1] : [], consumables: [pathDebuff, pathHeal], goldCostPerFight: pathDebuff.goldCost + pathHeal.goldCost }] : []),
        ...(spell2 ? [{ name: "2s+heal", weaponCount: 1, spells: [spell1!, spell2], consumables: [pathHeal], goldCostPerFight: pathHeal.goldCost }] : []),
        ...(gear.weapon2 ? [{ name: "2w+s1+heal", weaponCount: 2, spells: spell1 ? [spell1] : [], consumables: [pathHeal], goldCostPerFight: pathHeal.goldCost }] : []),
      ];

      const rates: string[] = [];
      let bestRate = 0;
      let bestLoadoutName = "naked";
      let bestSpellName = "s1";

      for (const loadout of bossLoadouts) {
        let wins = 0;
        for (let i = 0; i < SIM_ITERATIONS; i++) {
          if (simulateFight(player, mob, loadout, extraWeapons, data).won) wins++;
        }
        const wr = wins / SIM_ITERATIONS;
        rates.push(`${loadout.name}:${(wr * 100).toFixed(0)}%`);
        if (wr > bestRate) { bestRate = wr; bestLoadoutName = loadout.name; }

        // Track path rates for loadout with buff+heal
        if (loadout.name === "s1+buff+heal") {
          if (!bossPathRates[arch.statPath]) bossPathRates[arch.statPath] = [];
          bossPathRates[arch.statPath].push(wr);
        }
      }

      const stats = `${String(gear.profile.str).padStart(2)}/${String(gear.profile.agi).padStart(2)}/${String(gear.profile.int).padStart(2)} HP${String(gear.profile.hp).padStart(3)} ARM${String(gear.armorRating).padStart(2)}`;
      const bar = bestRate >= 0.7 ? "##" : bestRate >= 0.5 ? "==" : bestRate >= 0.3 ? "--" : "XX";
      console.log(`${arch.id.padEnd(6)} ${bar} | ${stats} | ${gear.weapon.name.padEnd(22)} | ${rates.join("  ")}`);

      if (bestRate < 0.30) {
        bossBlocked.push(`${arch.id}: best ${(bestRate * 100).toFixed(0)}% (${bestLoadoutName})`);
      }
    }

    // Boss summary
    if (bossBlocked.length > 0) {
      console.log(`\n--- BOSS BLOCKED (< 30% even with best pots) ---`);
      for (const b of bossBlocked) console.log(`  ${b}`);
    } else {
      console.log(`\n--- ALL BUILDS VIABLE WITH POTS ---`);
    }

    // Path averages with best loadout
    console.log("\n--- BOSS PATH AVERAGES (+7stat+2xHP100) ---");
    for (const path of ["str", "agi", "int"] as const) {
      const allRates = bossPathRates[path] || [];
      if (allRates.length === 0) continue;
      const avg = allRates.reduce((a, b) => a + b, 0) / allRates.length;
      const min = Math.min(...allRates);
      const max = Math.max(...allRates);
      console.log(`  ${path.toUpperCase()}: ${(avg * 100).toFixed(1)}% avg (${(min * 100).toFixed(0)}-${(max * 100).toFixed(0)}%)`);
    }
  }

  // ============================================================
  //  PVP SIM (--pvp flag) — all archetypes vs all at L20
  //  Both players get: path stat buff (+7) + 2x HP50 pots
  // ============================================================
  if (args.has("--pvp")) {
    const PVP_ITERS = 200; // per-loadout test iterations (lower for speed)
    const PVP_FINAL_ITERS = 500; // final matchup iterations
    console.log("\n\n=== L20 PVP SIM (4-slot loadouts, per-opponent selection) ===");
    console.log(`Spell2: ${useSpell2 ? "ON" : "OFF"}. ${PVP_FINAL_ITERS} final iters. ${MAX_COMBAT_ROUNDS} rounds.\n`);

    const pvpArchs = archetypes.filter(a => !filterArch || a.id === filterArch);

    // Build all L20 combatants + their loadout options
    interface PvPBuild {
      arch: Archetype;
      player: Combatant;
      extraWeapons: Weapon[];  // weapon2, weapon3
      loadouts: CombatLoadout[];
    }
    const pvpBuilds: PvPBuild[] = [];
    for (const arch of pvpArchs) {
      const availWeapons = weaponsAvailableAtLevel(data.weapons, 20);
      const availArmors = armorsAvailableAtLevel(data.armors, 20);
      const gear = buildGearLoadout(arch, 20, data, availWeapons, availArmors);
      if (!gear) continue;
      const player = _makeCombatant(gear.profile, gear.weapon, arch.advClass, gear.armorRating, arch.className);
      const s1 = CLASS_SPELLS[arch.className];
      const s2 = useSpell2 ? CLASS_SPELLS_2[arch.className] : undefined;
      const extraWeapons: Weapon[] = [];
      if (gear.weapon2) extraWeapons.push(gear.weapon2);
      if (gear.weapon3) extraWeapons.push(gear.weapon3);
      const loadouts = buildCombatLoadouts(s1, s2, arch.statPath, !!gear.weapon2, !!gear.weapon3);
      pvpBuilds.push({ arch, player, extraWeapons, loadouts });
    }

    // Per-opponent loadout selection:
    // For each pair (a, b):
    //   1. Find a's best loadout vs b (b uses default: first loadout)
    //   2. Find b's best loadout vs a (a uses its best from step 1)
    //   3. Run final: a_best vs b_best
    const pvpWins: Record<string, Record<string, number>> = {};
    const pvpTotals: Record<string, { wins: number; total: number }> = {};
    const pvpLoadoutPicks: Record<string, Record<string, string>> = {}; // a -> b -> loadout name

    for (const a of pvpBuilds) {
      pvpWins[a.arch.id] = pvpWins[a.arch.id] || {};
      pvpLoadoutPicks[a.arch.id] = pvpLoadoutPicks[a.arch.id] || {};
      if (!pvpTotals[a.arch.id]) pvpTotals[a.arch.id] = { wins: 0, total: 0 };

      for (const b of pvpBuilds) {
        if (a.arch.id >= b.arch.id) continue;
        pvpWins[b.arch.id] = pvpWins[b.arch.id] || {};
        pvpLoadoutPicks[b.arch.id] = pvpLoadoutPicks[b.arch.id] || {};
        if (!pvpTotals[b.arch.id]) pvpTotals[b.arch.id] = { wins: 0, total: 0 };

        const bDefault = b.loadouts[0]; // b's default loadout

        // Helper: run N iterations, return wins for "side a"
        function runMatchup(
          aBuild: PvPBuild, bBuild: PvPBuild,
          aLoad: CombatLoadout, bLoad: CombatLoadout,
          iters: number,
        ): { wins: number; draws: number } {
          let wins = 0, draws = 0;
          for (let i = 0; i < iters; i++) {
            const p1First = i % 2 === 0;
            const res = p1First
              ? simulatePvP(aBuild.player, bBuild.player, aBuild.extraWeapons, bBuild.extraWeapons, aLoad, bLoad, data)
              : simulatePvP(bBuild.player, aBuild.player, bBuild.extraWeapons, aBuild.extraWeapons, bLoad, aLoad, data);
            if (res.draw) { draws++; continue; }
            if (p1First ? res.p1Wins : !res.p1Wins) wins++;
          }
          return { wins, draws };
        }

        // Step 1: find a's best loadout vs b
        let aBestLoadout = a.loadouts[0];
        let aBestWins = 0;
        for (const aL of a.loadouts) {
          const { wins } = runMatchup(a, b, aL, bDefault, PVP_ITERS);
          if (wins > aBestWins) { aBestWins = wins; aBestLoadout = aL; }
        }

        // Step 2: find b's best loadout vs a (using a's best)
        let bBestLoadout = b.loadouts[0];
        let bBestWins = 0;
        for (const bL of b.loadouts) {
          const { wins } = runMatchup(b, a, bL, aBestLoadout, PVP_ITERS);
          if (wins > bBestWins) { bBestWins = wins; bBestLoadout = bL; }
        }

        // Step 3: final matchup with both sides' best loadouts
        const final = runMatchup(a, b, aBestLoadout, bBestLoadout, PVP_FINAL_ITERS);
        const totalDecided = PVP_FINAL_ITERS - final.draws;

        const wr = totalDecided > 0 ? final.wins / totalDecided : 0.5; // win rate excluding draws
        const drawRate = final.draws / PVP_FINAL_ITERS;
        pvpWins[a.arch.id][b.arch.id] = wr;
        pvpWins[b.arch.id][a.arch.id] = totalDecided > 0 ? 1 - wr : 0.5;
        pvpLoadoutPicks[a.arch.id][b.arch.id] = aBestLoadout.name;
        pvpLoadoutPicks[b.arch.id][a.arch.id] = bBestLoadout.name;

        pvpTotals[a.arch.id].wins += final.wins;
        pvpTotals[a.arch.id].total += totalDecided;
        pvpTotals[b.arch.id].wins += (totalDecided - final.wins);
        pvpTotals[b.arch.id].total += totalDecided;

        // Track draw rate
        if (drawRate > 0.1) {
          console.log(`  [draw] ${a.arch.id} vs ${b.arch.id}: ${(drawRate * 100).toFixed(0)}% draws (${aBestLoadout.name} vs ${bBestLoadout.name})`);
        }
      }
    }

    // Print overall PvP win rates
    console.log("--- PVP OVERALL WIN RATES ---");
    const sortedPvP = Object.entries(pvpTotals)
      .map(([id, t]) => ({ id, winRate: t.total > 0 ? t.wins / t.total : 0.5 }))
      .sort((a, b) => b.winRate - a.winRate);

    for (const { id, winRate } of sortedPvP) {
      const arch = archetypes.find(a => a.id === id)!;
      const bar = winRate >= 0.6 ? "##" : winRate >= 0.5 ? "==" : winRate >= 0.4 ? "--" : "XX";
      console.log(`  ${id.padEnd(6)} ${bar} ${(winRate * 100).toFixed(1)}% (${arch.statPath.toUpperCase()} ${arch.className})`);
    }

    // Print path averages
    console.log("\n--- PVP PATH AVERAGES ---");
    for (const path of ["str", "agi", "int"] as const) {
      const pathRates = sortedPvP.filter(p => archetypes.find(a => a.id === p.id)!.statPath === path);
      if (pathRates.length === 0) continue;
      const avg = pathRates.reduce((a, b) => a + b.winRate, 0) / pathRates.length;
      console.log(`  ${path.toUpperCase()}: ${(avg * 100).toFixed(1)}% avg`);
    }

    // Loadout strategy preference: how often each strategy type was chosen
    console.log("\n--- LOADOUT STRATEGY PREFERENCE (% of matchups) ---");
    const strategyBuckets = {
      "2w+spell": ["2w+s1+pot", "2w+s2+pot", "2w+s1+buff"],
      "2w+2spell": ["2w+s1+s2"],
      "2w+pots": ["2w+2pot"],
      "2w+naked": ["2w+naked"],
      "1w+spell+pots": ["w1+s1+2pot", "w1+s2+2pot"],
      "1w+2spell": ["w1+2s+pot", "w1+2s+buff", "w1+s1+s2"],
      "1w+pots": ["w1+3pot"],
      "1w+naked": ["w1+naked"],
    };
    // Aggregate across all builds
    const globalStrategyCounts: Record<string, number> = {};
    let globalTotal = 0;
    // Per-build loadout frequency
    const buildLoadoutCounts: Record<string, Record<string, number>> = {};
    for (const build of pvpBuilds) {
      const id = build.arch.id;
      const picks = pvpLoadoutPicks[id] || {};
      buildLoadoutCounts[id] = {};
      for (const loadout of Object.values(picks)) {
        buildLoadoutCounts[id][loadout] = (buildLoadoutCounts[id][loadout] || 0) + 1;
        globalTotal++;
        // Find which strategy bucket
        for (const [strategy, names] of Object.entries(strategyBuckets)) {
          if (names.includes(loadout)) {
            globalStrategyCounts[strategy] = (globalStrategyCounts[strategy] || 0) + 1;
            break;
          }
        }
      }
    }
    const sortedStrategies = Object.entries(globalStrategyCounts).sort((a, b) => b[1] - a[1]);
    for (const [strat, count] of sortedStrategies) {
      console.log(`  ${strat.padEnd(18)} ${(count / globalTotal * 100).toFixed(1)}%  (${count}/${globalTotal})`);
    }

    // Per-build: show each build's most-chosen loadout
    console.log("\n--- PER-BUILD PREFERRED LOADOUT ---");
    for (const build of pvpBuilds) {
      const id = build.arch.id;
      const counts = buildLoadoutCounts[id] || {};
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const total = sorted.reduce((a, b) => a + b[1], 0);
      const top3 = sorted.slice(0, 3).map(([name, c]) => `${name}:${(c / total * 100).toFixed(0)}%`).join("  ");
      const arch = archetypes.find(a => a.id === id)!;
      console.log(`  ${id.padEnd(6)} ${arch.className.padEnd(10)} ${top3}`);
    }

    // Show each build's worst and best matchups + what loadout they picked
    console.log("\n--- PER-BUILD BEST/WORST MATCHUPS ---");
    for (const build of pvpBuilds) {
      const id = build.arch.id;
      const matchups = Object.entries(pvpWins[id] || {})
        .map(([opp, wr]) => ({ opp, wr }))
        .sort((a, b) => a.wr - b.wr);
      if (matchups.length === 0) continue;
      const worst = matchups[0];
      const best = matchups[matchups.length - 1];
      const worstLoadout = pvpLoadoutPicks[id]?.[worst.opp] || "?";
      const bestLoadout = pvpLoadoutPicks[id]?.[best.opp] || "?";
      console.log(`  ${id.padEnd(6)} worst: ${(worst.wr * 100).toFixed(0)}% vs ${worst.opp} (${worstLoadout})  best: ${(best.wr * 100).toFixed(0)}% vs ${best.opp} (${bestLoadout})`);
    }

    // Imbalanced matchups
    console.log("\n--- MOST IMBALANCED MATCHUPS (>75% or <25%) ---");
    let imbalancedCount = 0;
    for (const a of pvpBuilds) {
      for (const b of pvpBuilds) {
        if (a.arch.id >= b.arch.id) continue;
        const wr = pvpWins[a.arch.id]?.[b.arch.id];
        if (wr === undefined) continue;
        if (wr > 0.75) {
          console.log(`  ${a.arch.id} > ${b.arch.id}: ${(wr * 100).toFixed(0)}%`);
          imbalancedCount++;
        } else if (wr < 0.25) {
          console.log(`  ${b.arch.id} > ${a.arch.id}: ${((1 - wr) * 100).toFixed(0)}%`);
          imbalancedCount++;
        }
      }
    }
    if (imbalancedCount === 0) console.log("  None! All matchups within 25-75% range.");
  }

  // ============================================================
  //  ECONOMY SIM (--economy flag)
  //  Full gold flow model per archetype across Z2:
  //  - Gold income from kills + item vendor sales
  //  - Repair costs based on actual equipped gear value
  //  - Consumable costs by play mode (farming/progression/boss)
  //  - Net gold per level, per archetype
  //  - Aggregate inflation projections at configurable DAU
  //
  //  See docs/ECONOMY_TUNING_GUIDE.md for design rationale.
  // ============================================================
  if (args.has("--economy")) {
    const dauArg = process.argv.find(a => a.startsWith("--dau="))?.split("=")[1];
    const DAU = dauArg ? parseInt(dauArg) : ECONOMY.DEFAULT_DAU;

    console.log("\n\n=== ECONOMY SIM — Z2 GOLD FLOW MODEL ===");
    console.log(`  Repair rate: ${(ECONOMY.REPAIR_RATE * 100)}% | Durability loss: ${ECONOMY.DURABILITY_LOSS_PER_FIGHT}/fight | Cycle: ${ECONOMY.FIGHTS_PER_DURABILITY_CYCLE} fights`);
    console.log(`  DAU for inflation projections: ${DAU}`);

    // XP thresholds — L1-10 from MinimalPostDeploy.s.sol, L11-20 redesigned
    // Z2 curve: gentle linear ramp in fights-per-level (200→400 wins).
    // Target: ~60 hours of combat at 60 fights/hr with ~83% win rate.
    // Each level takes 4-8 hours — frequent enough to feel progress, slow enough to appreciate.
    const XP_THRESHOLDS: Record<number, number> = {
      1: 500, 2: 2000, 3: 5500, 4: 25000, 5: 85000,
      6: 200000, 7: 450000, 8: 900000, 9: 1600000, 10: 2500000,
      11: 2660000, 12: 2880000, 13: 3168000, 14: 3532000, 15: 3980000,
      16: 4520000, 17: 5160000, 18: 5930000, 19: 6880000, 20: 8480000,
    };

    // Use imported economy functions
    const avgGoldPerKill = _avgGoldPerKill;
    const avgVendorGoldPerFight = _avgVendorGoldPerFight;
    const repairCostPerFight = _repairCostPerFight;
    const consumableCostPerFight = _consumableCostPerFight;

    // Fights per level
    function fightsForLevel(level: number): number {
      const prev = XP_THRESHOLDS[level - 1] ?? 0;
      const cur = XP_THRESHOLDS[level] ?? 0;
      const xpNeeded = cur - prev;
      const monster = Z2_MONSTERS.find(m => m.level === level);
      return monster && monster.xp > 0 ? Math.ceil(xpNeeded / monster.xp) : 0;
    }

    const vendorPerFight = avgVendorGoldPerFight();

    // ── SECTION 1: PER-LEVEL ECONOMY (aggregate, median gear) ──
    console.log("\n--- PER-LEVEL GOLD FLOW (median gear, farming mode) ---");
    console.log("  Level | Fights | Kill Gold | Vendor | Consumable | Repair  | Net/Fight | Net/Level | Cumulative");
    let cumGold = 0;
    for (let level = 11; level <= 20; level++) {
      const fights = fightsForLevel(level);
      const killGold = avgGoldPerKill(level);

      // Estimate median gear value at this level (R1 early, R2 mid, R3 late)
      const gearRarity = level <= 13 ? 1 : level <= 16 ? 2 : 3;
      const weaponPrice = ECONOMY.VENDOR_PRICES[gearRarity] ?? 40;
      const armorPrice = (ECONOMY.VENDOR_PRICES[gearRarity] ?? 40) * 0.85; // armor slightly cheaper
      const repair = repairCostPerFight(weaponPrice, armorPrice);
      const potCost = consumableCostPerFight("farming");

      const netPerFight = killGold + vendorPerFight - potCost - repair;
      const netPerLevel = netPerFight * fights;
      cumGold += netPerLevel;

      console.log(`  L${String(level).padStart(2)}  | ${String(fights).padStart(6)} | ${killGold.toFixed(1).padStart(9)} | ${vendorPerFight.toFixed(2).padStart(6)} | ${potCost.toFixed(1).padStart(10)} | ${repair.toFixed(2).padStart(7)} | ${netPerFight.toFixed(1).padStart(9)} | ${netPerLevel.toFixed(0).padStart(9)} | ${cumGold.toFixed(0).padStart(10)}`);
    }
    const farmingCumGold = cumGold;
    console.log(`  TOTAL through Z2 (farming): ${cumGold >= 0 ? "+" : ""}${cumGold.toFixed(0)} Gold`);

    // ── SECTION 1b: PROGRESSION MODE ──
    console.log("\n--- PER-LEVEL GOLD FLOW (median gear, progression mode) ---");
    console.log("  Level | Fights | Kill Gold | Vendor | Consumable | Repair  | Net/Fight | Net/Level | Cumulative");
    cumGold = 0;
    for (let level = 11; level <= 20; level++) {
      const fights = fightsForLevel(level);
      const killGold = avgGoldPerKill(level);
      const gearRarity = level <= 13 ? 1 : level <= 16 ? 2 : 3;
      const weaponPrice = ECONOMY.VENDOR_PRICES[gearRarity] ?? 40;
      const armorPrice = (ECONOMY.VENDOR_PRICES[gearRarity] ?? 40) * 0.85;
      const repair = repairCostPerFight(weaponPrice, armorPrice);
      const potCost = consumableCostPerFight("progression");
      const netPerFight = killGold + vendorPerFight - potCost - repair;
      const netPerLevel = netPerFight * fights;
      cumGold += netPerLevel;
      console.log(`  L${String(level).padStart(2)}  | ${String(fights).padStart(6)} | ${killGold.toFixed(1).padStart(9)} | ${vendorPerFight.toFixed(2).padStart(6)} | ${potCost.toFixed(1).padStart(10)} | ${repair.toFixed(2).padStart(7)} | ${netPerFight.toFixed(1).padStart(9)} | ${netPerLevel.toFixed(0).padStart(9)} | ${cumGold.toFixed(0).padStart(10)}`);
    }
    console.log(`  TOTAL through Z2 (progression): ${cumGold >= 0 ? "+" : ""}${cumGold.toFixed(0)} Gold`);
    if (cumGold < 0) {
      console.log(`  ** Players in pure progression mode go NEGATIVE — must farm or sell drops to sustain **`);
    }

    // ── SECTION 2: PER-ARCHETYPE ECONOMY (using actual gear from buildGearLoadout) ──
    console.log("\n--- PER-ARCHETYPE REPAIR COST (actual equipped gear at L15 + L20) ---");
    console.log("  Arch   | Path | L15 Weapon           | Wpn$  | L15 Armor            | Arm$  | Repair/Fight | As % Income");
    for (const arch of archetypes) {
      if (filterArch && arch.id !== filterArch) continue;

      const avW15 = weaponsAvailableAtLevel(data.weapons, 15);
      const avA15 = armorsAvailableAtLevel(data.armors, 15);
      const gear15 = buildGearLoadout(arch, 15, data, avW15, avA15);
      if (!gear15) continue;

      const wpnPrice = gear15.weapon.price;
      const armPrice = gear15.armor?.price ?? 0;
      const repair = repairCostPerFight(wpnPrice, armPrice);
      const income = avgGoldPerKill(15) + vendorPerFight;
      const repairPct = income > 0 ? (repair / income) * 100 : 0;

      console.log(`  ${arch.id.padEnd(6)} | ${arch.statPath.toUpperCase().padEnd(4)} | ${gear15.weapon.name.padEnd(20)} | ${String(wpnPrice).padStart(5)} | ${(gear15.armor?.name ?? "none").padEnd(20)} | ${String(armPrice).padStart(5)} | ${repair.toFixed(2).padStart(12)} | ${repairPct.toFixed(1).padStart(6)}%`);
    }

    // ── SECTION 3: PURE vs HYBRID BUILD ECONOMICS ──
    console.log("\n--- PURE vs HYBRID REPAIR COMPARISON (L17, R3 gear) ---");
    console.log("  Build Type      | Weapon               | Wpn$  | Repair/Fight | Net Gold/Fight (farming)");

    // Find representative pure and hybrid weapons at R3
    const pureR3: Weapon[] = Z2_WEAPONS.filter(w => w.rarity === 3 && !w.name.includes("Hybrid"));
    const hybridR3: Weapon[] = Z2_WEAPONS.filter(w => w.name.includes("Hybrid"));

    for (const w of [...pureR3, ...hybridR3]) {
      const armorPrice = 140; // typical R3 armor
      const repair = repairCostPerFight(w.price, armorPrice);
      const income = avgGoldPerKill(17) + vendorPerFight;
      const potCost = consumableCostPerFight("farming");
      const net = income - potCost - repair;
      const label = w.name.includes("Hybrid") ? "Hybrid" : "Pure";
      console.log(`  ${(label + " " + w.name).padEnd(17).slice(0, 17)} | ${w.name.padEnd(20)} | ${String(w.price).padStart(5)} | ${repair.toFixed(2).padStart(12)} | ${net.toFixed(1).padStart(10)}`);
    }

    // ── SECTION 4: SINK BREAKDOWN ──
    console.log("\n--- GOLD SINK BREAKDOWN (per player per day, ~20 fights/hr, 2hr session) ---");
    const fightsPerDay = 40; // 20 fights/hr × 2hr casual session
    const avgLevel = 15;
    const avgGearValue = 300; // R2 weapon + armor total
    const dailyKillGold = fightsPerDay * avgGoldPerKill(avgLevel);
    const dailyVendorGold = fightsPerDay * vendorPerFight;
    const dailyGrossIncome = dailyKillGold + dailyVendorGold;
    const dailyRepairCost = fightsPerDay * repairCostPerFight(avgGearValue * 0.55, avgGearValue * 0.45);
    const dailyPotCost = fightsPerDay * consumableCostPerFight("farming");
    const dailyDeathBurn = dailyGrossIncome * ECONOMY.DEATH_RATE_NORMAL * ECONOMY.PVE_DEATH_BURN_PCT * 5; // 5x because burn is on wallet, not fight income
    const dailyFleeBurn = dailyGrossIncome * ECONOMY.FLEE_RATE_NORMAL * ECONOMY.PVE_FLEE_BURN_PCT * 3;

    console.log(`  Gross income:    ${dailyGrossIncome.toFixed(0).padStart(8)} Gold/day (kills: ${dailyKillGold.toFixed(0)}, vendor: ${dailyVendorGold.toFixed(1)})`);
    console.log(`  Repair cost:    -${dailyRepairCost.toFixed(1).padStart(8)} Gold/day (${(dailyRepairCost / dailyGrossIncome * 100).toFixed(1)}% of income)`);
    console.log(`  Consumables:    -${dailyPotCost.toFixed(0).padStart(8)} Gold/day (${(dailyPotCost / dailyGrossIncome * 100).toFixed(1)}% of income)`);
    console.log(`  Death burns:    -${dailyDeathBurn.toFixed(1).padStart(8)} Gold/day (${(dailyDeathBurn / dailyGrossIncome * 100).toFixed(1)}% of income)`);
    console.log(`  Flee burns:     -${dailyFleeBurn.toFixed(1).padStart(8)} Gold/day (${(dailyFleeBurn / dailyGrossIncome * 100).toFixed(1)}% of income)`);
    const totalDailySinks = dailyRepairCost + dailyPotCost + dailyDeathBurn + dailyFleeBurn;
    const dailyNet = dailyGrossIncome - totalDailySinks;
    const burnRate = totalDailySinks / dailyGrossIncome;
    console.log(`  ──────────────────────────────────────`);
    console.log(`  Total sinks:    -${totalDailySinks.toFixed(0).padStart(8)} Gold/day (${(burnRate * 100).toFixed(1)}% burn rate)`);
    console.log(`  Net per player:  ${dailyNet >= 0 ? "+" : ""}${dailyNet.toFixed(0).padStart(8)} Gold/day`);

    // ── SECTION 5: INFLATION PROJECTIONS ──
    console.log("\n--- INFLATION PROJECTIONS ---");
    console.log("  Scenario         | DAU  | Gross Gold/Day | Burned/Day | Net/Day    | Net/Year   | Reserve Runway");

    const scenarios = [
      { name: "Current", dau: 10 },
      { name: "Steady", dau: 50 },
      { name: "Moderate", dau: 150 },
      { name: "Strong", dau: 500 },
      { name: "Breakout", dau: 1500 },
    ];
    if (!scenarios.some(s => s.dau === DAU)) {
      scenarios.push({ name: "Custom", dau: DAU });
      scenarios.sort((a, b) => a.dau - b.dau);
    }

    const companyReserve = 20_000_000;
    for (const { name, dau } of scenarios) {
      const grossPerDay = dau * dailyGrossIncome;
      const burnedPerDay = grossPerDay * burnRate;
      const netPerDay = grossPerDay - burnedPerDay;
      const netPerYear = netPerDay * 365;
      const runwayYears = netPerDay > 0 ? companyReserve / (netPerDay * 365) : Infinity;
      const runwayStr = runwayYears > 10 ? ">10 yrs" : runwayYears > 1 ? `~${runwayYears.toFixed(1)} yrs` : `~${(runwayYears * 12).toFixed(0)} mo`;

      console.log(`  ${name.padEnd(18)} | ${String(dau).padStart(4)} | ${grossPerDay.toFixed(0).padStart(14)} | ${burnedPerDay.toFixed(0).padStart(10)} | ${netPerDay.toFixed(0).padStart(10)} | ${netPerYear.toFixed(0).padStart(10)} | ${runwayStr}`);
    }

    // ── SECTION 6: SINK COVERAGE SENSITIVITY ──
    console.log("\n--- SINK COVERAGE SENSITIVITY (at " + DAU + " DAU) ---");
    console.log("  Burn Rate | Net Gold/Day | Net/Year    | Reserve Runway | Assessment");
    const grossAtDau = DAU * dailyGrossIncome;
    for (const targetBurn of [0.09, 0.20, 0.31, 0.40, 0.50, 0.65, 0.80]) {
      const burned = grossAtDau * targetBurn;
      const net = grossAtDau - burned;
      const netYr = net * 365;
      const runway = net > 0 ? companyReserve / netYr : Infinity;
      const runwayStr = runway > 10 ? ">10 yrs" : runway > 1 ? `~${runway.toFixed(1)} yrs` : `~${(runway * 12).toFixed(0)} mo`;
      const assessment =
        targetBurn < 0.15 ? "DANGEROUS — highly inflationary" :
        targetBurn < 0.30 ? "Weak — acceptable during growth only" :
        targetBurn < 0.50 ? "Healthy — sustainable with growth" :
        targetBurn < 0.70 ? "Strong — economy self-sustains" :
        "Deflationary — risk of player frustration";

      console.log(`  ${(targetBurn * 100).toFixed(0).padStart(5)}%     | ${net.toFixed(0).padStart(12)} | ${netYr.toFixed(0).padStart(11)} | ${runwayStr.padStart(14)} | ${assessment}`);
    }

    // ── SECTION 7: REPAIR RATE SENSITIVITY ──
    console.log("\n--- REPAIR RATE SENSITIVITY (farming mode, L15 R2 gear) ---");
    console.log("  Rate  | Repair/Fight | As % Income | Net/Fight | Daily Net (40 fights) | Feel");
    const l15Income = avgGoldPerKill(15) + vendorPerFight;
    const l15PotCost = consumableCostPerFight("farming");
    for (const rate of [0.04, 0.06, 0.08, 0.10, 0.12, 0.15]) {
      const r2WeaponPrice = 150;
      const r2ArmorPrice = 130;
      const durLoss = ECONOMY.DURABILITY_LOSS_PER_FIGHT / ECONOMY.DURABILITY_MAX;
      const repair = (r2WeaponPrice + r2ArmorPrice) * rate * durLoss;
      const pctIncome = (repair / l15Income) * 100;
      const netFight = l15Income - l15PotCost - repair;
      const dailyNet = netFight * 40;
      const feel =
        pctIncome < 2 ? "Invisible" :
        pctIncome < 5 ? "Noticed, accepted" :
        pctIncome < 10 ? "Felt, tolerable" :
        pctIncome < 15 ? "Uncomfortable" :
        "Punishing";
      console.log(`  ${(rate * 100).toFixed(0).padStart(3)}%  | ${repair.toFixed(2).padStart(12)} | ${pctIncome.toFixed(1).padStart(7)}%    | ${netFight.toFixed(1).padStart(9)} | ${dailyNet.toFixed(0).padStart(12)}          | ${feel}`);
    }

    // ── SECTION 8: MARKETPLACE INCOME FROM RARE DROPS ──
    // R3+ items sell on the marketplace at a multiple of base price.
    // Income per player = (drop rate × sell rate × marketplace price × (1 - fee)) / fights
    console.log("\n--- MARKETPLACE INCOME FROM RARE DROPS (per player per day, 40 fights) ---");
    console.log("  Rarity    | Drop/Fight  | Sell Rate | Mkt Price | Net to Seller | Gold/Day (40f) | % of Kill Income");

    let totalMarketplaceGoldPerDay = 0;
    for (const rarity of [3, 4]) {
      const dropChance = ECONOMY.DROP_RATES[rarity] / 100000;
      const sellRate = ECONOMY.MARKETPLACE_SELL_RATE[rarity] ?? 0;
      const basePrice = ECONOMY.VENDOR_PRICES[rarity] ?? 0;
      const mktMult = ECONOMY.MARKETPLACE_PRICE_MULT[rarity] ?? 1;
      const mktPrice = basePrice * mktMult;
      const netToSeller = mktPrice * (1 - ECONOMY.MARKETPLACE_FEE);
      // Per-fight expected income from marketplace sales at this rarity
      const perFightIncome = dropChance * sellRate * netToSeller;
      const perDayIncome = perFightIncome * fightsPerDay;
      const pctOfKillIncome = dailyKillGold > 0 ? (perDayIncome / dailyKillGold) * 100 : 0;
      totalMarketplaceGoldPerDay += perDayIncome;

      const rarityName = rarity === 3 ? "R3 Rare" : "R4 Epic";
      console.log(`  ${rarityName.padEnd(11)} | ${(dropChance * 100).toFixed(4).padStart(8)}%  | ${(sellRate * 100).toFixed(0).padStart(5)}%    | ${mktPrice.toFixed(0).padStart(9)} | ${netToSeller.toFixed(0).padStart(13)} | ${perDayIncome.toFixed(2).padStart(14)} | ${pctOfKillIncome.toFixed(2).padStart(9)}%`);
    }
    console.log(`  Total marketplace income: ${totalMarketplaceGoldPerDay.toFixed(2)} Gold/day (${(totalMarketplaceGoldPerDay / dailyKillGold * 100).toFixed(2)}% of kill income)`);
    console.log(`  Note: This is EXPECTED VALUE — most days a player gets 0 rare drops. Variance is very high.`);

    // ── SECTION 9: SPECULATIVE HOLDER ABSORPTION ──
    console.log("\n--- SPECULATIVE HOLDER ABSORPTION ---");
    if (ECONOMY.SPECULATIVE_ABSORPTION_RATE <= 0) {
      console.log(`  Rate: 0% (disabled — waiting for real data)`);
      console.log(`  When enabled: models % of marketplace-listed R3+ items bought by non-playing holders.`);
      console.log(`  Effect: reduces active item supply, supports marketplace prices, generates fees.`);
    } else {
      const absRate = ECONOMY.SPECULATIVE_ABSORPTION_RATE;
      console.log(`  Absorption rate: ${(absRate * 100).toFixed(0)}% of R3+ marketplace listings bought by non-players`);
      for (const rarity of [3, 4]) {
        const dropChance = ECONOMY.DROP_RATES[rarity] / 100000;
        const sellRate = ECONOMY.MARKETPLACE_SELL_RATE[rarity] ?? 0;
        const listingsPerDay = dropChance * sellRate * fightsPerDay * DAU;
        const absorbed = listingsPerDay * absRate;
        const rarityName = rarity === 3 ? "R3 Rare" : "R4 Epic";
        console.log(`  ${rarityName}: ${listingsPerDay.toFixed(2)} listings/day × ${(absRate * 100).toFixed(0)}% = ${absorbed.toFixed(2)} items/day removed from active supply`);
      }
    }

    // ── SECTION 10: GUILD ECONOMIC SINKS ──
    console.log("\n--- GUILD ECONOMIC SINKS (tax model) ---");
    const guildedPlayers = DAU * ECONOMY.GUILD_PARTICIPATION_RATE;
    const numGuilds = Math.max(1, Math.floor(guildedPlayers / ECONOMY.AVG_GUILD_SIZE));
    const guildTaxPerDay = _guildTaxPerMemberPerDay(avgLevel, fightsPerDay);
    const repairSavings = _guildRepairSavingsPerDay(fightsPerDay, avgGearValue * 0.55, avgGearValue * 0.45);
    const netGuildCost = _netGuildCostPerMemberPerDay(avgLevel, fightsPerDay, avgGearValue * 0.55, avgGearValue * 0.45);
    const totalGuildSinkPerDay = _totalGuildSinkPerDay(DAU, avgLevel, fightsPerDay);

    console.log(`  Guild participation: ${(ECONOMY.GUILD_PARTICIPATION_RATE * 100).toFixed(0)}% of ${DAU} DAU = ${guildedPlayers.toFixed(0)} guilded players`);
    console.log(`  Guilds: ~${numGuilds} (avg ${ECONOMY.AVG_GUILD_SIZE} members)`);
    console.log(`  Tax rate: ${(ECONOMY.GUILD_TAX_RATE * 100).toFixed(0)}% of PvE kill gold → treasury`);
    console.log(`  Tax per member: ${guildTaxPerDay.toFixed(1)} Gold/day (${(guildTaxPerDay / dailyGrossIncome * 100).toFixed(1)}% of gross income)`);
    console.log(`  Free repairs perk: -${repairSavings.toFixed(1)} Gold/day saved per member`);
    console.log(`  Net cost to member: ${netGuildCost.toFixed(1)} Gold/day (tax - repair savings)`);
    console.log(`  Treasury burn rate: ${(ECONOMY.GUILD_TREASURY_BURN_RATE * 100).toFixed(0)}% (wars, territory, buffs)`);
    console.log(`  Total gold burned (all guilds): ${totalGuildSinkPerDay.toFixed(0)} Gold/day`);
    console.log(`  Guild creation (amortized): ${(numGuilds * ECONOMY.GUILD_CREATION_COST / 30).toFixed(0)} Gold/day`);

    // ── UPDATED SINK SUMMARY ──
    console.log("\n--- COMPLETE SINK SUMMARY (with all sources) ---");
    const totalDailySinksWithGuilds = totalDailySinks * DAU + totalGuildSinkPerDay;
    const guildUpkeepPerPlayerPerDay = guildTaxPerDay; // for health check compatibility
    const totalDailyGross = dailyGrossIncome * DAU;
    const totalDailyMarketplace = totalMarketplaceGoldPerDay * DAU;
    const marketplaceFeesBurned = totalDailyMarketplace * ECONOMY.MARKETPLACE_FEE / (1 - ECONOMY.MARKETPLACE_FEE); // fee is on top
    const completeBurnRate = (totalDailySinksWithGuilds + marketplaceFeesBurned) / totalDailyGross;

    console.log(`  Gross gold generated (${DAU} DAU):  ${totalDailyGross.toFixed(0)} Gold/day`);
    console.log(`  Sinks:`);
    console.log(`    Repairs:              ${(dailyRepairCost * DAU).toFixed(0).padStart(10)} Gold/day`);
    console.log(`    Consumables:          ${(dailyPotCost * DAU).toFixed(0).padStart(10)} Gold/day`);
    console.log(`    Death/flee burns:     ${((dailyDeathBurn + dailyFleeBurn) * DAU).toFixed(0).padStart(10)} Gold/day`);
    console.log(`    Guild treasury burn:  ${totalGuildSinkPerDay.toFixed(0).padStart(10)} Gold/day`);
    console.log(`    Marketplace fees:     ${marketplaceFeesBurned.toFixed(0).padStart(10)} Gold/day`);
    console.log(`  ──────────────────────────────────────`);
    console.log(`  Total burned:           ${(totalDailySinksWithGuilds + marketplaceFeesBurned).toFixed(0).padStart(10)} Gold/day`);
    console.log(`  Complete burn rate:      ${(completeBurnRate * 100).toFixed(1)}%`);
    console.log(`  Net inflation:           ${(totalDailyGross - totalDailySinksWithGuilds - marketplaceFeesBurned).toFixed(0).padStart(10)} Gold/day`);

    // Health check summary
    console.log("\n--- ECONOMY HEALTH CHECK ---");
    const farmingNet = avgGoldPerKill(15) + vendorPerFight - consumableCostPerFight("farming") - repairCostPerFight(150, 130);
    const progressionNet = avgGoldPerKill(15) + vendorPerFight - consumableCostPerFight("progression") - repairCostPerFight(150, 130);
    const bossNet = avgGoldPerKill(20) + vendorPerFight - consumableCostPerFight("boss") - repairCostPerFight(300, 280);

    const checks = [
      { name: "Farming profitable (L15 R2)", value: farmingNet, pass: farmingNet > 0 },
      { name: "Progression negative (L15 R2)", value: progressionNet, pass: progressionNet < 0 },
      { name: "Boss expensive (L20 R4)", value: bossNet, pass: bossNet < -50 },
      { name: "Repair < 10% income (R2 farming)", value: repairCostPerFight(150, 130) / (avgGoldPerKill(15) + vendorPerFight) * 100, pass: repairCostPerFight(150, 130) / (avgGoldPerKill(15) + vendorPerFight) < 0.10 },
      { name: "Per-player burn rate > 15%", value: burnRate * 100, pass: burnRate > 0.15 },
      { name: "Complete burn rate > 20% (w/ guilds+fees)", value: completeBurnRate * 100, pass: completeBurnRate > 0.20 },
      { name: "Cumulative Z2 positive (farming)", value: farmingCumGold, pass: farmingCumGold > 0 },
      { name: "Guild upkeep < 10% of member income", value: (guildUpkeepPerPlayerPerDay / (dailyGrossIncome)) * 100, pass: guildUpkeepPerPlayerPerDay < dailyGrossIncome * 0.10 },
    ];

    for (const c of checks) {
      const status = c.pass ? "PASS" : "FAIL";
      const val = typeof c.value === "number" ? c.value.toFixed(1) : c.value;
      console.log(`  [${status}] ${c.name}: ${val}`);
    }
  }

  // ============================================================
  //  EQUIP AUDIT (--equip-audit flag)
  //  Shows per-archetype off-path stat cost to equip each gear tier.
  //  Exposes the imbalance: STR pays more than AGI/INT for equivalent tier.
  // ============================================================
  if (args.has("--equip-audit")) {
    const lc = data.levelingConstants;
    const cmb = cc.classMultiplierBase;

    function offPathCost(item: { minStr: number; minAgi: number; minInt: number }, profile: StatProfile): number {
      return Math.max(0, item.minStr - profile.str)
           + Math.max(0, item.minAgi - profile.agi)
           + Math.max(0, item.minInt - profile.int);
    }

    function offPathBreakdown(item: { minStr: number; minAgi: number; minInt: number }, profile: StatProfile): string {
      const parts: string[] = [];
      const sGap = Math.max(0, item.minStr - profile.str);
      const aGap = Math.max(0, item.minAgi - profile.agi);
      const iGap = Math.max(0, item.minInt - profile.int);
      if (sGap > 0) parts.push(`${sGap}S`);
      if (aGap > 0) parts.push(`${aGap}A`);
      if (iGap > 0) parts.push(`${iGap}I`);
      return parts.length > 0 ? parts.join("+") : "free";
    }

    // Best weapon for a path at a given rarity, from a weapon pool
    function bestWeaponForPath(pool: Weapon[], path: "str" | "agi" | "int", rarity: number): Weapon | undefined {
      return pool
        .filter(w => {
          if (w.rarity !== rarity) return false;
          if (path === "str") return w.scaling === "str" && !w.isMagic;
          if (path === "agi") return w.scaling === "agi" && !w.isMagic;
          return w.isMagic;
        })
        .sort((a, b) => (b.minDamage + b.maxDamage) - (a.minDamage + a.maxDamage))[0];
    }

    // Best armor for a path at a given rarity
    function bestArmorForPath(pool: Armor[], path: "str" | "agi" | "int", rarity: number): Armor | undefined {
      return pool
        .filter(a => {
          if (a.rarity !== rarity) return false;
          if (path === "str") return a.armorType === "Plate";
          if (path === "agi") return a.armorType === "Leather";
          return a.armorType === "Cloth";
        })
        .sort((a, b) => b.armorValue - a.armorValue)[0];
    }

    // ── SECTION 1: Z1 gear (levels 1-10) — all 27 archetypes at L10 ──
    // Always audit V4 weapons + armor with secondary reqs (the deploy target)
    const z1Weapons: Weapon[] = [...WEAPONS_V4];
    const z1Armors: Armor[] = [...ARMORS_WITH_SECONDARY_REQS];

    console.log("\n\n=== EQUIP AUDIT: Z1 OFF-PATH COST AT L10 (V4 GEAR) ===");
    console.log("Pure-path stats (all level points to primary). Cost = off-path points to equip.\n");

    // Compact per-rarity summary
    console.log("--- PER-PATH R3 COST (representative builds) ---");
    console.log("  Path | Archetype | STR  AGI  INT | Best R3 Weapon       | Wpn Cost     | Best R3 Armor        | Arm Cost     | TOTAL");

    const repArchIds = ["WAR-S", "PAL-S", "RAN-A", "ROG-A", "WIZ-I", "WLK-I", "CLR-S", "DRU-S", "SOR-S"];
    for (const archId of repArchIds) {
      const arch = archetypes.find(a => a.id === archId);
      if (!arch) continue;
      if (filterArch && arch.id !== filterArch) continue;

      const profile = _buildProfile(arch, 10, lc, cmb);
      const path = arch.statPath;

      const bestWpn = bestWeaponForPath(z1Weapons, path, 3);
      const bestArm = bestArmorForPath(z1Armors, path, 3);

      if (!bestWpn || !bestArm) continue;

      const wpnCost = offPathCost(bestWpn, profile);
      const armCost = offPathCost(bestArm, profile);
      const wpnBd = offPathBreakdown(bestWpn, profile);
      const armBd = offPathBreakdown(bestArm, profile);

      console.log(`  ${path.toUpperCase().padEnd(4)} | ${archId.padEnd(9)} | ${String(profile.str).padStart(3)}  ${String(profile.agi).padStart(3)}  ${String(profile.int).padStart(3)} | ${bestWpn.name.padEnd(20)} | ${String(wpnCost).padStart(2)} (${wpnBd.padEnd(8)}) | ${bestArm.name.padEnd(20)} | ${String(armCost).padStart(2)} (${armBd.padEnd(8)}) | ${wpnCost + armCost}`);
    }

    // ── SECTION 2: All 27 archetypes full table ──
    console.log("\n--- ALL ARCHETYPES: OFF-PATH COST BY RARITY AT L10 ---");
    console.log("  Arch   | Path | STR  AGI  INT |  R1w  R2w  R3w |  R1a  R2a  R3a | Wpn+Arm@R3");

    // Collect path averages
    const pathR3Totals: Record<string, number[]> = { str: [], agi: [], int: [] };

    for (const arch of archetypes) {
      if (filterArch && arch.id !== filterArch) continue;

      const profile = _buildProfile(arch, 10, lc, cmb);
      const path = arch.statPath;

      // Best weapon per rarity
      const wpnCosts: number[] = [];
      for (let r = 1; r <= 3; r++) {
        const w = bestWeaponForPath(z1Weapons, path, r);
        wpnCosts.push(w ? offPathCost(w, profile) : -1);
      }

      // Best armor per rarity
      const armCosts: number[] = [];
      for (let r = 1; r <= 3; r++) {
        const a = bestArmorForPath(z1Armors, path, r);
        armCosts.push(a ? offPathCost(a, profile) : -1);
      }

      const r3Total = (wpnCosts[2] >= 0 ? wpnCosts[2] : 0) + (armCosts[2] >= 0 ? armCosts[2] : 0);
      pathR3Totals[path].push(r3Total);

      const fmtCost = (c: number) => c < 0 ? "  -" : String(c).padStart(3);

      console.log(`  ${arch.id.padEnd(6)} | ${path.toUpperCase().padEnd(4)} | ${String(profile.str).padStart(3)}  ${String(profile.agi).padStart(3)}  ${String(profile.int).padStart(3)} | ${wpnCosts.map(fmtCost).join("  ")} | ${armCosts.map(fmtCost).join("  ")} | ${String(r3Total).padStart(5)}`);
    }

    // Path averages
    console.log("\n--- PATH AVERAGE R3 OFF-PATH COST ---");
    for (const path of ["str", "agi", "int"] as const) {
      const costs = pathR3Totals[path];
      if (costs.length === 0) continue;
      const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
      const min = Math.min(...costs);
      const max = Math.max(...costs);
      console.log(`  ${path.toUpperCase()}: avg ${avg.toFixed(1)} (${min}-${max})`);
    }

    // ── SECTION 3: Detailed weapon/armor breakdown for each path ──
    console.log("\n--- DETAILED WEAPON REQUIREMENTS (V4, path-matching only) ---");
    for (const path of ["str", "agi", "int"] as const) {
      // Pick canonical archetype for this path
      const canonId = path === "str" ? "WAR-S" : path === "agi" ? "RAN-A" : "WIZ-I";
      const arch = archetypes.find(a => a.id === canonId)!;
      const profile = _buildProfile(arch, 10, lc, cmb);

      console.log(`\n  ${path.toUpperCase()} path (${canonId}): STR=${profile.str} AGI=${profile.agi} INT=${profile.int}`);
      console.log("    Weapons:");

      const pathWeapons = z1Weapons.filter(w => {
        if (path === "str") return w.scaling === "str" && !w.isMagic;
        if (path === "agi") return w.scaling === "agi" && !w.isMagic;
        return w.isMagic;
      }).sort((a, b) => a.rarity - b.rarity || (b.minDamage + b.maxDamage) - (a.minDamage + a.maxDamage));

      for (const w of pathWeapons) {
        const cost = offPathCost(w, profile);
        const bd = offPathBreakdown(w, profile);
        const tag = cost === 0 ? "" : ` ** ${bd}`;
        console.log(`      R${w.rarity} ${w.name.padEnd(20)} ${String(w.minDamage)}-${String(w.maxDamage)} dmg | req S${String(w.minStr).padStart(2)} A${String(w.minAgi).padStart(2)} I${String(w.minInt).padStart(2)} | cost ${cost}${tag}`);
      }

      console.log("    Armor:");
      const pathArmors = z1Armors.filter(a => {
        if (path === "str") return a.armorType === "Plate";
        if (path === "agi") return a.armorType === "Leather";
        return a.armorType === "Cloth";
      }).sort((a, b) => a.rarity - b.rarity || b.armorValue - a.armorValue);

      for (const a of pathArmors) {
        const cost = offPathCost(a, profile);
        const bd = offPathBreakdown(a, profile);
        const tag = cost === 0 ? "" : ` ** ${bd}`;
        console.log(`      R${a.rarity} ${a.name.padEnd(22)} ARM${String(a.armorValue).padStart(2)} | req S${String(a.minStr).padStart(2)} A${String(a.minAgi).padStart(2)} I${String(a.minInt).padStart(2)} | cost ${cost}${tag}`);
      }
    }

    // ── SECTION 4: Level-by-level progression (when R3 becomes equippable) ──
    console.log("\n--- LEVEL WHEN R3 BECOMES EQUIPPABLE (0 off-path) ---");
    console.log("  Shows earliest level where the build can equip R3 weapon/armor without any off-path investment.");

    for (const path of ["str", "agi", "int"] as const) {
      const canonId = path === "str" ? "WAR-S" : path === "agi" ? "RAN-A" : "WIZ-I";
      const arch = archetypes.find(a => a.id === canonId)!;

      const bestR3Wpn = bestWeaponForPath(z1Weapons, path, 3);
      const bestR3Arm = bestArmorForPath(z1Armors, path, 3);

      let wpnLevel = "never (Z1)";
      let armLevel = "never (Z1)";

      if (bestR3Wpn) {
        for (let l = 1; l <= 20; l++) {
          const p = _buildProfile(arch, l, lc, cmb);
          if (offPathCost(bestR3Wpn, p) === 0) { wpnLevel = `L${l}`; break; }
        }
      }
      if (bestR3Arm) {
        for (let l = 1; l <= 20; l++) {
          const p = _buildProfile(arch, l, lc, cmb);
          if (offPathCost(bestR3Arm, p) === 0) { armLevel = `L${l}`; break; }
        }
      }

      console.log(`  ${path.toUpperCase()} (${canonId}): weapon=${bestR3Wpn?.name ?? "none"} @ ${wpnLevel}, armor=${bestR3Arm?.name ?? "none"} @ ${armLevel}`);
    }

    // ── SECTION 5: Z2 gear audit (L11-20) ──
    console.log("\n\n=== EQUIP AUDIT: Z2 OFF-PATH COST (L11-20) ===");
    console.log("  Arch   | Path | L12 stats       | Z2-R1w | Z2-R2w | Z2-R3w | Z2-R1a | Z2-R2a | Z2-R3a | R3 Total");

    const z2Weapons = Z2_WEAPONS;
    const z2Armors = Z2_ARMORS;

    const z2PathR3: Record<string, number[]> = { str: [], agi: [], int: [] };

    for (const arch of archetypes) {
      if (filterArch && arch.id !== filterArch) continue;

      // Use L15 stats (mid-zone, when R2 gear drops)
      const profile = _buildProfile(arch, 15, lc, cmb);
      const path = arch.statPath;

      const wpnCosts: number[] = [];
      for (let r = 1; r <= 3; r++) {
        const w = bestWeaponForPath(z2Weapons, path, r);
        wpnCosts.push(w ? offPathCost(w, profile) : -1);
      }

      const armCosts: number[] = [];
      for (let r = 1; r <= 3; r++) {
        const a = bestArmorForPath(z2Armors, path, r);
        armCosts.push(a ? offPathCost(a, profile) : -1);
      }

      const r3Total = (wpnCosts[2] >= 0 ? wpnCosts[2] : 0) + (armCosts[2] >= 0 ? armCosts[2] : 0);
      z2PathR3[path].push(r3Total);

      const fmtCost = (c: number) => c < 0 ? "   -" : String(c).padStart(4);

      console.log(`  ${arch.id.padEnd(6)} | ${path.toUpperCase().padEnd(4)} | ${String(profile.str).padStart(3)}/${String(profile.agi).padStart(3)}/${String(profile.int).padStart(3)} HP${String(profile.hp).padStart(3)} | ${wpnCosts.map(fmtCost).join("  |")} | ${armCosts.map(fmtCost).join("  |")} | ${String(r3Total).padStart(5)}`);
    }

    console.log("\n--- Z2 PATH AVERAGE R3 OFF-PATH COST (at L15) ---");
    for (const path of ["str", "agi", "int"] as const) {
      const costs = z2PathR3[path];
      if (costs.length === 0) continue;
      const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
      const min = Math.min(...costs);
      const max = Math.max(...costs);
      console.log(`  ${path.toUpperCase()}: avg ${avg.toFixed(1)} (${min}-${max})`);
    }
    console.log("\n  Note: Z2 pure weapons have primary-stat-only reqs. Off-path cost = 0 for pure builds.");
    console.log("  Hybrid weapons intentionally cost off-path (that's the marketplace driver).");
  }

  // ============================================================
  //  GEAR MAP (--gear-map flag)
  //  The player's actual decision tree at each level.
  //  For each build: what are your stats if you pump primary?
  //  What does 1 point in each off-path stat unlock?
  //  Is the unlock worth the primary stat you gave up?
  // ============================================================
  if (args.has("--gear-map")) {
    const lc = data.levelingConstants;
    const cmb = cc.classMultiplierBase;

    // Use V4 weapons + armor with secondary reqs (deploy target)
    const allWeapons: Weapon[] = [...WEAPONS_V4, ...Z2_WEAPONS];
    const allArmors: Armor[] = [...ARMORS_WITH_SECONDARY_REQS, ...Z2_ARMORS];

    function itemsUnlocked(
      pool: { name: string; minStr: number; minAgi: number; minInt: number; rarity: number }[],
      stats: { str: number; agi: number; int: number },
    ): typeof pool {
      return pool.filter(
        i => stats.str >= i.minStr && stats.agi >= i.minAgi && stats.int >= i.minInt,
      );
    }

    function newUnlocks(
      pool: { name: string; minStr: number; minAgi: number; minInt: number; rarity: number }[],
      before: { str: number; agi: number; int: number },
      after: { str: number; agi: number; int: number },
    ): typeof pool {
      const beforeSet = new Set(itemsUnlocked(pool, before).map(i => i.name));
      return itemsUnlocked(pool, after).filter(i => !beforeSet.has(i.name));
    }

    // Representative archetypes — one per path with the "hardest" secondary stats
    // (lowest off-path stats = most constrained = worst case for gear access)
    // Build rep list: all 27 archetypes (or filtered by --arch)
    const archFilter = filterArch;
    let reps: { archId: string; label: string }[] = [];
    for (const arch of archetypes) {
      if (archFilter && arch.id !== archFilter) continue;
      const base = arch.baseRoll;
      const r = arch.race;
      const sa = arch.startingArmor;
      reps.push({
        archId: arch.id,
        label: `${arch.statPath.toUpperCase()} (${arch.race.name} ${arch.className} — STR=${base.str+r.str+sa.str}, AGI=${base.agi+r.agi+sa.agi}, INT=${base.int+r.int+sa.int})`,
      });
    }
    const levelMin = 1;
    const levelMax = filterLevel ? parseInt(filterLevel) : 10;

    console.log("\n\n=== GEAR MAP: PLAYER DECISION TREE PER LEVEL ===");
    console.log("At each level: what does putting your point in STR/AGI/INT unlock?");
    console.log("Shows NEW items that become equippable with that 1-point investment.\n");

    for (const { archId, label } of reps) {
      const arch = archetypes.find(a => a.id === archId);
      if (!arch) continue;
      if (archFilter && arch.id !== archFilter) continue;

      console.log(`\n${"=".repeat(70)}`);
      console.log(`  ${label}`);
      console.log(`  Base (before any levels): STR=${arch.baseRoll.str + arch.race.str + arch.startingArmor.str} AGI=${arch.baseRoll.agi + arch.race.agi + arch.startingArmor.agi} INT=${arch.baseRoll.int + arch.race.int + arch.startingArmor.int}`);
      console.log(`${"=".repeat(70)}`);

      // Track cumulative stats assuming pure-primary allocation
      let pureStr = arch.baseRoll.str + arch.race.str + arch.startingArmor.str;
      let pureAgi = arch.baseRoll.agi + arch.race.agi + arch.startingArmor.agi;
      let pureInt = arch.baseRoll.int + arch.race.int + arch.startingArmor.int;
      let pureHp = lc.baseHp + arch.race.hp + arch.startingArmor.hp;

      // Track what was equippable last level to show deltas
      let prevPureStats = { str: pureStr, agi: pureAgi, int: pureInt };

      for (let level = levelMin; level <= levelMax; level++) {
        // Add HP for this level
        pureHp += hpForLevel(level, lc);

        // Add stat point for this level (pure = all to primary)
        const sp = statPointsForLevel(level, lc);
        if (sp > 0) {
          if (arch.statPath === "str") pureStr += sp;
          else if (arch.statPath === "agi") pureAgi += sp;
          else pureInt += sp;
        }

        // Power source bonus at L5
        if (level === lc.powerSourceBonusLevel) {
          if (arch.powerSource.type === "weave") pureInt += 1;
          else if (arch.powerSource.type === "divine") pureHp += 2;
          // physical: player choice — model as +1 to primary for pure build
          else if (arch.powerSource.type === "physical") {
            if (arch.statPath === "str") pureStr += 1;
            else if (arch.statPath === "agi") pureAgi += 1;
            // physical STR/AGI choice — for pure build, goes to primary
          }
        }

        // Advanced class bonuses at L10
        if (level === 10) {
          pureStr += arch.advClass.flatStr;
          pureAgi += arch.advClass.flatAgi;
          pureInt += arch.advClass.flatInt;
          pureHp += arch.advClass.flatHp;
        }

        const pureStats = { str: pureStr, agi: pureAgi, int: pureInt };

        // What's equippable with pure allocation?
        const pureWeapons = itemsUnlocked(allWeapons, pureStats);
        const pureArmors = itemsUnlocked(allArmors, pureStats);

        // What's NEW this level (pure path)?
        const newPureWeapons = newUnlocks(allWeapons, prevPureStats, pureStats);
        const newPureArmors = newUnlocks(allArmors, prevPureStats, pureStats);

        // What would 1 point in each OFF-PATH stat unlock instead?
        const offPathOptions: { stat: string; newWeapons: typeof allWeapons; newArmors: typeof allArmors }[] = [];

        for (const offStat of ["str", "agi", "int"] as const) {
          if (offStat === arch.statPath && sp > 0) continue; // skip primary — that's the pure path

          // Simulate: instead of putting this level's point in primary, put it in offStat
          // Only relevant if we got a stat point this level
          if (sp <= 0) continue;

          const altStats = { ...pureStats };
          // Remove the point from primary, add to off-path
          altStats[arch.statPath] -= sp;
          altStats[offStat] += sp;

          const altNewWeapons = newUnlocks(allWeapons, pureStats, altStats);
          const altNewArmors = newUnlocks(allArmors, pureStats, altStats);

          if (altNewWeapons.length > 0 || altNewArmors.length > 0) {
            offPathOptions.push({ stat: offStat.toUpperCase(), newWeapons: altNewWeapons, newArmors: altNewArmors });
          }
        }

        // Only print levels where something interesting happens
        const hasNewPure = newPureWeapons.length > 0 || newPureArmors.length > 0;
        const hasOffPath = offPathOptions.length > 0;
        const isKeyLevel = level === 1 || level === 5 || level === 10 || hasNewPure || hasOffPath;

        if (!isKeyLevel && !filterLevel) {
          prevPureStats = { ...pureStats };
          continue;
        }

        const totalEquippable = pureWeapons.length + pureArmors.length;
        console.log(`\n  L${String(level).padStart(2)} | STR=${String(pureStr).padStart(2)} AGI=${String(pureAgi).padStart(2)} INT=${String(pureInt).padStart(2)} HP=${pureHp} | ${pureWeapons.length}w ${pureArmors.length}a equippable`);

        if (newPureWeapons.length > 0) {
          console.log(`       NEW (pure path): ${newPureWeapons.map(w => `${w.name} [R${w.rarity}]`).join(", ")}`);
        }
        if (newPureArmors.length > 0) {
          console.log(`       NEW armor (pure): ${newPureArmors.map(a => `${a.name} [R${a.rarity}]`).join(", ")}`);
        }

        for (const opt of offPathOptions) {
          const items = [...opt.newWeapons.map(w => `${w.name} [R${w.rarity}]`), ...opt.newArmors.map(a => `${a.name} [R${a.rarity}]`)];
          const primaryLoss = arch.statPath.toUpperCase();
          console.log(`       IF +1 ${opt.stat} instead of ${primaryLoss}: unlocks ${items.join(", ")}`);
        }

        if (!hasNewPure && !hasOffPath && (level === 1 || level === 5 || level === 10)) {
          console.log(`       (no new gear unlocks this level)`);
        }

        prevPureStats = { ...pureStats };
      }

      // Summary: gear access by rarity tier
      console.log(`\n  --- ${archId} GEAR ACCESS SUMMARY (pure path, L10) ---`);
      const finalStats = { str: pureStr, agi: pureAgi, int: pureInt };
      for (let r = 0; r <= 4; r++) {
        const rLabel = ["R0 Common", "R1 Uncommon", "R2 Rare", "R3 Epic", "R4 Legendary"][r];
        const wpns = itemsUnlocked(allWeapons, finalStats).filter(w => w.rarity === r);
        const arms = itemsUnlocked(allArmors, finalStats).filter(a => a.rarity === r);
        const totalW = allWeapons.filter(w => w.rarity === r).length;
        const totalA = allArmors.filter(a => a.rarity === r).length;
        if (totalW === 0 && totalA === 0) continue;
        const gap = (totalW + totalA) - (wpns.length + arms.length);
        const gapStr = gap > 0 ? ` (${gap} locked — reachable with off-path)` : "";
        console.log(`    ${rLabel}: ${wpns.length}/${totalW} weapons, ${arms.length}/${totalA} armors${gapStr}`);
      }

      // Dead zone check
      console.log(`\n  --- ${archId} DEAD ZONE CHECK ---`);
      let lastUnlockLevel = 0;
      // Rebuild and check
      let checkStr = arch.baseRoll.str + arch.race.str + arch.startingArmor.str;
      let checkAgi = arch.baseRoll.agi + arch.race.agi + arch.startingArmor.agi;
      let checkInt = arch.baseRoll.int + arch.race.int + arch.startingArmor.int;
      let checkPrev = { str: checkStr, agi: checkAgi, int: checkInt };
      let deadZones: string[] = [];

      for (let l = 1; l <= 10; l++) {
        const csp = statPointsForLevel(l, lc);
        if (csp > 0) {
          if (arch.statPath === "str") checkStr += csp;
          else if (arch.statPath === "agi") checkAgi += csp;
          else checkInt += csp;
        }
        if (l === lc.powerSourceBonusLevel) {
          if (arch.powerSource.type === "weave") checkInt += 1;
          else if (arch.powerSource.type === "physical") {
            if (arch.statPath === "str") checkStr += 1;
            else if (arch.statPath === "agi") checkAgi += 1;
          }
        }
        if (l === 10) {
          checkStr += arch.advClass.flatStr;
          checkAgi += arch.advClass.flatAgi;
          checkInt += arch.advClass.flatInt;
        }

        const cur = { str: checkStr, agi: checkAgi, int: checkInt };
        const nw = newUnlocks(allWeapons, checkPrev, cur);
        const na = newUnlocks(allArmors, checkPrev, cur);
        if (nw.length > 0 || na.length > 0) {
          if (lastUnlockLevel > 0 && l - lastUnlockLevel > 3) {
            deadZones.push(`L${lastUnlockLevel + 1}-L${l - 1} (${l - lastUnlockLevel - 1} levels, no new pure-path gear)`);
          }
          lastUnlockLevel = l;
        }
        checkPrev = { ...cur };
      }

      if (deadZones.length === 0) {
        console.log("    No dead zones (new gear unlocks within every 3 levels)");
      } else {
        for (const dz of deadZones) {
          console.log(`    DEAD ZONE: ${dz}`);
        }
      }
    }
  }
}

runJourney();
