#!/usr/bin/env npx tsx
/**
 * TypeScript seeding script for Ultimate Dominion game data
 *
 * This script seeds items and monsters to the deployed world contract
 * without relying on Foundry's vm.parseJson() which has memory limitations.
 *
 * Usage:
 *   npx tsx scripts/seed-game-data.ts [--world <address>] [--rpc <url>]
 *
 * Environment variables:
 *   PRIVATE_KEY - Private key for the deployer account
 *   WORLD_ADDRESS - Address of the deployed world (optional, reads from worlds.json)
 *   RPC_URL - RPC URL (default: http://127.0.0.1:8545)
 */

import { createPublicClient, createWalletClient, http, parseAbi, encodeAbiParameters, Hex, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

// ============ Types ============

interface StatRestrictions {
  minAgility: bigint;
  minIntelligence: bigint;
  minStrength: bigint;
}

interface ArmorStats {
  agiModifier: bigint;
  armorModifier: bigint;
  hpModifier: bigint;
  intModifier: bigint;
  minLevel: bigint;
  strModifier: bigint;
}

interface WeaponStats {
  agiModifier: bigint;
  effects: Hex[];
  hpModifier: bigint;
  intModifier: bigint;
  maxDamage: bigint;
  minDamage: bigint;
  minLevel: bigint;
  strModifier: bigint;
}

interface ConsumableStats {
  effects: Hex[];
  maxDamage: bigint;
  minDamage: bigint;
  minLevel: bigint;
}

interface ArmorTemplate {
  name: string;
  rarity?: number;
  dropChance: number;
  initialSupply: string;
  metadataUri: string;
  price: string;
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
  initialSupply: string;
  metadataUri: string;
  price: string;
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
  initialSupply: string;
  metadataUri: string;
  price: string;
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
  metadataUriPrefix: string;
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

// ============ ItemType enum (must match Solidity) ============
enum ItemType {
  Weapon = 0,
  Armor = 1,
  Consumable = 2,
  QuestItem = 3,
  Accessory = 4,
}

enum MobType {
  Monster = 0,
  NPC = 1,
  Shop = 2,
}

// ============ ABI for world contract functions ============
const worldAbi = parseAbi([
  // Read-only functions
  'function UD__getCurrentItemsCounter() view returns (uint256)',

  // Direct ItemsSystem functions (require namespace access - works for deployer before ownership transfer)
  'function UD__createItem(uint8 itemType, uint256 supply, uint256 dropChance, uint256 price, bytes stats, string itemMetadataURI) returns (uint256)',
  'function UD__createMob(uint8 mobType, bytes stats, string mobMetadataUri) returns (uint256)',
]);

// ============ ABI encoding helpers ============

function encodeArmorStats(stats: ArmorStats, restrictions: StatRestrictions): Hex {
  return encodeAbiParameters(
    [
      { type: 'tuple', components: [
        { name: 'agiModifier', type: 'int256' },
        { name: 'armorModifier', type: 'int256' },
        { name: 'hpModifier', type: 'int256' },
        { name: 'intModifier', type: 'int256' },
        { name: 'minLevel', type: 'uint256' },
        { name: 'strModifier', type: 'int256' },
      ]},
      { type: 'tuple', components: [
        { name: 'minAgility', type: 'int256' },
        { name: 'minIntelligence', type: 'int256' },
        { name: 'minStrength', type: 'int256' },
      ]},
    ],
    [
      {
        agiModifier: stats.agiModifier,
        armorModifier: stats.armorModifier,
        hpModifier: stats.hpModifier,
        intModifier: stats.intModifier,
        minLevel: stats.minLevel,
        strModifier: stats.strModifier,
      },
      {
        minAgility: restrictions.minAgility,
        minIntelligence: restrictions.minIntelligence,
        minStrength: restrictions.minStrength,
      },
    ]
  );
}

function encodeWeaponStats(stats: WeaponStats, restrictions: StatRestrictions): Hex {
  return encodeAbiParameters(
    [
      { type: 'tuple', components: [
        { name: 'agiModifier', type: 'int256' },
        { name: 'effects', type: 'bytes32[]' },
        { name: 'hpModifier', type: 'int256' },
        { name: 'intModifier', type: 'int256' },
        { name: 'maxDamage', type: 'int256' },
        { name: 'minDamage', type: 'int256' },
        { name: 'minLevel', type: 'uint256' },
        { name: 'strModifier', type: 'int256' },
      ]},
      { type: 'tuple', components: [
        { name: 'minAgility', type: 'int256' },
        { name: 'minIntelligence', type: 'int256' },
        { name: 'minStrength', type: 'int256' },
      ]},
    ],
    [
      {
        agiModifier: stats.agiModifier,
        effects: stats.effects,
        hpModifier: stats.hpModifier,
        intModifier: stats.intModifier,
        maxDamage: stats.maxDamage,
        minDamage: stats.minDamage,
        minLevel: stats.minLevel,
        strModifier: stats.strModifier,
      },
      {
        minAgility: restrictions.minAgility,
        minIntelligence: restrictions.minIntelligence,
        minStrength: restrictions.minStrength,
      },
    ]
  );
}

function encodeConsumableStats(stats: ConsumableStats, restrictions: StatRestrictions): Hex {
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
        minDamage: stats.minDamage,
        maxDamage: stats.maxDamage,
        minLevel: stats.minLevel,
        effects: stats.effects,
      },
      {
        minAgility: restrictions.minAgility,
        minIntelligence: restrictions.minIntelligence,
        minStrength: restrictions.minStrength,
      },
    ]
  );
}

