#!/usr/bin/env npx tsx
/**
 * Configure zone boundaries and settings via viem setStaticField.
 * Replaces ConfigureZones.s.sol (broken by forge 1.5.1 address(this) rejection).
 *
 * Usage:
 *   source .env.testnet && npx tsx scripts/admin/configure-zones.ts
 *   source .env.testnet && npx tsx scripts/admin/configure-zones.ts --dry-run
 *   source .env.mainnet && npx tsx scripts/admin/configure-zones.ts --mainnet
 */

import {
  createPublicClient, createWalletClient, http, toHex, padHex, parseAbi,
  type Hex, type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

const PROD_WORLD = '0x99d01939F58B965E6E84a1D167E710Abdf5764b0';

// Table IDs (from codegen)
const ZONE_CONFIG_TABLE = '0x746255440000000000000000000000005a6f6e65436f6e666967000000000000' as Hex;
const ZONE_MAP_CONFIG_TABLE = '0x746255440000000000000000000000005a6f6e654d6170436f6e666967000000' as Hex;

// Field layouts (from codegen)
const ZONE_CONFIG_FIELD_LAYOUT = '0x0040020020200000000000000000000000000000000000000000000000000000' as Hex;
const ZONE_MAP_CONFIG_FIELD_LAYOUT = '0x0028050002020202200000000000000000000000000000000000000000000000' as Hex;

const worldAbi = parseAbi([
  'function getStaticField(bytes32 tableId, bytes32[] calldata keyTuple, uint8 fieldIndex, bytes32 fieldLayout) view returns (bytes)',
  'function setStaticField(bytes32 tableId, bytes32[] calldata keyTuple, uint8 fieldIndex, bytes calldata data, bytes32 fieldLayout)',
]);

function padKey(v: number | bigint): Hex {
  return padHex(toHex(BigInt(v), { size: 32 }), { size: 32 });
}

// Zone definitions
const ZONES = [
  {
    name: 'Dark Cave',
    zoneId: 1,
    config: { maxLevel: 10, badgeBase: 100 },
    mapConfig: { width: 10, height: 10, originX: 0, originY: 0, minLevel: 1 },
  },
  {
    name: 'Windy Peaks',
    zoneId: 2,
    config: { maxLevel: 20, badgeBase: 101 },
    mapConfig: { width: 10, height: 10, originX: 0, originY: 100, minLevel: 10 },
  },
];

async function main() {
  const worldAddress = process.env.WORLD_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const privateKey = process.env.PRIVATE_KEY as Hex;
  const chainId = parseInt(process.env.CHAIN_ID || '31337');
  const isMainnet = process.argv.includes('--mainnet');
  const dryRun = process.argv.includes('--dry-run');

  if (isMainnet && worldAddress.toLowerCase() !== PROD_WORLD.toLowerCase()) {
    console.error(`--mainnet flag set but WORLD_ADDRESS (${worldAddress}) doesn't match prod (${PROD_WORLD})`);
    process.exit(1);
  }

  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ chain, transport: http(rpcUrl), account });

  console.log(`=== Configure Zones ===`);
  console.log(`World: ${worldAddress} | Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  for (const zone of ZONES) {
    const keyTuple = [padKey(zone.zoneId)] as Hex[];
    console.log(`--- ${zone.name} (zoneId=${zone.zoneId}) ---`);

    // ZoneConfig: field 0 = maxLevel (uint256), field 1 = badgeBase (uint256)
    const fields = [
      { table: ZONE_CONFIG_TABLE, layout: ZONE_CONFIG_FIELD_LAYOUT, index: 0, name: 'maxLevel', value: zone.config.maxLevel, size: 32 },
      { table: ZONE_CONFIG_TABLE, layout: ZONE_CONFIG_FIELD_LAYOUT, index: 1, name: 'badgeBase', value: zone.config.badgeBase, size: 32 },
      // ZoneMapConfig: field 0-3 = uint16, field 4 = uint256
      { table: ZONE_MAP_CONFIG_TABLE, layout: ZONE_MAP_CONFIG_FIELD_LAYOUT, index: 0, name: 'width', value: zone.mapConfig.width, size: 2 },
      { table: ZONE_MAP_CONFIG_TABLE, layout: ZONE_MAP_CONFIG_FIELD_LAYOUT, index: 1, name: 'height', value: zone.mapConfig.height, size: 2 },
      { table: ZONE_MAP_CONFIG_TABLE, layout: ZONE_MAP_CONFIG_FIELD_LAYOUT, index: 2, name: 'originX', value: zone.mapConfig.originX, size: 2 },
      { table: ZONE_MAP_CONFIG_TABLE, layout: ZONE_MAP_CONFIG_FIELD_LAYOUT, index: 3, name: 'originY', value: zone.mapConfig.originY, size: 2 },
      { table: ZONE_MAP_CONFIG_TABLE, layout: ZONE_MAP_CONFIG_FIELD_LAYOUT, index: 4, name: 'minLevel', value: zone.mapConfig.minLevel, size: 32 },
    ];

    for (const f of fields) {
      // Read current value
      const currentRaw = await publicClient.readContract({
        address: worldAddress, abi: worldAbi, functionName: 'getStaticField',
        args: [f.table, keyTuple, f.index, f.layout],
      });
      const currentVal = f.size === 32
        ? BigInt(currentRaw as Hex)
        : BigInt('0x' + (currentRaw as string).slice(2).slice(0, f.size * 2));

      const desiredVal = BigInt(f.value);
      const match = currentVal === desiredVal;

      if (match) {
        console.log(`  ${f.name}: ${currentVal} (OK)`);
      } else {
        console.log(`  ${f.name}: ${currentVal} -> ${desiredVal} ${dryRun ? '(would update)' : '(updating...)'}`);
        if (!dryRun) {
          const data = toHex(desiredVal, { size: f.size });
          const hash = await walletClient.writeContract({
            address: worldAddress, abi: worldAbi, functionName: 'setStaticField',
            args: [f.table, keyTuple, f.index, data, f.layout],
          });
          await publicClient.waitForTransactionReceipt({ hash });

          // Verify write
          const verifyRaw = await publicClient.readContract({
            address: worldAddress, abi: worldAbi, functionName: 'getStaticField',
            args: [f.table, keyTuple, f.index, f.layout],
          });
          const verifyVal = f.size === 32
            ? BigInt(verifyRaw as Hex)
            : BigInt('0x' + (verifyRaw as string).slice(2).slice(0, f.size * 2));

          if (verifyVal !== desiredVal) {
            console.error(`    VERIFICATION FAILED: wrote ${desiredVal} but read back ${verifyVal}`);
            process.exit(1);
          }
          console.log(`    -> tx: ${hash} (verified)`);
        }
      }
    }
    console.log('');
  }

  console.log('Done!');
}

main().catch((e) => { console.error(e); process.exit(1); });
