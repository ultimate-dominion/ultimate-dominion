#!/usr/bin/env npx tsx
/**
 * Wipe Monsters — Remove all non-character entities from the 10x10 map.
 * Monsters auto-respawn via MapSpawnSystem when players enter tiles.
 *
 * Usage:
 *   cp .env.mainnet .env   # ensure correct world + private key
 *   npx tsx scripts/admin/wipe-monsters.ts
 *
 * Dry run (scan only):
 *   npx tsx scripts/admin/wipe-monsters.ts --dry-run
 */

import { config } from 'dotenv';
config();

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  Hex,
  Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const worldAbi = parseAbi([
  'function UD__getEntitiesAtPosition(uint16 x, uint16 y) view returns (bytes32[])',
  'function UD__isValidCharacterId(bytes32 entityId) view returns (bool)',
  'function UD__removeEntitiesFromBoard(bytes32[] entityIds)',
]);

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const worldAddress = process.env.WORLD_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const privateKey = process.env.PRIVATE_KEY as Hex;
  const chainId = parseInt(process.env.CHAIN_ID || '31337');

  if (!worldAddress) { console.error('WORLD_ADDRESS not set'); process.exit(1); }
  if (!privateKey && !dryRun) { console.error('PRIVATE_KEY not set'); process.exit(1); }

  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  console.log('=== Wipe Monsters ===');
  console.log(`World: ${worldAddress}`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Phase 1: Scan all tiles for non-character entities
  const monstersToRemove: Hex[] = [];

  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      const entities = await publicClient.readContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'UD__getEntitiesAtPosition',
        args: [x, y],
      });

      for (const entityId of entities) {
        const isCharacter = await publicClient.readContract({
          address: worldAddress,
          abi: worldAbi,
          functionName: 'UD__isValidCharacterId',
          args: [entityId],
        });

        if (!isCharacter) {
          monstersToRemove.push(entityId);
          console.log(`  Monster at (${x}, ${y}): ${entityId}`);
        }
      }
    }
  }

  console.log(`\nFound ${monstersToRemove.length} monsters to remove`);

  if (monstersToRemove.length === 0 || dryRun) {
    console.log(dryRun ? 'Dry run complete.' : 'No monsters on map.');
    return;
  }

  // Phase 2: Remove in batches of 20
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  let nonce = await publicClient.getTransactionCount({ address: account.address });

  const BATCH_SIZE = 20;
  const batches = Math.ceil(monstersToRemove.length / BATCH_SIZE);
  console.log(`\nRemoving in ${batches} batch(es)...`);

  for (let b = 0; b < batches; b++) {
    const batch = monstersToRemove.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    console.log(`  Batch ${b + 1}/${batches}: ${batch.length} monsters`);

    const hash = await walletClient.writeContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__removeEntitiesFromBoard',
      args: [batch],
      nonce,
    });
    nonce++;
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`    tx: ${hash}`);
    await sleep(2000);
  }

  console.log(`\nRemoved ${monstersToRemove.length} monsters. They will respawn as players explore.`);
  console.log('=== Done ===');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
