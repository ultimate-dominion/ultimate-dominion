#!/usr/bin/env npx tsx
/**
 * Ultimate Dominion — Balance Explorer (v2 — redesigned combat mechanics)
 *
 * Models all 27 build archetypes (9 classes × 3 stat paths) at level 10.
 * Simulates PvE and PvP matchups using REDESIGNED combat math:
 *   1. Physical hit uses weapon's primary stat vs defender AGI (STR vs AGI for STR weapons)
 *   2. STR block/parry: defender STR-based % damage reduction, halved vs magic
 *   3. Magic weapon charges: finite uses per encounter, then physical fallback
 *   4. Reduced explicit triangle bonus: 2%/pt, 20% cap (was 4%/40%)
 *   5. Class damage multipliers preserved as-is
 *
 * Usage: npx tsx packages/contracts/scripts/balance-explorer.ts [--pve] [--pvp] [--stats] [--analysis] [--compare]
 *        No flags = run everything. --compare shows old vs new mechanics side-by-side.
 *
 * Architecture: Data-driven and extensible.
 * - Add weapons/armor: push to WEAPONS/ARMOR arrays
 * - Add racial skills: extend Race type
 * - Add class spells: extend AdvancedClass type
 * - Add levels: change LEVEL and gear selections
 */

// ============================================================
// CONSTANTS (matching constants.sol)
// ============================================================

const WAD = 1e18;
const ATTACK_MODIFIER = 1.2e18;
const AGI_ATTACK_MODIFIER = 0.9e18;
const DEFENSE_MODIFIER = 1e18;
const CRIT_MULTIPLIER = 2;
const STARTING_HIT_PROBABILITY = 90;
const ATTACKER_HIT_DAMPENER = 95;
const DEFENDER_HIT_DAMPENER = 30;
const EVASION_CAP = 25;
const DOUBLE_STRIKE_CAP = 25;
const CLASS_MULTIPLIER_BASE = 1000;
// v2: Reduced triangle bonus — mechanical triangle (hit/block/charges) does heavy lifting
const COMBAT_TRIANGLE_BONUS_PER_STAT = WAD / 50; // 2% per stat point (was 4%)
const COMBAT_TRIANGLE_MAX_BONUS = (WAD * 20) / 100; // 20% cap (was 40%)

// v2: Block/parry — STR-based damage reduction
const BLOCK_CHANCE_PER_STR = 1.5; // 1.5% block chance per defender STR
const BLOCK_CAP = 30; // 30% max block chance
const BLOCK_DAMAGE_REDUCTION = 0.5; // blocked hits deal 50% less damage
const BLOCK_VS_MAGIC_PENALTY = 0.5; // half block rate vs magic attacks

const LEVEL = 10;
const STAT_POINTS_PER_LEVEL = 2; // levels 1-10
const HP_PER_LEVEL = 2; // levels 1-10
// Total from leveling: 10 levels × 2 = 20 stat points, 20 HP
const TOTAL_STAT_POINTS = LEVEL * STAT_POINTS_PER_LEVEL;
const TOTAL_HP_FROM_LEVELS = LEVEL * HP_PER_LEVEL;
const BASE_HP = 18;

// ============================================================
// TYPES
// ============================================================

interface Race {
  name: string;
  str: number;
  agi: number;
  int: number;
  hp: number;
}

interface StartingArmor {
  name: string;
  str: number;
  agi: number;
  int: number;
  hp: number;
}

interface PowerSource {
  name: string;
  type: "divine" | "weave" | "physical";
}

interface AdvancedClass {
  name: string;
  physMult: number;
  spellMult: number;
  healMult: number;
  critMult: number;
  hpMult: number;
}

interface Weapon {
  name: string;
  str: number;
  agi: number;
  int: number;
  minDmg: number;
  maxDmg: number;
  scaling: "str" | "agi" | "magic";
  reqStr: number;
  reqAgi: number;
  reqInt: number;
  charges?: number; // v2: magic weapon charge count per encounter
}

interface Armor {
  name: string;
  str: number;
  agi: number;
  int: number;
  armor: number;
  hp: number;
  reqStr: number;
  reqAgi: number;
  reqInt: number;
}

interface Monster {
  name: string;
  str: number;
  agi: number;
  int: number;
  armor: number;
  hp: number;
  classType: number; // 0=warrior(STR), 1=rogue(AGI), 2=mage(INT)
  level: number;
}

interface Stats {
  str: number;
  agi: number;
  int: number;
  armor: number;
  hp: number;
}

interface CombatResult {
  hitPct: number;
  avgDmgPerHit: number;
  critPct: number;
  evasionPct: number;
  doubleStrikePct: number;
  blockPct: number; // v2: defender's block chance
  effectiveDPT: number;
  turnsToKill: number;
  isMagic: boolean;
}

// v2: Extended result with charge-aware TTK
interface MatchupResult extends CombatResult {
  magicCharges: number; // 0 = no charges (physical weapon)
  fallbackDPT: number; // physical fallback DPT after charges expire
  chargeAwareTTK: number; // TTK accounting for charge depletion
  chargeAwareDPT: number; // effective DPT accounting for charge transition
}

interface Archetype {
  id: string; // e.g. "WAR-S"
  name: string; // e.g. "Tank"
  className: string;
  advClass: AdvancedClass;
  race: Race;
  startingArmor: StartingArmor;
  powerSource: PowerSource;
  statPath: "str" | "agi" | "int";
  // How to distribute 20 (or 21 for Physical) stat points
  statAlloc: { str: number; agi: number; int: number };
  weapon: Weapon;
  armor: Armor;
  // Base roll (representative for the path)
  baseRoll: { str: number; agi: number; int: number };
}

// ============================================================
// DATA: Races
// ============================================================

const RACES: Record<string, Race> = {
  human: { name: "Human", str: 1, agi: 1, int: 1, hp: 0 },
  dwarf: { name: "Dwarf", str: 2, agi: -1, int: 0, hp: 1 },
  elf: { name: "Elf", str: -1, agi: 2, int: 1, hp: -1 },
};

// ============================================================
// DATA: Starting Armor Types
// ============================================================

const STARTING_ARMORS: Record<string, StartingArmor> = {
  cloth: { name: "Cloth", str: -1, agi: 1, int: 2, hp: 0 },
  leather: { name: "Leather", str: 1, agi: 2, int: 0, hp: 0 },
  plate: { name: "Plate", str: 2, agi: -1, int: 0, hp: 1 },
};

// ============================================================
// DATA: Power Sources
// ============================================================

const POWER_SOURCES: Record<string, PowerSource> = {
  physical: { name: "Physical", type: "physical" }, // +1 stat point at L5
  weave: { name: "Weave", type: "weave" }, // +1 INT at L5
  divine: { name: "Divine", type: "divine" }, // +2 HP at L5
};

// ============================================================
// DATA: Advanced Classes
// ============================================================

const CLASSES: Record<string, AdvancedClass> = {
  warrior: {
    name: "Warrior",
    physMult: 1100,
    spellMult: 1000,
    healMult: 1000,
    critMult: 1000,
    hpMult: 1000,
  },
  paladin: {
    name: "Paladin",
    physMult: 1050,
    spellMult: 1000,
    healMult: 1050,
    critMult: 1000,
    hpMult: 1000,
  },
  ranger: {
    name: "Ranger",
    physMult: 1100,
    spellMult: 1000,
    healMult: 1000,
    critMult: 1000,
    hpMult: 1000,
  },
  rogue: {
    name: "Rogue",
    physMult: 1000,
    spellMult: 1000,
    healMult: 1000,
    critMult: 1150,
    hpMult: 1000,
  },
  druid: {
    name: "Druid",
    physMult: 1050,
    spellMult: 1050,
    healMult: 1000,
    critMult: 1000,
    hpMult: 1050,
  },
  warlock: {
    name: "Warlock",
    physMult: 1000,
    spellMult: 1200,
    healMult: 1000,
    critMult: 1000,
    hpMult: 1000,
  },
  wizard: {
    name: "Wizard",
    physMult: 1000,
    spellMult: 1250,
    healMult: 1000,
    critMult: 1000,
    hpMult: 1000,
  },
  cleric: {
    name: "Cleric",
    physMult: 1000,
    spellMult: 1000,
    healMult: 1100,
    critMult: 1000,
    hpMult: 1000,
  },
  sorcerer: {
    name: "Sorcerer",
    physMult: 1000,
    spellMult: 1150,
    healMult: 1000,
    critMult: 1000,
    hpMult: 1050,
  },
};

// ============================================================
// DATA: Weapons (player-obtainable from Dark Cave)
// ============================================================

