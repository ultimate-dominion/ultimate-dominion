#!/usr/bin/env npx tsx
/**
 * Populate Tal Carden Shop — Create shop mob with inventory and spawn at zone 2, (9,9)
 *
 * The zone-loader mob ID bug (gotcha_zone_loader_mob_ids) caused the original
 * shop spawn to use the wrong mob template. This script creates a fresh shop mob
 * with correct ShopsData and spawns it at the right position.
 *
 * Usage:
 *   pnpm zone:load:testnet -- scripts/admin/populate-tal-shop.ts   (wrong - use below)
 *   bash -c 'set -a && source .env.testnet && set +a && npx tsx scripts/admin/populate-tal-shop.ts'
 *   CHAIN_ID=8453 npx tsx scripts/admin/populate-tal-shop.ts [--dry-run]
 */

import { config } from 'dotenv';
const envFile = process.env.CHAIN_ID === '8453' ? '.env.testnet' : '.env';
config({ path: envFile, override: false });

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeAbiParameters,
  toHex,
  concat,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const dryRun = process.argv.includes('--dry-run');

const ZONE_ID = 2; // windy_peaks
const SHOP_X = 9;
const SHOP_Y = 9;

enum MobType {
  Monster = 0,
  NPC = 1,
  Shop = 2,
}

// ============ MUD Resource ID helpers ============

function tableResourceId(namespace: string, name: string): Hex {
  return concat([
    toHex('tb', { size: 2 }),
    toHex(namespace, { size: 14 }),
    toHex(name, { size: 16 }),
  ]);
}

const URI_STORAGE_TABLE_ID = tableResourceId('Items', 'URIStorage');
const COUNTERS_TABLE_ID = tableResourceId('UD', 'Counters');

function padKey(v: number | bigint | string): Hex {
  if (typeof v === 'string') {
    return ('0x' + v.replace('0x', '').toLowerCase().padStart(64, '0')) as Hex;
  }
  return ('0x' + BigInt(v).toString(16).padStart(64, '0')) as Hex;
}

// ============ Shop encoding ============

function encodeShopStats(
  gold: bigint,
  maxGold: bigint,
  priceMarkup: bigint,
  priceMarkdown: bigint,
  restockTimestamp: bigint,
  sellableItems: bigint[],
  buyableItems: bigint[],
  restock: bigint[],
  stock: bigint[],
): Hex {
  return encodeAbiParameters(
    [{
      type: 'tuple',
      components: [
        { name: 'gold', type: 'uint256' },
        { name: 'maxGold', type: 'uint256' },
        { name: 'priceMarkup', type: 'uint256' },
        { name: 'priceMarkdown', type: 'uint256' },
        { name: 'restockTimestamp', type: 'uint256' },
        { name: 'sellableItems', type: 'uint256[]' },
        { name: 'buyableItems', type: 'uint256[]' },
        { name: 'restock', type: 'uint256[]' },
        { name: 'stock', type: 'uint256[]' },
      ],
    }],
    [{
      gold,
      maxGold,
      priceMarkup,
      priceMarkdown,
      restockTimestamp,
      sellableItems,
      buyableItems,
      restock,
      stock,
    }],
  );
}

// ============ ABI ============

const worldAbi = parseAbi([
  'function UD__getCurrentItemsCounter() view returns (uint256)',
  'function getRecord(bytes32 tableId, bytes32[] keyTuple) view returns (bytes staticData, bytes32 encodedLengths, bytes dynamicData)',
  'function UD__createMob(uint8 mobType, bytes stats, string mobMetadataUri) returns (uint256)',
  'function UD__spawnMob(uint256 mobId, uint256 zoneId, uint16 x, uint16 y) returns (bytes32)',
  'function UD__isShop(bytes32 entityId) view returns (bool)',
  'function UD__getMob(uint256 mobId) view returns (uint8 mobType, bytes mobStats, string mobMetadataUri)',
  'function UD__getEntitiesAtPosition(uint256 zoneId, uint16 x, uint16 y) view returns (bytes32[])',
]);

// ============ Types ============

interface ShopInventoryItem {
  itemName: string;
  stock: number;
  restock: number;
  buyOnly?: boolean;
}

interface ShopConfig {
  name: string;
  location: [number, number];
  gold: number;
  maxGold: number;
  priceMarkdown: number;
  priceMarkup: number;
  restockTimestamp: number;
  inventory: ShopInventoryItem[];
}

interface ItemsJson {
  armor?: { name: string; metadataUri: string }[];
  weapons?: { name: string; metadataUri: string }[];
  consumables?: { name: string; metadataUri: string }[];
}

