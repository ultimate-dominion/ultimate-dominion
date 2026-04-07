#!/usr/bin/env npx tsx
/**
 * Rename monster metadataUri on-chain to match new D&D archetype roster.
 * Reads all mobs, finds monsters with old URIs, writes new ones.
 *
 * Usage:
 *   cd packages/contracts
 *   bash -c 'set -a && source .env && set +a && npx tsx scripts/admin/rename-monsters-v4.ts'
 *   bash -c 'set -a && source .env && set +a && npx tsx scripts/admin/rename-monsters-v4.ts --update'
 */

import { config } from 'dotenv';
config();

import {
  createPublicClient, createWalletClient, http, type Hex, type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

const WORLD_ADDRESS = process.env.WORLD_ADDRESS as Address;
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '31337');
const doUpdate = process.argv.includes('--update');

// MUD table ID for UD:Mobs
function computeTableId(namespace: string, name: string): Hex {
  const ns = Buffer.alloc(14); ns.write(namespace);
  const nm = Buffer.alloc(16); nm.write(name);
  return ('0x7462' + ns.toString('hex') + nm.toString('hex')) as Hex;
}

const MOBS_TABLE = computeTableId('UD', 'Mobs');

function padKey(v: number): Hex {
  return ('0x' + BigInt(v).toString(16).padStart(64, '0')) as Hex;
}

// Old URI → New URI mapping
const RENAMES: Record<string, string> = {
  // Z1 Dark Cave
  'monster:fungal_shaman':     'monster:kobold',
  'monster:cavern_brute':      'monster:goblin',
  'monster:crystal_elemental': 'monster:giant_spider',
  'monster:ironhide_troll':    'monster:skeleton',
  'monster:phase_spider':      'monster:goblin_shaman',
  'monster:bonecaster':        'monster:gelatinous_ooze',
  'monster:rock_golem':        'monster:bugbear',
  'monster:pale_stalker':      'monster:carrion_crawler',
  'monster:dusk_drake':        'monster:hook_horror',
  // Z2 Windy Peaks
  'monster:ridge_stalker':     'monster:dire_wolf',
  'monster:frost_wraith':      'monster:harpy',
  'monster:granite_sentinel':  'monster:ogre',
  'monster:gale_phantom':      'monster:worg',
  'monster:blighthorn':        'monster:orc',
  'monster:storm_shrike':      'monster:orc_shaman',
  'monster:hollow_scout':      'monster:troll',
  'monster:ironpeak_charger':  'monster:griffon',
  'monster:peakfire_wraith':   'monster:manticore',
};

const storeAbi = [
  { name: 'getRecord', type: 'function', stateMutability: 'view' as const,
    inputs: [{ name: 'tableId', type: 'bytes32' as const }, { name: 'keyTuple', type: 'bytes32[]' as const }],
    outputs: [{ name: 'staticData', type: 'bytes' as const }, { name: 'encodedLengths', type: 'bytes32' as const },
              { name: 'dynamicData', type: 'bytes' as const }] },
] as const;

const worldAbi = [
  { name: 'UD__setField', type: 'function', stateMutability: 'nonpayable' as const,
    inputs: [{ name: 'tableId', type: 'bytes32' as const }, { name: 'keyTuple', type: 'bytes32[]' as const },
             { name: 'fieldIndex', type: 'uint8' as const }, { name: 'data', type: 'bytes' as const }],
    outputs: [] },
] as const;

function decodeMobRecord(staticData: Hex, dynamicData: Hex): { mobType: number; metadataUri: string } {
  // Static: mobType (1 byte) + mobStats offset stuff
  const mobType = parseInt(staticData.slice(2, 4), 16);

  // Dynamic data has mobStats (bytes) + mobMetadata (string)
  // We need to parse the packed encoding. The encodedLengths tells us sizes.
  // For simplicity, decode the metadata string from the end of dynamic data.
  // MUD stores dynamic fields packed: [mobStats bytes][mobMetadata string]
  // We can read it by finding the UTF-8 portion.
  const rawBytes = Buffer.from(dynamicData.slice(2), 'hex');
  // Find the "monster:" prefix in the raw bytes
  const monsterPrefix = Buffer.from('monster:');
  const idx = rawBytes.indexOf(monsterPrefix);
  if (idx === -1) return { mobType, metadataUri: '' };
  const metadataUri = rawBytes.subarray(idx).toString('utf-8');
  return { mobType, metadataUri };
}

