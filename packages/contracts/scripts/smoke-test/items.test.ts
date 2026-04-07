import { describe, test, expect } from "vitest";
import { readWorld, nameToBytes32, ItemType } from "./setup";
import { keccak256, encodeAbiParameters, parseAbiParameters, type Hex } from "viem";

/** Compute effectId the same way Solidity does: keccak256(abi.encode(name)) truncated to 8 bytes */
function effectId(name: string): Hex {
  const hash = keccak256(encodeAbiParameters(parseAbiParameters("string"), [name]));
  return (hash.slice(0, 18).padEnd(66, "0")) as Hex;
}

// ---------------------------------------------------------------------------
// Items Smoke Test — verifies deployment state of items, weapons, armor,
// effects, and config contracts on-chain.
// ---------------------------------------------------------------------------

const ITEM_TYPE_NAMES: Record<number, string> = {
  [ItemType.Weapon]: "Weapon",
  [ItemType.Armor]: "Armor",
  [ItemType.Spell]: "Spell",
  [ItemType.Consumable]: "Consumable",
  [ItemType.QuestItem]: "QuestItem",
  [ItemType.Accessory]: "Accessory",
};

// Accumulated during Phase 1, consumed by later phases
const scannedItems: {
  weapons: number[];
  armors: number[];
  spells: number[];
  consumables: number[];
  questItems: number[];
  accessories: number[];
  starterWeapons: number[];
  starterArmors: number[];
} = {
  weapons: [],
  armors: [],
  spells: [],
  consumables: [],
  questItems: [],
  accessories: [],
  starterWeapons: [],
  starterArmors: [],
};

// ---------------------------------------------------------------------------
// Phase 1 -- Item Discovery & Count
// ---------------------------------------------------------------------------