const WEAPONS: Record<string, Weapon> = {
  // STR weapons (physical, STR scaling)
  giants_club: {
    name: "Giant's Club",
    str: 4,
    agi: 0,
    int: 0,
    minDmg: 5,
    maxDmg: 7,
    scaling: "str",
    reqStr: 15,
    reqAgi: 0,
    reqInt: 0,
  },
  warhammer: {
    name: "Warhammer",
    str: 3,
    agi: 0,
    int: 0,
    minDmg: 4,
    maxDmg: 7,
    scaling: "str",
    reqStr: 13,
    reqAgi: 0,
    reqInt: 0,
  },
  steel_mace: {
    name: "Steel Mace",
    str: 2,
    agi: 0,
    int: 0,
    minDmg: 2,
    maxDmg: 4,
    scaling: "str",
    reqStr: 9,
    reqAgi: 0,
    reqInt: 0,
  },
  crystal_blade: {
    name: "Crystal Blade",
    str: 1,
    agi: 0,
    int: 2,
    minDmg: 6,
    maxDmg: 9,
    scaling: "str",
    reqStr: 5,
    reqAgi: 0,
    reqInt: 5,
  },
  etched_blade: {
    name: "Etched Blade",
    str: 1,
    agi: 0,
    int: 1,
    minDmg: 2,
    maxDmg: 3,
    scaling: "str",
    reqStr: 5,
    reqAgi: 0,
    reqInt: 5,
  },
  trolls_bonebreaker: {
    name: "Troll's Bonebreaker",
    str: 3,
    agi: 0,
    int: 0,
    minDmg: 4,
    maxDmg: 6,
    scaling: "str",
    reqStr: 12,
    reqAgi: 0,
    reqInt: 0,
  },
  brutes_cleaver: {
    name: "Brute's Cleaver",
    str: 2,
    agi: 0,
    int: 0,
    minDmg: 2,
    maxDmg: 4,
    scaling: "str",
    reqStr: 7,
    reqAgi: 0,
    reqInt: 0,
  },

  // AGI weapons (physical, AGI scaling)
  darkwood_bow: {
    name: "Darkwood Bow",
    str: 2,
    agi: 5,
    int: 0,
    minDmg: 6,
    maxDmg: 9,
    scaling: "agi",
    reqStr: 0,
    reqAgi: 18,
    reqInt: 0,
  },
  longbow: {
    name: "Longbow",
    str: 0,
    agi: 3,
    int: 0,
    minDmg: 4,
    maxDmg: 6,
    scaling: "agi",
    reqStr: 0,
    reqAgi: 15,
    reqInt: 0,
  },
  webspinner_bow: {
    name: "Webspinner Bow",
    str: 0,
    agi: 3,
    int: 0,
    minDmg: 3,
    maxDmg: 4,
    scaling: "agi",
    reqStr: 0,
    reqAgi: 10,
    reqInt: 0,
  },
  recurve_bow: {
    name: "Recurve Bow",
    str: 0,
    agi: 2,
    int: 0,
    minDmg: 2,
    maxDmg: 3,
    scaling: "agi",
    reqStr: 0,
    reqAgi: 7,
    reqInt: 0,
  },
  rat_kings_fang: {
    name: "Rat King's Fang",
    str: 0,
    agi: 2,
    int: 0,
    minDmg: 2,
    maxDmg: 3,
    scaling: "agi",
    reqStr: 0,
    reqAgi: 0,
    reqInt: 0,
  },

  // INT weapons (magic damage, INT scaling)
  smoldering_rod: {
    name: "Smoldering Rod",
    str: 0,
    agi: 2,
    int: 5,
    minDmg: 5,
    maxDmg: 8,
    scaling: "magic",
    reqStr: 0,
    reqAgi: 0,
    reqInt: 16,
    charges: 6, // v2: high-tier = limited charges
  },
  bone_staff: {
    name: "Bone Staff",
    str: 0,
    agi: 0,
    int: 3,
    minDmg: 3,
    maxDmg: 5,
    scaling: "magic",
    reqStr: 0,
    reqAgi: 0,
    reqInt: 13,
    charges: 8,
  },
  mage_staff: {
    name: "Mage Staff",
    str: 0,
    agi: 0,
    int: 3,
    minDmg: 3,
    maxDmg: 5,
    scaling: "magic",
    reqStr: 0,
    reqAgi: 0,
    reqInt: 11,
    charges: 8,
  },
  channeling_rod: {
    name: "Channeling Rod",
    str: 0,
    agi: 0,
    int: 2,
    minDmg: 2,
    maxDmg: 3,
    scaling: "magic",
    reqStr: 0,
    reqAgi: 0,
    reqInt: 10,
    charges: 10, // v2: low-tier = generous charges
  },
};

// v2: Physical fallback when magic charges are depleted
const FALLBACK_WEAPON: Weapon = {
  name: "Unarmed",
  str: 0,
  agi: 0,
  int: 0,
  minDmg: 1,
  maxDmg: 2,
  scaling: "str",
  reqStr: 0,
  reqAgi: 0,
  reqInt: 0,
};

// ============================================================
// DATA: Armor pieces (player-obtainable from Dark Cave)
// ============================================================

const ARMORS: Record<string, Armor> = {
  // STR armor
  cracked_stone_plate: {
    name: "Cracked Stone Plate",
    str: 3,
    agi: 0,
    int: 0,
    armor: 8,
    hp: 8,
    reqStr: 14,
    reqAgi: 0,
    reqInt: 0,
  },
  chainmail_shirt: {
    name: "Chainmail Shirt",
    str: 2,
    agi: 0,
    int: 0,
    armor: 8,
    hp: 8,
    reqStr: 12,
    reqAgi: 0,
    reqInt: 0,
  },
  studded_leather: {
    name: "Studded Leather",
    str: 1,
    agi: 0,
    int: 0,
    armor: 5,
    hp: 5,
    reqStr: 8,
    reqAgi: 0,
    reqInt: 0,
  },
  padded_armor: {
    name: "Padded Armor",
    str: 1,
    agi: 0,
    int: 0,
    armor: 3,
    hp: 0,
    reqStr: 8,
    reqAgi: 0,
    reqInt: 0,
  },
  scorched_scale: {
    name: "Scorched Scale Vest",
    str: 1,
    agi: 1,
    int: 4,
    armor: 8,
    hp: 6,
    reqStr: 12,
    reqAgi: 0,
    reqInt: 0,
  },

  // AGI armor
  stalkers_cloak: {
    name: "Stalker's Cloak",
    str: 0,
    agi: 5,
    int: 0,
    armor: 5,
    hp: 0,
    reqStr: 0,
    reqAgi: 14,
    reqInt: 0,
  },
  ranger_leathers: {
    name: "Ranger Leathers",
    str: 0,
    agi: 3,
    int: 0,
    armor: 6,
    hp: 0,
    reqStr: 0,
    reqAgi: 11,
    reqInt: 0,
  },
  spider_silk: {
    name: "Spider Silk Wraps",
    str: 0,
    agi: 4,
    int: 0,
    armor: 3,
    hp: 0,
    reqStr: 0,
    reqAgi: 12,
    reqInt: 0,
  },
  scout_armor: {
    name: "Scout Armor",
    str: 0,
    agi: 2,
    int: 0,
    armor: 4,
    hp: 0,
    reqStr: 0,
    reqAgi: 10,
    reqInt: 0,
  },

  // INT armor
  mage_robes: {
    name: "Mage Robes",
    str: 0,
    agi: 0,
    int: 3,
    armor: 4,
    hp: 0,
    reqStr: 0,
    reqAgi: 0,
    reqInt: 14,
  },
  acolyte_vestments: {
    name: "Acolyte Vestments",
    str: 0,
    agi: 0,
    int: 2,
    armor: 2,
    hp: 0,
    reqStr: 0,
    reqAgi: 0,
    reqInt: 7,
  },

  // No armor fallback
  none: {
    name: "None",
    str: 0,
    agi: 0,
    int: 0,
    armor: 0,
    hp: 0,
    reqStr: 0,
    reqAgi: 0,
    reqInt: 0,
  },
};

// ============================================================
// DATA: Dark Cave Monsters
// ============================================================

const MONSTERS: Monster[] = [
  { name: "Cave Rat", str: 4, agi: 7, int: 3, armor: 0, hp: 12, classType: 1, level: 1 },
  { name: "Fungal Shaman", str: 4, agi: 5, int: 9, armor: 0, hp: 14, classType: 2, level: 2 },
  { name: "Cavern Brute", str: 11, agi: 5, int: 4, armor: 1, hp: 22, classType: 0, level: 3 },
  { name: "Crystal Elem", str: 5, agi: 6, int: 12, armor: 1, hp: 20, classType: 2, level: 4 },
  { name: "Cave Troll", str: 14, agi: 8, int: 6, armor: 3, hp: 32, classType: 0, level: 5 },
  { name: "Phase Spider", str: 10, agi: 15, int: 7, armor: 0, hp: 28, classType: 1, level: 6 },
  { name: "Lich Acolyte", str: 8, agi: 9, int: 17, armor: 0, hp: 32, classType: 2, level: 7 },
  { name: "Stone Giant", str: 18, agi: 10, int: 9, armor: 4, hp: 48, classType: 0, level: 8 },
  { name: "Shadow Stalker", str: 14, agi: 20, int: 10, armor: 0, hp: 42, classType: 1, level: 9 },
  { name: "Shadow Dragon", str: 18, agi: 18, int: 20, armor: 3, hp: 70, classType: 2, level: 10 },
];

