#!/usr/bin/env npx tsx
/**
 * Balance Verify — Sim ↔ Chain Drift Detector
 *
 * Compares items.json + effects.json (on-chain source of truth) against
 * sim override arrays to detect stat divergence.
 *
 * Usage:
 *   npx tsx scripts/balance-verify.ts --v4     # compare items.json to V4 overrides
 *   npx tsx scripts/balance-verify.ts           # compare items.json to baseline overrides
 *   npx tsx scripts/balance-verify.ts --verbose # show expected diffs (stat requirements)
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadGameData } from "./balance/loader.js";
import {
  WEAPONS_BASELINE,
  WEAPONS_V4,
  V4_WEAPON_EFFECTS,
  PROPOSED_WEAPON_EFFECTS,
} from "./balance/overrides.js";
import type { Weapon, WeaponEffect } from "./balance/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const zonePath = resolve(__dirname, "../zones/dark_cave");
const constantsPath = resolve(__dirname, "balance/constants.json");

// Parse flags
const args = process.argv.slice(2);
const useV4 = args.includes("--v4");
const verbose = args.includes("--verbose");

const overrideLabel = useV4 ? "V4" : "Baseline";
const overrideWeapons: Weapon[] = useV4 ? WEAPONS_V4 : WEAPONS_BASELINE;
const overrideEffects: Record<string, WeaponEffect[]> = useV4
  ? V4_WEAPON_EFFECTS
  : PROPOSED_WEAPON_EFFECTS;

console.log(
  `\n=== Balance Verify: items.json vs ${overrideLabel} overrides ===\n`
);

// Load on-chain data (items.json + effects.json via loader)
const data = loadGameData(zonePath, constantsPath);

// ================================================================
// Weapon stat comparison
// ================================================================

interface Mismatch {
  item: string;
  field: string;
  chain: string | number;
  override: string | number;
}

const statMismatches: Mismatch[] = [];
const reqDiffs: Mismatch[] = [];

// Fields that represent on-chain weapon stats (deployed via item-sync)
const STAT_FIELDS: (keyof Weapon)[] = [
  "minDamage",
  "maxDamage",
  "strMod",
  "agiMod",
  "intMod",
  "hpMod",
  "isMagic",
  "rarity",
  "price",
];

// Fields where sim proposes changes not yet deployed (requirements, scaling)
const REQ_FIELDS: (keyof Weapon)[] = [
  "minStr",
  "minAgi",
  "minInt",
  "scaling",
];

for (const ow of overrideWeapons) {
  const chain = data.weapons.find((w) => w.name === ow.name);
  if (!chain) {
    statMismatches.push({
      item: ow.name,
      field: "(missing)",
      chain: "NOT IN items.json",
      override: "defined",
    });
    continue;
  }

  for (const field of STAT_FIELDS) {
    if (chain[field] !== ow[field]) {
      statMismatches.push({
        item: ow.name,
        field,
        chain: chain[field] as string | number,
        override: ow[field] as string | number,
      });
    }
  }

  for (const field of REQ_FIELDS) {
    if (chain[field] !== ow[field]) {
      reqDiffs.push({
        item: ow.name,
        field,
        chain: chain[field] as number,
        override: ow[field] as number,
      });
    }
  }
}

// ================================================================
// Weapon effect comparison
// ================================================================

const effectMismatches: Mismatch[] = [];

for (const [weaponName, overrideEffs] of Object.entries(overrideEffects)) {
  const chainEffects = data.weaponEffects[weaponName] || [];

  if (chainEffects.length !== overrideEffs.length) {
    effectMismatches.push({
      item: weaponName,
      field: "effect_count",
      chain: `${chainEffects.length}`,
      override: `${overrideEffs.length}`,
    });
    // Still compare what we can
  }

  // Match effects by type (dot→dot, stat_debuff→stat_debuff) since names may differ
  const chainByType = new Map<string, WeaponEffect[]>();
  for (const ce of chainEffects) {
    const arr = chainByType.get(ce.type) || [];
    arr.push(ce);
    chainByType.set(ce.type, arr);
  }

  const overrideByType = new Map<string, WeaponEffect[]>();
  for (const oe of overrideEffs) {
    const arr = overrideByType.get(oe.type) || [];
    arr.push(oe);
    overrideByType.set(oe.type, arr);
  }

  // Check each override effect type
  for (const [type, oes] of overrideByType.entries()) {
    const ces = chainByType.get(type) || [];

    if (ces.length !== oes.length) {
      effectMismatches.push({
        item: weaponName,
        field: `${type}_count`,
        chain: `${ces.length}`,
        override: `${oes.length}`,
      });
      continue;
    }

    // Compare field-by-field (by index within type group)
    for (let i = 0; i < oes.length; i++) {
      const ce = ces[i];
      const oe = oes[i];
      const label = `${oe.name || type}`;

      const numericFields: (keyof WeaponEffect)[] = [
        "damagePerTick",
        "maxStacks",
        "duration",
        "cooldown",
        "strMod",
        "agiMod",
        "intMod",
        "armorMod",
      ];

      for (const f of numericFields) {
        const cv = ce[f] ?? 0;
        const ov = oe[f] ?? 0;
        if (cv !== ov) {
          effectMismatches.push({
            item: weaponName,
            field: `${label}.${f}`,
            chain: String(cv),
            override: String(ov),
          });
        }
      }
    }
  }
}

// ================================================================
// Report
// ================================================================

let failures = 0;

function printTable(title: string, items: Mismatch[]) {
  if (items.length === 0) return;
  console.log(`${title} (${items.length}):`);
  console.log("-".repeat(80));
  console.log(
    `${"Item".padEnd(22)} ${"Field".padEnd(18)} ${"Chain".padEnd(14)} ${overrideLabel}`
  );
  console.log("-".repeat(80));
  for (const m of items) {
    console.log(
      `${m.item.padEnd(22)} ${m.field.padEnd(18)} ${String(m.chain).padEnd(14)} ${m.override}`
    );
  }
  console.log();
}

if (statMismatches.length > 0) {
  failures += statMismatches.length;
  printTable("WEAPON STAT MISMATCHES", statMismatches);
} else {
  console.log(
    `[ok] All weapon stats match between items.json and ${overrideLabel}\n`
  );
}

if (effectMismatches.length > 0) {
  failures += effectMismatches.length;
  printTable("WEAPON EFFECT MISMATCHES", effectMismatches);
} else {
  console.log(
    `[ok] All weapon effects match between effects.json and ${overrideLabel}\n`
  );
}

if (verbose && reqDiffs.length > 0) {
  printTable("EXPECTED DIFFS (stat requirements — sim-only)", reqDiffs);
} else if (reqDiffs.length > 0) {
  console.log(
    `[info] ${reqDiffs.length} stat requirement diffs (sim-only, use --verbose to show)\n`
  );
}

// Summary
if (failures > 0) {
  console.log(
    `RESULT: ${failures} mismatches — items.json != ${overrideLabel} overrides\n`
  );
  process.exit(1);
} else {
  console.log(
    `RESULT: 0 mismatches — items.json matches ${overrideLabel} overrides\n`
  );
}
