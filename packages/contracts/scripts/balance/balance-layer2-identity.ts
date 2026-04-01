#!/usr/bin/env npx tsx
/**
 * Ultimate Dominion — Balance Layer 2: Character Identity
 * ========================================================
 * SOURCE OF TRUTH for character identity balance.
 * This model (along with L1) defines what the contracts, items, and game
 * systems should become. Code follows the model, not the other way around.
 *
 * LAYER STACK:
 *   L1 — Combat math (base formulas, triangle 2%/pt 20% cap, AGI subsystems)  [DONE]
 *   L2 — Character identity (this file)                                        [DONE]
 *   L3 — Weapons (damage ranges, scaling, how multipliers activate)            [NEXT]
 *   L4 — Armor (damage reduction, scaling with level)
 *   L5 — Consumables & class spells
 *   L6 — Racial skills & power source abilities
 *
 * Each layer's output constrains the next. Don't skip layers.
 *
 * WHAT THIS MODELS:
 *   Pure character foundation — race, starting armor, power source, class,
 *   and stat allocation from L1–L100 with NO gear equipped.
 *   All 27 archetypes (9 classes × 3 stat paths).
 *
 * KEY FINDINGS:
 *   - Pre-class (L1-L9): all archetypes on the same stat path are identical.
 *     Cross-path budget gap is only 2 points (6.3%).
 *   - Class bonuses at L10 introduce a fixed 6-point budget gap (5-9% of total).
 *     This gap stays constant and compresses % as leveling stats grow.
 *   - Flat bonus budgets range from 3 (Ranger/Rogue/Wizard) to 7 (Paladin).
 *     Lower-budget classes have stronger multipliers — but multipliers are
 *     dormant until gear arrives in L3. This is by design.
 *   - Race impact: ~2% at L100. Cosmetic with minor nudge. Correct.
 *   - Power source: converges to zero difference at L100. Currently only a
 *     one-time L5 bonus. PS abilities (L6) will add long-term differentiation.
 *   - Off-path builds: 94-100% viable. No choice is a trap.
 *   - Classes don't need to be perfectly balanced — new zones shift the meta.
 *
 * WHAT THIS DOESN'T MODEL (handled by other layers):
 *   - Combat triangle (L1: 2%/pt, 20% cap — contract still has old 4%/40%, needs deploy)
 *   - AGI subsystems: evasion, double strike, crit bonus (L1)
 *   - Magic resistance: INT×2%, 40% cap (L1)
 *   - Weapons, armor, consumables, spells, racial abilities (L3-L6)
 *
 * Usage: npx tsx packages/contracts/scripts/balance-layer2-identity.ts [flags]
 *   --stats     Stat profiles at milestone levels
 *   --budget    Power budget analysis (stat + HP totals)
 *   --scaling   How class advantages grow/shrink over levels
 *   --race      Race impact isolation
 *   --ps        Power source impact isolation
 *   --class     Class contribution isolation
 *   --alloc     Stat allocation strategy comparison (focused vs balanced vs hybrid)
 *   No flags = run everything
 */

// ============================================================
// CONSTANTS (from constants.sol)
// ============================================================

const BASE_HP = 18;
const EARLY_GAME_CAP = 10;
const MID_GAME_CAP = 50;
const MAX_LEVEL = 100;

const STAT_POINTS_EARLY = 2; // per level, L1-10
const STAT_POINTS_MID = 1;   // every 2 levels, L11-50
const STAT_POINTS_LATE = 1;  // every 5 levels, L51-100

const HP_GAIN_EARLY = 2;     // per level, L1-10
const HP_GAIN_MID = 1;       // per level, L11-50
const HP_GAIN_LATE = 1;      // every 2 levels, L51-100

const POWER_SOURCE_BONUS_LEVEL = 5;
const CLASS_MULTIPLIER_BASE = 1000;

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
  flatStr: number;
  flatAgi: number;
  flatInt: number;
  flatHp: number;
  physMult: number;
  spellMult: number;
  healMult: number;
  critMult: number;
  hpMult: number;
}

