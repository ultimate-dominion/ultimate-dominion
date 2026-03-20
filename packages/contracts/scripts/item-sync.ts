#!/usr/bin/env npx tsx
/**
 * Item Sync — Compare on-chain item stats with items.json and optionally push updates.
 *
 * Usage:
 *   npx tsx scripts/item-sync.ts <zone_name> [--update] [--world <address>] [--rpc <url>]
 *
 * Modes:
 *   item-sync.ts dark_cave           — verify only (show diff)
 *   item-sync.ts dark_cave --update  — verify + push changes on-chain
 *   item-sync.ts dark_cave --pull    — read on-chain values and update items.json
 *
 * Environment variables:
 *   PRIVATE_KEY     - Private key for the admin account (required for --update)
 *   WORLD_ADDRESS   - Address of the deployed world
 *   RPC_URL         - RPC URL (default: http://127.0.0.1:8545)
 *   CHAIN_ID        - Chain ID (default: 31337)
 */

import { config } from 'dotenv';
config();

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  decodeAbiParameters,
  toHex,
  concat,
  Hex,
  Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, base } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import {
  encodeArmorStats,
  encodeWeaponStats,
  encodeConsumableStats,
  ItemType,
  type ArmorTemplate,
  type WeaponTemplate,
  type ConsumableTemplate,
  type ItemsJson,
} from './lib/encode-stats';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============ MUD Resource ID Construction ============

/** Build a MUD table ResourceId: 0x7462 (tb) + namespace (14 bytes) + name (16 bytes) */
function tableResourceId(namespace: string, name: string): Hex {
  const typeBytes = toHex('tb', { size: 2 });
  const nsBytes = toHex(namespace, { size: 14 });
  const nameBytes = toHex(name, { size: 16 });
  return concat([typeBytes, nsBytes, nameBytes]);
}

// Table ResourceIds
const ITEMS_TABLE_ID = tableResourceId('UD', 'Items');
const URI_STORAGE_TABLE_ID = tableResourceId('Items', 'URIStorage');

// ============ ABI ============

const worldAbi = parseAbi([
  // Store read (MUD auto-exposes on World)
  'function getRecord(bytes32 tableId, bytes32[] keyTuple) view returns (bytes staticData, bytes32 encodedLengths, bytes dynamicData)',

  // System functions
  'function UD__adminUpdateItemStats(uint256 itemId, uint256 dropChance, uint256 price, uint256 rarity, bytes stats)',
]);

// ============ Item Stats Decoding ============

/** Items table static fields: itemType(uint8) + dropChance(uint256) + price(uint256) + rarity(uint256) = 97 bytes */
function decodeItemsRecord(staticData: Hex, dynamicData: Hex) {
  // MUD packs static fields tightly
  const hex = staticData.slice(2); // remove 0x prefix
  const itemType = parseInt(hex.slice(0, 2), 16);
  const dropChance = BigInt('0x' + hex.slice(2, 66));
  const price = BigInt('0x' + hex.slice(66, 130));
  const rarity = BigInt('0x' + hex.slice(130, 194));
  // dynamicData is the stats bytes blob
  const stats = dynamicData as Hex;
  return { itemType, dropChance, price, rarity, stats };
}

/** ERC1155URIStorage: no static fields, dynamicData is the URI string bytes */
function decodeUriRecord(dynamicData: Hex): string {
  if (!dynamicData || dynamicData === '0x') return '';
  // Dynamic data is raw UTF-8 bytes
  const bytes = Buffer.from(dynamicData.slice(2), 'hex');
  return bytes.toString('utf-8');
}

/** Key tuple for a uint256 key */
function keyTuple(id: number | bigint): Hex[] {
  return [toHex(BigInt(id), { size: 32 })];
}

// ============ Human-Readable Stat Decoding ============

interface DecodedWeaponStats {
  agiModifier: bigint; intModifier: bigint; hpModifier: bigint;
  maxDamage: bigint; minDamage: bigint; minLevel: bigint;
  strModifier: bigint; effects: Hex[];
}

interface DecodedArmorStats {
  agiModifier: bigint; armorModifier: bigint; hpModifier: bigint;
  intModifier: bigint; minLevel: bigint; strModifier: bigint;
  armorType: number;
}

interface DecodedConsumableStats {
  minDamage: bigint; maxDamage: bigint; minLevel: bigint; effects: Hex[];
}

