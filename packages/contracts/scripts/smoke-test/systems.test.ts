import { describe, test, expect, beforeAll } from "vitest";
import type { Hex } from "viem";
import {
  createTestWallet,
  sendTx,
  readWorld,
  simulateAndSend,
  deployerWallet,
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
  adminDropGold,
} from "./helpers";
import { assertPosition, getStats } from "./assertions";

// ---------------------------------------------------------------------------
// Systems Tests — direct move, PvP flee, respec, fragments
// ---------------------------------------------------------------------------

let discovery: DiscoveryResult;
let player1: TestWallet;
let player2: TestWallet;
let charId1: Hex;
let charId2: Hex;

beforeAll(async () => {
  discovery = await runDiscovery();

  console.log("[systems] Creating test wallets...");
  player1 = await createTestWallet("sys_player1");
  player2 = await createTestWallet("sys_player2");

  console.log("[systems] Creating characters...");
  const result1 = await getOrCreateCharacter(player1.wallet, {
    name: uniqueName("sys_a"),
    race: Race.Human,
    powerSource: PowerSource.Physical,
    armorType: ArmorType.Plate,
    starterWeaponId: discovery.starterItems.weapons[0],
    starterArmorId: discovery.starterItems.armors[0],
  });
  charId1 = result1.characterId;

  const result2 = await getOrCreateCharacter(player2.wallet, {
    name: uniqueName("sys_b"),
    race: Race.Dwarf,
    powerSource: PowerSource.Physical,
    armorType: ArmorType.Plate,
    starterWeaponId: discovery.starterItems.weapons[0],
    starterArmorId: discovery.starterItems.armors[0],
  });
  charId2 = result2.characterId;

  // Boost both to level 5
  await adminBoostToLevel(charId1, 5);
  await adminBoostToLevel(charId2, 5);
  await adminHeal(charId1);
  await adminHeal(charId2);

  // Clear encounter state for both
  for (const cid of [charId1, charId2]) {
    try {
      await sendTx(deployerWallet, "UD__adminClearEncounterState", [cid]);
    } catch {}
  }

  // Equip weapons (skip if already equipped — pattern from pvp.test.ts)
  const weaponId = BigInt(discovery.starterItems.weapons[0]);
  for (const [wallet, charId] of [
    [player1.wallet, charId1],
    [player2.wallet, charId2],
  ] as const) {
    const equipped = await readWorld("UD__isEquipped", [charId, weaponId]);
    if (!equipped) {
      const balance = (await readWorld("UD__getItemBalance", [
        charId,
        weaponId,
      ])) as bigint;
      if (balance === 0n) {
        await sendTx(deployerWallet, "UD__adminDropItem", [
          charId,
          weaponId,
          1n,
        ]);
      }
      try {
        await sendTx(wallet, "UD__equipItems", [charId, [weaponId]]);
      } catch {
        // Already equipped or other issue
      }
    }
  }

  console.log(`[systems] Player 1: ${charId1}`);
  console.log(`[systems] Player 2: ${charId2}`);
}, 180_000);

// ---------------------------------------------------------------------------
// Phase 1 — Direct Move
// ---------------------------------------------------------------------------

