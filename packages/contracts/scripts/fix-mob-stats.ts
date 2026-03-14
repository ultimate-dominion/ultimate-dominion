#!/usr/bin/env npx tsx
/**
 * One-time migration: re-encode mob stats with hasBossAI field
 *
 * V3 added hasBossAI to MonsterStats struct but existing mob data
 * was encoded without it. This causes abi.decode to panic when
 * spawnMob tries to read mob templates.
 *
 * Reads existing mobStats bytes, decodes with OLD layout, re-encodes
 * with NEW layout (hasBossAI = false), writes back to Mobs table.
 */

import { config } from 'dotenv';
const envFile = process.env.CHAIN_ID === '8453' ? '.env.mainnet' : '.env';
config({ path: envFile, override: false });

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  decodeAbiParameters,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

const WORLD_ADDRESS = process.env.WORLD_ADDRESS as Address;
const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;

const MOBS_TABLE_ID = '0x746255440000000000000000000000004d6f6273000000000000000000000000' as Hex;

// Old MonsterStats struct (without hasBossAI)
const OLD_MONSTER_STATS_ABI = [
  {
    type: 'tuple',
    components: [
      { name: 'agility', type: 'int256' },
      { name: 'armor', type: 'int256' },
      { name: 'class', type: 'uint8' },
      { name: 'experience', type: 'uint256' },
      { name: 'hitPoints', type: 'int256' },
      { name: 'intelligence', type: 'int256' },
      { name: 'inventory', type: 'uint256[]' },
      { name: 'level', type: 'uint256' },
      { name: 'strength', type: 'int256' },
    ],
  },
] as const;

// New MonsterStats struct (with hasBossAI)
const NEW_MONSTER_STATS_ABI = [
  {
    type: 'tuple',
    components: [
      { name: 'agility', type: 'int256' },
      { name: 'armor', type: 'int256' },
      { name: 'class', type: 'uint8' },
      { name: 'experience', type: 'uint256' },
      { name: 'hasBossAI', type: 'bool' },
      { name: 'hitPoints', type: 'int256' },
      { name: 'intelligence', type: 'int256' },
      { name: 'inventory', type: 'uint256[]' },
      { name: 'level', type: 'uint256' },
      { name: 'strength', type: 'int256' },
    ],
  },
] as const;