// ============================================================
// DATA: 27 Archetypes
// ============================================================

// Representative base rolls for each stat path (total = 19)
const BASE_ROLLS = {
  str: { str: 8, agi: 5, int: 6 },
  agi: { str: 5, agi: 8, int: 6 },
  int: { str: 5, agi: 6, int: 8 },
};

// Stat allocation strategies (over 20 base points + power source bonus)
// Physical: 21 total (20 + 1 at L5). Weave: 20 + 1 INT auto. Divine: 20 + 2 HP.
function statAllocation(
  path: "str" | "agi" | "int",
  ps: PowerSource
): { str: number; agi: number; int: number } {
  const extra = ps.type === "physical" ? 1 : 0;
  const total = TOTAL_STAT_POINTS + extra;
  const focus = total - 6; // dump 3 into each off-stat
  const off = 3;

  switch (path) {
    case "str":
      return { str: focus, agi: off, int: off };
    case "agi":
      return { str: off, agi: focus, int: off };
    case "int":
      return { str: off, agi: off, int: focus };
  }
}

function defineArchetype(
  id: string,
  archName: string,
  className: string,
  advClass: AdvancedClass,
  race: Race,
  sa: StartingArmor,
  ps: PowerSource,
  path: "str" | "agi" | "int",
  weapon: Weapon,
  armor: Armor
): Archetype {
  return {
    id,
    name: archName,
    className,
    advClass: advClass,
    race,
    startingArmor: sa,
    powerSource: ps,
    statPath: path,
    statAlloc: statAllocation(path, ps),
    weapon,
    armor,
    baseRoll: BASE_ROLLS[path],
  };
}

// Build all 27 archetypes
function buildArchetypes(): Archetype[] {
  const R = RACES;
  const SA = STARTING_ARMORS;
  const PS = POWER_SOURCES;
  const C = CLASSES;
  const W = WEAPONS;
  const A = ARMORS;

  return [
    // === WARRIOR ===
    defineArchetype("WAR-S", "Tank", "Warrior", C.warrior, R.dwarf, SA.plate, PS.physical, "str", W.giants_club, A.cracked_stone_plate),
    defineArchetype("WAR-A", "Fury", "Warrior", C.warrior, R.elf, SA.leather, PS.physical, "agi", W.darkwood_bow, A.stalkers_cloak),
    defineArchetype("WAR-I", "Battlemage", "Warrior", C.warrior, R.elf, SA.cloth, PS.weave, "int", W.smoldering_rod, A.mage_robes),

    // === PALADIN ===
    defineArchetype("PAL-S", "Crusader", "Paladin", C.paladin, R.dwarf, SA.plate, PS.physical, "str", W.warhammer, A.cracked_stone_plate),
    defineArchetype("PAL-A", "Avenger", "Paladin", C.paladin, R.elf, SA.leather, PS.physical, "agi", W.darkwood_bow, A.stalkers_cloak),
    defineArchetype("PAL-I", "Templar", "Paladin", C.paladin, R.elf, SA.cloth, PS.weave, "int", W.smoldering_rod, A.mage_robes),

    // === RANGER ===
    defineArchetype("RAN-S", "Beastmaster", "Ranger", C.ranger, R.dwarf, SA.plate, PS.physical, "str", W.giants_club, A.cracked_stone_plate),
    defineArchetype("RAN-A", "Sharpshooter", "Ranger", C.ranger, R.elf, SA.leather, PS.physical, "agi", W.darkwood_bow, A.stalkers_cloak),
    defineArchetype("RAN-I", "ArcaneArcher", "Ranger", C.ranger, R.elf, SA.cloth, PS.weave, "int", W.smoldering_rod, A.mage_robes),

    // === ROGUE ===
    defineArchetype("ROG-S", "Thug", "Rogue", C.rogue, R.dwarf, SA.plate, PS.physical, "str", W.giants_club, A.cracked_stone_plate),
    defineArchetype("ROG-A", "Assassin", "Rogue", C.rogue, R.elf, SA.leather, PS.physical, "agi", W.darkwood_bow, A.stalkers_cloak),
    defineArchetype("ROG-I", "Trickster", "Rogue", C.rogue, R.elf, SA.cloth, PS.weave, "int", W.smoldering_rod, A.mage_robes),

    // === DRUID ===
    defineArchetype("DRU-S", "Bear", "Druid", C.druid, R.dwarf, SA.plate, PS.physical, "str", W.giants_club, A.cracked_stone_plate),
    defineArchetype("DRU-A", "Cat", "Druid", C.druid, R.elf, SA.leather, PS.physical, "agi", W.darkwood_bow, A.stalkers_cloak),
    defineArchetype("DRU-I", "Caster", "Druid", C.druid, R.elf, SA.cloth, PS.weave, "int", W.smoldering_rod, A.mage_robes),

    // === WARLOCK ===
    defineArchetype("WLK-S", "Hexblade", "Warlock", C.warlock, R.dwarf, SA.plate, PS.physical, "str", W.crystal_blade, A.cracked_stone_plate),
    defineArchetype("WLK-A", "Shadow", "Warlock", C.warlock, R.elf, SA.leather, PS.physical, "agi", W.darkwood_bow, A.stalkers_cloak),
    defineArchetype("WLK-I", "VoidMage", "Warlock", C.warlock, R.elf, SA.cloth, PS.weave, "int", W.smoldering_rod, A.mage_robes),

    // === WIZARD ===
    defineArchetype("WIZ-S", "WarMage", "Wizard", C.wizard, R.dwarf, SA.plate, PS.physical, "str", W.crystal_blade, A.cracked_stone_plate),
    defineArchetype("WIZ-A", "Spellblade", "Wizard", C.wizard, R.elf, SA.leather, PS.physical, "agi", W.darkwood_bow, A.stalkers_cloak),
    defineArchetype("WIZ-I", "Archmage", "Wizard", C.wizard, R.elf, SA.cloth, PS.weave, "int", W.smoldering_rod, A.mage_robes),

    // === CLERIC ===
    defineArchetype("CLR-S", "BattlePriest", "Cleric", C.cleric, R.dwarf, SA.plate, PS.physical, "str", W.warhammer, A.cracked_stone_plate),
    defineArchetype("CLR-A", "WindCleric", "Cleric", C.cleric, R.elf, SA.leather, PS.physical, "agi", W.darkwood_bow, A.stalkers_cloak),
    defineArchetype("CLR-I", "HighPriest", "Cleric", C.cleric, R.elf, SA.cloth, PS.weave, "int", W.smoldering_rod, A.mage_robes),

    // === SORCERER ===
    defineArchetype("SOR-S", "Spellsword", "Sorcerer", C.sorcerer, R.dwarf, SA.plate, PS.physical, "str", W.crystal_blade, A.cracked_stone_plate),
    defineArchetype("SOR-A", "StormMage", "Sorcerer", C.sorcerer, R.elf, SA.leather, PS.physical, "agi", W.darkwood_bow, A.stalkers_cloak),
    defineArchetype("SOR-I", "Elementalist", "Sorcerer", C.sorcerer, R.elf, SA.cloth, PS.weave, "int", W.smoldering_rod, A.mage_robes),
  ];
}

// ============================================================
// STAT CALCULATION
// ============================================================

function buildStats(arch: Archetype): Stats {
  // 1. Base roll
  let str = arch.baseRoll.str;
  let agi = arch.baseRoll.agi;
  let int_ = arch.baseRoll.int;
  let hp = BASE_HP;

  // 2. Race mods
  str += arch.race.str;
  agi += arch.race.agi;
  int_ += arch.race.int;
  hp += arch.race.hp;

  // 3. Starting armor mods
  str += arch.startingArmor.str;
  agi += arch.startingArmor.agi;
  int_ += arch.startingArmor.int;
  hp += arch.startingArmor.hp;

  // 4. Level-up stat allocation
  str += arch.statAlloc.str;
  agi += arch.statAlloc.agi;
  int_ += arch.statAlloc.int;

  // 5. HP from leveling
  hp += TOTAL_HP_FROM_LEVELS;

  // 6. Power source bonus at L5
  if (arch.powerSource.type === "weave") {
    int_ += 1;
  } else if (arch.powerSource.type === "divine") {
    hp += 2;
  }
  // Physical's +1 stat point is already included in statAllocation()

  // 7. Equipped weapon stat mods
  str += arch.weapon.str;
  agi += arch.weapon.agi;
  int_ += arch.weapon.int;

  // 8. Equipped armor stat mods
  str += arch.armor.str;
  agi += arch.armor.agi;
  int_ += arch.armor.int;
  hp += arch.armor.hp;

  // 9. Class HP multiplier
  if (arch.advClass.hpMult !== CLASS_MULTIPLIER_BASE) {
    hp = Math.floor((hp * arch.advClass.hpMult) / CLASS_MULTIPLIER_BASE);
  }

  return {
    str,
    agi,
    int: int_,
    armor: arch.armor.armor,
    hp,
  };
}

// ============================================================
// COMBAT MATH (port of CombatMath.sol + CombatSystem.sol)
// ============================================================