interface StatProfile {
  str: number;
  agi: number;
  int: number;
  hp: number;
  totalStats: number;     // STR + AGI + INT
  primaryStat: number;    // highest stat
  dominantType: string;   // "STR" | "AGI" | "INT"
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

// ============================================================
// DATA
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

// Representative base rolls for each stat path (total = 19)
const BASE_ROLLS = {
  str: { str: 8, agi: 5, int: 6 },
  agi: { str: 5, agi: 8, int: 6 },
  int: { str: 5, agi: 6, int: 8 },
};

// ============================================================
// LEVELING MATH (from StatCalculator.sol)
// ============================================================

function statPointsForLevel(level: number): number {
  if (level <= EARLY_GAME_CAP) return STAT_POINTS_EARLY;
  if (level <= MID_GAME_CAP) return STAT_POINTS_MID;
  return STAT_POINTS_LATE;
}

function hpForLevel(level: number): number {
  if (level <= EARLY_GAME_CAP) return HP_GAIN_EARLY;
  if (level <= MID_GAME_CAP) return HP_GAIN_MID;
  return (level % 2 === 0) ? HP_GAIN_LATE : 0;
}

function totalStatPointsAtLevel(level: number): number {
  let total = 0;
  for (let l = 1; l <= level; l++) {
    total += statPointsForLevel(l);
  }
  return total;
}

function totalHpFromLeveling(level: number): number {
  let total = 0;
  for (let l = 1; l <= level; l++) {
    total += hpForLevel(l);
  }
  return total;
}

// ============================================================
// STAT ALLOCATION STRATEGIES
// ============================================================

type AllocStrategy = "focused" | "balanced" | "hybrid";

/**
 * Distribute stat points according to strategy.
 * - focused: all into primary stat
 * - balanced: split evenly (round-robin)
 * - hybrid: 60% primary, 20% each off-stat
 */
function allocatePoints(
  totalPoints: number,
  path: "str" | "agi" | "int",
  strategy: AllocStrategy,
  extraPsPoint: boolean = false
): { str: number; agi: number; int: number } {
  const points = totalPoints + (extraPsPoint ? 1 : 0);

  if (strategy === "focused") {
    const alloc = { str: 0, agi: 0, int: 0 };
    alloc[path] = points;
    return alloc;
  }

  if (strategy === "balanced") {
    const base = Math.floor(points / 3);
    const remainder = points % 3;
    const alloc = { str: base, agi: base, int: base };
    // Distribute remainder to primary first, then others
    const order: ("str" | "agi" | "int")[] =
      path === "str" ? ["str", "agi", "int"] :
      path === "agi" ? ["agi", "str", "int"] :
      ["int", "str", "agi"];
    for (let i = 0; i < remainder; i++) {
      alloc[order[i]]++;
    }
    return alloc;
  }

  // hybrid: 60/20/20
  const primary = Math.round(points * 0.6);
  const remaining = points - primary;
  const secondary = Math.floor(remaining / 2);
  const tertiary = remaining - secondary;

  if (path === "str") return { str: primary, agi: secondary, int: tertiary };
  if (path === "agi") return { str: secondary, agi: primary, int: tertiary };
  return { str: secondary, agi: tertiary, int: primary };
}

// ============================================================
// BUILD STAT PROFILES
// ============================================================

function buildProfile(
  arch: Archetype,
  level: number,
  strategy: AllocStrategy = "focused"
): StatProfile {
  // 1. Base roll
  let str = arch.baseRoll.str;
  let agi = arch.baseRoll.agi;
  let int_ = arch.baseRoll.int;
  let hp = BASE_HP;

  // 2. Race mods (applied at creation)
  str += arch.race.str;
  agi += arch.race.agi;
  int_ += arch.race.int;
  hp += arch.race.hp;

  // 3. Starting armor mods (applied at creation)
  str += arch.startingArmor.str;
  agi += arch.startingArmor.agi;
  int_ += arch.startingArmor.int;
  hp += arch.startingArmor.hp;

  // 4. Leveling stat allocation
  const totalStatPts = totalStatPointsAtLevel(level);
  const isPsPhysical = arch.powerSource.type === "physical";
  const psExtraPoint = isPsPhysical && level >= POWER_SOURCE_BONUS_LEVEL;
  const alloc = allocatePoints(totalStatPts, arch.statPath, strategy, psExtraPoint);
  str += alloc.str;
  agi += alloc.agi;
  int_ += alloc.int;

  // 5. HP from leveling
  hp += totalHpFromLeveling(level);

  // 6. Power source bonus at L5
  if (level >= POWER_SOURCE_BONUS_LEVEL) {
    if (arch.powerSource.type === "weave") {
      int_ += 1;
    } else if (arch.powerSource.type === "divine") {
      hp += 2;
    }
    // Physical's +1 is handled via allocatePoints extraPsPoint
  }

  // 7. Class flat bonuses at L10
  if (level >= 10) {
    str += arch.advClass.flatStr;
    agi += arch.advClass.flatAgi;
    int_ += arch.advClass.flatInt;
    hp += arch.advClass.flatHp;
  }

  // 8. Class HP multiplier (only after class selection at L10)
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
// ARCHETYPE DEFINITIONS (27 = 9 classes × 3 paths)
// ============================================================

function defineArchetype(
  id: string, name: string, className: string,
  advClass: AdvancedClass, race: Race, sa: StartingArmor,
  ps: PowerSource, path: "str" | "agi" | "int"
): Archetype {
  return { id, name, className, advClass, race, startingArmor: sa,
           powerSource: ps, statPath: path, baseRoll: BASE_ROLLS[path] };
}

function buildArchetypes(): Archetype[] {
  const R = RACES, SA = STARTING_ARMORS, PS = POWER_SOURCES, C = CLASSES;
  return [
    defineArchetype("WAR-S", "Tank",        "Warrior",  C.warrior,  R.dwarf, SA.plate,   PS.physical, "str"),
    defineArchetype("WAR-A", "Fury",        "Warrior",  C.warrior,  R.elf,   SA.leather, PS.physical, "agi"),
    defineArchetype("WAR-I", "Battlemage",  "Warrior",  C.warrior,  R.elf,   SA.cloth,   PS.weave,    "int"),

    defineArchetype("PAL-S", "Crusader",    "Paladin",  C.paladin,  R.dwarf, SA.plate,   PS.physical, "str"),
    defineArchetype("PAL-A", "Avenger",     "Paladin",  C.paladin,  R.elf,   SA.leather, PS.physical, "agi"),
    defineArchetype("PAL-I", "Templar",     "Paladin",  C.paladin,  R.elf,   SA.cloth,   PS.weave,    "int"),

    defineArchetype("RAN-S", "Beastmaster", "Ranger",   C.ranger,   R.dwarf, SA.plate,   PS.physical, "str"),
    defineArchetype("RAN-A", "Sharpshooter","Ranger",   C.ranger,   R.elf,   SA.leather, PS.physical, "agi"),
    defineArchetype("RAN-I", "ArcaneArcher","Ranger",   C.ranger,   R.elf,   SA.cloth,   PS.weave,    "int"),

    defineArchetype("ROG-S", "Thug",        "Rogue",    C.rogue,    R.dwarf, SA.plate,   PS.physical, "str"),
    defineArchetype("ROG-A", "Assassin",    "Rogue",    C.rogue,    R.elf,   SA.leather, PS.physical, "agi"),
    defineArchetype("ROG-I", "Trickster",   "Rogue",    C.rogue,    R.elf,   SA.cloth,   PS.weave,    "int"),

    defineArchetype("DRU-S", "Bear",        "Druid",    C.druid,    R.dwarf, SA.plate,   PS.physical, "str"),
    defineArchetype("DRU-A", "Cat",         "Druid",    C.druid,    R.elf,   SA.leather, PS.physical, "agi"),
    defineArchetype("DRU-I", "Caster",      "Druid",    C.druid,    R.elf,   SA.cloth,   PS.weave,    "int"),

    defineArchetype("WLK-S", "Hexblade",    "Warlock",  C.warlock,  R.dwarf, SA.plate,   PS.physical, "str"),
    defineArchetype("WLK-A", "Shadow",      "Warlock",  C.warlock,  R.elf,   SA.leather, PS.physical, "agi"),
    defineArchetype("WLK-I", "VoidMage",    "Warlock",  C.warlock,  R.elf,   SA.cloth,   PS.weave,    "int"),

    defineArchetype("WIZ-S", "WarMage",     "Wizard",   C.wizard,   R.dwarf, SA.plate,   PS.physical, "str"),
    defineArchetype("WIZ-A", "Spellblade",  "Wizard",   C.wizard,   R.elf,   SA.leather, PS.physical, "agi"),
    defineArchetype("WIZ-I", "Archmage",    "Wizard",   C.wizard,   R.elf,   SA.cloth,   PS.weave,    "int"),

    defineArchetype("CLR-S", "BattlePriest","Cleric",   C.cleric,   R.dwarf, SA.plate,   PS.physical, "str"),
    defineArchetype("CLR-A", "WindCleric",  "Cleric",   C.cleric,   R.elf,   SA.leather, PS.physical, "agi"),
    defineArchetype("CLR-I", "HighPriest",  "Cleric",   C.cleric,   R.elf,   SA.cloth,   PS.weave,    "int"),

    defineArchetype("SOR-S", "Spellsword",  "Sorcerer", C.sorcerer, R.dwarf, SA.plate,   PS.physical, "str"),
    defineArchetype("SOR-A", "StormMage",   "Sorcerer", C.sorcerer, R.elf,   SA.leather, PS.physical, "agi"),
    defineArchetype("SOR-I", "Elementalist","Sorcerer", C.sorcerer, R.elf,   SA.cloth,   PS.weave,    "int"),
  ];
}

// ============================================================
// OUTPUT HELPERS
// ============================================================

function pad(s: string | number, len: number): string { return String(s).padEnd(len); }
function rpad(s: string | number, len: number): string { return String(s).padStart(len); }

const MILESTONES = [1, 5, 10, 25, 50, 100];

// ============================================================
// REPORT: Stat Profiles at Milestones
// ============================================================

function reportStats(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(130));
  console.log("  STAT PROFILES AT MILESTONE LEVELS (focused allocation, no gear)");
  console.log("=".repeat(130));

  for (const level of MILESTONES) {
    const statPts = totalStatPointsAtLevel(level);
    const hpFromLvl = totalHpFromLeveling(level);
    console.log(`\n--- Level ${level} (${statPts} stat pts from leveling, +${hpFromLvl} HP from leveling) ---`);
    console.log(
      pad("ID", 7) + pad("Name", 14) + pad("Class", 10) + pad("Path", 5) +
      rpad("STR", 5) + rpad("AGI", 5) + rpad("INT", 5) + rpad("HP", 5) +
      rpad("Total", 7) + rpad("Primary", 8) + "  Dom"
    );
    console.log("-".repeat(85));

    for (const arch of archetypes) {
      const p = buildProfile(arch, level);
      console.log(
        pad(arch.id, 7) + pad(arch.name, 14) + pad(arch.className, 10) + pad(arch.statPath.toUpperCase(), 5) +
        rpad(p.str, 5) + rpad(p.agi, 5) + rpad(p.int, 5) + rpad(p.hp, 5) +
        rpad(p.totalStats, 7) + rpad(p.primaryStat, 8) + "  " + p.dominantType
      );
    }
  }
}

// ============================================================
// REPORT: Power Budget Analysis
// ============================================================

function reportBudget(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(120));
  console.log("  POWER BUDGET ANALYSIS");
  console.log("  Total resources each archetype has at key levels.");
  console.log("  Budget = total stats + HP/3 (normalizes HP to stat-equivalent units)");
  console.log("=".repeat(120));