interface DecodedStatRestrictions {
  minAgility: bigint; minIntelligence: bigint; minStrength: bigint;
}

const weaponStatsAbi = [
  { type: 'tuple', components: [
    { name: 'agiModifier', type: 'int256' },
    { name: 'intModifier', type: 'int256' },
    { name: 'hpModifier', type: 'int256' },
    { name: 'maxDamage', type: 'int256' },
    { name: 'minDamage', type: 'int256' },
    { name: 'minLevel', type: 'uint256' },
    { name: 'strModifier', type: 'int256' },
    { name: 'effects', type: 'bytes32[]' },
  ]},
  { type: 'tuple', components: [
    { name: 'minAgility', type: 'int256' },
    { name: 'minIntelligence', type: 'int256' },
    { name: 'minStrength', type: 'int256' },
  ]},
] as const;

const armorStatsAbi = [
  { type: 'tuple', components: [
    { name: 'agiModifier', type: 'int256' },
    { name: 'armorModifier', type: 'int256' },
    { name: 'hpModifier', type: 'int256' },
    { name: 'intModifier', type: 'int256' },
    { name: 'minLevel', type: 'uint256' },
    { name: 'strModifier', type: 'int256' },
    { name: 'armorType', type: 'uint8' },
  ]},
  { type: 'tuple', components: [
    { name: 'minAgility', type: 'int256' },
    { name: 'minIntelligence', type: 'int256' },
    { name: 'minStrength', type: 'int256' },
  ]},
] as const;

const consumableStatsAbi = [
  { type: 'tuple', components: [
    { name: 'minDamage', type: 'int256' },
    { name: 'maxDamage', type: 'int256' },
    { name: 'minLevel', type: 'uint256' },
    { name: 'effects', type: 'bytes32[]' },
  ]},
  { type: 'tuple', components: [
    { name: 'minAgility', type: 'int256' },
    { name: 'minIntelligence', type: 'int256' },
    { name: 'minStrength', type: 'int256' },
  ]},
] as const;

function decodeStatsBlob(itemType: number, statsHex: Hex) {
  if (!statsHex || statsHex === '0x') return null;
  try {
    if (itemType === ItemType.Weapon) {
      const [weapon, restrictions] = decodeAbiParameters(weaponStatsAbi, statsHex);
      return { type: 'weapon', weapon, restrictions };
    } else if (itemType === ItemType.Armor) {
      const [armor, restrictions] = decodeAbiParameters(armorStatsAbi, statsHex);
      return { type: 'armor', armor, restrictions };
    } else if (itemType === ItemType.Consumable) {
      const [consumable, restrictions] = decodeAbiParameters(consumableStatsAbi, statsHex);
      return { type: 'consumable', consumable, restrictions };
    }
  } catch (e) {
    return null;
  }
  return null;
}

// ============ Diff Display ============

function formatDiff(field: string, onChain: any, expected: any): string {
  return `    ${field}: ${onChain} → ${expected}`;
}

function diffWeapon(
  onChain: { weapon: any; restrictions: any },
  expected: WeaponTemplate,
): string[] {
  const diffs: string[] = [];
  const w = onChain.weapon;
  const r = onChain.restrictions;
  const s = expected.stats;
  const sr = expected.statRestrictions;

  if (w.minDamage !== BigInt(s.minDamage)) diffs.push(formatDiff('minDamage', w.minDamage, s.minDamage));
  if (w.maxDamage !== BigInt(s.maxDamage)) diffs.push(formatDiff('maxDamage', w.maxDamage, s.maxDamage));
  if (w.strModifier !== BigInt(s.strModifier)) diffs.push(formatDiff('strModifier', w.strModifier, s.strModifier));
  if (w.agiModifier !== BigInt(s.agiModifier)) diffs.push(formatDiff('agiModifier', w.agiModifier, s.agiModifier));
  if (w.intModifier !== BigInt(s.intModifier)) diffs.push(formatDiff('intModifier', w.intModifier, s.intModifier));
  if (w.hpModifier !== BigInt(s.hpModifier)) diffs.push(formatDiff('hpModifier', w.hpModifier, s.hpModifier));
  if (w.minLevel !== BigInt(s.minLevel)) diffs.push(formatDiff('minLevel', w.minLevel, s.minLevel));
  if (r.minStrength !== BigInt(sr.minStrength)) diffs.push(formatDiff('minStrength', r.minStrength, sr.minStrength));
  if (r.minAgility !== BigInt(sr.minAgility)) diffs.push(formatDiff('minAgility', r.minAgility, sr.minAgility));
  if (r.minIntelligence !== BigInt(sr.minIntelligence)) diffs.push(formatDiff('minIntelligence', r.minIntelligence, sr.minIntelligence));
  return diffs;
}

