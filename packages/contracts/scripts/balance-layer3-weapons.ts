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
 *   --v3         Use V3 weapons (epic hybrids + pure nerfs + effects)
 *   --rounds N   Set max combat rounds (default: 8, matching 15 on-chain turns)
 *   No flags = run everything + summary
 */

// ============================================================
// CONSTANTS
// ============================================================

const BASE_HP = 18;
const EARLY_GAME_CAP = 10;
const MID_GAME_CAP = 50;

const STAT_POINTS_EARLY = 1;
const STAT_POINTS_MID = 1;
const STAT_POINTS_LATE = 1;
const HP_GAIN_EARLY = 2;
const HP_GAIN_MID = 1;
const HP_GAIN_LATE = 1;

const POWER_SOURCE_BONUS_LEVEL = 5;
const CLASS_MULTIPLIER_BASE = 1000;

// Combat constants (from L1 model — source of truth)
const ATTACK_MODIFIER = 1.2;
const AGI_ATTACK_MODIFIER = 1.0;
const CRIT_MULTIPLIER = 2;
const CRIT_BASE_CHANCE = 5; // percent
const EVASION_CAP = 35;     // percent
const DOUBLE_STRIKE_CAP = 40; // percent
const COMBAT_TRIANGLE_PER_STAT = 0.02; // 2% per stat point (L1 decision)
const COMBAT_TRIANGLE_MAX = 0.12;      // 12% cap — tiebreaker, not primary driver
const MAGIC_RESIST_PER_INT = 3;        // percent
const MAGIC_RESIST_CAP = 40;           // percent
// Armor does NOT reduce magic — that's INT's advantage over STR.
// AGI's defense vs magic is evasion (dodge the spell entirely).
// STR's defense is BLOCK — chance to reduce all incoming damage.
const BLOCK_CHANCE_PER_STR = 2;        // % per STR point above 10
const BLOCK_CHANCE_CAP = 30;           // % max
const BLOCK_REDUCTION_PHYS = 0.50;     // 50% damage reduction on block
const BLOCK_REDUCTION_MAGIC = 0.0;     // block doesn't reduce magic (can't block a fireball)

const SIM_ITERATIONS = 500; // Monte Carlo iterations per matchup

// Max combat rounds per fight. On-chain DEFAULT_MAX_TURNS = 15, each sim round = 2 on-chain turns.
// 8 rounds ≈ 15 on-chain turns (both sides act per round, round 1 spell cast counts as a turn).
// Configurable via --rounds N flag. Draws count as defender/monster win.
let maxCombatRounds = 8;

// ============================================================
// TYPES
// ============================================================

interface Race { name: string; str: number; agi: number; int: number; hp: number; }
interface StartingArmor { name: string; str: number; agi: number; int: number; hp: number; }
interface PowerSource { name: string; type: "divine" | "weave" | "physical"; }

interface AdvancedClass {
  name: string;
  flatStr: number; flatAgi: number; flatInt: number; flatHp: number;
  physMult: number; spellMult: number; healMult: number; critMult: number; hpMult: number;
}

interface Weapon {
  name: string;
  minDamage: number;
  maxDamage: number;
  strMod: number;
  agiMod: number;
  intMod: number;
  hpMod: number;
  scaling: "str" | "agi";
  isMagic: boolean;
  minStr: number;
  minAgi: number;
  minInt: number;
  rarity: number;
  price: number;
}

interface Monster {
  name: string;
  level: number;
  str: number;
  agi: number;
  int: number;
  hp: number;
  armor: number;
  classType: number; // 0=warrior, 1=rogue, 2=mage
  xp: number;
  weaponMinDmg: number;
  weaponMaxDmg: number;
  weaponScaling: "str" | "agi";
  weaponIsMagic: boolean;
}

interface Archetype {
  id: string;
  name: string;
  className: string;
  advClass: AdvancedClass;
  race: Race;
  startingArmor: StartingArmor;
  powerSource: PowerSource;
  statPath: "str" | "agi" | "int";
  baseRoll: { str: number; agi: number; int: number };
}

interface StatProfile {
  str: number; agi: number; int: number; hp: number;
  totalStats: number; primaryStat: number; dominantType: string;
}

interface Combatant {
  str: number; agi: number; int: number;
  hp: number; maxHp: number; armor: number;
  weapon: Weapon;
  physMult: number; spellMult: number; critMult: number; hpMult: number;
  dominantType: string;
  dominantStat: number;
  className: string;
}

// ============================================================
// CLASS SPELLS (L5) — cast once on turn 1, replacing weapon attack
// Self-buffs boost caster stats for duration turns.
// Debuffs weaken opponent for duration turns.
// Damage spells deal instant magic damage.
// ============================================================

interface ClassSpell {
  name: string;
  type: "self_buff" | "debuff" | "magic_damage" | "damage_debuff" | "damage_buff";
  // Percentage-based stat modifiers — scale with caster's stat (buffs) or target's stat (debuffs).
  // E.g., strPct: 0.15 on a self_buff = +15% of caster's STR. On a debuff = -15% of target's STR.
  // Flat mods still available for things like armor that don't scale the same way.
  strPct?: number;
  agiPct?: number;
  intPct?: number;
  armorMod?: number;    // Flat armor (doesn't scale as fast as stats)
  hpPct?: number;       // % of caster's maxHp added
  duration?: number;
  // Magic damage spells: base damage scales with caster INT via dmgPerInt.
  // Total damage = baseDmg + (casterInt × dmgPerInt).
  baseDmgMin?: number;
  baseDmgMax?: number;
  dmgPerInt?: number;   // Scaling factor per INT point
  // Physical damage spells: base damage scales with caster STR/AGI.
  // Total damage = baseDmg + (stat × dmgPerStat). Reduced by armor, not magic resist.
  dmgPerStr?: number;   // Scaling factor per STR point (Warrior, Paladin)
  dmgPerAgi?: number;   // Scaling factor per AGI point (Ranger, Rogue)
}

// Spell durations tuned relative to fight length (~5-6 rounds avg, 8 round cap).
// Duration N = active for N sim rounds (both sides attack each round).
// On-chain validTurns ≈ duration × 2 (since each sim round = 2 on-chain turns).
//
// SCALING DESIGN:
//   - Buff/debuff stats use percentages so they scale with character progression.
//     At L10 with ~25 primary stat, 15% = +3.75. At L50 with ~55, 15% = +8.25.
//   - Magic damage spells use baseDmg + (INT × dmgPerInt), reduced by magic resist.
//   - Physical damage spells use baseDmg + (STR/AGI × dmgPerStat), reduced by armor.
//   - STR/AGI classes get hybrid damage+buff/debuff spells (damage compensates for lost weapon swing).
//   - Armor mods stay flat — armor values grow slower than stats across zones.
//   - hpPct scales with maxHp which grows with level.
const CLASS_SPELLS: Record<string, ClassSpell> = {
  // STR classes: physical damage (STR-scaled) + self-buff. Damage ≈ one weapon swing so buff is pure upside.
  Warrior:  { name: "Battle Cry",    type: "damage_buff",   baseDmgMin: 4, baseDmgMax: 8, dmgPerStr: 0.4, strPct: 0.15, armorMod: 3, duration: 6 },
  Paladin:  { name: "Divine Shield", type: "damage_buff",   baseDmgMin: 3, baseDmgMax: 7, dmgPerStr: 0.35, strPct: 0.12, armorMod: 5, duration: 6 },

  // AGI classes: physical damage (AGI-scaled) + buff/debuff
  Ranger:   { name: "Hunter's Mark", type: "damage_debuff", baseDmgMin: 3, baseDmgMax: 7, dmgPerAgi: 0.35, agiPct: -0.15, armorMod: -2, duration: 6 },
  Rogue:    { name: "Shadowstep",    type: "damage_buff",   baseDmgMin: 4, baseDmgMax: 8, dmgPerAgi: 0.4, agiPct: 0.25, duration: 4 },

  // Hybrid: Druid deals nature (magic) damage + debuffs multiple stats
  Druid:    { name: "Entangle",      type: "damage_debuff", baseDmgMin: 3, baseDmgMax: 6, dmgPerInt: 0.3, agiPct: -0.15, strPct: -0.10, duration: 6 },

  // INT classes: damage spells that scale with INT
  Warlock:  { name: "Soul Drain",    type: "damage_debuff", baseDmgMin: 4, baseDmgMax: 8, dmgPerInt: 0.4, strPct: -0.12, intPct: -0.12, duration: 5 },
  Wizard:   { name: "Arcane Blast",  type: "magic_damage",  baseDmgMin: 5, baseDmgMax: 10, dmgPerInt: 0.5 },
  Sorcerer: { name: "Arcane Surge",  type: "magic_damage",  baseDmgMin: 4, baseDmgMax: 8, dmgPerInt: 0.4 },
  Cleric:   { name: "Blessing",      type: "self_buff",     intPct: 0.12, armorMod: 5, hpPct: 0.10, duration: 6 },
};

interface CombatResult {
  attackerWins: number;
  defenderWins: number;
  avgRounds: number;
  avgDamagePerRound: number;
  winRate: number;
  iterations: number;
}

// ============================================================
// WEAPON EFFECTS — from dark_cave/effects.json + items.json
// All status effects have resistanceStat = 0 (None) → always land.
// ============================================================

interface WeaponEffect {
  type: "dot" | "stat_debuff" | "dual_magic" | "magic_breath";
  name: string;
  damagePerTick?: number;
  maxStacks?: number;
  duration?: number;  // combat turns
  cooldown?: number;  // turns between applications
  strMod?: number;
  agiMod?: number;
  intMod?: number;
  armorMod?: number;
  minDmg?: number;    // for magic_breath: base damage range
  maxDmg?: number;
}

interface ActiveEffectInstance {
  name: string;
  type: "dot" | "stat_debuff" | "self_buff";
  turnsRemaining: number;
  damagePerTick: number;
  strMod: number;
  agiMod: number;
  intMod: number;
  armorMod: number;
}

// Effects by weapon name — looked up at combat time, no need to modify weapon arrays
const WEAPON_EFFECTS: Record<string, WeaponEffect[]> = {
  // Current weapons (from items.json)
  "Dire Rat Fang":        [{ type: "dot", name: "poison", damagePerTick: 3, maxStacks: 2, duration: 8, cooldown: 2 }],
  "Sporecap Wand":        [{ type: "dual_magic", name: "dual_magic" }],
  "Bone Staff":           [{ type: "dual_magic", name: "dual_magic" }],
  // V3 epic weapons — proposed effects
  "Phasefang":  [
    { type: "dot", name: "poison", damagePerTick: 3, maxStacks: 2, duration: 8, cooldown: 2 },
    { type: "stat_debuff", name: "blind", agiMod: -8, duration: 8, cooldown: 3 },
  ],
  "Trollhide Cleaver": [{ type: "stat_debuff", name: "weaken", strMod: -8, duration: 8, cooldown: 3 }],
  "Drakescale Staff":   [{ type: "stat_debuff", name: "stupify", intMod: -8, duration: 8, cooldown: 3 }],
};