  console.log(
    "\n" + pad("ID", 7) + pad("Name", 14) + pad("Class", 10) + pad("Path", 5) +
    MILESTONES.map(l => rpad(`L${l}`, 8)).join("") +
    rpad("L100/L1", 8)
  );
  console.log("-".repeat(7 + 14 + 10 + 5 + MILESTONES.length * 8 + 8));

  for (const arch of archetypes) {
    const budgets = MILESTONES.map(l => {
      const p = buildProfile(arch, l);
      return p.totalStats + Math.floor(p.hp / 3);
    });
    const growth = budgets[budgets.length - 1] / budgets[0];

    let row = pad(arch.id, 7) + pad(arch.name, 14) + pad(arch.className, 10) + pad(arch.statPath.toUpperCase(), 5);
    for (const b of budgets) row += rpad(b, 8);
    row += rpad(growth.toFixed(1) + "x", 8);
    console.log(row);
  }

  // Budget spread analysis
  console.log("\n--- Budget Spread at Each Level ---");
  for (const level of MILESTONES) {
    const budgets = archetypes.map(a => {
      const p = buildProfile(a, level);
      return { arch: a, budget: p.totalStats + Math.floor(p.hp / 3) };
    });
    const max = Math.max(...budgets.map(b => b.budget));
    const min = Math.min(...budgets.map(b => b.budget));
    const maxArch = budgets.find(b => b.budget === max)!;
    const minArch = budgets.find(b => b.budget === min)!;
    const spread = ((max - min) / max * 100).toFixed(1);
    console.log(
      `  L${rpad(level, 3)}: max=${max} (${maxArch.arch.id}) min=${min} (${minArch.arch.id}) ` +
      `spread=${spread}% diff=${max - min}`
    );
  }
}

