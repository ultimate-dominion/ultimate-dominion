#!/usr/bin/env npx tsx
/**
 * Deploy SpellConfig + StatusEffectValidity for V2 spell system.
 * Bypasses forge script address(this) bug by using viem directly.
 *
 * Also updates arcane_surge_damage from MagicDamage → StatusEffect type
 * and sets StatusEffectTargeting for it.
 *
 * Usage:
 *   source .env.mainnet && npx tsx scripts/admin/deploy-spell-config.ts
 *   source .env.mainnet && npx tsx scripts/admin/deploy-spell-config.ts --dry-run
 */

import { config } from 'dotenv';
config({ path: '.env.mainnet', override: false });

import {
  createPublicClient,
  createWalletClient,
  http,
  Hex,
  Address,
  encodePacked,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  pad,
  numberToHex,
  toHex,
  concat,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

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
  {
    name: 'setField',
    type: 'function',
    inputs: [
      { name: 'tableId', type: 'bytes32' },
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'fieldIndex', type: 'uint8' },
      { name: 'data', type: 'bytes' },
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

function computeOffchainTableId(namespace: string, name: string): Hex {
  const ns = Buffer.alloc(14);
  ns.write(namespace);
  const nm = Buffer.alloc(16);
  nm.write(name);
  return ('0x6f74' + ns.toString('hex') + nm.toString('hex')) as Hex;
}

// ========== Effect ID computation ==========

function effectId(name: string): Hex {
  const hash = keccak256(encodeAbiParameters(parseAbiParameters('string'), [name]));
  return (hash.slice(0, 18).padEnd(66, '0')) as Hex;
}

// ========== Data encoding helpers ==========

function int256ToHex(n: bigint): string {
  // Two's complement for 32 bytes
  if (n >= 0n) {
    return n.toString(16).padStart(64, '0');
  }
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
// Schema: effectId(key), strPct(int256), agiPct(int256), intPct(int256), hpPct(int256),
//         armorFlat(int256), spellMinDamage(int256), spellMaxDamage(int256),
//         dmgPerStat(int256), dmgScalingStat(uint8), dmgIsPhysical(bool),
//         maxUses(uint256), isWeaponEnchant(bool)
// Static: 8×int256 + uint8 + bool + uint256 + bool = 8×32 + 1 + 1 + 32 + 1 = 291 bytes

interface SpellConfigData {
  strPct: bigint;
  agiPct: bigint;
  intPct: bigint;
  hpPct: bigint;
  armorFlat: bigint;
  spellMinDamage: bigint;
  spellMaxDamage: bigint;
  dmgPerStat: bigint;
  dmgScalingStat: number; // 0=None, 1=Strength, 2=Agility, 3=Intelligence
  dmgIsPhysical: boolean;
  maxUses: bigint;
  isWeaponEnchant: boolean;
}

function encodeSpellConfig(d: SpellConfigData): Hex {
  return ('0x' +
    int256ToHex(d.strPct) +
    int256ToHex(d.agiPct) +
    int256ToHex(d.intPct) +
    int256ToHex(d.hpPct) +
    int256ToHex(d.armorFlat) +
    int256ToHex(d.spellMinDamage) +
    int256ToHex(d.spellMaxDamage) +
    int256ToHex(d.dmgPerStat) +
    uint8ToHex(d.dmgScalingStat) +
    boolToHex(d.dmgIsPhysical) +
    uint256ToHex(d.maxUses) +
    boolToHex(d.isWeaponEnchant)
  ) as Hex;
}

// SpellConfig FieldLayout: 8 int256(32) + uint8(1) + bool(1) + uint256(32) + bool(1) = 291 static bytes, 12 fields, 0 dynamic
// 0x0123 0c 00 20 20 20 20 20 20 20 20 01 01 20 01 000000000000000000
const SPELL_CONFIG_FIELD_LAYOUT = '0x01230c002020202020202020010120010000000000000000000000000000' as Hex;

// ========== StatusEffectValidity encoding ==========
// Schema: effectId(key), cooldown(uint256), maxStacks(uint256), validTime(uint256), validTurns(uint256)
// Static: 4 × uint256 = 128 bytes

interface StatusEffectValidityData {
  cooldown: bigint;
  maxStacks: bigint;
  validTime: bigint;
  validTurns: bigint;
}

function encodeValidity(d: StatusEffectValidityData): Hex {
  return ('0x' +
    uint256ToHex(d.cooldown) +
    uint256ToHex(d.maxStacks) +
    uint256ToHex(d.validTime) +
    uint256ToHex(d.validTurns)
  ) as Hex;
}

// ========== Effects table encoding ==========
// Schema: effectId(key), effectType(uint8), effectExists(bool)
// Static: 2 bytes

function encodeEffects(effectType: number, effectExists: boolean): Hex {
  return ('0x' + uint8ToHex(effectType) + boolToHex(effectExists)) as Hex;
}

// ========== StatusEffectTargeting encoding ==========
// Schema: effectId(key), targetsSelf(bool)
// Static: 1 byte

function encodeTargeting(targetsSelf: boolean): Hex {
  return ('0x' + boolToHex(targetsSelf)) as Hex;
}

// ========== StatusEffectStats encoding ==========
// Schema: effectId(key), strModifier(int256), agiModifier(int256), intModifier(int256),
//         armorModifier(int256), hpModifier(int256), damagePerTick(int256), resistanceStat(uint8)
// Static: 6×int256 + uint8 = 193 bytes

function encodeStatusEffectStats(resistanceStat: number): Hex {
  // All modifiers zero, just the resistance stat
  return ('0x' +
    int256ToHex(0n) + // str
    int256ToHex(0n) + // agi
    int256ToHex(0n) + // int
    int256ToHex(0n) + // armor
    int256ToHex(0n) + // hp
    int256ToHex(0n) + // dpt
    uint8ToHex(resistanceStat) // resistanceStat
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

// ========== Spell definitions ==========

const SPELLS: { name: string; effectName: string; config: SpellConfigData; validTurns: bigint }[] = [
  {
    name: 'Battle Cry (Warrior)',
    effectName: 'battle_cry',
    config: { strPct: 2500n, agiPct: 0n, intPct: 0n, hpPct: 1000n, armorFlat: 8n, spellMinDamage: 5n, spellMaxDamage: 10n, dmgPerStat: 500n, dmgScalingStat: 1, dmgIsPhysical: true, maxUses: 2n, isWeaponEnchant: false },
    validTurns: 8n,
  },
  {
    name: 'Divine Shield (Paladin)',
    effectName: 'divine_shield',
    config: { strPct: 1500n, agiPct: 0n, intPct: 0n, hpPct: 1500n, armorFlat: 10n, spellMinDamage: 0n, spellMaxDamage: 0n, dmgPerStat: 0n, dmgScalingStat: 0, dmgIsPhysical: false, maxUses: 2n, isWeaponEnchant: false },
    validTurns: 8n,
  },
  {
    name: 'Marked Shot (Ranger, on hunters_mark effectId)',
    effectName: 'hunters_mark',
    config: { strPct: 0n, agiPct: -2000n, intPct: 0n, hpPct: 0n, armorFlat: -5n, spellMinDamage: 4n, spellMaxDamage: 8n, dmgPerStat: 400n, dmgScalingStat: 2, dmgIsPhysical: true, maxUses: 0n, isWeaponEnchant: false },
    validTurns: 8n,
  },
  {
    name: 'Expose Weakness (Rogue, on shadowstep effectId)',
    effectName: 'shadowstep',
    config: { strPct: -1500n, agiPct: 0n, intPct: 0n, hpPct: 0n, armorFlat: -8n, spellMinDamage: 4n, spellMaxDamage: 8n, dmgPerStat: 400n, dmgScalingStat: 2, dmgIsPhysical: true, maxUses: 0n, isWeaponEnchant: false },
    validTurns: 8n,
  },
  {
    name: 'Entangle (Druid)',
    effectName: 'entangle',
    config: { strPct: -1500n, agiPct: -2500n, intPct: 0n, hpPct: 0n, armorFlat: -3n, spellMinDamage: 3n, spellMaxDamage: 6n, dmgPerStat: 300n, dmgScalingStat: 3, dmgIsPhysical: false, maxUses: 0n, isWeaponEnchant: false },
    validTurns: 8n,
  },
  {
    name: 'Soul Drain (Warlock)',
    effectName: 'soul_drain_curse',
    config: { strPct: -1200n, agiPct: 0n, intPct: -1200n, hpPct: 0n, armorFlat: 0n, spellMinDamage: 4n, spellMaxDamage: 8n, dmgPerStat: 400n, dmgScalingStat: 3, dmgIsPhysical: false, maxUses: 2n, isWeaponEnchant: false },
    validTurns: 5n,
  },
  {
    name: 'Arcane Blast (Wizard)',
    effectName: 'arcane_blast_damage',
    config: { strPct: 0n, agiPct: 0n, intPct: 0n, hpPct: 0n, armorFlat: 0n, spellMinDamage: 5n, spellMaxDamage: 10n, dmgPerStat: 500n, dmgScalingStat: 3, dmgIsPhysical: false, maxUses: 3n, isWeaponEnchant: false },
    validTurns: 0n, // instant, no duration
  },
  {
    name: 'Arcane Infusion (Sorcerer, on arcane_surge_damage effectId)',
    effectName: 'arcane_surge_damage',
    config: { strPct: 0n, agiPct: 0n, intPct: 0n, hpPct: 0n, armorFlat: 0n, spellMinDamage: 3n, spellMaxDamage: 6n, dmgPerStat: 250n, dmgScalingStat: 3, dmgIsPhysical: false, maxUses: 0n, isWeaponEnchant: true },
    validTurns: 10n,
  },
  {
    name: 'Blessing (Cleric)',
    effectName: 'blessing',
    config: { strPct: 0n, agiPct: 0n, intPct: 1200n, hpPct: 1500n, armorFlat: 7n, spellMinDamage: 0n, spellMaxDamage: 0n, dmgPerStat: 0n, dmgScalingStat: 0, dmgIsPhysical: false, maxUses: 2n, isWeaponEnchant: false },
    validTurns: 6n,
  },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const worldAddress = process.env.WORLD_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL || process.env.ETH_RPC_URL || 'http://127.0.0.1:8545';
  const privateKey = process.env.PRIVATE_KEY as Hex;
  const chainId = parseInt(process.env.CHAIN_ID || '8453');

  if (!worldAddress) { console.error('WORLD_ADDRESS not set'); process.exit(1); }
  if (!privateKey && !dryRun) { console.error('PRIVATE_KEY not set'); process.exit(1); }

  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  console.log('=== Deploy SpellConfig V2 ===');
  console.log(`World: ${worldAddress}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Spells: ${SPELLS.length}\n`);

  if (dryRun) {
    for (const spell of SPELLS) {
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

  // 1. Set SpellConfig for each spell
  console.log('--- SpellConfig ---');
  for (const spell of SPELLS) {
    const eid = effectId(spell.effectName);
    const staticData = encodeSpellConfig(spell.config);

    const hash = await walletClient.writeContract({
      address: worldAddress,
      abi: storeAbi,
      functionName: 'setRecord',
      args: [SPELL_CONFIG_TABLE, [eid], staticData, NO_ENCODED_LENGTHS, NO_DYNAMIC_DATA],
      nonce: nonce++,
    });
    console.log(`  ${spell.name}: ${hash}`);
  }

  // 2. Update StatusEffectValidity for all spells
  console.log('\n--- StatusEffectValidity ---');
  for (const spell of SPELLS) {
    const eid = effectId(spell.effectName);
    const staticData = encodeValidity({
      cooldown: 0n,
      maxStacks: 1n,
      validTime: 0n,
      validTurns: spell.validTurns,
    });

    const hash = await walletClient.writeContract({
      address: worldAddress,
      abi: storeAbi,
      functionName: 'setRecord',
      args: [STATUS_EFFECT_VALIDITY_TABLE, [eid], staticData, NO_ENCODED_LENGTHS, NO_DYNAMIC_DATA],
      nonce: nonce++,
    });
    console.log(`  ${spell.name} (${spell.validTurns}t): ${hash}`);
  }

  // 3. Change arcane_surge_damage from MagicDamage(1) to StatusEffect(2)
  console.log('\n--- Arcane Surge → StatusEffect type change ---');
  const arcaneSurgeId = effectId('arcane_surge_damage');

  // Effects table: effectType=StatusEffect(2), effectExists=true
  const effectsData = encodeEffects(2, true);
  const effectsHash = await walletClient.writeContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'setRecord',
    args: [EFFECTS_TABLE, [arcaneSurgeId], effectsData, NO_ENCODED_LENGTHS, NO_DYNAMIC_DATA],
    nonce: nonce++,
  });
  console.log(`  Effects.set(arcane_surge_damage, StatusEffect): ${effectsHash}`);

  // StatusEffectTargeting: targetsSelf=true (weapon enchant is self-applied)
  const targetingData = encodeTargeting(true);
  const targetingHash = await walletClient.writeContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'setRecord',
    args: [STATUS_EFFECT_TARGETING_TABLE, [arcaneSurgeId], targetingData, NO_ENCODED_LENGTHS, NO_DYNAMIC_DATA],
    nonce: nonce++,
  });
  console.log(`  StatusEffectTargeting.set(arcane_surge_damage, self): ${targetingHash}`);

  // StatusEffectStats: all zeros (V2 ComputedEffectMods overrides this)
  const statsData = encodeStatusEffectStats(0); // ResistanceStat.None
  const statsHash = await walletClient.writeContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'setRecord',
    args: [STATUS_EFFECT_STATS_TABLE, [arcaneSurgeId], statsData, NO_ENCODED_LENGTHS, NO_DYNAMIC_DATA],
    nonce: nonce++,
  });
  console.log(`  StatusEffectStats.set(arcane_surge_damage, zeros): ${statsHash}`);

  console.log('\n=== Done! All spell configs deployed. ===');
}

main().catch((e) => { console.error(e); process.exit(1); });
