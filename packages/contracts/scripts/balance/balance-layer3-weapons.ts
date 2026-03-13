#!/usr/bin/env npx tsx
/**
 * Ultimate Dominion — Balance Layer 3: Weapons & Combat Viability
 * ================================================================
 * SOURCE OF TRUTH for weapon balance.
 * Builds on L2 (character identity) and simulates actual combat.
 *
 * LAYER STACK:
 *   L1 — Combat math (formulas, triangle 2%/pt 20% cap)         [DONE]
 *   L2 — Character identity (27 archetypes, L1-100, no gear)    [DONE]
 *   L3 — Weapons & combat viability (this file)                  [NOW]
 *   L4 — Armor                                                   [DONE]
 *   L5 — Class spells                                             [DONE]
 *   L6 — Consumables                                            [NOW]
 *   L7 — Racial skills & power source abilities
 *
 * COMBAT MODEL (matches on-chain):
 *   - On-chain DEFAULT_MAX_TURNS = 15 (configurable). Each "round" in this sim
 *     = both sides attack = 2 on-chain turns. So 15 on-chain turns ≈ 7-8 sim rounds.
 *   - Players choose loadout BEFORE combat: 4 equipment slots for weapons, spells,
 *     and consumables. Each turn, player picks ONE item to use. Using a class spell
 *     costs your weapon attack for that turn — it's a strategic tradeoff.
 *   - This pre-combat loadout decision is core game design: do I bring my class spell
 *     (costs a turn but buffs/debuffs for several turns), an extra weapon, or consumables?
 *     The tension in tradeoffs is how players learn the game.
 *   - Spell durations are tuned relative to fight length. A 3-turn buff in a 7-round
 *     fight covers ~43% of combat. In a 15-round fight, ~20%.
 *
 * WHAT THIS MODELS:
 *   - All 27 archetypes with best equippable weapon at each level
 *   - PvE: every archetype vs every monster (Dark Cave L1-10)
 *   - PvP: every archetype vs every archetype (same level)
 *   - Monte Carlo simulation (N iterations per matchup)
 *   - Win rates, avg rounds, damage per round
 *   - Class spells with turn cost (spell replaces round 1 weapon attack)
 *
 * Usage: npx tsx packages/contracts/scripts/balance-layer3-weapons.ts [flags]
 *   --equip      What weapon each archetype equips at each level
 *   --pve        PvE simulation results
 *   --pvp        PvP simulation results at L10
 *   --viability  Builds that can't clear content
 *   --weapons    Weapon effectiveness rankings
 *   --tradeoffs  Stat requirement tradeoff analysis (cost of cross-path weapons)
 *   --spells     Enable L5 class spells (cast on turn 1 at L10, costs weapon attack)
 *   --armor      Enable L4 armor (smart allocation + armor bonuses)
 *   --consumables Enable L6 consumables in PvP (path buff + HP pot, both sides)
 *   --v3         Use V3 weapons (epic hybrids + pure nerfs + effects)
 *   --onchain    Use raw on-chain data (no overrides — shows actual deployed balance)
 *   --rounds N   Set max combat rounds (default: 8, matching 15 on-chain turns)
 *   No flags = run everything + summary
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadGameData } from "./loader.js";
import {
  applyOverrides,
  WEAPONS_BASELINE,
  WEAPONS_REBALANCED,
  WEAPONS_V2,
  WEAPONS_V3,
  type SimFlags,
} from "./overrides.js";
import type {
  Weapon, Monster, Armor, Consumable, ClassSpell,
  WeaponEffect, Race, StartingArmor, PowerSource,
  AdvancedClass, Archetype, StatProfile, Combatant,
  CombatResult, GameData, LevelingConstants, CombatConstants,
} from "./types.js";
import {
  statPointsForLevel as _statPointsForLevel,
  hpForLevel as _hpForLevel,
  totalStatPointsAtLevel as _totalStatPointsAtLevel,
  totalHpFromLeveling as _totalHpFromLeveling,
  allocatePoints as _allocatePoints,
  buildProfile as _buildProfile,
  canEquip as _canEquip,
  canEquipArmor as _canEquipArmor,
  triangleAdvantage as _triangleAdvantage,
  getDominant as _getDominant,
  makeCombatant as _makeCombatant,
  makeMonsterCombatant as _makeMonsterCombatant,
} from "./formulas.js";
import {
  resolveAttack as _resolveAttack,
  resolveDualMagicHit as _resolveDualMagicHit,
  resolveBreathAttack as _resolveBreathAttack,
  tickEffects as _tickEffects,
  adjustCombatant as _adjustCombatant,
  defaultRng,
  type ActiveEffectInstance,
  type RngFn,
} from "./combat.js";

// ============================================================
// MODULE STATE — set from loaded GameData in main()
// ============================================================

// Leveling constants
let BASE_HP = 18;
let EARLY_GAME_CAP = 10;
let MID_GAME_CAP = 50;
let STAT_POINTS_EARLY = 1;
let STAT_POINTS_MID = 1;
let STAT_POINTS_LATE = 1;
let HP_GAIN_EARLY = 2;
let HP_GAIN_MID = 1;
let HP_GAIN_LATE = 1;
let POWER_SOURCE_BONUS_LEVEL = 5;
let CLASS_MULTIPLIER_BASE = 1000;

// Combat constants (set from proposed overrides)
let ATTACK_MODIFIER = 1.2;
let AGI_ATTACK_MODIFIER = 1.0;
let CRIT_MULTIPLIER = 2;
let CRIT_BASE_CHANCE = 5;
let EVASION_CAP = 35;
let DOUBLE_STRIKE_CAP = 40;
let COMBAT_TRIANGLE_PER_STAT = 0.02;
let COMBAT_TRIANGLE_MAX = 0.12;
let MAGIC_RESIST_PER_INT = 3;
let MAGIC_RESIST_CAP = 40;
let BLOCK_CHANCE_PER_STR = 2;
let BLOCK_CHANCE_CAP = 30;
let BLOCK_REDUCTION_PHYS = 0.50;
let BLOCK_REDUCTION_MAGIC = 0.0;

// Game data (set from loaded zone JSON + overrides)
let RACES: Record<string, Race> = {};
let STARTING_ARMORS: Record<string, StartingArmor> = {};
let POWER_SOURCES: Record<string, PowerSource> = {};
let CLASSES: Record<string, AdvancedClass> = {};
let BASE_ROLLS: Record<string, { str: number; agi: number; int: number }> = {};
let WEAPONS: Weapon[] = [];
let ARMORS: Armor[] = [];
let MONSTERS: Monster[] = [];
let CONSUMABLES: Consumable[] = [];
let CLASS_SPELLS: Record<string, ClassSpell> = {};
let WEAPON_EFFECTS: Record<string, WeaponEffect[]> = {};
let MONSTER_WEAPON_EFFECTS: Record<string, WeaponEffect[]> = {};
let ARCHETYPE_CONFIGS: Record<string, { name: string; class: string; race: string; armor: string; power: string; path: "str" | "agi" | "int" }> = {};

// Sim config
let activeWeapons: Weapon[] = [];
let useArmorFlag = false;
let useSpellsFlag = false;
let useConsumablesFlag = false;
let useF2PProgressionFlag = false;
const SIM_ITERATIONS = 500;
let maxCombatRounds = 8;

/**
 * F2P progression: max weapon/armor rarity available at each level.
 * Models worst-case free-to-play: no marketplace purchases, only drops from mobs
 * at or below the player's farming level.
 *
 * Based on actual drop tables in UpdateMonsterInventories:
 * - L1: R0 only (starter weapon, haven't killed anything yet)
 * - L2-3: R0-R1 (Apprentice Staff, Iron Axe from L1-2 drops)
 * - L4-5: R0-R2 (Crystal Shard, Notched Cleaver, Warhammer start dropping)
 * - L6-7: R0-R3 (Gnarled Cudgel from L5, Bone Staff from L7)
 * - L8-10: R0-R4 (Trollhide Cleaver from L5, Phasefang from L6)
 */
function maxRarityForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= 3) return 1;
  if (level <= 5) return 2;
  if (level <= 7) return 3;
  return 4;
}


// ActiveEffectInstance imported from combat.ts

function getWeaponEffects(weaponName: string): WeaponEffect[] {
  return WEAPON_EFFECTS[weaponName] || MONSTER_WEAPON_EFFECTS[weaponName] || [];
}

// Consumable types imported from types.ts. Data loaded from zone JSON.

interface ConsumableLoadout {
  name: string;
  preBuffs: Consumable[];
  inCombat: Consumable[];
}

// Helper to find consumable by name (used to build loadouts after data is loaded)
function findConsumable(name: string): Consumable {
  const c = CONSUMABLES.find(c => c.name === name);
  if (!c) throw new Error(`Consumable not found: ${name}`);
  return c;
}

// Built lazily in main() after CONSUMABLES is loaded
let WYRM_LOADOUTS: ConsumableLoadout[] = [];

function buildWyrmLoadouts(): ConsumableLoadout[] {
  // Find consumables by name — zone JSON uses canonical on-chain names
  const stew = CONSUMABLES.find(c => c.type === "pre_buff" && c.strMod);
  const berries = CONSUMABLES.find(c => c.type === "pre_buff" && c.agiMod);
  const tea = CONSUMABLES.find(c => c.type === "pre_buff" && c.intMod);
  const ghp = CONSUMABLES.find(c => c.type === "heal" && c.healAmount === 75);
  const sapping = CONSUMABLES.find(c => c.type === "debuff" && c.effect && c.effect.strMod < 0);
  const antidote = CONSUMABLES.find(c => c.type === "cleanse");

  if (!stew || !berries || !tea || !ghp || !sapping || !antidote) {
    console.warn("Warning: some consumables not found, wyrm loadouts incomplete");
    return [{ name: "No consumables", preBuffs: [], inCombat: [] }];
  }

  return [
    { name: "No consumables", preBuffs: [], inCombat: [] },
    { name: "+STR buff", preBuffs: [stew], inCombat: [] },
    { name: "+AGI buff", preBuffs: [berries], inCombat: [] },
    { name: "+INT buff", preBuffs: [tea], inCombat: [] },
    { name: "+STR + Greater HP", preBuffs: [stew], inCombat: [ghp] },
    { name: "+AGI + Greater HP", preBuffs: [berries], inCombat: [ghp] },
    { name: "+INT + Greater HP", preBuffs: [tea], inCombat: [ghp] },
    { name: "+STR + Sapping",    preBuffs: [stew], inCombat: [sapping] },
    { name: "+AGI + Sapping",    preBuffs: [berries], inCombat: [sapping] },
    { name: "+INT + Sapping",    preBuffs: [tea], inCombat: [sapping] },
    { name: "+STR + GHP + Sapping", preBuffs: [stew], inCombat: [ghp, sapping] },
    { name: "+AGI + GHP + Sapping", preBuffs: [berries], inCombat: [ghp, sapping] },
    { name: "+INT + GHP + Sapping", preBuffs: [tea], inCombat: [ghp, sapping] },
    { name: "+STR + Antidote", preBuffs: [stew], inCombat: [antidote] },
  ];
}

/**
 * Build PvP consumable loadout for an archetype.
 * ALL consumables cost a turn — stat buffs go in inCombat, not preBuffs.
 * This creates the spell vs buff vs attack tradeoff on turn 1.
 */
function buildPvPConsumableLoadout(arch: Archetype): ConsumableLoadout {
  const stew = CONSUMABLES.find(c => c.type === "pre_buff" && c.strMod);
  const berries = CONSUMABLES.find(c => c.type === "pre_buff" && c.agiMod);
  const tea = CONSUMABLES.find(c => c.type === "pre_buff" && c.intMod);
  const hp35 = CONSUMABLES.find(c => c.type === "heal" && c.healAmount === 35);

  if (!stew || !berries || !tea) {
    return { name: "No consumables", preBuffs: [], inCombat: [] };
  }

  const pathBuff = arch.statPath === "str" ? stew : arch.statPath === "agi" ? berries : tea;
  const inCombat: Consumable[] = [pathBuff];
  if (hp35) inCombat.push(hp35);

  return {
    name: `+${arch.statPath.toUpperCase()} buff + HP pot`,
    preBuffs: [],
    inCombat,
  };
}

/**
 * Estimate the combat value of a weapon's effects for scoring purposes.
 * This bridges the gap so the scorer properly accounts for DoTs, debuffs, and dual hits.
 *
 * Values calibrated against simulation results:
 * - Weaken (-8 STR): ~20% win rate boost → high value (reduces both damage and triangle)
 * - Poison (3×2 stacks): ~5% win rate boost → moderate value (consistent DPR addition)
 * - Stupify (-8 INT): situational — strong vs INT, weak vs physical. Average ~half of weaken.
 * - Dual magic: extra hit ≈ doubles magic DPR
 */
function estimateEffectValue(weaponName: string): number {
  const effects = getWeaponEffects(weaponName);
  let value = 0;
  for (const e of effects) {
    switch (e.type) {
      case "dot":
        // Poison: ~3 dmg/tick × avg ~1.5 stacks over combat = ~4.5 effective DPR
        value += (e.damagePerTick ?? 0) * (e.maxStacks ?? 1) * 1.2;
        break;
      case "stat_debuff":
        // STR debuff is most impactful (damage + triangle), AGI moderate, INT least
        value += Math.abs(e.strMod ?? 0) * 0.8 +
                 Math.abs(e.agiMod ?? 0) * 0.5 +
                 Math.abs(e.intMod ?? 0) * 0.4;
        break;
      case "dual_magic":
        // Extra magic hit — roughly doubles magic damage portion
        value += 4.0;
        break;
    }
  }
  return value;
}

// All game data loaded dynamically in main() via loader.ts + overrides.ts

// L2 STAT CALCULATION — delegated to formulas.ts, wired with module-level constants
// ============================================================

function getLevelingConstants(): LevelingConstants {
  return {
    baseHp: BASE_HP, earlyGameCap: EARLY_GAME_CAP, midGameCap: MID_GAME_CAP,
    statPointsEarly: STAT_POINTS_EARLY, statPointsMid: STAT_POINTS_MID, statPointsLate: STAT_POINTS_LATE,
    hpGainEarly: HP_GAIN_EARLY, hpGainMid: HP_GAIN_MID, hpGainLate: HP_GAIN_LATE,
    powerSourceBonusLevel: POWER_SOURCE_BONUS_LEVEL,
  };
}

function getCombatConstants(): CombatConstants {
  return {
    attackModifier: ATTACK_MODIFIER, agiAttackModifier: AGI_ATTACK_MODIFIER,
    defenseModifier: 1.0, critMultiplier: CRIT_MULTIPLIER, critBaseChance: CRIT_BASE_CHANCE,
    critAgiDivisor: 4, evasionMultiplier: 2, evasionCap: EVASION_CAP,
    doubleStrikeMultiplier: 3, doubleStrikeCap: DOUBLE_STRIKE_CAP,
    combatTriangleFlatPct: 0.20, combatTrianglePerStat: COMBAT_TRIANGLE_PER_STAT,
    combatTriangleMax: COMBAT_TRIANGLE_MAX,
    magicResistPerInt: MAGIC_RESIST_PER_INT, magicResistCap: MAGIC_RESIST_CAP,
    blockChancePerStr: BLOCK_CHANCE_PER_STR, blockChanceCap: BLOCK_CHANCE_CAP,
    blockReductionPhys: BLOCK_REDUCTION_PHYS, blockReductionMagic: BLOCK_REDUCTION_MAGIC,
    hitStartingProbability: 90, hitAttackerDampener: 95, hitDefenderDampener: 30,
    hitMin: 5, hitMax: 98, spellDodgeThreshold: 10, spellDodgePctPerAgi: 2.0, spellDodgeCap: 20,
    classMultiplierBase: CLASS_MULTIPLIER_BASE,
  };
}

function statPointsForLevel(level: number): number {
  return _statPointsForLevel(level, getLevelingConstants());
}

function hpForLevel(level: number): number {
  return _hpForLevel(level, getLevelingConstants());
}

