import { describe, test, expect, beforeAll } from "vitest";
import type { Hex } from "viem";
import {
  createTestWallet,
  sendTx,
  readWorld,
  deployerWallet,
  sleep,
  type StatsData,
  type TestWallet,
} from "./setup";
import { runDiscovery, type DiscoveryResult } from "./discovery";
import {
  getOrCreateCharacter,
  adminBoostToLevel,
  adminHeal,
} from "./helpers";

// ---------------------------------------------------------------------------
// Scale tests — combat statistics at volume
// ---------------------------------------------------------------------------

let discovery: DiscoveryResult;
let player: TestWallet;
let charId: Hex;

beforeAll(async () => {
  discovery = await runDiscovery();
  player = await createTestWallet("scale_player1", BigInt("50000000000000000")); // 0.05 ETH

  console.log("[scale] Creating character...");
  const result = await getOrCreateCharacter(player.wallet, {
    starterWeaponId: discovery.starterItems.weapons[0],
    starterArmorId: discovery.starterItems.armors[0],
  });
  charId = result.characterId;

  // Boost to level 5 with good stats
  await adminBoostToLevel(charId, 5);
  await adminHeal(charId);

  // Equip starter weapon
  await sendTx(player.wallet, "UD__equipItems", [
    charId,
    [BigInt(discovery.starterItems.weapons[0])],
  ]);

  console.log(`[scale] Character ${charId} ready at level 5`);
}, 120_000);

// ---------------------------------------------------------------------------

interface CombatResult {
  combatOccurred: boolean;
  won: boolean;
  died: boolean;
  xpGained: bigint;
  goldGained: bigint;
}

async function runSingleAdventure(): Promise<CombatResult> {
  const statsBefore = (await readWorld("UD__getStats", [charId])) as StatsData;
  const xpBefore = statsBefore.experience;

  // Get position and pick adjacent tile
  const [cx, cy] = (await readWorld("UD__getEntityPosition", [charId])) as [
    number,
    number,
  ];
  const nextY = cy === 0 ? 1 : 0;

  await sleep(5500); // respect cooldown

  try {
    await sendTx(player.wallet, "UD__autoAdventure", [charId, cx, nextY]);
  } catch (err: any) {
    const msg = err?.message ?? "";
    if (msg.includes("InEncounter")) {
      await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId]);
      return {
        combatOccurred: false,
        won: false,
        died: false,
        xpGained: 0n,
        goldGained: 0n,
      };
    }
    if (msg.includes("AutoAdventureCooldownActive") || msg.includes("MoveTooFast")) {
      await sleep(2000);
      return {
        combatOccurred: false,
        won: false,
        died: false,
        xpGained: 0n,
        goldGained: 0n,
      };
    }
    throw err;
  }

  const statsAfter = (await readWorld("UD__getStats", [charId])) as StatsData;
  const xpAfter = statsAfter.experience;
  const xpGained = xpAfter - xpBefore;
  const combatOccurred = xpGained > 0n || statsAfter.currentHp < statsBefore.currentHp;
  const died = statsAfter.currentHp <= 0n;
  const won = xpGained > 0n;

  return {
    combatOccurred,
    won,
    died,
    xpGained,
    goldGained: 0n, // Gold tracked separately via ERC20
  };
}

// ---------------------------------------------------------------------------

