#!/usr/bin/env npx tsx
/**
 * Deploy L15 Class Spells (Z2) — SpellConfig, StatusEffectValidity, Effects,
 * StatusEffectTargeting, StatusEffectStats via viem setRecord.
 *
 * Bypasses forge address(this) bug. Mirrors DeployClassSpellsL15.s.sol values.
 *
 * NOTE: Does NOT create spell weapon items or LevelUnlockItems — those require
 * UD__createItem which needs forge or a separate script. This only deploys the
 * spell combat data so hasSpellConfig returns true and spells work in combat.
 *
 * Usage:
 *   source .env.testnet && npx tsx scripts/admin/deploy-spell-config-l15.ts
 *   source .env.testnet && npx tsx scripts/admin/deploy-spell-config-l15.ts --dry-run
 */

import { config } from 'dotenv';
config();

import {
  createPublicClient,
  createWalletClient,
  http,
  Hex,
  Address,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// MUD store ABI
const storeAbi = [
  {
    name: 'setRecord',
    type: 'function',
    inputs: [
      { name: 'tableId', type: 'bytes32' },
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'staticData', type: 'bytes' },
      { name: 'encodedLengths', type: 'bytes32' },
      { name: 'dynamicData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ========== Table ID computation ==========

function computeTableId(namespace: string, name: string): Hex {
  const ns = Buffer.alloc(14);
  ns.write(namespace);
  const nm = Buffer.alloc(16);
  nm.write(name);
  return ('0x7462' + ns.toString('hex') + nm.toString('hex')) as Hex;
}

// ========== Effect ID computation ==========

function effectId(name: string): Hex {
  const hash = keccak256(encodeAbiParameters(parseAbiParameters('string'), [name]));
  return (hash.slice(0, 18).padEnd(66, '0')) as Hex;
}

// ========== Encoding helpers ==========

function int256ToHex(n: bigint): string {
  if (n >= 0n) return n.toString(16).padStart(64, '0');
  return ((1n << 256n) + n).toString(16).padStart(64, '0');
}

function uint256ToHex(n: bigint): string {
  return n.toString(16).padStart(64, '0');
}

function uint8ToHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function boolToHex(b: boolean): string {
  return b ? '01' : '00';
}

// ========== SpellConfig encoding ==========
// Schema: effectId(key), strPct, agiPct, intPct, hpPct, armorFlat, spellMinDamage, spellMaxDamage,
//         dmgPerStat, dmgScalingStat(uint8), dmgIsPhysical(bool), maxUses(uint256), isWeaponEnchant(bool)

interface SpellConfigData {
  strPct: bigint;
  agiPct: bigint;
  intPct: bigint;
  hpPct: bigint;
  armorFlat: bigint;
  spellMinDamage: bigint;
  spellMaxDamage: bigint;
  dmgPerStat: bigint;
  dmgScalingStat: number; // 0=None, 1=Str, 2=Agi, 3=Int
  dmgIsPhysical: boolean;
  maxUses: bigint;
  isWeaponEnchant: boolean;
}

function encodeSpellConfig(d: SpellConfigData): Hex {
  return ('0x' +
    int256ToHex(d.strPct) + int256ToHex(d.agiPct) + int256ToHex(d.intPct) + int256ToHex(d.hpPct) +
    int256ToHex(d.armorFlat) + int256ToHex(d.spellMinDamage) + int256ToHex(d.spellMaxDamage) +
    int256ToHex(d.dmgPerStat) + uint8ToHex(d.dmgScalingStat) + boolToHex(d.dmgIsPhysical) +
    uint256ToHex(d.maxUses) + boolToHex(d.isWeaponEnchant)
  ) as Hex;
}

function encodeValidity(cooldown: bigint, maxStacks: bigint, validTime: bigint, validTurns: bigint): Hex {
  return ('0x' +
    uint256ToHex(cooldown) + uint256ToHex(maxStacks) + uint256ToHex(validTime) + uint256ToHex(validTurns)
  ) as Hex;
}

function encodeEffects(effectType: number, effectExists: boolean): Hex {
  return ('0x' + uint8ToHex(effectType) + boolToHex(effectExists)) as Hex;
}

function encodeTargeting(targetsSelf: boolean): Hex {
  return ('0x' + boolToHex(targetsSelf)) as Hex;
}

function encodeStatusEffectStats(resistanceStat: number): Hex {
  return ('0x' +
    int256ToHex(0n) + int256ToHex(0n) + int256ToHex(0n) + // str, agi, int
    int256ToHex(0n) + int256ToHex(0n) + int256ToHex(0n) + // armor, hp, dpt
    uint8ToHex(resistanceStat)
  ) as Hex;
}

// ========== Table IDs ==========

const SPELL_CONFIG_TABLE = computeTableId('UD', 'SpellConfig');
const STATUS_EFFECT_VALIDITY_TABLE = computeTableId('UD', 'StatusEffectVali');
const EFFECTS_TABLE = computeTableId('UD', 'Effects');
const STATUS_EFFECT_TARGETING_TABLE = computeTableId('UD', 'StatusEffectTarg');
const STATUS_EFFECT_STATS_TABLE = computeTableId('UD', 'StatusEffectStat');

const NO_ENCODED_LENGTHS = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;
const NO_DYNAMIC_DATA = '0x' as Hex;

// ResistanceStat enum
const NONE = 0, STR = 1, AGI = 2, INT = 3;

// ========== L15 Spell definitions (from DeployClassSpellsL15.s.sol) ==========

const L15_SPELLS: {
  name: string;
  effectName: string;
  config: SpellConfigData;
  validTurns: bigint;
  targetsSelf: boolean;
  resistanceStat: number;
}[] = [
  {
    name: 'Warcry (Warrior)',
    effectName: 'warcry',
    config: { strPct: 3000n, agiPct: 0n, intPct: 0n, hpPct: 1500n, armorFlat: 12n, spellMinDamage: 8n, spellMaxDamage: 14n, dmgPerStat: 600n, dmgScalingStat: STR, dmgIsPhysical: true, maxUses: 1n, isWeaponEnchant: false },
    validTurns: 8n, targetsSelf: true, resistanceStat: NONE,
  },
  {
    name: 'Judgment (Paladin)',
    effectName: 'judgment',
    config: { strPct: -2000n, agiPct: -1500n, intPct: 0n, hpPct: 0n, armorFlat: -10n, spellMinDamage: 6n, spellMaxDamage: 12n, dmgPerStat: 500n, dmgScalingStat: STR, dmgIsPhysical: true, maxUses: 2n, isWeaponEnchant: false },
    validTurns: 6n, targetsSelf: false, resistanceStat: STR,
  },
  {
    name: 'Volley (Ranger)',
    effectName: 'volley',
    config: { strPct: 0n, agiPct: 0n, intPct: 0n, hpPct: 0n, armorFlat: 0n, spellMinDamage: 7n, spellMaxDamage: 14n, dmgPerStat: 600n, dmgScalingStat: AGI, dmgIsPhysical: true, maxUses: 3n, isWeaponEnchant: false },
    validTurns: 0n, targetsSelf: false, resistanceStat: NONE,
  },
  {
    name: 'Backstab (Rogue)',
    effectName: 'backstab',
    config: { strPct: -2500n, agiPct: 0n, intPct: 0n, hpPct: 0n, armorFlat: -12n, spellMinDamage: 10n, spellMaxDamage: 18n, dmgPerStat: 800n, dmgScalingStat: AGI, dmgIsPhysical: true, maxUses: 1n, isWeaponEnchant: false },
    validTurns: 4n, targetsSelf: false, resistanceStat: AGI,
  },
  {
    name: 'Regrowth (Druid)',
    effectName: 'regrowth',
    config: { strPct: 0n, agiPct: 0n, intPct: 2000n, hpPct: 2500n, armorFlat: 10n, spellMinDamage: 0n, spellMaxDamage: 0n, dmgPerStat: 0n, dmgScalingStat: NONE, dmgIsPhysical: false, maxUses: 2n, isWeaponEnchant: false },
    validTurns: 8n, targetsSelf: true, resistanceStat: NONE,
  },
  {
    name: 'Blight (Warlock)',
    effectName: 'blight',
    config: { strPct: -2000n, agiPct: -2000n, intPct: -2000n, hpPct: 0n, armorFlat: -5n, spellMinDamage: 5n, spellMaxDamage: 10n, dmgPerStat: 400n, dmgScalingStat: INT, dmgIsPhysical: false, maxUses: 1n, isWeaponEnchant: false },
    validTurns: 8n, targetsSelf: false, resistanceStat: INT,
  },
  {
    name: 'Meteor (Wizard)',
    effectName: 'meteor',
    config: { strPct: 0n, agiPct: 0n, intPct: 0n, hpPct: 0n, armorFlat: 0n, spellMinDamage: 8n, spellMaxDamage: 16n, dmgPerStat: 700n, dmgScalingStat: INT, dmgIsPhysical: false, maxUses: 2n, isWeaponEnchant: false },
    validTurns: 0n, targetsSelf: false, resistanceStat: NONE,
  },
  {
    name: 'Mana Burn (Sorcerer)',
    effectName: 'mana_burn',
    config: { strPct: 0n, agiPct: 0n, intPct: -2500n, hpPct: 0n, armorFlat: -5n, spellMinDamage: 5n, spellMaxDamage: 10n, dmgPerStat: 500n, dmgScalingStat: INT, dmgIsPhysical: false, maxUses: 0n, isWeaponEnchant: false },
    validTurns: 6n, targetsSelf: false, resistanceStat: INT,
  },
  {
    name: 'Smite (Cleric)',
    effectName: 'smite',
    config: { strPct: 0n, agiPct: 0n, intPct: 1500n, hpPct: 1500n, armorFlat: 8n, spellMinDamage: 5n, spellMaxDamage: 10n, dmgPerStat: 400n, dmgScalingStat: INT, dmgIsPhysical: false, maxUses: 2n, isWeaponEnchant: false },
    validTurns: 6n, targetsSelf: true, resistanceStat: NONE,
  },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const worldAddress = process.env.WORLD_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const privateKey = process.env.PRIVATE_KEY as Hex;
  const chainId = parseInt(process.env.CHAIN_ID || '8453');

  if (!worldAddress) { console.error('WORLD_ADDRESS not set'); process.exit(1); }
  if (!privateKey && !dryRun) { console.error('PRIVATE_KEY not set'); process.exit(1); }

  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  console.log('=== Deploy L15 Class Spells (Z2) ===');
  console.log(`World: ${worldAddress}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Spells: ${L15_SPELLS.length}\n`);

  if (dryRun) {
    for (const spell of L15_SPELLS) {
      const eid = effectId(spell.effectName);
      console.log(`${spell.name}: effectId=${eid.slice(0, 18)}...`);
    }
    console.log('\nDry run — no changes made.');
    return;
  }

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  let nonce = await publicClient.getTransactionCount({ address: account.address });

  console.log(`Deployer: ${account.address}`);
  console.log(`Starting nonce: ${nonce}\n`);

  // 1. StatusEffectStats (resistance stat for each spell)
  console.log('--- StatusEffectStats ---');
  for (const spell of L15_SPELLS) {
    const eid = effectId(spell.effectName);
    const data = encodeStatusEffectStats(spell.resistanceStat);
    const hash = await walletClient.writeContract({
      address: worldAddress, abi: storeAbi, functionName: 'setRecord',
      args: [STATUS_EFFECT_STATS_TABLE, [eid], data, NO_ENCODED_LENGTHS, NO_DYNAMIC_DATA],
      nonce: nonce++,
    });
    console.log(`  ${spell.name}: ${hash}`);
  }

  // 2. StatusEffectTargeting
  console.log('\n--- StatusEffectTargeting ---');
  for (const spell of L15_SPELLS) {
    const eid = effectId(spell.effectName);
    const data = encodeTargeting(spell.targetsSelf);
    const hash = await walletClient.writeContract({
      address: worldAddress, abi: storeAbi, functionName: 'setRecord',
      args: [STATUS_EFFECT_TARGETING_TABLE, [eid], data, NO_ENCODED_LENGTHS, NO_DYNAMIC_DATA],
      nonce: nonce++,
    });
    console.log(`  ${spell.name} (self=${spell.targetsSelf}): ${hash}`);
  }

  // 3. StatusEffectValidity
  console.log('\n--- StatusEffectValidity ---');
  for (const spell of L15_SPELLS) {
    const eid = effectId(spell.effectName);
    const data = encodeValidity(0n, 1n, 0n, spell.validTurns);
    const hash = await walletClient.writeContract({
      address: worldAddress, abi: storeAbi, functionName: 'setRecord',
      args: [STATUS_EFFECT_VALIDITY_TABLE, [eid], data, NO_ENCODED_LENGTHS, NO_DYNAMIC_DATA],
      nonce: nonce++,
    });
    console.log(`  ${spell.name} (${spell.validTurns}t): ${hash}`);
  }

  // 4. Effects table (mark as StatusEffect, exists=true)
  console.log('\n--- Effects ---');
  for (const spell of L15_SPELLS) {
    const eid = effectId(spell.effectName);
    const data = encodeEffects(3, true); // EffectType.StatusEffect = 3
    const hash = await walletClient.writeContract({
      address: worldAddress, abi: storeAbi, functionName: 'setRecord',
      args: [EFFECTS_TABLE, [eid], data, NO_ENCODED_LENGTHS, NO_DYNAMIC_DATA],
      nonce: nonce++,
    });
    console.log(`  ${spell.name}: ${hash}`);
  }

  // 5. SpellConfig
  console.log('\n--- SpellConfig ---');
  for (const spell of L15_SPELLS) {
    const eid = effectId(spell.effectName);
    const data = encodeSpellConfig(spell.config);
    const hash = await walletClient.writeContract({
      address: worldAddress, abi: storeAbi, functionName: 'setRecord',
      args: [SPELL_CONFIG_TABLE, [eid], data, NO_ENCODED_LENGTHS, NO_DYNAMIC_DATA],
      nonce: nonce++,
    });
    console.log(`  ${spell.name}: ${hash}`);
  }

  console.log(`\n=== Done! ${L15_SPELLS.length} L15 spell configs deployed. ===`);
  console.log('NOTE: Spell weapon items + LevelUnlockItems still need forge script or separate viem script.');
}

main().catch((e) => { console.error(e); process.exit(1); });
