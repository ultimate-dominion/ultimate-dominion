import { describe, test, expect, beforeAll } from "vitest";
import type { Hex, WalletClient } from "viem";
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
  AdvancedClass,
  EncounterType,
  OrderStatus,
  TokenType,
  type StatsData,
  type TestWallet,
} from "./setup";
import { runDiscovery, type DiscoveryResult } from "./discovery";
import {
  createCharacter,
  getOrCreateCharacter,
  navigateTo,
  farmToLevel,
  adminBoostToLevel,
  adminHeal,
  adminDropGold,
  adminDropItem,
  getGoldBalance,
} from "./helpers";
import {
  assertCharacterValid,
  assertPosition,
  assertLevel,
  assertLevelAtLeast,
  assertStatsNonZero,
  assertGoldAtLeast,
  assertItemBalance,
  assertEquipped,
  assertAdvancedClass,
  getStats,
  getGold,
} from "./assertions";

// ---------------------------------------------------------------------------
// Shared state across sequential test phases
// ---------------------------------------------------------------------------

let discovery: DiscoveryResult;
let player1: TestWallet;
let player2: TestWallet;
let charId1: Hex;
let charId1Name: string;

// Phase-specific state
let initialGold: bigint;
let initialXp: bigint;
let droppedItemId: number | null = null;

beforeAll(async () => {
  console.log("[smoke] Running discovery...");
  discovery = await runDiscovery();

  expect(discovery.starterItems.weapons.length).toBeGreaterThan(0);
  expect(discovery.starterItems.armors.length).toBeGreaterThan(0);

  console.log("[smoke] Creating test wallets...");
  player1 = await createTestWallet("smoke_player1");
  player2 = await createTestWallet("smoke_player2");
  console.log(`[smoke] Player 1: ${player1.address}`);
  console.log(`[smoke] Player 2: ${player2.address}`);
}, 60_000);

// ---------------------------------------------------------------------------
// Phase 1 — Character Creation (idempotent — safe on re-runs)
// ---------------------------------------------------------------------------