/** Hit probability (%) — matches CombatMath.calculateToHit */
function calcHitProb(attackerStat: number, defenderStat: number): number {
  const dampener =
    attackerStat > defenderStat ? ATTACKER_HIT_DAMPENER : DEFENDER_HIT_DAMPENER;
  const diff = attackerStat - defenderStat;
  const absDiff = Math.abs(diff);

  let p = STARTING_HIT_PROBABILITY + (diff * 1000) / ((absDiff + dampener) * 10);
  p = Math.floor(p);
  if (p < 5) p = 5;
  if (p > 98) p = 98;
  return p;
}

/**
 * Stat bonus on damage — matches CombatMath.addStatBonus
 * Uses WAD-scaled integers to match Solidity behavior
 */
function addStatBonus(
  attackerStat: number,
  defenderStat: number,
  baseDamageWad: number,
  attackModifier: number
): number {
  const baseDifference = attackerStat * attackModifier - defenderStat * WAD;

  if (baseDifference > 0) {
    // Halve the stat bonus
    const unrounded = baseDifference / 2 + baseDamageWad;
    return Math.floor(unrounded / WAD);
  } else if (
    baseDamageWad > 0 &&
    baseDifference < 0 &&
    Math.abs(baseDifference / WAD) >= attackerStat
  ) {
    const adjusted = baseDamageWad + baseDifference;
    if (adjusted > 0) {
      return Math.floor(adjusted / WAD);
    }
    return 1; // minimum 1 damage
  }
  return Math.floor(baseDamageWad / WAD);
}

/** Armor reduction — matches CombatMath.calculateArmorModifier */
function calcArmorReduction(armor: number, damage: number): number {
  if (armor <= 0) return 0;
  const reduction = Math.floor((armor * DEFENSE_MODIFIER) / WAD);
  if (damage - armor < 0) return damage; // armor exceeds damage
  return reduction;
}

/** Magic resistance — matches CombatMath.calculateMagicResistance */
function calcMagicResist(defenderInt: number, damage: number): number {
  if (damage <= 0) return 0;
  let resistPct = defenderInt * 2;
  if (resistPct > 40) resistPct = 40;
  if (resistPct < 0) resistPct = 0;
  let resist = Math.floor((damage * resistPct) / 100);
  if (resist >= damage) resist = damage - 1;
  return resist;
}

/** Crit chance (%) = base 4% + AGI/4 + equipment bonus */
function calcCritChance(agi: number, bonusCritChance: number = 0): number {
  const agiBonus = agi > 0 ? Math.floor(agi / 4) : 0;
  return 4 + agiBonus + bonusCritChance;
}

/** Evasion chance (%) for physical attacks — defender AGI vs attacker AGI */
function calcEvasionChance(defenderAgi: number, attackerAgi: number): number {
  if (defenderAgi <= attackerAgi) return 0;
  let chance = Math.floor((defenderAgi - attackerAgi) / 3);
  if (chance > EVASION_CAP) chance = EVASION_CAP;
  return chance;
}

/** Double strike chance (%) for AGI weapons — attacker AGI vs defender AGI */
function calcDoubleStrikeChance(
  attackerAgi: number,
  defenderAgi: number
): number {
  if (attackerAgi <= defenderAgi) return 0;
  let chance = (attackerAgi - defenderAgi) * 2;
  if (chance > DOUBLE_STRIKE_CAP) chance = DOUBLE_STRIKE_CAP;
  return chance;
}

/** v2: Block chance (%) — defender STR reduces incoming damage, halved vs magic */
function calcBlockChance(defenderStr: number, isMagic: boolean): number {
  let chance = Math.floor(defenderStr * BLOCK_CHANCE_PER_STR);
  if (isMagic) chance = Math.floor(chance * BLOCK_VS_MAGIC_PENALTY);
  if (chance > BLOCK_CAP) chance = BLOCK_CAP;
  return Math.max(0, chance);
}

/** Combat triangle: STR > AGI > INT > STR. Returns damage multiplier (1.0 = no bonus) */
function calcTriangleMultiplier(
  attackerStats: Stats,
  defenderStats: Stats
): number {
  // Determine dominant stats
  const aDom = getDominant(attackerStats);
  const dDom = getDominant(defenderStats);

  // Check advantage: 0(STR) > 1(AGI), 1(AGI) > 2(INT), 2(INT) > 0(STR)
  const hasAdvantage =
    (aDom.type === 0 && dDom.type === 1) ||
    (aDom.type === 1 && dDom.type === 2) ||
    (aDom.type === 2 && dDom.type === 0);

  if (!hasAdvantage) return 1.0;

  const diff = Math.max(0, aDom.value - dDom.value);
  let bonus = diff * (COMBAT_TRIANGLE_BONUS_PER_STAT / WAD);
  if (bonus > COMBAT_TRIANGLE_MAX_BONUS / WAD) {
    bonus = COMBAT_TRIANGLE_MAX_BONUS / WAD;
  }
  return 1.0 + bonus;
}

function getDominant(s: Stats): { type: number; value: number } {
  if (s.str >= s.agi && s.str >= s.int) return { type: 0, value: s.str };
  if (s.agi > s.str && s.agi >= s.int) return { type: 1, value: s.agi };
  return { type: 2, value: s.int };
}

// ============================================================
// SIMULATION
// ============================================================

function simulate(
  attacker: { stats: Stats; weapon: Weapon; advClass: AdvancedClass },
  defender: Stats
): CombatResult {
  const isMagic = attacker.weapon.scaling === "magic";
  const isAgi = attacker.weapon.scaling === "agi";
  const w = attacker.weapon;
  const ac = attacker.advClass;
  const a = attacker.stats;
  const d = defender;

  // --- Hit probability ---
  // v2: STR weapons use STR vs defender AGI (not AGI vs AGI)
  let hitPct: number;
  if (isMagic) {
    hitPct = calcHitProb(a.int, d.int); // INT vs INT
  } else if (isAgi) {
    hitPct = calcHitProb(a.agi, d.agi); // AGI vs AGI for AGI weapons
  } else {
    hitPct = calcHitProb(a.str, d.agi); // v2: STR vs defender AGI for STR weapons
  }

  // --- Crit chance ---
  const critPct = calcCritChance(a.agi);

  // --- Base damage (average, non-crit) ---
  let normalDmg: number;
  let critDmg: number;
  const avgWeaponDmg = (w.minDmg + w.maxDmg) / 2;

  if (isMagic) {
    // Magic path: INT vs INT, ATTACK_MODIFIER
    const normalBase = Math.floor(avgWeaponDmg * ATTACK_MODIFIER);
    normalDmg = addStatBonus(a.int, d.int, normalBase, ATTACK_MODIFIER);
    if (normalDmg < 1) normalDmg = 1;

    const critBase = Math.floor(w.maxDmg * ATTACK_MODIFIER);
    critDmg = addStatBonus(a.int, d.int, critBase, ATTACK_MODIFIER);
    if (critDmg < 1) critDmg = 1;
    critDmg *= CRIT_MULTIPLIER;

    // Magic resistance (applied after crit)
    normalDmg -= calcMagicResist(d.int, normalDmg);
    if (normalDmg < 1) normalDmg = 1;
    critDmg -= calcMagicResist(d.int, critDmg);
    if (critDmg < 1) critDmg = 1;

    // Class spell multiplier
    if (ac.spellMult !== CLASS_MULTIPLIER_BASE) {
      normalDmg = Math.floor((normalDmg * ac.spellMult) / CLASS_MULTIPLIER_BASE);
      critDmg = Math.floor((critDmg * ac.spellMult) / CLASS_MULTIPLIER_BASE);
    }

    // Class crit multiplier (additional, on top of 2x)
    if (ac.critMult > CLASS_MULTIPLIER_BASE) {
      critDmg = Math.floor((critDmg * ac.critMult) / CLASS_MULTIPLIER_BASE);
    }
  } else {
    // Physical path
    const primaryAtk = isAgi ? a.agi : a.str;
    const primaryDef = isAgi ? d.agi : d.str;
    const scalingMod = isAgi ? AGI_ATTACK_MODIFIER : ATTACK_MODIFIER;

    const normalBase = Math.floor(avgWeaponDmg * scalingMod);
    normalDmg = addStatBonus(primaryAtk, primaryDef, normalBase, scalingMod);
    if (normalDmg < 1) normalDmg = 1;

    const critBase = Math.floor(w.maxDmg * scalingMod);
    critDmg = addStatBonus(primaryAtk, primaryDef, critBase, scalingMod);
    if (critDmg < 1) critDmg = 1;

    // Armor reduction (before crit multiplier)
    normalDmg -= calcArmorReduction(d.armor, normalDmg);
    if (normalDmg < 0) normalDmg = 0;
    critDmg -= calcArmorReduction(d.armor, critDmg);
    if (critDmg < 0) critDmg = 0;

    // Crit multiplier
    critDmg *= CRIT_MULTIPLIER;

    // Class physical multiplier
    if (ac.physMult !== CLASS_MULTIPLIER_BASE) {
      normalDmg = Math.floor((normalDmg * ac.physMult) / CLASS_MULTIPLIER_BASE);
      critDmg = Math.floor((critDmg * ac.physMult) / CLASS_MULTIPLIER_BASE);
    }

    // Class crit multiplier (additional)
    if (ac.critMult > CLASS_MULTIPLIER_BASE) {
      critDmg = Math.floor((critDmg * ac.critMult) / CLASS_MULTIPLIER_BASE);
    }
  }

  // --- Combat triangle ---
  const triangleMult = calcTriangleMultiplier(a, d);
  normalDmg = Math.floor(normalDmg * triangleMult);
  critDmg = Math.floor(critDmg * triangleMult);

  // --- Average damage per hit (weighted by crit chance) ---
  const critFrac = critPct / 100;
  const avgDmgPerHit = normalDmg * (1 - critFrac) + critDmg * critFrac;

  // --- Evasion (physical only) ---
  let evasionPct = 0;
  if (!isMagic) {
    evasionPct = calcEvasionChance(d.agi, a.agi);
  }

  // --- Double strike (AGI weapons only) ---
  let doubleStrikePct = 0;
  if (isAgi) {
    doubleStrikePct = calcDoubleStrikeChance(a.agi, d.agi);
  }

  // --- v2: Block (defender STR, halved vs magic) ---
  const blockPct = calcBlockChance(d.str, isMagic);

  // --- Effective DPT ---
  const hitFrac = hitPct / 100;
  const evadeFrac = evasionPct / 100;
  const dsFrac = doubleStrikePct / 100;
  const blockFrac = blockPct / 100;
  const effectiveDPT =
    avgDmgPerHit *
    hitFrac *
    (1 - evadeFrac) *
    (1 + dsFrac * 0.5) *
    (1 - blockFrac * BLOCK_DAMAGE_REDUCTION); // v2: block reduces effective damage

  // --- TTK ---
  const turnsToKill =
    effectiveDPT > 0 ? Math.ceil(d.hp / effectiveDPT) : 999;

  return {
    hitPct,
    avgDmgPerHit: Math.round(avgDmgPerHit * 100) / 100,
    critPct,
    evasionPct,
    doubleStrikePct,
    blockPct,
    effectiveDPT: Math.round(effectiveDPT * 100) / 100,
    turnsToKill,
    isMagic,
  };
}

