/**
 * Variance analysis: quantify how static damage feels and test a fix.
 * Run: npx tsx packages/contracts/scripts/balance/variance-analysis.ts
 */

import { seededRng, resolveAttack, type RngFn } from "./combat.js";
import type { CombatConstants, Combatant, Weapon } from "./types.js";

const CC: CombatConstants = {
  attackModifier: 1.0,
  agiAttackModifier: 1.0,
  defenseModifier: 1.0,
  critMultiplier: 2,
  critBaseChance: 5,
  critAgiDivisor: 4,
  evasionMultiplier: 2,
  evasionCap: 35,
  doubleStrikeMultiplier: 3,
  doubleStrikeCap: 40,
  combatTriangleFlatPct: 0.20,
  combatTrianglePerStat: 0.02,
  combatTriangleMax: 0.12,
  magicResistPerInt: 3,
  magicResistCap: 40,
  blockChancePerStr: 2,
  blockChanceCap: 30,
  blockReductionPhys: 0.50,
  blockReductionMagic: 0.0,
  hitStartingProbability: 90,
  hitAttackerDampener: 95,
  hitDefenderDampener: 30,
  hitMin: 5,
  hitMax: 98,
  spellDodgeThreshold: 10,
  spellDodgePctPerAgi: 2.0,
  spellDodgeCap: 20,
  classMultiplierBase: 1000,
};

function makeWeapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    name: "Sword", minDamage: 3, maxDamage: 5, strMod: 2, agiMod: 0, intMod: 0, hpMod: 0,
    scaling: "str", isMagic: false, minStr: 0, minAgi: 0, minInt: 0, rarity: 1, price: 50,
    ...overrides,
  };
}

function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    str: 15, agi: 8, int: 6, hp: 40, maxHp: 40, armor: 2,
    weapon: makeWeapon(),
    physMult: 1000, spellMult: 1000, critMult: 1000, hpMult: 1000,
    dominantType: "STR", dominantStat: 15, className: "Warrior",
    ...overrides,
  };
}

// ============================================================
// Modified resolveAttack with damage variance
// ============================================================