// MUD Store ABI for reading/writing dynamic fields
const storeAbi = [
  {
    name: 'getDynamicField',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tableId', type: 'bytes32' },
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'dynamicFieldIndex', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
  },
  {
    name: 'setDynamicField',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tableId', type: 'bytes32' },
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'dynamicFieldIndex', type: 'uint8' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'getStaticField',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tableId', type: 'bytes32' },
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'fieldIndex', type: 'uint8' },
      { name: 'fieldLayout', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const;

const MOBS_FIELD_LAYOUT = '0x0001010001000000000000000000000000000000000000000000000000000000' as Hex;

// Boss mob IDs (from monsters.json — Basilisk is the only boss)
const BOSS_MOB_IDS = new Set<number>([11]); // Basilisk is mob 11

async function main() {
  const chainId = parseInt(process.env.CHAIN_ID || '31337');
  const chain = chainId === 8453 ? base : foundry;

  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
  const account = privateKeyToAccount(PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

  console.log(`World: ${WORLD_ADDRESS}`);
  console.log(`Account: ${account.address}`);
  console.log(`Chain: ${chainId}`);

  // Track nonce explicitly to avoid L2 RPC lag
  let nonce = await publicClient.getTransactionCount({ address: account.address });
  console.log(`Starting nonce: ${nonce}`);

  // Check each mob ID
  for (let mobId = 1; mobId <= 14; mobId++) {
    const keyTuple = [`0x${mobId.toString(16).padStart(64, '0')}`] as Hex[];

    // Check if mob exists by reading mobType
    let mobType: number;
    try {
      const raw = await publicClient.readContract({
        address: WORLD_ADDRESS,
        abi: storeAbi,
        functionName: 'getStaticField',
        args: [MOBS_TABLE_ID, keyTuple, 0, MOBS_FIELD_LAYOUT],
      });
      mobType = parseInt(raw.slice(-2), 16);
    } catch {
      console.log(`Mob ${mobId}: does not exist, skipping`);
      continue;
    }

    // Only process Monsters (type 0), not NPCs (1) or Shops (2)
    if (mobType !== 0) {
      console.log(`Mob ${mobId}: type ${mobType} (not a monster), skipping`);
      continue;
    }

    // Read current mobStats bytes (dynamic field index 0)
    let oldBytes: Hex;
    try {
      oldBytes = await publicClient.readContract({
        address: WORLD_ADDRESS,
        abi: storeAbi,
        functionName: 'getDynamicField',
        args: [MOBS_TABLE_ID, keyTuple, 0],
      }) as Hex;
    } catch (e) {
      console.log(`Mob ${mobId}: failed to read mobStats, skipping`);
      continue;
    }

    if (!oldBytes || oldBytes === '0x') {
      console.log(`Mob ${mobId}: empty mobStats, skipping`);
      continue;
    }

    // Try decoding with NEW struct first — if it works, already migrated
    try {
      decodeAbiParameters(NEW_MONSTER_STATS_ABI, oldBytes);
      console.log(`Mob ${mobId}: already has hasBossAI, skipping`);
      continue;
    } catch {
      // Expected — needs migration
    }

    // Decode with OLD struct
    let oldStats: any;
    try {
      [oldStats] = decodeAbiParameters(OLD_MONSTER_STATS_ABI, oldBytes);
    } catch (e) {
      console.error(`Mob ${mobId}: failed to decode with old struct:`, e);
      continue;
    }

    const hasBossAI = BOSS_MOB_IDS.has(mobId);

    console.log(`Mob ${mobId}: ${oldStats.agility >= 0 ? '+' : ''}${oldStats.agility} agi, lvl ${oldStats.level}, hasBossAI=${hasBossAI} — re-encoding...`);

    // Re-encode with NEW struct
    const newBytes = encodeAbiParameters(NEW_MONSTER_STATS_ABI, [
      {
        agility: oldStats.agility,
        armor: oldStats.armor,
        class: oldStats.class,
        experience: oldStats.experience,
        hasBossAI,
        hitPoints: oldStats.hitPoints,
        intelligence: oldStats.intelligence,
        inventory: oldStats.inventory,
        level: oldStats.level,
        strength: oldStats.strength,
      },
    ]);

    // Write new bytes to Mobs table
    const hash = await walletClient.writeContract({
      address: WORLD_ADDRESS,
      abi: storeAbi,
      functionName: 'setDynamicField',
      args: [MOBS_TABLE_ID, keyTuple, 0, newBytes],
      nonce,
    });
    nonce++;
    console.log(`  tx: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  confirmed`);
  }

  // Verify: try to read mob 1 with getMonsterStats
  console.log('\n=== Verification ===');
  try {
    await publicClient.readContract({
      address: WORLD_ADDRESS,
      abi: [
        {
          name: 'UD__getMonsterStats',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'mobId', type: 'uint256' }],
          outputs: [
            {
              type: 'tuple',
              components: [
                { name: 'agility', type: 'int256' },
                { name: 'armor', type: 'int256' },
                { name: 'class', type: 'uint8' },
                { name: 'experience', type: 'uint256' },
                { name: 'hasBossAI', type: 'bool' },
                { name: 'hitPoints', type: 'int256' },
                { name: 'intelligence', type: 'int256' },
                { name: 'inventory', type: 'uint256[]' },
                { name: 'level', type: 'uint256' },
                { name: 'strength', type: 'int256' },
              ],
            },
          ],
        },
      ],
      functionName: 'UD__getMonsterStats',
      args: [1n],
    });
    console.log('Mob 1 getMonsterStats: SUCCESS');
  } catch (e) {
    console.error('Mob 1 getMonsterStats: STILL FAILS', e);
  }

  console.log('\nDone!');
}

main().catch(console.error);
