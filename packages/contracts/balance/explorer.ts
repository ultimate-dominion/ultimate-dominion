#!/usr/bin/env npx tsx
/**
 * Ultimate Dominion — Layered Balance Explorer
 *
 * Validates combat balance bottom-up. Each layer must be balanced
 * before adding the next.
 *
 *   Layer 1: Pure triangle — 3 symmetric stat blocks. Does RPS work?
 *   Layer 2: Stat allocation — race, class, power source, armor type (TODO)
 *   Layer 3: Weapons — real damage ranges and scaling (TODO)
 *   Layer 4: Armor — defense layer (TODO)
 *   Layer 5: Mechanics — block, charges, evasion tuning (TODO)
 *   Layer 6: Consumables/Spells (TODO)
 *   Layer 7: Multi-turn/Loadout (TODO)
 *
 * All constants from balance/constants.json — single source of truth.
 *
 * Usage: npx tsx packages/contracts/balance/explorer.ts [--verbose]
 */

import { readFileSync } from "fs";
import { join } from "path";

// ============================================================
// LOAD CONSTANTS
// ============================================================

const C = JSON.parse(readFileSync(join(__dirname, "constants.json"), "utf-8"));
const WAD = 1e18;

// ============================================================
// TYPES
// ============================================================

interface Stats {
  str: number;
  agi: number;
  int: number;
  hp: number;
  armor: number;
}

type StatPath = "str" | "agi" | "int";
type WeaponScaling = "str" | "agi" | "magic";

interface Fighter {
  label: string;
  path: StatPath;
  scaling: WeaponScaling;
  stats: Stats;
}

interface CombatResult {
  hitPct: number;
  avgDmg: number;
  critPct: number;
  evasionPct: number;
  doubleStrikePct: number;
  dpt: number;
  ttk: number;
}

// ============================================================
// LAYER 1: PURE TRIANGLE
// Three symmetric stat blocks. Same total stats, same HP.
// Only variable: which stat is primary.
// ============================================================

const PRIMARY = 20;
const OFF = 5;
const BASE_HP = 40;

function buildTriangleFighters(): Fighter[] {
  return [
    {
      label: "STR",
      path: "str",
      scaling: "str",
      stats: { str: PRIMARY, agi: OFF, int: OFF, hp: BASE_HP, armor: 0 },
    },
    {
      label: "AGI",
      path: "agi",
      scaling: "agi",
      stats: { str: OFF, agi: PRIMARY, int: OFF, hp: BASE_HP, armor: 0 },
    },
    {
      label: "INT",
      path: "int",
      scaling: "magic",
      stats: { str: OFF, agi: OFF, int: PRIMARY, hp: BASE_HP, armor: 0 },
    },
  ];
}

// ============================================================
// COMBAT MATH (ports of CombatMath.sol)
// ============================================================

function calcHitProb(attackerStat: number, defenderStat: number): number {
  const h = C.combat.hit;
  const diff = attackerStat - defenderStat;
  const absDiff = Math.abs(diff);
  const dampener = diff > 0 ? h.attackerDampener : h.defenderDampener;
  let p = h.startingProbability + (diff * 1000) / ((absDiff + dampener) * 10);
  p = Math.floor(p);
  return Math.max(h.min, Math.min(h.max, p));
}

function addStatBonus(
  atkStat: number,
  defStat: number,
  baseDmgWad: number,
  atkModifier: number
): number {
  const baseDiff = atkStat * atkModifier - defStat * WAD;
  if (baseDiff > 0) {
    return Math.floor((baseDiff / 2 + baseDmgWad) / WAD);
  } else if (
    baseDmgWad > 0 &&
    baseDiff < 0 &&
    Math.abs(baseDiff / WAD) >= atkStat
  ) {
    const adjusted = baseDmgWad + baseDiff;
    return adjusted > 0 ? Math.floor(adjusted / WAD) : 1;
  }
  return Math.floor(baseDmgWad / WAD);
}

function calcMagicResist(defenderInt: number, damage: number): number {
  if (damage <= 0) return 0;
  const mr = C.combat.magicResist;
  let resistPct = defenderInt * mr.pctPerInt;
  resistPct = Math.max(0, Math.min(mr.cap, resistPct));
  let resist = Math.floor((damage * resistPct) / 100);
  if (resist >= damage) resist = damage - 1;
  return resist;
}