// ============================================================
// REPORT: Class Contribution Isolation
// ============================================================

function reportClassIsolation(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(100));
  console.log("  CLASS CONTRIBUTION ISOLATION");
  console.log("  What each class adds on top of a neutral baseline (same race/armor/PS/path)");
  console.log("=".repeat(100));

  // Compare on-path builds: all use the same race/armor/PS for their path
  // Show what the class uniquely contributes
  console.log("\n--- Flat Stat Budgets (applied at L10) ---");
  console.log(
    pad("Class", 12) + rpad("STR", 5) + rpad("AGI", 5) + rpad("INT", 5) + rpad("HP", 5) +
    rpad("Stats", 7) + rpad("HP-eq", 7) + rpad("Total", 7) + "  Multiplier Edge"
  );
  console.log("-".repeat(90));

  const classNames = Object.keys(CLASSES);
  for (const cn of classNames) {
    const c = CLASSES[cn];
    const flatStats = c.flatStr + c.flatAgi + c.flatInt;
    const hpEq = Math.floor(c.flatHp / 3); // normalize HP to stat-equivalent
    const total = flatStats + hpEq;

    const mults: string[] = [];
    if (c.physMult > 1000) mults.push(`phys +${c.physMult - 1000}bp`);
    if (c.spellMult > 1000) mults.push(`spell +${c.spellMult - 1000}bp`);
    if (c.healMult > 1000) mults.push(`heal +${c.healMult - 1000}bp`);
    if (c.critMult > 1000) mults.push(`crit +${c.critMult - 1000}bp`);
    if (c.hpMult > 1000) mults.push(`hp +${c.hpMult - 1000}bp`);

    console.log(
      pad(c.name, 12) + rpad(c.flatStr || "-", 5) + rpad(c.flatAgi || "-", 5) +
      rpad(c.flatInt || "-", 5) + rpad(c.flatHp || "-", 5) +
      rpad(flatStats, 7) + rpad(hpEq, 7) + rpad(total, 7) +
      "  " + (mults.length ? mults.join(", ") : "none")
    );
  }

  // Show how class choice affects same-path builds
  console.log("\n--- Same-Path Class Comparison (STR path, focused, L10 and L100) ---");
  const strArchetypes = archetypes.filter(a => a.statPath === "str");
  console.log(
    pad("Class", 14) + pad("ID", 8) +
    rpad("L10 STR", 8) + rpad("L10 HP", 7) + rpad("L10 Bud", 8) +
    rpad("L100 STR", 9) + rpad("L100 HP", 8) + rpad("L100 Bud", 9)
  );
  console.log("-".repeat(80));

  for (const a of strArchetypes) {
    const p10 = buildProfile(a, 10);
    const p100 = buildProfile(a, 100);
    const b10 = p10.totalStats + Math.floor(p10.hp / 3);
    const b100 = p100.totalStats + Math.floor(p100.hp / 3);
    console.log(
      pad(a.name, 14) + pad(a.id, 8) +
      rpad(p10.str, 8) + rpad(p10.hp, 7) + rpad(b10, 8) +
      rpad(p100.str, 9) + rpad(p100.hp, 8) + rpad(b100, 9)
    );
  }

  console.log("\n--- Same-Path Class Comparison (AGI path, focused, L10 and L100) ---");
  const agiArchetypes = archetypes.filter(a => a.statPath === "agi");
  console.log(
    pad("Class", 14) + pad("ID", 8) +
    rpad("L10 AGI", 8) + rpad("L10 HP", 7) + rpad("L10 Bud", 8) +
    rpad("L100 AGI", 9) + rpad("L100 HP", 8) + rpad("L100 Bud", 9)
  );
  console.log("-".repeat(80));

  for (const a of agiArchetypes) {
    const p10 = buildProfile(a, 10);
    const p100 = buildProfile(a, 100);
    const b10 = p10.totalStats + Math.floor(p10.hp / 3);
    const b100 = p100.totalStats + Math.floor(p100.hp / 3);
    console.log(
      pad(a.name, 14) + pad(a.id, 8) +
      rpad(p10.agi, 8) + rpad(p10.hp, 7) + rpad(b10, 8) +
      rpad(p100.agi, 9) + rpad(p100.hp, 8) + rpad(b100, 9)
    );
  }

  console.log("\n--- Same-Path Class Comparison (INT path, focused, L10 and L100) ---");
  const intArchetypes = archetypes.filter(a => a.statPath === "int");
  console.log(
    pad("Class", 14) + pad("ID", 8) +
    rpad("L10 INT", 8) + rpad("L10 HP", 7) + rpad("L10 Bud", 8) +
    rpad("L100 INT", 9) + rpad("L100 HP", 8) + rpad("L100 Bud", 9)
  );
  console.log("-".repeat(80));

  for (const a of intArchetypes) {
    const p10 = buildProfile(a, 10);
    const p100 = buildProfile(a, 100);
    const b10 = p10.totalStats + Math.floor(p10.hp / 3);
    const b100 = p100.totalStats + Math.floor(p100.hp / 3);
    console.log(
      pad(a.name, 14) + pad(a.id, 8) +
      rpad(p10.int, 8) + rpad(p10.hp, 7) + rpad(b10, 8) +
      rpad(p100.int, 9) + rpad(p100.hp, 8) + rpad(b100, 9)
    );
  }
}

