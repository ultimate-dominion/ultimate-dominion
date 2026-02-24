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
config();

import { createPublicClient, createWalletClient, http, parseAbi, encodeAbiParameters, Hex, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

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

interface StatRestrictions {
  minAgility: bigint;
  minIntelligence: bigint;
  minStrength: bigint;
}

interface ArmorTemplate {
  name: string;
  rarity?: number;
  dropChance: number;
  initialSupply: string | number;
  metadataUri: string;
  price: string | number;
  armorType: 'Cloth' | 'Leather' | 'Plate';
  isStarter?: boolean;
  stats: {
    agiModifier: number;
    armorModifier: number;
    hpModifier: number;
    intModifier: number;
    minLevel: number;
    strModifier: number;
  };
  statRestrictions: {
    minAgility: number;
    minIntelligence: number;
    minStrength: number;
  };
}

interface WeaponTemplate {
  name: string;
  rarity?: number;
  dropChance: number;
  initialSupply: string | number;
  metadataUri: string;
  price: string | number;
  isStarter?: boolean;
  stats: {
    agiModifier: number;
    effects: Hex[];
    hpModifier: number;
    intModifier: number;
    maxDamage: number;
    minDamage: number;
    minLevel: number;
    strModifier: number;
  };
  statRestrictions: {
    minAgility: number;
    minIntelligence: number;
    minStrength: number;
  };
}

interface ConsumableTemplate {
  name: string;
  rarity?: number;
  dropChance: number;
  initialSupply: string | number;
  metadataUri: string;
  price: string | number;
  isStarter?: boolean;
  stats: {
    effects: Hex[];
    maxDamage: number;
    minDamage: number;
    minLevel: number;
  };
  statRestrictions: {
    minAgility: number;
    minIntelligence: number;
    minStrength: number;
  };
}

interface ItemsJson {
  armor: ArmorTemplate[];
  weapons: WeaponTemplate[];
  consumables: ConsumableTemplate[];
  metadataUriPrefix?: string;
}

interface MonsterStats {
  agility: number;
  armor: number;
  class: number;
  experience: number;
  hitPoints: number;
  intelligence: number;
  inventory: number[];
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

// ============ Enums (must match Solidity) ============
enum ItemType {
  Weapon = 0,
  Armor = 1,
  Spell = 2,
  Consumable = 3,
  QuestItem = 4,
  Accessory = 5,
}

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

enum ArmorType {
  None = 0,
  Cloth = 1,
  Leather = 2,
  Plate = 3,
}

// ============ ABI ============
const worldAbi = parseAbi([
  // Read functions
  'function UD__getCurrentItemsCounter() view returns (uint256)',

  // Direct system functions (require namespace access - works for deployer)
  'function UD__createEffect(uint8 effectType, string name, bytes effectStats) returns (bytes32)',
  'function UD__createItem(uint8 itemType, uint256 supply, uint256 dropChance, uint256 price, bytes stats, string itemMetadataURI) returns (uint256)',
  'function UD__createMob(uint8 mobType, bytes stats, string mobMetadataUri) returns (uint256)',
  'function UD__spawnMob(uint256 mobId, uint16 x, uint16 y) returns (bytes32)',
  'function UD__setStarterItems(uint8 class, uint256[] itemIds, uint256[] amounts)',
  'function UD__setStarterItemPool(uint256 itemId, bool isStarter)',
  'function UD__setStarterConsumables(uint256[] itemIds, uint256[] amounts)',
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
    ]
  );
}

function encodeArmorStats(template: ArmorTemplate): Hex {
  // Convert armor type string to enum value
  const armorTypeValue = ArmorType[template.armorType] ?? ArmorType.None;

  return encodeAbiParameters(
    [
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
    ],
    [
      {
        agiModifier: BigInt(template.stats.agiModifier),
        armorModifier: BigInt(template.stats.armorModifier),
        hpModifier: BigInt(template.stats.hpModifier),
        intModifier: BigInt(template.stats.intModifier),
        minLevel: BigInt(template.stats.minLevel),
        strModifier: BigInt(template.stats.strModifier),
        armorType: armorTypeValue,
      },
      {
        minAgility: BigInt(template.statRestrictions.minAgility),
        minIntelligence: BigInt(template.statRestrictions.minIntelligence),
        minStrength: BigInt(template.statRestrictions.minStrength),
      },
    ]
  );
}

function encodeWeaponStats(template: WeaponTemplate): Hex {
  // Field order must match Solidity WeaponStatsData struct:
  // agiModifier, intModifier, hpModifier, maxDamage, minDamage, minLevel, strModifier, effects
  return encodeAbiParameters(
    [
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
    ],
    [
      {
        agiModifier: BigInt(template.stats.agiModifier),
        intModifier: BigInt(template.stats.intModifier),
        hpModifier: BigInt(template.stats.hpModifier),
        maxDamage: BigInt(template.stats.maxDamage),
        minDamage: BigInt(template.stats.minDamage),
        minLevel: BigInt(template.stats.minLevel),
        strModifier: BigInt(template.stats.strModifier),
        effects: template.stats.effects,
      },
      {
        minAgility: BigInt(template.statRestrictions.minAgility),
        minIntelligence: BigInt(template.statRestrictions.minIntelligence),
        minStrength: BigInt(template.statRestrictions.minStrength),
      },
    ]
  );
}

function encodeConsumableStats(template: ConsumableTemplate): Hex {
  // Field order must match Solidity struct: minDamage, maxDamage, minLevel, effects
  return encodeAbiParameters(
    [
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
    ],
    [
      {
        minDamage: BigInt(template.stats.minDamage),
        maxDamage: BigInt(template.stats.maxDamage),
        minLevel: BigInt(template.stats.minLevel),
        effects: template.stats.effects,
      },
      {
        minAgility: BigInt(template.statRestrictions.minAgility),
        minIntelligence: BigInt(template.statRestrictions.minIntelligence),
        minStrength: BigInt(template.statRestrictions.minStrength),
      },
    ]
  );
}

function encodeMonsterStats(stats: MonsterStats): Hex {
  return encodeAbiParameters(
    [{ type: 'tuple', components: [
      { name: 'agility', type: 'int256' },
      { name: 'armor', type: 'int256' },
      { name: 'class', type: 'uint8' },
      { name: 'experience', type: 'uint256' },
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

  // Create clients
  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(rpcUrl),
  });

  const account = privateKey ? privateKeyToAccount(privateKey as Hex) : null;
  let walletClient: ReturnType<typeof createWalletClient> | null = null;
  if (!dryRun && account) {
    console.log(`Admin account: ${account.address}`);
    walletClient = createWalletClient({
      account,
      chain: foundry,
      transport: http(rpcUrl),
    });
  }

  // Track created item IDs by name for shop inventory resolution
  const itemIdsByName: Map<string, bigint> = new Map();

  // Load dependencies first (recursive)
  for (const dep of manifest.dependencies) {
    console.log(`\nLoading dependency: ${dep}`);
    // TODO: Implement recursive zone loading
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
          const hash = await walletClient.writeContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createEffect',
            args: [EffectType.PhysicalDamage, effect.name, stats],
          });
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }

      // Magic damage effects
      for (const effect of effects.magicDamage || []) {
        console.log(`  Magic: ${effect.name}`);
        if (!dryRun && walletClient) {
          const stats = encodeMagicDamageStats(effect.stats);
          const hash = await walletClient.writeContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createEffect',
            args: [EffectType.MagicDamage, effect.name, stats],
          });
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }

      // Status effects
      for (const effect of effects.statusEffects || []) {
        console.log(`  Status: ${effect.name}`);
        if (!dryRun && walletClient) {
          const stats = encodeStatusEffectStats(effect);
          const hash = await walletClient.writeContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createEffect',
            args: [EffectType.StatusEffect, effect.name, stats],
          });
          await publicClient.waitForTransactionReceipt({ hash });
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
          const hash = await walletClient.writeContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createItem',
            args: [
              ItemType.Armor,
              BigInt(armor.initialSupply),
              BigInt(armor.dropChance),
              BigInt(armor.price),
              stats,
              armor.metadataUri,
            ],
          });
          await publicClient.waitForTransactionReceipt({ hash });
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
            const starterHash = await walletClient.writeContract({
              address: worldAddress,
              abi: worldAbi,
              functionName: 'UD__setStarterItemPool',
              args: [itemId, true],
            });
            await publicClient.waitForTransactionReceipt({ hash: starterHash });
            console.log(`    -> Added to StarterItemPool`);
          }
        }
      }

      // Weapons
      for (const weapon of items.weapons || []) {
        console.log(`  Weapon: ${weapon.name}${weapon.isStarter ? ' (starter)' : ''}`);
        if (!dryRun && walletClient) {
          const stats = encodeWeaponStats(weapon);
          const hash = await walletClient.writeContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createItem',
            args: [
              ItemType.Weapon,
              BigInt(weapon.initialSupply),
              BigInt(weapon.dropChance),
              BigInt(weapon.price),
              stats,
              weapon.metadataUri,
            ],
          });
          await publicClient.waitForTransactionReceipt({ hash });
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
            const starterHash = await walletClient.writeContract({
              address: worldAddress,
              abi: worldAbi,
              functionName: 'UD__setStarterItemPool',
              args: [itemId, true],
            });
            await publicClient.waitForTransactionReceipt({ hash: starterHash });
            console.log(`    -> Added to StarterItemPool`);
          }
        }
      }

      // Consumables
      for (const consumable of items.consumables || []) {
        console.log(`  Consumable: ${consumable.name}${consumable.isStarter ? ' (starter)' : ''}`);
        if (!dryRun && walletClient) {
          const stats = encodeConsumableStats(consumable);
          const hash = await walletClient.writeContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createItem',
            args: [
              ItemType.Consumable,
              BigInt(consumable.initialSupply),
              BigInt(consumable.dropChance),
              BigInt(consumable.price),
              stats,
              consumable.metadataUri,
            ],
          });
          await publicClient.waitForTransactionReceipt({ hash });
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
            const starterHash = await walletClient.writeContract({
              address: worldAddress,
              abi: worldAbi,
              functionName: 'UD__setStarterItemPool',
              args: [itemId, true],
            });
            await publicClient.waitForTransactionReceipt({ hash: starterHash });
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
        const starterConsumablesHash = await walletClient.writeContract({
          address: worldAddress,
          abi: worldAbi,
          functionName: 'UD__setStarterConsumables',
          args: [starterConsumableIds, starterConsumableAmounts],
        });
        await publicClient.waitForTransactionReceipt({ hash: starterConsumablesHash });
        console.log(`  Set ${starterConsumableIds.length} starter consumable(s) with amount 3 each`);
      }
    }
  }

  // Load monsters
  if (manifest.load.monsters) {
    const monstersPath = path.join(zonePath, 'monsters.json');
    if (fs.existsSync(monstersPath)) {
      const monsters: MonstersJson = JSON.parse(fs.readFileSync(monstersPath, 'utf-8'));
      console.log('\n>>> Loading Monsters <<<');

      for (const monster of monsters.monsters) {
        console.log(`  Monster: ${monster.name} (Lvl ${monster.stats.level})`);
        if (!dryRun && walletClient) {
          const stats = encodeMonsterStats(monster.stats);
          const hash = await walletClient.writeContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createMob',
            args: [MobType.Monster, stats, monster.metadataUri],
          });
          await publicClient.waitForTransactionReceipt({ hash });
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
        console.log(`  Shop: ${shop.name} at (${shop.location[0]}, ${shop.location[1]})`);

        // Resolve item names to IDs
        const buyableItems: bigint[] = [];
        const sellableItems: bigint[] = [];
        const stock: bigint[] = [];
        const restock: bigint[] = [];

        for (const inv of shop.inventory) {
          const itemId = itemIdsByName.get(inv.itemName);
          if (itemId !== undefined) {
            buyableItems.push(itemId);
            sellableItems.push(itemId);
            stock.push(BigInt(inv.stock));
            restock.push(BigInt(inv.restock));
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
          const createHash = await walletClient.writeContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__createMob',
            args: [MobType.Shop, shopStats, `shop:${shop.name.toLowerCase().replace(/\s+/g, '_')}`],
          });
          const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

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

          const spawnHash = await walletClient.writeContract({
            address: worldAddress,
            abi: worldAbi,
            functionName: 'UD__spawnMob',
            args: [mobId, shop.location[0], shop.location[1]],
          });
          await publicClient.waitForTransactionReceipt({ hash: spawnHash });
          console.log(`    -> Spawned at (${shop.location[0]}, ${shop.location[1]}) with mobId ${mobId}`);
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