function calcCritChance(agi: number): number {
  const cr = C.combat.crit;
  return cr.baseChance + (agi > 0 ? Math.floor(agi / cr.agiDivisor) : 0);
}

function calcEvasionChance(defAgi: number, atkAgi: number): number {
  if (defAgi <= atkAgi) return 0;
  return Math.min(
    Math.floor((defAgi - atkAgi) / C.combat.evasion.divisor),
    C.combat.evasion.cap
  );
}

function calcDoubleStrikeChance(atkAgi: number, defAgi: number): number {
  if (atkAgi <= defAgi) return 0;
  return Math.min(
    (atkAgi - defAgi) * C.combat.doubleStrike.multiplier,
    C.combat.doubleStrike.cap
  );
}

function getDominant(s: Stats): { type: number; value: number } {
  if (s.str >= s.agi && s.str >= s.int) return { type: 0, value: s.str };
  if (s.agi > s.str && s.agi >= s.int) return { type: 1, value: s.agi };
  return { type: 2, value: s.int };
}

function calcTriangleMultiplier(a: Stats, d: Stats): number {
  const tri = C.combat.triangle;
  const aDom = getDominant(a);
  const dDom = getDominant(d);

  // STR(0) > AGI(1) > INT(2) > STR(0)
  const hasAdvantage =
    (aDom.type === 0 && dDom.type === 1) ||
    (aDom.type === 1 && dDom.type === 2) ||
    (aDom.type === 2 && dDom.type === 0);

  if (!hasAdvantage) return 1.0;

  const diff = Math.max(0, aDom.value - dDom.value);
  const flatBonus = (tri.flatBonusPct || 0) / 100;
  let scalingBonus = diff * (tri.bonusPerStatPct / 100);
  if (scalingBonus > tri.maxBonusPct / 100) scalingBonus = tri.maxBonusPct / 100;
  return 1.0 + flatBonus + scalingBonus;
}

// ============================================================
// SIMULATION
// ============================================================

const GENERIC_WEAPON = { minDmg: 1, maxDmg: 2 };

function simulate(attacker: Fighter, defender: Fighter): CombatResult {
  const a = attacker.stats;
  const d = defender.stats;
  const isMagic = attacker.scaling === "magic";
  const isAgi = attacker.scaling === "agi";
  const dmg = C.combat.damage;

  // --- Hit ---
  let hitPct: number;
  if (isMagic) {
    hitPct = calcHitProb(a.int, d.int);
  } else if (isAgi || !C.combat.hit.strWeaponsUseStr) {
    hitPct = calcHitProb(a.agi, d.agi);
  } else {
    hitPct = calcHitProb(a.str, d.agi);
  }

  // --- Crit ---
  const critPct = calcCritChance(a.agi);

  // --- Damage ---
  const avgWpn = (GENERIC_WEAPON.minDmg + GENERIC_WEAPON.maxDmg) / 2;
  let normalDmg: number;
  let critDmg: number;

  if (isMagic) {
    const mod = dmg.attackModifier * WAD;
    normalDmg = addStatBonus(a.int, d.int, Math.floor(avgWpn * mod), mod);
    if (normalDmg < 1) normalDmg = 1;
    critDmg = addStatBonus(a.int, d.int, Math.floor(GENERIC_WEAPON.maxDmg * mod), mod);
    if (critDmg < 1) critDmg = 1;
    critDmg *= dmg.critMultiplier;

    // Magic resistance
    normalDmg -= calcMagicResist(d.int, normalDmg);
    if (normalDmg < 1) normalDmg = 1;
    critDmg -= calcMagicResist(d.int, critDmg);
    if (critDmg < 1) critDmg = 1;
  } else {
    const primaryAtk = isAgi ? a.agi : a.str;
    const primaryDef = isAgi ? d.agi : d.str;
    const mod = (isAgi ? dmg.agiAttackModifier : dmg.attackModifier) * WAD;

    normalDmg = addStatBonus(primaryAtk, primaryDef, Math.floor(avgWpn * mod), mod);
    if (normalDmg < 1) normalDmg = 1;
    critDmg = addStatBonus(primaryAtk, primaryDef, Math.floor(GENERIC_WEAPON.maxDmg * mod), mod);
    if (critDmg < 1) critDmg = 1;
    critDmg *= dmg.critMultiplier;
  }

  // --- Triangle ---
  const triMult = calcTriangleMultiplier(a, d);
  normalDmg = Math.floor(normalDmg * triMult);
  critDmg = Math.floor(critDmg * triMult);

  // --- Spell dodge (v2: AGI-based dodge vs magic, threshold gated) ---
  let spellDodgePct = 0;
  if (isMagic && C.combat.spellDodge) {
    const sd = C.combat.spellDodge;
    const effective = Math.max(0, d.agi - (sd.threshold || 0));
    spellDodgePct = Math.min(Math.floor(effective * sd.pctPerAgi), sd.cap);
  }

  // --- Weighted avg damage ---
  const critFrac = critPct / 100;
  const avgDmg = normalDmg * (1 - critFrac) + critDmg * critFrac;

  // --- Evasion / Spell dodge ---
  let evasionPct = 0;
  if (!isMagic) {
    evasionPct = calcEvasionChance(d.agi, a.agi);
  }
  const dodgePct = isMagic ? spellDodgePct : evasionPct;

  // --- Double strike ---
  let doubleStrikePct = 0;
  if (isAgi) {
    doubleStrikePct = calcDoubleStrikeChance(a.agi, d.agi);
  }

  // --- Effective DPT ---
  const hitFrac = hitPct / 100;
  const dodgeFrac = dodgePct / 100;
  const dsFrac = doubleStrikePct / 100;
  const dpt = avgDmg * hitFrac * (1 - dodgeFrac) * (1 + dsFrac * 0.5);

  const ttk = dpt > 0 ? Math.ceil(BASE_HP / dpt) : 999;

  return {
    hitPct,
    avgDmg: Math.round(avgDmg * 100) / 100,
    critPct,
    evasionPct: dodgePct,
    doubleStrikePct,
    dpt: Math.round(dpt * 100) / 100,
    ttk,
  };
}

