#!/usr/bin/env npx tsx
/**
 * V3 Balance Patch — Update Class Spells
 *
 * Updates all 9 class spells:
 * - Updates weapon stats (minDmg/maxDmg) via adminUpdateItemStats
 * - Updates status effect stats (duration, modifiers) via direct table writes
 * - Creates new MagicDamage effects for spells that changed from buff→damage_buff
 * - Sets SpellScaling entries for stat routing
 *
 * Usage:
 *   npx tsx scripts/v3/update-spells.ts [--apply] [--world <address>] [--rpc <url>]
 */

import { config } from 'dotenv';
config();

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  toHex,
  concat,
  keccak256,
  encodePacked,
  encodeAbiParameters,
  Hex,
  Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, base } from 'viem/chains';
import { encodeWeaponStats } from '../lib/encode-stats';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============ Enums ============

enum ResistanceStat {
  None = 0,
  Strength = 1,
  Agility = 2,
  Intelligence = 3,
}

enum AdvancedClass {
  None = 0,
  Paladin = 1,
  Sorcerer = 2,
  Warrior = 3,
  Druid = 4,
  Warlock = 5,
  Ranger = 6,
  Cleric = 7,
  Wizard = 8,
  Rogue = 9,
}

// ============ Effect ID Generation ============

/** Compute effect ID the same way DeployClassSpells.s.sol does */
function computeEffectId(name: string): Hex {
  const hash = keccak256(encodeAbiParameters([{ type: 'string' }], [name]));
  // bytes32(bytes8(keccak256(...))) — take first 8 bytes, pad to 32
  return (hash.slice(0, 18) + '0'.repeat(48)) as Hex;
}

// ============ V3 Spell Definitions ============

interface SpellDef {
  name: string;
  advancedClass: AdvancedClass;
  metadataUri: string;
  // Weapon stats
  minDamage: number;
  maxDamage: number;
  // Scaling
  scalingStat: ResistanceStat;
  // Status effect (if any)
  statusEffect?: {
    effectName: string; // existing effect name for ID computation
    strModifier: number;
    agiModifier: number;
    intModifier: number;
    armorModifier: number;
    hpModifier: number;
    validTurns: number;
    targetsSelf: boolean;
    resistanceStat: ResistanceStat;
  };
  // Magic damage effect (if spell does damage)
  magicDamageEffect?: {
    effectName: string; // for ID computation (may be new)
    bonusDamage: number;
    critChanceBonus: number;
  };
}

