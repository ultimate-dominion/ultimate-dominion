import { describe, test, expect, beforeAll } from "vitest";
import type { Hex } from "viem";
import {
  createTestWallet,
  sendTx,
  readWorld,
  simulateAndSend,
  deployerWallet,
  deployerQueue,
  sleep,
  uniqueName,
  Race,
  PowerSource,
  ArmorType,
  EncounterType,
  type StatsData,
  type TestWallet,
} from "./setup";
import { runDiscovery, type DiscoveryResult } from "./discovery";
import {
  getOrCreateCharacter,
  adminBoostToLevel,
  adminHeal,
  getGoldBalance,
} from "./helpers";
import { assertCharacterValid, getStats } from "./assertions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BuildConfig {
  index: number;
  race: Race;
  powerSource: PowerSource;
  armorType: ArmorType;
  label: string;
}

interface CharacterState {
  wallet: TestWallet;
  characterId: Hex;
  config: BuildConfig;
}

interface FarmStats {
  combats: number;
  wins: number;
  losses: number;
  deaths: number;
  xpGained: bigint;
  label: string;
}

interface PvPResult {
  attacker: string;
  defender: string;
  attackerWon: boolean;
  draw: boolean;
}

// ---------------------------------------------------------------------------
// Build matrix — 3 races x 3 power sources = 9 builds
// ---------------------------------------------------------------------------

const BUILD_MATRIX: BuildConfig[] = [
  { index: 0, race: Race.Human, powerSource: PowerSource.Divine, armorType: ArmorType.Cloth, label: "Human/Divine" },
  { index: 1, race: Race.Human, powerSource: PowerSource.Weave, armorType: ArmorType.Cloth, label: "Human/Weave" },
  { index: 2, race: Race.Human, powerSource: PowerSource.Physical, armorType: ArmorType.Plate, label: "Human/Physical" },
  { index: 3, race: Race.Elf, powerSource: PowerSource.Divine, armorType: ArmorType.Cloth, label: "Elf/Divine" },
  { index: 4, race: Race.Elf, powerSource: PowerSource.Weave, armorType: ArmorType.Cloth, label: "Elf/Weave" },
  { index: 5, race: Race.Elf, powerSource: PowerSource.Physical, armorType: ArmorType.Leather, label: "Elf/Physical" },
  { index: 6, race: Race.Dwarf, powerSource: PowerSource.Divine, armorType: ArmorType.Cloth, label: "Dwarf/Divine" },
  { index: 7, race: Race.Dwarf, powerSource: PowerSource.Weave, armorType: ArmorType.Cloth, label: "Dwarf/Weave" },
  { index: 8, race: Race.Dwarf, powerSource: PowerSource.Physical, armorType: ArmorType.Plate, label: "Dwarf/Physical" },
];

const NUM_COMBATS = 50;
const ADVENTURE_COOLDOWN_MS = 5500;

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let discovery: DiscoveryResult;
const characters: CharacterState[] = [];
const farmResults: FarmStats[] = [];
const pvpResults: PvPResult[] = [];

// ---------------------------------------------------------------------------
// Setup — create 9 wallets and characters
// ---------------------------------------------------------------------------

beforeAll(async () => {
  console.log("[balance] Running discovery...");
  discovery = await runDiscovery();

  expect(discovery.starterItems.weapons.length).toBeGreaterThan(0);
  expect(discovery.starterItems.armors.length).toBeGreaterThan(0);

  // Create 9 wallets sequentially (deployer funding needs serial nonces)
  console.log("[balance] Creating 9 test wallets...");
  for (let i = 0; i < BUILD_MATRIX.length; i++) {
    const wallet = await createTestWallet(
      `balance_${i}`,
      BigInt("50000000000000000"), // 0.05 ETH each
    );
    console.log(`[balance] Wallet ${i} (${BUILD_MATRIX[i].label}): ${wallet.address}`);

    const cfg = BUILD_MATRIX[i];
    const result = await getOrCreateCharacter(wallet.wallet, {
      name: uniqueName(`bal${i}`),
      race: cfg.race,
      powerSource: cfg.powerSource,
      armorType: cfg.armorType,
      starterWeaponId: discovery.starterItems.weapons[0],
      starterArmorId: discovery.starterItems.armors[0],
    });

    characters.push({ wallet, characterId: result.characterId, config: cfg });
  }

  // Boost all to level 5 + heal + equip (deployer calls must be serial)
  console.log("[balance] Boosting all characters to level 5...");
  for (const char of characters) {
    await adminBoostToLevel(char.characterId, 5);
    await adminHeal(char.characterId);
    await sendTx(char.wallet.wallet, "UD__equipItems", [
      char.characterId,
      [BigInt(discovery.starterItems.weapons[0])],
    ]);
  }

  console.log("[balance] All 9 characters ready.");
}, 600_000);

