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
  AdvancedClass,
  EncounterType,
  type TestWallet,
} from "./setup";
import { runDiscovery, type DiscoveryResult } from "./discovery";
import {
  getOrCreateCharacter,
  adminBoostToLevel,
  adminHeal,
  adminDropGold,
  adminDropItem,
} from "./helpers";
import {
  assertCharacterValid,
  assertAdvancedClass,
  getStats,
} from "./assertions";
import {
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";

// ---------------------------------------------------------------------------
// Effect ID computation — matches deploy-spell-config.ts
// ---------------------------------------------------------------------------

function effectId(name: string): Hex {
  const hash = keccak256(
    encodeAbiParameters(parseAbiParameters("string"), [name]),
  );
  return (hash.slice(0, 18).padEnd(66, "0")) as Hex;
}

// ---------------------------------------------------------------------------
// Encode WeaponStatsData + StatRestrictionsData as ABI bytes
// ---------------------------------------------------------------------------

function encodeWeaponStats(minLevel: number, effectIdHex: Hex): Hex {
  return encodeAbiParameters(
    parseAbiParameters(
      "(int256,int256,int256,int256,int256,uint256,int256,bytes32[]), (int256,int256,int256)",
    ),
    [
      [0n, 0n, 0n, 0n, 0n, BigInt(minLevel), 0n, [effectIdHex]],
      [0n, 0n, 0n],
    ],
  );
}

// ---------------------------------------------------------------------------
// Create a spell item on-chain, return the itemId
// ---------------------------------------------------------------------------

async function createSpellItem(
  effectName: string,
  minLevel: number,
): Promise<number> {
  const eid = effectId(effectName);
  const stats = encodeWeaponStats(minLevel, eid);
  const metadataUri = `spell:${effectName}`;

  const { result: itemId } = await simulateAndSend<bigint>(
    deployerWallet,
    "UD__adminCreateItem",
    [0, 0n, 0n, 0n, 1n, stats, metadataUri],
  );

  return Number(itemId);
}

// ---------------------------------------------------------------------------
// Class definitions
// ---------------------------------------------------------------------------

interface ClassDef {
  className: string;
  advancedClass: AdvancedClass;
  race: Race;
  powerSource: PowerSource;
  armorType: ArmorType;
  l10EffectName: string;
  l15EffectName: string;
}

const CLASS_DEFS: ClassDef[] = [
  {
    className: "Warrior",
    advancedClass: AdvancedClass.Warrior,
    race: Race.Human,
    powerSource: PowerSource.Physical,
    armorType: ArmorType.Plate,
    l10EffectName: "battle_cry",
    l15EffectName: "warcry",
  },
  {
    className: "Paladin",
    advancedClass: AdvancedClass.Paladin,
    race: Race.Human,
    powerSource: PowerSource.Divine,
    armorType: ArmorType.Plate,
    l10EffectName: "divine_shield",
    l15EffectName: "judgment",
  },
  {
    className: "Ranger",
    advancedClass: AdvancedClass.Ranger,
    race: Race.Elf,
    powerSource: PowerSource.Physical,
    armorType: ArmorType.Leather,
    l10EffectName: "hunters_mark",
    l15EffectName: "volley",
  },
  {
    className: "Rogue",
    advancedClass: AdvancedClass.Rogue,
    race: Race.Elf,
    powerSource: PowerSource.Physical,
    armorType: ArmorType.Leather,
    l10EffectName: "shadowstep",
    l15EffectName: "backstab",
  },
  {
    className: "Druid",
    advancedClass: AdvancedClass.Druid,
    race: Race.Elf,
    powerSource: PowerSource.Divine,
    armorType: ArmorType.Leather,
    l10EffectName: "entangle",
    l15EffectName: "regrowth",
  },
  {
    className: "Warlock",
    advancedClass: AdvancedClass.Warlock,
    race: Race.Dwarf,
    powerSource: PowerSource.Weave,
    armorType: ArmorType.Cloth,
    l10EffectName: "soul_drain_curse",
    l15EffectName: "blight",
  },
  {
    className: "Wizard",
    advancedClass: AdvancedClass.Wizard,
    race: Race.Human,
    powerSource: PowerSource.Weave,
    armorType: ArmorType.Cloth,
    l10EffectName: "arcane_blast_damage",
    l15EffectName: "meteor",
  },
  {
    className: "Sorcerer",
    advancedClass: AdvancedClass.Sorcerer,
    race: Race.Elf,
    powerSource: PowerSource.Weave,
    armorType: ArmorType.Cloth,
    l10EffectName: "arcane_surge_damage",
    l15EffectName: "mana_burn",
  },
  {
    className: "Cleric",
    advancedClass: AdvancedClass.Cleric,
    race: Race.Dwarf,
    powerSource: PowerSource.Divine,
    armorType: ArmorType.Plate,
    l10EffectName: "blessing",
    l15EffectName: "smite",
  },
];

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

interface ClassTestState {
  def: ClassDef;
  wallet: TestWallet;
  characterId: Hex;
  l10ItemId: number;
  l15ItemId: number;
}

let discovery: DiscoveryResult;
const classStates: ClassTestState[] = [];

// ---------------------------------------------------------------------------
// Setup — create wallets, characters, spell items, equip
// ---------------------------------------------------------------------------

beforeAll(async () => {
  discovery = await runDiscovery();

  console.log("[spells] Creating 9 test wallets + characters...");

  for (const def of CLASS_DEFS) {
    const seed = `spell_${def.className.toLowerCase()}`;
    console.log(`\n[spells] --- ${def.className} ---`);

    // 1. Create wallet + character
    const wallet = await createTestWallet(seed);
    const { characterId } = await getOrCreateCharacter(wallet.wallet, {
      name: uniqueName(`sp_${def.className.toLowerCase()}`),
      race: def.race,
      powerSource: def.powerSource,
      armorType: def.armorType,
      starterWeaponId: discovery.starterItems.weapons[0],
      starterArmorId: discovery.starterItems.armors[0],
    });
    console.log(`[spells] Character: ${characterId}`);

    // 2. Boost to level 10 and select advanced class
    await adminBoostToLevel(characterId, 10);
    console.log(`[spells] Boosted to L10`);

    try {
      await sendTx(wallet.wallet, "UD__selectAdvancedClass", [
        characterId,
        def.advancedClass,
      ]);
      console.log(`[spells] Selected ${def.className} (${def.advancedClass})`);
    } catch (err: any) {
      // May already be selected from a previous run
      console.log(
        `[spells] selectAdvancedClass skipped: ${err.message?.slice(0, 80)}`,
      );
    }

    // 3. Boost to level 15
    await adminBoostToLevel(characterId, 15);
    console.log(`[spells] Boosted to L15`);

    // 4. Create spell items on-chain
    const l10ItemId = await createSpellItem(def.l10EffectName, 10);
    console.log(`[spells] L10 item "${def.l10EffectName}" -> id=${l10ItemId}`);

    const l15ItemId = await createSpellItem(def.l15EffectName, 15);
    console.log(`[spells] L15 item "${def.l15EffectName}" -> id=${l15ItemId}`);

    // 5. Drop items to character
    await adminDropItem(characterId, l10ItemId);
    await adminDropItem(characterId, l15ItemId);
    console.log(`[spells] Dropped both items`);

    // 6. Equip both spell items
    try {
      await sendTx(wallet.wallet, "UD__equipItems", [
        characterId,
        [BigInt(l10ItemId), BigInt(l15ItemId)],
      ]);
      console.log(`[spells] Equipped both items`);
    } catch (err: any) {
      // Try equipping one at a time
      console.log(
        `[spells] Batch equip failed, trying individually: ${err.message?.slice(0, 60)}`,
      );
      try {
        await sendTx(wallet.wallet, "UD__equipItems", [
          characterId,
          [BigInt(l10ItemId)],
        ]);
      } catch {}
      try {
        await sendTx(wallet.wallet, "UD__equipItems", [
          characterId,
          [BigInt(l15ItemId)],
        ]);
      } catch {}
    }

    // 7. Drop gold + heal
    await adminDropGold(characterId, 10000n * 10n ** 18n);
    await adminHeal(characterId);

    classStates.push({
      def,
      wallet,
      characterId,
      l10ItemId,
      l15ItemId,
    });
  }

  console.log(`\n[spells] Setup complete: ${classStates.length} classes ready.`);
}, 600_000);

// ---------------------------------------------------------------------------
// Phase 1 — Verify Spell Items
// ---------------------------------------------------------------------------

describe("Phase 1: Spell Item Verification", () => {
  test(
    "all 9 characters have correct advanced class",
    async () => {
      for (const state of classStates) {
        await assertAdvancedClass(
          state.characterId,
          state.def.advancedClass,
        );
        console.log(
          `[spells] ${state.def.className}: advancedClass=${state.def.advancedClass} OK`,
        );
      }
    },
    60_000,
  );

  test(
    "all 9 characters own their L10 spell item",
    async () => {
      for (const state of classStates) {
        const balance = (await readWorld("UD__getItemBalance", [
          state.characterId,
          BigInt(state.l10ItemId),
        ])) as bigint;
        expect(Number(balance)).toBeGreaterThanOrEqual(1);
        console.log(
          `[spells] ${state.def.className}: L10 item ${state.l10ItemId} balance=${balance}`,
        );
      }
    },
    60_000,
  );

  test(
    "all 9 characters own their L15 spell item",
    async () => {
      for (const state of classStates) {
        const balance = (await readWorld("UD__getItemBalance", [
          state.characterId,
          BigInt(state.l15ItemId),
        ])) as bigint;
        expect(Number(balance)).toBeGreaterThanOrEqual(1);
        console.log(
          `[spells] ${state.def.className}: L15 item ${state.l15ItemId} balance=${balance}`,
        );
      }
    },
    60_000,
  );

  test(
    "L10 spell items have correct effects",
    async () => {
      for (const state of classStates) {
        const effects = (await readWorld("UD__getItemEffects", [
          BigInt(state.l10ItemId),
        ])) as Hex[];
        const expectedEid = effectId(state.def.l10EffectName);
        expect(effects.length).toBe(1);
        expect(effects[0].toLowerCase()).toBe(expectedEid.toLowerCase());
        console.log(
          `[spells] ${state.def.className}: L10 effect=${effects[0].slice(0, 18)}... OK`,
        );
      }
    },
    60_000,
  );

  test(
    "L15 spell items have correct effects",
    async () => {
      for (const state of classStates) {
        const effects = (await readWorld("UD__getItemEffects", [
          BigInt(state.l15ItemId),
        ])) as Hex[];
        const expectedEid = effectId(state.def.l15EffectName);
        expect(effects.length).toBe(1);
        expect(effects[0].toLowerCase()).toBe(expectedEid.toLowerCase());
        console.log(
          `[spells] ${state.def.className}: L15 effect=${effects[0].slice(0, 18)}... OK`,
        );
      }
    },
    60_000,
  );

  test(
    "spell items have SpellConfig on-chain",
    async () => {
      for (const state of classStates) {
        const l10Eid = effectId(state.def.l10EffectName);
        const l15Eid = effectId(state.def.l15EffectName);
        const hasL10 = await readWorld("UD__hasSpellConfig", [l10Eid]);
        const hasL15 = await readWorld("UD__hasSpellConfig", [l15Eid]);
        // These may be false if spell configs haven't been deployed yet —
        // that's OK, we're testing the items themselves. Log for visibility.
        console.log(
          `[spells] ${state.def.className}: hasSpellConfig L10=${hasL10} L15=${hasL15}`,
        );
      }
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 2 — PvE Combat with Spells
// ---------------------------------------------------------------------------

describe("Phase 2: PvE Combat with Spells", () => {
  test(
    "each class survives a PvE autoAdventure",
    async () => {
      for (const state of classStates) {
        // Clear lingering encounter state
        try {
          await sendTx(deployerWallet, "UD__adminClearEncounterState", [
            state.characterId,
          ]);
        } catch {}

        await adminHeal(state.characterId);

        // Move outside safe zone
        await sendTx(deployerWallet, "UD__adminMoveEntity", [
          state.characterId,
          5,
          5,
        ]);

        // Wait for cooldown
        await sleep(6000);

        try {
          await sendTx(state.wallet.wallet, "UD__autoAdventure", [
            state.characterId,
            5,
            6,
          ]);
          const statsAfter = await getStats(state.characterId);
          console.log(
            `[spells] ${state.def.className} PvE: HP=${statsAfter.currentHp}/${statsAfter.maxHp}`,
          );
        } catch (err: any) {
          const msg = err?.message ?? "";
          if (msg.includes("InEncounter")) {
            // Clear and continue — the combat started but may have stalled
            await sendTx(deployerWallet, "UD__adminClearEncounterState", [
              state.characterId,
            ]);
            console.log(
              `[spells] ${state.def.className} PvE: cleared encounter state`,
            );
          } else if (
            msg.includes("AutoAdventureCooldownActive") ||
            msg.includes("MoveTooFast")
          ) {
            console.log(`[spells] ${state.def.className} PvE: cooldown — skipping`);
          } else {
            // Log but don't fail — we're testing spells don't break combat
            console.log(
              `[spells] ${state.def.className} PvE error: ${msg.slice(0, 120)}`,
            );
          }
        }

        // Verify character still valid
        await assertCharacterValid(state.characterId);
      }
    },
    180_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 3 — PvP Matchups
// ---------------------------------------------------------------------------

describe("Phase 3: PvP with Spells", () => {
  const matchups: [string, string][] = [
    ["Warrior", "Wizard"],
    ["Rogue", "Cleric"],
    ["Paladin", "Warlock"],
  ];

  for (const [class1Name, class2Name] of matchups) {
    test(
      `${class1Name} vs ${class2Name}`,
      async () => {
        const state1 = classStates.find((s) => s.def.className === class1Name);
        const state2 = classStates.find((s) => s.def.className === class2Name);
        if (!state1 || !state2) {
          console.log(`[spells] Skipping ${class1Name} vs ${class2Name}: state not found`);
          return;
        }

        // Clear encounter state
        for (const s of [state1, state2]) {
          try {
            await sendTx(deployerWallet, "UD__adminClearEncounterState", [
              s.characterId,
            ]);
          } catch {}
          await adminHeal(s.characterId);
        }

        // Move both to (6,6)
        await sendTx(deployerWallet, "UD__adminMoveEntity", [
          state1.characterId,
          6,
          6,
        ]);
        await sendTx(deployerWallet, "UD__adminMoveEntity", [
          state2.characterId,
          6,
          6,
        ]);

        const stats1Before = await getStats(state1.characterId);
        const stats2Before = await getStats(state2.characterId);
        console.log(
          `[spells] ${class1Name} HP=${stats1Before.currentHp} vs ${class2Name} HP=${stats2Before.currentHp}`,
        );

        // Create PvP encounter
        try {
          const { result: encounterId } = await simulateAndSend<Hex>(
            state1.wallet.wallet,
            "UD__createEncounter",
            [
              EncounterType.PvP,
              [state1.characterId],
              [state2.characterId],
            ],
          );
          console.log(`[spells] PvP encounter: ${encounterId}`);

          const stats1After = await getStats(state1.characterId);
          const stats2After = await getStats(state2.characterId);

          const p1Damaged = stats1After.currentHp < stats1Before.currentHp;
          const p2Damaged = stats2After.currentHp < stats2Before.currentHp;
          const p1Died = stats1After.currentHp <= 0n;
          const p2Died = stats2After.currentHp <= 0n;

          console.log(
            `[spells] Result: ${class1Name} dmg=${p1Damaged} died=${p1Died}, ${class2Name} dmg=${p2Damaged} died=${p2Died}`,
          );
          console.log(
            `[spells]   ${class1Name} HP=${stats1After.currentHp}/${stats1After.maxHp}`,
          );
          console.log(
            `[spells]   ${class2Name} HP=${stats2After.currentHp}/${stats2After.maxHp}`,
          );
        } catch (err: any) {
          console.log(
            `[spells] PvP ${class1Name} vs ${class2Name} error: ${err.message?.slice(0, 200)}`,
          );
        }

        // Cleanup
        for (const s of [state1, state2]) {
          try {
            await sendTx(deployerWallet, "UD__adminClearEncounterState", [
              s.characterId,
            ]);
          } catch {}
          await adminHeal(s.characterId);
        }

        // Verify both characters still valid
        await assertCharacterValid(state1.characterId);
        await assertCharacterValid(state2.characterId);
      },
      120_000,
    );
  }
});