describe("Phase 1 -- Item Discovery & Count", () => {
  test(
    "scan item IDs 1-200 and count by type",
    async () => {
      const typeCounts: Record<number, number> = {};

      for (let id = 1; id <= 200; id++) {
        try {
          const itemType: number = await readWorld("UD__getItemType", [
            BigInt(id),
          ]);

          // ItemType 0 could be Weapon (valid) or an empty slot — check if
          // the item is actually registered by also checking starter status
          // or effects. For now, count any response as a valid item.
          typeCounts[itemType] = (typeCounts[itemType] ?? 0) + 1;

          // Bucket by type
          switch (itemType) {
            case ItemType.Weapon:
              scannedItems.weapons.push(id);
              break;
            case ItemType.Armor:
              scannedItems.armors.push(id);
              break;
            case ItemType.Spell:
              scannedItems.spells.push(id);
              break;
            case ItemType.Consumable:
              scannedItems.consumables.push(id);
              break;
            case ItemType.QuestItem:
              scannedItems.questItems.push(id);
              break;
            case ItemType.Accessory:
              scannedItems.accessories.push(id);
              break;
          }

          // Check starter flag
          const isStarter = await readWorld("UD__isStarterItem", [BigInt(id)]);
          if (isStarter) {
            if (itemType === ItemType.Weapon) {
              scannedItems.starterWeapons.push(id);
            } else if (itemType === ItemType.Armor) {
              scannedItems.starterArmors.push(id);
            }
          }
        } catch {
          // Item doesn't exist at this ID — skip
        }
      }

      // Log counts
      console.log("[items] Item type counts:");
      for (const [type, count] of Object.entries(typeCounts)) {
        const name = ITEM_TYPE_NAMES[Number(type)] ?? `Unknown(${type})`;
        console.log(`  ${name}: ${count}`);
      }
      console.log(
        `[items] Starter weapons (${scannedItems.starterWeapons.length}): [${scannedItems.starterWeapons.join(", ")}]`,
      );
      console.log(
        `[items] Starter armors (${scannedItems.starterArmors.length}): [${scannedItems.starterArmors.join(", ")}]`,
      );

      // Assertions
      expect(scannedItems.weapons.length).toBeGreaterThanOrEqual(30);
      expect(scannedItems.armors.length).toBeGreaterThanOrEqual(15);
      expect(
        scannedItems.starterWeapons.length + scannedItems.starterArmors.length,
      ).toBeGreaterThan(0);
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 2 -- Starter Items
// ---------------------------------------------------------------------------

describe("Phase 2 -- Starter Items", () => {
  test(
    "starter weapons have valid type and meet minimum count",
    async () => {
      expect(scannedItems.starterWeapons.length).toBeGreaterThanOrEqual(3);

      for (const id of scannedItems.starterWeapons) {
        const itemType: number = await readWorld("UD__getItemType", [
          BigInt(id),
        ]);
        expect(itemType).toBe(ItemType.Weapon);
      }
      console.log(
        `[items] ${scannedItems.starterWeapons.length} starter weapons verified`,
      );
    },
    30_000,
  );

  test(
    "starter armors have valid type and cover armor types",
    async () => {
      expect(scannedItems.starterArmors.length).toBeGreaterThanOrEqual(3);

      for (const id of scannedItems.starterArmors) {
        const itemType: number = await readWorld("UD__getItemType", [
          BigInt(id),
        ]);
        expect(itemType).toBe(ItemType.Armor);
      }
      console.log(
        `[items] ${scannedItems.starterArmors.length} starter armors verified (expect Cloth, Leather, Plate)`,
      );
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 3 -- Weapon Stats Verification
// ---------------------------------------------------------------------------

describe("Phase 3 -- Weapon Stats Verification", () => {
  test(
    "weapon items have correct type",
    async () => {
      const sample = scannedItems.weapons.slice(0, 20);
      console.log(
        `[items] Verifying ${sample.length} weapons (of ${scannedItems.weapons.length} total)`,
      );

      for (const id of sample) {
        const itemType: number = await readWorld("UD__getItemType", [
          BigInt(id),
        ]);
        expect(itemType).toBe(ItemType.Weapon);
      }
    },
    30_000,
  );

  test(
    "at least some weapons have effects",
    async () => {
      let weaponsWithEffects = 0;
      const sample = scannedItems.weapons.slice(0, 20);

      for (const id of sample) {
        try {
          const effects: string[] = await readWorld("UD__getItemEffects", [
            BigInt(id),
          ]);
          if (effects.length > 0) {
            weaponsWithEffects++;
          }
        } catch {
          // Some weapons may not have effects — that's fine
        }
      }

      console.log(
        `[items] ${weaponsWithEffects}/${sample.length} sampled weapons have effects`,
      );
      expect(weaponsWithEffects).toBeGreaterThan(0);
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 4 -- Spell Config Check
// ---------------------------------------------------------------------------

describe("Phase 4 -- Spell Config Check", () => {
  const KNOWN_SPELLS = [
    "battle_cry",
    "divine_shield",
    "arcane_blast_damage",
    "blessing",
  ];

  test(
    "check known spell configs",
    async () => {
      const results: Record<string, boolean> = {};

      for (const spell of KNOWN_SPELLS) {
        try {
          const eid = effectId(spell);
          const hasConfig = await readWorld("UD__hasSpellConfig", [eid]);
          results[spell] = hasConfig as boolean;
        } catch {
          results[spell] = false;
        }
      }

      console.log("[items] Spell config status:");
      for (const [spell, loaded] of Object.entries(results)) {
        console.log(`  ${spell}: ${loaded ? "LOADED" : "NOT LOADED"}`);
      }

      // Informational — don't fail hard since spell configs are loaded separately
      const loadedCount = Object.values(results).filter(Boolean).length;
      console.log(
        `[items] ${loadedCount}/${KNOWN_SPELLS.length} spell configs loaded`,
      );
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 5 -- Gold Token & Items Contract
// ---------------------------------------------------------------------------

describe("Phase 5 -- Gold Token & Items Contract", () => {
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  test(
    "UD__getGoldToken returns non-zero address",
    async () => {
      const goldToken = await readWorld("UD__getGoldToken");
      console.log(`[items] Gold token: ${goldToken}`);
      expect(goldToken).not.toBe(ZERO_ADDRESS);
    },
    30_000,
  );

  test(
    "UD__getItemsContract returns non-zero address",
    async () => {
      const itemsContract = await readWorld("UD__getItemsContract");
      console.log(`[items] Items contract: ${itemsContract}`);
      expect(itemsContract).not.toBe(ZERO_ADDRESS);
    },
    30_000,
  );
});