function totalStatPointsAtLevel(level: number): number {
  return _totalStatPointsAtLevel(level, getLevelingConstants());
}

function totalHpFromLeveling(level: number): number {
  return _totalHpFromLeveling(level, getLevelingConstants());
}

function allocatePoints(totalPoints: number, path: "str" | "agi" | "int", extraPsPoint: boolean = false): { str: number; agi: number; int: number } {
  return _allocatePoints(totalPoints, path, extraPsPoint);
}

function buildProfile(arch: Archetype, level: number): StatProfile {
  return _buildProfile(arch, level, getLevelingConstants(), CLASS_MULTIPLIER_BASE);
}

// ============================================================
// ARCHETYPE DEFINITIONS (same 27 from L2)
// ============================================================

function buildArchetypes(): Archetype[] {
  return Object.entries(ARCHETYPE_CONFIGS).map(([id, cfg]) => {
    const className = cfg.class.charAt(0).toUpperCase() + cfg.class.slice(1);
    return {
      id,
      name: cfg.name,
      className,
      advClass: CLASSES[cfg.class],
      race: RACES[cfg.race],
      startingArmor: STARTING_ARMORS[cfg.armor],
      powerSource: POWER_SOURCES[cfg.power],
      statPath: cfg.path,
      baseRoll: BASE_ROLLS[cfg.path],
    };
  });
}

// ============================================================
// WEAPON SELECTION
// ============================================================

function canEquip(weapon: Weapon, profile: StatProfile): boolean {
  return _canEquip(weapon, profile);
}

/**
 * Select best weapon for an archetype at a given level.
 * "Best" = highest expected damage output per round for this build.
 * For on-path builds, prefers weapons matching their stat path.
 * Falls back to any equippable weapon.
 */