function resolveAttackWithVariance(
  attacker: Combatant,
  defender: Combatant,
  cc: CombatConstants,
  rng: RngFn,
  variancePct: number, // e.g. 25 means ±25%
): number {
  const w = attacker.weapon;

  // Evasion check
  if (defender.agi > attacker.agi) {
    let evadeChance = Math.min(Math.floor((defender.agi - attacker.agi) * cc.evasionMultiplier), cc.evasionCap);
    if (!w.isMagic && attacker.str > defender.str) {
      const strReduction = Math.min(attacker.str - defender.str, 15);
      evadeChance = Math.max(0, evadeChance - strReduction);
    }
    if (rng(1, 100) <= evadeChance) return 0;
  }

  // Spell dodge
  if (w.isMagic && defender.agi >= cc.spellDodgeThreshold) {
    const spellDodgeChance = Math.min(
      Math.floor((defender.agi - cc.spellDodgeThreshold) * cc.spellDodgePctPerAgi),
      cc.spellDodgeCap,
    );
    if (rng(1, 100) <= spellDodgeChance) return 0;
  }

  // Crit check
  const critChance = cc.critBaseChance + Math.floor(attacker.agi / cc.critAgiDivisor);
  const isCrit = rng(1, 100) <= critChance;

  // Roll damage
  let rawDmg: number;
  if (isCrit) {
    rawDmg = w.maxDamage;
  } else {
    rawDmg = rng(w.minDamage, w.maxDamage);
  }

  const scalingMod = w.isMagic ? cc.attackModifier :
                     w.scaling === "agi" ? cc.agiAttackModifier : cc.attackModifier;

  let damage = rawDmg * scalingMod;

  // Stat bonus
  let attackerStat: number;
  let defenderStat: number;
  if (w.isMagic) {
    attackerStat = attacker.int;
    defenderStat = defender.int;
  } else if (w.scaling === "agi") {
    attackerStat = attacker.agi;
    defenderStat = defender.agi;
  } else {
    attackerStat = attacker.str;
    defenderStat = defender.str;
  }

  const statDiff = (attackerStat * scalingMod) - (defenderStat * cc.defenseModifier);
  if (statDiff > 0) {
    damage += statDiff / 2;
  } else {
    damage = Math.max(1, damage + statDiff / 2);
  }

  // === VARIANCE: apply ±variancePct% random multiplier ===
  if (variancePct > 0) {
    const roll = rng(100 - variancePct, 100 + variancePct);
    damage = damage * roll / 100;
  }

  // Armor reduction (physical only)
  if (!w.isMagic) {
    const armorReduction = Math.max(0, defender.armor);
    damage = Math.max(1, damage - armorReduction);
  }

  // Magic resistance
  if (w.isMagic) {
    const resistPct = Math.min(defender.int * cc.magicResistPerInt, cc.magicResistCap);
    damage = Math.max(1, damage * (1 - resistPct / 100));
  }

  // Crit multiplier
  if (isCrit) {
    damage *= cc.critMultiplier;
    if (attacker.critMult > 1000) {
      damage = damage * attacker.critMult / 1000;
    }
  }

  // Class multiplier
  if (w.isMagic) {
    damage = damage * attacker.spellMult / 1000;
  } else {
    damage = damage * attacker.physMult / 1000;
  }

  // Combat triangle
  const hasTriangleAdv = (attacker.dominantType === "STR" && defender.dominantType === "AGI") ||
                         (attacker.dominantType === "AGI" && defender.dominantType === "INT") ||
                         (attacker.dominantType === "INT" && defender.dominantType === "STR");
  if (hasTriangleAdv) {
    const diff = Math.abs(attacker.dominantStat - defender.dominantStat);
    const bonus = Math.min(diff * cc.combatTrianglePerStat, cc.combatTriangleMax);
    damage *= (1 + bonus);
  }

  // Double strike
  if (w.scaling === "agi" && !w.isMagic && attacker.agi > defender.agi) {
    const dsChance = Math.min((attacker.agi - defender.agi) * cc.doubleStrikeMultiplier, cc.doubleStrikeCap);
    if (rng(1, 100) <= dsChance) {
      damage += damage / 2;
    }
  }

  // Block
  if (defender.str > 10) {
    const blockChance = Math.min((defender.str - 10) * cc.blockChancePerStr, cc.blockChanceCap);
    if (rng(1, 100) <= blockChance) {
      const reduction = w.isMagic ? cc.blockReductionMagic : cc.blockReductionPhys;
      damage *= (1 - reduction);
    }
  }

  return Math.max(1, Math.floor(damage));
}

// ============================================================
// Analysis
// ============================================================

interface DamageStats {
  label: string;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdev: number;
  coeffOfVar: number; // stdev/mean — lower = more static
  uniqueValues: number;
  histogram: Record<number, number>;
}

function analyze(damages: number[], label: string): DamageStats {
  const sorted = [...damages].sort((a, b) => a - b);
  const mean = damages.reduce((s, d) => s + d, 0) / damages.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance = damages.reduce((s, d) => s + (d - mean) ** 2, 0) / damages.length;
  const stdev = Math.sqrt(variance);
  const histogram: Record<number, number> = {};
  for (const d of damages) {
    histogram[d] = (histogram[d] || 0) + 1;
  }
  return {
    label,
    mean: Math.round(mean * 100) / 100,
    median,
    min,
    max,
    stdev: Math.round(stdev * 100) / 100,
    coeffOfVar: Math.round((stdev / mean) * 100) / 100,
    uniqueValues: Object.keys(histogram).length,
    histogram,
  };
}

function printStats(s: DamageStats) {
  console.log(`\n  ${s.label}`);
  console.log(`  Mean: ${s.mean}  Median: ${s.median}  Min: ${s.min}  Max: ${s.max}`);
  console.log(`  StdDev: ${s.stdev}  CoeffVar: ${s.coeffOfVar}  Unique values: ${s.uniqueValues}`);

  // Print histogram as bar chart
  const entries = Object.entries(s.histogram)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const maxCount = Math.max(...entries.map(e => e[1]));
  const barWidth = 40;
  for (const [val, count] of entries) {
    const bar = "█".repeat(Math.round((count / maxCount) * barWidth));
    const pct = ((count / 10000) * 100).toFixed(1);
    console.log(`  ${String(val).padStart(3)} │${bar} ${pct}%`);
  }
}

