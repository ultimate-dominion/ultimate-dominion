#!/usr/bin/env npx tsx
/**
 * Drop Rate Simulator — models the full L1→L10 player journey.
 *
 * Uses the combat engine for real win rates (not hardcoded).
 * Simulates XP, leveling, drops, elite encounters, and gear progression.
 *
 * Usage:
 *   npx tsx scripts/drop-sim.ts                  # current on-chain rates
 *   npx tsx scripts/drop-sim.ts --proposal       # proposed tuning
 *   npx tsx scripts/drop-sim.ts --sweep          # sweep elite multipliers
 *   npx tsx scripts/drop-sim.ts --archetype WAR-S  # specific build journey
 */

import { loadEngine, type Engine } from "../packages/contracts/scripts/balance/engine.js";

// ============================================================
//  ON-CHAIN DATA (verified from indexer snapshot)
// ============================================================

const MONSTER_XP: Record<number, number> = {
  1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 13, 7: 20, 8: 25, 9: 33, 10: 65,
};

const LEVEL_THRESH = [0, 5, 20, 55, 250, 850, 2000, 4500, 9000, 16000, 25000];

const MOB_NAMES: Record<number, string> = {
  1: 'Dire Rat', 2: 'Fungal Shaman', 3: 'Cavern Brute', 4: 'Crystal Elemental',
  5: 'Ironhide Troll', 6: 'Phase Spider', 7: 'Bonecaster', 8: 'Rock Golem',
  9: 'Pale Stalker', 10: 'Dusk Drake',
};

const ELITE_CHANCE = 15; // % spawn chance

// ============================================================
//  DROP PROFILES — effective dropChance per item per mob
// ============================================================

interface MobDropProfile {
  R2: number[]; // uncommon items, each entry = effective dropChance /100k
  R3: number[]; // rare
  R4: number[]; // epic
}

// Current on-chain (verified from snapshot)
const CURRENT_DROPS: Record<number, MobDropProfile> = {
  1:  { R2: [],                          R3: [16],               R4: [] },
  2:  { R2: [500],                       R3: [],                 R4: [] },
  3:  { R2: [500],                       R3: [],                 R4: [] },
  4:  { R2: [500],                       R3: [],                 R4: [] },
  5:  { R2: [40],                        R3: [16],               R4: [11] },
  6:  { R2: [500, 500, 40],              R3: [],                 R4: [11] },
  7:  { R2: [100, 100, 100, 40],         R3: [16],               R4: [] },
  8:  { R2: [100, 100, 40],              R3: [16, 16, 4],        R4: [] },
  9:  { R2: [100, 100, 200, 100],        R3: [16, 16, 4],        R4: [] },
  10: { R2: [100, 100, 100, 100, 100, 100, 40], R3: [16, 16, 16, 4], R4: [11] },
};

// Unified V4 drop table — same base rates across Z1 and Z2
// Matches items.json + SetMobDropBonuses.s.sol (bonuses additive)
function buildUnifiedDrops(): Record<number, MobDropProfile> {
  const R1 = 4000; // base rate for all R1 (common) items
  const R2 = 1500; // base rate for all R2 (uncommon) items
  const R3 = 200;  // base rate for all R3 (rare) items
  const R4 = 30;   // base rate for all R4 (epic) items
  return {
    // L1-L4: 3 R2 items each, no R3/R4, no bonuses
    1:  { R2: [R2, R2, R2],             R3: [],                          R4: [] },
    2:  { R2: [R2, R2, R2],             R3: [],                          R4: [] },
    3:  { R2: [R2, R2, R2],             R3: [],                          R4: [] },
    4:  { R2: [R2, R2, R2],             R3: [],                          R4: [] },
    // L5-L6: 3 R2, 2 R3 with +300 journey bump, 1 R4 at base
    5:  { R2: [R2, R2, R2],             R3: [R3+300, R3+300],            R4: [R4] },
    6:  { R2: [R2, R2, R2],             R3: [R3+300, R3+300],            R4: [R4] },
    // L7: 4 R2, 2 R3 with +200, 1 R4 at base
    7:  { R2: [R2, R2, R2, R2],         R3: [R3+200, R3+200],            R4: [R4] },
    // L8-L9: existing R2, 3 R3 with +100 taper, 1 R4 at base
    8:  { R2: [R2, R2, R2],             R3: [R3+100, R3+100, R3+100],    R4: [R4] },
    9:  { R2: [R2, R2, R2, R2],         R3: [R3+100, R3+100, R3+100],    R4: [R4] },
    // L10: 6 R2, 4 R3 at BASE ONLY (no bonus — endgame stays rare), 1 R4 at base
    10: { R2: [R2, R2, R2, R2, R2, R2], R3: [R3, R3, R3, R3],            R4: [R4] },
  };
}