// ============ Main ============

async function main() {
  const worldAddress = process.env.WORLD_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const privateKey = process.env.PRIVATE_KEY as Hex;
  const chainId = parseInt(process.env.CHAIN_ID || '31337');

  if (!worldAddress || !privateKey) {
    console.error('Required env vars: WORLD_ADDRESS, PRIVATE_KEY');
    process.exit(1);
  }

  // Production guard
  const PRODUCTION_WORLD = '0x99d01939F58B965E6E84a1D167E710Abdf5764b0';
  if (worldAddress.toLowerCase() === PRODUCTION_WORLD.toLowerCase()) {
    if (!process.argv.includes('--confirm-production')) {
      console.error('BLOCKED: World address is PRODUCTION. Add --confirm-production to proceed.');
      process.exit(1);
    }
  }

  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ chain, transport: http(rpcUrl), account });

  console.log(`World:   ${worldAddress}`);
  console.log(`Account: ${account.address}`);
  console.log(`Chain:   ${chainId}`);
  console.log(`Dry run: ${dryRun}\n`);

  // ── Step 1: Check current state ──
  const existingEntities = await publicClient.readContract({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'UD__getEntitiesAtPosition',
    args: [BigInt(ZONE_ID), SHOP_X, SHOP_Y],
  });

  // Check if a valid shop already exists at target position
  for (const entity of existingEntities) {
    const isShop = await publicClient.readContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__isShop',
      args: [entity],
    });
    if (isShop) {
      console.log(`Shop already exists at zone ${ZONE_ID}, (${SHOP_X}, ${SHOP_Y}): ${entity}`);
      console.log('Nothing to do.');
      return;
    }
  }

  // ── Step 2: Build item name → on-chain ID map ──
  console.log('Scanning on-chain items...');
  const itemCounter = await publicClient.readContract({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'UD__getCurrentItemsCounter',
    account,
  });
  console.log(`  Total items on-chain: ${itemCounter}`);

  const uriToId = new Map<string, bigint>();
  for (let id = 1n; id <= itemCounter; id++) {
    try {
      const [, , dynamicData] = await publicClient.readContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'getRecord',
        args: [URI_STORAGE_TABLE_ID as Hex, [toHex(id, { size: 32 })]],
      });
      if (dynamicData && dynamicData !== '0x') {
        const uri = Buffer.from((dynamicData as string).slice(2), 'hex').toString('utf-8');
        if (uri) uriToId.set(uri, id);
      }
    } catch {
      // Item may not exist
    }
  }
  console.log(`  Resolved ${uriToId.size} item URIs`);

  // Map item names → IDs using items.json metadata URIs
  const nameToUri = new Map<string, string>();
  const zonesDir = path.join(__dirname, '..', '..', 'zones');

  for (const zoneName of ['dark_cave', 'windy_peaks']) {
    const itemsPath = path.join(zonesDir, zoneName, 'items.json');
    if (!fs.existsSync(itemsPath)) continue;
    const items: ItemsJson = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
    for (const armor of items.armor || []) nameToUri.set(armor.name, armor.metadataUri);
    for (const weapon of items.weapons || []) nameToUri.set(weapon.name, weapon.metadataUri);
    for (const consumable of items.consumables || []) nameToUri.set(consumable.name, consumable.metadataUri);
  }

  const nameToId = new Map<string, bigint>();
  for (const [name, uri] of nameToUri) {
    const id = uriToId.get(uri);
    if (id !== undefined) nameToId.set(name, id);
  }
  console.log(`  Mapped ${nameToId.size} item names to IDs\n`);

  // ── Step 3: Read shop config ──
  const shopConfigPath = path.join(zonesDir, 'windy_peaks', 'shops.json');
  const shopConfig: { shops: ShopConfig[] } = JSON.parse(fs.readFileSync(shopConfigPath, 'utf-8'));
  const talConfig = shopConfig.shops.find(s => s.name === 'Tal Carden');

  if (!talConfig) {
    console.error('Tal Carden not found in shops.json');
    process.exit(1);
  }

  console.log(`Shop: ${talConfig.name}`);
  console.log(`Position: zone ${ZONE_ID}, (${SHOP_X}, ${SHOP_Y})`);
  console.log(`Gold: ${talConfig.gold}`);
  console.log(`Markup: ${talConfig.priceMarkup}bp, Markdown: ${talConfig.priceMarkdown}bp`);
  console.log(`Inventory: ${talConfig.inventory.length} items\n`);

  // ── Step 4: Build shop data ──
  const buyableItems: bigint[] = [];
  const sellableItems: bigint[] = [];
  const stock: bigint[] = [];
  const restock: bigint[] = [];
  let missing = 0;

  for (const inv of talConfig.inventory) {
    const itemId = nameToId.get(inv.itemName);
    if (itemId === undefined) {
      console.warn(`  WARNING: "${inv.itemName}" not found on-chain, skipping`);
      missing++;
      continue;
    }

    buyableItems.push(itemId);
    if (!inv.buyOnly) {
      sellableItems.push(itemId);
      stock.push(BigInt(inv.stock));
      restock.push(BigInt(inv.restock));
    }

    console.log(`  ${inv.buyOnly ? '[sell-only]' : `[stock: ${inv.stock}]`} ${inv.itemName} → ID ${itemId}`);
  }

  if (missing > 0) {
    console.warn(`\n${missing} items not found — they won't be in the shop.`);
  }

  console.log(`\nBuyable: ${buyableItems.length}, Sellable: ${sellableItems.length}`);

  if (buyableItems.length === 0) {
    console.error('No items resolved — cannot create shop.');
    process.exit(1);
  }

  const encodedShopData = encodeShopStats(
    BigInt(talConfig.gold),
    BigInt(talConfig.maxGold),
    BigInt(talConfig.priceMarkup),
    BigInt(talConfig.priceMarkdown),
    BigInt(talConfig.restockTimestamp),
    sellableItems,
    buyableItems,
    restock,
    stock,
  );

  if (dryRun) {
    console.log('\n[DRY RUN] Would create shop mob and spawn at zone 2, (9, 9)');
    console.log(`Encoded shop data: ${encodedShopData.slice(0, 66)}...`);
    return;
  }

  // ── Step 5: Create mob + spawn ──
  console.log('\nCreating shop mob template...');
  const createHash = await walletClient.writeContract({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'UD__createMob',
    args: [MobType.Shop, encodedShopData, 'shop:tal_carden'],
  });
  await publicClient.waitForTransactionReceipt({ hash: createHash });
  console.log(`  TX: ${createHash}`);

  // Read mob counter then scan backwards to find our Shop mob.
  // Direct counter read can be stale by 1 block — verify type == Shop.
  await sleep(3000); // Wait for RPC to catch up
  const [mobCounterStatic] = await publicClient.readContract({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'getRecord',
    args: [COUNTERS_TABLE_ID as Hex, [padKey(worldAddress), padKey(0)]],
  });
  const counterValue = BigInt('0x' + (mobCounterStatic as string).slice(2));
  console.log(`  Mob counter: ${counterValue}`);

  // Find the actual shop mob — check counter, counter-1, counter+1
  let mobId = 0n;
  for (const candidate of [counterValue, counterValue + 1n, counterValue - 1n]) {
    if (candidate <= 0n) continue;
    try {
      const mobData = await publicClient.readContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'UD__getMob',
        args: [candidate],
      });
      // mobData[0] is mobType — 2 = Shop
      if (Number(mobData[0]) === MobType.Shop) {
        // Verify metadata matches
        if ((mobData[2] as string) === 'shop:tal_carden') {
          mobId = candidate;
          break;
        }
      }
    } catch {
      // Mob doesn't exist
    }
  }

  if (mobId === 0n) {
    console.error('Could not find newly created shop mob! Check manually.');
    process.exit(1);
  }
  console.log(`  Shop Mob ID: ${mobId}`);

  await sleep(2000);

  console.log(`Spawning at zone ${ZONE_ID}, (${SHOP_X}, ${SHOP_Y})...`);
  const spawnHash = await walletClient.writeContract({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'UD__spawnMob',
    args: [mobId, BigInt(ZONE_ID), SHOP_X, SHOP_Y],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: spawnHash });
  console.log(`  TX: ${spawnHash}`);
  console.log(`  Status: ${receipt.status}`);

  // ── Step 6: Verify ──
  await sleep(2000);

  const entitiesAfter = await publicClient.readContract({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'UD__getEntitiesAtPosition',
    args: [BigInt(ZONE_ID), SHOP_X, SHOP_Y],
  });
  console.log(`\nEntities at zone ${ZONE_ID}, (${SHOP_X}, ${SHOP_Y}): ${entitiesAfter.length}`);

  for (const entity of entitiesAfter) {
    const isShop = await publicClient.readContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__isShop',
      args: [entity],
    });
    console.log(`  ${entity} — isShop: ${isShop}`);
  }

  console.log('\nDone! Tal Carden shop should now appear at (9,9) in Windy Peaks.');
}

main().catch(console.error);