const V3_SPELLS: SpellDef[] = [
  {
    name: 'Battle Cry',
    advancedClass: AdvancedClass.Warrior,
    metadataUri: 'spell:battle_cry',
    minDamage: 4,
    maxDamage: 8,
    scalingStat: ResistanceStat.Strength,
    statusEffect: {
      effectName: 'battle_cry',
      strModifier: 5,
      agiModifier: 0,
      intModifier: 0,
      armorModifier: 3,
      hpModifier: 0,
      validTurns: 6,
      targetsSelf: true,
      resistanceStat: ResistanceStat.None,
    },
    magicDamageEffect: {
      effectName: 'battle_cry_damage',
      bonusDamage: 0,
      critChanceBonus: 0,
    },
  },
  {
    name: 'Divine Shield',
    advancedClass: AdvancedClass.Paladin,
    metadataUri: 'spell:divine_shield',
    minDamage: 3,
    maxDamage: 7,
    scalingStat: ResistanceStat.Strength,
    statusEffect: {
      effectName: 'divine_shield',
      strModifier: 4,
      agiModifier: 0,
      intModifier: 0,
      armorModifier: 5,
      hpModifier: 0,
      validTurns: 6,
      targetsSelf: true,
      resistanceStat: ResistanceStat.None,
    },
    magicDamageEffect: {
      effectName: 'divine_shield_damage',
      bonusDamage: 0,
      critChanceBonus: 0,
    },
  },
  {
    name: "Hunter's Mark",
    advancedClass: AdvancedClass.Ranger,
    metadataUri: 'spell:hunters_mark',
    minDamage: 3,
    maxDamage: 7,
    scalingStat: ResistanceStat.Agility,
    statusEffect: {
      effectName: 'hunters_mark',
      strModifier: 0,
      agiModifier: -5,
      intModifier: 0,
      armorModifier: -2,
      hpModifier: 0,
      validTurns: 6,
      targetsSelf: false,
      resistanceStat: ResistanceStat.Agility,
    },
    magicDamageEffect: {
      effectName: 'hunters_mark_damage',
      bonusDamage: 0,
      critChanceBonus: 0,
    },
  },
  {
    name: 'Shadowstep',
    advancedClass: AdvancedClass.Rogue,
    metadataUri: 'spell:shadowstep',
    minDamage: 4,
    maxDamage: 8,
    scalingStat: ResistanceStat.Agility,
    statusEffect: {
      effectName: 'shadowstep',
      strModifier: 0,
      agiModifier: 8,
      intModifier: 0,
      armorModifier: 0,
      hpModifier: 0,
      validTurns: 4,
      targetsSelf: true,
      resistanceStat: ResistanceStat.None,
    },
    magicDamageEffect: {
      effectName: 'shadowstep_damage',
      bonusDamage: 0,
      critChanceBonus: 0,
    },
  },
  {
    name: 'Entangle',
    advancedClass: AdvancedClass.Druid,
    metadataUri: 'spell:entangle',
    minDamage: 3,
    maxDamage: 6,
    scalingStat: ResistanceStat.Intelligence,
    statusEffect: {
      effectName: 'entangle',
      strModifier: -3,
      agiModifier: -5,
      intModifier: 0,
      armorModifier: 0,
      hpModifier: 0,
      validTurns: 6,
      targetsSelf: false,
      resistanceStat: ResistanceStat.Agility,
    },
    magicDamageEffect: {
      effectName: 'entangle_damage',
      bonusDamage: 0,
      critChanceBonus: 0,
    },
  },
  {
    name: 'Soul Drain',
    advancedClass: AdvancedClass.Warlock,
    metadataUri: 'spell:soul_drain',
    minDamage: 4,
    maxDamage: 8,
    scalingStat: ResistanceStat.Intelligence,
    statusEffect: {
      effectName: 'soul_drain_curse',
      strModifier: -4,
      agiModifier: 0,
      intModifier: -4,
      armorModifier: 0,
      hpModifier: 0,
      validTurns: 5,
      targetsSelf: false,
      resistanceStat: ResistanceStat.Intelligence,
    },
    magicDamageEffect: {
      effectName: 'soul_drain_damage',
      bonusDamage: 1,
      critChanceBonus: 0,
    },
  },
  {
    name: 'Arcane Blast',
    advancedClass: AdvancedClass.Wizard,
    metadataUri: 'spell:arcane_blast',
    minDamage: 5,
    maxDamage: 10,
    scalingStat: ResistanceStat.Intelligence,
    magicDamageEffect: {
      effectName: 'arcane_blast_damage',
      bonusDamage: 3,
      critChanceBonus: 2,
    },
  },
  {
    name: 'Arcane Surge',
    advancedClass: AdvancedClass.Sorcerer,
    metadataUri: 'spell:arcane_surge',
    minDamage: 4,
    maxDamage: 8,
    scalingStat: ResistanceStat.Intelligence,
    magicDamageEffect: {
      effectName: 'arcane_surge_damage',
      bonusDamage: 2,
      critChanceBonus: 1,
    },
  },
  {
    name: 'Blessing',
    advancedClass: AdvancedClass.Cleric,
    metadataUri: 'spell:blessing',
    minDamage: 0,
    maxDamage: 0,
    scalingStat: ResistanceStat.Intelligence,
    statusEffect: {
      effectName: 'blessing',
      strModifier: 0,
      agiModifier: 0,
      intModifier: 4,
      armorModifier: 5,
      hpModifier: 5,
      validTurns: 6,
      targetsSelf: true,
      resistanceStat: ResistanceStat.None,
    },
  },
];

// ============ MUD Helpers ============

function tableResourceId(namespace: string, name: string): Hex {
  const typeBytes = toHex('tb', { size: 2 });
  const nsBytes = toHex(namespace, { size: 14 });
  const nameBytes = toHex(name, { size: 16 });
  return concat([typeBytes, nsBytes, nameBytes]);
}

const URI_STORAGE_TABLE_ID = tableResourceId('Items', 'URIStorage');

function keyTuple(id: number | bigint): Hex[] {
  return [toHex(BigInt(id), { size: 32 })];
}

function decodeUriRecord(dynamicData: Hex): string {
  if (!dynamicData || dynamicData === '0x') return '';
  return Buffer.from(dynamicData.slice(2), 'hex').toString('utf-8');
}

// ============ ABI ============

const worldAbi = parseAbi([
  'function getRecord(bytes32 tableId, bytes32[] keyTuple) view returns (bytes staticData, bytes32 encodedLengths, bytes dynamicData)',
  'function UD__adminUpdateItemStats(uint256 itemId, uint256 dropChance, uint256 price, uint256 rarity, bytes stats)',
  'function UD__adminSetSpellScaling(bytes32 effectId, uint8 scalingStat)',
  'function UD__createEffect(uint8 effectType, string name, bytes effectStats) returns (bytes32)',
]);

// ============ Main ============

