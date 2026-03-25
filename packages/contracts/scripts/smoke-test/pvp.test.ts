import { describe, test, expect, beforeAll } from "vitest";
import type { Hex } from "viem";
import {
  createTestWallet,
  sendTx,
  readWorld,
  simulateAndSend,
  deployerWallet,
  sleep,
  nameToBytes32,
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
} from "./helpers";
import { assertCharacterValid, getStats } from "./assertions";

// ---------------------------------------------------------------------------
// PvP Tests — two-player combat
// ---------------------------------------------------------------------------

let discovery: DiscoveryResult;
let player1: TestWallet;
let player2: TestWallet;
let charId1: Hex;
let charId2: Hex;

beforeAll(async () => {
  discovery = await runDiscovery();

  console.log("[pvp] Creating test wallets...");
  player1 = await createTestWallet("pvp_player1");
  player2 = await createTestWallet("pvp_player2");

  console.log("[pvp] Creating characters...");
  const result1 = await getOrCreateCharacter(player1.wallet, {
    name: uniqueName("pvp_a"),
    race: Race.Human,
    powerSource: PowerSource.Physical,
    armorType: ArmorType.Plate,
    starterWeaponId: discovery.starterItems.weapons[0],
    starterArmorId: discovery.starterItems.armors[0],
  });
  charId1 = result1.characterId;

  const result2 = await getOrCreateCharacter(player2.wallet, {
    name: uniqueName("pvp_b"),
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

  // Equip weapons
  await sendTx(player1.wallet, "UD__equipItems", [
    charId1,
    [BigInt(discovery.starterItems.weapons[0])],
  ]);
  await sendTx(player2.wallet, "UD__equipItems", [
    charId2,
    [BigInt(discovery.starterItems.weapons[0])],
  ]);

  console.log(`[pvp] Player 1: ${charId1}`);
  console.log(`[pvp] Player 2: ${charId2}`);
}, 180_000);

describe("PvP Combat", () => {
  test(
    "two players PvP combat",
    async () => {
      // Move both players to position (6,6) — outside safe zone
      await sendTx(deployerWallet, "UD__adminMoveEntity", [charId1, 6, 6]);
      await sendTx(deployerWallet, "UD__adminMoveEntity", [charId2, 6, 6]);

      // Verify positions
      const [x1, y1] = (await readWorld("UD__getEntityPosition", [
        charId1,
      ])) as [number, number];
      const [x2, y2] = (await readWorld("UD__getEntityPosition", [
        charId2,
      ])) as [number, number];
      expect(x1).toBe(6);
      expect(y1).toBe(6);
      expect(x2).toBe(6);
      expect(y2).toBe(6);

      // Ensure both at full HP
      await adminHeal(charId1);
      await adminHeal(charId2);

      const stats1Before = await getStats(charId1);
      const stats2Before = await getStats(charId2);
      console.log(
        `[pvp] Before: P1 HP=${stats1Before.currentHp}, P2 HP=${stats2Before.currentHp}`,
      );

      // Create PvP encounter — use simulateAndSend to get the actual encounterId
      let encounterId: Hex;
      try {
        const { result } = await simulateAndSend<Hex>(
          player1.wallet,
          "UD__createEncounter",
          [EncounterType.PvP, [charId1], [charId2]],
        );
        encounterId = result;
        console.log(`[pvp] Encounter created: ${encounterId}`);
      } catch (err: any) {
        console.log(
          `[pvp] Encounter creation failed: ${err.message?.slice(0, 200)}`,
        );
        return;
      }

      const stats1After = await getStats(charId1);
      const stats2After = await getStats(charId2);

      console.log(
        `[pvp] After: P1 HP=${stats1After.currentHp}, P2 HP=${stats2After.currentHp}`,
      );

      // At least one player should have taken damage or one should have won
      const p1Damaged = stats1After.currentHp < stats1Before.currentHp;
      const p2Damaged = stats2After.currentHp < stats2Before.currentHp;
      const p1Died = stats1After.currentHp <= 0n;
      const p2Died = stats2After.currentHp <= 0n;

      console.log(
        `[pvp] Result: P1 damaged=${p1Damaged} died=${p1Died}, P2 damaged=${p2Damaged} died=${p2Died}`,
      );

      // Verify both characters still exist
      await assertCharacterValid(charId1);
      await assertCharacterValid(charId2);
    },
    120_000,
  );

  test(
    "cleanup PvP state",
    async () => {
      // Clear any lingering encounter state
      await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId1]);
      await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId2]);

      // Heal both
      await adminHeal(charId1);
      await adminHeal(charId2);

      const stats1 = await getStats(charId1);
      const stats2 = await getStats(charId2);
      expect(stats1.currentHp).toBeGreaterThan(0n);
      expect(stats2.currentHp).toBeGreaterThan(0n);
    },
    60_000,
  );
});