// ---------------------------------------------------------------------------
// Parallel farming — each character runs its own adventure loop
// ---------------------------------------------------------------------------

async function farmCharacter(char: CharacterState): Promise<FarmStats> {
  const stats: FarmStats = {
    combats: 0,
    wins: 0,
    losses: 0,
    deaths: 0,
    xpGained: 0n,
    label: char.config.label,
  };

  const maxIterations = NUM_COMBATS + 30; // buffer for non-combat adventures

  for (let i = 0; i < maxIterations; i++) {
    if (stats.combats >= NUM_COMBATS) break;

    // Check state
    const charStats = (await readWorld("UD__getStats", [char.characterId])) as StatsData;

    // Handle death — respawn from own wallet, heal via deployer queue
    if (charStats.currentHp <= 0n) {
      stats.deaths++;
      await sendTx(char.wallet.wallet, "UD__spawn", [char.characterId]);
      await deployerQueue.enqueue(() => adminHeal(char.characterId));
    }

    // Heal if low HP — use deployer queue to serialize admin calls
    if (charStats.currentHp > 0n && charStats.currentHp < charStats.maxHp / 4n) {
      await deployerQueue.enqueue(() => adminHeal(char.characterId));
    }

    // Get position and zigzag
    const [cx, cy] = (await readWorld("UD__getEntityPosition", [
      char.characterId,
    ])) as [number, number];
    const nextY = cy === 0 ? 1 : 0;

    const xpBefore = charStats.experience;

    await sleep(ADVENTURE_COOLDOWN_MS);

    try {
      await sendTx(char.wallet.wallet, "UD__autoAdventure", [
        char.characterId,
        cx,
        nextY,
      ]);
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("InEncounter")) {
        await deployerQueue.enqueue(() =>
          sendTx(deployerWallet, "UD__adminClearEncounterState", [char.characterId]),
        );
        continue;
      }
      if (msg.includes("AutoAdventureCooldownActive") || msg.includes("MoveTooFast")) {
        await sleep(2000);
        continue;
      }
      // Log and skip other errors
      console.log(`[balance] ${char.config.label} error: ${msg.slice(0, 80)}`);
      continue;
    }

    // Check if combat happened via XP delta
    const statsAfter = (await readWorld("UD__getStats", [char.characterId])) as StatsData;
    const xpDelta = statsAfter.experience - xpBefore;
    const hpDropped = statsAfter.currentHp < charStats.currentHp;

    if (xpDelta > 0n || hpDropped) {
      stats.combats++;
      if (xpDelta > 0n) {
        stats.wins++;
        stats.xpGained += xpDelta;
      } else {
        stats.losses++;
      }
      if (statsAfter.currentHp <= 0n) {
        stats.deaths++;
      }
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("9-Character Balance Test", () => {
  test(
    "parallel farming — 9 builds x 50 combats",
    async () => {
      console.log(`\n[balance] Starting parallel farm: ${NUM_COMBATS} combats per character...`);

      // Stagger starts by 500ms to avoid block congestion
      const promises = characters.map((char, i) =>
        sleep(i * 500).then(() =>
          farmCharacter(char).catch((err) => {
            console.error(`[balance] ${char.config.label} FAILED: ${err.message}`);
            return {
              combats: 0,
              wins: 0,
              losses: 0,
              deaths: 0,
              xpGained: 0n,
              label: char.config.label,
            } as FarmStats;
          }),
        ),
      );

      const results = await Promise.all(promises);
      farmResults.push(...results);

      // Print per-build results
      console.log("\n=== PvE BALANCE REPORT ===");
      console.log("Build                | Combats | Wins | Losses | Deaths | Win%   | XP Gained");
      console.log("---------------------|---------|------|--------|--------|--------|----------");

      for (const r of results) {
        const winPct = r.combats > 0 ? ((r.wins / r.combats) * 100).toFixed(1) : "N/A";
        console.log(
          `${r.label.padEnd(21)}| ${String(r.combats).padEnd(8)}| ${String(r.wins).padEnd(5)}| ${String(r.losses).padEnd(7)}| ${String(r.deaths).padEnd(7)}| ${String(winPct + "%").padEnd(7)}| ${r.xpGained}`,
        );
      }

      // Aggregate by race
      console.log("\n--- By Race ---");
      for (const race of [Race.Human, Race.Elf, Race.Dwarf]) {
        const raceName = Race[race];
        const raceResults = results.filter(
          (_, i) => BUILD_MATRIX[i].race === race,
        );
        const totalCombats = raceResults.reduce((s, r) => s + r.combats, 0);
        const totalWins = raceResults.reduce((s, r) => s + r.wins, 0);
        const totalDeaths = raceResults.reduce((s, r) => s + r.deaths, 0);
        const winPct = totalCombats > 0 ? ((totalWins / totalCombats) * 100).toFixed(1) : "N/A";
        console.log(`${raceName}: ${totalWins}/${totalCombats} wins (${winPct}%), ${totalDeaths} deaths`);
      }

      // Aggregate by power source
      console.log("\n--- By Power Source ---");
      for (const ps of [PowerSource.Divine, PowerSource.Weave, PowerSource.Physical]) {
        const psName = PowerSource[ps];
        const psResults = results.filter(
          (_, i) => BUILD_MATRIX[i].powerSource === ps,
        );
        const totalCombats = psResults.reduce((s, r) => s + r.combats, 0);
        const totalWins = psResults.reduce((s, r) => s + r.wins, 0);
        const totalDeaths = psResults.reduce((s, r) => s + r.deaths, 0);
        const winPct = totalCombats > 0 ? ((totalWins / totalCombats) * 100).toFixed(1) : "N/A";
        console.log(`${psName}: ${totalWins}/${totalCombats} wins (${winPct}%), ${totalDeaths} deaths`);
      }

      console.log("==========================\n");

      // Balance warnings
      for (const r of results) {
        const winPct = r.combats > 0 ? (r.wins / r.combats) * 100 : 0;
        if (r.combats >= 10 && winPct < 20) {
          console.log(`[BALANCE WARNING] ${r.label} win rate ${winPct.toFixed(1)}% — needs tuning`);
        }
        if (r.combats >= 10 && winPct > 85) {
          console.log(`[BALANCE WARNING] ${r.label} win rate ${winPct.toFixed(1)}% — too strong`);
        }
      }

      // Assertions — every build should complete at least some combats
      for (const r of results) {
        expect(r.combats).toBeGreaterThan(0);
      }

      // Global XP should be earned
      const totalXp = results.reduce((s, r) => s + r.xpGained, 0n);
      expect(totalXp).toBeGreaterThan(0n);
    },
    900_000, // 15 min — 9 chars parallel at ~5.5s/adventure, ~50 adventures each
  );

  test(
    "PvP round-robin — representative matchups",
    async () => {
      // Pick 9 representative matchups: each char fights their adjacent neighbor + one cross-race
      const matchups: [number, number][] = [
        [0, 1], // Human/Divine vs Human/Weave
        [1, 2], // Human/Weave vs Human/Physical
        [3, 4], // Elf/Divine vs Elf/Weave
        [4, 5], // Elf/Weave vs Elf/Physical
        [6, 7], // Dwarf/Divine vs Dwarf/Weave
        [7, 8], // Dwarf/Weave vs Dwarf/Physical
        [0, 3], // Human/Divine vs Elf/Divine (cross-race same PS)
        [2, 8], // Human/Physical vs Dwarf/Physical (cross-race same PS)
        [1, 4], // Human/Weave vs Elf/Weave (cross-race same PS)
      ];

      console.log(`\n[balance] Running ${matchups.length} PvP matchups...`);

      for (const [aIdx, dIdx] of matchups) {
        const attacker = characters[aIdx];
        const defender = characters[dIdx];

        // Prep: move both to (6,6), heal, clear any encounter
        await sendTx(deployerWallet, "UD__adminClearEncounterState", [attacker.characterId]);
        await sendTx(deployerWallet, "UD__adminClearEncounterState", [defender.characterId]);
        await sendTx(deployerWallet, "UD__adminMoveEntity", [attacker.characterId, 6, 6]);
        await sendTx(deployerWallet, "UD__adminMoveEntity", [defender.characterId, 6, 6]);
        await adminHeal(attacker.characterId);
        await adminHeal(defender.characterId);

        const hpABefore = (await getStats(attacker.characterId)).currentHp;
        const hpDBefore = (await getStats(defender.characterId)).currentHp;

        let result: PvPResult = {
          attacker: attacker.config.label,
          defender: defender.config.label,
          attackerWon: false,
          draw: true,
        };

        try {
          await simulateAndSend<Hex>(
            attacker.wallet.wallet,
            "UD__createEncounter",
            [EncounterType.PvP, [attacker.characterId], [defender.characterId]],
          );

          const hpAAfter = (await getStats(attacker.characterId)).currentHp;
          const hpDAfter = (await getStats(defender.characterId)).currentHp;

          const aDied = hpAAfter <= 0n;
          const dDied = hpDAfter <= 0n;

          if (aDied && !dDied) {
            result = { ...result, attackerWon: false, draw: false };
          } else if (dDied && !aDied) {
            result = { ...result, attackerWon: true, draw: false };
          } else {
            // Neither died — compare HP loss ratios
            const aLoss = hpABefore - hpAAfter;
            const dLoss = hpDBefore - hpDAfter;
            if (aLoss !== dLoss) {
              result = { ...result, attackerWon: dLoss > aLoss, draw: false };
            }
          }
        } catch (err: any) {
          console.log(
            `[balance] PvP ${attacker.config.label} vs ${defender.config.label} failed: ${err.message?.slice(0, 80)}`,
          );
        }

        pvpResults.push(result);

        // Cleanup
        await sendTx(deployerWallet, "UD__adminClearEncounterState", [attacker.characterId]);
        await sendTx(deployerWallet, "UD__adminClearEncounterState", [defender.characterId]);
      }

      // Print PvP results
      console.log("\n=== PvP BALANCE REPORT ===");
      console.log("Attacker             | Defender             | Winner");
      console.log("---------------------|----------------------|--------");

      for (const r of pvpResults) {
        const winner = r.draw ? "DRAW" : r.attackerWon ? r.attacker : r.defender;
        console.log(
          `${r.attacker.padEnd(21)}| ${r.defender.padEnd(21)}| ${winner}`,
        );
      }

      // Per-build PvP win tally
      console.log("\n--- PvP Win Tally ---");
      const winTally = new Map<string, { wins: number; losses: number; draws: number }>();
      for (const cfg of BUILD_MATRIX) {
        winTally.set(cfg.label, { wins: 0, losses: 0, draws: 0 });
      }
      for (const r of pvpResults) {
        if (r.draw) {
          winTally.get(r.attacker)!.draws++;
          winTally.get(r.defender)!.draws++;
        } else if (r.attackerWon) {
          winTally.get(r.attacker)!.wins++;
          winTally.get(r.defender)!.losses++;
        } else {
          winTally.get(r.attacker)!.losses++;
          winTally.get(r.defender)!.wins++;
        }
      }
      for (const [label, tally] of winTally) {
        const total = tally.wins + tally.losses + tally.draws;
        if (total === 0) continue;
        console.log(`${label}: ${tally.wins}W / ${tally.losses}L / ${tally.draws}D`);
      }

      console.log("==========================\n");

      // At least some matchups should have a clear winner
      const decisiveMatches = pvpResults.filter((r) => !r.draw);
      console.log(`[balance] Decisive matches: ${decisiveMatches.length}/${pvpResults.length}`);
    },
    600_000, // 10 min — 9 matchups, each ~30s of setup + combat
  );

  test("final balance summary", async () => {
    // Read gold balances for all characters
    console.log("\n=== FINAL CHARACTER STATE ===");
    console.log("Build                | Level | HP          | Gold (tokens)");
    console.log("---------------------|-------|-------------|-------------");

    for (const char of characters) {
      const stats = await getStats(char.characterId);
      const gold = await getGoldBalance(
        char.wallet.address,
        discovery.goldTokenAddress,
      );
      const goldTokens = (Number(gold) / 1e18).toFixed(1);
      console.log(
        `${char.config.label.padEnd(21)}| ${String(stats.level).padEnd(6)}| ${String(stats.currentHp).padEnd(5)}/${String(stats.maxHp).padEnd(5)} | ${goldTokens}`,
      );
    }

    console.log("=============================\n");
  });
});