function encodeMonsterStats(stats: MonsterStats): Hex {
  return encodeAbiParameters(
    [
      { type: 'tuple', components: [
        { name: 'agility', type: 'int256' },
        { name: 'armor', type: 'int256' },
        { name: 'class', type: 'uint8' },
        { name: 'experience', type: 'uint256' },
        { name: 'hitPoints', type: 'int256' },
        { name: 'intelligence', type: 'int256' },
        { name: 'inventory', type: 'uint256[]' },
        { name: 'level', type: 'uint256' },
        { name: 'strength', type: 'int256' },
      ]},
    ],
    [
      {
        agility: BigInt(stats.agility),
        armor: BigInt(stats.armor),
        class: stats.class,
        experience: BigInt(stats.experience),
        hitPoints: BigInt(stats.hitPoints),
        intelligence: BigInt(stats.intelligence),
        inventory: stats.inventory.map(i => BigInt(i)),
        level: BigInt(stats.level),
        strength: BigInt(stats.strength),
      },
    ]
  );
}

// ============ Main seeding functions ============

async function main() {
  // Parse command line args
  const args = process.argv.slice(2);
  let worldAddress: Address | undefined;
  let rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--world' && args[i + 1]) {
      worldAddress = args[i + 1] as Address;
      i++;
    } else if (args[i] === '--rpc' && args[i + 1]) {
      rpcUrl = args[i + 1];
      i++;
    }
  }

  // Get world address from worlds.json if not provided
  if (!worldAddress) {
    worldAddress = process.env.WORLD_ADDRESS as Address;
  }
  if (!worldAddress) {
    const worldsPath = path.join(__dirname, '..', 'worlds.json');
    if (fs.existsSync(worldsPath)) {
      const worlds = JSON.parse(fs.readFileSync(worldsPath, 'utf-8'));
      // Default to local chain (31337)
      worldAddress = worlds['31337']?.address as Address;
    }
  }

  if (!worldAddress) {
    console.error('Error: World address not found. Provide --world <address> or set WORLD_ADDRESS env var.');
    process.exit(1);
  }

  // Get private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY environment variable not set.');
    console.error('For local development, use: export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    process.exit(1);
  }

  console.log('='.repeat(50));
  console.log('  Ultimate Dominion - TypeScript Game Data Seeder');
  console.log('='.repeat(50));
  console.log(`World Address: ${worldAddress}`);
  console.log(`RPC URL: ${rpcUrl}`);
  console.log('');

  // Create clients
  const account = privateKeyToAccount(privateKey as Hex);
  console.log(`Deployer: ${account.address}`);

  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: foundry,
    transport: http(rpcUrl),
  });

  // Load JSON files (use expanded versions with full content)
  const itemsPath = path.join(__dirname, '..', 'items_expanded.json');
  const monstersPath = path.join(__dirname, '..', 'monsters_expanded.json');

  const items: ItemsJson = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
  const monsters: MonstersJson = JSON.parse(fs.readFileSync(monstersPath, 'utf-8'));

  console.log(`\nLoaded ${items.armor.length} armor, ${items.weapons.length} weapons, ${items.consumables.length} consumables`);
  console.log(`Loaded ${monsters.monsters.length} monsters`);

  // Check current item counter
  const currentCounter = await publicClient.readContract({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'UD__getCurrentItemsCounter',
  });
  console.log(`\nCurrent items counter: ${currentCounter}`);

  // Check if we should skip (only if counter matches expected full count)
  const expectedItemCount = items.armor.length + items.weapons.length + items.consumables.length;
  if (Number(currentCounter) >= expectedItemCount) {
    console.log(`\nItems already fully seeded (${currentCounter}/${expectedItemCount}). Skipping.`);
  } else {
    if (Number(currentCounter) > 0) {
      console.log(`\nPartial items exist (${currentCounter}). Adding remaining items...`);
    }
    // Seed items
    console.log('\n>>> Seeding Items <<<');

    // Track item IDs for starter items
    const itemIds: { armor: bigint[], weapons: bigint[], consumables: bigint[] } = {
      armor: [],
      weapons: [],
      consumables: [],
    };

    // Create armor
    console.log('\nCreating armor...');
    for (const armor of items.armor) {
      const stats = encodeArmorStats(
        {
          agiModifier: BigInt(armor.stats.agiModifier),
          armorModifier: BigInt(armor.stats.armorModifier),
          hpModifier: BigInt(armor.stats.hpModifier),
          intModifier: BigInt(armor.stats.intModifier),
          minLevel: BigInt(armor.stats.minLevel),
          strModifier: BigInt(armor.stats.strModifier),
        },
        {
          minAgility: BigInt(armor.statRestrictions.minAgility),
          minIntelligence: BigInt(armor.statRestrictions.minIntelligence),
          minStrength: BigInt(armor.statRestrictions.minStrength),
        }
      );

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

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const newCounter = await publicClient.readContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'UD__getCurrentItemsCounter',
      });

      itemIds.armor.push(newCounter);
      console.log(`  Armor created: ${armor.name} (id: ${newCounter})`);
    }

    // Create weapons
    console.log('\nCreating weapons...');
    for (const weapon of items.weapons) {
      const stats = encodeWeaponStats(
        {
          agiModifier: BigInt(weapon.stats.agiModifier),
          effects: weapon.stats.effects,
          hpModifier: BigInt(weapon.stats.hpModifier),
          intModifier: BigInt(weapon.stats.intModifier),
          maxDamage: BigInt(weapon.stats.maxDamage),
          minDamage: BigInt(weapon.stats.minDamage),
          minLevel: BigInt(weapon.stats.minLevel),
          strModifier: BigInt(weapon.stats.strModifier),
        },
        {
          minAgility: BigInt(weapon.statRestrictions.minAgility),
          minIntelligence: BigInt(weapon.statRestrictions.minIntelligence),
          minStrength: BigInt(weapon.statRestrictions.minStrength),
        }
      );

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
      const newCounter = await publicClient.readContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'UD__getCurrentItemsCounter',
      });

      itemIds.weapons.push(newCounter);
      console.log(`  Weapon created: ${weapon.name} (id: ${newCounter})`);
    }

    // Create consumables
    console.log('\nCreating consumables...');
    for (const consumable of items.consumables) {
      const stats = encodeConsumableStats(
        {
          effects: consumable.stats.effects,
          maxDamage: BigInt(consumable.stats.maxDamage),
          minDamage: BigInt(consumable.stats.minDamage),
          minLevel: BigInt(consumable.stats.minLevel),
        },
        {
          minAgility: BigInt(consumable.statRestrictions.minAgility),
          minIntelligence: BigInt(consumable.statRestrictions.minIntelligence),
          minStrength: BigInt(consumable.statRestrictions.minStrength),
        }
      );

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
      const newCounter = await publicClient.readContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'UD__getCurrentItemsCounter',
      });

      itemIds.consumables.push(newCounter);
      console.log(`  Consumable created: ${consumable.name} (id: ${newCounter})`);
    }

    console.log('\nItems seeding complete!');
  }

  // Check monster count - PostDeploy creates minimal starter monsters
  // We add the expanded monsters regardless (they'll get new IDs)
  const expectedMonsterCount = monsters.monsters.length;
  const skipMonsters = Number(currentCounter) >= expectedItemCount && Number(currentCounter) > 10;

  if (skipMonsters) {
    console.log(`\nMonsters likely already seeded. Skipping.`);
  } else {
    console.log(`\nSeeding ${expectedMonsterCount} monsters...`);
    // Seed monsters
    console.log('\n>>> Seeding Monsters <<<');

    for (const monster of monsters.monsters) {
      const stats = encodeMonsterStats(monster.stats);

      const hash = await walletClient.writeContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__createMob',
      args: [
        MobType.Monster,
        stats,
        monster.metadataUri,
      ],
    });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  Monster created: ${monster.name}`);
    }

    console.log('\nMonsters seeding complete!');
  }

  console.log('\n' + '='.repeat(50));
  console.log('  Game data seeding complete!');
  console.log('='.repeat(50));
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
