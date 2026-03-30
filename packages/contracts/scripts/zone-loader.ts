#!/usr/bin/env npx tsx
/**
 * Zone Loader - Loads game content from zone definition files
 *
 * This script loads zone-specific content (effects, items, monsters, shops)
 * to the deployed world contract post-deployment.
 *
 * Usage:
 *   npx tsx scripts/zone-loader.ts <zone_name> [--world <address>] [--rpc <url>]
 *
 * Examples:
 *   npx tsx scripts/zone-loader.ts starter_village
 *   npx tsx scripts/zone-loader.ts dark_cave --world 0x1234...
 *
 * Environment variables:
 *   PRIVATE_KEY - Private key for the admin account
 *   WORLD_ADDRESS - Address of the deployed world (optional, reads from worlds.json)
 *   RPC_URL - RPC URL (default: http://127.0.0.1:8545)
 */

import { config } from 'dotenv';
// Load environment-specific .env file; shell env vars take precedence (override: false)
const envFile = process.env.CHAIN_ID === '8453' ? '.env.mainnet' : '.env';
config({ path: envFile, override: false });

import { createPublicClient, createWalletClient, http, parseAbi, encodeAbiParameters, toHex, concat, Hex, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, base } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import {
  encodeArmorStats,
  encodeWeaponStats,
  encodeConsumableStats,
  ItemType,
  ArmorType,
  type ArmorTemplate,
  type WeaponTemplate,
  type ConsumableTemplate,
  type ItemsJson,
} from './lib/encode-stats';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============ Zone ID + Coordinate Offsets ============

/** Zone name → on-chain zone ID. Must match constants.sol */
const ZONE_IDS: Record<string, number> = {
  dark_cave: 1,
  windy_peaks: 2,
};

// Coordinates are zone-relative (0-9). No offset needed.

// ============ Types ============

interface ZoneManifest {
  name: string;
  description: string;
  version: string;
  levelRange: { min: number; max: number };
  mapConfig?: { width: number; height: number; startPosition: [number, number] };
  dependencies: string[];
  load: {
    effects: boolean;
    items: boolean;
    monsters: boolean;
    shops: boolean;
    npcs?: boolean;
  };
}

interface EffectsJson {
  magicDamage?: MagicDamageEffect[];
  physicalDamage?: PhysicalDamageEffect[];
  statusEffects?: StatusEffect[];
}

interface MagicDamageEffect {
  effectId: Hex;
  name: string;
  stats: {
    attackModifierBonus: number;
    bonusDamage: number;
    critChanceBonus: number;
  };
}

interface PhysicalDamageEffect {
  effectId: Hex;
  name: string;
  stats: {
    armorPenetration: number;
    attackModifierBonus: number;
    bonusDamage: number;
    critChanceBonus: number;
  };
}

interface StatusEffect {
  effectId: Hex;
  name: string;
  stats: {
    agiModifier: number;
    armorModifier: number;
    damagePerTick: number;
    hpModifier: number;
    intModifier: number;
    resistanceStat: number;
    strModifier: number;
  };
  validity: {
    cooldown: number;
    maxStacks: number;
    validTime: number;
    validTurns: number;
  };
}

// ArmorTemplate, WeaponTemplate, ConsumableTemplate, ItemsJson — imported from ./lib/encode-stats

interface MonsterStats {
  agility: number;
  armor: number;
  class: number;
  experience: number;
  hasBossAI?: boolean;
  hitPoints: number;
  intelligence: number;
  inventory: number[];
  inventoryNames?: string[];
  level: number;
  strength: number;
}

interface MonsterTemplate {
  name: string;
  metadataUri: string;
  stats: MonsterStats;
}

interface MonstersJson {
  monsters: MonsterTemplate[];
}

interface ShopInventoryItem {
  itemName: string;
  stock: number;
  restock: number;
  /** If true, shop only buys this item from players — does not sell it */
  buyOnly?: boolean;
}

interface ShopTemplate {
  name: string;
  location: [number, number];
  gold: number | string;
  maxGold: number | string;
  priceMarkdown: number;
  priceMarkup: number;
  restockTimestamp: number;
  inventory: ShopInventoryItem[];
}

interface ShopsJson {
  shops: ShopTemplate[];
}

interface NPCTemplate {
  name: string;
  location: [number, number];
  alignment: number;
  storyPathIds: string[];
  interaction: string;
  metadataUri: string;
  level?: number;
  description?: string;
  dialogue?: Record<string, string | string[]>;
}

