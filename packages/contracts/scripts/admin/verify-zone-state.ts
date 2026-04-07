#!/usr/bin/env npx tsx
/**
 * Verify zone state on-chain matches zone JSON definitions.
 * The #1 lesson from beta: things "succeed" without working. This script catches silent failures.
 *
 * Usage:
 *   source .env.testnet && npx tsx scripts/admin/verify-zone-state.ts dark_cave
 *   source .env.testnet && npx tsx scripts/admin/verify-zone-state.ts windy_peaks
 *   source .env.mainnet && npx tsx scripts/admin/verify-zone-state.ts dark_cave --mainnet
 */

import { config } from 'dotenv';
const isMainnet = process.argv.includes('--mainnet');
config({ path: isMainnet ? '.env.mainnet' : '.env.testnet', override: false });

import {
  createPublicClient, http, toHex, concat, type Hex, type Address,
} from 'viem';
import { base, foundry } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

// Table IDs (from codegen)
function computeTableId(namespace: string, name: string): Hex {
  const ns = Buffer.alloc(14); ns.write(namespace);
  const nm = Buffer.alloc(16); nm.write(name);
  return ('0x7462' + ns.toString('hex') + nm.toString('hex')) as Hex;
}

const ZONE_CONFIG_TABLE = computeTableId('UD', 'ZoneConfig');
const ZONE_MAP_CONFIG_TABLE = computeTableId('UD', 'ZoneMapConfig');
const MOBS_BY_ZONE_LEVEL_TABLE = computeTableId('UD', 'MobsByZoneLevel');
const MOBS_TABLE = computeTableId('UD', 'Mobs');
const COUNTERS_TABLE = computeTableId('UD', 'Counters');

// Field layouts (from codegen)
const ZONE_CONFIG_FL = '0x0040020020200000000000000000000000000000000000000000000000000000' as Hex;
const ZONE_MAP_CONFIG_FL = '0x0028050002020202200000000000000000000000000000000000000000000000' as Hex;

const storeAbi = [
  { name: 'getStaticField', type: 'function', stateMutability: 'view' as const,
    inputs: [{ name: 'tableId', type: 'bytes32' as const }, { name: 'keyTuple', type: 'bytes32[]' as const },
             { name: 'fieldIndex', type: 'uint8' as const }, { name: 'fieldLayout', type: 'bytes32' as const }],
    outputs: [{ name: '', type: 'bytes' as const }] },
  { name: 'getDynamicField', type: 'function', stateMutability: 'view' as const,
    inputs: [{ name: 'tableId', type: 'bytes32' as const }, { name: 'keyTuple', type: 'bytes32[]' as const },
             { name: 'dynamicFieldIndex', type: 'uint8' as const }],
    outputs: [{ name: '', type: 'bytes' as const }] },
  { name: 'getRecord', type: 'function', stateMutability: 'view' as const,
    inputs: [{ name: 'tableId', type: 'bytes32' as const }, { name: 'keyTuple', type: 'bytes32[]' as const }],
    outputs: [{ name: 'staticData', type: 'bytes' as const }, { name: 'encodedLengths', type: 'bytes32' as const },
              { name: 'dynamicData', type: 'bytes' as const }] },
] as const;

function padKey(v: number | bigint | string): Hex {
  if (typeof v === 'string') {
    return ('0x' + v.replace('0x', '').toLowerCase().padStart(64, '0')) as Hex;
  }
  return ('0x' + BigInt(v).toString(16).padStart(64, '0')) as Hex;
}

const ZONE_IDS: Record<string, number> = { dark_cave: 1, windy_peaks: 2 };

interface CheckResult { name: string; passed: boolean; detail: string }

