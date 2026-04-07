import { readWorld, ItemType } from "./setup";

// ---------------------------------------------------------------------------
// Discovery — scan chain for starter items, shop entity, item bounds
// ---------------------------------------------------------------------------

export interface StarterItems {
  weapons: number[]; // item IDs that are starter weapons
  armors: number[]; // item IDs that are starter armors
}

export interface DiscoveryResult {
  starterItems: StarterItems;
  shopEntityId: string | null; // bytes32 shop entity at (9,9)
  totalItemsScanned: number;
  goldTokenAddress: string;
  itemsContractAddress: string;
}

/**
 * Scan item IDs 1..maxId to find starter weapons and armor.
 * Stops scanning when 5 consecutive non-starter items are found after
 * finding at least one starter.
 */
async function discoverStarterItems(maxId: number = 200): Promise<{
  items: StarterItems;
  scanned: number;
}> {
  const weapons: number[] = [];
  const armors: number[] = [];
  let consecutiveNonStarter = 0;
  let foundAny = false;
  let scanned = 0;

  for (let id = 1; id <= maxId; id++) {
    scanned = id;
    try {
      const isStarter = await readWorld("UD__isStarterItem", [BigInt(id)]);
      if (!isStarter) {
        consecutiveNonStarter++;
        if (foundAny && weapons.length > 0 && armors.length > 0 && consecutiveNonStarter >= 20) break;
        continue;
      }
      foundAny = true;
      consecutiveNonStarter = 0;

      const itemType: number = await readWorld("UD__getItemType", [BigInt(id)]);
      if (itemType === ItemType.Weapon) {
        weapons.push(id);
      } else if (itemType === ItemType.Armor) {
        armors.push(id);
      }
    } catch {
      // Item doesn't exist — keep scanning
      if (foundAny) consecutiveNonStarter++;
      if (consecutiveNonStarter >= 10) break;
    }
  }

  return { items: { weapons, armors }, scanned };
}

/**
 * Find the shop entity at position (9,9).
 */
async function discoverShop(): Promise<string | null> {
  try {
    const entities: string[] = await readWorld("UD__getEntitiesAtPosition", [
      9,
      9,
    ]);
    for (const entityId of entities) {
      const isShop = await readWorld("UD__isShop", [entityId]);
      if (isShop) return entityId;
    }
  } catch {
    // Position might not have entities
  }
  return null;
}

/**
 * Run full discovery. Call once at suite start.
 */
export async function runDiscovery(): Promise<DiscoveryResult> {
  const [{ items, scanned }, shopEntityId, goldTokenAddress, itemsContractAddress] =
    await Promise.all([
      discoverStarterItems(),
      discoverShop(),
      readWorld("UD__getGoldToken") as Promise<string>,
      readWorld("UD__getItemsContract") as Promise<string>,
    ]);

  console.log(
    `[discovery] Found ${items.weapons.length} starter weapons: [${items.weapons.join(", ")}]`,
  );
  console.log(
    `[discovery] Found ${items.armors.length} starter armors: [${items.armors.join(", ")}]`,
  );
  console.log(
    `[discovery] Shop entity at (9,9): ${shopEntityId ?? "NOT FOUND"}`,
  );
  console.log(`[discovery] Gold token: ${goldTokenAddress}`);
  console.log(`[discovery] Items contract: ${itemsContractAddress}`);
  console.log(`[discovery] Scanned ${scanned} item IDs`);

  return {
    starterItems: items,
    totalItemsScanned: scanned,
    shopEntityId,
    goldTokenAddress,
    itemsContractAddress,
  };
}