function selectBestWeapon(arch: Archetype, profile: StatProfile, maxRarity?: number): Weapon {
  const equippable = activeWeapons.filter(w => canEquip(w, profile) && (maxRarity === undefined || w.rarity <= maxRarity));
  if (equippable.length === 0) return activeWeapons[0]; // fallback to Broken Sword

  // Score each weapon by expected damage per round
  const scored = equippable.map(w => {
    const avgDmg = (w.minDamage + w.maxDamage) / 2;
    const scalingMod = w.isMagic ? ATTACK_MODIFIER :
                       w.scaling === "agi" ? AGI_ATTACK_MODIFIER : ATTACK_MODIFIER;

    // Which stat matters for this weapon?
    let attackerStat: number;
    if (w.isMagic) {
      attackerStat = profile.int + w.intMod;
    } else if (w.scaling === "agi") {
      attackerStat = profile.agi + w.agiMod;
    } else {
      attackerStat = profile.str + w.strMod;
    }

    // Approximate damage (against average defender)
    const baseDmg = avgDmg * scalingMod;
    const statBonus = Math.max(0, attackerStat * scalingMod - 10) / 2; // rough estimate vs avg defender

    // Class multiplier
    let classMult = 1.0;
    if (w.isMagic) classMult = arch.advClass.spellMult / 1000;
    else classMult = arch.advClass.physMult / 1000;

    const expectedDmg = (baseDmg + statBonus) * classMult;

    // Bonus for HP (survivability)
    const hpValue = w.hpMod * 0.3; // HP is worth ~0.3 stat points per budget

    // Effect value is multiplicative — scales with base weapon quality, not flat
    const effectMult = 1 + estimateEffectValue(w.name) / 25;
    return { weapon: w, score: expectedDmg * effectMult + hpValue };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].weapon;
}

// ============================================================
// ARMOR SELECTION (L4)
// Picks best equippable armor for an archetype based on base stats.
// Armor stat bonuses are applied to profile BEFORE weapon selection,
// so armor can unlock better weapons (and unequipping armor can lose them).
// ============================================================

function canEquipArmor(armor: Armor, profile: StatProfile): boolean {
  return _canEquipArmor(armor, profile);
}

/**
 * Select best armor for a build. Scores by defensive value + on-path stat bonus.
 * Prefers on-path armor (Plate for STR, Leather for AGI, Cloth for INT) but
 * will pick cross-path armor if it scores higher (e.g., 33/33/33 picking Chainmail for +2 STR).
 */
function selectBestArmor(profile: StatProfile, path: "str" | "agi" | "int", maxRarity?: number): Armor {
  const equippable = ARMORS.filter(a => canEquipArmor(a, profile) && (maxRarity === undefined || a.rarity <= maxRarity));
  if (equippable.length === 0) return ARMORS[0]; // fallback to Tattered Cloth

  const scored = equippable.map(a => {
    // Defensive value: armor rating reduces physical dmg per hit, HP is flat survivability
    let score = a.armorValue * 1.5 + a.hpMod;

    // On-path stat bonus is most valuable (directly boosts damage output)
    const pathBonus = path === "str" ? a.strMod : path === "agi" ? a.agiMod : a.intMod;
    score += pathBonus * 2.0;

    // Off-path stat bonuses help with weapon reqs and defense
    score += (a.strMod + a.agiMod + a.intMod) * 0.3;

    // Rarity tiebreaker (prefer upgrades)
    score += a.rarity * 0.1;

    return { armor: a, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].armor;
}

/**
 * Apply equipped armor stat bonuses to a profile.
 * Returns a new profile — does not mutate the original.
 */
function applyArmorToProfile(profile: StatProfile, armor: Armor): StatProfile {
  const str = profile.str + armor.strMod;
  const agi = profile.agi + armor.agiMod;
  const int_ = profile.int + armor.intMod;
  const hp = profile.hp + armor.hpMod;
  const dom = getDominant(str, agi, int_);
  return {
    str, agi, int: int_, hp,
    totalStats: str + agi + int_,
    primaryStat: dom.stat,
    dominantType: dom.type,
  };
}

interface GearLoadout {
  baseProfile: StatProfile;   // before armor
  profile: StatProfile;       // after armor bonuses (used for weapon selection + combat)
  weapon: Weapon;
  armor: Armor | null;
  armorRating: number;
}

/**
 * Full gear pipeline: build profile → select armor → apply bonuses → select weapon.
 * When useArmorFlag is false, armor is null and profile is unchanged.
 *
 * Smart allocation: tries 0-3 off-path point investments to unlock better armor.
 * Armor secondary pattern: STR→INT, AGI→INT, INT→AGI.
 * Picks whichever investment level yields the best total loadout score.
 */
function buildGearLoadout(arch: Archetype, level: number): GearLoadout {
  const rarityGate = useF2PProgressionFlag ? maxRarityForLevel(level) : undefined;

  if (!useArmorFlag) {
    const baseProfile = buildProfile(arch, level);
    const weapon = selectBestWeapon(arch, baseProfile, rarityGate);
    return { baseProfile, profile: baseProfile, weapon, armor: null, armorRating: 0 };
  }

  // Two secondary stats to try investing in (for armor AND weapon reqs)
  const secondaryStats: ("str" | "agi" | "int")[] =
    arch.statPath === "str" ? ["agi", "int"] :
    arch.statPath === "agi" ? ["str", "int"] : ["str", "agi"];

  const base = getBaseStats(arch, level);
  const totalPoints = totalStatPointsAtLevel(level) + base.extraPrimaryPt;

  let bestLoadout: GearLoadout | null = null;
  let bestScore = -Infinity;

  // Try all splits of 0-5 off-path points between two secondary stats.
  // This unlocks both armor (e.g., INT→AGI for Drake's Cowl) and weapons (e.g., INT→STR for Smoldering Rod).
  const maxOffPath = 5;
  for (let offPath = 0; offPath <= maxOffPath; offPath++) {
    const primaryPoints = totalPoints - offPath;
    if (primaryPoints < 0) break;

    // Try all splits: (offPath, 0), (offPath-1, 1), ..., (0, offPath)
    for (let s1 = offPath; s1 >= 0; s1--) {
      const s2 = offPath - s1;

      let str = base.str, agi = base.agi, int_ = base.int, hp = base.hp;

      // Allocate primary stat points
      if (arch.statPath === "str") str += primaryPoints;
      else if (arch.statPath === "agi") agi += primaryPoints;
      else int_ += primaryPoints;

      // Allocate secondary points
      if (secondaryStats[0] === "str") str += s1;
      else if (secondaryStats[0] === "agi") agi += s1;
      else int_ += s1;

      if (secondaryStats[1] === "str") str += s2;
      else if (secondaryStats[1] === "agi") agi += s2;
      else int_ += s2;

      // HP multiplier for advanced classes
      if (level >= 10 && arch.advClass.hpMult !== CLASS_MULTIPLIER_BASE) {
        hp = Math.floor((hp * arch.advClass.hpMult) / CLASS_MULTIPLIER_BASE);
      }

      const totalStats = str + agi + int_;
      const dom = getDominant(str, agi, int_);
      const baseProfile: StatProfile = { str, agi, int: int_, hp, totalStats, primaryStat: dom.stat, dominantType: dom.type };

      // Select best armor for this allocation
      const armor = selectBestArmor(baseProfile, arch.statPath, rarityGate);
      const profile = applyArmorToProfile(baseProfile, armor);

      // Select best weapon for post-armor profile
      const weapon = selectBestWeapon(arch, profile, rarityGate);
      const armorRating = armor.armorValue;

      // Score: weapon combat effectiveness + armor defensive value + AGI combat value
      const avgDmg = (weapon.minDamage + weapon.maxDamage) / 2;
      const scalingMod = weapon.isMagic ? ATTACK_MODIFIER :
                         weapon.scaling === "agi" ? AGI_ATTACK_MODIFIER : ATTACK_MODIFIER;
      let attackerStat: number;
      if (weapon.isMagic) attackerStat = profile.int + weapon.intMod;
      else if (weapon.scaling === "agi") attackerStat = profile.agi + weapon.agiMod;
      else attackerStat = profile.str + weapon.strMod;

      const dmgScore = (avgDmg * scalingMod + Math.max(0, attackerStat * scalingMod - 10) / 2);
      const classMult = weapon.isMagic ? arch.advClass.spellMult / 1000 : arch.advClass.physMult / 1000;
      const effectMult = 1 + estimateEffectValue(weapon.name) / 25;
      const weaponScore = dmgScore * classMult * effectMult + weapon.hpMod * 0.3;

      // Armor value: rating reduces per-hit damage, HP extends fight duration
      const armorScore = armorRating * 1.5 + armor.hpMod * 0.3;

      // AGI combat value: evasion + double strike (physical AGI only)
      // Only give double strike bonus for AGI-path builds with physical AGI weapons.
      // This prevents magic-weapon builds (Warlock etc.) from incorrectly switching to bows.
      const combatAgi = profile.agi + weapon.agiMod;
      let agiScore = Math.max(0, combatAgi - 10) * 0.15; // baseline evasion for all
      if (weapon.scaling === "agi" && !weapon.isMagic && arch.statPath === "agi"
          && arch.advClass.physMult >= arch.advClass.spellMult) {
        agiScore += combatAgi * 0.35; // double strike + stronger evasion for physical AGI-path
      }

      // Magic weapons bypass armor — significant advantage not in raw damage score
      const magicBypassScore = weapon.isMagic ? 4.0 : 0;

      // STR defensive value: block chance scales with STR
      const combatStr = profile.str + weapon.strMod;
      const strDefScore = combatStr > 10 ? (combatStr - 10) * 0.25 : 0;

      const totalScore = weaponScore + armorScore + agiScore + magicBypassScore + strDefScore;
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestLoadout = { baseProfile, profile, weapon, armor, armorRating };
      }
    }
  }

  return bestLoadout!;
}

// ============================================================
// TRADEOFF-AWARE WEAPON SELECTION
// Considers the COST of meeting stat requirements.
// Instead of "dump all into primary, see what's equippable",
// this asks "for each weapon, what's the optimal stat allocation?"
// ============================================================

interface WeaponTradeoff {
  weapon: Weapon;
  profile: StatProfile;
  offPathCost: number;      // stat points diverted from primary
  primaryStat: number;      // resulting primary stat value
  maxPrimary: number;       // what primary would be with zero diversion
  feasible: boolean;
  score: number;            // heuristic combat effectiveness
}

/**
 * Calculate the base stats an archetype has BEFORE level-up allocation.
 * This is the foundation — race, starting armor, class bonuses.
 */
function getBaseStats(arch: Archetype, level: number): { str: number; agi: number; int: number; hp: number; extraPrimaryPt: number } {
  let str = arch.baseRoll.str + arch.race.str + arch.startingArmor.str;
  let agi = arch.baseRoll.agi + arch.race.agi + arch.startingArmor.agi;
  let int_ = arch.baseRoll.int + arch.race.int + arch.startingArmor.int;
  let hp = BASE_HP + arch.race.hp + arch.startingArmor.hp;

  hp += totalHpFromLeveling(level);

  let extraPrimaryPt = 0;
  if (level >= POWER_SOURCE_BONUS_LEVEL) {
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

/**
 * For a given weapon + armor combo, calculate the optimal stat allocation.
 * Armor is optional — if null, only weapon requirements are considered.
 * Returns the cost (points diverted from primary) and whether it's feasible.
 */
function allocateForEquipment(arch: Archetype, level: number, weapon: Weapon, armor?: Armor): WeaponTradeoff {
  const base = getBaseStats(arch, level);
  const totalPoints = totalStatPointsAtLevel(level) + base.extraPrimaryPt;
  const p = arch.statPath;

  // Combined requirements: max of weapon + armor for each stat
  const reqStr = Math.max(weapon.minStr, armor?.minStr ?? 0);
  const reqAgi = Math.max(weapon.minAgi, armor?.minAgi ?? 0);
  const reqInt = Math.max(weapon.minInt, armor?.minInt ?? 0);

  const deficitStr = Math.max(0, reqStr - base.str);
  const deficitAgi = Math.max(0, reqAgi - base.agi);
  const deficitInt = Math.max(0, reqInt - base.int);

  // On-path deficit is "free" — we'd invest there anyway
  // Off-path deficit is the cost — stolen from primary
  const onPathDeficit = p === "str" ? deficitStr : p === "agi" ? deficitAgi : deficitInt;
  const offPathCost = (deficitStr + deficitAgi + deficitInt) - onPathDeficit;

  const pointsForPrimary = totalPoints - offPathCost;

  if (pointsForPrimary < 0 || pointsForPrimary < onPathDeficit) {
    return {
      weapon, profile: { str: 0, agi: 0, int: 0, hp: 0, totalStats: 0, primaryStat: 0, dominantType: "" },
      offPathCost: Infinity, primaryStat: 0, maxPrimary: 0, feasible: false, score: -Infinity
    };
  }

  let str = base.str, agi = base.agi, int_ = base.int, hp = base.hp;

  if (p === "str") {
    agi += deficitAgi; int_ += deficitInt; str += pointsForPrimary;
  } else if (p === "agi") {
    str += deficitStr; int_ += deficitInt; agi += pointsForPrimary;
  } else {
    str += deficitStr; agi += deficitAgi; int_ += pointsForPrimary;
  }

  if (level >= 10 && arch.advClass.hpMult !== CLASS_MULTIPLIER_BASE) {
    hp = Math.floor((hp * arch.advClass.hpMult) / CLASS_MULTIPLIER_BASE);
  }

  const maxPrimary = (p === "str" ? base.str : p === "agi" ? base.agi : base.int) + totalPoints;
  const actualPrimary = p === "str" ? str : p === "agi" ? agi : int_;

  const totalStats = str + agi + int_;
  const dominantType = str >= agi && str >= int_ ? "STR" :
                       agi > str && agi >= int_ ? "AGI" : "INT";
  const profile: StatProfile = { str, agi, int: int_, hp, totalStats, primaryStat: actualPrimary, dominantType };

  // Score with realistic stats
  const avgDmg = (weapon.minDamage + weapon.maxDamage) / 2;
  const scalingMod = weapon.isMagic ? ATTACK_MODIFIER :
                     weapon.scaling === "agi" ? AGI_ATTACK_MODIFIER : ATTACK_MODIFIER;

  let attackerStat: number;
  if (weapon.isMagic) attackerStat = int_ + weapon.intMod;
  else if (weapon.scaling === "agi") attackerStat = agi + weapon.agiMod;
  else attackerStat = str + weapon.strMod;

  const baseDmg = avgDmg * scalingMod;
  const statBonus = Math.max(0, attackerStat * scalingMod - 10) / 2;
  let classMult = weapon.isMagic ? arch.advClass.spellMult / 1000 : arch.advClass.physMult / 1000;
  const hpValue = weapon.hpMod * 0.3;
  const effectMult = 1 + estimateEffectValue(weapon.name) / 25;
  const score = (baseDmg + statBonus) * classMult * effectMult + hpValue;

  return { weapon, profile, offPathCost, primaryStat: actualPrimary, maxPrimary, feasible: true, score };
}

// Backward-compatible wrapper
function allocateForWeapon(arch: Archetype, level: number, weapon: Weapon): WeaponTradeoff {
  return allocateForEquipment(arch, level, weapon);
}

/**
 * Select best weapon considering stat requirement tradeoffs.
 * Tries every weapon in the active pool, allocates stats optimally for each,
 * and picks the one with highest combat effectiveness score.
 */
function selectBestWeaponWithTradeoffs(arch: Archetype, level: number, weapons: Weapon[]): WeaponTradeoff {
  const candidates = weapons
    .filter(w => w.price > 0 || w.rarity === 0) // include starters
    .map(w => allocateForWeapon(arch, level, w))
    .filter(t => t.feasible);

  if (candidates.length === 0) {
    // Fallback to starter
    return allocateForWeapon(arch, level, weapons[0]);
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

// ============================================================
// COMBAT SIMULATION
// ============================================================

function randInt(min: number, max: number): number {
  return defaultRng(min, max);
}

function getDominant(str: number, agi: number, int_: number): { type: string; stat: number } {
  return _getDominant(str, agi, int_);
}

function triangleAdvantage(attackerType: string, defenderType: string): boolean {
  return _triangleAdvantage(attackerType, defenderType);
}

// --- Effect helpers ---

function tickEffects(effects: ActiveEffectInstance[]): number {
  return _tickEffects(effects);
}

function tryApplyEffects(weaponName: string, targetEffects: ActiveEffectInstance[], cooldowns: Map<string, number>, round: number) {
  const wEffects = getWeaponEffects(weaponName);
  for (const we of wEffects) {
    if (we.type === "dual_magic" || we.type === "magic_breath") continue; // handled separately

    // Check cooldown
    const lastApplied = cooldowns.get(we.name) ?? -999;
    if (round - lastApplied < (we.cooldown ?? 0)) continue;

    // Check max stacks
    const currentStacks = targetEffects.filter(e => e.name === we.name).length;
    if (currentStacks >= (we.maxStacks ?? 1)) continue;

    // Apply (all effects have resistanceStat = None → always land)
    targetEffects.push({
      name: we.name,
      type: we.type,
      turnsRemaining: we.duration ?? 8,
      damagePerTick: we.damagePerTick ?? 0,
      strMod: we.strMod ?? 0,
      agiMod: we.agiMod ?? 0,
      intMod: we.intMod ?? 0,
      armorMod: we.armorMod ?? 0,
    });
    cooldowns.set(we.name, round);
  }
}

function adjustCombatant(base: Combatant, effects: ActiveEffectInstance[]): Combatant {
  return _adjustCombatant(base, effects);
}

function resolveDualMagicHit(attacker: Combatant, defender: Combatant): number {
  return _resolveDualMagicHit(attacker, defender, getCombatConstants(), defaultRng);
}

function resolveBreathAttack(attacker: Combatant, defender: Combatant, breath: WeaponEffect): number {
  return _resolveBreathAttack(attacker, defender, breath, getCombatConstants(), defaultRng);
}

// Consumable AI: decide which in-combat consumable to use on a given round.
// Priority: debuffs early (round 2 if spell on r1, else round 1), heals when HP < 50%, tradeoff buffs early.
function pickConsumable(
  items: Consumable[], currentHp: number, maxHp: number, round: number,
  spellOnR1: boolean, selfEffects: ActiveEffectInstance[], targetEffects: ActiveEffectInstance[],
): number {
  // Don't use consumables when nearly dead (1 HP) — it won't save us
  if (currentHp <= 1) return -1;

  const hpPct = currentHp / maxHp;
  const earlyRound = spellOnR1 ? 2 : 1;  // first round where we can use items

  // Priority 1: Heal when HP drops below 50% (or below 35% for minor potions)
  if (hpPct < 0.50) {
    // Pick the smallest potion that's big enough, or the biggest available
    const healIdx = items.reduce((best, item, idx) => {
      if (item.type !== "heal") return best;
      if (best === -1) return idx;
      const bestHeal = items[best].healAmount ?? 0;
      const thisHeal = item.healAmount ?? 0;
      const missing = maxHp - currentHp;
      // Prefer smallest potion that covers at least 50% of missing HP
      if (thisHeal >= missing * 0.5 && (bestHeal < missing * 0.5 || thisHeal < bestHeal)) return idx;
      if (bestHeal < missing * 0.5 && thisHeal > bestHeal) return idx;
      return best;
    }, -1);
    if (healIdx >= 0) return healIdx;
  }

  // Priority 2: Buffs/debuffs on first available round
  if (round === earlyRound) {
    // Pre-buff consumables (stat buffs) — use immediately for full fight duration
    const preBuffIdx = items.findIndex(i => i.type === "pre_buff");
    if (preBuffIdx >= 0) return preBuffIdx;
    const debuffIdx = items.findIndex(i => i.type === "debuff");
    if (debuffIdx >= 0) return debuffIdx;
    const buffIdx = items.findIndex(i => i.type === "tradeoff_buff");
    if (buffIdx >= 0) return buffIdx;
  }

  // Priority 3: Cleanse when we have DoTs active
  const hasDoT = selfEffects.some(e => e.type === "dot");
  if (hasDoT) {
    const cleanseIdx = items.findIndex(i => i.type === "cleanse");
    if (cleanseIdx >= 0) return cleanseIdx;
  }

  // Priority 4: Use remaining buffs/debuffs if we haven't used them yet (round 3+)
  if (round > earlyRound) {
    const preBuffIdx = items.findIndex(i => i.type === "pre_buff");
    if (preBuffIdx >= 0) return preBuffIdx;
    const debuffIdx = items.findIndex(i => i.type === "debuff");
    if (debuffIdx >= 0) return debuffIdx;
    const buffIdx = items.findIndex(i => i.type === "tradeoff_buff");
    if (buffIdx >= 0) return buffIdx;
  }

  return -1;
}

// Per-side spell override: undefined = use global useSpellsFlag, true/false = force
function applyPreBuffs(combatant: Combatant, consumables?: ConsumableLoadout): Combatant {
  if (!consumables || consumables.preBuffs.length === 0) return combatant;
  let sAdj = 0, aAdj = 0, iAdj = 0, armAdj = 0;
  for (const c of consumables.preBuffs) {
    sAdj += c.strMod ?? 0;
    aAdj += c.agiMod ?? 0;
    iAdj += c.intMod ?? 0;
    armAdj += c.armorMod ?? 0;
  }
  const newStr = Math.max(0, combatant.str + sAdj);
  const newAgi = Math.max(0, combatant.agi + aAdj);
  const newInt = Math.max(0, combatant.int + iAdj);
  const dom = getDominant(newStr, newAgi, newInt);
  return {
    ...combatant,
    str: newStr, agi: newAgi, int: newInt,
    armor: Math.max(0, combatant.armor + armAdj),
    dominantType: dom.type, dominantStat: dom.stat,
  };
}

function simulateOneCombat(
  attacker: Combatant, defender: Combatant,
  attackerCastsSpell?: boolean, defenderCastsSpell?: boolean,
  attackerConsumables?: ConsumableLoadout,
  defenderConsumables?: ConsumableLoadout,
): { attackerWins: boolean; rounds: number; totalDamageDealt: number } {
  const aCasts = attackerCastsSpell ?? useSpellsFlag;
  const dCasts = defenderCastsSpell ?? useSpellsFlag;

  // Apply pre-combat consumable buffs (Stew/Berries/Tea — no turn cost, last entire fight)
  const preBuffAttacker = applyPreBuffs(attacker, attackerConsumables);
  const preBuffDefender = applyPreBuffs(defender, defenderConsumables);

  let aHp = preBuffAttacker.maxHp;
  let dHp = preBuffDefender.maxHp;
  let rounds = 0;
  let totalDamageDealt = 0;
  // Effect tracking
  const aEffects: ActiveEffectInstance[] = [];
  const dEffects: ActiveEffectInstance[] = [];
  const aCooldowns = new Map<string, number>();
  const dCooldowns = new Map<string, number>();
  const aHasEffects = getWeaponEffects(preBuffAttacker.weapon.name).length > 0;
  const dHasEffects = getWeaponEffects(preBuffDefender.weapon.name).length > 0;
  const aHasDualMagic = getWeaponEffects(preBuffAttacker.weapon.name).some(e => e.type === "dual_magic");
  const dHasDualMagic = getWeaponEffects(preBuffDefender.weapon.name).some(e => e.type === "dual_magic");
  const aBreathEffect = getWeaponEffects(preBuffAttacker.weapon.name).find(e => e.type === "magic_breath");
  const dBreathEffect = getWeaponEffects(preBuffDefender.weapon.name).find(e => e.type === "magic_breath");
  const aBreathCooldown = { lastUsed: -999 };
  const dBreathCooldown = { lastUsed: -999 };

  // In-combat consumable tracking
  const aInCombatItems = attackerConsumables ? [...attackerConsumables.inCombat] : [];
  const dInCombatItems = defenderConsumables ? [...defenderConsumables.inCombat] : [];

  // Track whether each side cast a spell (costs their round 1 weapon attack)
  let aSkipRound1 = false;
  let dSkipRound1 = false;

  // Multi-use spell tracking: remaining uses after initial cast
  let aSpellUsesLeft = 0;
  let dSpellUsesLeft = 0;

  // Compute spell damage: physical (STR/AGI scaled, reduced by armor) or magic (INT scaled, reduced by resist).
  // Physical spells use dmgPerStr/dmgPerAgi, magic spells use dmgPerInt. Falls back to magic if no phys scaling.
  function resolveSpellDamage(
    spell: ClassSpell, caster: Combatant, target: Combatant,
  ): { finalDmg: number; isPhysical: boolean } {
    const baseDmg = randInt(spell.baseDmgMin ?? 0, spell.baseDmgMax ?? 0);
    const isPhysical = !!(spell.dmgPerStr || spell.dmgPerAgi);

    if (isPhysical) {
      // Physical spell damage: baseDmg + (stat × dmgPerStat), reduced by armor, uses physMult
      const statScale = spell.dmgPerStr
        ? Math.floor(caster.str * spell.dmgPerStr)
        : Math.floor(caster.agi * (spell.dmgPerAgi ?? 0));
      const rawDmg = baseDmg + statScale;
      const afterArmor = Math.max(1, rawDmg - Math.max(0, target.armor));
      const finalDmg = Math.max(1, Math.floor(afterArmor * caster.physMult / 1000));
      return { finalDmg, isPhysical: true };
    } else {
      // Magic spell damage: baseDmg + (INT × dmgPerInt), reduced by magic resist, uses spellMult
      const intScale = Math.floor(caster.int * (spell.dmgPerInt ?? 0));
      const rawDmg = baseDmg + intScale;
      const resistPct = Math.min(target.int * MAGIC_RESIST_PER_INT, MAGIC_RESIST_CAP);
      const finalDmg = Math.max(1, Math.floor(rawDmg * (1 - resistPct / 100) * caster.spellMult / 1000));
      return { finalDmg, isPhysical: false };
    }
  }

  // Resolve a class spell: compute percentage-based stat mods and apply effects/damage.
  // For self_buff: percentages reference caster's stats. For debuff: reference target's stats.
  function resolveSpell(
    spell: ClassSpell, caster: Combatant, target: Combatant,
    casterEffects: ActiveEffectInstance[], targetEffects: ActiveEffectInstance[],
  ): { casterHpDelta: number; targetHpDelta: number; dmgDealt: number } {
    let casterHpDelta = 0;
    let targetHpDelta = 0;
    let dmgDealt = 0;

    if (spell.type === "self_buff") {
      // Percentages of caster's own stats
      const strMod = Math.floor((spell.strPct ?? 0) * caster.str);
      const agiMod = Math.floor((spell.agiPct ?? 0) * caster.agi);
      const intMod = Math.floor((spell.intPct ?? 0) * caster.int);
      casterEffects.push({
        name: spell.name, type: "self_buff", turnsRemaining: spell.duration ?? 3,
        damagePerTick: 0, strMod, agiMod, intMod, armorMod: spell.armorMod ?? 0,
      });
      if (spell.hpPct) { casterHpDelta = Math.floor(spell.hpPct * caster.maxHp); }
    } else if (spell.type === "debuff") {
      // Percentages of target's stats (negative values = reduction)
      const strMod = Math.floor((spell.strPct ?? 0) * target.str);
      const agiMod = Math.floor((spell.agiPct ?? 0) * target.agi);
      const intMod = Math.floor((spell.intPct ?? 0) * target.int);
      targetEffects.push({
        name: spell.name, type: "stat_debuff", turnsRemaining: spell.duration ?? 3,
        damagePerTick: 0, strMod, agiMod, intMod, armorMod: spell.armorMod ?? 0,
      });
    } else if (spell.type === "magic_damage") {
      const { finalDmg } = resolveSpellDamage(spell, caster, target);
      targetHpDelta = -finalDmg;
      dmgDealt = finalDmg;
    } else if (spell.type === "damage_debuff") {
      // Damage component — physical (STR/AGI scaled) or magic (INT scaled)
      const { finalDmg } = resolveSpellDamage(spell, caster, target);
      targetHpDelta = -finalDmg;
      dmgDealt = finalDmg;
      // Debuff component — percentages of target's stats
      const strMod = Math.floor((spell.strPct ?? 0) * target.str);
      const agiMod = Math.floor((spell.agiPct ?? 0) * target.agi);
      const intMod = Math.floor((spell.intPct ?? 0) * target.int);
      targetEffects.push({
        name: spell.name, type: "stat_debuff", turnsRemaining: spell.duration ?? 3,
        damagePerTick: 0, strMod, agiMod, intMod, armorMod: spell.armorMod ?? 0,
      });
    } else if (spell.type === "damage_buff") {
      // Damage component — physical (STR/AGI scaled), reduced by armor
      const { finalDmg } = resolveSpellDamage(spell, caster, target);
      targetHpDelta = -finalDmg;
      dmgDealt = finalDmg;
      // Buff component — percentages of caster's own stats
      const strMod = Math.floor((spell.strPct ?? 0) * caster.str);
      const agiMod = Math.floor((spell.agiPct ?? 0) * caster.agi);
      const intMod = Math.floor((spell.intPct ?? 0) * caster.int);
      casterEffects.push({
        name: spell.name, type: "self_buff", turnsRemaining: spell.duration ?? 3,
        damagePerTick: 0, strMod, agiMod, intMod, armorMod: spell.armorMod ?? 0,
      });
      if (spell.hpPct) { casterHpDelta = Math.floor(spell.hpPct * caster.maxHp); }
    } else if (spell.type === "weapon_enchant") {
      // Enchant weapon with bonus magic damage per hit — no upfront damage, pure utility
      casterEffects.push({
        name: spell.name, type: "weapon_enchant", turnsRemaining: spell.duration ?? 8,
        damagePerTick: 0, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0,
        bonusMagicDmgMin: spell.baseDmgMin ?? 0,
        bonusMagicDmgMax: spell.baseDmgMax ?? 0,
        bonusMagicDmgPerInt: spell.dmgPerInt ?? 0,
      });
    }
    return { casterHpDelta, targetHpDelta, dmgDealt };
  }

  // Cast class spells before combat loop if enabled
  // Spell replaces round 1 weapon attack (matches on-chain: player picks spell OR weapon per turn)
  {
    const aSpell = (aCasts && preBuffAttacker.className) ? CLASS_SPELLS[preBuffAttacker.className] : undefined;
    const dSpell = (dCasts && preBuffDefender.className) ? CLASS_SPELLS[preBuffDefender.className] : undefined;

    if (aSpell) {
      aSkipRound1 = true;
      aSpellUsesLeft = (aSpell.maxUses ?? 1) - 1; // subtract initial cast
      const r = resolveSpell(aSpell, preBuffAttacker, preBuffDefender, aEffects, dEffects);
      aHp += r.casterHpDelta;
      dHp += r.targetHpDelta;
      totalDamageDealt += r.dmgDealt;
    }

    if (dSpell) {
      dSkipRound1 = true;
      dSpellUsesLeft = (dSpell.maxUses ?? 1) - 1;
      const r = resolveSpell(dSpell, preBuffDefender, preBuffAttacker, dEffects, aEffects);
      dHp += r.casterHpDelta;
      aHp += r.targetHpDelta;
    }

    if (dHp <= 0 || aHp <= 0) {
      return { attackerWins: dHp <= 0, rounds: 0, totalDamageDealt };
    }
  }

  // Recast decision: should a combatant spend this turn recasting their spell?
  function shouldRecast(
    spell: ClassSpell, casterEffects: ActiveEffectInstance[], targetEffects: ActiveEffectInstance[],
  ): boolean {
    switch (spell.type) {
      case "magic_damage":
        return true; // Pure damage — always cast if uses remain
      case "self_buff":
      case "damage_buff":
      case "weapon_enchant":
        return !casterEffects.some(e => e.name === spell.name); // Recast when buff expired
      case "debuff":
      case "damage_debuff":
        return !targetEffects.some(e => e.name === spell.name); // Recast when debuff expired
      default:
        return false;
    }
  }

  // Resolve weapon enchant bonus damage (bonus magic hit per weapon attack)
  function resolveEnchantBonus(enchant: ActiveEffectInstance, caster: Combatant, target: Combatant): number {
    const baseDmg = randInt(enchant.bonusMagicDmgMin ?? 0, enchant.bonusMagicDmgMax ?? 0);
    const intScale = Math.floor(caster.int * (enchant.bonusMagicDmgPerInt ?? 0));
    let damage = baseDmg + intScale;
    const resistPct = Math.min(target.int * MAGIC_RESIST_PER_INT, MAGIC_RESIST_CAP);
    damage = Math.max(1, Math.floor(damage * (1 - resistPct / 100)));
    damage = Math.floor(damage * caster.spellMult / 1000);
    return Math.max(1, damage);
  }

  while (aHp > 0 && dHp > 0 && rounds < maxCombatRounds) {
    rounds++;

    // Tick effects at start of round (DoTs deal damage, expired effects removed)
    if (dEffects.length > 0) dHp -= tickEffects(dEffects);
    if (aEffects.length > 0) aHp -= tickEffects(aEffects);
    if (dHp <= 0 || aHp <= 0) break;

    // Adjust stats for active effects (buffs + debuffs)
    const adjAttacker = aEffects.length > 0 ? adjustCombatant(preBuffAttacker, aEffects) : preBuffAttacker;
    const adjDefender = dEffects.length > 0 ? adjustCombatant(preBuffDefender, dEffects) : preBuffDefender;

    // --- Attacker's turn ---
    let aUsedAction = rounds === 1 && aSkipRound1; // round 1 skipped if initial spell cast

    // Multi-use spell recast (costs weapon attack, takes priority over consumables)
    if (!aUsedAction && aSpellUsesLeft > 0) {
      const aSpell = CLASS_SPELLS[preBuffAttacker.className];
      if (aSpell && shouldRecast(aSpell, aEffects, dEffects)) {
        aUsedAction = true;
        aSpellUsesLeft--;
        const r = resolveSpell(aSpell, preBuffAttacker, adjDefender, aEffects, dEffects);
        aHp += r.casterHpDelta;
        dHp += r.targetHpDelta;
        totalDamageDealt += r.dmgDealt;
      }
    }

    // In-combat consumable (costs weapon attack)
    if (!aUsedAction && aInCombatItems.length > 0) {
      const consumableIdx = pickConsumable(aInCombatItems, aHp, preBuffAttacker.maxHp, rounds, aSkipRound1, aEffects, dEffects);
      if (consumableIdx >= 0) {
        const item = aInCombatItems.splice(consumableIdx, 1)[0];
        aUsedAction = true;
        if (item.type === "heal") {
          aHp = Math.min(preBuffAttacker.maxHp, aHp + (item.healAmount ?? 0));
        } else if (item.type === "debuff" && item.effect) {
          dEffects.push({
            name: item.name, type: "stat_debuff",
            turnsRemaining: item.effect.duration,
            damagePerTick: item.effect.damagePerTick,
            strMod: item.effect.strMod, agiMod: item.effect.agiMod,
            intMod: item.effect.intMod, armorMod: item.effect.armorMod,
          });
        } else if (item.type === "pre_buff") {
          aEffects.push({
            name: item.name, type: "self_buff",
            turnsRemaining: 99,
            damagePerTick: 0,
            strMod: item.strMod ?? 0, agiMod: item.agiMod ?? 0,
            intMod: item.intMod ?? 0, armorMod: item.armorMod ?? 0,
          });
        } else if (item.type === "tradeoff_buff" && item.effect) {
          aEffects.push({
            name: item.name, type: "self_buff",
            turnsRemaining: item.effect.duration,
            damagePerTick: 0,
            strMod: item.effect.strMod, agiMod: item.effect.agiMod,
            intMod: item.effect.intMod, armorMod: item.effect.armorMod,
          });
        } else if (item.type === "cleanse") {
          for (let i = aEffects.length - 1; i >= 0; i--) {
            if (aEffects[i].type === "dot") aEffects.splice(i, 1);
          }
        }
      }
    }

    // Weapon attack (skipped if spell recast or consumable used this turn)
    if (!aUsedAction) {
      const aDmg = resolveAttack(adjAttacker, adjDefender);
      dHp -= aDmg;
      totalDamageDealt += aDmg;

      // Weapon enchant: bonus magic damage on every weapon hit
      const aEnchant = aEffects.find(e => e.type === "weapon_enchant");
      if (aEnchant && aDmg > 0) {
        const bonusDmg = resolveEnchantBonus(aEnchant, adjAttacker, adjDefender);
        dHp -= bonusDmg;
        totalDamageDealt += bonusDmg;
      }

      // Apply weapon effects on defender
      if (aHasEffects) tryApplyEffects(preBuffAttacker.weapon.name, dEffects, dCooldowns, rounds);

      // Dual magic second hit
      if (aHasDualMagic) {
        const magicDmg = resolveDualMagicHit(adjAttacker, adjDefender);
        dHp -= magicDmg;
        totalDamageDealt += magicDmg;
      }

      // Magic breath attack (separate magic hit, fires on cooldown, not evasion-checked)
      if (aBreathEffect && rounds - aBreathCooldown.lastUsed >= (aBreathEffect.cooldown ?? 1)) {
        const breathDmg = resolveBreathAttack(adjAttacker, adjDefender, aBreathEffect);
        dHp -= breathDmg;
        totalDamageDealt += breathDmg;
        aBreathCooldown.lastUsed = rounds;
      }
    }

    if (dHp <= 0) break;

    // --- Defender's turn ---
    let dUsedAction = rounds === 1 && dSkipRound1;

    // Multi-use spell recast
    if (!dUsedAction && dSpellUsesLeft > 0) {
      const dSpell = CLASS_SPELLS[preBuffDefender.className];
      if (dSpell && shouldRecast(dSpell, dEffects, aEffects)) {
        dUsedAction = true;
        dSpellUsesLeft--;
        const r = resolveSpell(dSpell, preBuffDefender, adjAttacker, dEffects, aEffects);
        dHp += r.casterHpDelta;
        aHp += r.targetHpDelta;
      }
    }

    // In-combat consumable
    if (!dUsedAction && dInCombatItems.length > 0) {
      const consumableIdx = pickConsumable(dInCombatItems, dHp, preBuffDefender.maxHp, rounds, dSkipRound1, dEffects, aEffects);
      if (consumableIdx >= 0) {
        const item = dInCombatItems.splice(consumableIdx, 1)[0];
        dUsedAction = true;
        if (item.type === "heal") {
          dHp = Math.min(preBuffDefender.maxHp, dHp + (item.healAmount ?? 0));
        } else if (item.type === "debuff" && item.effect) {
          aEffects.push({
            name: item.name, type: "stat_debuff",
            turnsRemaining: item.effect.duration,
            damagePerTick: item.effect.damagePerTick,
            strMod: item.effect.strMod, agiMod: item.effect.agiMod,
            intMod: item.effect.intMod, armorMod: item.effect.armorMod,
          });
        } else if (item.type === "pre_buff") {
          dEffects.push({
            name: item.name, type: "self_buff",
            turnsRemaining: 99,
            damagePerTick: 0,
            strMod: item.strMod ?? 0, agiMod: item.agiMod ?? 0,
            intMod: item.intMod ?? 0, armorMod: item.armorMod ?? 0,
          });
        } else if (item.type === "tradeoff_buff" && item.effect) {
          dEffects.push({
            name: item.name, type: "self_buff",
            turnsRemaining: item.effect.duration,
            damagePerTick: 0,
            strMod: item.effect.strMod, agiMod: item.effect.agiMod,
            intMod: item.effect.intMod, armorMod: item.effect.armorMod,
          });
        } else if (item.type === "cleanse") {
          for (let i = dEffects.length - 1; i >= 0; i--) {
            if (dEffects[i].type === "dot") dEffects.splice(i, 1);
          }
        }
      }
    }

    // Weapon attack
    if (!dUsedAction) {
      const dDmg = resolveAttack(adjDefender, adjAttacker);
      aHp -= dDmg;

      // Weapon enchant: bonus magic damage on every weapon hit
      const dEnchant = dEffects.find(e => e.type === "weapon_enchant");
      if (dEnchant && dDmg > 0) {
        const bonusDmg = resolveEnchantBonus(dEnchant, adjDefender, adjAttacker);
        aHp -= bonusDmg;
      }

      // Apply weapon effects on attacker
      if (dHasEffects) tryApplyEffects(preBuffDefender.weapon.name, aEffects, aCooldowns, rounds);

      // Dual magic second hit
      if (dHasDualMagic) {
        const magicDmg = resolveDualMagicHit(adjDefender, adjAttacker);
        aHp -= magicDmg;
      }

      // Magic breath attack (separate magic hit, fires on cooldown, not evasion-checked)
      if (dBreathEffect && rounds - dBreathCooldown.lastUsed >= (dBreathEffect.cooldown ?? 1)) {
        const breathDmg = resolveBreathAttack(adjDefender, adjAttacker, dBreathEffect);
        aHp -= breathDmg;
        dBreathCooldown.lastUsed = rounds;
      }
    }
  }

  // Draw = defender wins (attacker failed to kill in time, matches on-chain behavior)
  const attackerWins = dHp <= 0 && (aHp > 0 || dHp <= 0);
  return { attackerWins: dHp <= 0, rounds, totalDamageDealt };
}

function resolveAttack(attacker: Combatant, defender: Combatant): number {
  return _resolveAttack(attacker, defender, getCombatConstants(), defaultRng);
}

function makeCombatant(profile: StatProfile, weapon: Weapon, advClass: AdvancedClass, armor: number = 0, className: string = ""): Combatant {
  return _makeCombatant(profile, weapon, advClass, armor, className);
}

function makeMonsterCombatant(m: Monster): Combatant {
  return _makeMonsterCombatant(m, !!MONSTER_WEAPON_EFFECTS[m.name]);
}

function simulate(
  attacker: Combatant, defender: Combatant, iterations: number = SIM_ITERATIONS,
  attackerCastsSpell?: boolean, defenderCastsSpell?: boolean,
  attackerConsumables?: ConsumableLoadout,
  defenderConsumables?: ConsumableLoadout,
): CombatResult {
  let wins = 0;
  let totalRounds = 0;
  let totalDmg = 0;

  for (let i = 0; i < iterations; i++) {
    const result = simulateOneCombat(attacker, defender, attackerCastsSpell, defenderCastsSpell, attackerConsumables, defenderConsumables);
    if (result.attackerWins) wins++;
    totalRounds += result.rounds;
    totalDmg += result.totalDamageDealt;
  }

  return {
    attackerWins: wins,
    defenderWins: iterations - wins,
    avgRounds: totalRounds / iterations,
    avgDamagePerRound: totalDmg / totalRounds,
    winRate: wins / iterations,
    iterations,
  };
}

// Optimal spell usage: for each matchup, each side independently decides whether
// casting their spell improves their win rate. Tests all 4 combos (neither, A only,
// D only, both) and picks the Nash equilibrium — each side's best response.
interface OptimalResult {
  result: CombatResult;
  aCasts: boolean;
  dCasts: boolean;
}

function simulateOptimal(
  attacker: Combatant, defender: Combatant, iterations: number = SIM_ITERATIONS,
  attackerConsumables?: ConsumableLoadout, defenderConsumables?: ConsumableLoadout,
): OptimalResult {
  const aHasSpell = !!(attacker.className && CLASS_SPELLS[attacker.className]);
  const dHasSpell = !!(defender.className && CLASS_SPELLS[defender.className]);

  // If neither has a spell, skip the optimization
  if (!aHasSpell && !dHasSpell) {
    return { result: simulate(attacker, defender, iterations, false, false, attackerConsumables, defenderConsumables), aCasts: false, dCasts: false };
  }

  // Test all 4 combinations
  const nn = simulate(attacker, defender, iterations, false, false, attackerConsumables, defenderConsumables);
  const yn = aHasSpell ? simulate(attacker, defender, iterations, true, false, attackerConsumables, defenderConsumables) : nn;
  const ny = dHasSpell ? simulate(attacker, defender, iterations, false, true, attackerConsumables, defenderConsumables) : nn;
  const yy = (aHasSpell && dHasSpell) ? simulate(attacker, defender, iterations, true, true, attackerConsumables, defenderConsumables) :
             aHasSpell ? yn : dHasSpell ? ny : nn;

  // Each side picks their best response to the opponent's best response (iterated best response).
  // Attacker's win rate for each combo:
  //   Attacker wants to MAXIMIZE win rate, Defender wants to MINIMIZE attacker's win rate.
  // Find Nash: attacker picks best given defender's choice, defender picks best given attacker's.
  // Simple 2x2 game — iterate once is sufficient for pure strategies.

  // Defender's best response to attacker NOT casting:
  const dBestVsNoCast = (dHasSpell && ny.winRate < nn.winRate) ? true : false; // defender wants LOWER attacker winRate
  // Defender's best response to attacker casting:
  const dBestVsCast = (dHasSpell && yy.winRate < yn.winRate) ? true : false;

  // Attacker's best response to defender's anticipated choice:
  // If attacker doesn't cast, defender plays dBestVsNoCast
  const aWinIfNoCast = dBestVsNoCast ? ny.winRate : nn.winRate;
  // If attacker casts, defender plays dBestVsCast
  const aWinIfCast = aHasSpell ? (dBestVsCast ? yy.winRate : yn.winRate) : aWinIfNoCast;

  const aCasts = aHasSpell && aWinIfCast > aWinIfNoCast;
  // Defender's response to attacker's final choice:
  const dCasts = aCasts ? dBestVsCast : dBestVsNoCast;

  const finalResult = aCasts ? (dCasts ? yy : yn) : (dCasts ? ny : nn);
  return { result: finalResult, aCasts, dCasts };
}

// ============================================================
// OUTPUT HELPERS
// ============================================================

function pad(s: string | number, len: number): string { return String(s).padEnd(len); }
function rpad(s: string | number, len: number): string { return String(s).padStart(len); }

// ============================================================
// REPORT: Weapon Loadout
// ============================================================

function reportEquip(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(140));
  console.log(`  GEAR LOADOUT: Best equippable weapon${useArmorFlag ? " + armor" : ""} per archetype at each level`);
  console.log("=".repeat(140));

  for (const level of [1, 3, 5, 7, 10]) {
    console.log(`\n--- Level ${level} ---`);
    const armorCol = useArmorFlag ? pad("Armor", 22) + rpad("ARM", 5) : "";
    console.log(
      pad("ID", 7) + pad("Name", 14) + pad("Path", 5) +
      pad("Weapon", 22) + rpad("Dmg", 6) + rpad("Scale", 6) +
      armorCol +
      rpad("STR", 5) + rpad("AGI", 5) + rpad("INT", 5) + rpad("HP", 5) +
      "  Notes"
    );
    console.log("-".repeat(useArmorFlag ? 140 : 110));

    for (const arch of archetypes) {
      const gear = buildGearLoadout(arch, level);
      const equippableCount = activeWeapons.filter(w => canEquip(w, gear.profile) && w.price > 0).length;
      const notes: string[] = [];
      if (equippableCount <= 3) notes.push(`!! only ${equippableCount} weapons`);
      if (gear.armor && gear.armor.rarity >= 2) {
        // Show secondary req cost if any
        const base = gear.baseProfile;
        const secCost = Math.max(0, gear.armor.minInt - base.int) +
                        Math.max(0, gear.armor.minAgi - base.agi) +
                        Math.max(0, gear.armor.minStr - base.str) -
                        Math.max(0, gear.armor[`min${arch.statPath.charAt(0).toUpperCase() + arch.statPath.slice(1)}` as keyof Armor] as number - (base as any)[arch.statPath]);
        // Simplified: just show if armor requires off-path investment
      }

      const armorCol = useArmorFlag
        ? "  " + pad(gear.armor?.name ?? "none", 22) + rpad(gear.armorRating, 5)
        : "";
      console.log(
        pad(arch.id, 7) + pad(arch.name, 14) + pad(arch.statPath.toUpperCase(), 5) +
        pad(gear.weapon.name, 22) + rpad(`${gear.weapon.minDamage}-${gear.weapon.maxDamage}`, 6) +
        rpad(gear.weapon.isMagic ? "magic" : gear.weapon.scaling.toUpperCase(), 6) +
        armorCol +
        rpad(gear.profile.str, 5) + rpad(gear.profile.agi, 5) + rpad(gear.profile.int, 5) + rpad(gear.profile.hp, 5) +
        "  " + notes.join(", ")
      );
    }
  }
}

// ============================================================
// REPORT: PvE Simulation
// ============================================================

function reportPvE(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(130));
  console.log("  PvE COMBAT SIMULATION: Each archetype vs level-appropriate monster");
  console.log(`  ${SIM_ITERATIONS} iterations per matchup. Win rate & avg rounds.`);
  console.log("=".repeat(130));

  // Simulate at key levels (or ALL levels in F2P mode)
  const showLevels = useF2PProgressionFlag ? null : new Set([1, 3, 5, 7, 10]);
  for (const monster of MONSTERS) {
    if (showLevels && !showLevels.has(monster.level)) continue;
    const level = monster.level;

    console.log(`\n--- Level ${level} vs ${monster.name} (L${monster.level}, HP=${monster.hp}, ARM=${monster.armor}, ${getDominant(monster.str, monster.agi, monster.int).type}) ---`);
    console.log(
      pad("ID", 7) + pad("Name", 14) + pad("Class", 10) + pad("Weapon", 18) +
      rpad("WinRate", 8) + rpad("AvgRnd", 7) + rpad("Dmg/Rnd", 8) +
      rpad("HP", 5) + "  Status"
    );
    console.log("-".repeat(105));

    const results: { arch: Archetype; result: CombatResult; weapon: Weapon; armor: Armor | null; profile: StatProfile }[] = [];

    for (const arch of archetypes) {
      const gear = buildGearLoadout(arch, level);
      const playerCombatant = makeCombatant(gear.profile, gear.weapon, arch.advClass, gear.armorRating, level >= 10 ? arch.className : "");
      const monsterCombatant = makeMonsterCombatant(monster);
      const result = simulate(playerCombatant, monsterCombatant);
      results.push({ arch, result, weapon: gear.weapon, armor: gear.armor, profile: gear.profile });
    }

    // Sort by win rate
    results.sort((a, b) => b.result.winRate - a.result.winRate);

    for (const r of results) {
      const status = r.result.winRate >= 0.8 ? "OK" :
                     r.result.winRate >= 0.5 ? "RISKY" :
                     r.result.winRate >= 0.2 ? "HARD" : "BLOCKED";
      const armorInfo = useArmorFlag && r.armor ? ` [${r.armor.name.substring(0, 15)}]` : "";
      console.log(
        pad(r.arch.id, 7) + pad(r.arch.name, 14) + pad(r.arch.className, 10) +
        pad(r.weapon.name, 18) +
        rpad((r.result.winRate * 100).toFixed(0) + "%", 8) +
        rpad(r.result.avgRounds.toFixed(1), 7) +
        rpad(r.result.avgDamagePerRound.toFixed(1), 8) +
        rpad(r.profile.hp, 5) +
        "  " + status + armorInfo
      );
    }

    // Summary
    const blocked = results.filter(r => r.result.winRate < 0.2);
    const hard = results.filter(r => r.result.winRate >= 0.2 && r.result.winRate < 0.5);
    if (blocked.length > 0) {
      console.log(`  !! BLOCKED (< 20% win): ${blocked.map(r => r.arch.id).join(", ")}`);
    }
    if (hard.length > 0) {
      console.log(`  !! HARD (20-50% win): ${hard.map(r => r.arch.id).join(", ")}`);
    }
  }
}

// ============================================================
// REPORT: PvP Simulation
// ============================================================

function reportPvP(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(130));
  console.log("  PvP COMBAT SIMULATION: All archetypes vs all archetypes at Level 10");
  console.log(`  ${SIM_ITERATIONS} iterations per matchup. Shows win rate for row vs column.`);
  console.log("=".repeat(130));

  const level = 10;
  const combatants: { arch: Archetype; combat: Combatant; weapon: Weapon; armor: Armor | null; consumables: ConsumableLoadout | undefined }[] = [];

  for (const arch of archetypes) {
    const gear = buildGearLoadout(arch, level);
    const combat = makeCombatant(gear.profile, gear.weapon, arch.advClass, gear.armorRating, arch.className);
    const consumables = useConsumablesFlag ? buildPvPConsumableLoadout(arch) : undefined;
    combatants.push({ arch, combat, weapon: gear.weapon, armor: gear.armor, consumables });
  }

  // Build win rate matrix — but only show aggregated stats (full matrix is too big)
  // When spells are enabled, use optimal spell decision per matchup
  const useOptimal = useSpellsFlag;

  const modeLabel = [
    useOptimal ? "optimal spell use" : "",
    useConsumablesFlag ? "consumables" : "",
  ].filter(Boolean).join(" + ");
  console.log("\n--- Aggregate PvP Performance at L10" + (modeLabel ? ` (${modeLabel})` : "") + " ---");
  console.log(
    pad("ID", 7) + pad("Name", 14) + pad("Class", 10) + pad("Weapon", 18) +
    (useArmorFlag ? pad("Armor", 22) : "") +
    rpad("AvgWin%", 8) + rpad("vsSTR%", 7) + rpad("vsAGI%", 7) + rpad("vsINT%", 7) +
    rpad("AvgRnd", 7) +
    (useOptimal ? rpad("Cast%", 7) : "") +
    rpad("Best", 8) + rpad("Worst", 8)
  );
  console.log("-".repeat(useOptimal ? 127 : 120));

  interface PvpResult {
    arch: Archetype; weapon: Weapon;
    avgWin: number; vsStr: number; vsAgi: number; vsInt: number;
    avgRounds: number; best: number; worst: number;
    spellCastPct: number; // % of matchups where this archetype casts their spell
    spellDecisions: { opponentId: string; casts: boolean; winRate: number; noSpellWinRate: number }[];
  }

  const pvpResults: PvpResult[] = [];

  for (const a of combatants) {
    let totalWins = 0;
    let totalMatches = 0;
    let totalRounds = 0;
    let strWins = 0, strMatches = 0;
    let agiWins = 0, agiMatches = 0;
    let intWins = 0, intMatches = 0;
    let bestWin = 0, worstWin = 1;
    let spellCasts = 0;
    const spellDecisions: PvpResult["spellDecisions"] = [];

    for (const d of combatants) {
      if (a.arch.id === d.arch.id) continue;

      let result: CombatResult;
      let aCasts = false;
      let noSpellWinRate = 0;

      if (useOptimal) {
        const opt = simulateOptimal(a.combat, d.combat, SIM_ITERATIONS, a.consumables, d.consumables);
        result = opt.result;
        aCasts = opt.aCasts;
        if (aCasts) spellCasts++;
        // Also get no-spell baseline for the decision map
        const noSpell = simulate(a.combat, d.combat, SIM_ITERATIONS, false, false, a.consumables, d.consumables);
        noSpellWinRate = noSpell.winRate;
        spellDecisions.push({ opponentId: d.arch.id, casts: aCasts, winRate: result.winRate, noSpellWinRate });
      } else {
        result = simulate(a.combat, d.combat, SIM_ITERATIONS, undefined, undefined, a.consumables, d.consumables);
      }

      totalWins += result.winRate;
      totalMatches++;
      totalRounds += result.avgRounds;

      if (d.arch.statPath === "str") { strWins += result.winRate; strMatches++; }
      else if (d.arch.statPath === "agi") { agiWins += result.winRate; agiMatches++; }
      else { intWins += result.winRate; intMatches++; }

      if (result.winRate > bestWin) bestWin = result.winRate;
      if (result.winRate < worstWin) worstWin = result.winRate;
    }

    pvpResults.push({
      arch: a.arch,
      weapon: a.weapon,
      avgWin: totalWins / totalMatches,
      vsStr: strMatches > 0 ? strWins / strMatches : 0,
      vsAgi: agiMatches > 0 ? agiWins / agiMatches : 0,
      vsInt: intMatches > 0 ? intWins / intMatches : 0,
      avgRounds: totalRounds / totalMatches,
      best: bestWin,
      worst: worstWin,
      spellCastPct: totalMatches > 0 ? spellCasts / totalMatches : 0,
      spellDecisions,
    });
  }

  pvpResults.sort((a, b) => b.avgWin - a.avgWin);

  for (const r of pvpResults) {
    const armorCol = useArmorFlag ? pad(combatants.find(c => c.arch.id === r.arch.id)?.armor?.name ?? "none", 22) : "";
    console.log(
      pad(r.arch.id, 7) + pad(r.arch.name, 14) + pad(r.arch.className, 10) +
      pad(r.weapon.name, 18) +
      armorCol +
      rpad((r.avgWin * 100).toFixed(0) + "%", 8) +
      rpad((r.vsStr * 100).toFixed(0) + "%", 7) +
      rpad((r.vsAgi * 100).toFixed(0) + "%", 7) +
      rpad((r.vsInt * 100).toFixed(0) + "%", 7) +
      rpad(r.avgRounds.toFixed(1), 7) +
      (useOptimal ? rpad((r.spellCastPct * 100).toFixed(0) + "%", 7) : "") +
      rpad((r.best * 100).toFixed(0) + "%", 8) +
      rpad((r.worst * 100).toFixed(0) + "%", 8)
    );
  }

  // Fight duration summary
  const allAvgRounds = pvpResults.reduce((s, r) => s + r.avgRounds, 0) / pvpResults.length;
  const maxAvgRounds = Math.max(...pvpResults.map(r => r.avgRounds));
  console.log(`\n  Fight duration: avg ${allAvgRounds.toFixed(1)} rounds, longest avg ${maxAvgRounds.toFixed(1)} rounds (cap: ${maxCombatRounds})`);
  if (allAvgRounds > maxCombatRounds * 0.8) {
    console.log("  !! WARNING: Many fights hitting round cap — draws are skewing results. Consider increasing --rounds.");
  }

  // Path summary
  console.log("\n--- PvP Win Rate by Stat Path ---");
  for (const path of ["str", "agi", "int"] as const) {
    const pathResults = pvpResults.filter(r => r.arch.statPath === path);
    const avg = pathResults.reduce((s, r) => s + r.avgWin, 0) / pathResults.length;
    console.log(`  ${path.toUpperCase()} path avg win rate: ${(avg * 100).toFixed(1)}%`);
  }

  // Class summary
  console.log("\n--- PvP Win Rate by Class (averaged across all 3 paths) ---");
  const classNames = [...new Set(pvpResults.map(r => r.arch.className))];
  for (const cn of classNames) {
    const classResults = pvpResults.filter(r => r.arch.className === cn);
    const avg = classResults.reduce((s, r) => s + r.avgWin, 0) / classResults.length;
    const avgCast = classResults.reduce((s, r) => s + r.spellCastPct, 0) / classResults.length;
    const spellInfo = useOptimal ? ` (spell used ${(avgCast * 100).toFixed(0)}% of matchups)` : "";
    console.log(`  ${pad(cn, 12)} avg win rate: ${(avg * 100).toFixed(1)}%${spellInfo}`);
  }

  // Spell decision map — show when each class casts vs doesn't
  if (useOptimal) {
    console.log("\n--- Spell Decision Map (when is it worth casting?) ---");
    const classGrouped = new Map<string, PvpResult[]>();
    for (const r of pvpResults) {
      const group = classGrouped.get(r.arch.className) ?? [];
      group.push(r);
      classGrouped.set(r.arch.className, group);
    }

    for (const [className, results] of classGrouped) {
      const spell = CLASS_SPELLS[className];
      if (!spell) continue;
      const allDecisions = results.flatMap(r => r.spellDecisions);
      const castCount = allDecisions.filter(d => d.casts).length;
      const totalCount = allDecisions.length;
      const castVsStr = allDecisions.filter(d => d.casts && combatants.find(c => c.arch.id === d.opponentId)?.arch.statPath === "str").length;
      const totalVsStr = allDecisions.filter(d => combatants.find(c => c.arch.id === d.opponentId)?.arch.statPath === "str").length;
      const castVsAgi = allDecisions.filter(d => d.casts && combatants.find(c => c.arch.id === d.opponentId)?.arch.statPath === "agi").length;
      const totalVsAgi = allDecisions.filter(d => combatants.find(c => c.arch.id === d.opponentId)?.arch.statPath === "agi").length;
      const castVsInt = allDecisions.filter(d => d.casts && combatants.find(c => c.arch.id === d.opponentId)?.arch.statPath === "int").length;
      const totalVsInt = allDecisions.filter(d => combatants.find(c => c.arch.id === d.opponentId)?.arch.statPath === "int").length;

      // Show average benefit when casting vs not
      const castsOnly = allDecisions.filter(d => d.casts);
      const avgBenefit = castsOnly.length > 0 ? castsOnly.reduce((s, d) => s + (d.winRate - d.noSpellWinRate), 0) / castsOnly.length * 100 : 0;

      const usesLabel = (spell.maxUses ?? 1) > 1 ? `, ${spell.maxUses}x` : "";
      console.log(
        `  ${pad(className, 12)} ${spell.name} (${spell.type}, ${spell.duration ?? "instant"}t${usesLabel}): ` +
        `cast ${castCount}/${totalCount} matchups ` +
        `(vsSTR ${castVsStr}/${totalVsStr}, vsAGI ${castVsAgi}/${totalVsAgi}, vsINT ${castVsInt}/${totalVsInt}) ` +
        `avg benefit when cast: ${avgBenefit > 0 ? "+" : ""}${avgBenefit.toFixed(1)}%`
      );
    }
  }
}

// ============================================================
// REPORT: Viability Check
// ============================================================

function reportViability(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(100));
  console.log("  VIABILITY CHECK: Can every archetype clear every monster?");
  console.log("  Threshold: >= 50% win rate = viable, < 20% = blocked");
  console.log("=".repeat(100));

  const problems: { arch: string; monster: string; level: number; winRate: number; weapon: string }[] = [];

  for (const arch of archetypes) {
    for (const monster of MONSTERS) {
      const level = monster.level;
      const gear = buildGearLoadout(arch, level);
      const playerCombatant = makeCombatant(gear.profile, gear.weapon, arch.advClass, gear.armorRating, level >= 10 ? arch.className : "");
      const monsterCombatant = makeMonsterCombatant(monster);
      const result = simulate(playerCombatant, monsterCombatant, 200); // fewer iterations for speed

      if (result.winRate < 0.5) {
        problems.push({
          arch: arch.id,
          monster: monster.name,
          level: monster.level,
          winRate: result.winRate,
          weapon: gear.weapon.name,
        });
      }
    }
  }

  if (problems.length === 0) {
    console.log("\n  All archetypes can clear all monsters with >= 50% win rate.");
  } else {
    console.log(`\n  Found ${problems.length} problem matchups:\n`);
    console.log(
      pad("Archetype", 10) + pad("Monster", 20) + rpad("Level", 6) +
      rpad("Win%", 7) + pad("  Weapon", 20) + "  Status"
    );
    console.log("-".repeat(80));

    problems.sort((a, b) => a.winRate - b.winRate);

    for (const p of problems) {
      const status = p.winRate < 0.2 ? "BLOCKED" : "HARD";
      console.log(
        pad(p.arch, 10) + pad(p.monster, 20) + rpad(p.level, 6) +
        rpad((p.winRate * 100).toFixed(0) + "%", 7) +
        pad("  " + p.weapon, 20) + "  " + status
      );
    }
  }
}

// ============================================================
// REPORT: Weapon Rankings
// ============================================================

function reportWeapons(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(100));
  const topMonster = MONSTERS.find(m => m.level === 10) || MONSTERS[MONSTERS.length - 1];
  console.log(`  WEAPON EFFECTIVENESS: Average damage per round by weapon (vs L10 ${topMonster.name})`);
  console.log("=".repeat(100));

  const level = 10;
  const monster = topMonster;
  const monsterCombatant = makeMonsterCombatant(monster);

  console.log(
    pad("Weapon", 20) + rpad("Dmg", 6) + rpad("Scale", 6) + rpad("R", 3) +
    rpad("Price", 6) + rpad("AvgDPR", 8) + rpad("WinRate", 8) + "  Best For"
  );
  console.log("-".repeat(85));

  // Test each weapon with its ideal user
  const playerWeapons = activeWeapons.filter(w => w.price > 0); // exclude monster weapons

  for (const w of playerWeapons) {
    // Find the best archetype for this weapon
    let bestResult: CombatResult | null = null;
    let bestArch: Archetype | null = null;

    for (const arch of archetypes) {
      const profile = buildProfile(arch, level);
      if (!canEquip(w, profile)) continue;

      const combat = makeCombatant(profile, w, arch.advClass);
      const result = simulate(combat, monsterCombatant, 200);

      if (!bestResult || result.winRate > bestResult.winRate) {
        bestResult = result;
        bestArch = arch;
      }
    }

    if (bestResult && bestArch) {
      console.log(
        pad(w.name, 20) + rpad(`${w.minDamage}-${w.maxDamage}`, 6) +
        rpad(w.isMagic ? "magic" : w.scaling.toUpperCase(), 6) + rpad(w.rarity, 3) +
        rpad(w.price + "g", 6) +
        rpad(bestResult.avgDamagePerRound.toFixed(1), 8) +
        rpad((bestResult.winRate * 100).toFixed(0) + "%", 8) +
        "  " + bestArch.id
      );
    }
  }
}

// ============================================================
// REPORT: Summary
// ============================================================

function reportSummary(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(100));
  console.log("  KEY FINDINGS SUMMARY");
  console.log("=".repeat(100));

  // 1. Weapon availability per path
  console.log("\n--- 1. Weapon Availability by Stat Path at L10 ---");
  for (const path of ["str", "agi", "int"] as const) {
    const pathArchs = archetypes.filter(a => a.statPath === path);
    const sample = pathArchs[0]; // all same-path chars have same stats pre-class
    const profile = buildProfile(sample, 10);
    const equippable = activeWeapons.filter(w => canEquip(w, profile) && w.price > 0);
    const strWeapons = equippable.filter(w => !w.isMagic && w.scaling === "str");
    const agiWeapons = equippable.filter(w => !w.isMagic && w.scaling === "agi");
    const magicWeapons = equippable.filter(w => w.isMagic);
    console.log(`  ${path.toUpperCase()} path: ${equippable.length} total (${strWeapons.length} STR, ${agiWeapons.length} AGI, ${magicWeapons.length} magic)`);
  }

  // 2. PvE viability
  console.log("\n--- 2. PvE Viability Summary ---");
  let totalMatchups = 0;
  let blockedCount = 0;
  let hardCount = 0;

  for (const arch of archetypes) {
    for (const monster of MONSTERS) {
      const level = monster.level;
      const profile = buildProfile(arch, level);
      const weapon = selectBestWeapon(arch, profile);
      const pc = makeCombatant(profile, weapon, arch.advClass);
      const mc = makeMonsterCombatant(monster);
      const result = simulate(pc, mc, 100);
      totalMatchups++;
      if (result.winRate < 0.2) blockedCount++;
      else if (result.winRate < 0.5) hardCount++;
    }
  }
  console.log(`  ${totalMatchups} total matchups`);
  console.log(`  ${blockedCount} BLOCKED (< 20% win rate)`);
  console.log(`  ${hardCount} HARD (20-50% win rate)`);
  console.log(`  ${totalMatchups - blockedCount - hardCount} OK (>= 50% win rate)`);

  // 3. Crystal Blade (on-chain Crystal Shard) dominance check
  const cbWeapon = activeWeapons.find(w => w.name === "Crystal Blade" || w.name === "Crystal Shard");
  if (cbWeapon) {
    console.log(`\n--- 3. ${cbWeapon.name} Dominance Check ---`);
    const monster10 = MONSTERS.find(m => m.level === 10)!;
    const mc = makeMonsterCombatant(monster10);
    for (const arch of archetypes.filter(a => a.statPath === "str").slice(0, 3)) {
      const profile = buildProfile(arch, 10);
      if (!canEquip(cbWeapon, profile)) continue;
      const bestWeapon = selectBestWeapon(arch, profile);
      const cbCombat = makeCombatant(profile, cbWeapon, arch.advClass);
      const bestCombat = makeCombatant(profile, bestWeapon, arch.advClass);
      const cbResult = simulate(cbCombat, mc, 200);
      const bestResult = simulate(bestCombat, mc, 200);
      console.log(`  ${pad(arch.id, 7)} ${cbWeapon.name}: ${(cbResult.winRate * 100).toFixed(0)}% | Best (${bestWeapon.name}): ${(bestResult.winRate * 100).toFixed(0)}%`);
    }
  }
}