// Monster weapon effects — keyed by monster name, applied to monster combatant weapon
const MONSTER_WEAPON_EFFECTS: Record<string, WeaponEffect[]> = {
  "Dire Rat": [{ type: "dot", name: "poison", damagePerTick: 3, maxStacks: 2, duration: 8, cooldown: 2 }],
  // Basilisk has 3 attack types: physical bite (main weapon), petrifying gaze (magic effect), venom DoT.
  // Every build resists ONE type but eats the other — natural balance compression.
  // STR tanks: resist bite (armor), eat gaze. INT casters: resist gaze (magic resist), eat bite. AGI: dodge some of both.
  "Basilisk": [
    { type: "magic_breath", name: "gaze", minDmg: 6, maxDmg: 10, cooldown: 2 },
    { type: "dot", name: "venom", damagePerTick: 5, maxStacks: 1, duration: 6, cooldown: 3 },
  ],
};

function getWeaponEffects(weaponName: string): WeaponEffect[] {
  return WEAPON_EFFECTS[weaponName] || MONSTER_WEAPON_EFFECTS[weaponName] || [];
}

// ============================================================
// CONSUMABLES (L6) — from dark_cave/effects.json + items.json
//
// Two categories:
//   1. PRE-COMBAT BUFFS: validTime-based (600s), applied before fight, last entire combat.
//      No turn cost. Player uses from inventory before engaging.
//      These are: Fortifying Stew (+5 STR), Quickening Mushrooms (+5 AGI), Focusing Draught (+5 INT).
//
//   2. IN-COMBAT ITEMS: validTurns-based or instant. Cost 1 weapon attack turn (like spells).
//      Player chooses to use instead of attacking on a given round.
//      Health potions heal instantly. Debuffs/tradeoff buffs apply for N turns.
//
// On-chain: consumables are used from inventory (not equipment slots).
// Sim model: pre-combat buffs modify combatant stats before fight starts.
//            In-combat items are used on optimal round (turn 1 for debuffs, when HP low for potions).
// ============================================================

interface Consumable {
  name: string;
  type: "pre_buff" | "heal" | "debuff" | "tradeoff_buff" | "cleanse";
  // Pre-combat buffs
  strMod?: number;
  agiMod?: number;
  intMod?: number;
  armorMod?: number;
  // Heals
  healAmount?: number;
  // In-combat effects (debuffs applied to target, tradeoff_buffs to self)
  effect?: {
    strMod: number;
    agiMod: number;
    intMod: number;
    armorMod: number;
    damagePerTick: number;
    duration: number;
    maxStacks: number;
    cooldown: number;
  };
  rarity: number;
  price: number;  // in gold
}

const CONSUMABLES: Consumable[] = [
  // Pre-combat stat buffs (validTime: 600, validTurns: 0 — persist entire fight)
  { name: "Fortifying Stew",     type: "pre_buff", strMod: 5, rarity: 1, price: 20 },
  { name: "Quickening Mushrooms",  type: "pre_buff", agiMod: 5, rarity: 1, price: 20 },
  { name: "Focusing Draught",        type: "pre_buff", intMod: 5, rarity: 1, price: 20 },

  // Health potions (instant heal, costs 1 turn)
  { name: "Minor Health Potion",    type: "heal", healAmount: 15,  rarity: 1, price: 10 },
  { name: "Health Potion",          type: "heal", healAmount: 35,  rarity: 2, price: 25 },
  { name: "Greater Health Potion",  type: "heal", healAmount: 75,  rarity: 3, price: 60 },
  { name: "Superior Health Potion", type: "heal", healAmount: 150, rarity: 4, price: 150 },

  // Tradeoff self-buffs (costs 1 turn, duration 3 turns)
  { name: "Bloodrage Tonic", type: "tradeoff_buff", rarity: 1, price: 25, effect: { strMod: 6, agiMod: 0, intMod: 0, armorMod: -4, damagePerTick: 0, duration: 3, maxStacks: 1, cooldown: 0 } },
  { name: "Stoneskin Salve", type: "tradeoff_buff", rarity: 1, price: 25, effect: { strMod: 0, agiMod: -4, intMod: 0, armorMod: 6, damagePerTick: 0, duration: 3, maxStacks: 1, cooldown: 0 } },
  { name: "Trollblood Ale",  type: "tradeoff_buff", rarity: 1, price: 25, effect: { strMod: 8, agiMod: -3, intMod: -5, armorMod: 0, damagePerTick: 0, duration: 3, maxStacks: 1, cooldown: 0 } },

  // Debuffs (costs 1 turn, applied to target)
  { name: "Venom Vial",     type: "debuff", rarity: 1, price: 35, effect: { strMod: 0, agiMod: 0, intMod: 0, armorMod: 0, damagePerTick: 3, duration: 8, maxStacks: 2, cooldown: 2 } },
  { name: "Spore Cloud",    type: "debuff", rarity: 1, price: 35, effect: { strMod: 0, agiMod: 0, intMod: -8, armorMod: 0, damagePerTick: 0, duration: 8, maxStacks: 1, cooldown: 3 } },
  { name: "Sapping Poison", type: "debuff", rarity: 1, price: 35, effect: { strMod: -8, agiMod: 0, intMod: 0, armorMod: 0, damagePerTick: 0, duration: 8, maxStacks: 1, cooldown: 3 } },
  { name: "Smoke Bomb",     type: "debuff", rarity: 2, price: 35, effect: { strMod: 0, agiMod: -8, intMod: 0, armorMod: 0, damagePerTick: 0, duration: 8, maxStacks: 1, cooldown: 3 } },

  // Cleanse
  { name: "Antidote", type: "cleanse", rarity: 1, price: 15 },
];

// Consumable loadout: what a player brings into a fight
interface ConsumableLoadout {
  name: string;                 // Human-readable loadout name
  preBuffs: Consumable[];       // Applied before combat (no turn cost)
  inCombat: Consumable[];       // Used during combat (costs turn)
}

// Consumable indices for convenience
const C_STEW = 0, C_BERRIES = 1, C_TEA = 2;
const C_MINOR_HP = 3, C_HP = 4, C_GREATER_HP = 5, C_SUPERIOR_HP = 6;
const C_BLOODRAGE = 7, C_STONESKIN = 8, C_TROLLBLOOD = 9;
const C_VENOM = 10, C_SPORE = 11, C_SAPPING = 12, C_SMOKE = 13;
const C_ANTIDOTE = 14;

// Pre-defined loadouts for testing
const WYRM_LOADOUTS: ConsumableLoadout[] = [
  { name: "No consumables", preBuffs: [], inCombat: [] },
  // Single pre-buff
  { name: "+STR buff", preBuffs: [CONSUMABLES[C_STEW]], inCombat: [] },
  { name: "+AGI buff", preBuffs: [CONSUMABLES[C_BERRIES]], inCombat: [] },
  { name: "+INT buff", preBuffs: [CONSUMABLES[C_TEA]], inCombat: [] },
  // Pre-buff + heal
  { name: "+STR + Greater HP", preBuffs: [CONSUMABLES[C_STEW]], inCombat: [CONSUMABLES[C_GREATER_HP]] },
  { name: "+AGI + Greater HP", preBuffs: [CONSUMABLES[C_BERRIES]], inCombat: [CONSUMABLES[C_GREATER_HP]] },
  { name: "+INT + Greater HP", preBuffs: [CONSUMABLES[C_TEA]], inCombat: [CONSUMABLES[C_GREATER_HP]] },
  // Pre-buff + debuff (Sapping Poison = -8 STR on Basilisk, huge vs Warrior boss)
  { name: "+STR + Sapping",    preBuffs: [CONSUMABLES[C_STEW]], inCombat: [CONSUMABLES[C_SAPPING]] },
  { name: "+AGI + Sapping",    preBuffs: [CONSUMABLES[C_BERRIES]], inCombat: [CONSUMABLES[C_SAPPING]] },
  { name: "+INT + Sapping",    preBuffs: [CONSUMABLES[C_TEA]], inCombat: [CONSUMABLES[C_SAPPING]] },
  // Full kit: pre-buff + heal + debuff (3 consumable slots used)
  { name: "+STR + GHP + Sapping", preBuffs: [CONSUMABLES[C_STEW]], inCombat: [CONSUMABLES[C_GREATER_HP], CONSUMABLES[C_SAPPING]] },
  { name: "+AGI + GHP + Sapping", preBuffs: [CONSUMABLES[C_BERRIES]], inCombat: [CONSUMABLES[C_GREATER_HP], CONSUMABLES[C_SAPPING]] },
  { name: "+INT + GHP + Sapping", preBuffs: [CONSUMABLES[C_TEA]], inCombat: [CONSUMABLES[C_GREATER_HP], CONSUMABLES[C_SAPPING]] },
  // Antidote (Basilisk applies venom — does cleansing help?)
  { name: "+STR + Antidote", preBuffs: [CONSUMABLES[C_STEW]], inCombat: [CONSUMABLES[C_ANTIDOTE]] },
];

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

// ============================================================
// DATA: Races, Armor, Classes, Power Sources
// ============================================================

const RACES: Record<string, Race> = {
  human: { name: "Human", str: 1, agi: 1, int: 1, hp: 0 },
  dwarf: { name: "Dwarf", str: 2, agi: -1, int: 0, hp: 1 },
  elf:   { name: "Elf",   str: -1, agi: 2, int: 1, hp: -1 },
};

const STARTING_ARMORS: Record<string, StartingArmor> = {
  cloth:   { name: "Cloth",   str: -1, agi: 1, int: 2, hp: 0 },
  leather: { name: "Leather", str: 1,  agi: 2, int: 0, hp: 0 },
  plate:   { name: "Plate",   str: 2,  agi: -1, int: 0, hp: 1 },
};

const POWER_SOURCES: Record<string, PowerSource> = {
  physical: { name: "Physical", type: "physical" },
  weave:    { name: "Weave",    type: "weave" },
  divine:   { name: "Divine",   type: "divine" },
};

