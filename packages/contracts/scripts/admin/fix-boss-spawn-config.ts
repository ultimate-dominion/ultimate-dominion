#!/usr/bin/env npx tsx
/**
 * Fix BossSpawnConfig — Update bossMobId from 12 (shop) to 11 (Basilisk).
 *
 * The Basilisk was created as mob 11, but BossSpawnConfig was incorrectly
 * set to mob 12 (the shop NPC). This fixes the boss spawn to point to
 * the actual Basilisk template.
 *
 * Usage:
 *   npx tsx scripts/admin/fix-boss-spawn-config.ts
 *   npx tsx scripts/admin/fix-boss-spawn-config.ts --dry-run
 */

import { config } from 'dotenv';
config({ path: '.env.mainnet', override: false });

import {
  createPublicClient,
  createWalletClient,
  http,
  Hex,
  Address,
  encodeAbiParameters,
  parseAbiParameters,
  pad,
  numberToHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

// MUD store setRecord ABI
const storeAbi = [
  {
    name: 'setRecord',
    type: 'function',
    inputs: [
      { name: 'tableId', type: 'bytes32' },
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'staticData', type: 'bytes' },
      { name: 'encodedLengths', type: 'bytes32' },
      { name: 'dynamicData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getRecord',
    type: 'function',
    inputs: [
      { name: 'tableId', type: 'bytes32' },
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'fieldLayout', type: 'bytes32' },
    ],
    outputs: [
      { name: 'staticData', type: 'bytes' },
      { name: 'encodedLengths', type: 'bytes32' },
      { name: 'dynamicData', type: 'bytes' },
    ],
    stateMutability: 'view',
  },
] as const;

// BossSpawnConfig table (namespace: UD, name: BossSpawnConfig)
// Key: [] (singleton)
// Schema: { bossMobId: uint256, spawnChanceBp: uint256 }
// FieldLayout: 2 static uint256 fields = 64 bytes total, 0 dynamic fields

function computeTableId(namespace: string, name: string): Hex {
  const ns = Buffer.alloc(14);
  ns.write(namespace);
  const nm = Buffer.alloc(16);
  nm.write(name);
  return ('0x7462' + ns.toString('hex') + nm.toString('hex')) as Hex;
}

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

  const tableId = computeTableId('UD', 'BossSpawnConfig');
  // FieldLayout: 2 static uint256 fields (32 bytes each = 64 total), 2 fields, 0 dynamic
  const fieldLayout = '0x0040020020200000000000000000000000000000000000000000000000000000' as Hex;

  console.log('=== Fix BossSpawnConfig ===');
  console.log(`World: ${worldAddress}`);
  console.log(`Table: ${tableId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  // Read current config
  const [currentStatic] = await publicClient.readContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'getRecord',
    args: [tableId, [], fieldLayout],
  });

  const currentHex = (currentStatic as string).slice(2);
  const currentBossMobId = BigInt('0x' + currentHex.slice(0, 64));
  const currentChanceBp = BigInt('0x' + currentHex.slice(64, 128));

  console.log(`\nCurrent: bossMobId=${currentBossMobId}, spawnChanceBp=${currentChanceBp}`);

  const newBossMobId = 11n;
  const newChanceBp = currentChanceBp; // keep existing chance

  console.log(`New:     bossMobId=${newBossMobId}, spawnChanceBp=${newChanceBp}`);

  if (currentBossMobId === newBossMobId) {
    console.log('\nAlready correct. Nothing to do.');
    return;
  }

  if (dryRun) {
    console.log('\nDry run — no changes made.');
    return;
  }

  // Write new config
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  // Encode static data: bossMobId (uint256) + spawnChanceBp (uint256)
  const newStaticData = encodeAbiParameters(
    parseAbiParameters('uint256, uint256'),
    [newBossMobId, newChanceBp],
  );

  const hash = await walletClient.writeContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'setRecord',
    args: [
      tableId,
      [], // empty key tuple (singleton)
      newStaticData,
      '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex, // no dynamic fields
      '0x' as Hex, // no dynamic data
    ],
  });

  console.log(`\nTx submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  // Verify
  const [verifyStatic] = await publicClient.readContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'getRecord',
    args: [tableId, [], fieldLayout],
  });

  const verifyHex = (verifyStatic as string).slice(2);
  const verifyBossMobId = BigInt('0x' + verifyHex.slice(0, 64));
  console.log(`Verified: bossMobId=${verifyBossMobId}`);
  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