// ============================================================
// MAIN
// ============================================================

// ============================================================
// REPORT: Before/After Comparison
// ============================================================

function reportCompare(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(130));
  console.log("  REBALANCE COMPARISON: Current vs Proposed weapon stats (PvP at L10)");
  console.log("=".repeat(130));

  // Swap to rebalanced weapons for comparison
  const originalWeapons = [...activeWeapons];

  // Run current (tuned baseline)
  activeWeapons.length = 0;
  activeWeapons.push(...WEAPONS_BASELINE);
  console.log("\n--- CURRENT WEAPONS (tuned baseline) ---");
  const currentResults = runPvPAggregates(archetypes);

  // Run rebalanced
  activeWeapons.length = 0;
  activeWeapons.push(...WEAPONS_REBALANCED);
  console.log("\n--- PROPOSED WEAPONS ---");
  const proposedResults = runPvPAggregates(archetypes);

  // Comparison summary
  console.log("\n--- PATH COMPARISON ---");
  console.log(pad("Path", 8) + rpad("Current", 10) + rpad("Proposed", 10) + rpad("Delta", 8));
  console.log("-".repeat(40));
  for (const path of ["str", "agi", "int"] as const) {
    const cur = currentResults.filter(r => r.path === path);
    const prop = proposedResults.filter(r => r.path === path);
    const curAvg = cur.reduce((s, r) => s + r.avgWin, 0) / cur.length;
    const propAvg = prop.reduce((s, r) => s + r.avgWin, 0) / prop.length;
    const delta = propAvg - curAvg;
    console.log(
      pad(path.toUpperCase(), 8) +
      rpad((curAvg * 100).toFixed(1) + "%", 10) +
      rpad((propAvg * 100).toFixed(1) + "%", 10) +
      rpad((delta > 0 ? "+" : "") + (delta * 100).toFixed(1) + "%", 8)
    );
  }

  console.log("\n--- CLASS COMPARISON ---");
  console.log(pad("Class", 12) + rpad("Current", 10) + rpad("Proposed", 10) + rpad("Delta", 8));
  console.log("-".repeat(44));
  const classNames = [...new Set(currentResults.map(r => r.className))];
  for (const cn of classNames) {
    const cur = currentResults.filter(r => r.className === cn);
    const prop = proposedResults.filter(r => r.className === cn);
    const curAvg = cur.reduce((s, r) => s + r.avgWin, 0) / cur.length;
    const propAvg = prop.reduce((s, r) => s + r.avgWin, 0) / prop.length;
    const delta = propAvg - curAvg;
    console.log(
      pad(cn, 12) +
      rpad((curAvg * 100).toFixed(1) + "%", 10) +
      rpad((propAvg * 100).toFixed(1) + "%", 10) +
      rpad((delta > 0 ? "+" : "") + (delta * 100).toFixed(1) + "%", 8)
    );
  }

  console.log("\n--- WEAPON CHANGES SUMMARY ---");
  console.log("  STR weapons: HP reduced (Steel Mace 5→3, Warhammer 8→5, Stone Maul 8→5, Cudgel 5→3, Cleaver 3→2)");
  console.log("  AGI weapons: HP added (Hunting Bow 0→2, Recurve 0→3, Webspinner 0→4, Longbow 0→5, Darkwood 3→6)");
  console.log("  AGI weapons: Damage bumped (Webspinner 3-4→3-5, Longbow 4-6→4-7, Darkwood 6-9→7-10)");
  console.log("  INT weapons: Minor HP bumps (Channeling 2→3, Bone Staff 3→5, Smoldering 5→6)");
  console.log("  Crystal Shard: Damage nerfed 6-9→4-6 (was outlier)");

  // Restore
  activeWeapons.length = 0;
  activeWeapons.push(...originalWeapons);
}

