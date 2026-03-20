#!/usr/bin/env npx tsx
/**
 * Effect Sync — Compare on-chain effect data with effects.json and optionally create missing effects.
 *
 * Usage:
 *   npx tsx scripts/effect-sync.ts <zone_name> [--update] [--world <address>] [--rpc <url>]
 *
 * Modes:
 *   effect-sync.ts dark_cave           — verify only (show diff)
 *   effect-sync.ts dark_cave --update  — verify + create missing effects on-chain
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
  encodeAbiParameters,
  toHex,
  concat,
  Hex,
  Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, base } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============ Types ============

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
  targetsSelf?: boolean;
}

interface EffectsJson {
  magicDamage?: MagicDamageEffect[];
  physicalDamage?: PhysicalDamageEffect[];
  statusEffects?: StatusEffect[];
}

// ============ Enums ============

enum EffectType {
  Temporary = 0,
  PhysicalDamage = 1,
  MagicDamage = 2,
  StatusEffect = 3,
}

const EFFECT_TYPE_NAMES = ['Temporary', 'PhysicalDamage', 'MagicDamage', 'StatusEffect'];

// ============ Table Resource IDs (from codegen) ============

// Use hardcoded ResourceIds from Solidity codegen — avoids any truncation bugs
const EFFECTS_TABLE: Hex = '0x7462554400000000000000000000000045666665637473000000000000000000';
const PHYSICAL_DAMAGE_STATS_TABLE: Hex = '0x74625544000000000000000000000000506879736963616c44616d6167655374';
const MAGIC_DAMAGE_STATS_TABLE: Hex = '0x746255440000000000000000000000004d6167696344616d6167655374617473';
const STATUS_EFFECT_STATS_TABLE: Hex = '0x7462554400000000000000000000000053746174757345666665637453746174';
const STATUS_EFFECT_VALIDITY_TABLE: Hex = '0x7462554400000000000000000000000053746174757345666665637456616c69';
const STATUS_EFFECT_TARGETING_TABLE: Hex = '0x7462554400000000000000000000000053746174757345666665637454617267';

// ============ ABI ============

const worldAbi = parseAbi([
  'function getRecord(bytes32 tableId, bytes32[] keyTuple) view returns (bytes staticData, bytes32 encodedLengths, bytes dynamicData)',
  'function setRecord(bytes32 tableId, bytes32[] keyTuple, bytes staticData, bytes32 encodedLengths, bytes dynamicData)',
]);

// ============ Decoding ============

/** Interpret a raw bigint as signed int256 */
function toSigned(v: bigint): bigint {
  return BigInt.asIntN(256, v);
}

function decodeEffectsRecord(staticData: Hex): { effectType: number; effectExists: boolean } {
  const hex = staticData.slice(2);
  if (hex.length < 4) return { effectType: 0, effectExists: false };
  const effectType = parseInt(hex.slice(0, 2), 16);
  const effectExists = parseInt(hex.slice(2, 4), 16) === 1;
  return { effectType, effectExists };
}

function decodePhysicalDamageStats(staticData: Hex) {
  const hex = staticData.slice(2);
  return {
    armorPenetration: toSigned(BigInt('0x' + hex.slice(0, 64))),
    attackModifierBonus: toSigned(BigInt('0x' + hex.slice(64, 128))),
    bonusDamage: toSigned(BigInt('0x' + hex.slice(128, 192))),
    critChanceBonus: toSigned(BigInt('0x' + hex.slice(192, 256))),
  };
}

function decodeMagicDamageStats(staticData: Hex) {
  const hex = staticData.slice(2);
  return {
    attackModifierBonus: toSigned(BigInt('0x' + hex.slice(0, 64))),
    bonusDamage: toSigned(BigInt('0x' + hex.slice(64, 128))),
    critChanceBonus: toSigned(BigInt('0x' + hex.slice(128, 192))),
  };
}