interface NPCsJson {
  npcs: NPCTemplate[];
}

// ItemType and ArmorType — imported from ./lib/encode-stats

// ============ Enums (zone-loader specific) ============

enum MobType {
  Monster = 0,
  NPC = 1,
  Shop = 2,
}

enum EffectType {
  Temporary = 0,
  PhysicalDamage = 1,
  MagicDamage = 2,
  StatusEffect = 3,
}

enum Classes {
  Warrior = 0,
  Rogue = 1,
  Mage = 2,
}

// ============ MUD Resource ID Construction ============

/** Build a MUD table ResourceId: 0x7462 (tb) + namespace (14 bytes) + name (16 bytes) */
function tableResourceId(namespace: string, name: string): Hex {
  const typeBytes = toHex('tb', { size: 2 });
  const nsBytes = toHex(namespace, { size: 14 });
  const nameBytes = toHex(name, { size: 16 });
  return concat([typeBytes, nsBytes, nameBytes]);
}

const URI_STORAGE_TABLE_ID = tableResourceId('Items', 'URIStorage');
const COUNTERS_TABLE_ID = tableResourceId('UD', 'Counters');

function padKey(v: number | bigint | string): Hex {
  if (typeof v === 'string') {
    // address — left-pad to 32 bytes
    return ('0x' + v.replace('0x', '').toLowerCase().padStart(64, '0')) as Hex;
  }
  return ('0x' + BigInt(v).toString(16).padStart(64, '0')) as Hex;
}

// ============ ABI ============
const worldAbi = parseAbi([
  // Read functions
  'function UD__getCurrentItemsCounter() view returns (uint256)',
  'function getRecord(bytes32 tableId, bytes32[] keyTuple) view returns (bytes staticData, bytes32 encodedLengths, bytes dynamicData)',

  // Direct system functions (require namespace access - works for deployer)
  'function UD__createEffect(uint8 effectType, string name, bytes effectStats) returns (bytes32)',
  'function UD__createItem(uint8 itemType, uint256 supply, uint256 dropChance, uint256 price, uint256 rarity, bytes stats, string itemMetadataURI) returns (uint256)',
  'function UD__createMob(uint8 mobType, bytes stats, string mobMetadataUri) returns (uint256)',
  'function UD__spawnMob(uint256 mobId, uint256 zoneId, uint16 x, uint16 y) returns (bytes32)',
  'function UD__setStarterItems(uint8 class, uint256[] itemIds, uint256[] amounts)',
  'function UD__setStarterItemPool(uint256 itemId, bool isStarter)',
  'function UD__setStarterConsumables(uint256[] itemIds, uint256[] amounts)',
  'function UD__adminSetWeaponScaling(uint256 itemId, bool usesAgi)',
  'function UD__registerMobInZone(uint256 zoneId, uint256 level, uint256 mobId)',
]);

// ============ ABI Encoding Helpers ============

function encodeMagicDamageStats(stats: MagicDamageEffect['stats']): Hex {
  return encodeAbiParameters(
    [{ type: 'tuple', components: [
      { name: 'attackModifierBonus', type: 'int256' },
      { name: 'bonusDamage', type: 'int256' },
      { name: 'critChanceBonus', type: 'int256' },
    ]}],
    [{
      attackModifierBonus: BigInt(stats.attackModifierBonus),
      bonusDamage: BigInt(stats.bonusDamage),
      critChanceBonus: BigInt(stats.critChanceBonus),
    }]
  );
}

function encodePhysicalDamageStats(stats: PhysicalDamageEffect['stats']): Hex {
  return encodeAbiParameters(
    [{ type: 'tuple', components: [
      { name: 'armorPenetration', type: 'int256' },
      { name: 'attackModifierBonus', type: 'int256' },
      { name: 'bonusDamage', type: 'int256' },
      { name: 'critChanceBonus', type: 'int256' },
    ]}],
    [{
      armorPenetration: BigInt(stats.armorPenetration),
      attackModifierBonus: BigInt(stats.attackModifierBonus),
      bonusDamage: BigInt(stats.bonusDamage),
      critChanceBonus: BigInt(stats.critChanceBonus),
    }]
  );
}

