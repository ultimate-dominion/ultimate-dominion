#!/usr/bin/env npx tsx
/**
 * Fix Basilisk inventory — mob 12 has only 2 combat weapons instead of 23 items.
 *
 * Root cause: UpdateMonsterInventories.s.sol wrote the full inventory to mob 11 (shop)
 * instead of mob 12 (Basilisk). This script reads mob 11's MonsterStats (which has
 * the correct 23-item inventory), fixes stats to CombatBalancePatch values
 * (STR 17, HP 130, Level 12), and writes to mob 12.
 *
 * Also restores mob 11 to its original shop stats.
 *
 * Usage:
 *   npx tsx scripts/admin/fix-basilisk-inventory.ts
 *   npx tsx scripts/admin/fix-basilisk-inventory.ts --dry-run
 */

import { config } from 'dotenv';
config({ path: '.env.mainnet', override: false });

import {
  createPublicClient,
  createWalletClient,
  http,
  Hex,
  Address,
  decodeAbiParameters,
  encodeAbiParameters,
  parseAbiParameters,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

const storeAbi = [
  {
    name: 'getDynamicField',
    type: 'function',
    inputs: [
      { name: 'tableId', type: 'bytes32' },
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'dynamicFieldIndex', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    name: 'setDynamicField',
    type: 'function',
    inputs: [
      { name: 'tableId', type: 'bytes32' },
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'dynamicFieldIndex', type: 'uint8' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// MonsterStats struct ABI type (matches Solidity struct field order)
const monsterStatsType = parseAbiParameters(
  '(int256 agility, int256 armor, uint8 class, uint256 experience, bool hasBossAI, int256 hitPoints, int256 intelligence, uint256[] inventory, uint256 level, int256 strength)'
);

function mobsTableId(): Hex {
  const ns = Buffer.alloc(14);
  ns.write('UD');
  const nm = Buffer.alloc(16);
  nm.write('Mobs');
  return ('0x7462' + ns.toString('hex') + nm.toString('hex')) as Hex;
}

function mobKey(mobId: number): Hex[] {
  return [('0x' + mobId.toString(16).padStart(64, '0')) as Hex];
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

  const tableId = mobsTableId();

  console.log('=== Fix Basilisk Inventory ===');
  console.log(`World: ${worldAddress}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  // Read mob 11's mobStats (dynamic field index 0 in Mobs table)
  // Mobs schema: mobType (static uint8), mobStats (dynamic bytes), mobMetadata (dynamic string)
  const mob11Stats = await publicClient.readContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'getDynamicField',
    args: [tableId, mobKey(11), 0],
  }) as Hex;

  // Read mob 12's current mobStats
  const mob12Stats = await publicClient.readContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'getDynamicField',
    args: [tableId, mobKey(12), 0],
  }) as Hex;

  // Decode both
  const [mob11Decoded] = decodeAbiParameters(monsterStatsType, mob11Stats);
  const [mob12Decoded] = decodeAbiParameters(monsterStatsType, mob12Stats);

  console.log('\nMob 11 (has correct inventory, wrong mob):');
  console.log(`  STR=${mob11Decoded.strength} AGI=${mob11Decoded.agility} INT=${mob11Decoded.intelligence}`);
  console.log(`  HP=${mob11Decoded.hitPoints} ARM=${mob11Decoded.armor} LVL=${mob11Decoded.level}`);
  console.log(`  Inventory: ${mob11Decoded.inventory.length} items`);
  console.log(`  IDs: [${mob11Decoded.inventory.join(', ')}]`);

  console.log('\nMob 12 (Basilisk, current):');
  console.log(`  STR=${mob12Decoded.strength} AGI=${mob12Decoded.agility} INT=${mob12Decoded.intelligence}`);
  console.log(`  HP=${mob12Decoded.hitPoints} ARM=${mob12Decoded.armor} LVL=${mob12Decoded.level}`);
  console.log(`  Inventory: ${mob12Decoded.inventory.length} items`);
  console.log(`  IDs: [${mob12Decoded.inventory.join(', ')}]`);

  // Build correct Basilisk stats: mob 12's current stats (from CombatBalancePatch)
  // with mob 11's inventory (from UpdateMonsterInventories)
  const fixedStats = {
    agility: mob12Decoded.agility,      // 12 (from CombatBalancePatch, preserved)
    armor: mob12Decoded.armor,          // 4
    class: mob12Decoded.class,          // 0 (Warrior)
    experience: mob12Decoded.experience, // 10000
    hasBossAI: mob12Decoded.hasBossAI,  // true
    hitPoints: mob12Decoded.hitPoints,   // 130 (from CombatBalancePatch)
    intelligence: mob12Decoded.intelligence, // 10
    inventory: mob11Decoded.inventory,   // 23 items from mob 11!
    level: mob12Decoded.level,          // 12 (from CombatBalancePatch)
    strength: mob12Decoded.strength,    // 17 (from CombatBalancePatch)
  };

  console.log('\nFixed Basilisk (mob 12):');
  console.log(`  STR=${fixedStats.strength} AGI=${fixedStats.agility} INT=${fixedStats.intelligence}`);
  console.log(`  HP=${fixedStats.hitPoints} ARM=${fixedStats.armor} LVL=${fixedStats.level}`);
  console.log(`  Inventory: ${fixedStats.inventory.length} items`);

  // Encode fixed stats
  const fixedEncoded = encodeAbiParameters(monsterStatsType, [fixedStats]);

  if (dryRun) {
    console.log('\nDry run — no changes made.');
    return;
  }

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  // Write fixed stats to mob 12
  console.log('\nWriting fixed MonsterStats to mob 12...');
  const hash = await walletClient.writeContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'setDynamicField',
    args: [tableId, mobKey(12), 0, fixedEncoded],
  });

  console.log(`Tx submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  // Verify
  const verifyStats = await publicClient.readContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'getDynamicField',
    args: [tableId, mobKey(12), 0],
  }) as Hex;

  const [verified] = decodeAbiParameters(monsterStatsType, verifyStats);
  console.log(`\nVerified mob 12 inventory: ${verified.inventory.length} items`);
  console.log(`IDs: [${verified.inventory.join(', ')}]`);
  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
