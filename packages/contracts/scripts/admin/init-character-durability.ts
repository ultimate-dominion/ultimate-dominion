#!/usr/bin/env npx tsx
/**
 * Initializes CharacterItemDurability for all existing character-item pairs.
 * Without this, items with maxDurability > 0 appear broken (currentDurability defaults to 0).
 *
 * Reads ERC721Owners to enumerate characters by tokenId, constructs characterId,
 * reads CharacterEquipment for equipped items, and calls UD__initializeDurability.
 *
 * Usage:
 *   bash -c 'set -a && source .env.testnet && set +a && npx tsx scripts/admin/init-character-durability.ts'
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  toHex,
  concat,
  type Hex,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const WORLD = getAddress(process.env.WORLD_ADDRESS!);
const RPC = process.env.RPC_URL!;
const KEY = process.env.PRIVATE_KEY!;

// Hardcoded ResourceId hex values from MUD codegen (type=tb, truncated to 16-byte names)
// Characters:Owners (ERC721 Owners table in Characters namespace)
function tableResourceId(namespace: string, name: string): Hex {
  const typeBytes = toHex("tb", { size: 2 });
  const nsBytes = toHex(namespace, { size: 14 });
  const nameBytes = toHex(name, { size: 16 });
  return concat([typeBytes, nsBytes, nameBytes]);
}
const ERC721_OWNERS_TABLE_ID = tableResourceId("Characters", "Owners");
// UD:Counters
const COUNTERS_TABLE_ID = "0x74625544000000000000000000000000436f756e746572730000000000000000" as Hex;
// UD:CharacterEquipme(nt) — truncated to 16 bytes
const CHARACTER_EQUIPMENT_TABLE_ID = "0x7462554400000000000000000000000043686172616374657245717569706d65" as Hex;
// UD:CharacterItemDur(ability) — truncated to 16 bytes
const CHAR_ITEM_DURABILITY_TABLE_ID = "0x746255440000000000000000000000004368617261637465724974656d447572" as Hex;
// UD:ItemDurability
const ITEM_DURABILITY_TABLE_ID = "0x746255440000000000000000000000004974656d4475726162696c6974790000" as Hex;

function keyTuple(...keys: Hex[]): Hex[] {
  return keys;
}

const account = privateKeyToAccount(KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });
const walletClient = createWalletClient({ chain: base, transport: http(RPC), account });

const worldAbi = parseAbi([
  "function getRecord(bytes32 tableId, bytes32[] keyTuple) view returns (bytes staticData, bytes32 encodedLengths, bytes dynamicData)",
  "function UD__initializeDurability(bytes32 characterId, uint256 itemId) external",
]);

// Construct characterId from owner address and tokenId (mirrors Solidity)
function buildCharacterId(owner: Hex, tokenId: bigint): Hex {
  const ownerBig = BigInt(owner);
  const id = (ownerBig << 96n) | tokenId;
  return toHex(id, { size: 32 });
}

// Decode ERC721 Owners static data: just an address (20 bytes, left-padded to 32)
function decodeOwnerAddress(staticData: Hex): Hex | null {
  if (!staticData || staticData === "0x" || staticData.length < 42) return null;
  // Address is stored as 20 bytes
  const hex = staticData.slice(2);
  const addr = "0x" + hex.slice(0, 40);
  if (addr === "0x0000000000000000000000000000000000000000") return null;
  return getAddress(addr) as Hex;
}

// Decode CharacterEquipment dynamic data to get equipped item arrays
// Static fields: strBonus(int256) + agiBonus(int256) + intBonus(int256) + hpBonus(int256) + armor(int256) = 5 * 32 = 160 bytes
// Dynamic fields: equippedArmor(uint256[]) + equippedWeapons(uint256[]) + equippedSpells(uint256[]) + equippedConsumables(uint256[]) + equippedAccessories(uint256[])
function decodeEquipment(staticData: Hex, encodedLengths: Hex, dynamicData: Hex): bigint[] {
  const allItems: bigint[] = [];

  if (!dynamicData || dynamicData === "0x" || dynamicData.length <= 2) return allItems;

  // encodedLengths packs the byte lengths of each dynamic field
  // Each uint256 element = 32 bytes, so length / 32 = item count
  // The encodedLengths is a bytes32 that packs 5 lengths (each 5 bytes) in the high bytes
  // Layout: total(7 bytes) | field4(5) | field3(5) | field2(5) | field1(5) | field0(5)
  const lenHex = encodedLengths.slice(2); // remove 0x
  // Read from right to left, each 5 bytes (10 hex chars)
  const fieldLengths: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = lenHex.length - (i + 1) * 10;
    const end = start + 10;
    if (start < 0) {
      fieldLengths.push(0);
    } else {
      fieldLengths.push(Number(BigInt("0x" + lenHex.slice(start, end))));
    }
  }

  // Parse all dynamic fields — each is an array of uint256
  let offset = 0;
  const dynHex = dynamicData.slice(2);
  for (const byteLen of fieldLengths) {
    const elementCount = byteLen / 32;
    for (let j = 0; j < elementCount; j++) {
      const start = (offset + j * 32) * 2;
      const end = start + 64;
      if (end <= dynHex.length) {
        const val = BigInt("0x" + dynHex.slice(start, end));
        if (val > 0n) allItems.push(val);
      }
    }
    offset += byteLen;
  }

  return allItems;
}

async function main() {
  console.log("=== Init Character Durability ===");
  console.log(`World: ${WORLD}`);
  console.log(`Deployer: ${account.address}`);

  // Step 1: Read character counter to know how many characters exist
  // Counters key: (contractAddress=address(2), counterId=0)
  // ABI-encoded as left-padded bytes32
  const counterKey = keyTuple(
    toHex(2n, { size: 32 }),
    toHex(0n, { size: 32 })
  );

  let maxTokenId: number;
  try {
    const [staticData] = await publicClient.readContract({
      address: WORLD,
      abi: worldAbi,
      functionName: "getRecord",
      args: [COUNTERS_TABLE_ID, counterKey],
    }) as [Hex, Hex, Hex];

    // Counters schema: counter(uint256) = 32 bytes
    maxTokenId = Number(BigInt("0x" + staticData.slice(2)));
    console.log(`\nCharacter counter: ${maxTokenId} characters`);
  } catch (e: any) {
    console.error("Failed to read character counter:", e.shortMessage || e.message);
    return;
  }

  // Step 2: Enumerate characters via ERC721Owners table
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const characters: { tokenId: number; owner: Hex; characterId: Hex }[] = [];

  console.log(`\nScanning ERC721Owners for tokenIds 1..${maxTokenId}...`);
  for (let tokenId = 1; tokenId <= maxTokenId; tokenId++) {
    try {
      const ownerKey = keyTuple(toHex(BigInt(tokenId), { size: 32 }));
      const [staticData] = await publicClient.readContract({
        address: WORLD,
        abi: worldAbi,
        functionName: "getRecord",
        args: [ERC721_OWNERS_TABLE_ID, ownerKey],
      }) as [Hex, Hex, Hex];

      const owner = decodeOwnerAddress(staticData);
      if (!owner) continue;

      const characterId = buildCharacterId(owner, BigInt(tokenId));
      characters.push({ tokenId, owner, characterId });
    } catch {
      // Token doesn't exist (burned or never minted)
    }
  }
  console.log(`Found ${characters.length} characters`);

  // Step 3: For each character, read equipment and init durability
  let totalInits = 0;
  let totalSkipped = 0;
  let errors = 0;

  for (const char of characters) {
    try {
      // Read CharacterEquipment
      const eqKey = keyTuple(char.characterId);
      const [staticData, encodedLengths, dynamicData] = await publicClient.readContract({
        address: WORLD,
        abi: worldAbi,
        functionName: "getRecord",
        args: [CHARACTER_EQUIPMENT_TABLE_ID, eqKey],
      }) as [Hex, Hex, Hex];

      const equippedItems = decodeEquipment(staticData, encodedLengths, dynamicData);

      if (equippedItems.length === 0) continue;

      for (const itemId of equippedItems) {
        // Check if item has maxDurability > 0
        try {
          const durKey = keyTuple(toHex(itemId, { size: 32 }));
          const [durStatic] = await publicClient.readContract({
            address: WORLD,
            abi: worldAbi,
            functionName: "getRecord",
            args: [ITEM_DURABILITY_TABLE_ID, durKey],
          }) as [Hex, Hex, Hex];

          // ItemDurability: maxDurability(uint256) + defaultDurability(uint256) = 64 bytes
          const maxDur = BigInt("0x" + durStatic.slice(2, 66));
          if (maxDur === 0n) {
            totalSkipped++;
            continue;
          }

          // Check if already initialized
          const cidKey = keyTuple(char.characterId, toHex(itemId, { size: 32 }));
          const [cidStatic] = await publicClient.readContract({
            address: WORLD,
            abi: worldAbi,
            functionName: "getRecord",
            args: [CHAR_ITEM_DURABILITY_TABLE_ID, cidKey],
          }) as [Hex, Hex, Hex];

          const currentDur = BigInt("0x" + cidStatic.slice(2, 66));
          if (currentDur > 0n) {
            totalSkipped++;
            continue;
          }

          // Initialize
          const hash = await walletClient.writeContract({
            address: WORLD,
            abi: worldAbi,
            functionName: "UD__initializeDurability",
            args: [char.characterId, itemId],
          });
          totalInits++;
          console.log(`  Init tokenId=${char.tokenId} item=${itemId} maxDur=${maxDur} (tx: ${hash.slice(0, 10)}...)`);
          await sleep(200);
        } catch (e: any) {
          console.log(`  ERROR char=${char.tokenId} item=${itemId}: ${e.shortMessage || e.message?.slice(0, 80)}`);
          errors++;
        }
      }
    } catch {
      // No equipment data
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Characters scanned: ${characters.length}`);
  console.log(`Durability initialized: ${totalInits}`);
  console.log(`Skipped (no maxDur or already init): ${totalSkipped}`);
  console.log(`Errors: ${errors}`);
  console.log("=== Init Character Durability Complete ===");
}

main().catch(console.error);