// ============================================================
// REPORT: Scaling Analysis
// ============================================================

function reportScaling(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(120));
  console.log("  SCALING ANALYSIS: How class advantages change over levels");
  console.log("  Shows primary stat and budget at every 10 levels for on-path builds");
  console.log("=".repeat(120));

  const levels = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  // On-path builds only (where class matches natural path)
  const onPathBuilds = [
    { id: "WAR-S", label: "Warrior (STR)" },
    { id: "PAL-S", label: "Paladin (STR)" },
    { id: "RAN-A", label: "Ranger (AGI)" },
    { id: "ROG-A", label: "Rogue (AGI)" },
    { id: "DRU-A", label: "Druid (AGI)" },
    { id: "WLK-I", label: "Warlock (INT)" },
    { id: "WIZ-I", label: "Wizard (INT)" },
    { id: "CLR-I", label: "Cleric (INT)" },
    { id: "SOR-I", label: "Sorcerer (INT)" },
  ];

  // Primary stat scaling
  console.log("\n--- Primary Stat at Each Level (on-path, focused) ---");
  let header = pad("Build", 20);
  for (const l of levels) header += rpad(`L${l}`, 6);
  console.log(header);
  console.log("-".repeat(20 + levels.length * 6));

  for (const build of onPathBuilds) {
    const arch = archetypes.find(a => a.id === build.id)!;
    let row = pad(build.label, 20);
    for (const l of levels) {
      const p = buildProfile(arch, l);
      row += rpad(p.primaryStat, 6);
    }
    console.log(row);
  }

  // HP scaling
  console.log("\n--- HP at Each Level (on-path, focused) ---");
  header = pad("Build", 20);
  for (const l of levels) header += rpad(`L${l}`, 6);
  console.log(header);
  console.log("-".repeat(20 + levels.length * 6));

  for (const build of onPathBuilds) {
    const arch = archetypes.find(a => a.id === build.id)!;
    let row = pad(build.label, 20);
    for (const l of levels) {
      const p = buildProfile(arch, l);
      row += rpad(p.hp, 6);
    }
    console.log(row);
  }

  // Budget scaling
  console.log("\n--- Power Budget at Each Level (on-path, focused) ---");
  header = pad("Build", 20);
  for (const l of levels) header += rpad(`L${l}`, 6);
  console.log(header);
  console.log("-".repeat(20 + levels.length * 6));

  for (const build of onPathBuilds) {
    const arch = archetypes.find(a => a.id === build.id)!;
    let row = pad(build.label, 20);
    for (const l of levels) {
      const p = buildProfile(arch, l);
      row += rpad(p.totalStats + Math.floor(p.hp / 3), 6);
    }
    console.log(row);
  }

  // Gap analysis: max budget minus min budget at each level
  console.log("\n--- Budget Gap Over Time (all 27 archetypes) ---");
  header = pad("Metric", 20);
  for (const l of levels) header += rpad(`L${l}`, 6);
  console.log(header);
  console.log("-".repeat(20 + levels.length * 6));

  let maxRow = pad("Max budget", 20);
  let minRow = pad("Min budget", 20);
  let gapRow = pad("Gap (abs)", 20);
  let pctRow = pad("Gap (%)", 20);
  let maxIdRow = pad("Max build", 20);
  let minIdRow = pad("Min build", 20);

  for (const l of levels) {
    const budgets = archetypes.map(a => {
      const p = buildProfile(a, l);
      return { id: a.id, budget: p.totalStats + Math.floor(p.hp / 3) };
    });
    const max = budgets.reduce((a, b) => a.budget > b.budget ? a : b);
    const min = budgets.reduce((a, b) => a.budget < b.budget ? a : b);
    const gap = max.budget - min.budget;
    const pct = (gap / max.budget * 100).toFixed(0);
    maxRow += rpad(max.budget, 6);
    minRow += rpad(min.budget, 6);
    gapRow += rpad(gap, 6);
    pctRow += rpad(pct + "%", 6);
    maxIdRow += rpad(max.id, 6);
    minIdRow += rpad(min.id, 6);
  }
  console.log(maxRow);
  console.log(minRow);
  console.log(gapRow);
  console.log(pctRow);
  console.log(maxIdRow);
  console.log(minIdRow);
}