function decodeMobRecordFromLengths(staticData: Hex, encodedLengths: Hex, dynamicData: Hex): { mobType: number; metadataUri: string } {
  const mobType = parseInt(staticData.slice(2, 4), 16);

  // MUD PackedCounter: last 7 bytes of encodedLengths = total, then each field is 5 bytes
  // For Mobs: 2 dynamic fields: mobStats (bytes), mobMetadata (string)
  // Decode field lengths from the packed counter
  const lenHex = encodedLengths.slice(2); // 64 hex chars = 32 bytes
  // Bytes 0-4 (10 hex): total length
  // Bytes 5-9: field 0 length (mobStats)
  // Bytes 10-14: field 1 length (mobMetadata)
  // Actually MUD PackedCounter format: last 5 bytes = total, then fields from right to left in 5-byte chunks
  // Let me use a simpler approach: just find "monster:" in the dynamic data
  const rawBytes = Buffer.from(dynamicData.slice(2), 'hex');
  const monsterPrefix = Buffer.from('monster:');
  const idx = rawBytes.indexOf(monsterPrefix);
  if (idx === -1) {
    // Maybe it's an NPC or shop with different prefix
    return { mobType, metadataUri: rawBytes.subarray(idx >= 0 ? idx : 0).toString('utf-8') };
  }
  const metadataUri = rawBytes.subarray(idx).toString('utf-8');
  return { mobType, metadataUri };
}

async function main() {
  const chain = CHAIN_ID === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

  console.log('============================================================');
  console.log('  Monster Rename V4 — D&D Archetype Roster');
  console.log('============================================================');
  console.log(`World: ${WORLD_ADDRESS}`);
  console.log(`Chain: ${CHAIN_ID}`);
  console.log(`Mode: ${doUpdate ? 'UPDATE' : 'DRY RUN (add --update to apply)'}`);
  console.log('');

  const renames: { mobId: number; oldUri: string; newUri: string }[] = [];

  // Scan all mob IDs
  for (let mobId = 1; mobId <= 70; mobId++) {
    try {
      const [staticData, encodedLengths, dynamicData] = await publicClient.readContract({
        address: WORLD_ADDRESS,
        abi: storeAbi,
        functionName: 'getRecord',
        args: [MOBS_TABLE, [padKey(mobId)]],
      });

      if (!dynamicData || dynamicData === '0x') continue;

      const { mobType, metadataUri } = decodeMobRecordFromLengths(
        staticData as Hex, encodedLengths as Hex, dynamicData as Hex
      );

      if (mobType !== 0) {
        console.log(`  Mob ${mobId}: type=${mobType} (NPC/Shop), skip`);
        continue;
      }

      const newUri = RENAMES[metadataUri];
      if (newUri) {
        console.log(`  Mob ${mobId}: ${metadataUri} → ${newUri}`);
        renames.push({ mobId, oldUri: metadataUri, newUri });
      } else {
        console.log(`  Mob ${mobId}: ${metadataUri} (unchanged)`);
      }
    } catch {
      // Mob doesn't exist
      break;
    }
  }

  console.log(`\nFound ${renames.length} monsters to rename.`);

  if (!doUpdate || renames.length === 0) {
    if (!doUpdate) console.log('\nDry run complete. Add --update to apply changes.');
    return;
  }

  // For on-chain updates, we need to use a forge script (Mobs.setMobMetadata requires root access)
  // Generate the forge script commands
  console.log('\n--- Forge script needed ---');
  console.log('Mobs.setMobMetadata requires root system access.');
  console.log('Generate and run a forge script with these calls:\n');
  for (const { mobId, newUri } of renames) {
    console.log(`  Mobs.setMobMetadata(${mobId}, "${newUri}");`);
  }
  console.log('\nUse the pattern from script/admin/RenameV3.s.sol');
}

main().catch(e => { console.error(e); process.exit(1); });
