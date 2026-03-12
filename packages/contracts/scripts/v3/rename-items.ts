#!/usr/bin/env npx tsx
/**
 * V3 Balance Patch — Rename Items
 *
 * Updates on-chain metadataUri for 8 weapons + 2 armor that were renamed in V3.
 * Uses adminUpdateItemMetadata (new AdminTuningSystem function).
 *
 * Usage:
 *   npx tsx scripts/v3/rename-items.ts [--apply] [--world <address>] [--rpc <url>]
 *
 * Without --apply: dry-run showing what would be renamed
 * With --apply: pushes changes on-chain
 */

import { config } from 'dotenv';
config();

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  toHex,
  concat,
  Hex,
  Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, base } from 'viem/chains';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============ Rename Map ============

const RENAMES: { oldUri: string; newUri: string; label: string }[] = [
  // Weapons
  { oldUri: 'weapon:steel_mace', newUri: 'weapon:light_mace', label: 'Steel Mace → Light Mace' },
  { oldUri: 'weapon:recurve_bow', newUri: 'weapon:shortbow', label: 'Recurve Bow → Shortbow' },
  { oldUri: 'weapon:etched_blade', newUri: 'weapon:notched_blade', label: 'Etched Blade → Notched Blade' },
  { oldUri: 'weapon:rat_kings_fang', newUri: 'weapon:dire_rat_fang', label: "Rat King's Fang → Dire Rat Fang" },
  { oldUri: 'weapon:brutes_cleaver', newUri: 'weapon:notched_cleaver', label: "Brute's Cleaver → Notched Cleaver" },
  { oldUri: 'weapon:crystal_blade', newUri: 'weapon:crystal_shard', label: 'Crystal Blade → Crystal Shard' },
  { oldUri: 'weapon:trolls_bonebreaker', newUri: 'weapon:gnarled_cudgel', label: "Troll's Bonebreaker → Gnarled Cudgel" },
  { oldUri: 'weapon:giants_club', newUri: 'weapon:stone_maul', label: "Giant's Club → Stone Maul" },
  // Armor
  { oldUri: 'armor:chainmail_shirt', newUri: 'armor:etched_chainmail', label: 'Chainmail Shirt → Etched Chainmail' },
  { oldUri: 'armor:cracked_stone_plate', newUri: 'armor:carved_stone_plate', label: 'Cracked Stone Plate → Carved Stone Plate' },
];

// ============ MUD Resource IDs ============

function tableResourceId(namespace: string, name: string): Hex {
  const typeBytes = toHex('tb', { size: 2 });
  const nsBytes = toHex(namespace, { size: 14 });
  const nameBytes = toHex(name, { size: 16 });
  return concat([typeBytes, nsBytes, nameBytes]);
}

const URI_STORAGE_TABLE_ID = tableResourceId('Items', 'URIStorage');

// ============ ABI ============

const worldAbi = parseAbi([
  'function getRecord(bytes32 tableId, bytes32[] keyTuple) view returns (bytes staticData, bytes32 encodedLengths, bytes dynamicData)',
  'function UD__adminUpdateItemMetadata(uint256 itemId, string newUri)',
]);

// ============ Helpers ============

function keyTuple(id: number | bigint): Hex[] {
  return [toHex(BigInt(id), { size: 32 })];
}

function decodeUriRecord(dynamicData: Hex): string {
  if (!dynamicData || dynamicData === '0x') return '';
  const bytes = Buffer.from(dynamicData.slice(2), 'hex');
  return bytes.toString('utf-8');
}

// ============ Main ============

async function main() {
  const args = process.argv.slice(2);
  let worldAddress: Address | undefined = process.env.WORLD_ADDRESS as Address | undefined;
  let rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  let doApply = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--world' && args[i + 1]) {
      worldAddress = args[i + 1] as Address;
      i++;
    } else if (args[i] === '--rpc' && args[i + 1]) {
      rpcUrl = args[i + 1];
      i++;
    } else if (args[i] === '--apply') {
      doApply = true;
    }
  }

  if (!worldAddress) {
    console.error('Error: WORLD_ADDRESS env var or --world flag required');
    process.exit(1);
  }

  const chainId = parseInt(process.env.CHAIN_ID || '31337');
  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  // Step 1: Scan on-chain URIs to build uri→id map
  console.log('Scanning on-chain item URIs...');
  const uriToId = new Map<string, bigint>();
  const MAX_EMPTY_GAP = 20;
  let consecutiveEmpty = 0;

  for (let id = 1n; consecutiveEmpty < MAX_EMPTY_GAP; id++) {
    try {
      const [, , dynamicData] = await publicClient.readContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'getRecord',
        args: [URI_STORAGE_TABLE_ID, keyTuple(id)],
      });
      const uri = decodeUriRecord(dynamicData as Hex);
      if (uri) {
        uriToId.set(uri, id);
        consecutiveEmpty = 0;
      } else {
        consecutiveEmpty++;
      }
    } catch {
      consecutiveEmpty++;
    }
  }

  console.log(`Found ${uriToId.size} items on-chain\n`);

  // Step 2: Match renames
  const updates: { itemId: bigint; newUri: string; label: string }[] = [];
  for (const rename of RENAMES) {
    const itemId = uriToId.get(rename.oldUri);
    if (itemId) {
      updates.push({ itemId, newUri: rename.newUri, label: rename.label });
      console.log(`  ✓ ${rename.label} (item #${itemId})`);
    } else {
      console.log(`  ✗ ${rename.label} — old URI "${rename.oldUri}" not found on-chain`);
    }
  }

  if (updates.length === 0) {
    console.log('\nNo items to rename.');
    return;
  }

  if (!doApply) {
    console.log(`\nDry run: ${updates.length} items would be renamed. Use --apply to push changes.`);
    return;
  }

  // Step 3: Apply renames
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY required for --apply');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  console.log(`\nApplying ${updates.length} renames...`);
  let currentNonce = await publicClient.getTransactionCount({ address: account.address });

  for (const update of updates) {
    const hash = await walletClient.writeContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__adminUpdateItemMetadata',
      args: [update.itemId, update.newUri],
      nonce: currentNonce++,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  Renamed item #${update.itemId}: ${update.label}`);
    await sleep(2000);
  }

  console.log('\nDone.');
}

main().catch(console.error);