function runPvPAggregates(archetypes: Archetype[]): { id: string; className: string; path: string; avgWin: number; weapon: string }[] {
  const level = 10;
  const combatants: { arch: Archetype; combat: Combatant; weapon: Weapon }[] = [];

  for (const arch of archetypes) {
    const profile = buildProfile(arch, level);
    const weapon = selectBestWeaponFromActive(arch, profile);
    const combat = makeCombatant(profile, weapon, arch.advClass);
    combatants.push({ arch, combat, weapon });
  }

  const results: { id: string; className: string; path: string; avgWin: number; weapon: string }[] = [];

  for (const a of combatants) {
    let totalWins = 0;
    let totalMatches = 0;

    for (const d of combatants) {
      if (a.arch.id === d.arch.id) continue;
      const result = simulate(a.combat, d.combat, 200); // fewer for speed
      totalWins += result.winRate;
      totalMatches++;
    }

    const avgWin = totalWins / totalMatches;
    results.push({ id: a.arch.id, className: a.arch.className, path: a.arch.statPath, avgWin, weapon: a.weapon.name });
    console.log(`  ${pad(a.arch.id, 7)} ${pad(a.arch.className, 10)} ${pad(a.arch.statPath.toUpperCase(), 5)} ${pad(a.weapon.name, 18)} ${(avgWin * 100).toFixed(0)}%`);
  }

  return results;
}

