#!/usr/bin/env npx tsx
/**
 * Sets ItemDurability.maxDurability for all items based on rarity.
 * Reads item data directly from chain via MUD Store getRecord.
 *
 * Usage:
 *   set -a && source .env.testnet && set +a && npx tsx scripts/admin/deploy-durability-data.ts
 */

import { createPublicClient, createWalletClient, http, parseAbi, toHex, concat, type Hex, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const WORLD = getAddress(process.env.WORLD_ADDRESS!);
const RPC = process.env.RPC_URL!;
const KEY = process.env.PRIVATE_KEY!;

const DURABILITY_BY_RARITY: Record<number, number> = {
  0: 20, 1: 30, 2: 40, 3: 50, 4: 60,
};

// Item types that should have durability (Weapon=0, Armor=1, Accessory=2)
const DURABLE_TYPES = new Set([0, 1, 2]);

// Build MUD table ResourceId
function tableResourceId(namespace: string, name: string): Hex {
  const typeBytes = toHex("tb", { size: 2 });
  const nsBytes = toHex(namespace, { size: 14 });
  const nameBytes = toHex(name, { size: 16 });
  return concat([typeBytes, nsBytes, nameBytes]);
}

const ITEMS_TABLE_ID = tableResourceId("UD", "Items");

function keyTuple(id: number): Hex[] {
  return [toHex(BigInt(id), { size: 32 })];
}

const account = privateKeyToAccount(KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });
const walletClient = createWalletClient({ chain: base, transport: http(RPC), account });

const worldAbi = parseAbi([
  "function getRecord(bytes32 tableId, bytes32[] keyTuple) view returns (bytes staticData, bytes32 encodedLengths, bytes dynamicData)",
  "function UD__setMaxDurability(uint256 itemId, uint256 maxDurability) external",
]);

async function main() {
  console.log("=== Deploy Durability Data ===");
  console.log(`World: ${WORLD}`);
  console.log(`Deployer: ${account.address}`);

  // Scan items directly from chain
  console.log(`\nScanning items on-chain...`);
  const MAX_ITEM_ID = 600;
  const itemEntries: { id: number; rarity: number; type: number }[] = [];

  for (let id = 1; id <= MAX_ITEM_ID; id++) {
    try {
      const [staticData] = await publicClient.readContract({
        address: WORLD,
        abi: worldAbi,
        functionName: "getRecord",
        args: [ITEMS_TABLE_ID, keyTuple(id)],
      }) as [Hex, Hex, Hex];

      if (!staticData || staticData === "0x" || staticData.length < 196) continue;

      // Items static fields: itemType(uint8) + dropChance(uint256) + price(uint256) + rarity(uint256) = 97 bytes
      const hex = staticData.slice(2);
      const itemType = parseInt(hex.slice(0, 2), 16);
      const rarity = Number(BigInt("0x" + hex.slice(130, 194)));

      if (DURABLE_TYPES.has(itemType) && rarity >= 0 && rarity <= 4) {
        itemEntries.push({ id, rarity, type: itemType });
      }
    } catch {
      // Item doesn't exist
    }
  }

  console.log(`Found ${itemEntries.length} durable items (weapons/armor/accessories)`);

  // Set max durability (with small delay to avoid nonce collisions)
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  let set = 0, errors = 0;
  for (const item of itemEntries) {
    const maxDur = DURABILITY_BY_RARITY[item.rarity];
    if (!maxDur) continue;

    try {
      const hash = await walletClient.writeContract({
        address: WORLD,
        abi: worldAbi,
        functionName: "UD__setMaxDurability",
        args: [BigInt(item.id), BigInt(maxDur)],
      });
      set++;
      if (set % 20 === 0) console.log(`  Progress: ${set}/${itemEntries.length} (tx: ${hash.slice(0, 10)}...)`);
      await sleep(200); // avoid nonce collisions
    } catch (e: any) {
      console.log(`  ERROR item ${item.id} (R${item.rarity}): ${e.shortMessage || e.message?.slice(0, 80)}`);
      errors++;
    }
  }

  console.log(`\nSet durability for ${set} items, ${errors} errors`);
  console.log("=== Deploy Durability Data Complete ===");
}

main().catch(console.error);