// ============================================================
// v2: CHARGE-AWARE MATCHUP SIMULATION
// ============================================================

/**
 * Wraps simulate() with charge-aware TTK for magic weapons.
 * If weapon has charges, computes magic phase + physical fallback phase.
 */
function simulateMatchup(
  attacker: { stats: Stats; weapon: Weapon; advClass: AdvancedClass },
  defender: Stats
): MatchupResult {
  const mainResult = simulate(attacker, defender);
  const charges = attacker.weapon.charges ?? 0;

  if (!charges) {
    // Physical weapon — no charge mechanic
    return {
      ...mainResult,
      magicCharges: 0,
      fallbackDPT: 0,
      chargeAwareTTK: mainResult.turnsToKill,
      chargeAwareDPT: mainResult.effectiveDPT,
    };
  }

  const magicDPT = mainResult.effectiveDPT;

  // Can we kill during magic phase?
  if (magicDPT * charges >= defender.hp) {
    const ttk = magicDPT > 0 ? Math.ceil(defender.hp / magicDPT) : 999;
    return {
      ...mainResult,
      turnsToKill: ttk,
      magicCharges: charges,
      fallbackDPT: 0,
      chargeAwareTTK: ttk,
      chargeAwareDPT: mainResult.effectiveDPT,
    };
  }

  // Need physical fallback — compute fallback DPT
  const fallbackResult = simulate(
    { stats: attacker.stats, weapon: FALLBACK_WEAPON, advClass: attacker.advClass },
    defender
  );
  const physDPT = fallbackResult.effectiveDPT;

  const magicPhaseDmg = magicDPT * charges;
  const remainingHP = defender.hp - magicPhaseDmg;
  const fallbackTurns = physDPT > 0 ? Math.ceil(remainingHP / physDPT) : 999;
  const totalTTK = charges + fallbackTurns;

  // Effective DPT averaged over total fight
  const chargeAwareDPT = totalTTK < 999 ? defender.hp / totalTTK : 0;

  return {
    ...mainResult,
    magicCharges: charges,
    fallbackDPT: Math.round(physDPT * 100) / 100,
    chargeAwareTTK: totalTTK,
    chargeAwareDPT: Math.round(chargeAwareDPT * 100) / 100,
  };
}

// ============================================================
// OUTPUT HELPERS
// ============================================================

function pad(s: string | number, len: number): string {
  return String(s).padEnd(len);
}

function rpad(s: string | number, len: number): string {
  return String(s).padStart(len);
}

// ============================================================
// REPORTS
// ============================================================

function reportStats(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(120));
  console.log("  ARCHETYPE STATS AT LEVEL 10");
  console.log("=".repeat(120));
  console.log(
    pad("ID", 7) +
      pad("Name", 14) +
      pad("Class", 10) +
      pad("Race", 7) +
      pad("Path", 5) +
      rpad("STR", 5) +
      rpad("AGI", 5) +
      rpad("INT", 5) +
      rpad("ARM", 5) +
      rpad("HP", 5) +
      "  " +
      pad("Weapon", 20) +
      pad("Armor", 22)
  );
  console.log("-".repeat(120));

  for (const arch of archetypes) {
    const s = buildStats(arch);
    console.log(
      pad(arch.id, 7) +
        pad(arch.name, 14) +
        pad(arch.className, 10) +
        pad(arch.race.name, 7) +
        pad(arch.statPath.toUpperCase(), 5) +
        rpad(s.str, 5) +
        rpad(s.agi, 5) +
        rpad(s.int, 5) +
        rpad(s.armor, 5) +
        rpad(s.hp, 5) +
        "  " +
        pad(arch.weapon.name, 20) +
        pad(arch.armor.name, 22)
    );
  }
}

function reportPvE(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(150));
  console.log("  PVE: TURNS TO KILL (each archetype vs each Dark Cave monster)");
  console.log("  Lower = better. 999 = can't kill. * = hit charge limit, using fallback.");
  console.log("=".repeat(150));

  // Header
  const monNames = MONSTERS.map((m) => m.name.slice(0, 10));
  let header = pad("Archetype", 22);
  for (const mn of monNames) header += rpad(mn, 12);
  header += rpad("Avg TTK", 9);
  console.log(header);
  console.log("-".repeat(150));

  for (const arch of archetypes) {
    const stats = buildStats(arch);
    let row = pad(`${arch.id} ${arch.name}`, 22);
    let totalTTK = 0;
    let count = 0;

    for (const mon of MONSTERS) {
      const defStats: Stats = {
        str: mon.str,
        agi: mon.agi,
        int: mon.int,
        armor: mon.armor,
        hp: mon.hp,
      };
      const r = simulateMatchup(
        { stats, weapon: arch.weapon, advClass: arch.advClass },
        defStats
      );
      const ttk = r.chargeAwareTTK;
      const usedFallback = r.magicCharges > 0 && ttk > r.magicCharges;
      const label = ttk >= 999 ? "X" : String(ttk) + (usedFallback ? "*" : "");
      row += rpad(label, 12);
      totalTTK += ttk;
      count++;
    }
    const avgTTK = (totalTTK / count).toFixed(1);
    row += rpad(avgTTK, 9);
    console.log(row);
  }
}

function reportPvEDetailed(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(130));
  console.log("  PVE DETAILED: DPT per archetype vs key monsters");
  console.log("  Format: DPT (hit%/crit%/evade%/ds%/blk%) — charges shown for magic weapons");
  console.log("=".repeat(130));

  // Show only vs key monsters: Cave Rat (L1), Cave Troll (L5), Shadow Dragon (L10)
  const keyMonsters = [MONSTERS[0], MONSTERS[4], MONSTERS[9]];

  for (const arch of archetypes) {
    const stats = buildStats(arch);
    const tag = arch.weapon.scaling === "magic" ? "[M]" : arch.weapon.scaling === "agi" ? "[A]" : "[S]";
    const chargeLabel = arch.weapon.charges ? ` (${arch.weapon.charges} charges)` : "";
    console.log(`\n  ${arch.id} ${arch.name} (${arch.className}) ${tag}${chargeLabel}`);

    for (const mon of keyMonsters) {
      const defStats: Stats = {
        str: mon.str,
        agi: mon.agi,
        int: mon.int,
        armor: mon.armor,
        hp: mon.hp,
      };
      const r = simulateMatchup(
        { stats, weapon: arch.weapon, advClass: arch.advClass },
        defStats
      );
      const fallbackNote = r.magicCharges > 0 && r.chargeAwareTTK > r.magicCharges
        ? ` [FALLBACK after ${r.magicCharges}t, phys DPT=${r.fallbackDPT}]`
        : "";
      console.log(
        `    vs ${pad(mon.name, 16)} DPT=${rpad(r.chargeAwareDPT.toFixed(1), 7)} ` +
          `TTK=${rpad(r.chargeAwareTTK, 3)} ` +
          `hit=${rpad(r.hitPct, 2)}% crit=${rpad(r.critPct, 2)}% ` +
          `evd=${rpad(r.evasionPct, 2)}% ds=${rpad(r.doubleStrikePct, 2)}% ` +
          `blk=${rpad(r.blockPct, 2)}% ` +
          `dmg=${rpad(r.avgDmgPerHit.toFixed(1), 6)}${fallbackNote}`
      );
    }
  }
}

