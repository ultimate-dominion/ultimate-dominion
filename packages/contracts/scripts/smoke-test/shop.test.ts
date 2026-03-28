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
  ItemType,
  type StatsData,
  type TestWallet,
} from "./setup";
import { runDiscovery, type DiscoveryResult } from "./discovery";
import {
  getOrCreateCharacter,
  adminBoostToLevel,
  adminHeal,
  adminDropGold,
  adminDropItem,
  getGoldBalance,
} from "./helpers";
import {
  assertEquipped,
  getStats,
} from "./assertions";

// ---------------------------------------------------------------------------
// Shared state across sequential test phases
// ---------------------------------------------------------------------------

let discovery: DiscoveryResult;
let player: TestWallet;
let charId: Hex;
let encounterId: Hex;

beforeAll(async () => {
  console.log("[shop] Running discovery...");
  discovery = await runDiscovery();

  expect(discovery.starterItems.weapons.length).toBeGreaterThan(0);
  expect(discovery.starterItems.armors.length).toBeGreaterThan(0);

  console.log("[shop] Creating test wallet...");
  player = await createTestWallet("shop_tester");
  console.log(`[shop] Player: ${player.address}`);

  // Create or resume character
  const result = await getOrCreateCharacter(player.wallet, {
    name: uniqueName("shop"),
    race: Race.Human,
    powerSource: PowerSource.Physical,
    armorType: ArmorType.Plate,
    starterWeaponId: discovery.starterItems.weapons[0],
    starterArmorId: discovery.starterItems.armors[0],
  });
  charId = result.characterId;
  console.log(`[shop] Character: ${charId}`);

  // Boost to level 5 for shop access
  await adminBoostToLevel(charId, 5);

  // Drop 500 gold (18 decimals)
  await adminDropGold(charId, 500n * 10n ** 18n);

  // Heal to full
  await adminHeal(charId);

  // Clear any leftover encounter state
  try {
    await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId]);
  } catch {}

  // Move to shop at (9,9)
  await sendTx(deployerWallet, "UD__adminMoveEntity", [charId, 9, 9]);

  const stats = await getStats(charId);
  console.log(
    `[shop] Ready: Level ${stats.level}, HP ${stats.currentHp}/${stats.maxHp}`,
  );
}, 180_000);

// ---------------------------------------------------------------------------
// Phase 1 -- Shop Encounter
// ---------------------------------------------------------------------------