function decodeStatusEffectStats(staticData: Hex) {
  const hex = staticData.slice(2);
  // Fields: agiModifier(32) + armorModifier(32) + damagePerTick(32) + hpModifier(32) + intModifier(32) + resistanceStat(1) + strModifier(32) = 193 bytes
  return {
    agiModifier: toSigned(BigInt('0x' + hex.slice(0, 64))),
    armorModifier: toSigned(BigInt('0x' + hex.slice(64, 128))),
    damagePerTick: toSigned(BigInt('0x' + hex.slice(128, 192))),
    hpModifier: toSigned(BigInt('0x' + hex.slice(192, 256))),
    intModifier: toSigned(BigInt('0x' + hex.slice(256, 320))),
    resistanceStat: parseInt(hex.slice(320, 322), 16),
    strModifier: toSigned(BigInt('0x' + hex.slice(322, 386))),
  };
}

function decodeStatusEffectValidity(staticData: Hex) {
  const hex = staticData.slice(2);
  return {
    cooldown: BigInt('0x' + hex.slice(0, 64)),
    maxStacks: BigInt('0x' + hex.slice(64, 128)),
    validTime: BigInt('0x' + hex.slice(128, 192)),
    validTurns: BigInt('0x' + hex.slice(192, 256)),
  };
}

function decodeStatusEffectTargeting(staticData: Hex): boolean {
  const hex = staticData.slice(2);
  return parseInt(hex.slice(0, 2), 16) === 1;
}

// ============ Encoding (for --update mode) ============

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
      effect.targetsSelf ?? false,
    ]
  );
}

// ============ Diff Display ============

function formatDiff(field: string, onChain: any, expected: any): string {
  return `    ${field}: ${onChain} → ${expected}`;
}

// ============ Main ============

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: npx tsx scripts/effect-sync.ts <zone_name> [options]