// ============================================================
// REPORT: Race Impact Isolation
// ============================================================

function reportRaceImpact() {
  console.log("\n" + "=".repeat(100));
  console.log("  RACE IMPACT ISOLATION");
  console.log("  Same class (Warrior), same path (STR), same armor (Plate), same PS (Physical)");
  console.log("  Only variable: race");
  console.log("=".repeat(100));

  const races = [RACES.dwarf, RACES.human, RACES.elf];

  for (const level of [10, 50, 100]) {
    console.log(`\n--- Level ${level} ---`);
    console.log(
      pad("Race", 8) + rpad("STR", 5) + rpad("AGI", 5) + rpad("INT", 5) +
      rpad("HP", 5) + rpad("Total", 7) + rpad("Budget", 8) + rpad("vs Best", 9)
    );
    console.log("-".repeat(60));

    const results: { race: Race; budget: number; profile: StatProfile }[] = [];
    for (const race of races) {
      const arch: Archetype = {
        id: "TEST", name: "Test", className: "Warrior",
        advClass: CLASSES.warrior, race, startingArmor: STARTING_ARMORS.plate,
        powerSource: POWER_SOURCES.physical, statPath: "str",
        baseRoll: BASE_ROLLS.str,
      };
      const p = buildProfile(arch, level);
      const budget = p.totalStats + Math.floor(p.hp / 3);
      results.push({ race, budget, profile: p });
    }

    const bestBudget = Math.max(...results.map(r => r.budget));
    for (const r of results) {
      const pct = ((r.budget / bestBudget) * 100).toFixed(0);
      console.log(
        pad(r.race.name, 8) + rpad(r.profile.str, 5) + rpad(r.profile.agi, 5) +
        rpad(r.profile.int, 5) + rpad(r.profile.hp, 5) +
        rpad(r.profile.totalStats, 7) + rpad(r.budget, 8) + rpad(pct + "%", 9)
      );
    }
  }
}