// ============================================================
//  SIMULATION
// ============================================================

interface JourneyResult {
  fights: number;
  wins: number;
  eliteWins: number;
  r2: number; r3: number; r4: number;
  eliteR2: number; eliteR3: number; eliteR4: number;
  levelFights: Record<number, number>; // fights spent at each player level
}

interface SimConfig {
  drops: Record<number, MobDropProfile>;
  eliteChance: number;
  eliteDropMult: number; // multiplicative: 200 = 2x
  sims: number;
  winRates: Record<number, Record<number, number>>; // [playerLevel][mobLevel] → win rate
}

function rollDrops(mob: MobDropProfile, isElite: boolean, eliteMult: number): { R2: number; R3: number; R4: number } {
  const result = { R2: 0, R3: 0, R4: 0 };
  for (const [rarity, items] of [['R2', mob.R2], ['R3', mob.R3], ['R4', mob.R4]] as const) {
    for (const baseDc of items) {
      let dc = baseDc;
      if (isElite && eliteMult > 100) {
        dc = Math.min(100000, Math.floor(dc * eliteMult / 100));
      }
      if (Math.random() * 100000 < dc) {
        (result as any)[rarity]++;
      }
    }
  }
  return result;
}

function simulateJourney(config: SimConfig): JourneyResult[] {
  const results: JourneyResult[] = [];

  for (let s = 0; s < config.sims; s++) {
    let xp = 0, level = 1, fights = 0, wins = 0, eliteWins = 0;
    let r2 = 0, r3 = 0, r4 = 0, er2 = 0, er3 = 0, er4 = 0;
    const levelFights: Record<number, number> = {};

    while (level < 10) {
      // Pick mob: mostly at-level, sometimes below
      const mobLvl = Math.min(10, Math.random() < 0.8 ? level : Math.max(1, level - 1));
      const isElite = Math.random() * 100 < config.eliteChance;

      // Win rate from combat engine (elite mobs are harder)
      const baseWinRate = config.winRates[level]?.[mobLvl] ?? 0.7;
      const winRate = isElite ? baseWinRate * 0.85 : baseWinRate;
      const won = Math.random() < winRate;

      fights++;
      levelFights[level] = (levelFights[level] || 0) + 1;

      if (won) {
        wins++;
        if (isElite) eliteWins++;
        xp += MONSTER_XP[mobLvl];

        const drops = rollDrops(config.drops[mobLvl], isElite, config.eliteDropMult);
        r2 += drops.R2; r3 += drops.R3; r4 += drops.R4;
        if (isElite) { er2 += drops.R2; er3 += drops.R3; er4 += drops.R4; }

        for (let l = level; l < 10; l++) {
          if (xp >= LEVEL_THRESH[l]) level = l + 1;
        }
      }
    }

    results.push({ fights, wins, eliteWins, r2, r3, r4, eliteR2: er2, eliteR3: er3, eliteR4: er4, levelFights });
  }

  return results;
}

// ============================================================
//  OUTPUT
// ============================================================