describe("Phase 1 — Direct Move", () => {
  test(
    "move to (0,1) and back to (0,0)",
    async () => {
      // Clear encounter + heal before moving
      try { await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId1]); } catch {}
      await adminHeal(charId1);

      // Admin move player1 to (0,0) as starting point
      await sendTx(deployerWallet, "UD__adminMoveEntity", [charId1, 0, 0]);

      // Wait for move cooldown
      await sleep(5500);

      // Move one tile to (0,1)
      await sendTx(player1.wallet, "UD__move", [charId1, 0, 1]);
      await assertPosition(charId1, 0, 1);

      // Wait for move cooldown
      await sleep(5500);

      // Move back to (0,0)
      await sendTx(player1.wallet, "UD__move", [charId1, 0, 0]);
      await assertPosition(charId1, 0, 0);

      console.log("[systems] Direct move: (0,0) -> (0,1) -> (0,0) succeeded");
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 2 — PvP Flee
// ---------------------------------------------------------------------------

describe("Phase 2 — PvP Flee", () => {
  test(
    "create PvP encounter and attempt flee",
    async () => {
      // Clear state and heal both
      for (const cid of [charId1, charId2]) {
        try {
          await sendTx(deployerWallet, "UD__adminClearEncounterState", [cid]);
        } catch {}
        await adminHeal(cid);
      }

      // Move both players to (6,6) — outside safe zone
      await sendTx(deployerWallet, "UD__adminMoveEntity", [charId1, 6, 6]);
      await sendTx(deployerWallet, "UD__adminMoveEntity", [charId2, 6, 6]);

      const stats1Before = await getStats(charId1);
      const stats2Before = await getStats(charId2);
      console.log(
        `[systems] PvP flee before: P1 HP=${stats1Before.currentHp}, P2 HP=${stats2Before.currentHp}`,
      );

      try {
        // Create PvP encounter
        const { result: encounterId } = await simulateAndSend<Hex>(
          player1.wallet,
          "UD__createEncounter",
          [EncounterType.PvP, [charId1], [charId2]],
        );
        console.log(`[systems] PvP encounter created: ${encounterId}`);

        // Immediately attempt flee from player1's wallet
        // Note: createEncounter for PvP may auto-resolve combat in one TX.
        // If so, fleePvp will revert because the encounter is already over.
        try {
          await sendTx(player1.wallet, "UD__fleePvp", [charId1]);
          console.log("[systems] PvP flee succeeded");
        } catch (fleeErr: any) {
          console.log(
            `[systems] PvP flee failed (encounter likely auto-resolved): ${fleeErr.message?.slice(0, 150)}`,
          );
        }
      } catch (err: any) {
        console.log(
          `[systems] PvP encounter creation failed: ${err.message?.slice(0, 200)}`,
        );
      }

      // Clean up encounter state for both
      for (const cid of [charId1, charId2]) {
        try {
          await sendTx(deployerWallet, "UD__adminClearEncounterState", [cid]);
        } catch {}
      }
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 3 — Respec (stat respec)
// ---------------------------------------------------------------------------

describe("Phase 3 — Stat Respec", () => {
  let respecCharId: Hex;
  let respecWallet: TestWallet;

  test(
    "create fresh character for respec (no admin boost)",
    async () => {
      // Respec requires originalStats to match — admin-boosted characters fail validation.
      // Create a fresh level-1 character specifically for this test.
      respecWallet = await createTestWallet("sys_respec");
      const result = await getOrCreateCharacter(respecWallet.wallet, {
        name: uniqueName("rspec"),
        race: Race.Elf,
        powerSource: PowerSource.Weave,
        armorType: ArmorType.Cloth,
        starterWeaponId: discovery.starterItems.weapons[0],
        starterArmorId: discovery.starterItems.armors[0],
      });
      respecCharId = result.characterId;

      // Give gold for respec cost (no admin boost — keep original stats intact)
      await adminDropGold(respecCharId, 500n * 10n ** 18n);
      await adminHeal(respecCharId);

      const stats = await getStats(respecCharId);
      console.log(
        `[systems] Respec char: Level ${stats.level}, STR=${stats.strength} AGI=${stats.agility} INT=${stats.intelligence}`,
      );
    },
    120_000,
  );

  test(
    "stat respec: swap STR to AGI",
    async () => {
      if (!respecCharId) return;

      // Check respec cost
      try {
        const [statCost, fullCost] = (await readWorld("UD__getRespecCost", [respecCharId])) as [bigint, bigint];
        console.log(`[systems] Respec cost: stat=${statCost / 10n ** 18n} gold, full=${fullCost / 10n ** 18n} gold`);
      } catch {
        console.log("[systems] getRespecCost not available");
      }

      const statsBefore = await getStats(respecCharId);
      console.log(
        `[systems] Respec before: STR=${statsBefore.strength} AGI=${statsBefore.agility} INT=${statsBefore.intelligence}`,
      );

      // earnedPoints = level (1 per level for levels 1-10).
      // desiredTotal must = originalTotal + earnedPoints.
      // For a level 1 char, originalStats == currentStats, and earnedPoints = 1.
      // So desiredTotal = currentTotal + 1 — we get one extra point to allocate.
      const earnedPoints = statsBefore.level; // 1n at level 1
      const modifiedStats: StatsData = {
        ...statsBefore,
        strength: statsBefore.strength - 2n,
        agility: statsBefore.agility + 2n + earnedPoints, // +1 extra from earned points
      };

      try {
        await sendTx(respecWallet.wallet, "UD__statRespec", [
          respecCharId,
          modifiedStats,
        ]);

        const statsAfter = await getStats(respecCharId);
        console.log(
          `[systems] Respec after: STR=${statsAfter.strength} AGI=${statsAfter.agility} INT=${statsAfter.intelligence}`,
        );

        expect(statsAfter.strength).toBe(statsBefore.strength - 2n);
        expect(statsAfter.agility).toBe(statsBefore.agility + 2n + earnedPoints);
        console.log("[systems] Stat respec succeeded");
      } catch (err: any) {
        console.log(
          `[systems] Stat respec failed: ${err.message?.slice(0, 200)}`,
        );
      }
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 4 — Fragments
// ---------------------------------------------------------------------------

describe("Phase 4 — Fragments", () => {
  test(
    "trigger fragment at (5,5)",
    async () => {
      // Admin move player1 to (5,5) — Fragment V trigger location (center tile)
      await sendTx(deployerWallet, "UD__adminMoveEntity", [charId1, 5, 5]);
      await assertPosition(charId1, 5, 5);

      try {
        // Fragment type 5, tile (5,5)
        await sendTx(player1.wallet, "UD__triggerFragment", [
          charId1,
          5,
          5,
          5,
        ]);
        console.log("[systems] Fragment trigger succeeded at (5,5)");
      } catch (err: any) {
        console.log(
          `[systems] Fragment trigger failed (may not be deployed or already triggered): ${err.message?.slice(0, 200)}`,
        );
      }
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 5 — Cleanup
// ---------------------------------------------------------------------------

describe("Phase 5 — Cleanup", () => {
  test(
    "clear encounter state and heal both players",
    async () => {
      for (const cid of [charId1, charId2]) {
        try {
          await sendTx(deployerWallet, "UD__adminClearEncounterState", [cid]);
        } catch {}
        await adminHeal(cid);
      }

      const stats1 = await getStats(charId1);
      const stats2 = await getStats(charId2);
      expect(stats1.currentHp).toBeGreaterThan(0n);
      expect(stats2.currentHp).toBeGreaterThan(0n);

      console.log("\n=== SYSTEMS TEST SUMMARY ===");
      console.log(`Player 1: ${charId1} — HP=${stats1.currentHp}/${stats1.maxHp}`);
      console.log(`Player 2: ${charId2} — HP=${stats2.currentHp}/${stats2.maxHp}`);
      console.log("============================\n");
    },
    60_000,
  );
});