const CLASSES: Record<string, AdvancedClass> = {
  warrior:  { name: "Warrior",  flatStr: 3, flatAgi: 0, flatInt: 0, flatHp: 10, physMult: 1100, spellMult: 1000, healMult: 1000, critMult: 1000, hpMult: 1000 },
  paladin:  { name: "Paladin",  flatStr: 2, flatAgi: 0, flatInt: 0, flatHp: 15, physMult: 1050, spellMult: 1000, healMult: 1050, critMult: 1000, hpMult: 1000 },
  ranger:   { name: "Ranger",   flatStr: 0, flatAgi: 3, flatInt: 0, flatHp: 0,  physMult: 1100, spellMult: 1000, healMult: 1000, critMult: 1000, hpMult: 1000 },
  rogue:    { name: "Rogue",    flatStr: 0, flatAgi: 2, flatInt: 1, flatHp: 0,  physMult: 1000, spellMult: 1000, healMult: 1000, critMult: 1150, hpMult: 1000 },
  druid:    { name: "Druid",    flatStr: 2, flatAgi: 2, flatInt: 0, flatHp: 0,  physMult: 1050, spellMult: 1050, healMult: 1000, critMult: 1000, hpMult: 1050 },
  warlock:  { name: "Warlock",  flatStr: 0, flatAgi: 2, flatInt: 2, flatHp: 0,  physMult: 1000, spellMult: 1200, healMult: 1000, critMult: 1000, hpMult: 1000 },
  wizard:   { name: "Wizard",   flatStr: 0, flatAgi: 0, flatInt: 3, flatHp: 0,  physMult: 1000, spellMult: 1250, healMult: 1000, critMult: 1000, hpMult: 1000 },
  cleric:   { name: "Cleric",   flatStr: 0, flatAgi: 0, flatInt: 2, flatHp: 10, physMult: 1000, spellMult: 1000, healMult: 1100, critMult: 1000, hpMult: 1000 },
  sorcerer: { name: "Sorcerer", flatStr: 2, flatAgi: 0, flatInt: 2, flatHp: 0,  physMult: 1000, spellMult: 1150, healMult: 1000, critMult: 1000, hpMult: 1050 },
};

const BASE_ROLLS = {
  str: { str: 8, agi: 5, int: 6 },
  agi: { str: 5, agi: 8, int: 6 },
  int: { str: 5, agi: 6, int: 8 },
};

// ============================================================
// DATA: Weapons (from dark_cave/items.json)
// ============================================================