describe("Scale Tests", () => {
  test(
    "100 combats at level 5 — win rate and stats analysis",
    async () => {
      const NUM_COMBATS = 100;
      let totalAdventures = 0;
      let combatsHad = 0;
      let wins = 0;
      let deaths = 0;
      let totalXp = 0n;
      let consecutiveNoCombat = 0;

      const goldBefore = await readWorld("UD__getExperience", [charId]);

      for (let i = 0; i < NUM_COMBATS + 50; i++) {
        // extra buffer for non-combat adventures
        if (combatsHad >= NUM_COMBATS) break;

        // Check if dead — respawn and heal
        const stats = (await readWorld("UD__getStats", [charId])) as StatsData;
        if (stats.currentHp <= 0n) {
          deaths++;
          await sendTx(player.wallet, "UD__spawn", [charId]);
          await adminHeal(charId);
        }

        // Heal if HP is low
        if (stats.currentHp > 0n && stats.currentHp < stats.maxHp / 4n) {
          const [px, py] = (await readWorld("UD__getEntityPosition", [
            charId,
          ])) as [number, number];
          if (px === 0 && py === 0) {
            await sendTx(player.wallet, "UD__rest", [charId]);
          } else {
            await adminHeal(charId);
          }
        }

        const result = await runSingleAdventure();
        totalAdventures++;

        if (result.combatOccurred) {
          combatsHad++;
          consecutiveNoCombat = 0;
          if (result.won) wins++;
          if (result.died) deaths++;
          totalXp += result.xpGained;

          // Progress update every 25 combats
          if (combatsHad % 25 === 0) {
            console.log(
              `[scale] Progress: ${combatsHad}/${NUM_COMBATS} combats, ${wins} wins, ${deaths} deaths`,
            );
          }
        } else {
          consecutiveNoCombat++;
        }
      }

      // ---------------------------------------------------------------------------
      // Report
      // ---------------------------------------------------------------------------

      const losses = combatsHad - wins;
      const winRate = combatsHad > 0 ? (wins / combatsHad) * 100 : 0;
      const avgXpPerFight = combatsHad > 0 ? totalXp / BigInt(combatsHad) : 0n;

      console.log("\n=== SCALE TEST REPORT (100 combats @ L5) ===");
      console.log(`Total adventures: ${totalAdventures}`);
      console.log(`Combats: ${combatsHad}`);
      console.log(`Wins: ${wins} (${winRate.toFixed(1)}%)`);
      console.log(`Losses: ${losses}`);
      console.log(`Deaths: ${deaths}`);
      console.log(`Total XP gained: ${totalXp}`);
      console.log(`Avg XP per fight: ${avgXpPerFight}`);
      console.log("=============================================\n");

      // Assertions — wide ranges because RNG
      expect(combatsHad).toBeGreaterThan(0);
      if (combatsHad >= 10) {
        expect(winRate).toBeGreaterThan(30); // At level 5, should win at least 30%
      }
      expect(totalXp).toBeGreaterThan(0n);
    },
    900_000, // 15 min timeout
  );

  test(
    "200 combats — extended drop rate analysis",
    async () => {
      const NUM_COMBATS = 200;
      let totalAdventures = 0;
      let combatsHad = 0;
      let wins = 0;
      let deaths = 0;
      let totalXp = 0n;

      // Reset character to fresh level 5 state
      await adminBoostToLevel(charId, 5);
      await adminHeal(charId);

      // Track item balance changes to detect drops
      const itemBalancesBefore = new Map<number, bigint>();
      for (let itemId = 1; itemId <= discovery.totalItemsScanned; itemId++) {
        try {
          const bal = (await readWorld("UD__getItemBalance", [
            charId,
            BigInt(itemId),
          ])) as bigint;
          if (bal > 0n) itemBalancesBefore.set(itemId, bal);
        } catch {
          // skip
        }
      }

      for (let i = 0; i < NUM_COMBATS + 100; i++) {
        if (combatsHad >= NUM_COMBATS) break;

        const stats = (await readWorld("UD__getStats", [charId])) as StatsData;
        if (stats.currentHp <= 0n) {
          deaths++;
          await sendTx(player.wallet, "UD__spawn", [charId]);
          await adminHeal(charId);
        }

        if (stats.currentHp > 0n && stats.currentHp < stats.maxHp / 4n) {
          await adminHeal(charId);
        }

        const result = await runSingleAdventure();
        totalAdventures++;

        if (result.combatOccurred) {
          combatsHad++;
          if (result.won) wins++;
          if (result.died) deaths++;
          totalXp += result.xpGained;

          if (combatsHad % 50 === 0) {
            console.log(
              `[scale:200] Progress: ${combatsHad}/${NUM_COMBATS} combats`,
            );
          }
        }
      }

      // Check item balance changes (drops)
      const drops = new Map<number, bigint>();
      for (let itemId = 1; itemId <= discovery.totalItemsScanned; itemId++) {
        try {
          const bal = (await readWorld("UD__getItemBalance", [
            charId,
            BigInt(itemId),
          ])) as bigint;
          const before = itemBalancesBefore.get(itemId) ?? 0n;
          if (bal > before) {
            drops.set(itemId, bal - before);
          }
        } catch {
          // skip
        }
      }

      const winRate = combatsHad > 0 ? (wins / combatsHad) * 100 : 0;
      const totalDrops = [...drops.values()].reduce((a, b) => a + b, 0n);

      console.log("\n=== EXTENDED SCALE TEST REPORT (200 combats) ===");
      console.log(`Combats: ${combatsHad}, Wins: ${wins} (${winRate.toFixed(1)}%)`);
      console.log(`Deaths: ${deaths}`);
      console.log(`Total XP: ${totalXp}`);
      console.log(`Unique items dropped: ${drops.size}`);
      console.log(`Total item drops: ${totalDrops}`);
      if (drops.size > 0) {
        console.log("Drop breakdown:");
        for (const [itemId, count] of drops) {
          console.log(`  Item #${itemId}: ${count}`);
        }
      }
      console.log("================================================\n");

      expect(combatsHad).toBeGreaterThan(0);
      expect(totalXp).toBeGreaterThan(0n);
      // In 200 combats, we expect at least 1 item drop
      if (combatsHad >= 50) {
        expect(Number(totalDrops)).toBeGreaterThanOrEqual(1);
      }
    },
    1_800_000, // 30 min timeout
  );
});
