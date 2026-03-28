#!/usr/bin/env npx tsx
/**
 * Mint one of every droppable item to a character for smoke testing.
 * Usage: set -a && source .env.testnet && set +a && npx tsx scripts/admin/mint-all-items.ts <characterId>
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  padHex,
  toHex,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

const PROD_WORLD = '0x99d01939F58B965E6E84a1D167E710Abdf5764b0';
const ITEMS_TABLE_ID = '0x746255440000000000000000000000004974656d730000000000000000000000' as Hex;
const ITEMS_FIELD_LAYOUT = '0x0061040101202020000000000000000000000000000000000000000000000000' as Hex;
const MAX_ITEMS = 450;

const worldAbi = parseAbi([
  'function getStaticField(bytes32 tableId, bytes32[] calldata keyTuple, uint8 fieldIndex, bytes32 fieldLayout) view returns (bytes32)',
  'function UD__adminDropItem(bytes32 characterId, uint256 itemId, uint256 amount)',
]);

async function main() {
  const characterId = process.argv[2] as Hex;
  if (!characterId) {
    console.error('Usage: npx tsx scripts/admin/mint-all-items.ts <characterId>');
    process.exit(1);
  }

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
  console.log('Character:', characterId);
  console.log('');

  // Collect all droppable item IDs first
  const itemsToMint: { id: number; type: string; rarity: number }[] = [];

  for (let i = 1; i <= MAX_ITEMS; i++) {
    const keyTuple = [padHex(toHex(i, { size: 32 }), { size: 32 })] as Hex[];

    const itemTypeBlob = await publicClient.readContract({
      address: worldAddress, abi: worldAbi, functionName: 'getStaticField',
      args: [ITEMS_TABLE_ID, keyTuple, 0, ITEMS_FIELD_LAYOUT],
    });
    // ItemType enum: 0=Weapon, 1=Armor, 2=Spell, 3=Consumable
    // MUD stores uint8 in first byte of bytes32 (left-aligned)
    const itemType = parseInt(itemTypeBlob.slice(2, 4), 16); // first byte after "0x"

    const dropBlob = await publicClient.readContract({
      address: worldAddress, abi: worldAbi, functionName: 'getStaticField',
      args: [ITEMS_TABLE_ID, keyTuple, 1, ITEMS_FIELD_LAYOUT],
    });
    const dropChance = BigInt(dropBlob);
    if (dropChance === 0n) continue; // non-droppable (monster weapons)

    const rarityBlob = await publicClient.readContract({
      address: worldAddress, abi: worldAbi, functionName: 'getStaticField',
      args: [ITEMS_TABLE_ID, keyTuple, 3, ITEMS_FIELD_LAYOUT],
    });
    const rarity = Number(BigInt(rarityBlob));

    const typeName = itemType === 0 ? 'Weapon' : itemType === 1 ? 'Armor' : 'Consumable';
    itemsToMint.push({ id: i, type: typeName, rarity });
  }

  console.log(`Found ${itemsToMint.length} droppable items. Minting...\n`);

  // Deduplicate — only mint unique items (skip orphaned duplicates from failed zone loads)
  // Items with same type+rarity combo at different IDs are likely duplicates
  // Actually just mint all of them — it's for testing
  let minted = 0;
  let nonce = await publicClient.getTransactionCount({ address: account.address });

  for (const item of itemsToMint) {
    const amount = item.type === 'Consumable' ? 5n : 1n;
    try {
      const hash = await walletClient.writeContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'UD__adminDropItem',
        args: [characterId, BigInt(item.id), amount],
        nonce,
      });
      nonce++;
      await publicClient.waitForTransactionReceipt({ hash });
      minted++;
      console.log(`  [${minted}/${itemsToMint.length}] Item ${item.id} (${item.type} R${item.rarity}) x${amount}`);
    } catch (e: any) {
      const msg = e?.details || e?.message || '';
      if (msg.includes('nonce')) {
        // Refresh nonce and retry
        nonce = await publicClient.getTransactionCount({ address: account.address });
        try {
          const hash = await walletClient.writeContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__adminDropItem',
            args: [characterId, BigInt(item.id), amount],
            nonce,
          });
          nonce++;
          await publicClient.waitForTransactionReceipt({ hash });
          minted++;
          console.log(`  [${minted}/${itemsToMint.length}] Item ${item.id} (${item.type} R${item.rarity}) x${amount} (retry)`);
        } catch (e2: any) {
          console.error(`  FAILED item ${item.id}: ${e2?.details || e2?.message}`);
        }
      } else {
        console.error(`  FAILED item ${item.id}: ${msg}`);
      }
    }
  }

  console.log(`\nDone! Minted ${minted} items to ${characterId}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