function runFightSim(
  label: string,
  attacker: Combatant,
  defender: Combatant,
  variancePct: number,
  iterations: number = 10000,
) {
  const rng = seededRng(42);
  let aWins = 0, bWins = 0;
  const roundCounts: number[] = [];

  for (let i = 0; i < iterations; i++) {
    let aHp = attacker.maxHp;
    let bHp = defender.maxHp;
    let rounds = 0;
    for (let r = 0; r < 30 && aHp > 0 && bHp > 0; r++) {
      rounds++;
      if (variancePct === 0) {
        bHp -= resolveAttack(attacker, defender, CC, rng);
      } else {
        bHp -= resolveAttackWithVariance(attacker, defender, CC, rng, variancePct);
      }
      if (bHp <= 0) break;
      if (variancePct === 0) {
        aHp -= resolveAttack(defender, attacker, CC, rng);
      } else {
        aHp -= resolveAttackWithVariance(defender, attacker, CC, rng, variancePct);
      }
    }
    if (bHp <= 0) aWins++;
    else if (aHp <= 0) bWins++;
    roundCounts.push(rounds);
  }

  const avgRounds = roundCounts.reduce((s, r) => s + r, 0) / iterations;
  const decisive = aWins + bWins;
  console.log(`  ${label}: A wins ${((aWins/decisive)*100).toFixed(1)}%, avg ${avgRounds.toFixed(1)} rounds, ${decisive} decisive/${iterations} total`);
}

// ============================================================
// Scenarios
// ============================================================

console.log("=== DAMAGE VARIANCE ANALYSIS ===\n");

const N = 10000;

// Scenario 1: Early game — Iron Axe (1-2) vs low armor
console.log("--- Scenario 1: Early game (Iron Axe 1-2, STR 8 vs STR 6, armor 1) ---");
{
  const weapon = makeWeapon({ name: "Iron Axe", minDamage: 1, maxDamage: 2 });
  const attacker = makeCombatant({ str: 8, agi: 5, int: 3, weapon, dominantType: "STR", dominantStat: 8 });
  const defender = makeCombatant({ str: 6, agi: 5, int: 3, armor: 1, dominantType: "STR", dominantStat: 6 });

  const rng0 = seededRng(42);
  const curr = Array.from({ length: N }, () => resolveAttack(attacker, defender, CC, rng0));
  printStats(analyze(curr, "CURRENT (no variance)"));

  for (const v of [15, 25, 35]) {
    const rngV = seededRng(42);
    const proposed = Array.from({ length: N }, () => resolveAttackWithVariance(attacker, defender, CC, rngV, v));
    printStats(analyze(proposed, `WITH ±${v}% variance`));
  }
}

// Scenario 2: Mid game — Warhammer (4-7) vs medium armor
console.log("\n--- Scenario 2: Mid game (Warhammer 4-7, STR 15 vs STR 10, armor 3) ---");
{
  const weapon = makeWeapon({ name: "Warhammer", minDamage: 4, maxDamage: 7 });
  const attacker = makeCombatant({ str: 15, agi: 8, int: 6, weapon, dominantType: "STR", dominantStat: 15 });
  const defender = makeCombatant({ str: 10, agi: 8, int: 6, armor: 3, dominantType: "STR", dominantStat: 10 });

  const rng0 = seededRng(42);
  const curr = Array.from({ length: N }, () => resolveAttack(attacker, defender, CC, rng0));
  printStats(analyze(curr, "CURRENT (no variance)"));

  for (const v of [15, 25, 35]) {
    const rngV = seededRng(42);
    const proposed = Array.from({ length: N }, () => resolveAttackWithVariance(attacker, defender, CC, rngV, v));
    printStats(analyze(proposed, `WITH ±${v}% variance`));
  }
}