// ============================================================
// REPORT: Power Source Impact Isolation
// ============================================================

function reportPowerSourceImpact() {
  console.log("\n" + "=".repeat(100));
  console.log("  POWER SOURCE IMPACT ISOLATION");
  console.log("  Same class (Warrior), same path (STR), same race (Dwarf), same armor (Plate)");
  console.log("  Only variable: power source");
  console.log("=".repeat(100));

  const sources = [POWER_SOURCES.physical, POWER_SOURCES.weave, POWER_SOURCES.divine];

  for (const level of [5, 10, 50, 100]) {
    console.log(`\n--- Level ${level} ---`);
    console.log(
      pad("Source", 10) + rpad("STR", 5) + rpad("AGI", 5) + rpad("INT", 5) +
      rpad("HP", 5) + rpad("Total", 7) + rpad("Budget", 8) + rpad("vs Best", 9) +
      "  Note"
    );
    console.log("-".repeat(80));

    const results: { ps: PowerSource; budget: number; profile: StatProfile }[] = [];
    for (const ps of sources) {
      const arch: Archetype = {
        id: "TEST", name: "Test", className: "Warrior",
        advClass: CLASSES.warrior, race: RACES.dwarf, startingArmor: STARTING_ARMORS.plate,
        powerSource: ps, statPath: "str", baseRoll: BASE_ROLLS.str,
      };
      const p = buildProfile(arch, level);
      const budget = p.totalStats + Math.floor(p.hp / 3);
      results.push({ ps, budget, profile: p });
    }

    const bestBudget = Math.max(...results.map(r => r.budget));
    for (const r of results) {
      const pct = ((r.budget / bestBudget) * 100).toFixed(0);
      const note = r.ps.type === "physical" ? "+1 allocatable stat at L5" :
                   r.ps.type === "weave" ? "+1 INT auto at L5" :
                   "+2 HP auto at L5";
      console.log(
        pad(r.ps.name, 10) + rpad(r.profile.str, 5) + rpad(r.profile.agi, 5) +
        rpad(r.profile.int, 5) + rpad(r.profile.hp, 5) +
        rpad(r.profile.totalStats, 7) + rpad(r.budget, 8) + rpad(pct + "%", 9) +
        "  " + note
      );
    }
  }
}

// ============================================================
// REPORT: Stat Allocation Strategy Comparison
// ============================================================

function reportAllocationStrategies(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(120));
  console.log("  STAT ALLOCATION STRATEGY COMPARISON");
  console.log("  Same archetype, different allocation strategies at L50 and L100");
  console.log("  Focused = all into primary | Hybrid = 60/20/20 | Balanced = even split");
  console.log("=".repeat(120));

  // Show a representative set
  const representatives = ["WAR-S", "RAN-A", "WIZ-I", "DRU-A", "SOR-I"];

  for (const level of [50, 100]) {
    console.log(`\n--- Level ${level} ---`);
    console.log(
      pad("Archetype", 18) + pad("Strategy", 10) +
      rpad("STR", 5) + rpad("AGI", 5) + rpad("INT", 5) + rpad("HP", 5) +
      rpad("Primary", 8) + rpad("2nd", 5) + rpad("3rd", 5) +
      rpad("Budget", 8)
    );
    console.log("-".repeat(85));

    for (const id of representatives) {
      const arch = archetypes.find(a => a.id === id)!;
      for (const strategy of ["focused", "hybrid", "balanced"] as AllocStrategy[]) {
        const p = buildProfile(arch, level, strategy);
        const stats = [p.str, p.agi, p.int].sort((a, b) => b - a);
        const budget = p.totalStats + Math.floor(p.hp / 3);
        console.log(
          pad(`${arch.id} ${arch.name}`, 18) + pad(strategy, 10) +
          rpad(p.str, 5) + rpad(p.agi, 5) + rpad(p.int, 5) + rpad(p.hp, 5) +
          rpad(stats[0], 8) + rpad(stats[1], 5) + rpad(stats[2], 5) +
          rpad(budget, 8)
        );
      }
      console.log("");
    }
  }
}

// ============================================================
// REPORT: Key Findings Summary
// ============================================================