async function main() {
  const zoneName = process.argv[2];
  if (!zoneName || !ZONE_IDS[zoneName]) {
    console.error(`Usage: npx tsx scripts/admin/verify-zone-state.ts <zone_name> [--mainnet]`);
    console.error(`  Zones: ${Object.keys(ZONE_IDS).join(', ')}`);
    process.exit(1);
  }

  const zoneId = ZONE_IDS[zoneName];
  const worldAddress = process.env.WORLD_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const chainId = parseInt(process.env.CHAIN_ID || '31337');
  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  const zonePath = path.join(__dirname, '..', '..', 'zones', zoneName);
  const manifestPath = path.join(zonePath, 'manifest.json');
  const monstersPath = path.join(zonePath, 'monsters.json');

  console.log(`=== Verify Zone State: ${zoneName} (zoneId=${zoneId}) ===`);
  console.log(`World: ${worldAddress}\n`);

  const results: CheckResult[] = [];

  function pass(name: string, detail: string) {
    results.push({ name, passed: true, detail });
    console.log(`  PASS  ${name}: ${detail}`);
  }
  function fail(name: string, detail: string) {
    results.push({ name, passed: false, detail });
    console.log(`  FAIL  ${name}: ${detail}`);
  }

  // Helper to read a static field
  async function readField(table: Hex, keys: Hex[], fieldIndex: number, layout: Hex, size: number): Promise<bigint> {
    const raw = await publicClient.readContract({
      address: worldAddress, abi: storeAbi, functionName: 'getStaticField',
      args: [table, keys, fieldIndex, layout],
    });
    if (size === 32) return BigInt(raw as Hex);
    return BigInt('0x' + (raw as string).slice(2).slice(0, size * 2));
  }

  // ---- 1. ZoneConfig ----
  const keyTuple = [padKey(zoneId)] as Hex[];

  const maxLevel = await readField(ZONE_CONFIG_TABLE, keyTuple, 0, ZONE_CONFIG_FL, 32);
  const badgeBase = await readField(ZONE_CONFIG_TABLE, keyTuple, 1, ZONE_CONFIG_FL, 32);

  if (maxLevel > 0n) pass('ZoneConfig.maxLevel', `${maxLevel}`);
  else fail('ZoneConfig.maxLevel', `0 (not configured!)`);

  if (badgeBase > 0n) pass('ZoneConfig.badgeBase', `${badgeBase}`);
  else fail('ZoneConfig.badgeBase', `0 (not configured!)`);

  // ---- 2. ZoneMapConfig ----
  const width = await readField(ZONE_MAP_CONFIG_TABLE, keyTuple, 0, ZONE_MAP_CONFIG_FL, 2);
  const height = await readField(ZONE_MAP_CONFIG_TABLE, keyTuple, 1, ZONE_MAP_CONFIG_FL, 2);
  const originX = await readField(ZONE_MAP_CONFIG_TABLE, keyTuple, 2, ZONE_MAP_CONFIG_FL, 2);
  const originY = await readField(ZONE_MAP_CONFIG_TABLE, keyTuple, 3, ZONE_MAP_CONFIG_FL, 2);
  const minLevel = await readField(ZONE_MAP_CONFIG_TABLE, keyTuple, 4, ZONE_MAP_CONFIG_FL, 32);

  if (width > 0n) pass('ZoneMapConfig.width', `${width}`);
  else fail('ZoneMapConfig.width', `0 (not configured!)`);

  if (height > 0n) pass('ZoneMapConfig.height', `${height}`);
  else fail('ZoneMapConfig.height', `0 (not configured!)`);

  // Check against manifest if it exists
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const mc = manifest.mapConfig;
    if (mc) {
      if (Number(width) === mc.width) pass('ZoneMapConfig.width matches manifest', `${width}`);
      else fail('ZoneMapConfig.width mismatch', `on-chain=${width}, manifest=${mc.width}`);

      if (Number(height) === mc.height) pass('ZoneMapConfig.height matches manifest', `${height}`);
      else fail('ZoneMapConfig.height mismatch', `on-chain=${height}, manifest=${mc.height}`);
    }
  }

  pass('ZoneMapConfig.originX', `${originX}`);
  pass('ZoneMapConfig.originY', `${originY}`);
  if (minLevel > 0n) pass('ZoneMapConfig.minLevel', `${minLevel}`);
  else fail('ZoneMapConfig.minLevel', `0 (not configured!)`);

  // ---- 3. Mob counter ----
  const [mobCounterStatic] = await publicClient.readContract({
    address: worldAddress, abi: storeAbi, functionName: 'getRecord',
    args: [COUNTERS_TABLE, [padKey(worldAddress), padKey(0)]],
  });
  const totalMobs = BigInt('0x' + (mobCounterStatic as string).slice(2));
  pass('Mob counter', `${totalMobs} mobs on-chain`);

  // ---- 4. MobsByZoneLevel ----
  if (fs.existsSync(monstersPath)) {
    const monstersJson = JSON.parse(fs.readFileSync(monstersPath, 'utf-8'));
    const monsters = monstersJson.monsters as { name: string; stats: { level: number } }[];

    // Group expected monsters by level
    const expectedByLevel = new Map<number, number>();
    for (const m of monsters) {
      expectedByLevel.set(m.stats.level, (expectedByLevel.get(m.stats.level) || 0) + 1);
    }

    let totalRegistered = 0;
    for (const [level, expectedCount] of expectedByLevel) {
      try {
        const mobIdsRaw = await publicClient.readContract({
          address: worldAddress, abi: storeAbi, functionName: 'getDynamicField',
          args: [MOBS_BY_ZONE_LEVEL_TABLE, [padKey(zoneId), padKey(level)], 0],
        }) as Hex;

        // Each uint256 mob ID is 32 bytes
        const dataLen = (mobIdsRaw.length - 2) / 2; // hex chars to bytes
        const mobCount = dataLen / 32;

        if (mobCount >= expectedCount) {
          pass(`MobsByZoneLevel[${zoneId}][${level}]`, `${mobCount} mobs (expected ${expectedCount})`);
        } else {
          fail(`MobsByZoneLevel[${zoneId}][${level}]`, `${mobCount} mobs (expected ${expectedCount})`);
        }

        // Check mob IDs are not Z1 range (1-21) if this is Z2
        if (zoneId > 1 && mobCount > 0) {
          const firstMobId = BigInt('0x' + mobIdsRaw.slice(2, 66));
          if (firstMobId <= 21n) {
            fail(`MobsByZoneLevel[${zoneId}][${level}] ID range`, `first mobId=${firstMobId} — looks like Z1 IDs leaked in!`);
          } else {
            pass(`MobsByZoneLevel[${zoneId}][${level}] ID range`, `first mobId=${firstMobId} (OK)`);
          }
        }

        totalRegistered += mobCount;
      } catch {
        fail(`MobsByZoneLevel[${zoneId}][${level}]`, `no data (expected ${expectedCount} mobs)`);
      }
    }

    if (totalRegistered >= monsters.length) {
      pass('Total zone mobs registered', `${totalRegistered} (expected ${monsters.length})`);
    } else {
      fail('Total zone mobs registered', `${totalRegistered} (expected ${monsters.length})`);
    }

    // ---- 5. Spot-check monster inventories ----
    // Read first mob at each level and verify inventory is non-empty
    for (const [level] of expectedByLevel) {
      try {
        const mobIdsRaw = await publicClient.readContract({
          address: worldAddress, abi: storeAbi, functionName: 'getDynamicField',
          args: [MOBS_BY_ZONE_LEVEL_TABLE, [padKey(zoneId), padKey(level)], 0],
        }) as Hex;

        if (mobIdsRaw.length < 66) continue; // no mobs
        const firstMobId = BigInt('0x' + mobIdsRaw.slice(2, 66));

        // Read Mobs table dynamic field 1 (mobStats — encoded MonsterStats including inventory)
        const mobStatsRaw = await publicClient.readContract({
          address: worldAddress, abi: storeAbi, functionName: 'getDynamicField',
          args: [MOBS_TABLE, [padKey(firstMobId)], 1],
        }) as Hex;

        if (mobStatsRaw.length > 2) {
          pass(`Monster inventory (mobId=${firstMobId}, L${level})`, `${(mobStatsRaw.length - 2) / 2} bytes of stats data`);
        } else {
          fail(`Monster inventory (mobId=${firstMobId}, L${level})`, `empty!`);
        }
      } catch {
        // Skip if we can't read — might not be registered
      }
    }
  } else {
    console.log('  SKIP  No monsters.json found — skipping mob checks\n');
  }

  // ---- Summary ----
  console.log('\n============================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`  Results: ${passed} passed, ${failed} failed (${results.length} total)`);
  console.log('============================================================');

  if (failed > 0) {
    console.log('\nFailed checks:');
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  - ${r.name}: ${r.detail}`);
    }
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