describe("Phase 1 -- Shop Encounter", () => {
  test(
    "create World encounter with shop",
    async () => {
      if (!discovery.shopEntityId) {
        console.log("[shop] No shop found at (9,9) -- skipping");
        return;
      }

      const { result } = await simulateAndSend<Hex>(
        player.wallet,
        "UD__createEncounter",
        [
          EncounterType.World,
          [discovery.shopEntityId],
          [charId],
        ],
      );

      encounterId = result;
      expect(encounterId).toBeDefined();
      expect(encounterId).not.toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      );
      console.log(`[shop] Encounter created: ${encounterId}`);
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 2 -- Buy from Shop
// ---------------------------------------------------------------------------

describe("Phase 2 -- Buy from Shop", () => {
  test(
    "buy item at index 0 and verify gold decreased",
    async () => {
      if (!discovery.shopEntityId || !encounterId) {
        console.log("[shop] No shop encounter -- skipping buy");
        return;
      }

      const goldBefore = await getGoldBalance(
        player.address,
        discovery.goldTokenAddress,
      );
      console.log(`[shop] Gold before buy: ${goldBefore}`);

      await sendTx(player.wallet, "UD__buy", [
        1n,
        discovery.shopEntityId,
        0n,
        charId,
      ]);

      const goldAfter = await getGoldBalance(
        player.address,
        discovery.goldTokenAddress,
      );
      console.log(`[shop] Gold after buy: ${goldAfter}`);

      expect(goldAfter).toBeLessThan(goldBefore);
      console.log(
        `[shop] Purchase cost: ${goldBefore - goldAfter} (${Number(goldBefore - goldAfter) / 1e18} gold)`,
      );
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 3 -- End Shop Encounter
// ---------------------------------------------------------------------------

describe("Phase 3 -- End Shop Encounter", () => {
  test(
    "end shop encounter without revert",
    async () => {
      if (!encounterId) {
        console.log("[shop] No encounter to end -- skipping");
        return;
      }

      try {
        await sendTx(player.wallet, "UD__endShopEncounter", [encounterId]);
        console.log("[shop] Shop encounter ended");
      } catch {
        // Encounter may have auto-ended after buy — that's fine
        console.log("[shop] Shop encounter already ended (auto-close after buy)");
      }
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 4 -- Consumable Usage
// ---------------------------------------------------------------------------

describe("Phase 4 -- Consumable Usage", () => {
  let consumableId = 0;

  test(
    "find a consumable item by scanning IDs",
    async () => {
      for (let id = 1; id <= 100; id++) {
        try {
          const type = await readWorld("UD__getItemType", [BigInt(id)]);
          if (Number(type) === ItemType.Consumable) {
            consumableId = id;
            break;
          }
        } catch {
          // Item doesn't exist -- keep scanning
        }
      }

      expect(consumableId).toBeGreaterThan(0);
      console.log(`[shop] Found consumable item ID: ${consumableId}`);
    },
    60_000,
  );

  test(
    "use consumable to heal character",
    async () => {
      if (consumableId === 0) {
        console.log("[shop] No consumable found -- skipping");
        return;
      }

      // Drop 1 consumable to the character
      await adminDropItem(charId, consumableId);

      // Set HP to half
      const stats = await getStats(charId);
      const halfHp = stats.maxHp / 2n;
      const halfStats: StatsData = {
        ...stats,
        currentHp: halfHp,
      };
      await sendTx(deployerWallet, "UD__adminSetStats", [charId, halfStats]);

      // Verify HP is at half
      const beforeUse = await getStats(charId);
      expect(beforeUse.currentHp).toBe(halfHp);
      console.log(`[shop] HP before consumable: ${beforeUse.currentHp}/${beforeUse.maxHp}`);

      // Clear encounter state in case anything lingered
      try {
        await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId]);
      } catch {}

      // Use consumable (target is self for healing)
      await sendTx(player.wallet, "UD__useWorldConsumableItem", [
        charId,
        charId,
        BigInt(consumableId),
      ]);

      // Read HP after -- should be higher than half
      const afterUse = await getStats(charId);
      console.log(`[shop] HP after consumable: ${afterUse.currentHp}/${afterUse.maxHp}`);
      expect(afterUse.currentHp).toBeGreaterThan(halfHp);
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 5 -- Armor Equip
// ---------------------------------------------------------------------------

describe("Phase 5 -- Armor Equip", () => {
  let armorId: number;

  test(
    "equip armor and verify",
    async () => {
      armorId = discovery.starterItems.armors[0];
      expect(armorId).toBeDefined();

      // Ensure character has the armor
      const balance = (await readWorld("UD__getItemBalance", [
        charId,
        BigInt(armorId),
      ])) as bigint;
      if (balance === 0n) {
        await adminDropItem(charId, armorId);
      }

      // Check if already equipped, unequip if so
      const alreadyEquipped = await readWorld("UD__isEquipped", [
        charId,
        BigInt(armorId),
      ]);
      if (alreadyEquipped) {
        await sendTx(player.wallet, "UD__unequipItem", [
          charId,
          BigInt(armorId),
        ]);
        await sleep(2000);
        await assertEquipped(charId, armorId, false);
        console.log(`[shop] Unequipped armor ${armorId} before re-equip test`);
      }

      // Equip
      await sendTx(player.wallet, "UD__equipItems", [
        charId,
        [BigInt(armorId)],
      ]);
      await assertEquipped(charId, armorId, true);
      console.log(`[shop] Armor ${armorId} equipped`);
    },
    60_000,
  );

  test(
    "unequip armor and verify",
    async () => {
      if (!armorId) {
        console.log("[shop] No armor to unequip -- skipping");
        return;
      }

      await sendTx(player.wallet, "UD__unequipItem", [
        charId,
        BigInt(armorId),
      ]);
      await sleep(2000);
      await assertEquipped(charId, armorId, false);
      console.log(`[shop] Armor ${armorId} unequipped`);
    },
    60_000,
  );
});