function analyzeResults(results: JourneyResult[], label: string) {
  const n = results.length;
  const avg = (fn: (r: JourneyResult) => number) => results.reduce((s, r) => s + fn(r), 0) / n;

  // Per-level cumulative stats
  const milestones = [2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Build cumulative data per milestone
  const cumData: Record<number, { fights: number; r2: number; r3: number; r4: number; er2: number; er3: number; er4: number }> = {};
  for (const m of milestones) {
    // Sum fights at levels < m, drops proportional
    // This is approximate — we use the full journey data
    cumData[m] = { fights: 0, r2: 0, r3: 0, r4: 0, er2: 0, er3: 0, er4: 0 };
  }

  // Simpler: just compute totals at each milestone
  // Re-run a lightweight pass to track per-milestone
  // Actually, use total journey stats directly
  const totalFights = avg(r => r.fights);
  const totalR2 = avg(r => r.r2);
  const totalR3 = avg(r => r.r3);
  const totalR4 = avg(r => r.r4);
  const eliteR2 = avg(r => r.eliteR2);
  const eliteR3 = avg(r => r.eliteR3);
  const eliteR4 = avg(r => r.eliteR4);
  const elitePct = avg(r => r.eliteWins) / avg(r => r.wins) * 100;

  // Per-level fight distribution
  const fightsByLevel: Record<number, number> = {};
  for (let l = 1; l <= 10; l++) {
    fightsByLevel[l] = avg(r => r.levelFights[l] || 0);
  }

  console.log('');
  console.log('================================================================');
  console.log(`  ${label}`);
  console.log('================================================================');
  console.log('');
  console.log(`  Total fights L1→L10: ${totalFights.toFixed(0)} (${avg(r => r.wins).toFixed(0)} wins, ${(elitePct).toFixed(1)}% from elites)`);
  console.log('');

  // Fights per level range
  console.log('  Fights by level:');
  let cumFights = 0;
  for (let l = 1; l <= 9; l++) {
    cumFights += fightsByLevel[l];
    if ([4, 6, 9].includes(l)) {
      const range = l <= 4 ? 'L1-L4' : l <= 6 ? 'L5-L6' : 'L7-L9';
      const rangeFights = l <= 4
        ? fightsByLevel[1] + fightsByLevel[2] + fightsByLevel[3] + fightsByLevel[4]
        : l <= 6
        ? fightsByLevel[5] + fightsByLevel[6]
        : fightsByLevel[7] + fightsByLevel[8] + fightsByLevel[9];
      console.log(`    ${range}: ${rangeFights.toFixed(0)} fights (cumulative: ${cumFights.toFixed(0)})`);
    }
  }

  console.log('');
  console.log('  Drops (full L1→L10 journey):');
  console.log(`    Uncommons: ${totalR2.toFixed(1)} (${eliteR2.toFixed(1)} from elites)`);
  console.log(`    Rares:     ${totalR3.toFixed(2)} (${eliteR3.toFixed(2)} from elites)`);
  console.log(`    Epics:     ${totalR4.toFixed(3)} (${eliteR4.toFixed(3)} from elites)`);

  // Percentile analysis for rare/epic
  const sortedR3 = results.map(r => r.r3).sort((a, b) => a - b);
  const sortedR4 = results.map(r => r.r4).sort((a, b) => a - b);
  const pctWithRare = results.filter(r => r.r3 > 0).length / n * 100;
  const pctWithEpic = results.filter(r => r.r4 > 0).length / n * 100;

  console.log('');
  console.log('  Rare distribution:');
  console.log(`    ${pctWithRare.toFixed(0)}% of players find at least 1 rare by L10`);
  console.log(`    Median: ${sortedR3[Math.floor(n * 0.5)]} | P75: ${sortedR3[Math.floor(n * 0.75)]} | P90: ${sortedR3[Math.floor(n * 0.9)]}`);

  console.log('');
  console.log('  Epic distribution:');
  console.log(`    ${pctWithEpic.toFixed(0)}% of players find at least 1 epic by L10`);

  // Farming projection
  const drake = 10;
  console.log('');
  console.log('  L10 Drake farming (per hour at 317 fights/hr):');
  const drakeFightsInJourney = fightsByLevel[10] || (totalFights - cumFights);
  // Use journey L9→L10 rate as proxy for farming rate
  if (drakeFightsInJourney > 0) {
    // We don't have separate L9→L10 drop data, but we can estimate
    // from the fact that most L7-L10 drops come from that phase
  }
}

// ============================================================
//  MAIN
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const SIMS = 5000;

  console.log('Loading combat engine...');
  const engine = loadEngine();
  console.log(`Loaded ${engine.archetypes.length} archetypes, ${engine.data.monsters.length} monsters, ${engine.data.weapons.length} weapons`);

  // Pre-compute win rates using combat engine
  console.log('Pre-computing win rates (this takes ~30s)...');
  const winRateTable = engine.precomputeWinRates(100);

  // Average win rates across all archetypes for each player level × mob level
  const avgWinRates: Record<number, Record<number, number>> = {};
  for (let pLvl = 1; pLvl <= 10; pLvl++) {
    avgWinRates[pLvl] = {};
    for (let mLvl = 1; mLvl <= 10; mLvl++) {
      let sum = 0, count = 0;
      for (const arch of engine.archetypes) {
        const rate = winRateTable[arch.id]?.[pLvl]?.[mLvl];
        if (rate !== undefined) { sum += rate; count++; }
      }
      avgWinRates[pLvl][mLvl] = count > 0 ? sum / count : 0.5;
    }
  }

  // Print win rate table
  console.log('');
  console.log('=== COMBAT ENGINE WIN RATES (avg across 27 archetypes) ===');
  console.log('Player\\Mob |  L1    L2    L3    L4    L5    L6    L7    L8    L9   L10');
  console.log('----------|------------------------------------------------------------');
  for (let pLvl = 1; pLvl <= 10; pLvl++) {
    let row = `    L${String(pLvl).padStart(2)}    |`;
    for (let mLvl = 1; mLvl <= 10; mLvl++) {
      const wr = avgWinRates[pLvl][mLvl];
      row += ` ${(wr * 100).toFixed(0).padStart(4)}%`;
    }
    console.log(row);
  }

  // Run current
  const currentResults = simulateJourney({
    drops: CURRENT_DROPS,
    eliteChance: ELITE_CHANCE,
    eliteDropMult: 100, // 1x = no bonus (current deployed)
    sims: SIMS,
    winRates: avgWinRates,
  });
  analyzeResults(currentResults, 'CURRENT ON-CHAIN');

  if (args.includes('--proposal') || args.includes('--unified') || args.includes('--unified')) {
    for (const eMult of [100, 200, 300]) {
      const proposalResults = simulateJourney({
        drops: buildUnifiedDrops(),
        eliteChance: ELITE_CHANCE,
        eliteDropMult: eMult,
        sims: SIMS,
        winRates: avgWinRates,
      });
      analyzeResults(proposalResults, `UNIFIED V4 (elite ${eMult / 100}x)`);
    }
  }

  if (args.includes('--sweep')) {
    console.log('');
    console.log('=== ELITE MULTIPLIER SWEEP ===');
    console.log('  Mult  | Uncommons | Rares  | Epics  | % with Rare | % with Epic');
    console.log('  ------|-----------|--------|--------|-------------|----------');
    for (const eMult of [100, 150, 200, 250, 300, 400, 500]) {
      const r = simulateJourney({
        drops: buildUnifiedDrops(),
        eliteChance: ELITE_CHANCE,
        eliteDropMult: eMult,
        sims: SIMS,
        winRates: avgWinRates,
      });
      const n = r.length;
      const avgR2 = r.reduce((s, j) => s + j.r2, 0) / n;
      const avgR3 = r.reduce((s, j) => s + j.r3, 0) / n;
      const avgR4 = r.reduce((s, j) => s + j.r4, 0) / n;
      const pctRare = r.filter(j => j.r3 > 0).length / n * 100;
      const pctEpic = r.filter(j => j.r4 > 0).length / n * 100;
      console.log(
        `  ${(eMult / 100).toFixed(1)}x   | ` +
        `${avgR2.toFixed(1).padStart(9)} | ${avgR3.toFixed(2).padStart(6)} | ${avgR4.toFixed(3).padStart(6)} | ` +
        `${pctRare.toFixed(0).padStart(10)}% | ${pctEpic.toFixed(0).padStart(8)}%`
      );
    }
  }

  // Specific archetype journey
  const archFlag = args.indexOf('--archetype');
  if (archFlag !== -1 && args[archFlag + 1]) {
    const archId = args[archFlag + 1].toLowerCase();
    const matchingArchs = engine.archetypes.filter(a =>
      a.id.toLowerCase().includes(archId) || a.name.toLowerCase().includes(archId)
    );

    if (matchingArchs.length > 0) {
      for (const arch of matchingArchs.slice(0, 3)) {
        // Use this specific archetype's win rates
        const archWinRates: Record<number, Record<number, number>> = {};
        for (let pLvl = 1; pLvl <= 10; pLvl++) {
          archWinRates[pLvl] = {};
          for (let mLvl = 1; mLvl <= 10; mLvl++) {
            archWinRates[pLvl][mLvl] = winRateTable[arch.id]?.[pLvl]?.[mLvl] ?? 0.5;
          }
        }

        const drops = args.includes('--proposal') || args.includes('--unified') ? buildUnifiedDrops() : CURRENT_DROPS;
        const r = simulateJourney({
          drops,
          eliteChance: ELITE_CHANCE,
          eliteDropMult: args.includes('--proposal') || args.includes('--unified') ? 200 : 100,
          sims: SIMS,
          winRates: archWinRates,
        });
        analyzeResults(r, `${arch.name} (${arch.id}) — ${args.includes('--proposal') || args.includes('--unified') ? 'PROPOSAL' : 'CURRENT'}`);
      }
    } else {
      console.log(`No archetype matching "${archId}". Available: ${engine.archetypes.map(a => a.id).join(', ')}`);
    }
  }
}

main().catch(console.error);