function diffArmor(
  onChain: { armor: any; restrictions: any },
  expected: ArmorTemplate,
): string[] {
  const diffs: string[] = [];
  const a = onChain.armor;
  const r = onChain.restrictions;
  const s = expected.stats;
  const sr = expected.statRestrictions;

  if (a.armorModifier !== BigInt(s.armorModifier)) diffs.push(formatDiff('armorModifier', a.armorModifier, s.armorModifier));
  if (a.strModifier !== BigInt(s.strModifier)) diffs.push(formatDiff('strModifier', a.strModifier, s.strModifier));
  if (a.agiModifier !== BigInt(s.agiModifier)) diffs.push(formatDiff('agiModifier', a.agiModifier, s.agiModifier));
  if (a.intModifier !== BigInt(s.intModifier)) diffs.push(formatDiff('intModifier', a.intModifier, s.intModifier));
  if (a.hpModifier !== BigInt(s.hpModifier)) diffs.push(formatDiff('hpModifier', a.hpModifier, s.hpModifier));
  if (a.minLevel !== BigInt(s.minLevel)) diffs.push(formatDiff('minLevel', a.minLevel, s.minLevel));
  if (r.minStrength !== BigInt(sr.minStrength)) diffs.push(formatDiff('minStrength', r.minStrength, sr.minStrength));
  if (r.minAgility !== BigInt(sr.minAgility)) diffs.push(formatDiff('minAgility', r.minAgility, sr.minAgility));
  if (r.minIntelligence !== BigInt(sr.minIntelligence)) diffs.push(formatDiff('minIntelligence', r.minIntelligence, sr.minIntelligence));
  return diffs;
}

function diffConsumable(
  onChain: { consumable: any; restrictions: any },
  expected: ConsumableTemplate,
): string[] {
  const diffs: string[] = [];
  const c = onChain.consumable;
  const r = onChain.restrictions;
  const s = expected.stats;
  const sr = expected.statRestrictions;

  if (c.minDamage !== BigInt(s.minDamage)) diffs.push(formatDiff('minDamage', c.minDamage, s.minDamage));
  if (c.maxDamage !== BigInt(s.maxDamage)) diffs.push(formatDiff('maxDamage', c.maxDamage, s.maxDamage));
  if (c.minLevel !== BigInt(s.minLevel)) diffs.push(formatDiff('minLevel', c.minLevel, s.minLevel));
  if (r.minStrength !== BigInt(sr.minStrength)) diffs.push(formatDiff('minStrength', r.minStrength, sr.minStrength));
  if (r.minAgility !== BigInt(sr.minAgility)) diffs.push(formatDiff('minAgility', r.minAgility, sr.minAgility));
  if (r.minIntelligence !== BigInt(sr.minIntelligence)) diffs.push(formatDiff('minIntelligence', r.minIntelligence, sr.minIntelligence));
  return diffs;
}

// ============ Main ============

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: npx tsx scripts/item-sync.ts <zone_name> [options]