function reportPvP(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(100));
  console.log("  PVP WIN MATRIX (lower TTK wins)");
  console.log("  W = row wins, L = row loses, D = draw");
  console.log("=".repeat(100));

  // Stats tracking
  const wins: number[] = new Array(archetypes.length).fill(0);
  const losses: number[] = new Array(archetypes.length).fill(0);
  const draws: number[] = new Array(archetypes.length).fill(0);

  // Precompute all stats
  const allStats = archetypes.map((a) => buildStats(a));

  // Compute TTK matrix (using charge-aware TTK)
  const ttkMatrix: number[][] = [];
  for (let i = 0; i < archetypes.length; i++) {
    ttkMatrix[i] = [];
    for (let j = 0; j < archetypes.length; j++) {
      if (i === j) {
        ttkMatrix[i][j] = 0;
        continue;
      }
      const r = simulateMatchup(
        {
          stats: allStats[i],
          weapon: archetypes[i].weapon,
          advClass: archetypes[i].advClass,
        },
        allStats[j]
      );
      ttkMatrix[i][j] = r.chargeAwareTTK;
    }
  }

  // Header (compact IDs)
  let header = pad("", 22);
  for (const a of archetypes) header += rpad(a.id, 6);
  console.log(header);
  console.log("-".repeat(22 + archetypes.length * 6));

  // Matrix rows
  for (let i = 0; i < archetypes.length; i++) {
    let row = pad(`${archetypes[i].id} ${archetypes[i].name}`, 22);
    for (let j = 0; j < archetypes.length; j++) {
      if (i === j) {
        row += rpad("-", 6);
        continue;
      }
      const myTTK = ttkMatrix[i][j];
      const theirTTK = ttkMatrix[j][i];
      if (myTTK < theirTTK) {
        row += rpad("W", 6);
        wins[i]++;
        losses[j]++;
      } else if (myTTK > theirTTK) {
        row += rpad("L", 6);
      } else {
        row += rpad("D", 6);
        draws[i]++;
      }
    }
    console.log(row);
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("  PVP RANKINGS (sorted by win rate)");
  console.log("=".repeat(70));
  console.log(
    pad("Archetype", 22) +
      rpad("Wins", 6) +
      rpad("Loss", 6) +
      rpad("Draw", 6) +
      rpad("WinRate", 8) +
      "  Path"
  );
  console.log("-".repeat(70));

  const ranked = archetypes
    .map((a, i) => ({
      arch: a,
      wins: wins[i],
      losses: losses[i],
      draws: draws[i],
      winRate: wins[i] / (archetypes.length - 1),
    }))
    .sort((a, b) => b.winRate - a.winRate);

  for (const r of ranked) {
    console.log(
      pad(`${r.arch.id} ${r.arch.name}`, 22) +
        rpad(r.wins, 6) +
        rpad(r.losses, 6) +
        rpad(r.draws, 6) +
        rpad((r.winRate * 100).toFixed(0) + "%", 8) +
        "  " +
        r.arch.statPath.toUpperCase()
    );
  }
}

function reportAnalysis(archetypes: Archetype[]) {
  const allStats = archetypes.map((a) => buildStats(a));

  console.log("\n" + "=".repeat(100));
  console.log("  BALANCE ANALYSIS");
  console.log("=".repeat(100));

  // --- DPT vs neutral target ---
  console.log("\n--- DPT vs Neutral Target (12/12/12, 2 armor, 40 HP) ---");
  const neutral: Stats = { str: 12, agi: 12, int: 12, armor: 2, hp: 40 };

  const dptResults = archetypes.map((a, i) => {
    const r = simulateMatchup(
      { stats: allStats[i], weapon: a.weapon, advClass: a.advClass },
      neutral
    );
    return {
      arch: a,
      stats: allStats[i],
      dpt: r.chargeAwareDPT,
      ttk: r.chargeAwareTTK,
      result: r,
      magicDPT: r.effectiveDPT,
      charges: r.magicCharges,
    };
  });

  dptResults.sort((a, b) => b.dpt - a.dpt);

  const bestDPT = dptResults[0].dpt;
  const worstDPT = dptResults[dptResults.length - 1].dpt;

  console.log(
    pad("Archetype", 22) +
      rpad("DPT", 8) +
      rpad("TTK", 5) +
      rpad("% Best", 8) +
      rpad("Hit%", 6) +
      rpad("Blk%", 6) +
      "  Weapon"
  );
  console.log("-".repeat(90));

  for (const r of dptResults) {
    const pct = ((r.dpt / bestDPT) * 100).toFixed(0);
    const tag = r.result.isMagic ? " [M]" : r.arch.weapon.scaling === "agi" ? " [A]" : " [S]";
    const chargeNote = r.charges > 0 ? ` (${r.charges}ch)` : "";
    console.log(
      pad(`${r.arch.id} ${r.arch.name}`, 22) +
        rpad(r.dpt.toFixed(1), 8) +
        rpad(r.ttk, 5) +
        rpad(pct + "%", 8) +
        rpad(r.result.hitPct + "%", 6) +
        rpad(r.result.blockPct + "%", 6) +
        "  " +
        r.arch.weapon.name +
        tag +
        chargeNote
    );
  }

  console.log(`\n  Spread: best=${bestDPT.toFixed(1)} worst=${worstDPT.toFixed(1)} ratio=${(worstDPT / bestDPT * 100).toFixed(0)}%`);

  // --- On-path vs off-path comparison ---
  console.log("\n--- On-Path vs Off-Path DPT by Class ---");
  console.log("  Shows how much each class loses by going off their 'natural' stat path.\n");

  const classGroups: Record<string, typeof dptResults> = {};
  for (const r of dptResults) {
    const cn = r.arch.className;
    if (!classGroups[cn]) classGroups[cn] = [];
    classGroups[cn].push(r);
  }

  for (const [className, results] of Object.entries(classGroups)) {
    const sorted = results.sort((a, b) => b.dpt - a.dpt);
    const best = sorted[0];
    console.log(`  ${className}:`);
    for (const r of sorted) {
      const pctOfBest = ((r.dpt / best.dpt) * 100).toFixed(0);
      const marker = r === best ? " <-- best" : "";
      console.log(
        `    ${r.arch.id} ${pad(r.arch.name, 14)} ${r.arch.statPath.toUpperCase()} ` +
          `DPT=${rpad(r.dpt.toFixed(1), 7)} (${pctOfBest}%)${marker}`
      );
    }
  }

  // --- Shadow Dragon survivability ---
  console.log("\n--- Boss Fight: All archetypes vs Shadow Dragon ---");
  console.log("  TTK < 15 = can solo. TTK > 15 = needs help.\n");

  const dragon = MONSTERS[9];
  const dragonStats: Stats = {
    str: dragon.str,
    agi: dragon.agi,
    int: dragon.int,
    armor: dragon.armor,
    hp: dragon.hp,
  };

  const bossResults = archetypes
    .map((a, i) => {
      const r = simulateMatchup(
        { stats: allStats[i], weapon: a.weapon, advClass: a.advClass },
        dragonStats
      );
      return { arch: a, result: r };
    })
    .sort((a, b) => a.result.chargeAwareTTK - b.result.chargeAwareTTK);

  for (const r of bossResults) {
    const ttk = r.result.chargeAwareTTK;
    const canSolo = ttk <= 15 ? "CAN SOLO" : "NEEDS HELP";
    const fallbackNote = r.result.magicCharges > 0 && ttk > r.result.magicCharges
      ? ` [charges: ${r.result.magicCharges}, fallback DPT: ${r.result.fallbackDPT}]`
      : "";
    console.log(
      `  ${pad(r.arch.id, 7)} ${pad(r.arch.name, 14)} TTK=${rpad(ttk, 3)} ` +
        `DPT=${rpad(r.result.chargeAwareDPT.toFixed(1), 7)} ${canSolo}${fallbackNote}`
    );
  }

  // --- Key issues ---
  console.log("\n--- KEY BALANCE ISSUES ---\n");

  // Check if magic path dominates
  const magicBuilds = dptResults.filter((r) => r.result.isMagic);
  const physBuilds = dptResults.filter((r) => !r.result.isMagic);
  const avgMagicDPT =
    magicBuilds.reduce((s, r) => s + r.dpt, 0) / magicBuilds.length;
  const avgPhysDPT =
    physBuilds.reduce((s, r) => s + r.dpt, 0) / physBuilds.length;

  console.log(`  Magic avg DPT: ${avgMagicDPT.toFixed(1)} (${magicBuilds.length} builds)`);
  console.log(`  Physical avg DPT: ${avgPhysDPT.toFixed(1)} (${physBuilds.length} builds)`);
  console.log(`  Magic/Physical ratio: ${(avgMagicDPT / avgPhysDPT * 100).toFixed(0)}%`);

  if (avgMagicDPT > avgPhysDPT * 1.3) {
    console.log("  !! MAGIC PATH OVERPOWERED — exceeds physical by >30%");
  }

  // Check build viability floor
  const viabilityFloor = bestDPT * 0.25;
  const unviable = dptResults.filter((r) => r.dpt < viabilityFloor);
  if (unviable.length > 0) {
    console.log(`\n  !! ${unviable.length} builds below 25% viability floor:`);
    for (const r of unviable) {
      console.log(
        `     ${r.arch.id} ${r.arch.name}: DPT=${r.dpt.toFixed(1)} (${((r.dpt / bestDPT) * 100).toFixed(0)}%)`
      );
    }
  } else {
    console.log("\n  All builds above 25% viability floor.");
  }

  // Check class multiplier waste on off-path
  console.log("\n  Off-path multiplier waste:");
  for (const a of archetypes) {
    const physBenefit = a.advClass.physMult > CLASS_MULTIPLIER_BASE;
    const spellBenefit = a.advClass.spellMult > CLASS_MULTIPLIER_BASE;
    const usesMagic = a.weapon.scaling === "magic";

    if (physBenefit && usesMagic) {
      console.log(
        `    ${a.id} ${a.name}: Has ${a.advClass.physMult / 10}% phys mult but uses magic weapon — WASTED`
      );
    }
    if (spellBenefit && !usesMagic) {
      console.log(
        `    ${a.id} ${a.name}: Has ${a.advClass.spellMult / 10}% spell mult but uses physical weapon — WASTED`
      );
    }
  }

  // --- v2: Charge impact analysis ---
  console.log("\n--- CHARGE IMPACT (magic weapons only) ---");
  console.log("  Shows how much charges nerf magic builds vs longer fights.\n");

  const magicArchetypes = archetypes.filter((a) => a.weapon.scaling === "magic");
  for (const a of magicArchetypes) {
    const i = archetypes.indexOf(a);
    const r = simulateMatchup(
      { stats: allStats[i], weapon: a.weapon, advClass: a.advClass },
      neutral
    );
    const pureR = simulate(
      { stats: allStats[i], weapon: a.weapon, advClass: a.advClass },
      neutral
    );
    const dptDrop = pureR.effectiveDPT > 0
      ? ((r.chargeAwareDPT / pureR.effectiveDPT) * 100).toFixed(0)
      : "N/A";
    console.log(
      `  ${pad(a.id, 7)} ${pad(a.name, 14)} charges=${rpad(a.weapon.charges!, 2)} ` +
        `magic DPT=${rpad(pureR.effectiveDPT.toFixed(1), 7)} ` +
        `effective DPT=${rpad(r.chargeAwareDPT.toFixed(1), 7)} ` +
        `(${dptDrop}% of pure magic) TTK=${r.chargeAwareTTK}`
    );
  }

  // --- v2: Block impact by stat path ---
  console.log("\n--- BLOCK IMPACT BY STAT PATH ---");
  console.log("  Avg block chance when each path is DEFENDING.\n");

  for (const path of ["str", "agi", "int"] as const) {
    const pathBuilds = archetypes.filter((a) => a.statPath === path);
    const pathStats = pathBuilds.map((a) => buildStats(a));
    const avgSTR = pathStats.reduce((s, st) => s + st.str, 0) / pathStats.length;
    const physBlock = calcBlockChance(Math.round(avgSTR), false);
    const magicBlock = calcBlockChance(Math.round(avgSTR), true);
    console.log(
      `  ${path.toUpperCase()} path: avg STR=${avgSTR.toFixed(0)} → ` +
        `block vs phys=${physBlock}% block vs magic=${magicBlock}% ` +
        `(${(physBlock * BLOCK_DAMAGE_REDUCTION).toFixed(0)}%/${(magicBlock * BLOCK_DAMAGE_REDUCTION).toFixed(0)}% effective dmg reduction)`
    );
  }

  // --- Mechanic summary ---
  console.log("\n--- MECHANIC SUMMARY ---");
  console.log(`  Triangle bonus: ${((COMBAT_TRIANGLE_BONUS_PER_STAT / WAD) * 100).toFixed(0)}%/pt, ${((COMBAT_TRIANGLE_MAX_BONUS / WAD) * 100).toFixed(0)}% cap`);
  console.log(`  Block: ${BLOCK_CHANCE_PER_STR}%/STR, ${BLOCK_CAP}% cap, ${(BLOCK_DAMAGE_REDUCTION * 100).toFixed(0)}% reduction, ${(BLOCK_VS_MAGIC_PENALTY * 100).toFixed(0)}% rate vs magic`);
  console.log(`  Charges: ${Object.entries(WEAPONS).filter(([,w]) => w.charges).map(([,w]) => `${w.name}=${w.charges}`).join(", ")}`);
  console.log(`  Hit formula: STR weapons=STR vs AGI, AGI weapons=AGI vs AGI, Magic=INT vs INT`);
}