function reportSummary(archetypes: Archetype[]) {
  console.log("\n" + "=".repeat(100));
  console.log("  KEY FINDINGS SUMMARY");
  console.log("=".repeat(100));

  // 1. Class stat budget inequality
  console.log("\n--- 1. Class Flat Bonus Budget (stat-equivalents, HP/3) ---");
  const classBudgets = Object.values(CLASSES).map(c => {
    const flatStats = c.flatStr + c.flatAgi + c.flatInt;
    const hpEq = Math.floor(c.flatHp / 3);
    return { name: c.name, flatStats, hpEq, total: flatStats + hpEq, hasMultEdge: c.physMult > 1000 || c.spellMult > 1000 || c.critMult > 1000 || c.healMult > 1000 || c.hpMult > 1000 };
  }).sort((a, b) => b.total - a.total);

  for (const cb of classBudgets) {
    const multNote = cb.hasMultEdge ? " + multiplier" : "";
    console.log(`  ${pad(cb.name, 12)} budget=${cb.total} (${cb.flatStats} stats + ${cb.hpEq} HP-eq)${multNote}`);
  }

  // 2. Level scaling — does the gap widen or narrow?
  console.log("\n--- 2. Budget Gap Over Time ---");
  for (const level of [1, 10, 50, 100]) {
    const budgets = archetypes.map(a => {
      const p = buildProfile(a, level);
      return p.totalStats + Math.floor(p.hp / 3);
    });
    const max = Math.max(...budgets);
    const min = Math.min(...budgets);
    const gap = max - min;
    const pct = (gap / max * 100).toFixed(1);
    console.log(`  L${rpad(level, 3)}: gap=${gap} points (${pct}% of max)`);
  }

  // 3. On-path vs off-path viability
  console.log("\n--- 3. On-Path vs Off-Path Primary Stat at L100 ---");
  const classNames = Object.keys(CLASSES);
  for (const cn of classNames) {
    const classArchs = archetypes.filter(a => a.className === CLASSES[cn].name);
    const primaries = classArchs.map(a => {
      const p = buildProfile(a, 100);
      return { path: a.statPath, primary: p.primaryStat, budget: p.totalStats + Math.floor(p.hp / 3) };
    }).sort((a, b) => b.primary - a.primary);

    const best = primaries[0];
    console.log(`  ${pad(CLASSES[cn].name, 12)} ${primaries.map(p =>
      `${p.path.toUpperCase()}=${p.primary} (${(p.primary / best.primary * 100).toFixed(0)}%)`
    ).join("  ")}`);
  }

  // 4. Power source value
  console.log("\n--- 4. Power Source Budget Impact at L100 ---");
  const psBudgets: Record<string, number[]> = {};
  for (const a of archetypes) {
    const psName = a.powerSource.name;
    if (!psBudgets[psName]) psBudgets[psName] = [];
    const p = buildProfile(a, 100);
    psBudgets[psName].push(p.totalStats + Math.floor(p.hp / 3));
  }
  for (const [name, budgets] of Object.entries(psBudgets)) {
    const avg = budgets.reduce((s, b) => s + b, 0) / budgets.length;
    console.log(`  ${pad(name, 10)} avg budget=${avg.toFixed(1)} (n=${budgets.length})`);
  }

  // 5. Race value
  console.log("\n--- 5. Race Budget Impact at L100 ---");
  const raceBudgets: Record<string, number[]> = {};
  for (const a of archetypes) {
    const raceName = a.race.name;
    if (!raceBudgets[raceName]) raceBudgets[raceName] = [];
    const p = buildProfile(a, 100);
    raceBudgets[raceName].push(p.totalStats + Math.floor(p.hp / 3));
  }
  for (const [name, budgets] of Object.entries(raceBudgets)) {
    const avg = budgets.reduce((s, b) => s + b, 0) / budgets.length;
    console.log(`  ${pad(name, 10)} avg budget=${avg.toFixed(1)} (n=${budgets.length})`);
  }
}

// ============================================================
// MAIN
// ============================================================

function main() {
  const args = process.argv.slice(2);
  const runAll = args.length === 0;
  const flags = new Set(args.map(a => a.toLowerCase()));

  const archetypes = buildArchetypes();

  if (runAll || flags.has("--stats")) reportStats(archetypes);
  if (runAll || flags.has("--budget")) reportBudget(archetypes);
  if (runAll || flags.has("--class")) reportClassIsolation(archetypes);
  if (runAll || flags.has("--scaling")) reportScaling(archetypes);
  if (runAll || flags.has("--race")) reportRaceImpact();
  if (runAll || flags.has("--ps")) reportPowerSourceImpact();
  if (runAll || flags.has("--alloc")) reportAllocationStrategies(archetypes);
  if (runAll) reportSummary(archetypes);

  console.log("\n");
}

main();