Options:
  --update            Push changes on-chain (default: verify only)
  --world <address>   World contract address
  --rpc <url>         RPC URL (default: http://127.0.0.1:8545)

Modes:
  item-sync.ts dark_cave           — verify only (show diff)
  item-sync.ts dark_cave --update  — verify + push changes on-chain
`);
    process.exit(0);
  }

  const zoneName = args[0];
  let worldAddress: Address | undefined;
  let rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  let doUpdate = false;
  let doPull = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--world' && args[i + 1]) {
      worldAddress = args[i + 1] as Address;
      i++;
    } else if (args[i] === '--rpc' && args[i + 1]) {
      rpcUrl = args[i + 1];
      i++;
    } else if (args[i] === '--update') {
      doUpdate = true;
    } else if (args[i] === '--pull') {
      doPull = true;
    }
  }

  // Resolve world address
  if (!worldAddress) worldAddress = process.env.WORLD_ADDRESS as Address;
  if (!worldAddress) {
    const worldsPath = path.join(__dirname, '..', 'worlds.json');
    if (fs.existsSync(worldsPath)) {
      const worlds = JSON.parse(fs.readFileSync(worldsPath, 'utf-8'));
      worldAddress = worlds['31337']?.address as Address;
    }
  }
  if (!worldAddress) {
    console.error('Error: World address not found. Use --world <address> or set WORLD_ADDRESS');
    process.exit(1);
  }

  // Validate private key for update mode
  const privateKey = process.env.PRIVATE_KEY;
  if (doUpdate && !privateKey) {
    console.error('Error: PRIVATE_KEY required for --update mode');
    process.exit(1);
  }

  // Load zone items
  const itemsPath = path.join(__dirname, '..', 'zones', zoneName, 'items.json');
  if (!fs.existsSync(itemsPath)) {
    console.error(`Error: items.json not found at ${itemsPath}`);
    process.exit(1);
  }
  const items: ItemsJson = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));

  // Setup clients
  const chainId = parseInt(process.env.CHAIN_ID || '31337');
  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  const account = privateKey ? privateKeyToAccount(privateKey as Hex) : null;
  let walletClient: ReturnType<typeof createWalletClient> | null = null;
  if (doUpdate && account) {
    walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  }

  console.log('='.repeat(60));
  console.log('  Ultimate Dominion - Item Sync');
  console.log('='.repeat(60));
  console.log(`Zone: ${zoneName}`);
  console.log(`World: ${worldAddress}`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Mode: ${doPull ? 'PULL (on-chain → items.json)' : doUpdate ? 'UPDATE (items.json → on-chain)' : 'VERIFY ONLY'}`);
  console.log('');

  // Discover on-chain items by scanning URIs (avoids dependency on getCurrentItemsCounter
  // which requires ItemCreationSystem to be registered — may be missing due to MUD nonce skips)
  console.log('Scanning on-chain item URIs...');
  const uriToId: Map<string, bigint> = new Map();
  const idToUri: Map<bigint, string> = new Map();

  let consecutiveEmpty = 0;
  const MAX_EMPTY_GAP = 20; // stop after 20 consecutive items with no URI
  for (let id = 1n; consecutiveEmpty < MAX_EMPTY_GAP; id++) {
    try {
      const [, , dynamicData] = await publicClient.readContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'getRecord',
        args: [URI_STORAGE_TABLE_ID, keyTuple(id)],
      });
      const uri = decodeUriRecord(dynamicData);
      if (uri) {
        uriToId.set(uri, id);
        idToUri.set(id, uri);
        consecutiveEmpty = 0;
      } else {
        consecutiveEmpty++;
      }
    } catch {
      consecutiveEmpty++;
    }
  }
  console.log(`Found ${uriToId.size} items with metadata URIs (scanned up to ID ${uriToId.size > 0 ? Math.max(...[...idToUri.keys()].map(Number)) : 0})`);

  // Compare items
  let totalItems = 0;
  let matchedItems = 0;
  let mismatchedItems = 0;
  let missingItems = 0;
  const updates: { itemId: bigint; dropChance: bigint; price: bigint; rarity: bigint; stats: Hex; name: string }[] = [];

  async function checkItem(
    name: string,
    metadataUri: string,
    itemType: ItemType,
    dropChance: bigint,
    price: bigint,
    rarity: bigint,
    encodedStats: Hex,
    template: ArmorTemplate | WeaponTemplate | ConsumableTemplate,
  ) {
    totalItems++;
    const itemId = uriToId.get(metadataUri);
    if (itemId === undefined) {
      console.log(`  MISSING: ${name} (uri: ${metadataUri}) — not found on-chain`);
      missingItems++;
      return;
    }

    // Read on-chain Items record
    const [staticData, , dynamicData] = await publicClient.readContract({
      address: worldAddress!,
      abi: worldAbi,
      functionName: 'getRecord',
      args: [ITEMS_TABLE_ID, keyTuple(itemId)],
    });

    const onChain = decodeItemsRecord(staticData, dynamicData);

    // Compare stats bytes, dropChance, price, rarity
    const statsMatch = onChain.stats.toLowerCase() === encodedStats.toLowerCase();
    const dropChanceMatch = onChain.dropChance === dropChance;
    const priceMatch = onChain.price === price;
    const rarityMatch = onChain.rarity === rarity;

    if (statsMatch && dropChanceMatch && priceMatch && rarityMatch) {
      matchedItems++;
      return;
    }

    mismatchedItems++;
    console.log(`  DIFF: ${name} (ID ${itemId}):`);

    if (!dropChanceMatch) console.log(formatDiff('dropChance', onChain.dropChance, dropChance));
    if (!priceMatch) console.log(formatDiff('price', onChain.price, price));
    if (!rarityMatch) console.log(formatDiff('rarity', onChain.rarity, rarity));

    if (!statsMatch) {
      // Decode both for human-readable diff
      const decoded = decodeStatsBlob(onChain.itemType, onChain.stats);
      if (decoded) {
        let statDiffs: string[] = [];
        if (decoded.type === 'weapon') statDiffs = diffWeapon(decoded as any, template as WeaponTemplate);
        else if (decoded.type === 'armor') statDiffs = diffArmor(decoded as any, template as ArmorTemplate);
        else if (decoded.type === 'consumable') statDiffs = diffConsumable(decoded as any, template as ConsumableTemplate);
        statDiffs.forEach(d => console.log(d));
      } else {
        console.log(`    stats: <decode failed> → <expected>`);
      }
    }

    updates.push({ itemId, dropChance, price, rarity, stats: encodedStats, name });
  }

  // Check armor
  console.log('\n>>> Armor <<<');
  for (const armor of items.armor) {
    const stats = encodeArmorStats(armor);
    await checkItem(
      armor.name, armor.metadataUri, ItemType.Armor,
      BigInt(armor.dropChance), BigInt(armor.price), BigInt(armor.rarity ?? 1),
      stats, armor,
    );
  }

  // Check weapons
  console.log('\n>>> Weapons <<<');
  for (const weapon of items.weapons) {
    const stats = encodeWeaponStats(weapon);
    await checkItem(
      weapon.name, weapon.metadataUri, ItemType.Weapon,
      BigInt(weapon.dropChance), BigInt(weapon.price), BigInt(weapon.rarity ?? 1),
      stats, weapon,
    );
  }

  // Check consumables
  console.log('\n>>> Consumables <<<');
  for (const consumable of items.consumables) {
    const stats = encodeConsumableStats(consumable);
    await checkItem(
      consumable.name, consumable.metadataUri, ItemType.Consumable,
      BigInt(consumable.dropChance), BigInt(consumable.price), BigInt(consumable.rarity ?? 1),
      stats, consumable,
    );
  }

  // ── Effect Verification (read-only, uses effect-sync for updates) ──
  const effectsPath = path.join(__dirname, '..', 'zones', zoneName, 'effects.json');
  let totalEffects = 0;
  let matchedEffects = 0;
  let missingEffects = 0;

  // Table ResourceIds from codegen
  const EFFECTS_TABLE_ID: Hex = '0x7462554400000000000000000000000045666665637473000000000000000000';
  const EFFECT_TYPE_NAMES = ['Temporary', 'PhysicalDamage', 'MagicDamage', 'StatusEffect'];

  if (fs.existsSync(effectsPath)) {
    const effectsJson = JSON.parse(fs.readFileSync(effectsPath, 'utf-8'));

    console.log('\n>>> Effects <<<');

    async function checkEffect(name: string, effectId: Hex, expectedType: number) {
      totalEffects++;
      try {
        const [staticData] = await publicClient.readContract({
          address: worldAddress!,
          abi: worldAbi,
          functionName: 'getRecord',
          args: [EFFECTS_TABLE_ID, [effectId]],
        });
        const hex = (staticData as string).slice(2);
        const effectType = parseInt(hex.slice(0, 2), 16);
        const effectExists = parseInt(hex.slice(2, 4), 16) === 1;

        if (!effectExists) {
          console.log(`  MISSING: ${name}`);
          missingEffects++;
        } else if (effectType !== expectedType) {
          console.log(`  TYPE MISMATCH: ${name} — on-chain=${EFFECT_TYPE_NAMES[effectType]}, expected=${EFFECT_TYPE_NAMES[expectedType]}`);
          missingEffects++;
        } else {
          matchedEffects++;
        }
      } catch {
        console.log(`  MISSING: ${name}`);
        missingEffects++;
      }
    }

    for (const e of effectsJson.physicalDamage || []) {
      await checkEffect(e.name, e.effectId, 1); // PhysicalDamage
    }
    for (const e of effectsJson.magicDamage || []) {
      await checkEffect(e.name, e.effectId, 2); // MagicDamage
    }
    for (const e of effectsJson.statusEffects || []) {
      await checkEffect(e.name, e.effectId, 3); // StatusEffect
    }

    if (missingEffects > 0) {
      console.log(`\n  Run effect-sync to create missing effects: npx tsx scripts/effect-sync.ts ${zoneName} --update`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`  Items:   ${matchedItems} matched, ${mismatchedItems} mismatched, ${missingItems} missing (${totalItems} total)`);
  if (totalEffects > 0) {
    console.log(`  Effects: ${matchedEffects} matched, ${missingEffects} missing (${totalEffects} total)`);
  }
  console.log('='.repeat(60));

  if (mismatchedItems === 0 && missingItems === 0 && missingEffects === 0) {
    console.log('\nAll items and effects in sync!');
    return;
  }

  // Pull mode: read on-chain values and update items.json
  if (doPull && mismatchedItems > 0) {
    console.log(`\nPulling ${mismatchedItems} on-chain values into items.json...`);

    // Read on-chain values for each mismatched item and update the JSON
    let pullCount = 0;

    async function pullItem(
      category: 'armor' | 'weapons' | 'consumables',
      index: number,
      metadataUri: string,
    ) {
      const itemId = uriToId.get(metadataUri);
      if (itemId === undefined) return;

      const [staticData, , dynamicData] = await publicClient.readContract({
        address: worldAddress!,
        abi: worldAbi,
        functionName: 'getRecord',
        args: [ITEMS_TABLE_ID, keyTuple(itemId)],
      });

      const onChain = decodeItemsRecord(staticData, dynamicData);
      const item = items[category][index] as any;
      const oldDc = item.dropChance;
      const oldRarity = item.rarity;

      item.dropChance = Number(onChain.dropChance);
      item.rarity = Number(onChain.rarity);
      // Don't pull price — it's in wei and items.json uses wei too, but pulling it
      // could overwrite intentional price changes staged in JSON
      // item.price = onChain.price.toString();

      if (oldDc !== item.dropChance || oldRarity !== item.rarity) {
        console.log(`  ${item.name}: dropChance ${oldDc} → ${item.dropChance}, rarity ${oldRarity} → ${item.rarity}`);
        pullCount++;
      }
    }

    for (let i = 0; i < items.armor.length; i++) {
      await pullItem('armor', i, items.armor[i].metadataUri);
    }
    for (let i = 0; i < items.weapons.length; i++) {
      await pullItem('weapons', i, items.weapons[i].metadataUri);
    }
    for (let i = 0; i < items.consumables.length; i++) {
      await pullItem('consumables', i, items.consumables[i].metadataUri);
    }

    if (pullCount > 0) {
      fs.writeFileSync(itemsPath, JSON.stringify(items, null, 2) + '\n');
      console.log(`\nUpdated ${pullCount} values in ${itemsPath}`);
      console.log('Review the changes with `git diff`, then commit.');
    } else {
      console.log('\nNo values needed updating.');
    }
    return;
  }

  // Update mode
  if (doUpdate && updates.length > 0 && walletClient && account) {
    console.log(`\nPushing ${updates.length} updates on-chain...`);

    let currentNonce = await publicClient.getTransactionCount({ address: account.address });
    console.log(`Starting nonce: ${currentNonce}`);

    for (const update of updates) {
      console.log(`  Updating: ${update.name} (ID ${update.itemId})`);
      const hash = await walletClient.writeContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'UD__adminUpdateItemStats',
        args: [update.itemId, update.dropChance, update.price, update.rarity, update.stats],
        nonce: currentNonce,
      });
      currentNonce++;
      await publicClient.waitForTransactionReceipt({ hash });
      await sleep(2000);
      console.log(`    -> tx: ${hash}`);
    }

    console.log(`\nDone! ${updates.length} items updated.`);
  } else if (!doUpdate && updates.length > 0) {
    console.log(`\nRun with --update to push ${updates.length} changes on-chain.`);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