// Scenario 3: Late game — Darkwood Bow (6-9, AGI scaling) vs armored
console.log("\n--- Scenario 3: Late game AGI (Darkwood Bow 6-9, AGI 20 vs AGI 10, armor 5) ---");
{
  const weapon = makeWeapon({ name: "Darkwood Bow", minDamage: 6, maxDamage: 9, scaling: "agi" });
  const attacker = makeCombatant({ str: 8, agi: 20, int: 6, weapon, dominantType: "AGI", dominantStat: 20 });
  const defender = makeCombatant({ str: 12, agi: 10, int: 6, armor: 5, dominantType: "STR", dominantStat: 12 });

  const rng0 = seededRng(42);
  const curr = Array.from({ length: N }, () => resolveAttack(attacker, defender, CC, rng0));
  printStats(analyze(curr, "CURRENT (no variance)"));

  for (const v of [15, 25, 35]) {
    const rngV = seededRng(42);
    const proposed = Array.from({ length: N }, () => resolveAttackWithVariance(attacker, defender, CC, rngV, v));
    printStats(analyze(proposed, `WITH ±${v}% variance`));
  }
}

// Scenario 4: Magic — Smoldering Rod (5-7, magic) vs low INT
console.log("\n--- Scenario 4: Magic (Smoldering Rod 5-7, INT 18 vs INT 8) ---");
{
  const weapon = makeWeapon({ name: "Smoldering Rod", minDamage: 5, maxDamage: 7, isMagic: true });
  const attacker = makeCombatant({ str: 6, agi: 8, int: 18, weapon, dominantType: "INT", dominantStat: 18 });
  const defender = makeCombatant({ str: 12, agi: 8, int: 8, armor: 5, dominantType: "STR", dominantStat: 12 });

  const rng0 = seededRng(42);
  const curr = Array.from({ length: N }, () => resolveAttack(attacker, defender, CC, rng0));
  printStats(analyze(curr, "CURRENT (no variance)"));

  for (const v of [15, 25, 35]) {
    const rngV = seededRng(42);
    const proposed = Array.from({ length: N }, () => resolveAttackWithVariance(attacker, defender, CC, rngV, v));
    printStats(analyze(proposed, `WITH ±${v}% variance`));
  }
}

// ============================================================
// Fight outcome impact — does variance change who wins?
// ============================================================

console.log("\n=== FIGHT OUTCOME IMPACT ===");
console.log("(Does adding variance change win rates or just feel?)");
{
  const weapon = makeWeapon({ minDamage: 4, maxDamage: 7 });
  const a = makeCombatant({ str: 15, agi: 8, int: 6, hp: 40, maxHp: 40, weapon, dominantType: "STR", dominantStat: 15 });
  const b = makeCombatant({ str: 10, agi: 8, int: 6, hp: 35, maxHp: 35, armor: 3, weapon, dominantType: "STR", dominantStat: 10 });

  console.log("\n  STR 15 (40hp) vs STR 10 (35hp, 3 armor):");
  runFightSim("Current      ", a, b, 0);
  runFightSim("±15% variance", a, b, 15);
  runFightSim("±25% variance", a, b, 25);
  runFightSim("±35% variance", a, b, 35);
}

{
  // Mirror match
  const weapon = makeWeapon({ minDamage: 4, maxDamage: 7 });
  const a = makeCombatant({ str: 15, agi: 8, int: 6, hp: 40, maxHp: 40, weapon, dominantType: "STR", dominantStat: 15 });

  console.log("\n  Mirror match (STR 15, 40hp):");
  runFightSim("Current      ", a, a, 0);
  runFightSim("±15% variance", a, a, 15);
  runFightSim("±25% variance", a, a, 25);
  runFightSim("±35% variance", a, a, 35);
}

{
  // Underdog scenario — can a weaker player ever win?
  const weapon = makeWeapon({ minDamage: 4, maxDamage: 7 });
  const strong = makeCombatant({ str: 20, agi: 10, int: 6, hp: 55, maxHp: 55, weapon, dominantType: "STR", dominantStat: 20 });
  const weak = makeCombatant({ str: 12, agi: 6, int: 4, hp: 30, maxHp: 30, armor: 2, weapon, dominantType: "STR", dominantStat: 12 });

  console.log("\n  Underdog (STR 12/30hp vs STR 20/55hp):");
  runFightSim("Current      ", weak, strong, 0);
  runFightSim("±15% variance", weak, strong, 15);
  runFightSim("±25% variance", weak, strong, 25);
  runFightSim("±35% variance", weak, strong, 35);
}