function encodeStatusEffectStats(effect: StatusEffect): Hex {
  return encodeAbiParameters(
    [
      { type: 'tuple', components: [
        { name: 'agiModifier', type: 'int256' },
        { name: 'armorModifier', type: 'int256' },
        { name: 'damagePerTick', type: 'int256' },
        { name: 'hpModifier', type: 'int256' },
        { name: 'intModifier', type: 'int256' },
        { name: 'resistanceStat', type: 'uint8' },
        { name: 'strModifier', type: 'int256' },
      ]},
      { type: 'tuple', components: [
        { name: 'cooldown', type: 'uint256' },
        { name: 'maxStacks', type: 'uint256' },
        { name: 'validTime', type: 'uint256' },
        { name: 'validTurns', type: 'uint256' },
      ]},
      { name: 'targetsSelf', type: 'bool' },
    ],
    [
      {
        agiModifier: BigInt(effect.stats.agiModifier),
        armorModifier: BigInt(effect.stats.armorModifier),
        damagePerTick: BigInt(effect.stats.damagePerTick),
        hpModifier: BigInt(effect.stats.hpModifier),
        intModifier: BigInt(effect.stats.intModifier),
        resistanceStat: effect.stats.resistanceStat,
        strModifier: BigInt(effect.stats.strModifier),
      },
      {
        cooldown: BigInt(effect.validity.cooldown),
        maxStacks: BigInt(effect.validity.maxStacks),
        validTime: BigInt(effect.validity.validTime),
        validTurns: BigInt(effect.validity.validTurns),
      },
      (effect as any).targetsSelf ?? false,
    ]
  );
}

// encodeArmorStats, encodeWeaponStats, encodeConsumableStats — imported from ./lib/encode-stats

/** Canonical MonsterStats encoding — fields MUST be alphabetical to match Solidity struct.
 *  Other scripts (deploy-z2-quest-chains.ts) reference this as the source of truth. */
function encodeMonsterStats(stats: MonsterStats): Hex {
  return encodeAbiParameters(
    [{ type: 'tuple', components: [
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
    ]}],
    [{
      agility: BigInt(stats.agility),
      armor: BigInt(stats.armor),
      class: stats.class,
      experience: BigInt(stats.experience),
      hasBossAI: stats.hasBossAI ?? false,
      hitPoints: BigInt(stats.hitPoints),
      intelligence: BigInt(stats.intelligence),
      inventory: stats.inventory.map(i => BigInt(i)),
      level: BigInt(stats.level),
      strength: BigInt(stats.strength),
    }]
  );
}

function encodeShopStats(
  gold: bigint,
  maxGold: bigint,
  priceMarkup: bigint,
  priceMarkdown: bigint,
  restockTimestamp: bigint,
  sellableItems: bigint[],
  buyableItems: bigint[],
  restock: bigint[],
  stock: bigint[]
): Hex {
  // Field order must match Solidity ShopsData struct:
  // gold, maxGold, priceMarkup, priceMarkdown, restockTimestamp, sellableItems, buyableItems, restock, stock
  return encodeAbiParameters(
    [{ type: 'tuple', components: [
      { name: 'gold', type: 'uint256' },
      { name: 'maxGold', type: 'uint256' },
      { name: 'priceMarkup', type: 'uint256' },
      { name: 'priceMarkdown', type: 'uint256' },
      { name: 'restockTimestamp', type: 'uint256' },
      { name: 'sellableItems', type: 'uint256[]' },
      { name: 'buyableItems', type: 'uint256[]' },
      { name: 'restock', type: 'uint256[]' },
      { name: 'stock', type: 'uint256[]' },
    ]}],
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
    }]
  );
}

function encodeNPCStats(
  name: string,
  storyPathIds: Hex[],
  alignment: number
): Hex {
  // Field order must match Solidity NPCStats struct: name, storyPathIds, alignment
  return encodeAbiParameters(
    [{ type: 'tuple', components: [
      { name: 'name', type: 'string' },
      { name: 'storyPathIds', type: 'bytes32[]' },
      { name: 'alignment', type: 'uint8' },
    ]}],
    [{
      name,
      storyPathIds,
      alignment,
    }]
  );
}

// ============ Main ============

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: npx tsx scripts/zone-loader.ts <zone_name> [options]

