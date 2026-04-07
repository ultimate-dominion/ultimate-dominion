#!/usr/bin/env npx tsx
/**
 * Crank up all item drop rates on beta for testing.
 * Gear: R0=80%, R1=70%, R2=60%, R3=55%, R4=50%
 * Consumables: 50% flat
 *
 * Usage: source .env.testnet && npx tsx scripts/admin/set-drop-rates-beta.ts
 */
// Skip dotenv — use shell env (source .env.testnet before running)

import {
  createPublicClient,
  createWalletClient,
  http,
  encodePacked,
  toHex,
  padHex,
  parseAbi,
  type Hex,
  type Address,
  decodeAbiParameters,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

const PROD_WORLD = '0x99d01939F58B965E6E84a1D167E710Abdf5764b0';

// Items table resource ID
const ITEMS_TABLE_ID = '0x746255440000000000000000000000004974656d730000000000000000000000' as Hex;

// Items field layout
const ITEMS_FIELD_LAYOUT = '0x0061040101202020000000000000000000000000000000000000000000000000' as Hex;

// ItemType enum: 0=Weapon, 1=Armor, 2=Spell, 3=Consumable
const WEAPON = 0;
const ARMOR = 1;
const CONSUMABLE = 3;

// Beta drop rates per 100,000
const GEAR_RATES: Record<number, number> = {
  0: 80_000, // R0 80%
  1: 70_000, // R1 70%
  2: 60_000, // R2 60%
  3: 55_000, // R3 55%
  4: 50_000, // R4 50%
};
const CONSUMABLE_RATE = 50_000; // 50%

const worldAbi = parseAbi([
  'function getStaticField(bytes32 tableId, bytes32[] calldata keyTuple, uint8 fieldIndex, bytes32 fieldLayout) view returns (bytes32)',
  'function setStaticField(bytes32 tableId, bytes32[] calldata keyTuple, uint8 fieldIndex, bytes calldata data, bytes32 fieldLayout)',
]);

async function main() {
  const worldAddress = process.env.WORLD_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const privateKey = process.env.PRIVATE_KEY as Hex;
  const chainId = parseInt(process.env.CHAIN_ID || '31337');

  if (worldAddress.toLowerCase() === PROD_WORLD.toLowerCase()) {
    console.error('REFUSING TO RUN ON PRODUCTION WORLD');
    process.exit(1);
  }

  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ chain, transport: http(rpcUrl), account });

  console.log('World:', worldAddress);
  console.log('Account:', account.address);
  console.log('');

  // Read items until we hit one with no data (itemType = 0)
  let updated = 0;
  const MAX_ITEMS = 450;

  for (let i = 1; i <= MAX_ITEMS; i++) {
    const keyTuple = [padHex(toHex(i, { size: 32 }), { size: 32 })] as Hex[];

    // Read itemType (field 0)
    const itemTypeBlob = await publicClient.readContract({
      address: worldAddress, abi: worldAbi, functionName: 'getStaticField',
      args: [ITEMS_TABLE_ID, keyTuple, 0, ITEMS_FIELD_LAYOUT],
    });
    const itemType = parseInt(itemTypeBlob.slice(2, 4), 16); // uint8, first byte after "0x"
    if (itemType === 0) continue; // empty slot, skip

    // Read dropChance (field 1)
    const dropBlob = await publicClient.readContract({
      address: worldAddress, abi: worldAbi, functionName: 'getStaticField',
      args: [ITEMS_TABLE_ID, keyTuple, 1, ITEMS_FIELD_LAYOUT],
    });
    const dropChance = BigInt(dropBlob);
    if (dropChance === 0n) {
      // Non-droppable (monster weapon, etc.)
      continue;
    }

    // Read rarity (field 3)
    const rarityBlob = await publicClient.readContract({
      address: worldAddress, abi: worldAbi, functionName: 'getStaticField',
      args: [ITEMS_TABLE_ID, keyTuple, 3, ITEMS_FIELD_LAYOUT],
    });
    const rarity = Number(BigInt(rarityBlob));

    let newDrop: bigint;
    if (itemType === ARMOR || itemType === WEAPON) {
      newDrop = BigInt(GEAR_RATES[rarity] ?? Number(dropChance));
    } else if (itemType === CONSUMABLE) {
      newDrop = BigInt(CONSUMABLE_RATE);
    } else {
      continue;
    }

    if (newDrop === dropChance) continue;

    const typeName = itemType === ARMOR ? 'Armor' : itemType === WEAPON ? 'Weapon' : 'Consumable';
    console.log(`Item ${i} (${typeName}, R${rarity}): ${dropChance} -> ${newDrop}`);

    const data = encodePacked(['uint256'], [newDrop]);
    const hash = await walletClient.writeContract({
      address: worldAddress, abi: worldAbi, functionName: 'setStaticField',
      args: [ITEMS_TABLE_ID, keyTuple, 1, data, ITEMS_FIELD_LAYOUT],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    updated++;
  }

  console.log(`\nDone! Updated ${updated} items.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