function selectBestWeaponFromActive(arch: Archetype, profile: StatProfile): Weapon {
  const equippable = activeWeapons.filter(w => canEquip(w, profile));
  if (equippable.length === 0) return activeWeapons[0];

  const scored = equippable.map(w => {
    const avgDmg = (w.minDamage + w.maxDamage) / 2;
    const scalingMod = w.isMagic ? ATTACK_MODIFIER :
                       w.scaling === "agi" ? AGI_ATTACK_MODIFIER : ATTACK_MODIFIER;
    let attackerStat: number;
    if (w.isMagic) attackerStat = profile.int + w.intMod;
    else if (w.scaling === "agi") attackerStat = profile.agi + w.agiMod;
    else attackerStat = profile.str + w.strMod;

    const baseDmg = avgDmg * scalingMod;
    const statBonus = Math.max(0, attackerStat * scalingMod - 10) / 2;
    let classMult = 1.0;
    if (w.isMagic) classMult = arch.advClass.spellMult / 1000;
    else classMult = arch.advClass.physMult / 1000;

    const effectMult = 1 + estimateEffectValue(w.name) / 25;
    return { weapon: w, score: (baseDmg + statBonus) * classMult * effectMult + w.hpMod * 0.3 };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].weapon;
}

// ============================================================
// REPORT: Stat Requirement Tradeoffs
// Shows the real cost of equipping each weapon, including cross-path options
// ============================================================

function reportTradeoffs(archetypes: Archetype[]) {
  const level = 10;
  const weapons = activeWeapons.filter(w => w.price > 0); // exclude monster weapons

  console.log("\n" + "=".repeat(130));
  console.log("  STAT REQUIREMENT TRADEOFFS: What does each weapon COST to equip? (L10)");
  console.log("  Cost = stat points diverted from primary. Higher cost = weaker primary stat.");
  console.log("=".repeat(130));

  // Part 1: Per-archetype weapon rankings with costs
  // Show a representative archetype per path (one melee class, one caster)
  const sampleArchs = archetypes.filter(a =>
    ["WAR-S", "WAR-A", "WAR-I", "RAN-S", "RAN-A", "RAN-I", "WIZ-S", "WIZ-A", "WIZ-I", "ROG-A"].includes(a.id)
  );

  for (const arch of sampleArchs) {
    const base = getBaseStats(arch, level);
    const totalPts = totalStatPointsAtLevel(level) + base.extraPrimaryPt;
    const maxPrimary = (arch.statPath === "str" ? base.str : arch.statPath === "agi" ? base.agi : base.int) + totalPts;

    console.log(`\n--- ${arch.id} ${arch.name} (${arch.className}, ${arch.statPath.toUpperCase()} path) ---`);
    console.log(`  Base: STR ${base.str} AGI ${base.agi} INT ${base.int} | ${totalPts} pts to allocate | Max primary: ${maxPrimary}`);
    console.log(
      "  " + pad("Weapon", 22) + rpad("Rarity", 7) + rpad("Dmg", 7) + rpad("Req", 16) +
      rpad("Cost", 6) + rpad("Primary", 9) + rpad("Score", 8) + "  Notes"
    );
    console.log("  " + "-".repeat(110));

    const tradeoffs = weapons
      .map(w => allocateForWeapon(arch, level, w))
      .filter(t => t.feasible)
      .sort((a, b) => b.score - a.score);

    const bestScore = tradeoffs[0]?.score ?? 0;

    for (const t of tradeoffs) {
      const w = t.weapon;
      const reqStr = [
        w.minStr > 0 ? `S${w.minStr}` : "",
        w.minAgi > 0 ? `A${w.minAgi}` : "",
        w.minInt > 0 ? `I${w.minInt}` : "",
      ].filter(Boolean).join(" ") || "none";

      const notes: string[] = [];
      if (t.offPathCost === 0) notes.push("FREE");
      else notes.push(`-${t.offPathCost} ${arch.statPath.toUpperCase()}`);
      if (t.score === bestScore) notes.push("← BEST");
      if (t.score >= bestScore * 0.9 && t.score < bestScore) notes.push("viable");

      console.log(
        "  " + pad(w.name, 22) + rpad(`R${w.rarity}`, 7) + rpad(`${w.minDamage}-${w.maxDamage}`, 7) +
        rpad(reqStr, 16) + rpad(t.offPathCost, 6) +
        rpad(t.primaryStat + "/" + t.maxPrimary, 9) +
        rpad(t.score.toFixed(1), 8) + "  " + notes.join(" | ")
      );
    }
  }

  // Part 2: Cross-path viability matrix
  // For each path, which weapons from OTHER paths are worth considering?
  console.log("\n" + "=".repeat(130));
  console.log("  CROSS-PATH WEAPON VIABILITY: Is it ever worth equipping an off-path weapon?");
  console.log("=".repeat(130));

  for (const path of ["str", "agi", "int"] as const) {
    const pathArchs = archetypes.filter(a => a.statPath === path);

    console.log(`\n--- ${path.toUpperCase()} PATH (avg across ${pathArchs.length} archetypes) ---`);

    // For each weapon, calculate average tradeoff across all archetypes of this path
    const weaponAvgs: { weapon: Weapon; avgScore: number; avgCost: number; feasibleCount: number; isOnPath: boolean }[] = [];

    for (const w of weapons) {
      const tradeoffs = pathArchs.map(a => allocateForWeapon(a, level, w));
      const feasible = tradeoffs.filter(t => t.feasible);
      if (feasible.length === 0) continue;

      const isOnPath = (path === "str" && !w.isMagic && w.scaling === "str" && w.minAgi === 0 && w.minInt <= 5) ||
                        (path === "agi" && !w.isMagic && w.scaling === "agi") ||
                        (path === "int" && w.isMagic);

      weaponAvgs.push({
        weapon: w,
        avgScore: feasible.reduce((s, t) => s + t.score, 0) / feasible.length,
        avgCost: feasible.reduce((s, t) => s + t.offPathCost, 0) / feasible.length,
        feasibleCount: feasible.length,
        isOnPath,
      });
    }

    weaponAvgs.sort((a, b) => b.avgScore - a.avgScore);
    const bestOnPath = weaponAvgs.find(w => w.isOnPath);

    console.log(
      "  " + pad("Weapon", 22) + rpad("AvgScore", 10) + rpad("AvgCost", 9) +
      rpad("Feasible", 10) + rpad("On-path?", 10) + "  Verdict"
    );
    console.log("  " + "-".repeat(100));

    for (const wa of weaponAvgs) {
      const verdict = wa.isOnPath ? "" :
        (bestOnPath && wa.avgScore > bestOnPath.avgScore) ? "BETTER THAN ON-PATH!" :
        (bestOnPath && wa.avgScore > bestOnPath.avgScore * 0.95) ? "competitive" :
        (wa.avgCost > 5) ? "too expensive" : "outclassed";

      console.log(
        "  " + pad(wa.weapon.name, 22) + rpad(wa.avgScore.toFixed(1), 10) +
        rpad(wa.avgCost.toFixed(0), 9) + rpad(`${wa.feasibleCount}/${pathArchs.length}`, 10) +
        rpad(wa.isOnPath ? "yes" : "no", 10) + "  " + verdict
      );
    }
  }

  // Part 3: PvP comparison — naive (all-in primary) vs tradeoff-aware
  console.log("\n" + "=".repeat(130));
  console.log("  PvP IMPACT: Naive allocation (all-in primary) vs Tradeoff-aware allocation");
  console.log("=".repeat(130));

  // Build combatants both ways
  const naiveCombatants: { arch: Archetype; combat: Combatant; weapon: Weapon }[] = [];
  const tradeoffCombatants: { arch: Archetype; combat: Combatant; weapon: Weapon; cost: number }[] = [];

  for (const arch of archetypes) {
    // Naive: old method
    const naiveProfile = buildProfile(arch, level);
    const naiveWeapon = selectBestWeaponFromActive(arch, naiveProfile);
    naiveCombatants.push({ arch, combat: makeCombatant(naiveProfile, naiveWeapon, arch.advClass), weapon: naiveWeapon });

    // Tradeoff-aware
    const tradeoff = selectBestWeaponWithTradeoffs(arch, level, activeWeapons);
    tradeoffCombatants.push({
      arch,
      combat: makeCombatant(tradeoff.profile, tradeoff.weapon, arch.advClass),
      weapon: tradeoff.weapon,
      cost: tradeoff.offPathCost,
    });
  }

  // Run PvP for both
  console.log("\n" + pad("ID", 7) + pad("Class", 10) + pad("Path", 5) +
    pad("Naive Weapon", 20) + rpad("Naive%", 8) +
    pad("  Tradeoff Weapon", 22) + rpad("Cost", 5) + rpad("Trade%", 8) + rpad("Delta", 7));
  console.log("-".repeat(100));

  for (let i = 0; i < archetypes.length; i++) {
    const arch = archetypes[i];

    // Naive PvP
    let naiveWins = 0, naiveMatches = 0;
    for (let j = 0; j < archetypes.length; j++) {
      if (i === j) continue;
      const r = simulate(naiveCombatants[i].combat, naiveCombatants[j].combat, 200);
      naiveWins += r.winRate;
      naiveMatches++;
    }
    const naiveAvg = naiveWins / naiveMatches;

    // Tradeoff PvP
    let tradeoffWins = 0, tradeoffMatches = 0;
    for (let j = 0; j < archetypes.length; j++) {
      if (i === j) continue;
      const r = simulate(tradeoffCombatants[i].combat, tradeoffCombatants[j].combat, 200);
      tradeoffWins += r.winRate;
      tradeoffMatches++;
    }
    const tradeoffAvg = tradeoffWins / tradeoffMatches;

    const delta = tradeoffAvg - naiveAvg;
    const changed = naiveCombatants[i].weapon.name !== tradeoffCombatants[i].weapon.name;

    console.log(
      pad(arch.id, 7) + pad(arch.className, 10) + pad(arch.statPath.toUpperCase(), 5) +
      pad(naiveCombatants[i].weapon.name, 20) + rpad((naiveAvg * 100).toFixed(0) + "%", 8) +
      pad("  " + tradeoffCombatants[i].weapon.name, 22) +
      rpad(tradeoffCombatants[i].cost, 5) +
      rpad((tradeoffAvg * 100).toFixed(0) + "%", 8) +
      rpad((delta > 0 ? "+" : "") + (delta * 100).toFixed(1) + "%", 7) +
      (changed ? " ← CHANGED" : "")
    );
  }
}

// ============================================================
// REPORT: Hybrid/Split Allocation Viability
// Tests: is dumping 100% into one stat always optimal?
// Or can split builds (50/50, 70/30, even 33/33/33) compete?
// ============================================================

type AllocStrategy = { name: string; split: { str: number; agi: number; int: number } };

function buildProfileWithStrategy(arch: Archetype, level: number, strategy: AllocStrategy): StatProfile {
  const base = getBaseStats(arch, level);
  const totalPoints = totalStatPointsAtLevel(level) + base.extraPrimaryPt;

  let str = base.str + Math.floor(totalPoints * strategy.split.str);
  let agi = base.agi + Math.floor(totalPoints * strategy.split.agi);
  let int_ = base.int + Math.floor(totalPoints * strategy.split.int);
  let hp = base.hp;

  // Distribute any rounding remainder to highest-weighted stat
  const allocated = Math.floor(totalPoints * strategy.split.str) + Math.floor(totalPoints * strategy.split.agi) + Math.floor(totalPoints * strategy.split.int);
  const remainder = totalPoints - allocated;
  if (strategy.split.str >= strategy.split.agi && strategy.split.str >= strategy.split.int) str += remainder;
  else if (strategy.split.agi >= strategy.split.int) agi += remainder;
  else int_ += remainder;

  if (level >= 10 && arch.advClass.hpMult !== CLASS_MULTIPLIER_BASE) {
    hp = Math.floor((hp * arch.advClass.hpMult) / CLASS_MULTIPLIER_BASE);
  }

  const totalStats = str + agi + int_;
  const primaryStat = Math.max(str, agi, int_);
  const dominantType = str >= agi && str >= int_ ? "STR" :
                       agi > str && agi >= int_ ? "AGI" : "INT";

  return { str, agi, int: int_, hp, totalStats, primaryStat, dominantType };
}

function reportHybrid(archetypes: Archetype[]) {
  const level = 10;
  const weapons = activeWeapons.filter(w => w.price > 0);

  console.log("\n" + "=".repeat(130));
  console.log("  HYBRID ALLOCATION ANALYSIS: Is splitting stat points viable?");
  console.log("  Tests different allocation strategies per class. PvP = avg win rate vs all builds (200 iterations).");
  console.log("=".repeat(130));

  // Define allocation strategies
  const STRATEGIES: AllocStrategy[] = [
    { name: "100% Primary",  split: { str: 1.0, agi: 0.0, int: 0.0 } },  // placeholder, set per-archetype
    { name: "70/30 Split",   split: { str: 0.7, agi: 0.3, int: 0.0 } },
    { name: "50/50 Split",   split: { str: 0.5, agi: 0.5, int: 0.0 } },
    { name: "40/40/20 Even", split: { str: 0.4, agi: 0.4, int: 0.2 } },
    { name: "33/33/33",      split: { str: 0.34, agi: 0.33, int: 0.33 } },
  ];

  // Test hybrid classes specifically — they have split class bonuses
  const hybridClasses: { name: string; class: AdvancedClass; stat1: "str"|"agi"|"int"; stat2: "str"|"agi"|"int" }[] = [
    { name: "Druid",    class: CLASSES.druid,    stat1: "str", stat2: "agi" },   // flatStr 2, flatAgi 2
    { name: "Warlock",  class: CLASSES.warlock,  stat1: "agi", stat2: "int" },   // flatAgi 2, flatInt 2
    { name: "Sorcerer", class: CLASSES.sorcerer, stat1: "str", stat2: "int" },   // flatStr 2, flatInt 2
    { name: "Rogue",    class: CLASSES.rogue,    stat1: "agi", stat2: "int" },   // flatAgi 2, flatInt 1
    { name: "Warrior",  class: CLASSES.warrior,  stat1: "str", stat2: "agi" },   // Pure STR class (control)
    { name: "Wizard",   class: CLASSES.wizard,   stat1: "int", stat2: "str" },   // Pure INT class (control)
  ];

  // For PvP comparison, build a reference pool of focused archetypes
  const refCombatants: Combatant[] = [];
  for (const arch of archetypes) {
    const tradeoff = selectBestWeaponWithTradeoffs(arch, level, activeWeapons);
    refCombatants.push(makeCombatant(tradeoff.profile, tradeoff.weapon, arch.advClass));
  }

  for (const hc of hybridClasses) {
    console.log(`\n--- ${hc.name} (${hc.stat1.toUpperCase()}/${hc.stat2.toUpperCase()} class) ---`);

    // Use Human + Leather as neutral race/armor (least biased base)
    const arch: Archetype = {
      id: `${hc.name}-H`, name: `${hc.name} Hybrid`, className: hc.name,
      advClass: hc.class, race: RACES.human, startingArmor: STARTING_ARMORS.leather,
      powerSource: POWER_SOURCES.physical,
      statPath: hc.stat1,  // nominal primary
      baseRoll: { str: 6, agi: 6, int: 6 },  // neutral starting roll for hybrid
    };

    // Build all meaningful strategies: 100% each stat, 70/30 both directions, all three 50/50 pairings, 33/33/33
    const allStats: ("str"|"agi"|"int")[] = ["str", "agi", "int"];
    const statLabel = (s: string) => s.toUpperCase();
    const strategies: AllocStrategy[] = [
      // 100% focused — one per stat
      ...allStats.map(s => ({
        name: `100% ${statLabel(s)}`,
        split: { str: 0, agi: 0, int: 0, [s]: 1.0 } as any,
      })),
      // 90/10 — barely dipping into secondary (enough to unlock epics?)
      { name: `90/${statLabel(hc.stat1)} 10/${statLabel(hc.stat2)}`, split: { str: 0, agi: 0, int: 0, [hc.stat1]: 0.9, [hc.stat2]: 0.1 } as any },
      { name: `90/${statLabel(hc.stat2)} 10/${statLabel(hc.stat1)}`, split: { str: 0, agi: 0, int: 0, [hc.stat2]: 0.9, [hc.stat1]: 0.1 } as any },
      // 70/30 — class natural direction + reverse
      { name: `70/${statLabel(hc.stat1)} 30/${statLabel(hc.stat2)}`, split: { str: 0, agi: 0, int: 0, [hc.stat1]: 0.7, [hc.stat2]: 0.3 } as any },
      { name: `70/${statLabel(hc.stat2)} 30/${statLabel(hc.stat1)}`, split: { str: 0, agi: 0, int: 0, [hc.stat2]: 0.7, [hc.stat1]: 0.3 } as any },
      // 50/50 — all three pairings
      ...([["str","agi"],["str","int"],["agi","int"]] as const).map(([a,b]) => ({
        name: `50/50 ${statLabel(a)}/${statLabel(b)}`,
        split: { str: 0, agi: 0, int: 0, [a]: 0.5, [b]: 0.5 } as any,
      })),
      // Even spread
      { name: `33/33/33`, split: { str: 0.34, agi: 0.33, int: 0.33 } },
    ];

    console.log(
      "  " + pad("Strategy", 28) + rpad("S", 4) + rpad("A", 4) + rpad("I", 4) + rpad("HP", 4) +
      "  " + pad("Best Weapon", 20) + rpad("Cost", 5) + rpad("Equip#", 7) +
      rpad("PvP%", 7) + rpad("vsDragon", 10) + "  Notes"
    );
    console.log("  " + "-".repeat(120));

    for (const strat of strategies) {
      const profile = buildProfileWithStrategy(arch, level, strat);

      // Find best weapon this profile can equip
      const equippable = weapons.filter(w => canEquip(w, profile));
      const bestWeapon = equippable.length > 0
        ? equippable.sort((a, b) => {
            const scoreW = (w: Weapon) => {
              const avgDmg = (w.minDamage + w.maxDamage) / 2;
              const sm = w.isMagic ? ATTACK_MODIFIER : w.scaling === "agi" ? AGI_ATTACK_MODIFIER : ATTACK_MODIFIER;
              let stat = w.isMagic ? profile.int + w.intMod : w.scaling === "agi" ? profile.agi + w.agiMod : profile.str + w.strMod;
              let cm = w.isMagic ? hc.class.spellMult / 1000 : hc.class.physMult / 1000;
              const em = 1 + estimateEffectValue(w.name) / 25;
              return (avgDmg * sm + Math.max(0, stat * sm - 10) / 2) * cm * em + w.hpMod * 0.3;
            };
            return scoreW(b) - scoreW(a);
          })[0]
        : weapons[0];

      const combatant = makeCombatant(profile, bestWeapon, hc.class);

      // PvP vs reference pool
      let pvpWins = 0, pvpTotal = 0;
      for (const ref of refCombatants) {
        const r = simulate(combatant, ref, 200);
        pvpWins += r.winRate;
        pvpTotal++;
      }
      const pvpAvg = pvpWins / pvpTotal;

      // vs L10 monster (boss)
      const dragon = MONSTERS.find(m => m.level === 10)!;
      const dragonCombatant = makeMonsterCombatant(dragon);
      const dragonResult = simulate(combatant, dragonCombatant, 500);

      const notes: string[] = [];
      if (pvpAvg >= 0.5) notes.push("VIABLE");
      else if (pvpAvg >= 0.3) notes.push("marginal");
      else notes.push("WEAK");
      if (dragonResult.winRate < 0.5) notes.push("can't farm dragon!");

      console.log(
        "  " + pad(strat.name, 28) +
        rpad(profile.str, 4) + rpad(profile.agi, 4) + rpad(profile.int, 4) + rpad(profile.hp, 4) +
        "  " + pad(bestWeapon.name, 20) + rpad(equippable.length > 0 ? 0 : "N/A", 5) + rpad(equippable.length, 7) +
        rpad((pvpAvg * 100).toFixed(0) + "%", 7) +
        rpad((dragonResult.winRate * 100).toFixed(0) + "%", 10) +
        "  " + notes.join(" | ")
      );
    }
  }
}

// ============================================================
// REPORT: Basilisk Boss — Realistic Gameplay Scenario
//
// Scenario: Player is farming in PvP zone. Normal loadout: 1 spell, 2 weapons,
// health potions in inventory. Basilisk spawns. They fight with what they have.
//
// Test tiers:
//   1. Naked — weapon + spell only, no potions (can I do it raw?)
//   2. Realistic — weapon + spell + 2× Health Potion (35 HP each, common drop)
//   3. Prepared — weapon + spell + 2× Greater Health Potion (75 HP each, rarer)
//   4. Full prep — pre-buff + weapon + spell + GHP + Sapping (went to shop first)
//
// Target: Realistic (2× HP pot) should get every build to 30-60%.
// ============================================================

function reportWyrm(archetypes: Archetype[]) {
  const wyrm = MONSTERS.find(m => m.name === "Basilisk");
  if (!wyrm) { console.log("!! Basilisk not found in MONSTERS array"); return; }

  const level = 10;
  const savedRounds = maxCombatRounds;
  maxCombatRounds = 30;  // Boss fights are 30 rounds

  console.log("\n" + "=".repeat(140));
  console.log("  BASILISK BOSS: Realistic Gameplay Scenario");
  console.log(`  Basilisk: STR ${wyrm.str}, AGI ${wyrm.agi}, INT ${wyrm.int}, HP ${wyrm.hp}, ARM ${wyrm.armor}, Weapon: ${wyrm.weaponIsMagic ? "magic" : "physical"} ${wyrm.weaponMinDmg}-${wyrm.weaponMaxDmg}`);
  const wyrmEffects = MONSTER_WEAPON_EFFECTS["Basilisk"] || [];
  const effectDesc = wyrmEffects.map(e => {
    if (e.type === "magic_breath") return `breath (magic ${e.minDmg}-${e.maxDmg}, cd ${e.cooldown})`;
    if (e.type === "dot") return `${e.name} (${e.damagePerTick} DoT, ${e.maxStacks} stack, ${e.duration}t, cd ${e.cooldown})`;
    if (e.type === "stat_debuff") return `${e.name} (debuff, ${e.duration}t, cd ${e.cooldown})`;
    return e.name;
  }).join(" + ");
  console.log(`  Effects: ${effectDesc}`);
  console.log(`  30 round cap. ${SIM_ITERATIONS} iterations. Spells: ${useSpellsFlag ? "ON" : "OFF"}, Armor: ${useArmorFlag ? "ON" : "OFF"}`);
  console.log(`  Scenario: farming PvP zone, Basilisk spawns. Fight with what you have.`);
  console.log(`  Target: "Realistic" (2× HP pot) = 30-60% for every build.`);
  console.log("=".repeat(140));

  const monsterCombatant = makeMonsterCombatant(wyrm);

  // Build the 4 loadout tiers
  const hp35 = CONSUMABLES.find(c => c.type === "heal" && c.healAmount === 35);
  const ghp75 = CONSUMABLES.find(c => c.type === "heal" && c.healAmount === 75);
  const sapping = CONSUMABLES.find(c => c.type === "debuff" && c.effect && c.effect.strMod < 0);
  const stew = CONSUMABLES.find(c => c.type === "pre_buff" && c.strMod);
  const berries = CONSUMABLES.find(c => c.type === "pre_buff" && c.agiMod);
  const tea = CONSUMABLES.find(c => c.type === "pre_buff" && c.intMod);

  if (!hp35 || !ghp75 || !sapping || !stew || !berries || !tea) {
    console.log("!! Missing consumables for wyrm report");
    maxCombatRounds = savedRounds;
    return;
  }

  function getTieredLoadouts(arch: Archetype): { name: string; loadout: ConsumableLoadout }[] {
    const path = arch.statPath;
    const preBuff = path === "str" ? stew : path === "agi" ? berries : tea;
    return [
      { name: "Naked",     loadout: { name: "Naked",     preBuffs: [], inCombat: [] } },
      { name: "2×HP",      loadout: { name: "2×HP",      preBuffs: [], inCombat: [hp35, hp35] } },
      { name: "2×GHP",     loadout: { name: "2×GHP",     preBuffs: [], inCombat: [ghp75, ghp75] } },
      { name: "Full prep",  loadout: { name: "Full prep",  preBuffs: [preBuff], inCombat: [ghp75, sapping] } },
    ];
  }

  // Header
  console.log(
    "\n" + pad("ID", 7) + pad("Class", 10) + pad("Path", 5) + pad("Weapon", 20) +
    (useArmorFlag ? pad("Armor", 18) : "") +
    rpad("HP", 5) + rpad("ARM", 5) +
    rpad("Naked", 7) + rpad("2×HP", 7) + rpad("2×GHP", 7) + rpad("Full", 7) +
    rpad("AvgRnd", 7) + "  Assessment"
  );
  console.log("-".repeat(useArmorFlag ? 130 : 115));

  interface WyrmRow {
    arch: Archetype;
    gear: ReturnType<typeof buildGearLoadout>;
    winRates: number[];  // [naked, 2xHP, 2xGHP, fullPrep]
    avgRounds: number[];
  }

  const rows: WyrmRow[] = [];

  for (const arch of archetypes) {
    const gear = buildGearLoadout(arch, level);
    const combatant = makeCombatant(gear.profile, gear.weapon, arch.advClass, gear.armorRating, arch.className);
    const loadouts = getTieredLoadouts(arch);
    const winRates: number[] = [];
    const avgRounds: number[] = [];

    for (const { loadout } of loadouts) {
      const result = simulate(combatant, monsterCombatant, SIM_ITERATIONS, undefined, false, loadout);
      winRates.push(result.winRate);
      avgRounds.push(result.avgRounds);
    }

    rows.push({ arch, gear, winRates, avgRounds });

    // Assessment based on the "Realistic" tier (2× HP pot)
    const realisticWin = winRates[1];
    let assessment: string;
    if (winRates[0] >= 0.80) assessment = "TOO EASY naked";
    else if (realisticWin >= 0.60) assessment = "easy w/ pots";
    else if (realisticWin >= 0.30) assessment = "GOOD — real fight";
    else if (realisticWin >= 0.10) assessment = "HARD — needs GHP";
    else if (winRates[2] >= 0.20) assessment = "VERY HARD — GHP required";
    else if (winRates[3] >= 0.20) assessment = "BOSS CHECK — full prep only";
    else assessment = "BLOCKED";

    console.log(
      pad(arch.id, 7) + pad(arch.className, 10) + pad(arch.statPath.toUpperCase(), 5) +
      pad(gear.weapon.name, 20) +
      (useArmorFlag ? pad(gear.armor?.name ?? "none", 18) : "") +
      rpad(gear.profile.hp, 5) + rpad(gear.armorRating, 5) +
      rpad((winRates[0] * 100).toFixed(0) + "%", 7) +
      rpad((winRates[1] * 100).toFixed(0) + "%", 7) +
      rpad((winRates[2] * 100).toFixed(0) + "%", 7) +
      rpad((winRates[3] * 100).toFixed(0) + "%", 7) +
      rpad(avgRounds[1].toFixed(1), 7) +
      "  " + assessment
    );
  }

  // Path summary
  console.log("\n--- BY STAT PATH ---");
  for (const path of ["str", "agi", "int"] as const) {
    const pathRows = rows.filter(r => r.arch.statPath === path);
    const avgNaked = pathRows.reduce((s, r) => s + r.winRates[0], 0) / pathRows.length;
    const avg2HP = pathRows.reduce((s, r) => s + r.winRates[1], 0) / pathRows.length;
    const avg2GHP = pathRows.reduce((s, r) => s + r.winRates[2], 0) / pathRows.length;
    const avgFull = pathRows.reduce((s, r) => s + r.winRates[3], 0) / pathRows.length;
    console.log(
      `  ${path.toUpperCase()}: naked ${(avgNaked * 100).toFixed(0)}% → 2×HP ${(avg2HP * 100).toFixed(0)}% → 2×GHP ${(avg2GHP * 100).toFixed(0)}% → full ${(avgFull * 100).toFixed(0)}%`
    );
  }

  // Overall assessment
  console.log("\n--- BALANCE VERDICT ---");
  const realisticWins = rows.map(r => r.winRates[1]);
  const avgRealistic = realisticWins.reduce((a, b) => a + b, 0) / realisticWins.length;
  const inRange = rows.filter(r => r.winRates[1] >= 0.30 && r.winRates[1] <= 0.60);
  const tooEasy = rows.filter(r => r.winRates[0] >= 0.80);
  const blocked = rows.filter(r => r.winRates[2] < 0.10);
  const needsGHP = rows.filter(r => r.winRates[1] < 0.20 && r.winRates[2] >= 0.20);

  console.log(`  Realistic (2×HP) avg: ${(avgRealistic * 100).toFixed(0)}% (target: 30-60%)`);
  console.log(`  Builds in target (30-60% w/ 2×HP): ${inRange.length}/${rows.length}`);
  if (tooEasy.length > 0) console.log(`  !! TOO EASY naked (>= 80%): ${tooEasy.map(r => r.arch.id).join(", ")}`);
  if (needsGHP.length > 0) console.log(`  !! NEED GHP (< 20% w/ HP, >= 20% w/ GHP): ${needsGHP.map(r => r.arch.id).join(", ")}`);
  if (blocked.length > 0) console.log(`  !! BLOCKED (< 10% even w/ GHP): ${blocked.map(r => r.arch.id).join(", ")}`);

  maxCombatRounds = savedRounds;
}

function main() {
  const args = process.argv.slice(2);
  const runAll = args.length === 0;
  const flags = new Set(args.map(a => a.toLowerCase()));

  // ---- 1. Parse CLI flags ----
  const simFlags: SimFlags = {
    useRebalanced: flags.has("--rebalance"),
    useV2: flags.has("--v2"),
    useV3: flags.has("--v3"),
    useArmor: flags.has("--armor"),
    useSpells: flags.has("--spells"),
    useRetunedMonsters: runAll || flags.has("--retuned") || flags.has("--v3"),
    useOnchain: flags.has("--onchain"),
  };
  useArmorFlag = simFlags.useArmor;
  useSpellsFlag = simFlags.useSpells;
  useConsumablesFlag = flags.has("--consumables");
  useF2PProgressionFlag = flags.has("--f2p");

  const roundsIdx = args.findIndex(a => a.toLowerCase() === "--rounds");
  if (roundsIdx !== -1 && args[roundsIdx + 1]) {
    maxCombatRounds = parseInt(args[roundsIdx + 1], 10);
    if (isNaN(maxCombatRounds) || maxCombatRounds < 1) maxCombatRounds = 8;
  }

  // ---- 2. Load on-chain data from zone JSON ----
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const zonePath = resolve(__dirname, "../../zones/dark_cave");
  const constantsPath = resolve(__dirname, "../balance/constants.json");

  const baselineData = loadGameData(zonePath, constantsPath);

  // ---- 3. Apply proposed overrides ----
  const data = applyOverrides(baselineData, simFlags);

  // ---- 4. Set module-level state from loaded data ----
  // Leveling constants
  BASE_HP = data.levelingConstants.baseHp;
  EARLY_GAME_CAP = data.levelingConstants.earlyGameCap;
  MID_GAME_CAP = data.levelingConstants.midGameCap;
  STAT_POINTS_EARLY = data.levelingConstants.statPointsEarly;
  STAT_POINTS_MID = data.levelingConstants.statPointsMid;
  STAT_POINTS_LATE = data.levelingConstants.statPointsLate;
  HP_GAIN_EARLY = data.levelingConstants.hpGainEarly;
  HP_GAIN_MID = data.levelingConstants.hpGainMid;
  HP_GAIN_LATE = data.levelingConstants.hpGainLate;
  POWER_SOURCE_BONUS_LEVEL = data.levelingConstants.powerSourceBonusLevel;
  CLASS_MULTIPLIER_BASE = data.combatConstants.classMultiplierBase;

  // Combat constants
  ATTACK_MODIFIER = data.combatConstants.attackModifier;
  AGI_ATTACK_MODIFIER = data.combatConstants.agiAttackModifier;
  CRIT_MULTIPLIER = data.combatConstants.critMultiplier;
  CRIT_BASE_CHANCE = data.combatConstants.critBaseChance;
  EVASION_CAP = data.combatConstants.evasionCap;
  DOUBLE_STRIKE_CAP = data.combatConstants.doubleStrikeCap;
  COMBAT_TRIANGLE_PER_STAT = data.combatConstants.combatTrianglePerStat;
  COMBAT_TRIANGLE_MAX = data.combatConstants.combatTriangleMax;
  MAGIC_RESIST_PER_INT = data.combatConstants.magicResistPerInt;
  MAGIC_RESIST_CAP = data.combatConstants.magicResistCap;
  BLOCK_CHANCE_PER_STR = data.combatConstants.blockChancePerStr;
  BLOCK_CHANCE_CAP = data.combatConstants.blockChanceCap;
  BLOCK_REDUCTION_PHYS = data.combatConstants.blockReductionPhys;
  BLOCK_REDUCTION_MAGIC = data.combatConstants.blockReductionMagic;

  // Game data
  RACES = data.races;
  STARTING_ARMORS = data.startingArmors;
  POWER_SOURCES = data.powerSources;
  CLASSES = data.classes;
  BASE_ROLLS = data.baseRolls;
  WEAPONS = baselineData.weapons;  // Keep baseline for --compare
  ARMORS = data.armors;
  MONSTERS = data.monsters;
  CONSUMABLES = data.consumables;
  CLASS_SPELLS = data.classSpells;
  WEAPON_EFFECTS = data.weaponEffects;
  MONSTER_WEAPON_EFFECTS = data.monsterWeaponEffects;
  ARCHETYPE_CONFIGS = data.archetypeConfigs;

  // Active weapons = whatever the overrides selected (or baseline)
  activeWeapons = [...data.weapons];

  // Build wyrm loadouts now that consumables are loaded
  WYRM_LOADOUTS = buildWyrmLoadouts();

  // ---- 5. Print banner ----
  const variant = simFlags.useV3 ? "V3 — epic hybrids + pure nerfs" :
                  simFlags.useV2 ? "V2 — secondary stat requirements" :
                  simFlags.useRebalanced ? "REBALANCED" : "BASELINE (on-chain)";
  console.log(`Balance Layer 3: Weapons & Combat Viability (${variant})`);
  if (useArmorFlag) console.log("  + L4 ARMOR ENABLED (equipped armor affects stats + defense)");
  if (useSpellsFlag) console.log("  + L5 CLASS SPELLS ENABLED (spell costs round 1 weapon attack)");
  if (useConsumablesFlag) console.log("  + L6 CONSUMABLES ENABLED (path-appropriate buff + HP pot in PvP)");
  if (useF2PProgressionFlag) console.log("  + F2P PROGRESSION: weapon/armor rarity gated by level (L1:R0, L2-3:R1, L4-5:R2, L6-7:R3, L8+:R4)");
  console.log(`  Max rounds: ${maxCombatRounds} (≈ ${maxCombatRounds * 2} on-chain turns). --rounds N to change.`);
  console.log(`  Data: ${zonePath}`);
  console.log(`Simulating with ${SIM_ITERATIONS} iterations per matchup...\n`);

  // ---- 6. Run reports ----
  const archetypes = buildArchetypes();

  if (flags.has("--compare")) {
    reportCompare(archetypes);
  } else {
    if (runAll || flags.has("--equip")) reportEquip(archetypes);
    if (runAll || flags.has("--pve")) reportPvE(archetypes);
    if (runAll || flags.has("--pvp")) reportPvP(archetypes);
    if (runAll || flags.has("--viability")) reportViability(archetypes);
    if (runAll || flags.has("--weapons")) reportWeapons(archetypes);
    if (flags.has("--tradeoffs")) reportTradeoffs(archetypes);
    if (flags.has("--hybrid")) reportHybrid(archetypes);
    if (flags.has("--wyrm")) reportWyrm(archetypes);
    if (runAll) reportSummary(archetypes);
  }

  console.log("\n");
}

main();