Options:
  --world <address>   World contract address
  --rpc <url>         RPC URL (default: http://127.0.0.1:8545)
  --dry-run           Show what would be loaded without executing

Available zones:
`);
    const zonesDir = path.join(__dirname, '..', 'zones');
    if (fs.existsSync(zonesDir)) {
      const zones = fs.readdirSync(zonesDir).filter(f =>
        fs.statSync(path.join(zonesDir, f)).isDirectory()
      );
      zones.forEach(z => console.log(`  - ${z}`));
    }
    process.exit(0);
  }

  const zoneName = args[0];
  let worldAddress: Address | undefined;
  let rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  let dryRun = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--world' && args[i + 1]) {
      worldAddress = args[i + 1] as Address;
      i++;
    } else if (args[i] === '--rpc' && args[i + 1]) {
      rpcUrl = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  // Resolve world address
  if (!worldAddress) {
    worldAddress = process.env.WORLD_ADDRESS as Address;
  }
  if (!worldAddress) {
    // Only fall back to worlds.json for local anvil (31337).
    // NEVER auto-resolve mainnet worlds — require explicit WORLD_ADDRESS or --world.
    const chainId = parseInt(process.env.CHAIN_ID || '31337');
    if (chainId === 31337) {
      const worldsPath = path.join(__dirname, '..', 'worlds.json');
      if (fs.existsSync(worldsPath)) {
        const worlds = JSON.parse(fs.readFileSync(worldsPath, 'utf-8'));
        worldAddress = worlds['31337']?.address as Address;
      }
    }
  }

  if (!worldAddress) {
    console.error('Error: World address not found. Use --world <address> or set WORLD_ADDRESS');
    process.exit(1);
  }

  // ── Production safety guard ──
  // Never allow writes to the production world without explicit confirmation.
  // This prevents accidental production runs from env var misconfiguration.
  const PRODUCTION_WORLD = '0x99d01939F58B965E6E84a1D167E710Abdf5764b0';
  if (worldAddress.toLowerCase() === PRODUCTION_WORLD.toLowerCase() && !dryRun) {
    if (!args.includes('--confirm-production')) {
      console.error('\n' + '!'.repeat(60));
      console.error('  BLOCKED: World address is PRODUCTION.');
      console.error(`  ${worldAddress}`);
      console.error('  To run against production, add --confirm-production');
      console.error('!'.repeat(60) + '\n');
      process.exit(1);
    }
    console.warn('\n⚠  WARNING: Running against PRODUCTION world ⚠\n');
  }

  // Get private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey && !dryRun) {
    console.error('Error: PRIVATE_KEY environment variable not set.');
    console.error('For local dev: export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    process.exit(1);
  }

  // Load zone
  const zonePath = path.join(__dirname, '..', 'zones', zoneName);
  if (!fs.existsSync(zonePath)) {
    console.error(`Error: Zone "${zoneName}" not found at ${zonePath}`);
    process.exit(1);
  }

  const manifestPath = path.join(zonePath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: Zone manifest not found at ${manifestPath}`);
    process.exit(1);
  }

  const manifest: ZoneManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  console.log('='.repeat(60));
  console.log(`  Ultimate Dominion - Zone Loader`);
  console.log('='.repeat(60));
  console.log(`Zone: ${manifest.name} (${zoneName})`);
  console.log(`Description: ${manifest.description}`);
  console.log(`Level Range: ${manifest.levelRange.min}-${manifest.levelRange.max}`);
  console.log(`World: ${worldAddress}`);
  console.log(`RPC: ${rpcUrl}`);
  if (dryRun) console.log(`MODE: DRY RUN (no transactions)`);
  console.log('');

  // Select chain based on CHAIN_ID env var
  const chainId = parseInt(process.env.CHAIN_ID || '31337');
  const chain = chainId === 8453 ? base : foundry;

  // Create clients
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const account = privateKey ? privateKeyToAccount(privateKey as Hex) : null;
  let walletClient: ReturnType<typeof createWalletClient> | null = null;
  if (!dryRun && account) {
    console.log(`Admin account: ${account.address}`);
    walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });
  }

  // Explicit nonce tracking to avoid RPC lag on L2s
  let currentNonce: number | null = null;
  if (account && publicClient) {
    currentNonce = await publicClient.getTransactionCount({ address: account.address });
    console.log(`Starting nonce: ${currentNonce}`);
  }

  async function sendTx(args: Parameters<typeof walletClient!.writeContract>[0], retries = 3): Promise<`0x${string}`> {
    if (!walletClient) throw new Error('No wallet client');
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Refresh nonce from chain to avoid drift on L2
        currentNonce = await publicClient.getTransactionCount({ address: account!.address });
        const hash = await walletClient.writeContract({
          ...args,
          nonce: currentNonce,
        });
        currentNonce++;
        await publicClient.waitForTransactionReceipt({ hash });
        await sleep(1000);
        return hash;
      } catch (e: any) {
        const msg = e?.details || e?.message || '';
        if ((msg.includes('nonce') || msg.includes('underpriced') || msg.includes('replacement')) && attempt < retries - 1) {
          console.log(`    Nonce error, retrying (attempt ${attempt + 2}/${retries})...`);
          await sleep(3000);
          continue;
        }
        throw e;
      }
    }
    throw new Error('sendTx: max retries exceeded');
  }

  // Track created item IDs by name for shop inventory resolution
  const itemIdsByName: Map<string, bigint> = new Map();

  // Resolve dependency items (populate itemIdsByName from already-deployed zones)
  if (manifest.dependencies.length > 0) {
    console.log('\n>>> Resolving Dependency Items <<<');

    // Scan all on-chain item URIs to build uri→id map
    const uriToId: Map<string, bigint> = new Map();
    const itemCounter = await publicClient.readContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__getCurrentItemsCounter',
    });
    console.log(`  Scanning ${itemCounter} on-chain items for URI mapping...`);

    for (let id = 1n; id <= itemCounter; id++) {
      try {
        const [, , dynamicData] = await publicClient.readContract({
          address: worldAddress,
          abi: worldAbi,
          functionName: 'getRecord',
          args: [URI_STORAGE_TABLE_ID, [toHex(id, { size: 32 })]],
        });
        if (dynamicData && dynamicData !== '0x') {
          const uri = Buffer.from((dynamicData as string).slice(2), 'hex').toString('utf-8');
          if (uri) uriToId.set(uri, id);
        }
      } catch {
        // Item may not exist, skip
      }
    }
    console.log(`  Found ${uriToId.size} items with URIs on-chain`);

    // For each dependency, read its items.json and resolve names via URI
    for (const dep of manifest.dependencies) {
      const depItemsPath = path.join(__dirname, '..', 'zones', dep, 'items.json');
      if (!fs.existsSync(depItemsPath)) {
        console.log(`  Warning: dependency "${dep}" items.json not found, skipping`);
        continue;
      }
      const depItems: ItemsJson = JSON.parse(fs.readFileSync(depItemsPath, 'utf-8'));
      let resolved = 0;

      for (const armor of depItems.armor || []) {
        const id = uriToId.get(armor.metadataUri);
        if (id !== undefined) { itemIdsByName.set(armor.name, id); resolved++; }
      }
      for (const weapon of depItems.weapons || []) {
        const id = uriToId.get(weapon.metadataUri);
        if (id !== undefined) { itemIdsByName.set(weapon.name, id); resolved++; }
      }
      for (const consumable of depItems.consumables || []) {
        const id = uriToId.get(consumable.metadataUri);
        if (id !== undefined) { itemIdsByName.set(consumable.name, id); resolved++; }
      }

      const totalDep = (depItems.armor?.length || 0) + (depItems.weapons?.length || 0) + (depItems.consumables?.length || 0);
      console.log(`  ${dep}: resolved ${resolved}/${totalDep} items`);
    }
  }

  // Load effects
  if (manifest.load.effects) {
    const effectsPath = path.join(zonePath, 'effects.json');
    if (fs.existsSync(effectsPath)) {
      const effects: EffectsJson = JSON.parse(fs.readFileSync(effectsPath, 'utf-8'));
      console.log('\n>>> Loading Effects <<<');

      // Physical damage effects
      for (const effect of effects.physicalDamage || []) {
        console.log(`  Physical: ${effect.name}`);
        if (!dryRun && walletClient) {
          const stats = encodePhysicalDamageStats(effect.stats);
          await sendTx({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createEffect',
            args: [EffectType.PhysicalDamage, effect.name, stats],
          });
        }
      }

      // Magic damage effects
      for (const effect of effects.magicDamage || []) {
        console.log(`  Magic: ${effect.name}`);
        if (!dryRun && walletClient) {
          const stats = encodeMagicDamageStats(effect.stats);
          await sendTx({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createEffect',
            args: [EffectType.MagicDamage, effect.name, stats],
          });
        }
      }

      // Status effects
      for (const effect of effects.statusEffects || []) {
        console.log(`  Status: ${effect.name}`);
        if (!dryRun && walletClient) {
          const stats = encodeStatusEffectStats(effect);
          await sendTx({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createEffect',
            args: [EffectType.StatusEffect, effect.name, stats],
          });
        }
      }
    }
  }

  // Load items
  if (manifest.load.items) {
    const itemsPath = path.join(zonePath, 'items.json');
    if (fs.existsSync(itemsPath)) {
      const items: ItemsJson = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
      console.log('\n>>> Loading Items <<<');

      // Armor
      for (const armor of items.armor || []) {
        console.log(`  Armor: ${armor.name} (${armor.armorType}${armor.isStarter ? ', starter' : ''})`);
        if (!dryRun && walletClient) {
          const stats = encodeArmorStats(armor);
          await sendTx({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createItem',
            args: [
              ItemType.Armor,
              BigInt(armor.initialSupply),
              BigInt(armor.dropChance),
              BigInt(armor.price),
              BigInt(armor.rarity ?? 1),
              stats,
              armor.metadataUri,
            ],
          });
          const itemId = await publicClient.readContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__getCurrentItemsCounter',
            account: account!,
          });
          itemIdsByName.set(armor.name, itemId);
          console.log(`    -> ID: ${itemId}`);

          // Set starter item pool if this is a starter item
          if (armor.isStarter) {
            await sendTx({
              address: worldAddress,
              abi: worldAbi,
              functionName: 'UD__setStarterItemPool',
              args: [itemId, true],
            });
            console.log(`    -> Added to StarterItemPool`);
          }
        }
      }

      // Weapons
      for (const weapon of items.weapons || []) {
        console.log(`  Weapon: ${weapon.name}${weapon.isStarter ? ' (starter)' : ''}`);
        if (!dryRun && walletClient) {
          const stats = encodeWeaponStats(weapon);
          await sendTx({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createItem',
            args: [
              ItemType.Weapon,
              BigInt(weapon.initialSupply),
              BigInt(weapon.dropChance),
              BigInt(weapon.price),
              BigInt(weapon.rarity ?? 1),
              stats,
              weapon.metadataUri,
            ],
          });
          const itemId = await publicClient.readContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__getCurrentItemsCounter',
            account: account!,
          });
          itemIdsByName.set(weapon.name, itemId);
          console.log(`    -> ID: ${itemId}`);

          // Set starter item pool if this is a starter item
          if (weapon.isStarter) {
            await sendTx({
              address: worldAddress,
              abi: worldAbi,
              functionName: 'UD__setStarterItemPool',
              args: [itemId, true],
            });
            console.log(`    -> Added to StarterItemPool`);
          }

          // Set weapon scaling (AGI weapons like bows)
          if (weapon.scalingStat === 'AGI') {
            await sendTx({
              address: worldAddress,
              abi: worldAbi,
              functionName: 'UD__adminSetWeaponScaling',
              args: [itemId, true],
            });
            console.log(`    -> Set AGI scaling`);
          }
        }
      }

      // Consumables
      for (const consumable of items.consumables || []) {
        console.log(`  Consumable: ${consumable.name}${consumable.isStarter ? ' (starter)' : ''}`);
        if (!dryRun && walletClient) {
          const stats = encodeConsumableStats(consumable);
          await sendTx({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createItem',
            args: [
              ItemType.Consumable,
              BigInt(consumable.initialSupply),
              BigInt(consumable.dropChance),
              BigInt(consumable.price),
              BigInt(consumable.rarity ?? 1),
              stats,
              consumable.metadataUri,
            ],
          });
          const itemId = await publicClient.readContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__getCurrentItemsCounter',
            account: account!,
          });
          itemIdsByName.set(consumable.name, itemId);
          console.log(`    -> ID: ${itemId}`);

          // Set starter item pool if this is a starter item
          if (consumable.isStarter) {
            await sendTx({
              address: worldAddress,
              abi: worldAbi,
              functionName: 'UD__setStarterItemPool',
              args: [itemId, true],
            });
            console.log(`    -> Added to StarterItemPool`);
          }
        }
      }

      console.log(`\nCreated ${itemIdsByName.size} items`);

      // Set up starter consumables (items with isStarter flag and amount of 3)
      const starterConsumableIds: bigint[] = [];
      const starterConsumableAmounts: bigint[] = [];
      for (const consumable of items.consumables || []) {
        if (consumable.isStarter) {
          const itemId = itemIdsByName.get(consumable.name);
          if (itemId !== undefined) {
            starterConsumableIds.push(itemId);
            starterConsumableAmounts.push(BigInt(3)); // Give 3 of each starter consumable
          }
        }
      }

      if (!dryRun && walletClient && starterConsumableIds.length > 0) {
        console.log('\n>>> Setting Starter Consumables <<<');
        await sendTx({
          address: worldAddress,
          abi: worldAbi,
          functionName: 'UD__setStarterConsumables',
          args: [starterConsumableIds, starterConsumableAmounts],
        });
        console.log(`  Set ${starterConsumableIds.length} starter consumable(s) with amount 3 each`);
      }
    }
  }

  // Load monsters
  const zoneId = ZONE_IDS[zoneName] ?? 0;
  const createdMobIds: { mobId: bigint; level: number }[] = [];

  if (manifest.load.monsters) {
    const monstersPath = path.join(zonePath, 'monsters.json');
    if (fs.existsSync(monstersPath)) {
      const monsters: MonstersJson = JSON.parse(fs.readFileSync(monstersPath, 'utf-8'));
      console.log('\n>>> Loading Monsters <<<');

      for (const monster of monsters.monsters) {
        console.log(`  Monster: ${monster.name} (Lvl ${monster.stats.level})`);

        // Resolve inventoryNames to numeric IDs using itemIdsByName
        const resolvedStats = { ...monster.stats };
        if (monster.stats.inventoryNames && monster.stats.inventoryNames.length > 0) {
          const resolvedIds: number[] = [];
          for (const itemName of monster.stats.inventoryNames) {
            const itemId = itemIdsByName.get(itemName);
            if (itemId !== undefined) {
              resolvedIds.push(Number(itemId));
            } else {
              console.warn(`    Warning: Item "${itemName}" not found for monster ${monster.name}, skipping`);
            }
          }
          resolvedStats.inventory = resolvedIds;
          console.log(`    Resolved ${resolvedIds.length}/${monster.stats.inventoryNames.length} inventory items`);
        }

        if (!dryRun && walletClient) {
          const stats = encodeMonsterStats(resolvedStats);
          await sendTx({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createMob',
            args: [MobType.Monster, stats, monster.metadataUri],
          });

          // Track mob ID for zone registration (createMob returns mobId but we read counter)
          // MobsByLevel is populated by createMob automatically.
          // Also register in zone-scoped MobsByZoneLevel for zone-aware spawning.
          if (zoneId > 0) {
            // Read mob counter directly from Counters table (createMob increments it, so current value = latest mobId)
            const [mobCounterStatic] = await publicClient.readContract({
              address: worldAddress,
              abi: worldAbi,
              functionName: 'getRecord',
              args: [COUNTERS_TABLE_ID, [padKey(worldAddress), padKey(0)]],
            });
            const mobId = BigInt('0x' + (mobCounterStatic as string).slice(2));
            createdMobIds.push({ mobId, level: monster.stats.level });

            await sendTx({
              address: worldAddress,
              abi: worldAbi,
              functionName: 'UD__registerMobInZone',
              args: [BigInt(zoneId), BigInt(monster.stats.level), mobId],
            });
            console.log(`    -> Registered in MobsByZoneLevel(zone=${zoneId}, level=${monster.stats.level}, mobId=${mobId})`);
          }
        }
      }
    }
  }

  // Load shops
  if (manifest.load.shops) {
    const shopsPath = path.join(zonePath, 'shops.json');
    if (fs.existsSync(shopsPath)) {
      const shopsData: ShopsJson = JSON.parse(fs.readFileSync(shopsPath, 'utf-8'));
      console.log('\n>>> Loading Shops <<<');

      for (const shop of shopsData.shops) {
        const spawnX = shop.location[0];
        const spawnY = shop.location[1];
        console.log(`  Shop: ${shop.name} at zone ${zoneId} (${spawnX}, ${spawnY})`);

        // Resolve item names to IDs
        const buyableItems: bigint[] = [];
        const sellableItems: bigint[] = [];
        const stock: bigint[] = [];
        const restock: bigint[] = [];

        for (const inv of shop.inventory) {
          const itemId = itemIdsByName.get(inv.itemName);
          if (itemId !== undefined) {
            buyableItems.push(itemId);
            if (!inv.buyOnly) {
              sellableItems.push(itemId);
              stock.push(BigInt(inv.stock));
              restock.push(BigInt(inv.restock));
            }
          } else {
            console.warn(`    Warning: Item "${inv.itemName}" not found, skipping`);
          }
        }

        if (!dryRun && walletClient && buyableItems.length > 0) {
          // Encode ShopsData struct for createMob
          const shopStats = encodeShopStats(
            BigInt(shop.gold),
            BigInt(shop.maxGold),
            BigInt(shop.priceMarkup),
            BigInt(shop.priceMarkdown),
            BigInt(shop.restockTimestamp),
            sellableItems,
            buyableItems,
            restock,
            stock
          );

          // Step 1: Create shop mob template
          await sendTx({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createMob',
            args: [MobType.Shop, shopStats, `shop:${shop.name.toLowerCase().replace(/\s+/g, '_')}`],
          });

          // Get the mob ID from the createMob return value (it's the incremented counter)
          // For simplicity, we'll read the counter after creation
          // The mob ID is the current counter value (createMob returns it but we can't easily get it from receipt)
          // Let's assume this is the first shop, so mobId = 1 + monsters count
          // Actually, we need to get the mobId. Let me add a read function to get the mob counter

          // For now, we can manually track or use a separate read
          // The simplest approach: after createMob, the mobId is the current mob counter
          // We need to add a function to read the mob counter, but for now let's just spawn with assumed ID

          // Get mob counter - we'll need to add this ABI entry
          // For now, use a workaround: spawnMob immediately after create
          // The mobId will be (monsters.length + shop_index + 1)

          // Step 2: Spawn the shop at the location
          // Since we need the mobId, we need to count how many mobs we've created
          // Assuming monsters are created first, then shops
          // mobId = monster_count + shop_index + 1
          // This is fragile but works for now

          // Actually, let's add a proper way to get the mob counter
          console.log(`    -> Created mob template`);

          // For spawning, we need to know the mobId
          // Let's track it: mobs start at 1, monsters are created before shops
          // So shop mobId = 1 + monsters.length + shop_index

          // Read monsters to get count
          const monstersPath = path.join(zonePath, 'monsters.json');
          let monsterCount = 0;
          if (fs.existsSync(monstersPath)) {
            const monstersData: MonstersJson = JSON.parse(fs.readFileSync(monstersPath, 'utf-8'));
            monsterCount = monstersData.monsters.length;
          }

          // Shop index within this loop
          const shopIndex = shopsData.shops.indexOf(shop);
          const mobId = BigInt(monsterCount + shopIndex + 1);

          await sendTx({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__spawnMob',
            args: [mobId, BigInt(zoneId), spawnX, spawnY],
          });
          console.log(`    -> Spawned at zone ${zoneId} (${spawnX}, ${spawnY}) with mobId ${mobId}`);
        }
      }
    }
  }

  // Load NPCs
  if (manifest.load.npcs) {
    const npcsPath = path.join(zonePath, 'npcs.json');
    if (fs.existsSync(npcsPath)) {
      const npcsData: NPCsJson = JSON.parse(fs.readFileSync(npcsPath, 'utf-8'));
      console.log('\n>>> Loading NPCs <<<');

      // Count existing mobs (monsters + shops) to compute NPC mobIds
      const monstersPath = path.join(zonePath, 'monsters.json');
      let existingMobCount = 0;
      if (fs.existsSync(monstersPath)) {
        const monstersData: MonstersJson = JSON.parse(fs.readFileSync(monstersPath, 'utf-8'));
        existingMobCount += monstersData.monsters.length;
      }
      const shopsPath = path.join(zonePath, 'shops.json');
      if (fs.existsSync(shopsPath)) {
        const shopsData: ShopsJson = JSON.parse(fs.readFileSync(shopsPath, 'utf-8'));
        existingMobCount += shopsData.shops.length;
      }

      for (let npcIndex = 0; npcIndex < npcsData.npcs.length; npcIndex++) {
        const npc = npcsData.npcs[npcIndex];
        const spawnX = npc.location[0];
        const spawnY = npc.location[1];
        console.log(`  NPC: ${npc.name} at zone ${zoneId} (${spawnX}, ${spawnY}) — interaction: ${npc.interaction}`);

        if (!dryRun && walletClient) {
          const storyPathIds: Hex[] = (npc.storyPathIds || []).map(id => id as Hex);
          const npcStats = encodeNPCStats(npc.name, storyPathIds, npc.alignment);

          await sendTx({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createMob',
            args: [MobType.NPC, npcStats, npc.metadataUri],
          });
          console.log(`    -> Created NPC mob template`);

          const mobId = BigInt(existingMobCount + npcIndex + 1);

          await sendTx({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__spawnMob',
            args: [mobId, BigInt(zoneId), spawnX, spawnY],
          });
          console.log(`    -> Spawned at zone ${zoneId} (${spawnX}, ${spawnY}) with mobId ${mobId}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`  Zone "${manifest.name}" loaded successfully!`);
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