// ============================================================
// OUTPUT
// ============================================================

function pad(s: string | number, len: number): string {
  return String(s).padEnd(len);
}
function rpad(s: string | number, len: number): string {
  return String(s).padStart(len);
}

function reportConfig() {
  const h = C.combat.hit;
  const tri = C.combat.triangle;
  const sd = C.combat.spellDodge;
  console.log("\n" + "=".repeat(70));
  console.log("  CONSTANTS (from constants.json v" + C.version + ")");
  console.log("=".repeat(70));
  console.log(`  Hit formula:    STR weapons use ${h.strWeaponsUseStr ? "STR vs AGI" : "AGI vs AGI (v1)"}`);
  console.log(`  Triangle:       ${tri.flatBonusPct || 0}% flat + ${tri.bonusPerStatPct}%/pt, ${tri.maxBonusPct}% cap`);
  console.log(`  Evasion:        /(${C.combat.evasion.divisor}), cap ${C.combat.evasion.cap}%`);
  console.log(`  Spell dodge:    ${sd ? `${sd.pctPerAgi}%/AGI above ${sd.threshold || 0}, cap ${sd.cap}%` : "OFF"}`);
  console.log(`  Double strike:  x${C.combat.doubleStrike.multiplier}, cap ${C.combat.doubleStrike.cap}%`);
  console.log(`  Crit:           ${C.combat.crit.baseChance}% + AGI/${C.combat.crit.agiDivisor}`);
  console.log(`  Magic resist:   ${C.combat.magicResist.pctPerInt}%/INT, cap ${C.combat.magicResist.cap}%`);
  console.log(`  Atk modifier:   STR/INT=${C.combat.damage.attackModifier}x, AGI=${C.combat.damage.agiAttackModifier}x`);
}