const WEAPONS: Weapon[] = [
  // Starters (R0)
  { name: "Broken Sword",     minDamage: 1, maxDamage: 1, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Worn Shortbow",    minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 1, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Cracked Wand",     minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },

  // R1
  { name: "Iron Axe",         minDamage: 1, maxDamage: 2, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Hunting Bow",      minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 1, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 8,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Apprentice Staff",  minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 1, hpMod: 2, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 6,  rarity: 1, price: 15 },
  { name: "Steel Mace",       minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 9,  minAgi: 0,  minInt: 0,  rarity: 1, price: 40 },
  { name: "Shortbow",      minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 7,  minInt: 0,  rarity: 1, price: 40 },
  { name: "Channeling Rod",   minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 0, intMod: 2, hpMod: 2, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 10, rarity: 1, price: 40 },
  { name: "Notched Blade",     minDamage: 2, maxDamage: 3, strMod: 1, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 5,  rarity: 1, price: 50 },

  // R2
  { name: "Brute's Cleaver",  minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 7,  minAgi: 0,  minInt: 0,  rarity: 2, price: 60 },
  { name: "Sporecap Wand",    minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 5,  rarity: 2, price: 60 },
  { name: "Crystal Shard",    minDamage: 6, maxDamage: 9, strMod: 1, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 5,  rarity: 2, price: 70 },
  { name: "Webspinner Bow",   minDamage: 3, maxDamage: 4, strMod: 0, agiMod: 3, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 10, minInt: 0,  rarity: 2, price: 90 },
  { name: "Warhammer",        minDamage: 4, maxDamage: 7, strMod: 3, agiMod: 0, intMod: 0, hpMod: 8, scaling: "str", isMagic: false, minStr: 13, minAgi: 0,  minInt: 0,  rarity: 2, price: 100 },
  { name: "Longbow",          minDamage: 4, maxDamage: 6, strMod: 0, agiMod: 3, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 15, minInt: 0,  rarity: 2, price: 100 },
  { name: "Mage Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 11, rarity: 2, price: 100 },

  // R3
  { name: "Dire Rat Fang",  minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 3, price: 150 },
  { name: "Troll's Cudgel", minDamage: 4, maxDamage: 6, strMod: 3, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 12, minAgi: 0,  minInt: 0,  rarity: 3, price: 180 },
  { name: "Bone Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 3, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 13, rarity: 3, price: 180 },
  { name: "Stone Maul",     minDamage: 5, maxDamage: 7, strMod: 4, agiMod: 0, intMod: 0, hpMod: 8, scaling: "str", isMagic: false, minStr: 15, minAgi: 0,  minInt: 0,  rarity: 3, price: 250 },

  // R4
  { name: "Darkwood Bow",     minDamage: 6, maxDamage: 9, strMod: 2, agiMod: 5, intMod: 0, hpMod: 3, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 18, minInt: 0,  rarity: 4, price: 220 },
  { name: "Smoldering Rod",   minDamage: 5, maxDamage: 8, strMod: 0, agiMod: 2, intMod: 5, hpMod: 5, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 16, rarity: 4, price: 300 },
];

// ============================================================
// REBALANCED WEAPONS V1 — stat changes only, no requirement changes
// ============================================================

const WEAPONS_REBALANCED: Weapon[] = [
  // Starters (R0) — unchanged
  { name: "Broken Sword",     minDamage: 1, maxDamage: 1, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Worn Shortbow",    minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 1, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Cracked Wand",     minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },

  // R1 — STR HP reduced, AGI gets HP
  { name: "Iron Axe",         minDamage: 1, maxDamage: 2, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Hunting Bow",      minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 1, intMod: 0, hpMod: 2, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 8,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Apprentice Staff",  minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 1, hpMod: 2, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 6,  rarity: 1, price: 15 },
  { name: "Steel Mace",       minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 9,  minAgi: 0,  minInt: 0,  rarity: 1, price: 40 },
  { name: "Shortbow",      minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 3, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 7,  minInt: 0,  rarity: 1, price: 40 },
  { name: "Channeling Rod",   minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 10, rarity: 1, price: 40 },
  { name: "Notched Blade",     minDamage: 2, maxDamage: 3, strMod: 1, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 5,  rarity: 1, price: 50 },

  // R2
  { name: "Brute's Cleaver",  minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 2, scaling: "str", isMagic: false, minStr: 7,  minAgi: 0,  minInt: 0,  rarity: 2, price: 60 },
  { name: "Sporecap Wand",    minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 5,  rarity: 2, price: 60 },
  { name: "Crystal Shard",    minDamage: 4, maxDamage: 6, strMod: 1, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 5,  rarity: 2, price: 70 },
  { name: "Webspinner Bow",   minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 10, minInt: 0,  rarity: 2, price: 90 },
  { name: "Warhammer",        minDamage: 4, maxDamage: 7, strMod: 3, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 13, minAgi: 0,  minInt: 0,  rarity: 2, price: 100 },
  { name: "Longbow",          minDamage: 4, maxDamage: 7, strMod: 0, agiMod: 3, intMod: 0, hpMod: 5, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 15, minInt: 0,  rarity: 2, price: 100 },
  { name: "Mage Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 11, rarity: 2, price: 100 },

  // R3
  { name: "Dire Rat Fang",  minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 3, price: 150 },
  { name: "Troll's Cudgel", minDamage: 4, maxDamage: 6, strMod: 3, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 12, minAgi: 0,  minInt: 0,  rarity: 3, price: 180 },
  { name: "Bone Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 13, rarity: 3, price: 180 },
  { name: "Stone Maul",     minDamage: 5, maxDamage: 7, strMod: 4, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 15, minAgi: 0,  minInt: 0,  rarity: 3, price: 250 },

  // R4
  { name: "Darkwood Bow",     minDamage: 7, maxDamage: 10,strMod: 2, agiMod: 5, intMod: 0, hpMod: 6, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 18, minInt: 0,  rarity: 4, price: 220 },
  { name: "Smoldering Rod",   minDamage: 5, maxDamage: 8, strMod: 0, agiMod: 2, intMod: 5, hpMod: 6, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 16, rarity: 4, price: 300 },
];

// ============================================================
// REBALANCED WEAPONS V2 — stat changes + secondary stat requirements
// Goal: endgame weapons cost 3-5 off-path points to equip.
// Creates real tradeoffs: better weapon = weaker primary stat.
//
// Secondary stat logic (taxes the path that uses the weapon):
//   STR weapons → require some AGI (STR builds have base AGI 3-6)
//   AGI weapons → require some STR (AGI builds have base STR 5)
//   INT weapons → require some STR (INT builds have base STR 3)
//
// Budget context at L10: 21 stat points total.
//   Weapon req cost: ~3-5 off-path
//   Armor req cost:  ~3-5 off-path (designed in L4)
//   Remaining for primary: ~11-15 (from 21)
//   Total primary: base(12-15) + allocated(11-15) = 23-30
//
// Hard constraints:
//   - Every L10 build must beat Dusk Drake (18/18/20, 70 HP, 3 armor)
//   - Every L10 build must have >30% PvP win rate
// ============================================================

interface Armor {
  name: string;
  armorValue: number;
  strMod: number; agiMod: number; intMod: number; hpMod: number;
  minStr: number; minAgi: number; minInt: number;
  armorType: "Plate" | "Leather" | "Cloth";
  rarity: number;
  price: number;
}

// ============================================================
// DATA: Equipped Armor (L4 — separate slot from weapons)
// Secondary stat requirements: STR armor→INT, AGI armor→INT, INT armor→AGI
// This creates independent stat demands from weapons (which use STR→AGI, AGI→STR, INT→STR).
// Armor stat bonuses count toward weapon requirements (creates gear dependency tension).
// ============================================================

const ARMORS: Armor[] = [
  // ---- R0: Starters — no reqs, everyone gets basic armor ----
  { name: "Tattered Cloth",     armorValue: 1, strMod: 0,  agiMod: 0, intMod: 1, hpMod: 0, minStr: 0,  minAgi: 0,  minInt: 0,  armorType: "Cloth",   rarity: 0, price: 5 },
  { name: "Worn Leather Vest",  armorValue: 2, strMod: -1, agiMod: 1, intMod: 0, hpMod: 0, minStr: 0,  minAgi: 0,  minInt: 0,  armorType: "Leather", rarity: 0, price: 5 },
  { name: "Rusty Chainmail",    armorValue: 3, strMod: 0,  agiMod: -1,intMod: 0, hpMod: 0, minStr: 0,  minAgi: 0,  minInt: 0,  armorType: "Plate",   rarity: 0, price: 5 },

  // ---- R1: Single primary req, early game ----
  { name: "Padded Armor",       armorValue: 3, strMod: 1,  agiMod: 0, intMod: 0, hpMod: 0, minStr: 8,  minAgi: 0,  minInt: 0,  armorType: "Plate",   rarity: 1, price: 15 },
  { name: "Leather Jerkin",     armorValue: 2, strMod: 0,  agiMod: 1, intMod: 0, hpMod: 0, minStr: 0,  minAgi: 5,  minInt: 0,  armorType: "Leather", rarity: 1, price: 15 },
  { name: "Apprentice Robes",   armorValue: 1, strMod: 0,  agiMod: 0, intMod: 1, hpMod: 0, minStr: 0,  minAgi: 0,  minInt: 7,  armorType: "Cloth",   rarity: 1, price: 15 },
  { name: "Studded Leather",    armorValue: 5, strMod: 1,  agiMod: 0, intMod: 0, hpMod: 5, minStr: 8,  minAgi: 0,  minInt: 0,  armorType: "Plate",   rarity: 1, price: 40 },
  { name: "Scout Armor",        armorValue: 4, strMod: 0,  agiMod: 2, intMod: 0, hpMod: 0, minStr: 0,  minAgi: 10, minInt: 0,  armorType: "Leather", rarity: 1, price: 40 },
  { name: "Acolyte Vestments",  armorValue: 2, strMod: 0,  agiMod: 0, intMod: 2, hpMod: 0, minStr: 0,  minAgi: 0,  minInt: 7,  armorType: "Cloth",   rarity: 1, price: 40 },

  // ---- R2: Primary + secondary req. Costs 0-1 off-path points. ----
  // STR→INT secondary: WAR/PAL/RAN/DRU pure STR have INT 6, need 1pt for INT 7
  // AGI→INT secondary: WAR/PAL/RAN/DRU pure AGI have INT 7, need 1pt for INT 8
  // INT→AGI secondary: WAR/PAL/WIZ/CLR/SOR pure INT have AGI 9, need 1pt for AGI 10
  { name: "Chainmail Shirt",    armorValue: 8, strMod: 2,  agiMod: 0, intMod: 0, hpMod: 8, minStr: 12, minAgi: 0,  minInt: 7,  armorType: "Plate",   rarity: 2, price: 100 },   // INT 7 costs WAR/PAL/RAN/DRU-S 1pt
  { name: "Ranger Leathers",    armorValue: 6, strMod: 0,  agiMod: 3, intMod: 0, hpMod: 0, minStr: 0,  minAgi: 11, minInt: 8,  armorType: "Leather", rarity: 2, price: 100 },   // INT 8 costs WAR/PAL/RAN/DRU-A 1pt
  { name: "Mage Robes",         armorValue: 4, strMod: 0,  agiMod: 0, intMod: 3, hpMod: 0, minStr: 0,  minAgi: 10, minInt: 14, armorType: "Cloth",   rarity: 2, price: 100 },   // AGI 10 costs WAR/PAL/WIZ/CLR/SOR-I 1pt
  { name: "Spider Silk Wraps",  armorValue: 3, strMod: 0,  agiMod: 4, intMod: 0, hpMod: 0, minStr: 0,  minAgi: 12, minInt: 8,  armorType: "Leather", rarity: 2, price: 90 },    // AGI 12 harder to reach, niche

  // ---- R3: Primary + higher secondary. Costs 1-3 off-path points. ----
  // STR→INT 9: WAR/PAL/RAN/DRU-S (INT 6) need 3pts. WLK/CLR/SOR-S (INT 8) need 1pt. WIZ-S free.
  // AGI→INT 10: WAR/PAL/RAN/DRU-A (INT 7) need 3pts. ROG-A (INT 8) needs 2. WLK-A (INT 9) needs 1.
  // INT→AGI 12: WAR/PAL/WIZ/CLR/SOR-I (AGI 9) need 3pts. ROG/DRU/WLK-I (AGI 11) need 1pt. RAN-I free.
  { name: "Cracked Stone Plate",armorValue: 10, strMod: 3, agiMod: 0, intMod: 0, hpMod: 10, minStr: 14, minAgi: 0,  minInt: 9,  armorType: "Plate",   rarity: 3, price: 200 },
  { name: "Stalker's Cloak",    armorValue: 7,  strMod: 0, agiMod: 5, intMod: 0, hpMod: 0,  minStr: 0,  minAgi: 14, minInt: 10, armorType: "Leather", rarity: 3, price: 200 },
  { name: "Drake's Cowl",      armorValue: 6,  strMod: 0, agiMod: 0, intMod: 5, hpMod: 0,  minStr: 0,  minAgi: 12, minInt: 14, armorType: "Cloth",   rarity: 3, price: 200 },
  { name: "Scorched Scale Vest",armorValue: 8,  strMod: 1, agiMod: 1, intMod: 4, hpMod: 6,  minStr: 12, minAgi: 0,  minInt: 9,  armorType: "Plate",   rarity: 3, price: 250 },  // Hybrid STR/INT
];

const WEAPONS_V2: Weapon[] = [
  // Starters (R0) — no requirements
  { name: "Broken Sword",     minDamage: 1, maxDamage: 1, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Worn Shortbow",    minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 1, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Cracked Wand",     minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },

  // R1 cheap (15g) — single primary req, no secondary. Early game is simple.
  { name: "Iron Axe",         minDamage: 1, maxDamage: 2, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Hunting Bow",      minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 1, intMod: 0, hpMod: 2, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 8,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Apprentice Staff",  minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 1, hpMod: 2, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 6,  rarity: 1, price: 15 },

  // R1 mid (40-50g) — slight secondary. Cost 0-2 off-path.
  { name: "Steel Mace",       minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 9,  minAgi: 5,  minInt: 0,  rarity: 1, price: 40 },   // AGI 5 costs STR builds 0-2
  { name: "Shortbow",      minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 3, scaling: "agi", isMagic: false, minStr: 6,  minAgi: 7,  minInt: 0,  rarity: 1, price: 40 },   // STR 6 costs AGI builds 1
  { name: "Channeling Rod",   minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 4,  minAgi: 0,  minInt: 10, rarity: 1, price: 40 },   // STR 4 costs INT builds 1
  { name: "Notched Blade",     minDamage: 2, maxDamage: 3, strMod: 1, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 5,  rarity: 1, price: 50 },   // Hybrid, both low

  // R2 mid (60-90g) — moderate secondary. Cost 2-3 off-path.
  { name: "Brute's Cleaver",  minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 2, scaling: "str", isMagic: false, minStr: 7,  minAgi: 5,  minInt: 0,  rarity: 2, price: 60 },   // AGI 5 costs STR builds 0-2
  { name: "Sporecap Wand",    minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 5,  rarity: 2, price: 60 },
  { name: "Crystal Shard",    minDamage: 4, maxDamage: 6, strMod: 1, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: false, minStr: 8,  minAgi: 0,  minInt: 8,  rarity: 2, price: 70 },   // Dual req bumped: STR 8 + INT 8. Costs STR builds 2 INT, INT builds 5 STR
  { name: "Webspinner Bow",   minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4, scaling: "agi", isMagic: false, minStr: 7,  minAgi: 10, minInt: 0,  rarity: 2, price: 90 },   // STR 7 costs AGI builds 2

  // R2 high (100g) — heavier secondary. Cost 2-4 off-path.
  { name: "Warhammer",        minDamage: 4, maxDamage: 7, strMod: 3, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 13, minAgi: 6,  minInt: 0,  rarity: 2, price: 100 },  // AGI 6 costs STR builds 1-3
  { name: "Longbow",          minDamage: 4, maxDamage: 7, strMod: 0, agiMod: 3, intMod: 0, hpMod: 5, scaling: "agi", isMagic: false, minStr: 8,  minAgi: 15, minInt: 0,  rarity: 2, price: 100 },  // STR 8 costs AGI builds 3
  { name: "Mage Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 5,  minAgi: 0,  minInt: 11, rarity: 2, price: 100 },  // STR 5 costs INT builds 2

  // R3 (150-250g) — significant secondary. Cost 3-5 off-path.
  { name: "Dire Rat Fang",  minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 3, price: 150 },  // Drop weapon, no reqs
  { name: "Troll's Cudgel", minDamage: 4, maxDamage: 6, strMod: 3, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 12, minAgi: 6,  minInt: 0,  rarity: 3, price: 180 },  // AGI 6 costs STR builds 1-3
  { name: "Bone Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 6,  minAgi: 0,  minInt: 13, rarity: 3, price: 180 },  // STR 6 costs INT builds 3
  { name: "Stone Maul",     minDamage: 5, maxDamage: 7, strMod: 4, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 15, minAgi: 8,  minInt: 0,  rarity: 3, price: 250 },  // AGI 8 costs STR builds 2-5

  // R4 (220-300g) — endgame, meaningful secondary. Cost 3-5 off-path.
  { name: "Darkwood Bow",     minDamage: 7, maxDamage: 10,strMod: 2, agiMod: 5, intMod: 0, hpMod: 6, scaling: "agi", isMagic: false, minStr: 9,  minAgi: 18, minInt: 0,  rarity: 4, price: 220 },  // STR 9 costs AGI builds 4
  { name: "Smoldering Rod",   minDamage: 5, maxDamage: 8, strMod: 0, agiMod: 2, intMod: 5, hpMod: 6, scaling: "str", isMagic: true,  minStr: 7,  minAgi: 0,  minInt: 16, rarity: 4, price: 300 },  // STR 7 costs INT builds 4
];

// ============================================================
// WEAPONS V3 — epic hybrid weapons + pure path nerfs
// Goal: hybrid 70/30 builds equip epic weapons for FREE,
//       pure builds pay 5-8 off-path points (not worth it).
// Pure path weapons are slightly nerfed — armor/consumables (L4/L5)
// will further differentiate builds, so don't over-tune here.
//
// Rogue note: Phasefang gives AGI/INT hybrid a real weapon.
// Rogue's critMult (1.15) and double-strike from high AGI are its levers.
// Remaining Rogue gap can be closed by armor (L4) and consumables (L5).
// ============================================================

const WEAPONS_V3: Weapon[] = [
  // ---- R0: Starters — unchanged ----
  { name: "Broken Sword",     minDamage: 1, maxDamage: 1, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Worn Shortbow",    minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 1, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Cracked Wand",     minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },

  // ---- R1 cheap (15g) — unchanged from V2 ----
  { name: "Iron Axe",         minDamage: 1, maxDamage: 2, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Hunting Bow",      minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 1, intMod: 0, hpMod: 2, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 8,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Apprentice Staff",  minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 1, hpMod: 2, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 6,  rarity: 1, price: 15 },

  // ---- R1 mid (40-50g) — secondary reqs scaled for 1pt/level ----
  { name: "Steel Mace",       minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 8,  minAgi: 3,  minInt: 0,  rarity: 1, price: 40 },   // AGI 5→3 (free for STR base 3)
  { name: "Shortbow",      minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 3, scaling: "agi", isMagic: false, minStr: 4,  minAgi: 7,  minInt: 0,  rarity: 1, price: 40 },   // STR 6→4 (free for AGI base 5)
  { name: "Channeling Rod",   minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 3,  minAgi: 0,  minInt: 9,  rarity: 1, price: 40 },   // STR 4→3, INT 10→9
  { name: "Notched Blade",     minDamage: 2, maxDamage: 3, strMod: 1, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: false, minStr: 4,  minAgi: 0,  minInt: 4,  rarity: 1, price: 50 },   // Both 5→4

  // ---- R2 mid (60-90g) — secondary reqs scaled ----
  { name: "Brute's Cleaver",  minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 2, scaling: "str", isMagic: false, minStr: 7,  minAgi: 3,  minInt: 0,  rarity: 2, price: 60 },   // AGI 5→3
  { name: "Sporecap Wand",    minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 5,  rarity: 2, price: 60 },
  { name: "Crystal Shard",    minDamage: 4, maxDamage: 6, strMod: 1, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: false, minStr: 6,  minAgi: 0,  minInt: 6,  rarity: 2, price: 70 },   // Both 8→6
  { name: "Webspinner Bow",   minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4, scaling: "agi", isMagic: false, minStr: 5,  minAgi: 10, minInt: 0,  rarity: 2, price: 90 },   // STR 7→5

  // ---- R2 high (100g) — reqs scaled for 1pt/level ----
  { name: "Warhammer",        minDamage: 4, maxDamage: 7, strMod: 3, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 11, minAgi: 4,  minInt: 0,  rarity: 2, price: 100 },  // STR 13→11, AGI 6→4
  { name: "Longbow",          minDamage: 4, maxDamage: 7, strMod: 0, agiMod: 3, intMod: 0, hpMod: 5, scaling: "agi", isMagic: false, minStr: 4,  minAgi: 13, minInt: 0,  rarity: 2, price: 100 },  // STR 8→6→4, AGI 15→13. Pure AGI builds can equip.
  { name: "Mage Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 4,  minAgi: 0,  minInt: 9,  rarity: 2, price: 100 },  // STR 5→4, INT 11→9

  // ---- R3: Pure path ceiling (NERFED from V2) ----
  { name: "Dire Rat Fang",  minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 3, price: 150 },
  { name: "Troll's Cudgel", minDamage: 4, maxDamage: 6, strMod: 3, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 10, minAgi: 4,  minInt: 0,  rarity: 3, price: 180 },  // STR 12→10, AGI 6→4
  { name: "Bone Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 4,  minAgi: 0,  minInt: 11, rarity: 3, price: 180 },  // STR 6→4, INT 13→11
  { name: "Stone Maul",     minDamage: 5, maxDamage: 6, strMod: 3, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 13, minAgi: 5,  minInt: 0,  rarity: 3, price: 250 },  // STR 15→13, AGI 8→5

  // ---- R3: Pure path endgame (demoted from R4) — reqs scaled for 1pt/level ----
  { name: "Darkwood Bow",     minDamage: 6, maxDamage: 9, strMod: 2, agiMod: 5, intMod: 0, hpMod: 6, scaling: "agi", isMagic: false, minStr: 4,  minAgi: 14, minInt: 0,  rarity: 3, price: 220 },   // STR 9→6→4, AGI 18→14. Pure AGI builds can equip.
  { name: "Smoldering Rod",   minDamage: 5, maxDamage: 7, strMod: 0, agiMod: 2, intMod: 5, hpMod: 6, scaling: "str", isMagic: true,  minStr: 5,  minAgi: 0,  minInt: 13, rarity: 3, price: 300 },   // STR 7→5, INT 16→13

  // ---- R4 EPIC: Hybrid weapons — reqs scaled for 1pt/level (11 points at L10) ----
  // 70/30 hybrids equip FREE. 90/10 locked out (secondary > base + 10% allocation).
  // Epic reqs: primary raised to lock out 33/33/33 (15/14/10) while allowing 50/50+ (16/16).
  // Secondary locks out 90/10 (base+1 < req). 70/30 equips FREE.
  { name: "Trollhide Cleaver", minDamage: 6, maxDamage: 9, strMod: 3, agiMod: 3, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 16, minAgi: 13, minInt: 0,  rarity: 4, price: 350 },  // STR/AGI — Druid hybrid
  { name: "Phasefang",  minDamage: 5, maxDamage: 10, strMod: 0, agiMod: 4, intMod: 3, hpMod: 5, scaling: "agi", isMagic: true,  minStr: 0,  minAgi: 16, minInt: 11, rarity: 4, price: 350 },  // AGI/INT — Warlock, Rogue
  { name: "Drakescale Staff",   minDamage: 5, maxDamage: 8, strMod: 2, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 16, minAgi: 0,  minInt: 11, rarity: 4, price: 350 },  // STR/INT — Sorcerer hybrid
];

// ============================================================
// DATA: Monsters (from dark_cave/monsters.json)
// ============================================================

const MONSTERS: Monster[] = [
  // Retuned for 1pt/level stat budget. Primary stats scaled ~75-90%, HP ~80-85%, armor -1 where high.
  { name: "Dire Rat",          level: 1,  str: 3,  agi: 6,  int: 2,  hp: 10, armor: 0, classType: 1, xp: 225,  weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "agi", weaponIsMagic: false },
  { name: "Fungal Shaman",     level: 2,  str: 3,  agi: 4,  int: 8,  hp: 12, armor: 0, classType: 2, xp: 400,  weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "str", weaponIsMagic: true },
  { name: "Cavern Brute",      level: 3,  str: 9,  agi: 4,  int: 3,  hp: 18, armor: 1, classType: 0, xp: 550,  weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "str", weaponIsMagic: false },
  { name: "Crystal Elemental", level: 4,  str: 4,  agi: 5,  int: 10, hp: 16, armor: 1, classType: 2, xp: 800,  weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "str", weaponIsMagic: true },
  { name: "Ironhide Troll",        level: 5,  str: 11, agi: 6,  int: 5,  hp: 26, armor: 2, classType: 0, xp: 1000, weaponMinDmg: 1, weaponMaxDmg: 3, weaponScaling: "str", weaponIsMagic: false },
  { name: "Phase Spider",      level: 6,  str: 8,  agi: 12, int: 5,  hp: 22, armor: 0, classType: 1, xp: 1325, weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "agi", weaponIsMagic: false },
  { name: "Bonecaster",      level: 7,  str: 6,  agi: 7,  int: 13, hp: 26, armor: 0, classType: 2, xp: 2000, weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "str", weaponIsMagic: true },
  { name: "Rock Golem",       level: 8,  str: 14, agi: 8,  int: 7,  hp: 38, armor: 3, classType: 0, xp: 2500, weaponMinDmg: 1, weaponMaxDmg: 3, weaponScaling: "str", weaponIsMagic: false },
  { name: "Pale Stalker",    level: 9,  str: 10, agi: 15, int: 7,  hp: 34, armor: 0, classType: 1, xp: 3250, weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "agi", weaponIsMagic: false },
  { name: "Dusk Drake",     level: 10, str: 13, agi: 13, int: 15, hp: 52, armor: 2, classType: 2, xp: 6500, weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "str", weaponIsMagic: true },
  // Zone boss — 3 attack types: physical bite (weapon) + petrifying gaze (magic effect) + venom DoT.
  // Armor 4 slows physical weapons (Crystal Shard 3-6 → 0-2 effective). Physical weapon lets ARM matter.
  // Gaze is separate magic hit. INT 10 → only 30% magic resist on Basilisk. Player magic can deal damage.
  // Every build resists one type but eats the other. Venom (flat DoT) is the equalizer.
  { name: "Basilisk",   level: 10, str: 20, agi: 12, int: 10, hp: 100, armor: 4, classType: 0, xp: 10000, weaponMinDmg: 4, weaponMaxDmg: 7, weaponScaling: "str", weaponIsMagic: false },
];

// ============================================================
// L2 STAT CALCULATION (copied from L2 — single source would be better, but keeps this standalone)
// ============================================================

function statPointsForLevel(level: number): number {
  if (level <= EARLY_GAME_CAP) return STAT_POINTS_EARLY;
  if (level <= MID_GAME_CAP) return (level % 2 === 0) ? STAT_POINTS_MID : 0;
  return (level % 5 === 0) ? STAT_POINTS_LATE : 0;
}

function hpForLevel(level: number): number {
  if (level <= EARLY_GAME_CAP) return HP_GAIN_EARLY;
  if (level <= MID_GAME_CAP) return HP_GAIN_MID;
  return (level % 2 === 0) ? HP_GAIN_LATE : 0;
}

function totalStatPointsAtLevel(level: number): number {
  let total = 0;
  for (let l = 1; l <= level; l++) total += statPointsForLevel(l);
  return total;
}

function totalHpFromLeveling(level: number): number {
  let total = 0;
  for (let l = 1; l <= level; l++) total += hpForLevel(l);
  return total;
}

function allocatePoints(totalPoints: number, path: "str" | "agi" | "int", extraPsPoint: boolean = false): { str: number; agi: number; int: number } {
  const points = totalPoints + (extraPsPoint ? 1 : 0);
  const alloc = { str: 0, agi: 0, int: 0 };
  alloc[path] = points;
  return alloc; // focused allocation only for L3 — it's the worst-case test
}

function buildProfile(arch: Archetype, level: number): StatProfile {
  let str = arch.baseRoll.str;
  let agi = arch.baseRoll.agi;
  let int_ = arch.baseRoll.int;
  let hp = BASE_HP;

  str += arch.race.str;
  agi += arch.race.agi;
  int_ += arch.race.int;
  hp += arch.race.hp;

  str += arch.startingArmor.str;
  agi += arch.startingArmor.agi;
  int_ += arch.startingArmor.int;
  hp += arch.startingArmor.hp;

  const totalStatPts = totalStatPointsAtLevel(level);
  const isPsPhysical = arch.powerSource.type === "physical";
  const psExtraPoint = isPsPhysical && level >= POWER_SOURCE_BONUS_LEVEL;
  const alloc = allocatePoints(totalStatPts, arch.statPath, psExtraPoint);
  str += alloc.str; agi += alloc.agi; int_ += alloc.int;

  hp += totalHpFromLeveling(level);

  if (level >= POWER_SOURCE_BONUS_LEVEL) {
    if (arch.powerSource.type === "weave") int_ += 1;
    else if (arch.powerSource.type === "divine") hp += 2;
  }

  if (level >= 10) {
    str += arch.advClass.flatStr;
    agi += arch.advClass.flatAgi;
    int_ += arch.advClass.flatInt;
    hp += arch.advClass.flatHp;
  }

  if (level >= 10 && arch.advClass.hpMult !== CLASS_MULTIPLIER_BASE) {
    hp = Math.floor((hp * arch.advClass.hpMult) / CLASS_MULTIPLIER_BASE);
  }

  const totalStats = str + agi + int_;
  const primaryStat = Math.max(str, agi, int_);
  const dominantType = str >= agi && str >= int_ ? "STR" :
                       agi > str && agi >= int_ ? "AGI" : "INT";

  return { str, agi, int: int_, hp, totalStats, primaryStat, dominantType };
}

// ============================================================
// ARCHETYPE DEFINITIONS (same 27 from L2)
// ============================================================

function buildArchetypes(): Archetype[] {
  const R = RACES, SA = STARTING_ARMORS, PS = POWER_SOURCES, C = CLASSES;
  const d = (id: string, name: string, cn: string, ac: AdvancedClass, r: Race, sa: StartingArmor, ps: PowerSource, p: "str"|"agi"|"int"): Archetype =>
    ({ id, name, className: cn, advClass: ac, race: r, startingArmor: sa, powerSource: ps, statPath: p, baseRoll: BASE_ROLLS[p] });

  return [
    d("WAR-S", "Tank",        "Warrior",  C.warrior,  R.dwarf, SA.plate,   PS.physical, "str"),
    d("WAR-A", "Fury",        "Warrior",  C.warrior,  R.elf,   SA.leather, PS.physical, "agi"),
    d("WAR-I", "Battlemage",  "Warrior",  C.warrior,  R.elf,   SA.cloth,   PS.weave,    "int"),
    d("PAL-S", "Crusader",    "Paladin",  C.paladin,  R.dwarf, SA.plate,   PS.physical, "str"),
    d("PAL-A", "Avenger",     "Paladin",  C.paladin,  R.elf,   SA.leather, PS.physical, "agi"),
    d("PAL-I", "Templar",     "Paladin",  C.paladin,  R.elf,   SA.cloth,   PS.weave,    "int"),
    d("RAN-S", "Beastmaster", "Ranger",   C.ranger,   R.dwarf, SA.plate,   PS.physical, "str"),
    d("RAN-A", "Sharpshooter","Ranger",   C.ranger,   R.elf,   SA.leather, PS.physical, "agi"),
    d("RAN-I", "ArcaneArcher","Ranger",   C.ranger,   R.elf,   SA.cloth,   PS.weave,    "int"),
    d("ROG-S", "Thug",        "Rogue",    C.rogue,    R.dwarf, SA.plate,   PS.physical, "str"),
    d("ROG-A", "Assassin",    "Rogue",    C.rogue,    R.elf,   SA.leather, PS.physical, "agi"),
    d("ROG-I", "Trickster",   "Rogue",    C.rogue,    R.elf,   SA.cloth,   PS.weave,    "int"),
    d("DRU-S", "Bear",        "Druid",    C.druid,    R.dwarf, SA.plate,   PS.physical, "str"),
    d("DRU-A", "Cat",         "Druid",    C.druid,    R.elf,   SA.leather, PS.physical, "agi"),
    d("DRU-I", "Caster",      "Druid",    C.druid,    R.elf,   SA.cloth,   PS.weave,    "int"),
    d("WLK-S", "Hexblade",    "Warlock",  C.warlock,  R.dwarf, SA.plate,   PS.physical, "str"),
    d("WLK-A", "Shadow",      "Warlock",  C.warlock,  R.elf,   SA.leather, PS.physical, "agi"),
    d("WLK-I", "VoidMage",    "Warlock",  C.warlock,  R.elf,   SA.cloth,   PS.weave,    "int"),
    d("WIZ-S", "WarMage",     "Wizard",   C.wizard,   R.dwarf, SA.plate,   PS.physical, "str"),
    d("WIZ-A", "Spellblade",  "Wizard",   C.wizard,   R.elf,   SA.leather, PS.physical, "agi"),
    d("WIZ-I", "Archmage",    "Wizard",   C.wizard,   R.elf,   SA.cloth,   PS.weave,    "int"),
    d("CLR-S", "BattlePriest","Cleric",   C.cleric,   R.dwarf, SA.plate,   PS.physical, "str"),
    d("CLR-A", "WindCleric",  "Cleric",   C.cleric,   R.elf,   SA.leather, PS.physical, "agi"),
    d("CLR-I", "HighPriest",  "Cleric",   C.cleric,   R.elf,   SA.cloth,   PS.weave,    "int"),
    d("SOR-S", "Spellsword",  "Sorcerer", C.sorcerer, R.dwarf, SA.plate,   PS.physical, "str"),
    d("SOR-A", "StormMage",   "Sorcerer", C.sorcerer, R.elf,   SA.leather, PS.physical, "agi"),
    d("SOR-I", "Elementalist","Sorcerer", C.sorcerer, R.elf,   SA.cloth,   PS.weave,    "int"),
  ];
}

// ============================================================
// WEAPON SELECTION
// ============================================================

function canEquip(weapon: Weapon, profile: StatProfile): boolean {
  return profile.str >= weapon.minStr &&
         profile.agi >= weapon.minAgi &&
         profile.int >= weapon.minInt;
}

/**
 * Select best weapon for an archetype at a given level.
 * "Best" = highest expected damage output per round for this build.
 * For on-path builds, prefers weapons matching their stat path.
 * Falls back to any equippable weapon.
 */
function selectBestWeapon(arch: Archetype, profile: StatProfile): Weapon {
  const equippable = activeWeapons.filter(w => canEquip(w, profile));
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
  return profile.str >= armor.minStr &&
         profile.agi >= armor.minAgi &&
         profile.int >= armor.minInt;
}

/**
 * Select best armor for a build. Scores by defensive value + on-path stat bonus.
 * Prefers on-path armor (Plate for STR, Leather for AGI, Cloth for INT) but
 * will pick cross-path armor if it scores higher (e.g., 33/33/33 picking Chainmail for +2 STR).
 */
function selectBestArmor(profile: StatProfile, path: "str" | "agi" | "int"): Armor {
  const equippable = ARMORS.filter(a => canEquipArmor(a, profile));
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
  if (!useArmorFlag) {
    const baseProfile = buildProfile(arch, level);
    const weapon = selectBestWeapon(arch, baseProfile);
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
      const armor = selectBestArmor(baseProfile, arch.statPath);
      const profile = applyArmorToProfile(baseProfile, armor);

      // Select best weapon for post-armor profile
      const weapon = selectBestWeapon(arch, profile);
      const armorRating = armor.armorValue;

      // Score: weapon combat effectiveness + armor defensive value
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
      const armorScore = armorRating * 1.5 + armor.hpMod * 0.5;

      const totalScore = weaponScore + armorScore;
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
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDominant(str: number, agi: number, int_: number): { type: string; stat: number } {
  if (str >= agi && str >= int_) return { type: "STR", stat: str };
  if (agi > str && agi >= int_) return { type: "AGI", stat: agi };
  return { type: "INT", stat: int_ };
}

function triangleAdvantage(attackerType: string, defenderType: string): boolean {
  return (attackerType === "STR" && defenderType === "AGI") ||
         (attackerType === "AGI" && defenderType === "INT") ||
         (attackerType === "INT" && defenderType === "STR");
}

// --- Effect helpers ---

function tickEffects(effects: ActiveEffectInstance[]): number {
  let dotDamage = 0;
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].turnsRemaining--;
    if (effects[i].type === "dot") {
      dotDamage += effects[i].damagePerTick;
    }
    if (effects[i].turnsRemaining <= 0) {
      effects.splice(i, 1);
    }
  }
  return dotDamage;
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
  let strAdj = 0, agiAdj = 0, intAdj = 0, armorAdj = 0;
  for (const e of effects) {
    if (e.type === "stat_debuff" || e.type === "self_buff") {
      strAdj += e.strMod;
      agiAdj += e.agiMod;
      intAdj += e.intMod;
      armorAdj += e.armorMod;
    }
  }
  if (strAdj === 0 && agiAdj === 0 && intAdj === 0 && armorAdj === 0) return base;

  const str = Math.max(0, base.str + strAdj);
  const agi = Math.max(0, base.agi + agiAdj);
  const int_ = Math.max(0, base.int + intAdj);
  const dom = getDominant(str, agi, int_);
  return {
    ...base,
    str, agi, int: int_,
    armor: Math.max(0, base.armor + armorAdj),
    dominantType: dom.type,
    dominantStat: dom.stat,
  };
}

function resolveDualMagicHit(attacker: Combatant, defender: Combatant): number {
  // Second hit using magic damage formula (simplified — uses INT for scaling)
  const w = attacker.weapon;
  const rawDmg = randInt(w.minDamage, w.maxDamage);
  let damage = rawDmg * ATTACK_MODIFIER;

  // Magic uses INT
  const statDiff = (attacker.int * ATTACK_MODIFIER) - defender.int;
  if (statDiff > 0) {
    damage += statDiff / 2;
  } else {
    damage = Math.max(1, damage + statDiff / 2);
  }

  // Magic resistance
  const resistPct = Math.min(defender.int * MAGIC_RESIST_PER_INT, MAGIC_RESIST_CAP);
  damage = Math.max(1, damage * (1 - resistPct / 100));

  // Spell multiplier
  damage = damage * attacker.spellMult / 1000;

  return Math.max(1, Math.floor(damage));
}

function resolveBreathAttack(attacker: Combatant, defender: Combatant, breath: WeaponEffect): number {
  // Separate magic damage hit — NOT evasion-checked (breath covers area, can't dodge).
  // Uses attacker INT vs defender INT for magic resist. No weapon scaling.
  const rawDmg = randInt(breath.minDmg ?? 1, breath.maxDmg ?? 1);

  // INT stat comparison — attacker INT advantage adds damage, defender advantage reduces
  const statDiff = attacker.int - defender.int;
  let damage = rawDmg + statDiff / 2;

  // Magic resistance (3% per INT point, capped at 40%)
  const resistPct = Math.min(defender.int * MAGIC_RESIST_PER_INT, MAGIC_RESIST_CAP);
  damage = Math.max(1, damage * (1 - resistPct / 100));

  return Math.max(1, Math.floor(damage));
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

  // Priority 2: Debuffs on first available round (huge value vs boss — Sapping strips 8 STR)
  if (round === earlyRound) {
    const debuffIdx = items.findIndex(i => i.type === "debuff");
    if (debuffIdx >= 0) return debuffIdx;
    // Also use tradeoff buffs early
    const buffIdx = items.findIndex(i => i.type === "tradeoff_buff");
    if (buffIdx >= 0) return buffIdx;
  }

  // Priority 3: Cleanse when we have DoTs active
  const hasDoT = selfEffects.some(e => e.type === "dot");
  if (hasDoT) {
    const cleanseIdx = items.findIndex(i => i.type === "cleanse");
    if (cleanseIdx >= 0) return cleanseIdx;
  }

  // Priority 4: Use remaining debuffs if we haven't used them yet (round 3+)
  if (round > earlyRound) {
    const debuffIdx = items.findIndex(i => i.type === "debuff");
    if (debuffIdx >= 0) return debuffIdx;
    const buffIdx = items.findIndex(i => i.type === "tradeoff_buff");
    if (buffIdx >= 0) return buffIdx;
  }

  return -1;
}

// Per-side spell override: undefined = use global useSpellsFlag, true/false = force
function simulateOneCombat(
  attacker: Combatant, defender: Combatant,
  attackerCastsSpell?: boolean, defenderCastsSpell?: boolean,
  attackerConsumables?: ConsumableLoadout,
): { attackerWins: boolean; rounds: number; totalDamageDealt: number } {
  const aCasts = attackerCastsSpell ?? useSpellsFlag;
  const dCasts = defenderCastsSpell ?? useSpellsFlag;

  // Apply pre-combat consumable buffs (Stew/Berries/Tea — no turn cost, last entire fight)
  let preBuffAttacker = attacker;
  if (attackerConsumables && attackerConsumables.preBuffs.length > 0) {
    let sAdj = 0, aAdj = 0, iAdj = 0, armAdj = 0;
    for (const c of attackerConsumables.preBuffs) {
      sAdj += c.strMod ?? 0;
      aAdj += c.agiMod ?? 0;
      iAdj += c.intMod ?? 0;
      armAdj += c.armorMod ?? 0;
    }
    const newStr = Math.max(0, attacker.str + sAdj);
    const newAgi = Math.max(0, attacker.agi + aAdj);
    const newInt = Math.max(0, attacker.int + iAdj);
    const dom = getDominant(newStr, newAgi, newInt);
    preBuffAttacker = {
      ...attacker,
      str: newStr, agi: newAgi, int: newInt,
      armor: Math.max(0, attacker.armor + armAdj),
      dominantType: dom.type, dominantStat: dom.stat,
    };
  }

  let aHp = preBuffAttacker.maxHp;
  let dHp = defender.maxHp;
  let rounds = 0;
  let totalDamageDealt = 0;
  // Effect tracking
  const aEffects: ActiveEffectInstance[] = [];
  const dEffects: ActiveEffectInstance[] = [];
  const aCooldowns = new Map<string, number>();
  const dCooldowns = new Map<string, number>();
  const aHasEffects = getWeaponEffects(preBuffAttacker.weapon.name).length > 0;
  const dHasEffects = getWeaponEffects(defender.weapon.name).length > 0;
  const aHasDualMagic = getWeaponEffects(preBuffAttacker.weapon.name).some(e => e.type === "dual_magic");
  const dHasDualMagic = getWeaponEffects(defender.weapon.name).some(e => e.type === "dual_magic");
  const aBreathEffect = getWeaponEffects(preBuffAttacker.weapon.name).find(e => e.type === "magic_breath");
  const dBreathEffect = getWeaponEffects(defender.weapon.name).find(e => e.type === "magic_breath");
  const aBreathCooldown = { lastUsed: -999 };
  const dBreathCooldown = { lastUsed: -999 };

  // In-combat consumable tracking
  const inCombatItems = attackerConsumables ? [...attackerConsumables.inCombat] : [];
  let consumableUsedRound = new Set<number>();  // rounds where attacker uses consumable instead of weapon

  // Track whether each side cast a spell (costs their round 1 weapon attack)
  let aSkipRound1 = false;
  let dSkipRound1 = false;

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
    }
    return { casterHpDelta, targetHpDelta, dmgDealt };
  }

  // Cast class spells before combat loop if enabled
  // Spell replaces round 1 weapon attack (matches on-chain: player picks spell OR weapon per turn)
  {
    const aSpell = (aCasts && preBuffAttacker.className) ? CLASS_SPELLS[preBuffAttacker.className] : undefined;
    const dSpell = (dCasts && defender.className) ? CLASS_SPELLS[defender.className] : undefined;

    if (aSpell) {
      aSkipRound1 = true;
      const r = resolveSpell(aSpell, preBuffAttacker, defender, aEffects, dEffects);
      aHp += r.casterHpDelta;
      dHp += r.targetHpDelta;
      totalDamageDealt += r.dmgDealt;
    }

    if (dSpell) {
      dSkipRound1 = true;
      const r = resolveSpell(dSpell, defender, preBuffAttacker, dEffects, aEffects);
      dHp += r.casterHpDelta;
      aHp += r.targetHpDelta;
    }

    if (dHp <= 0 || aHp <= 0) {
      return { attackerWins: dHp <= 0, rounds: 0, totalDamageDealt };
    }
  }

  while (aHp > 0 && dHp > 0 && rounds < maxCombatRounds) {
    rounds++;

    // Tick effects at start of round (DoTs deal damage, expired effects removed)
    if (dEffects.length > 0) dHp -= tickEffects(dEffects);
    if (aEffects.length > 0) aHp -= tickEffects(aEffects);
    if (dHp <= 0 || aHp <= 0) break;

    // Adjust stats for active effects (buffs + debuffs)
    const adjAttacker = aEffects.length > 0 ? adjustCombatant(preBuffAttacker, aEffects) : preBuffAttacker;
    const adjDefender = dEffects.length > 0 ? adjustCombatant(defender, dEffects) : defender;

    // --- Attacker's turn ---
    // Check if attacker should use an in-combat consumable this round (costs weapon attack)
    let aUsedConsumable = false;
    if (!(rounds === 1 && aSkipRound1) && inCombatItems.length > 0) {
      // Decision logic: use heal when HP < 50% of max, use debuffs/buffs on round 2 (after spell on r1)
      const consumableIdx = pickConsumable(inCombatItems, aHp, preBuffAttacker.maxHp, rounds, aSkipRound1, aEffects, dEffects);
      if (consumableIdx >= 0) {
        const item = inCombatItems.splice(consumableIdx, 1)[0];
        aUsedConsumable = true;
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
        } else if (item.type === "tradeoff_buff" && item.effect) {
          aEffects.push({
            name: item.name, type: "self_buff",
            turnsRemaining: item.effect.duration,
            damagePerTick: 0,
            strMod: item.effect.strMod, agiMod: item.effect.agiMod,
            intMod: item.effect.intMod, armorMod: item.effect.armorMod,
          });
        } else if (item.type === "cleanse") {
          // Remove all DoT effects on self
          for (let i = aEffects.length - 1; i >= 0; i--) {
            if (aEffects[i].type === "dot") aEffects.splice(i, 1);
          }
        }
      }
    }

    // Skip weapon attack on round 1 if spell was cast, or if consumable was used this turn
    if (!(rounds === 1 && aSkipRound1) && !aUsedConsumable) {
      const aDmg = resolveAttack(adjAttacker, adjDefender);
      dHp -= aDmg;
      totalDamageDealt += aDmg;

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
    // Skip weapon attack on round 1 if spell was cast
    if (!(rounds === 1 && dSkipRound1)) {
      const dDmg = resolveAttack(adjDefender, adjAttacker);
      aHp -= dDmg;

      // Apply weapon effects on attacker
      if (dHasEffects) tryApplyEffects(defender.weapon.name, aEffects, aCooldowns, rounds);

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
  const w = attacker.weapon;

  // Evasion check (defender AGI vs attacker AGI)
  if (defender.agi > attacker.agi) {
    let evadeChance = Math.min((defender.agi - attacker.agi) * 2, EVASION_CAP);
    // Physical attacks: STR advantage reduces evasion (overwhelming force)
    // Magic attacks: face full evasion (AGI's defense vs magic)
    if (!w.isMagic && attacker.str > defender.str) {
      const strReduction = Math.min(attacker.str - defender.str, 15);
      evadeChance = Math.max(0, evadeChance - strReduction);
    }
    if (randInt(1, 100) <= evadeChance) return 0;
  }

  // Crit check
  const critChance = CRIT_BASE_CHANCE + Math.floor(attacker.agi / 4);
  const isCrit = randInt(1, 100) <= critChance;

  // Roll damage
  let rawDmg: number;
  if (isCrit) {
    rawDmg = w.maxDamage;
  } else {
    rawDmg = randInt(w.minDamage, w.maxDamage);
  }

  // Scaling modifier
  const scalingMod = w.isMagic ? ATTACK_MODIFIER :
                     w.scaling === "agi" ? AGI_ATTACK_MODIFIER : ATTACK_MODIFIER;

  let damage = rawDmg * scalingMod;

  // Stat bonus
  let attackerStat: number;
  let defenderStat: number;
  if (w.isMagic) {
    attackerStat = attacker.int;
    defenderStat = defender.int;
  } else if (w.scaling === "agi") {
    attackerStat = attacker.agi;
    defenderStat = defender.agi; // AGI vs AGI for AGI weapons
  } else {
    attackerStat = attacker.str;
    defenderStat = defender.str;
  }

  const statDiff = (attackerStat * scalingMod) - (defenderStat * 1.0);
  if (statDiff > 0) {
    damage += statDiff / 2;
  } else {
    // Defender stat advantage reduces damage (capped at attacker's contribution)
    damage = Math.max(1, damage + statDiff / 2);
  }

  // Armor reduction (physical only — magic bypasses armor, that's INT's advantage)
  if (!w.isMagic) {
    const armorReduction = Math.max(0, defender.armor);
    damage = Math.max(1, damage - armorReduction);
  }

  // Magic resistance (magic only)
  if (w.isMagic) {
    const resistPct = Math.min(defender.int * MAGIC_RESIST_PER_INT, MAGIC_RESIST_CAP);
    damage = Math.max(1, damage * (1 - resistPct / 100));
  }

  // Crit multiplier
  if (isCrit) {
    damage *= CRIT_MULTIPLIER;
    // Class crit multiplier (Rogue)
    if (attacker.critMult > 1000) {
      damage = damage * attacker.critMult / 1000;
    }
  }

  // Class damage multiplier
  if (w.isMagic) {
    damage = damage * attacker.spellMult / 1000;
  } else {
    damage = damage * attacker.physMult / 1000;
  }

  // Combat triangle
  if (triangleAdvantage(attacker.dominantType, defender.dominantType)) {
    const diff = Math.abs(attacker.dominantStat - defender.dominantStat);
    const bonus = Math.min(diff * COMBAT_TRIANGLE_PER_STAT, COMBAT_TRIANGLE_MAX);
    damage *= (1 + bonus);
  }

  // Double strike (AGI weapons only)
  if (w.scaling === "agi" && !w.isMagic && attacker.agi > defender.agi) {
    const dsChance = Math.min((attacker.agi - defender.agi) * 3, DOUBLE_STRIKE_CAP);
    if (randInt(1, 100) <= dsChance) {
      damage += damage / 2;
    }
  }

  // Block (STR-based defense — decided design feature from COMBAT_SYSTEM)
  // Reduces all incoming damage. Half effectiveness vs magic.
  if (defender.str > 10) {
    const blockChance = Math.min((defender.str - 10) * BLOCK_CHANCE_PER_STR, BLOCK_CHANCE_CAP);
    if (randInt(1, 100) <= blockChance) {
      const reduction = w.isMagic ? BLOCK_REDUCTION_MAGIC : BLOCK_REDUCTION_PHYS;
      damage *= (1 - reduction);
    }
  }

  return Math.max(1, Math.floor(damage));
}

function makeCombatant(profile: StatProfile, weapon: Weapon, advClass: AdvancedClass, armor: number = 0, className: string = ""): Combatant {
  const str = profile.str + weapon.strMod;
  const agi = profile.agi + weapon.agiMod;
  const int_ = profile.int + weapon.intMod;
  const dom = getDominant(str, agi, int_);
  let hp = profile.hp + weapon.hpMod;
  if (advClass.hpMult > 1000) {
    // HP mult already applied in buildProfile, but weapon HP is added after — apply mult to weapon HP
    hp = profile.hp + Math.floor(weapon.hpMod * advClass.hpMult / 1000);
  }

  return {
    str, agi, int: int_,
    hp, maxHp: hp, armor,
    weapon,
    physMult: advClass.physMult,
    spellMult: advClass.spellMult,
    critMult: advClass.critMult,
    hpMult: advClass.hpMult,
    dominantType: dom.type,
    dominantStat: dom.stat,
    className,
  };
}

function makeMonsterCombatant(m: Monster): Combatant {
  const dom = getDominant(m.str, m.agi, m.int);
  const weaponName = MONSTER_WEAPON_EFFECTS[m.name] ? m.name : "Monster Attack";
  const monsterWeapon: Weapon = {
    name: weaponName, minDamage: m.weaponMinDmg, maxDamage: m.weaponMaxDmg,
    strMod: 0, agiMod: 0, intMod: 0, hpMod: 0,
    scaling: m.weaponScaling, isMagic: m.weaponIsMagic,
    minStr: 0, minAgi: 0, minInt: 0, rarity: 0, price: 0,
  };
  return {
    str: m.str, agi: m.agi, int: m.int,
    hp: m.hp, maxHp: m.hp, armor: m.armor,
    weapon: monsterWeapon,
    physMult: 1000, spellMult: 1000, critMult: 1000, hpMult: 1000,
    dominantType: dom.type, dominantStat: dom.stat,
    className: "",
  };
}

function simulate(
  attacker: Combatant, defender: Combatant, iterations: number = SIM_ITERATIONS,
  attackerCastsSpell?: boolean, defenderCastsSpell?: boolean,
  attackerConsumables?: ConsumableLoadout,
): CombatResult {
  let wins = 0;
  let totalRounds = 0;
  let totalDmg = 0;

  for (let i = 0; i < iterations; i++) {
    const result = simulateOneCombat(attacker, defender, attackerCastsSpell, defenderCastsSpell, attackerConsumables);
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

function simulateOptimal(attacker: Combatant, defender: Combatant, iterations: number = SIM_ITERATIONS): OptimalResult {
  const aHasSpell = !!(attacker.className && CLASS_SPELLS[attacker.className]);
  const dHasSpell = !!(defender.className && CLASS_SPELLS[defender.className]);

  // If neither has a spell, skip the optimization
  if (!aHasSpell && !dHasSpell) {
    return { result: simulate(attacker, defender, iterations, false, false), aCasts: false, dCasts: false };
  }

  // Test all 4 combinations
  const nn = simulate(attacker, defender, iterations, false, false);
  const yn = aHasSpell ? simulate(attacker, defender, iterations, true, false) : nn;
  const ny = dHasSpell ? simulate(attacker, defender, iterations, false, true) : nn;
  const yy = (aHasSpell && dHasSpell) ? simulate(attacker, defender, iterations, true, true) :
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

  // Simulate at key levels + all L10 monsters (including boss)
  const showLevels = new Set([1, 3, 5, 7, 10]);
  for (const monster of MONSTERS) {
    if (!showLevels.has(monster.level)) continue;
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
  const combatants: { arch: Archetype; combat: Combatant; weapon: Weapon; armor: Armor | null }[] = [];

  for (const arch of archetypes) {
    const gear = buildGearLoadout(arch, level);
    const combat = makeCombatant(gear.profile, gear.weapon, arch.advClass, gear.armorRating, arch.className);
    combatants.push({ arch, combat, weapon: gear.weapon, armor: gear.armor });
  }

  // Build win rate matrix — but only show aggregated stats (full matrix is too big)
  // When spells are enabled, use optimal spell decision per matchup
  const useOptimal = useSpellsFlag;

  console.log("\n--- Aggregate PvP Performance at L10" + (useOptimal ? " (optimal spell use)" : "") + " ---");
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
        const opt = simulateOptimal(a.combat, d.combat);
        result = opt.result;
        aCasts = opt.aCasts;
        if (aCasts) spellCasts++;
        // Also get no-spell baseline for the decision map
        const noSpell = simulate(a.combat, d.combat, SIM_ITERATIONS, false, false);
        noSpellWinRate = noSpell.winRate;
        spellDecisions.push({ opponentId: d.arch.id, casts: aCasts, winRate: result.winRate, noSpellWinRate });
      } else {
        result = simulate(a.combat, d.combat);
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

      console.log(
        `  ${pad(className, 12)} ${spell.name} (${spell.type}, ${spell.duration ?? "instant"}t): ` +
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
  console.log("  WEAPON EFFECTIVENESS: Average damage per round by weapon (vs L10 Dusk Drake)");
  console.log("=".repeat(100));

  const level = 10;
  const monster = MONSTERS[MONSTERS.length - 1]; // Dusk Drake
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

  // 3. Crystal Shard check
  console.log("\n--- 3. Crystal Shard Dominance Check ---");
  const monster10 = MONSTERS.find(m => m.name === "Dusk Drake")!;
  const mc = makeMonsterCombatant(monster10);
  const cbWeapon = WEAPONS.find(w => w.name === "Crystal Shard")!;

  for (const arch of archetypes.filter(a => a.statPath === "str").slice(0, 3)) {
    const profile = buildProfile(arch, 10);
    if (!canEquip(cbWeapon, profile)) continue;
    const bestWeapon = selectBestWeapon(arch, profile);
    const cbCombat = makeCombatant(profile, cbWeapon, arch.advClass);
    const bestCombat = makeCombatant(profile, bestWeapon, arch.advClass);
    const cbResult = simulate(cbCombat, mc, 200);
    const bestResult = simulate(bestCombat, mc, 200);
    console.log(`  ${pad(arch.id, 7)} Crystal Shard: ${(cbResult.winRate * 100).toFixed(0)}% | Best (${bestWeapon.name}): ${(bestResult.winRate * 100).toFixed(0)}%`);
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

  // Run current
  activeWeapons.length = 0;
  activeWeapons.push(...WEAPONS);
  console.log("\n--- CURRENT WEAPONS ---");
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

// Active weapons (swappable for comparison)
let activeWeapons: Weapon[] = [...WEAPONS];
let useArmorFlag = false;
let useSpellsFlag = false;

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

      // vs Dusk Drake (find by name, not index — Basilisk is now last)
      const dragon = MONSTERS.find(m => m.name === "Dusk Drake")!;
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
  const hp35 = CONSUMABLES[C_HP];          // Health Potion (35 HP)
  const ghp75 = CONSUMABLES[C_GREATER_HP]; // Greater Health Potion (75 HP)
  const sapping = CONSUMABLES[C_SAPPING];  // Sapping Poison (-8 STR)

  function getTieredLoadouts(arch: Archetype): { name: string; loadout: ConsumableLoadout }[] {
    const path = arch.statPath;
    const preBuff = path === "str" ? CONSUMABLES[C_STEW] : path === "agi" ? CONSUMABLES[C_BERRIES] : CONSUMABLES[C_TEA];
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

  const useV3 = flags.has("--v3");
  const useV2 = flags.has("--v2");
  const useRebalanced = flags.has("--rebalance");
  useArmorFlag = flags.has("--armor");
  useSpellsFlag = flags.has("--spells");

  // Parse --rounds N flag
  const roundsIdx = args.findIndex(a => a.toLowerCase() === "--rounds");
  if (roundsIdx !== -1 && args[roundsIdx + 1]) {
    maxCombatRounds = parseInt(args[roundsIdx + 1], 10);
    if (isNaN(maxCombatRounds) || maxCombatRounds < 1) maxCombatRounds = 8;
  }

  if (useV3) {
    activeWeapons = [...WEAPONS_V3];
    console.log("Balance Layer 3: Weapons & Combat Viability (V3 — epic hybrids + pure nerfs)");
  } else if (useV2) {
    activeWeapons = [...WEAPONS_V2];
    console.log("Balance Layer 3: Weapons & Combat Viability (V2 — secondary stat requirements)");
  } else if (useRebalanced) {
    activeWeapons = [...WEAPONS_REBALANCED];
    console.log("Balance Layer 3: Weapons & Combat Viability (REBALANCED)");
  } else {
    activeWeapons = [...WEAPONS];
    console.log("Balance Layer 3: Weapons & Combat Viability");
  }
  if (useArmorFlag) console.log("  + L4 ARMOR ENABLED (equipped armor affects stats + defense)");
  if (useSpellsFlag) console.log("  + L5 CLASS SPELLS ENABLED (spell costs round 1 weapon attack)");
  console.log(`  Max rounds: ${maxCombatRounds} (≈ ${maxCombatRounds * 2} on-chain turns). --rounds N to change.`);
  console.log(`Simulating with ${SIM_ITERATIONS} iterations per matchup...\n`);

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