Options:
  --update            Create missing effects on-chain (createEffect is idempotent)
  --world <address>   World contract address
  --rpc <url>         RPC URL (default: http://127.0.0.1:8545)

Modes:
  effect-sync.ts dark_cave           — verify only (show diff)
  effect-sync.ts dark_cave --update  — verify + create missing effects
`);
    process.exit(0);
  }

  const zoneName = args[0];
  let worldAddress: Address | undefined;
  let rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  let doUpdate = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--world' && args[i + 1]) {
      worldAddress = args[i + 1] as Address;
      i++;
    } else if (args[i] === '--rpc' && args[i + 1]) {
      rpcUrl = args[i + 1];
      i++;
    } else if (args[i] === '--update') {
      doUpdate = true;
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

  const privateKey = process.env.PRIVATE_KEY;
  if (doUpdate && !privateKey) {
    console.error('Error: PRIVATE_KEY required for --update mode');
    process.exit(1);
  }

  // Load zone effects
  const effectsPath = path.join(__dirname, '..', 'zones', zoneName, 'effects.json');
  if (!fs.existsSync(effectsPath)) {
    console.error(`Error: effects.json not found at ${effectsPath}`);
    process.exit(1);
  }
  const effects: EffectsJson = JSON.parse(fs.readFileSync(effectsPath, 'utf-8'));

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
  console.log('  Ultimate Dominion - Effect Sync');
  console.log('='.repeat(60));
  console.log(`Zone: ${zoneName}`);
  console.log(`World: ${worldAddress}`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Mode: ${doUpdate ? 'UPDATE (create missing effects)' : 'VERIFY ONLY'}`);
  console.log('');

  let totalEffects = 0;
  let matchedEffects = 0;
  let mismatchedEffects = 0;
  let missingEffects = 0;

  interface SetRecordCall {
    tableId: Hex;
    key: Hex;
    staticData: Hex;
    label: string;
  }
  const writeOps: SetRecordCall[] = [];

  async function readRecord(tableId: Hex, key: Hex) {
    return publicClient.readContract({
      address: worldAddress!,
      abi: worldAbi,
      functionName: 'getRecord',
      args: [tableId, [key]],
    });
  }

  // ── Physical Damage Effects ──
  console.log('>>> Physical Damage Effects <<<');
  for (const effect of effects.physicalDamage || []) {
    totalEffects++;
    const effectId = effect.effectId as Hex;

    try {
      const [staticData] = await readRecord(EFFECTS_TABLE, effectId);
      const { effectType, effectExists } = decodeEffectsRecord(staticData);

      if (!effectExists) {
        console.log(`  MISSING: ${effect.name} (${effectId.slice(0, 18)}...)`);
        missingEffects++;
        // Queue direct table writes: Effects entry + PhysicalDamageStats
        const s = effect.stats;
        writeOps.push({
          tableId: EFFECTS_TABLE, key: effectId,
          staticData: ('0x' + EffectType.PhysicalDamage.toString(16).padStart(2, '0') + '01') as Hex,
          label: `${effect.name} → Effects`,
        });
        writeOps.push({
          tableId: PHYSICAL_DAMAGE_STATS_TABLE, key: effectId,
          staticData: encodeAbiParameters(
            [{ type: 'int256' }, { type: 'int256' }, { type: 'int256' }, { type: 'int256' }],
            [BigInt(s.armorPenetration), BigInt(s.attackModifierBonus), BigInt(s.bonusDamage), BigInt(s.critChanceBonus)]
          ),
          label: `${effect.name} → PhysicalDamageStats`,
        });
        continue;
      }

      if (effectType !== EffectType.PhysicalDamage) {
        console.log(`  TYPE MISMATCH: ${effect.name} — on-chain=${EFFECT_TYPE_NAMES[effectType]}, expected=PhysicalDamage`);
        mismatchedEffects++;
        continue;
      }

      // Compare stats
      const [statsData] = await readRecord(PHYSICAL_DAMAGE_STATS_TABLE, effectId);
      const onChain = decodePhysicalDamageStats(statsData);
      const diffs: string[] = [];

      if (onChain.armorPenetration !== BigInt(effect.stats.armorPenetration)) diffs.push(formatDiff('armorPenetration', onChain.armorPenetration, effect.stats.armorPenetration));
      if (onChain.attackModifierBonus !== BigInt(effect.stats.attackModifierBonus)) diffs.push(formatDiff('attackModifierBonus', onChain.attackModifierBonus, effect.stats.attackModifierBonus));
      if (onChain.bonusDamage !== BigInt(effect.stats.bonusDamage)) diffs.push(formatDiff('bonusDamage', onChain.bonusDamage, effect.stats.bonusDamage));
      if (onChain.critChanceBonus !== BigInt(effect.stats.critChanceBonus)) diffs.push(formatDiff('critChanceBonus', onChain.critChanceBonus, effect.stats.critChanceBonus));

      if (diffs.length > 0) {
        console.log(`  DIFF: ${effect.name}:`);
        diffs.forEach(d => console.log(d));
        mismatchedEffects++;
      } else {
        matchedEffects++;
      }
    } catch (e: any) {
      console.log(`  ERROR: ${effect.name} — ${e.message?.slice(0, 100)}`);
      missingEffects++;
    }
  }

  // ── Magic Damage Effects ──
  console.log('\n>>> Magic Damage Effects <<<');
  for (const effect of effects.magicDamage || []) {
    totalEffects++;
    const effectId = effect.effectId as Hex;

    try {
      const [staticData] = await readRecord(EFFECTS_TABLE, effectId);
      const { effectType, effectExists } = decodeEffectsRecord(staticData);

      if (!effectExists) {
        console.log(`  MISSING: ${effect.name} (${effectId.slice(0, 18)}...)`);
        missingEffects++;
        const s = effect.stats;
        writeOps.push({
          tableId: EFFECTS_TABLE, key: effectId,
          staticData: ('0x' + EffectType.MagicDamage.toString(16).padStart(2, '0') + '01') as Hex,
          label: `${effect.name} → Effects`,
        });
        writeOps.push({
          tableId: MAGIC_DAMAGE_STATS_TABLE, key: effectId,
          staticData: encodeAbiParameters(
            [{ type: 'int256' }, { type: 'int256' }, { type: 'int256' }],
            [BigInt(s.attackModifierBonus), BigInt(s.bonusDamage), BigInt(s.critChanceBonus)]
          ),
          label: `${effect.name} → MagicDamageStats`,
        });
        continue;
      }

      if (effectType !== EffectType.MagicDamage) {
        console.log(`  TYPE MISMATCH: ${effect.name} — on-chain=${EFFECT_TYPE_NAMES[effectType]}, expected=MagicDamage`);
        mismatchedEffects++;
        continue;
      }

      // Compare stats
      const [statsData] = await readRecord(MAGIC_DAMAGE_STATS_TABLE, effectId);
      const onChain = decodeMagicDamageStats(statsData);
      const diffs: string[] = [];

      if (onChain.attackModifierBonus !== BigInt(effect.stats.attackModifierBonus)) diffs.push(formatDiff('attackModifierBonus', onChain.attackModifierBonus, effect.stats.attackModifierBonus));
      if (onChain.bonusDamage !== BigInt(effect.stats.bonusDamage)) diffs.push(formatDiff('bonusDamage', onChain.bonusDamage, effect.stats.bonusDamage));
      if (onChain.critChanceBonus !== BigInt(effect.stats.critChanceBonus)) diffs.push(formatDiff('critChanceBonus', onChain.critChanceBonus, effect.stats.critChanceBonus));

      if (diffs.length > 0) {
        console.log(`  DIFF: ${effect.name}:`);
        diffs.forEach(d => console.log(d));
        mismatchedEffects++;
      } else {
        matchedEffects++;
      }
    } catch (e: any) {
      console.log(`  ERROR: ${effect.name} — ${e.message?.slice(0, 100)}`);
      missingEffects++;
    }
  }

  // ── Status Effects ──
  console.log('\n>>> Status Effects <<<');
  for (const effect of effects.statusEffects || []) {
    totalEffects++;
    const effectId = effect.effectId as Hex;

    try {
      const [staticData] = await readRecord(EFFECTS_TABLE, effectId);
      const { effectType, effectExists } = decodeEffectsRecord(staticData);

      if (!effectExists) {
        console.log(`  MISSING: ${effect.name} (${effectId.slice(0, 18)}...)`);
        missingEffects++;
        const s = effect.stats;
        const v = effect.validity;
        // Effects table entry
        writeOps.push({
          tableId: EFFECTS_TABLE, key: effectId,
          staticData: ('0x' + EffectType.StatusEffect.toString(16).padStart(2, '0') + '01') as Hex,
          label: `${effect.name} → Effects`,
        });
        // StatusEffectStats: agiMod(int256) + armorMod(int256) + dmgPerTick(int256) + hpMod(int256) + intMod(int256) + resistanceStat(uint8) + strMod(int256)
        // MUD tight-packs, so resistanceStat is 1 byte between two int256s
        const statsHex = encodeAbiParameters(
          [{ type: 'int256' }, { type: 'int256' }, { type: 'int256' }, { type: 'int256' }, { type: 'int256' }],
          [BigInt(s.agiModifier), BigInt(s.armorModifier), BigInt(s.damagePerTick), BigInt(s.hpModifier), BigInt(s.intModifier)]
        );
        const resistanceHex = s.resistanceStat.toString(16).padStart(2, '0');
        const strModHex = encodeAbiParameters([{ type: 'int256' }], [BigInt(s.strModifier)]).slice(2);
        writeOps.push({
          tableId: STATUS_EFFECT_STATS_TABLE, key: effectId,
          staticData: (statsHex + resistanceHex + strModHex) as Hex,
          label: `${effect.name} → StatusEffectStats`,
        });
        // StatusEffectValidity: cooldown(uint256) + maxStacks(uint256) + validTime(uint256) + validTurns(uint256)
        writeOps.push({
          tableId: STATUS_EFFECT_VALIDITY_TABLE, key: effectId,
          staticData: encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
            [BigInt(v.cooldown), BigInt(v.maxStacks), BigInt(v.validTime), BigInt(v.validTurns)]
          ),
          label: `${effect.name} → StatusEffectValidity`,
        });
        // StatusEffectTargeting: targetsSelf(bool) = 1 byte
        writeOps.push({
          tableId: STATUS_EFFECT_TARGETING_TABLE, key: effectId,
          staticData: ('0x' + ((effect.targetsSelf ?? false) ? '01' : '00')) as Hex,
          label: `${effect.name} → StatusEffectTargeting`,
        });
        continue;
      }

      if (effectType !== EffectType.StatusEffect) {
        console.log(`  TYPE MISMATCH: ${effect.name} — on-chain=${EFFECT_TYPE_NAMES[effectType]}, expected=StatusEffect`);
        mismatchedEffects++;
        continue;
      }

      // Compare stats, validity, and targeting
      const [[statsData], [validData], [targetData]] = await Promise.all([
        readRecord(STATUS_EFFECT_STATS_TABLE, effectId),
        readRecord(STATUS_EFFECT_VALIDITY_TABLE, effectId),
        readRecord(STATUS_EFFECT_TARGETING_TABLE, effectId),
      ]);

      const onStats = decodeStatusEffectStats(statsData);
      const onValid = decodeStatusEffectValidity(validData);
      const onTarget = decodeStatusEffectTargeting(targetData);
      const diffs: string[] = [];

      if (onStats.agiModifier !== BigInt(effect.stats.agiModifier)) diffs.push(formatDiff('agiModifier', onStats.agiModifier, effect.stats.agiModifier));
      if (onStats.armorModifier !== BigInt(effect.stats.armorModifier)) diffs.push(formatDiff('armorModifier', onStats.armorModifier, effect.stats.armorModifier));
      if (onStats.damagePerTick !== BigInt(effect.stats.damagePerTick)) diffs.push(formatDiff('damagePerTick', onStats.damagePerTick, effect.stats.damagePerTick));
      if (onStats.hpModifier !== BigInt(effect.stats.hpModifier)) diffs.push(formatDiff('hpModifier', onStats.hpModifier, effect.stats.hpModifier));
      if (onStats.intModifier !== BigInt(effect.stats.intModifier)) diffs.push(formatDiff('intModifier', onStats.intModifier, effect.stats.intModifier));
      if (onStats.resistanceStat !== effect.stats.resistanceStat) diffs.push(formatDiff('resistanceStat', onStats.resistanceStat, effect.stats.resistanceStat));
      if (onStats.strModifier !== BigInt(effect.stats.strModifier)) diffs.push(formatDiff('strModifier', onStats.strModifier, effect.stats.strModifier));

      if (onValid.cooldown !== BigInt(effect.validity.cooldown)) diffs.push(formatDiff('cooldown', onValid.cooldown, effect.validity.cooldown));
      if (onValid.maxStacks !== BigInt(effect.validity.maxStacks)) diffs.push(formatDiff('maxStacks', onValid.maxStacks, effect.validity.maxStacks));
      if (onValid.validTime !== BigInt(effect.validity.validTime)) diffs.push(formatDiff('validTime', onValid.validTime, effect.validity.validTime));
      if (onValid.validTurns !== BigInt(effect.validity.validTurns)) diffs.push(formatDiff('validTurns', onValid.validTurns, effect.validity.validTurns));

      const expectedTargetsSelf = effect.targetsSelf ?? false;
      if (onTarget !== expectedTargetsSelf) diffs.push(formatDiff('targetsSelf', onTarget, expectedTargetsSelf));

      if (diffs.length > 0) {
        console.log(`  DIFF: ${effect.name}:`);
        diffs.forEach(d => console.log(d));
        mismatchedEffects++;
        // Generate writeOps to fix mismatched stats/validity/targeting
        if (doUpdate) {
          const s = effect.stats;
          const v = effect.validity;
          const statsHex = encodeAbiParameters(
            [{ type: 'int256' }, { type: 'int256' }, { type: 'int256' }, { type: 'int256' }, { type: 'int256' }],
            [BigInt(s.agiModifier), BigInt(s.armorModifier), BigInt(s.damagePerTick), BigInt(s.hpModifier), BigInt(s.intModifier)]
          );
          const resistanceHex = s.resistanceStat.toString(16).padStart(2, '0');
          const strModHex = encodeAbiParameters([{ type: 'int256' }], [BigInt(s.strModifier)]).slice(2);
          writeOps.push({
            tableId: STATUS_EFFECT_STATS_TABLE, key: effectId,
            staticData: (statsHex + resistanceHex + strModHex) as Hex,
            label: `${effect.name} → StatusEffectStats (update)`,
          });
          writeOps.push({
            tableId: STATUS_EFFECT_VALIDITY_TABLE, key: effectId,
            staticData: encodeAbiParameters(
              [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
              [BigInt(v.cooldown), BigInt(v.maxStacks), BigInt(v.validTime), BigInt(v.validTurns)]
            ),
            label: `${effect.name} → StatusEffectValidity (update)`,
          });
          writeOps.push({
            tableId: STATUS_EFFECT_TARGETING_TABLE, key: effectId,
            staticData: ('0x' + ((effect.targetsSelf ?? false) ? '01' : '00')) as Hex,
            label: `${effect.name} → StatusEffectTargeting (update)`,
          });
        }
      } else {
        matchedEffects++;
      }
    } catch (e: any) {
      console.log(`  ERROR: ${effect.name} — ${e.message?.slice(0, 100)}`);
      missingEffects++;
    }
  }

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log(`  Results: ${matchedEffects} matched, ${mismatchedEffects} mismatched, ${missingEffects} missing (${totalEffects} total)`);
  console.log('='.repeat(60));

  if (mismatchedEffects === 0 && missingEffects === 0) {
    console.log('\nAll effects in sync!');
    return;
  }

  if (mismatchedEffects > 0 && !doUpdate) {
    console.log(`\nNote: ${mismatchedEffects} effects have stat mismatches. Run with --update to fix.`);
  }

  // ── Update Mode (direct table writes via setRecord) ──
  const ZERO_LENGTHS: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const EMPTY_DYNAMIC: Hex = '0x';

  if (doUpdate && writeOps.length > 0 && walletClient && account) {
    console.log(`\nWriting ${writeOps.length} table entries for missing effects...`);

    let currentNonce = await publicClient.getTransactionCount({ address: account.address });
    console.log(`Starting nonce: ${currentNonce}`);

    for (const op of writeOps) {
      console.log(`  ${op.label}`);
      const hash = await walletClient.writeContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'setRecord',
        args: [op.tableId, [op.key], op.staticData, ZERO_LENGTHS, EMPTY_DYNAMIC],
        nonce: currentNonce,
      });
      currentNonce++;
      await publicClient.waitForTransactionReceipt({ hash });
      await sleep(1500);
      console.log(`    -> tx: ${hash}`);
    }

    console.log(`\nDone! ${writeOps.length} table writes completed.`);
    console.log('Run effect-sync again in verify mode to confirm.');
  } else if (!doUpdate && writeOps.length > 0) {
    console.log(`\nRun with --update to write ${writeOps.length} table entries for missing effects.`);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