function reportTriangle(fighters: Fighter[], verbose: boolean) {
  console.log("\n" + "=".repeat(70));
  console.log("  LAYER 1: PURE TRIANGLE");
  console.log(`  ${PRIMARY} primary / ${OFF} off-stats / ${BASE_HP} HP / no gear`);
  console.log("  Target: STR > AGI > INT > STR (~55-70% win rate each leg)");
  console.log("=".repeat(70));

  // All 6 matchups
  console.log(
    "\n" +
      pad("Matchup", 14) +
      rpad("Hit%", 6) +
      rpad("Dmg", 6) +
      rpad("Crit%", 7) +
      rpad("Evd%", 6) +
      rpad("DS%", 5) +
      rpad("DPT", 7) +
      rpad("TTK", 5) +
      rpad("Winner", 8)
  );
  console.log("-".repeat(70));

  const results: { atk: string; def: string; ttk: number; dpt: number; r: CombatResult }[] = [];

  for (const atk of fighters) {
    for (const def of fighters) {
      if (atk.label === def.label) continue;
      const r = simulate(atk, def);
      results.push({ atk: atk.label, def: def.label, ttk: r.ttk, dpt: r.dpt, r });

      const reverse = simulate(def, atk);
      // Compare fractional TTK (HP/DPT) — more accurate than integer ceil
      const atkFracTTK = r.dpt > 0 ? def.stats.hp / r.dpt : 999;
      const defFracTTK = reverse.dpt > 0 ? atk.stats.hp / reverse.dpt : 999;
      const ratio = atkFracTTK / defFracTTK;
      // Within 5% = effective draw (randomness decides)
      const winner = ratio < 0.95 ? atk.label : ratio > 1.05 ? def.label : "DRAW";

      console.log(
        pad(`${atk.label} → ${def.label}`, 14) +
          rpad(r.hitPct + "%", 6) +
          rpad(r.avgDmg, 6) +
          rpad(r.critPct + "%", 7) +
          rpad(r.evasionPct + "%", 6) +
          rpad(r.doubleStrikePct + "%", 5) +
          rpad(r.dpt, 7) +
          rpad(r.ttk, 5) +
          rpad(winner, 8)
      );
    }
  }

  // Triangle summary
  console.log("\n--- TRIANGLE RESULTS ---\n");

  const matchup = (atk: string, def: string) => {
    const a = results.find((r) => r.atk === atk && r.def === def)!;
    const d = results.find((r) => r.atk === def && r.def === atk)!;
    const atkFrac = a.dpt > 0 ? BASE_HP / a.dpt : 999;
    const defFrac = d.dpt > 0 ? BASE_HP / d.dpt : 999;
    const ratio = atkFrac / defFrac;
    const winner = ratio < 0.95 ? atk : ratio > 1.05 ? def : "DRAW";
    const edge = ((1 - ratio) * 100).toFixed(0);
    return { atkDPT: a.dpt, defDPT: d.dpt, winner, edge };
  };

  const legs = [
    { label: "STR > AGI", ...matchup("STR", "AGI"), expected: "STR" },
    { label: "AGI > INT", ...matchup("AGI", "INT"), expected: "AGI" },
    { label: "INT > STR", ...matchup("INT", "STR"), expected: "INT" },
  ];

  let healthy = true;
  for (const leg of legs) {
    const status = leg.winner === leg.expected ? "OK" : leg.winner === "DRAW" ? "DRAW" : "WRONG";
    if (status !== "OK") healthy = false;
    const sign = Number(leg.edge) > 0 ? "+" : "";
    console.log(
      `  ${pad(leg.label, 12)} DPT: ${rpad(leg.atkDPT, 6)} vs ${rpad(leg.defDPT, 6)}  (${sign}${leg.edge}%)  →  ${leg.winner} wins  ${status}`
    );
  }

  console.log(
    `\n  VERDICT: ${healthy ? "Triangle is healthy — all 3 legs correct" : "!! TRIANGLE BROKEN — fix formulas before proceeding"}`
  );

  if (verbose) {
    console.log("\n--- DETAILED BREAKDOWN ---");
    for (const atk of fighters) {
      for (const def of fighters) {
        if (atk.label === def.label) continue;
        const r = simulate(atk, def);
        console.log(`\n  ${atk.label}(${atk.stats.str}/${atk.stats.agi}/${atk.stats.int}) → ${def.label}(${def.stats.str}/${def.stats.agi}/${def.stats.int}):`);
        console.log(`    Scaling: ${atk.scaling}, Modifier: ${atk.scaling === "agi" ? C.combat.damage.agiAttackModifier : C.combat.damage.attackModifier}x`);
        console.log(`    Hit: ${r.hitPct}% | Avg dmg: ${r.avgDmg} | Crit: ${r.critPct}% | Evade/Dodge: ${r.evasionPct}% | DS: ${r.doubleStrikePct}%`);
        console.log(`    DPT: ${r.dpt} | TTK: ${r.ttk}`);

        const tri = calcTriangleMultiplier(atk.stats, def.stats);
        console.log(`    Triangle mult: ${tri.toFixed(2)}x`);
      }
    }
  }
}

// ============================================================
// MAIN
// ============================================================

function main() {
  const args = process.argv.slice(2);
  const verbose = args.some((a) => a === "--verbose" || a === "-v");

  const fighters = buildTriangleFighters();

  reportConfig();
  reportTriangle(fighters, verbose);

  console.log("\n");
}

main();