// ============================================================
// v2: COMPARE MODE — old vs new mechanics side-by-side
// ============================================================

function reportCompare(archetypes: Archetype[]) {
  const allStats = archetypes.map((a) => buildStats(a));

  // Save current constants
  const NEW_TRIANGLE_PER_STAT = COMBAT_TRIANGLE_BONUS_PER_STAT;
  const NEW_TRIANGLE_MAX = COMBAT_TRIANGLE_MAX_BONUS;

  console.log("\n" + "=".repeat(120));
  console.log("  OLD vs NEW MECHANICS COMPARISON");
  console.log("  Old: AGI vs AGI hit for all physical, no block, no charges, 4%/40% triangle");
  console.log("  New: STR vs AGI hit for STR weapons, block, charges, 2%/20% triangle");
  console.log("=".repeat(120));

  // Simulate with OLD mechanics by computing manually
  const neutral: Stats = { str: 12, agi: 12, int: 12, armor: 2, hp: 40 };

  console.log(
    "\n" +
      pad("Archetype", 22) +
      rpad("Old DPT", 9) +
      rpad("New DPT", 9) +
      rpad("Change", 9) +
      rpad("Old TTK", 8) +
      rpad("New TTK", 8) +
      "  Notes"
  );
  console.log("-".repeat(120));

  for (let i = 0; i < archetypes.length; i++) {
    const a = archetypes[i];
    const s = allStats[i];

    // NEW mechanics (current)
    const newR = simulateMatchup(
      { stats: s, weapon: a.weapon, advClass: a.advClass },
      neutral
    );

    // OLD mechanics — simulate with old hit formula (AGI vs AGI for all physical)
    // and no block, no charges, old triangle
    const oldR = simulateOld(
      { stats: s, weapon: a.weapon, advClass: a.advClass },
      neutral
    );

    const dptChange = oldR.effectiveDPT > 0
      ? (((newR.chargeAwareDPT - oldR.effectiveDPT) / oldR.effectiveDPT) * 100).toFixed(0)
      : "N/A";
    const sign = Number(dptChange) > 0 ? "+" : "";

    const notes: string[] = [];
    if (a.weapon.scaling === "str" && newR.hitPct !== oldR.hitPct) {
      notes.push(`hit: ${oldR.hitPct}→${newR.hitPct}%`);
    }
    if (newR.blockPct > 0) notes.push(`blk: ${newR.blockPct}%`);
    if (newR.magicCharges > 0 && newR.chargeAwareTTK > newR.magicCharges) {
      notes.push(`charges: ${newR.magicCharges}, fallback`);
    }

    console.log(
      pad(`${a.id} ${a.name}`, 22) +
        rpad(oldR.effectiveDPT.toFixed(1), 9) +
        rpad(newR.chargeAwareDPT.toFixed(1), 9) +
        rpad(sign + dptChange + "%", 9) +
        rpad(oldR.turnsToKill, 8) +
        rpad(newR.chargeAwareTTK, 8) +
        "  " +
        notes.join(", ")
    );
  }

  // PvP win rate comparison
  console.log("\n--- PVP WIN RATE: OLD vs NEW ---\n");

  // Old PvP
  const oldWins: number[] = new Array(archetypes.length).fill(0);
  const newWins: number[] = new Array(archetypes.length).fill(0);

  for (let i = 0; i < archetypes.length; i++) {
    for (let j = 0; j < archetypes.length; j++) {
      if (i === j) continue;

      // Old
      const oldI = simulateOld(
        { stats: allStats[i], weapon: archetypes[i].weapon, advClass: archetypes[i].advClass },
        allStats[j]
      );
      const oldJ = simulateOld(
        { stats: allStats[j], weapon: archetypes[j].weapon, advClass: archetypes[j].advClass },
        allStats[i]
      );
      if (oldI.turnsToKill < oldJ.turnsToKill) oldWins[i]++;

      // New
      const newI = simulateMatchup(
        { stats: allStats[i], weapon: archetypes[i].weapon, advClass: archetypes[i].advClass },
        allStats[j]
      );
      const newJ = simulateMatchup(
        { stats: allStats[j], weapon: archetypes[j].weapon, advClass: archetypes[j].advClass },
        allStats[i]
      );
      if (newI.chargeAwareTTK < newJ.chargeAwareTTK) newWins[i]++;
    }
  }

  const total = archetypes.length - 1;
  console.log(
    pad("Archetype", 22) +
      rpad("Old W", 7) +
      rpad("New W", 7) +
      rpad("Old%", 7) +
      rpad("New%", 7) +
      rpad("Delta", 8) +
      "  Path"
  );
  console.log("-".repeat(80));

  const ranked = archetypes
    .map((a, i) => ({
      arch: a,
      oldW: oldWins[i],
      newW: newWins[i],
      oldPct: (oldWins[i] / total) * 100,
      newPct: (newWins[i] / total) * 100,
    }))
    .sort((a, b) => b.newPct - a.newPct);

  for (const r of ranked) {
    const delta = (r.newPct - r.oldPct).toFixed(0);
    const sign = Number(delta) > 0 ? "+" : "";
    console.log(
      pad(`${r.arch.id} ${r.arch.name}`, 22) +
        rpad(r.oldW, 7) +
        rpad(r.newW, 7) +
        rpad(r.oldPct.toFixed(0) + "%", 7) +
        rpad(r.newPct.toFixed(0) + "%", 7) +
        rpad(sign + delta + "%", 8) +
        "  " +
        r.arch.statPath.toUpperCase()
    );
  }

  // Path-level summary
  console.log("\n--- PATH WIN RATE SUMMARY ---\n");
  for (const path of ["str", "agi", "int"] as const) {
    const pathBuilds = ranked.filter((r) => r.arch.statPath === path);
    const avgOld = pathBuilds.reduce((s, r) => s + r.oldPct, 0) / pathBuilds.length;
    const avgNew = pathBuilds.reduce((s, r) => s + r.newPct, 0) / pathBuilds.length;
    const delta = (avgNew - avgOld).toFixed(0);
    const sign = Number(delta) > 0 ? "+" : "";
    console.log(
      `  ${path.toUpperCase()}: ${avgOld.toFixed(0)}% → ${avgNew.toFixed(0)}% (${sign}${delta}%)`
    );
  }
}