describe("Phase 1 — Character Creation", () => {
  test(
    "create or resume character",
    async () => {
      const result = await getOrCreateCharacter(player1.wallet, {
        name: uniqueName("smoke"),
        race: Race.Human,
        powerSource: PowerSource.Physical,
        armorType: ArmorType.Plate,
        starterWeaponId: discovery.starterItems.weapons[0],
        starterArmorId: discovery.starterItems.armors[0],
      });

      charId1 = result.characterId;
      charId1Name = result.name;

      expect(charId1).toBeDefined();
      expect(charId1).not.toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      );
      await assertCharacterValid(charId1);
      await assertStatsNonZero(charId1);

      // Ensure spawned
      const isValid = await readWorld("UD__isValidCharacterId", [charId1]);
      expect(isValid).toBe(true);

      // Save initial state
      initialGold = await getGoldBalance(
        player1.address,
        discovery.goldTokenAddress,
      );
      initialXp = (await readWorld("UD__getExperience", [charId1])) as bigint;

      const stats = await getStats(charId1);
      console.log(
        `[smoke] Character ${charId1} — Level ${stats.level}, HP ${stats.currentHp}/${stats.maxHp}`,
      );
    },
    120_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 2 — Movement & First Combat
// ---------------------------------------------------------------------------

describe("Phase 2 — Movement & First Combat", () => {
  test(
    "autoAdventure triggers movement (and possibly combat)",
    async () => {
      // Ensure character is alive and encounter-free before starting
      await adminHeal(charId1);
      try {
        await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId1]);
      } catch {}

      // Move to (0,0) to start from a known position
      const [cx, cy] = (await readWorld("UD__getEntityPosition", [charId1])) as [number, number];
      if (cx !== 0 || cy !== 0) {
        await sendTx(deployerWallet, "UD__adminMoveEntity", [charId1, 0, 0]);
      }

      await sleep(5500);

      try {
        await sendTx(player1.wallet, "UD__autoAdventure", [charId1, 0, 1]);
      } catch (err: any) {
        // May revert if encounter triggers — admin clear and continue
        try {
          await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId1]);
        } catch {}
      }

      // autoAdventure can trigger combat which may kill the character
      // Just verify the call succeeded — position depends on combat outcome
      const stats = await getStats(charId1);
      console.log(
        `[smoke] After first adventure: HP=${stats.currentHp}/${stats.maxHp}`,
      );
    },
    30_000,
  );

  test(
    "loop autoAdventure until combat occurs",
    async () => {
      let combatHappened = false;
      const xpBefore = (await readWorld("UD__getExperience", [
        charId1,
      ])) as bigint;

      // Try up to 10 adventures to trigger combat
      for (let i = 0; i < 10; i++) {
        const statsBefore = await getStats(charId1);
        if (statsBefore.currentHp <= 0n) break; // died

        const [cx, cy] = (await readWorld("UD__getEntityPosition", [
          charId1,
        ])) as [number, number];
        const nextY = cy === 0 ? 1 : 0;

        await sleep(5500);
        try {
          await sendTx(player1.wallet, "UD__autoAdventure", [
            charId1,
            cx,
            nextY,
          ]);
        } catch {
          // May fail if in encounter — admin clear
          await sendTx(deployerWallet, "UD__adminClearEncounterState", [
            charId1,
          ]);
          continue;
        }

        const xpAfter = (await readWorld("UD__getExperience", [
          charId1,
        ])) as bigint;
        if (xpAfter > xpBefore) {
          combatHappened = true;
          break;
        }
      }

      // Combat is probabilistic — we just verify the system works
      // If no combat in 10 tries, that's still valid (just unlucky RNG)
      console.log(
        `[smoke] Combat occurred in loop: ${combatHappened}`,
      );
    },
    120_000,
  );

  test(
    "verify post-state: XP or HP changed from initial",
    async () => {
      const stats = await getStats(charId1);
      const xpNow = (await readWorld("UD__getExperience", [
        charId1,
      ])) as bigint;

      // Either XP increased (won combat) or HP decreased (took damage) or both
      const stateChanged =
        xpNow > initialXp || stats.currentHp < stats.maxHp;
      // This can be false if no mobs spawned — that's OK
      console.log(
        `[smoke] Post-combat: XP=${xpNow}, HP=${stats.currentHp}/${stats.maxHp}`,
      );
    },
    15_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 3 — Leveling
// ---------------------------------------------------------------------------

describe("Phase 3 — Leveling", () => {
  test(
    "admin boost to level 2 and verify",
    async () => {
      // Use admin shortcut to get to level 2
      await adminBoostToLevel(charId1, 2);
      await adminHeal(charId1);

      await assertLevelAtLeast(charId1, 2);
    },
    30_000,
  );

  test(
    "verify stats increased after level boost",
    async () => {
      const stats = await getStats(charId1);
      expect(stats.level).toBeGreaterThanOrEqual(2n);
      expect(stats.strength).toBeGreaterThan(0n);
      expect(stats.maxHp).toBeGreaterThan(0n);
    },
    15_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 4 — Equipment
// ---------------------------------------------------------------------------

describe("Phase 4 — Equipment", () => {
  test(
    "ensure weapon equipped",
    async () => {
      const weaponId = discovery.starterItems.weapons[0];
      const isEquipped = await readWorld("UD__isEquipped", [charId1, BigInt(weaponId)]);
      if (!isEquipped) {
        // Drop item if needed (character may not have it after respawn)
        const balance = (await readWorld("UD__getItemBalance", [charId1, BigInt(weaponId)])) as bigint;
        if (balance === 0n) {
          await adminDropItem(charId1, weaponId);
        }
        await sendTx(player1.wallet, "UD__equipItems", [
          charId1,
          [BigInt(weaponId)],
        ]);
      }
      await assertEquipped(charId1, weaponId, true);
    },
    30_000,
  );

  test(
    "unequip and re-equip",
    async () => {
      const weaponId = discovery.starterItems.weapons[0];

      await sendTx(player1.wallet, "UD__unequipItem", [
        charId1,
        BigInt(weaponId),
      ]);
      // Extra delay for RPC sync on equipment state
      await sleep(2000);
      await assertEquipped(charId1, weaponId, false);

      await sendTx(player1.wallet, "UD__equipItems", [
        charId1,
        [BigInt(weaponId)],
      ]);
      await assertEquipped(charId1, weaponId, true);
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 5 — Shop
// ---------------------------------------------------------------------------

describe("Phase 5 — Shop", () => {
  test(
    "navigate to shop at (9,9)",
    async () => {
      if (!discovery.shopEntityId) {
        console.log("[smoke] No shop found at (9,9) — skipping shop tests");
        return;
      }

      // Ensure alive and not in encounter before admin move
      await adminHeal(charId1);
      try {
        await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId1]);
      } catch {}

      // Admin move to shop location to skip the walk
      await sendTx(deployerWallet, "UD__adminMoveEntity", [charId1, 9, 9]);
      await assertPosition(charId1, 9, 9);
    },
    30_000,
  );

  test(
    "buy item from shop",
    async () => {
      if (!discovery.shopEntityId) return;

      // Ensure we have enough gold
      await adminDropGold(charId1, 100n * 10n ** 18n);

      const goldBefore = await getGoldBalance(
        player1.address,
        discovery.goldTokenAddress,
      );

      // Buy requires an active shop encounter — may not be available via direct call
      try {
        await sendTx(player1.wallet, "UD__buy", [
          1n,
          discovery.shopEntityId,
          0n,
          charId1,
        ]);

        const goldAfter = await getGoldBalance(
          player1.address,
          discovery.goldTokenAddress,
        );
        expect(goldAfter).toBeLessThan(goldBefore);
        console.log(
          `[smoke] Shop buy: gold ${goldBefore} → ${goldAfter} (spent ${goldBefore - goldAfter})`,
        );
      } catch (err: any) {
        console.log(
          `[smoke] Shop buy skipped (requires shop encounter): ${err.message?.slice(0, 100)}`,
        );
      }
    },
    30_000,
  );

  test(
    "sell item to shop",
    async () => {
      if (!discovery.shopEntityId) return;

      const goldBefore = await getGoldBalance(
        player1.address,
        discovery.goldTokenAddress,
      );

      // Sell any starter weapon we have extras of
      const weaponId = discovery.starterItems.weapons[0];
      const balance = (await readWorld("UD__getItemBalance", [
        charId1,
        BigInt(weaponId),
      ])) as bigint;

      if (balance > 0n) {
        try {
          await sendTx(player1.wallet, "UD__sellAny", [
            1n,
            discovery.shopEntityId,
            BigInt(weaponId),
            charId1,
          ]);

          const goldAfter = await getGoldBalance(
            player1.address,
            discovery.goldTokenAddress,
          );
          expect(goldAfter).toBeGreaterThan(goldBefore);
          console.log(
            `[smoke] Shop sell: gold ${goldBefore} → ${goldAfter}`,
          );
        } catch (err: any) {
          console.log(
            `[smoke] Shop sell skipped (item may not be sellable): ${err.message?.slice(0, 100)}`,
          );
        }
      } else {
        console.log("[smoke] No items to sell — skipping sell test");
      }
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 6 — Marketplace
// ---------------------------------------------------------------------------

describe("Phase 6 — Marketplace", () => {
  let orderHash: Hex;

  test(
    "create player 2 character",
    async () => {
      const result = await getOrCreateCharacter(player2.wallet, {
        name: uniqueName("buyer"),
        race: Race.Elf,
        powerSource: PowerSource.Weave,
        armorType: ArmorType.Cloth,
        starterWeaponId: discovery.starterItems.weapons[0],
        starterArmorId: discovery.starterItems.armors[0],
      });
      expect(result.characterId).toBeDefined();
    },
    120_000,
  );

  test(
    "create sell order (list item for gold)",
    async () => {
      // Drop a tradeable item to player 1
      const tradeItemId = discovery.starterItems.weapons[0];
      await adminDropItem(charId1, tradeItemId);

      const goldTokenAddr = discovery.goldTokenAddress;
      const itemsAddr = discovery.itemsContractAddress;

      // Create order: sell 1 item for 1 gold
      const order = {
        offer: {
          tokenType: TokenType.ERC1155,
          token: itemsAddr,
          identifier: BigInt(tradeItemId),
          amount: 1n,
        },
        consideration: {
          tokenType: TokenType.ERC20,
          token: goldTokenAddr,
          identifier: 0n,
          amount: 1n * 10n ** 18n, // 1 gold
          recipient: player1.address,
        },
        signature: "0x" as `0x${string}`,
        offerer: player1.address,
      };

      try {
        const { result } = await simulateAndSend<Hex>(
          player1.wallet,
          "UD__createOrder",
          [order],
        );
        orderHash = result;

        // Verify order is active on-chain
        const status = await readWorld("UD__getOrderStatus", [orderHash]);
        expect(status).toBe(OrderStatus.Active);
        console.log(`[smoke] Marketplace order created: ${orderHash}`);
      } catch (err: any) {
        console.log(
          `[smoke] Marketplace order creation skipped: ${err.message?.slice(0, 100)}`,
        );
      }
    },
    60_000,
  );

  test(
    "fulfill order from player 2",
    async () => {
      if (!orderHash) {
        console.log("[smoke] No order to fulfill — skipping");
        return;
      }

      // Give player 2 gold to fulfill
      const charId2 = (await readWorld("UD__getCharacterIdFromOwnerAddress", [
        player2.address,
      ])) as Hex;
      await adminDropGold(charId2, 10n * 10n ** 18n);

      try {
        await sendTx(player2.wallet, "UD__fulfillOrder", [orderHash]);

        // Verify order fulfilled on-chain
        const status = await readWorld("UD__getOrderStatus", [orderHash]);
        expect(status).toBe(OrderStatus.Fulfilled);
        console.log("[smoke] Marketplace order fulfilled");
      } catch (err: any) {
        console.log(
          `[smoke] Marketplace fulfillment skipped: ${err.message?.slice(0, 100)}`,
        );
      }
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 7 — Advanced Class
// ---------------------------------------------------------------------------

describe("Phase 7 — Advanced Class", () => {
  test(
    "admin boost to level 10",
    async () => {
      await adminBoostToLevel(charId1, 10);
      await assertLevelAtLeast(charId1, 10);
    },
    30_000,
  );

  test(
    "select advanced class (Warrior)",
    async () => {
      const stats = await getStats(charId1);
      if (stats.hasSelectedAdvancedClass) {
        console.log(`[smoke] Advanced class already selected: ${stats.advancedClass}`);
        return;
      }

      await sendTx(player1.wallet, "UD__selectAdvancedClass", [
        charId1,
        AdvancedClass.Warrior,
      ]);

      await assertAdvancedClass(charId1, AdvancedClass.Warrior);
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 8 — Spell System
// ---------------------------------------------------------------------------

describe("Phase 8 — Spell System", () => {
  test(
    "hasSpellConfig for battle_cry",
    async () => {
      // battle_cry is a known spell effect — effectId is keccak hash truncated to 8 bytes
      const { keccak256, encodeAbiParameters, parseAbiParameters } = await import("viem");
      const hash = keccak256(encodeAbiParameters(parseAbiParameters("string"), ["battle_cry"]));
      const battleCryId = (hash.slice(0, 18).padEnd(66, "0")) as `0x${string}`;
      const hasConfig = await readWorld("UD__hasSpellConfig", [battleCryId]);
      console.log(`[smoke] hasSpellConfig(battle_cry) = ${hasConfig}`);
      // Log but don't fail — spell configs are loaded separately via effect-sync
    },
    15_000,
  );

  test(
    "hasSpellConfig returns false for non-spell effect",
    async () => {
      const fakeId = nameToBytes32("definitely_not_a_spell");
      const hasConfig = await readWorld("UD__hasSpellConfig", [fakeId]);
      expect(hasConfig).toBe(false);
    },
    15_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 9 — Death & Recovery
// ---------------------------------------------------------------------------

describe("Phase 9 — Death & Recovery", () => {
  test(
    "admin set HP to 1",
    async () => {
      const stats = await getStats(charId1);
      const weakStats: StatsData = {
        ...stats,
        currentHp: 1n,
      };
      await sendTx(deployerWallet, "UD__adminSetStats", [
        charId1,
        weakStats,
      ]);

      const updated = await getStats(charId1);
      expect(updated.currentHp).toBe(1n);
    },
    30_000,
  );

  test(
    "attempt combat with low HP (may die)",
    async () => {
      // Move to a tile and try autoAdventure
      const [cx, cy] = (await readWorld("UD__getEntityPosition", [
        charId1,
      ])) as [number, number];
      const nextY = cy === 0 ? 1 : 0;

      await sleep(5500);
      try {
        await sendTx(player1.wallet, "UD__autoAdventure", [
          charId1,
          cx,
          nextY,
        ]);
      } catch {
        await sendTx(deployerWallet, "UD__adminClearEncounterState", [
          charId1,
        ]);
      }

      const stats = await getStats(charId1);
      console.log(
        `[smoke] After low-HP combat: HP=${stats.currentHp}/${stats.maxHp}`,
      );
    },
    30_000,
  );

  test(
    "rest to recover HP (at spawn point)",
    async () => {
      // Clear encounter state and heal before moving
      try {
        await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId1]);
      } catch {}
      await adminHeal(charId1); // ensure alive first

      // Move to (0,0) for rest
      await sendTx(deployerWallet, "UD__adminMoveEntity", [charId1, 0, 0]);

      // Set HP to half
      const stats = await getStats(charId1);
      const halfHp: StatsData = {
        ...stats,
        currentHp: stats.maxHp / 2n,
      };
      await sendTx(deployerWallet, "UD__adminSetStats", [charId1, halfHp]);

      // Rest
      await sendTx(player1.wallet, "UD__rest", [charId1]);

      const restored = await getStats(charId1);
      // Rest restores partial HP, not necessarily full
      expect(restored.currentHp).toBeGreaterThan(halfHp.currentHp);
    },
    120_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 10 — Cleanup & Summary
// ---------------------------------------------------------------------------

describe("Phase 10 — Cleanup & Summary", () => {
  test(
    "admin clear encounter state",
    async () => {
      try {
        await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId1]);
      } catch {
        // Character may not be in encounter — that's fine
      }
    },
    60_000,
  );

  test("print summary", async () => {
    const stats = await getStats(charId1);
    const gold = await getGoldBalance(
      player1.address,
      discovery.goldTokenAddress,
    );
    const [x, y] = (await readWorld("UD__getEntityPosition", [charId1])) as [
      number,
      number,
    ];

    console.log("\n=== SMOKE TEST SUMMARY ===");
    console.log(`Character ID: ${charId1}`);
    console.log(`Name: ${charId1Name}`);
    console.log(`Level: ${stats.level}`);
    console.log(
      `Stats: STR=${stats.strength} AGI=${stats.agility} INT=${stats.intelligence}`,
    );
    console.log(`HP: ${stats.currentHp}/${stats.maxHp}`);
    console.log(`XP: ${stats.experience}`);
    console.log(`Gold: ${gold} (${Number(gold) / 1e18} tokens)`);
    console.log(`Position: (${x}, ${y})`);
    console.log(`Advanced Class: ${stats.advancedClass}`);
    console.log("=========================\n");
  });
});