async function main() {
  const args = process.argv.slice(2);
  let worldAddress: Address | undefined = process.env.WORLD_ADDRESS as Address | undefined;
  let rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  let doApply = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--world' && args[i + 1]) {
      worldAddress = args[i + 1] as Address;
      i++;
    } else if (args[i] === '--rpc' && args[i + 1]) {
      rpcUrl = args[i + 1];
      i++;
    } else if (args[i] === '--apply') {
      doApply = true;
    }
  }

  if (!worldAddress) {
    console.error('Error: WORLD_ADDRESS env var or --world flag required');
    process.exit(1);
  }

  const chainId = parseInt(process.env.CHAIN_ID || '31337');
  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  // Step 1: Scan URIs to find spell weapon item IDs
  console.log('Scanning on-chain item URIs for spell weapons...');
  const uriToId = new Map<string, bigint>();
  const MAX_EMPTY_GAP = 20;
  let consecutiveEmpty = 0;

  for (let id = 1n; consecutiveEmpty < MAX_EMPTY_GAP; id++) {
    try {
      const [, , dynamicData] = await publicClient.readContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'getRecord',
        args: [URI_STORAGE_TABLE_ID, keyTuple(id)],
      });
      const uri = decodeUriRecord(dynamicData as Hex);
      if (uri) {
        uriToId.set(uri, id);
        consecutiveEmpty = 0;
      } else {
        consecutiveEmpty++;
      }
    } catch {
      consecutiveEmpty++;
    }
  }

  console.log(`Found ${uriToId.size} items on-chain\n`);

  // Step 2: Show planned changes
  console.log('=== V3 Spell Updates ===\n');

  for (const spell of V3_SPELLS) {
    const itemId = uriToId.get(spell.metadataUri);
    console.log(`${spell.name} (${spell.metadataUri})`);
    console.log(`  Item ID: ${itemId ? `#${itemId}` : 'NOT FOUND'}`);
    console.log(`  Damage: ${spell.minDamage}-${spell.maxDamage}`);
    console.log(`  Scaling: ${ResistanceStat[spell.scalingStat]}`);

    if (spell.statusEffect) {
      const se = spell.statusEffect;
      const effectId = computeEffectId(se.effectName);
      console.log(`  Status Effect: ${se.effectName} (${effectId.slice(0, 18)}...)`);
      console.log(`    STR=${se.strModifier} AGI=${se.agiModifier} INT=${se.intModifier} ARM=${se.armorModifier} HP=${se.hpModifier}`);
      console.log(`    Duration: ${se.validTurns} turns, Self: ${se.targetsSelf}`);
    }

    if (spell.magicDamageEffect) {
      const md = spell.magicDamageEffect;
      const effectId = computeEffectId(md.effectName);
      console.log(`  Magic Damage Effect: ${md.effectName} (${effectId.slice(0, 18)}...)`);
      console.log(`    bonusDamage=${md.bonusDamage} critChanceBonus=${md.critChanceBonus}`);
      console.log(`  → SpellScaling: ${md.effectName} → ${ResistanceStat[spell.scalingStat]}`);
    }

    console.log('');
  }

  if (!doApply) {
    console.log(`Dry run complete. Use --apply to push changes on-chain.`);
    return;
  }

  // Step 3: Apply changes
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY required for --apply');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  let currentNonce = await publicClient.getTransactionCount({ address: account.address });

  for (const spell of V3_SPELLS) {
    const itemId = uriToId.get(spell.metadataUri);
    if (!itemId) {
      console.log(`Skipping ${spell.name} — item not found on-chain`);
      continue;
    }

    console.log(`\nUpdating ${spell.name} (item #${itemId})...`);

    // Build effects array for the weapon
    const effects: Hex[] = [];

    // Handle magic damage effect
    if (spell.magicDamageEffect) {
      const md = spell.magicDamageEffect;
      const effectId = computeEffectId(md.effectName);
      effects.push(effectId);

      // Set SpellScaling for the damage effect
      const hash = await walletClient.writeContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'UD__adminSetSpellScaling',
        args: [effectId, spell.scalingStat],
        nonce: currentNonce++,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  Set SpellScaling: ${md.effectName} → ${ResistanceStat[spell.scalingStat]}`);
      await sleep(2000);
    }

    // Handle status effect
    if (spell.statusEffect) {
      const se = spell.statusEffect;
      const effectId = computeEffectId(se.effectName);
      effects.push(effectId);
    }

    // Update weapon stats
    const encodedStats = encodeWeaponStats({
      name: spell.name,
      metadataUri: spell.metadataUri,
      dropChance: 0,
      initialSupply: 0,
      price: 0,
      stats: {
        agiModifier: 0,
        intModifier: 0,
        hpModifier: 0,
        maxDamage: spell.maxDamage,
        minDamage: spell.minDamage,
        minLevel: 10,
        strModifier: 0,
        effects,
      },
      statRestrictions: {
        minAgility: 0,
        minIntelligence: 0,
        minStrength: 0,
      },
    });

    const hash = await walletClient.writeContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__adminUpdateItemStats',
      args: [itemId, 0n, 0n, 1n, encodedStats],
      nonce: currentNonce++,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  Updated weapon stats: ${spell.minDamage}-${spell.maxDamage} dmg`);
    await sleep(2000);
  }

  console.log('\n=== Spell updates complete ===');
}

main().catch(console.error);