/**
 * Simulates with OLD mechanics for comparison:
 * - All physical uses AGI vs AGI for hit
 * - No block
 * - No charges (magic always available)
 * - Old triangle: 4%/pt, 40% cap
 */
function simulateOld(
  attacker: { stats: Stats; weapon: Weapon; advClass: AdvancedClass },
  defender: Stats
): CombatResult {
  const isMagic = attacker.weapon.scaling === "magic";
  const isAgi = attacker.weapon.scaling === "agi";
  const w = attacker.weapon;
  const ac = attacker.advClass;
  const a = attacker.stats;
  const d = defender;

  // OLD: All physical uses AGI vs AGI
  let hitPct: number;
  if (isMagic) {
    hitPct = calcHitProb(a.int, d.int);
  } else {
    hitPct = calcHitProb(a.agi, d.agi); // OLD: AGI vs AGI for ALL physical
  }

  const critPct = calcCritChance(a.agi);

  let normalDmg: number;
  let critDmg: number;
  const avgWeaponDmg = (w.minDmg + w.maxDmg) / 2;

  if (isMagic) {
    const normalBase = Math.floor(avgWeaponDmg * ATTACK_MODIFIER);
    normalDmg = addStatBonus(a.int, d.int, normalBase, ATTACK_MODIFIER);
    if (normalDmg < 1) normalDmg = 1;
    const critBase = Math.floor(w.maxDmg * ATTACK_MODIFIER);
    critDmg = addStatBonus(a.int, d.int, critBase, ATTACK_MODIFIER);
    if (critDmg < 1) critDmg = 1;
    critDmg *= CRIT_MULTIPLIER;
    normalDmg -= calcMagicResist(d.int, normalDmg);
    if (normalDmg < 1) normalDmg = 1;
    critDmg -= calcMagicResist(d.int, critDmg);
    if (critDmg < 1) critDmg = 1;
    if (ac.spellMult !== CLASS_MULTIPLIER_BASE) {
      normalDmg = Math.floor((normalDmg * ac.spellMult) / CLASS_MULTIPLIER_BASE);
      critDmg = Math.floor((critDmg * ac.spellMult) / CLASS_MULTIPLIER_BASE);
    }
    if (ac.critMult > CLASS_MULTIPLIER_BASE) {
      critDmg = Math.floor((critDmg * ac.critMult) / CLASS_MULTIPLIER_BASE);
    }
  } else {
    const primaryAtk = isAgi ? a.agi : a.str;
    const primaryDef = isAgi ? d.agi : d.str;
    const scalingMod = isAgi ? AGI_ATTACK_MODIFIER : ATTACK_MODIFIER;
    const normalBase = Math.floor(avgWeaponDmg * scalingMod);
    normalDmg = addStatBonus(primaryAtk, primaryDef, normalBase, scalingMod);
    if (normalDmg < 1) normalDmg = 1;
    const critBase = Math.floor(w.maxDmg * scalingMod);
    critDmg = addStatBonus(primaryAtk, primaryDef, critBase, scalingMod);
    if (critDmg < 1) critDmg = 1;
    normalDmg -= calcArmorReduction(d.armor, normalDmg);
    if (normalDmg < 0) normalDmg = 0;
    critDmg -= calcArmorReduction(d.armor, critDmg);
    if (critDmg < 0) critDmg = 0;
    critDmg *= CRIT_MULTIPLIER;
    if (ac.physMult !== CLASS_MULTIPLIER_BASE) {
      normalDmg = Math.floor((normalDmg * ac.physMult) / CLASS_MULTIPLIER_BASE);
      critDmg = Math.floor((critDmg * ac.physMult) / CLASS_MULTIPLIER_BASE);
    }
    if (ac.critMult > CLASS_MULTIPLIER_BASE) {
      critDmg = Math.floor((critDmg * ac.critMult) / CLASS_MULTIPLIER_BASE);
    }
  }

  // OLD triangle: 4%/pt, 40% cap
  const OLD_TRIANGLE_PER_STAT = WAD / 25;
  const OLD_TRIANGLE_MAX = (WAD * 40) / 100;

  const aDom = getDominant(a);
  const dDom = getDominant(d);
  const hasAdvantage =
    (aDom.type === 0 && dDom.type === 1) ||
    (aDom.type === 1 && dDom.type === 2) ||
    (aDom.type === 2 && dDom.type === 0);

  let triangleMult = 1.0;
  if (hasAdvantage) {
    const diff = Math.max(0, aDom.value - dDom.value);
    let bonus = diff * (OLD_TRIANGLE_PER_STAT / WAD);
    if (bonus > OLD_TRIANGLE_MAX / WAD) bonus = OLD_TRIANGLE_MAX / WAD;
    triangleMult = 1.0 + bonus;
  }

  normalDmg = Math.floor(normalDmg * triangleMult);
  critDmg = Math.floor(critDmg * triangleMult);

  const critFrac = critPct / 100;
  const avgDmgPerHit = normalDmg * (1 - critFrac) + critDmg * critFrac;

  // OLD: No block
  let evasionPct = 0;
  if (!isMagic) {
    evasionPct = calcEvasionChance(d.agi, a.agi);
  }

  let doubleStrikePct = 0;
  if (isAgi) {
    doubleStrikePct = calcDoubleStrikeChance(a.agi, d.agi);
  }

  const hitFrac = hitPct / 100;
  const evadeFrac = evasionPct / 100;
  const dsFrac = doubleStrikePct / 100;
  const effectiveDPT =
    avgDmgPerHit * hitFrac * (1 - evadeFrac) * (1 + dsFrac * 0.5);

  const turnsToKill =
    effectiveDPT > 0 ? Math.ceil(d.hp / effectiveDPT) : 999;

  return {
    hitPct,
    avgDmgPerHit: Math.round(avgDmgPerHit * 100) / 100,
    critPct,
    evasionPct,
    doubleStrikePct,
    blockPct: 0, // OLD: no block
    effectiveDPT: Math.round(effectiveDPT * 100) / 100,
    turnsToKill,
    isMagic,
  };
}

// ============================================================
// MAIN
// ============================================================

function main() {
  const args = process.argv.slice(2);
  const runAll = args.length === 0;
  const flags = new Set(args.map((a) => a.toLowerCase()));

  const archetypes = buildArchetypes();

  if (runAll || flags.has("--stats")) {
    reportStats(archetypes);
  }

  if (runAll || flags.has("--pve")) {
    reportPvE(archetypes);
    reportPvEDetailed(archetypes);
  }

  if (runAll || flags.has("--pvp")) {
    reportPvP(archetypes);
  }

  if (runAll || flags.has("--analysis")) {
    reportAnalysis(archetypes);
  }

  if (flags.has("--compare")) {
    reportCompare(archetypes);
  }

  console.log("\n");
}

main();
