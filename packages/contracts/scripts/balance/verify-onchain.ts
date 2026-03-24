#!/usr/bin/env npx tsx
/**
 * Verify On-Chain State — drift detection between local JSON/sim and on-chain.
 *
 * Checks: monsters, spells (SpellConfig + StatusEffectValidity), combat constants.
 * Run before any deploy as a blocking check.
 *
 * Usage:
 *   source .env.mainnet && npx tsx scripts/balance/verify-onchain.ts
 */

import { config } from 'dotenv';
config({ path: '.env.mainnet', override: false });

import {
  createPublicClient,
  http,
  decodeAbiParameters,
  encodeAbiParameters,
  parseAbiParameters,
  parseAbi,
  keccak256,
  pad,
  numberToHex,
  toHex,
  concat,
  type Hex,
  type Address,
} from 'viem';
import { base, foundry } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

// ============ Config ============

const worldAddress = process.env.WORLD_ADDRESS as Address;
const rpcUrl = process.env.RPC_URL || process.env.ETH_RPC_URL || 'http://127.0.0.1:8545';
const chainId = parseInt(process.env.CHAIN_ID || '8453');

if (!worldAddress) {
  console.error('WORLD_ADDRESS not set');
  process.exit(1);
}

const chain = chainId === 8453 ? base : foundry;
const client = createPublicClient({ chain, transport: http(rpcUrl) });

// ============ MUD Table IDs ============

function tableId(namespace: string, name: string): Hex {
  const typeBytes = toHex('tb', { size: 2 });
  const nsBytes = toHex(namespace, { size: 14 });
  const nameBytes = toHex(name, { size: 16 });
  return concat([typeBytes, nsBytes, nameBytes]);
}

const MOBS_TABLE = tableId('UD', 'Mobs');
const SPELL_CONFIG_TABLE = tableId('UD', 'SpellConfig');
const STATUS_EFFECT_VALIDITY_TABLE = tableId('UD', 'StatusEffectVali');
const CONSTANTS_TABLE = tableId('UD', 'CombatConstants');

// ============ ABIs ============

const storeAbi = parseAbi([
  'function getRecord(bytes32 tableId, bytes32[] keyTuple, bytes32 fieldLayout) view returns (bytes staticData, bytes32 encodedLengths, bytes dynamicData)',
  'function getField(bytes32 tableId, bytes32[] keyTuple, uint8 fieldIndex, bytes32 fieldLayout) view returns (bytes data)',
  'function getStaticField(bytes32 tableId, bytes32[] keyTuple, uint8 fieldIndex, bytes32 fieldLayout) view returns (bytes32 data)',
]);

const MONSTER_STATS_ABI = [
  {
    type: 'tuple' as const,
    components: [
      { name: 'agility', type: 'int256' as const },
      { name: 'armor', type: 'int256' as const },
      { name: 'class', type: 'uint8' as const },
      { name: 'experience', type: 'uint256' as const },
      { name: 'hasBossAI', type: 'bool' as const },
      { name: 'hitPoints', type: 'int256' as const },
      { name: 'intelligence', type: 'int256' as const },
      { name: 'inventory', type: 'uint256[]' as const },
      { name: 'level', type: 'uint256' as const },
      { name: 'strength', type: 'int256' as const },
    ],
  },
] as const;

const MOBS_FIELD_LAYOUT = '0x0001010201000000000000000000000000000000000000000000000000000000' as Hex;

// SpellConfig: 8×int256(32) + uint8(1) + bool(1) + uint256(32) + bool(1) = 291 static, 12 fields, 0 dynamic
const SPELL_CONFIG_FIELD_LAYOUT = '0x01230c002020202020202020010120010000000000000000000000000000' as Hex;

// StatusEffectValidity: 4×uint256 = 128 static, 4 fields, 0 dynamic
const VALIDITY_FIELD_LAYOUT = '0x008004002020202000000000000000000000000000000000000000000000' as Hex;

// ============ Helpers ============

function effectId(name: string): Hex {
  const hash = keccak256(encodeAbiParameters(parseAbiParameters('string'), [name]));
  return (hash.slice(0, 18).padEnd(66, '0')) as Hex;
}

function readInt256(hex: string, offset: number): bigint {
  const slice = hex.slice(offset, offset + 64);
  const val = BigInt('0x' + slice);
  // Two's complement: if MSB is set, it's negative
  if (val >= 2n ** 255n) return val - 2n ** 256n;
  return val;
}

function readUint256(hex: string, offset: number): bigint {
  return BigInt('0x' + hex.slice(offset, offset + 64));
}

function readUint8(hex: string, offset: number): number {
  return parseInt(hex.slice(offset, offset + 2), 16);
}

function readBool(hex: string, offset: number): boolean {
  return hex.slice(offset, offset + 2) !== '00';
}

let mismatches = 0;

function check(label: string, expected: unknown, actual: unknown) {
  const e = typeof expected === 'bigint' ? expected.toString() : expected;
  const a = typeof actual === 'bigint' ? actual.toString() : actual;
  if (e !== a) {
    console.error(`  MISMATCH ${label}: expected=${e}, on-chain=${a}`);
    mismatches++;
  }
}

// ============ Monster Verification ============

interface MonsterJson {
  name: string;
  metadataUri: string;
  stats: {
    agility: number;
    armor: number;
    class: number;
    experience: number;
    hitPoints: number;
    intelligence: number;
    level: number;
    strength: number;
    inventoryNames: string[];
  };
}

async function verifyMonsters() {
  console.log('\n=== Monsters ===');
  const monstersPath = path.resolve(__dirname, '../zones/dark_cave/monsters.json');
  const monsters: MonsterJson[] = JSON.parse(fs.readFileSync(monstersPath, 'utf-8'));

  for (let i = 0; i < monsters.length; i++) {
    const mob = monsters[i];
    const mobId = i + 1; // 1-indexed
    const keyTuple = [pad(numberToHex(mobId), { size: 32 })] as Hex[];

    try {
      const [staticData, encodedLengths, dynamicData] = await client.readContract({
        address: worldAddress,
        abi: storeAbi,
        functionName: 'getRecord',
        args: [MOBS_TABLE, keyTuple, MOBS_FIELD_LAYOUT],
      });

      // Parse encoded lengths to extract mobStats bytes
      const lenHex = (encodedLengths as string).slice(2).padStart(64, '0');
      const field0Len = parseInt(lenHex.slice(40, 50), 16);
      const dynHex = (dynamicData as string).slice(2);
      const statsHex = ('0x' + dynHex.slice(0, field0Len * 2)) as Hex;

      const [onChain] = decodeAbiParameters(MONSTER_STATS_ABI, statsHex);

      console.log(`  ${mob.name} (mob ${mobId}):`);
      check(`${mob.name}.strength`, BigInt(mob.stats.strength), onChain.strength);
      check(`${mob.name}.agility`, BigInt(mob.stats.agility), onChain.agility);
      check(`${mob.name}.intelligence`, BigInt(mob.stats.intelligence), onChain.intelligence);
      check(`${mob.name}.hitPoints`, BigInt(mob.stats.hitPoints), onChain.hitPoints);
      check(`${mob.name}.armor`, BigInt(mob.stats.armor), onChain.armor);
      check(`${mob.name}.level`, BigInt(mob.stats.level), onChain.level);
      check(`${mob.name}.experience`, BigInt(mob.stats.experience), onChain.experience);
      check(`${mob.name}.class`, mob.stats.class, onChain.class);
    } catch (e: any) {
      console.error(`  ERROR reading mob ${mobId} (${mob.name}): ${e.message?.slice(0, 100)}`);
      mismatches++;
    }
  }
}

// ============ SpellConfig Verification ============

interface SpellDef {
  name: string;
  effectName: string;
  strPct: bigint;
  agiPct: bigint;
  intPct: bigint;
  hpPct: bigint;
  armorFlat: bigint;
  spellMinDamage: bigint;
  spellMaxDamage: bigint;
  dmgPerStat: bigint;
  dmgScalingStat: number;
  dmgIsPhysical: boolean;
  maxUses: bigint;
  isWeaponEnchant: boolean;
  validTurns: bigint;
}

// Source of truth: matches deploy-spell-config.ts SPELLS array
const SPELLS: SpellDef[] = [
  { name: 'Battle Cry', effectName: 'battle_cry', strPct: 2500n, agiPct: 0n, intPct: 0n, hpPct: 1000n, armorFlat: 8n, spellMinDamage: 5n, spellMaxDamage: 10n, dmgPerStat: 500n, dmgScalingStat: 1, dmgIsPhysical: true, maxUses: 2n, isWeaponEnchant: false, validTurns: 8n },
  { name: 'Divine Shield', effectName: 'divine_shield', strPct: 1500n, agiPct: 0n, intPct: 0n, hpPct: 1500n, armorFlat: 10n, spellMinDamage: 0n, spellMaxDamage: 0n, dmgPerStat: 0n, dmgScalingStat: 0, dmgIsPhysical: false, maxUses: 2n, isWeaponEnchant: false, validTurns: 8n },
  { name: 'Marked Shot', effectName: 'hunters_mark', strPct: 0n, agiPct: -2000n, intPct: 0n, hpPct: 0n, armorFlat: -5n, spellMinDamage: 4n, spellMaxDamage: 8n, dmgPerStat: 400n, dmgScalingStat: 2, dmgIsPhysical: true, maxUses: 0n, isWeaponEnchant: false, validTurns: 8n },
  { name: 'Expose Weakness', effectName: 'shadowstep', strPct: -1500n, agiPct: 0n, intPct: 0n, hpPct: 0n, armorFlat: -8n, spellMinDamage: 4n, spellMaxDamage: 8n, dmgPerStat: 400n, dmgScalingStat: 2, dmgIsPhysical: true, maxUses: 0n, isWeaponEnchant: false, validTurns: 8n },
  { name: 'Entangle', effectName: 'entangle', strPct: -1500n, agiPct: -2500n, intPct: 0n, hpPct: 0n, armorFlat: -3n, spellMinDamage: 3n, spellMaxDamage: 6n, dmgPerStat: 300n, dmgScalingStat: 3, dmgIsPhysical: false, maxUses: 0n, isWeaponEnchant: false, validTurns: 8n },
  { name: 'Soul Drain', effectName: 'soul_drain_curse', strPct: -1200n, agiPct: 0n, intPct: -1200n, hpPct: 0n, armorFlat: 0n, spellMinDamage: 4n, spellMaxDamage: 8n, dmgPerStat: 400n, dmgScalingStat: 3, dmgIsPhysical: false, maxUses: 2n, isWeaponEnchant: false, validTurns: 5n },
  { name: 'Arcane Blast', effectName: 'arcane_blast_damage', strPct: 0n, agiPct: 0n, intPct: 0n, hpPct: 0n, armorFlat: 0n, spellMinDamage: 5n, spellMaxDamage: 10n, dmgPerStat: 500n, dmgScalingStat: 3, dmgIsPhysical: false, maxUses: 3n, isWeaponEnchant: false, validTurns: 0n },
  { name: 'Arcane Infusion', effectName: 'arcane_surge_damage', strPct: 0n, agiPct: 0n, intPct: 0n, hpPct: 0n, armorFlat: 0n, spellMinDamage: 3n, spellMaxDamage: 6n, dmgPerStat: 250n, dmgScalingStat: 3, dmgIsPhysical: false, maxUses: 0n, isWeaponEnchant: true, validTurns: 10n },
  { name: 'Blessing', effectName: 'blessing', strPct: 0n, agiPct: 0n, intPct: 1200n, hpPct: 1500n, armorFlat: 7n, spellMinDamage: 0n, spellMaxDamage: 0n, dmgPerStat: 0n, dmgScalingStat: 0, dmgIsPhysical: false, maxUses: 2n, isWeaponEnchant: false, validTurns: 6n },
];

async function verifySpells() {
  console.log('\n=== SpellConfig ===');

  for (const spell of SPELLS) {
    const eid = effectId(spell.effectName);
    const keyTuple = [eid] as Hex[];

    try {
      // Read SpellConfig
      const [staticData] = await client.readContract({
        address: worldAddress,
        abi: storeAbi,
        functionName: 'getRecord',
        args: [SPELL_CONFIG_TABLE, keyTuple, SPELL_CONFIG_FIELD_LAYOUT],
      });

      const hex = (staticData as string).slice(2);
      console.log(`  ${spell.name} (${spell.effectName}):`);

      check(`${spell.name}.strPct`, spell.strPct, readInt256(hex, 0));
      check(`${spell.name}.agiPct`, spell.agiPct, readInt256(hex, 64));
      check(`${spell.name}.intPct`, spell.intPct, readInt256(hex, 128));
      check(`${spell.name}.hpPct`, spell.hpPct, readInt256(hex, 192));
      check(`${spell.name}.armorFlat`, spell.armorFlat, readInt256(hex, 256));
      check(`${spell.name}.spellMinDamage`, spell.spellMinDamage, readInt256(hex, 320));
      check(`${spell.name}.spellMaxDamage`, spell.spellMaxDamage, readInt256(hex, 384));
      check(`${spell.name}.dmgPerStat`, spell.dmgPerStat, readInt256(hex, 448));
      check(`${spell.name}.dmgScalingStat`, spell.dmgScalingStat, readUint8(hex, 512));
      check(`${spell.name}.dmgIsPhysical`, spell.dmgIsPhysical, readBool(hex, 514));
      check(`${spell.name}.maxUses`, spell.maxUses, readUint256(hex, 516));
      check(`${spell.name}.isWeaponEnchant`, spell.isWeaponEnchant, readBool(hex, 580));

      // Read StatusEffectValidity (validTurns)
      if (spell.validTurns > 0n) {
        const [validityData] = await client.readContract({
          address: worldAddress,
          abi: storeAbi,
          functionName: 'getRecord',
          args: [STATUS_EFFECT_VALIDITY_TABLE, keyTuple, VALIDITY_FIELD_LAYOUT],
        });
        const vHex = (validityData as string).slice(2);
        // Schema: cooldown(uint256), maxStacks(uint256), validTime(uint256), validTurns(uint256)
        const onChainValidTurns = readUint256(vHex, 192); // 4th field, offset 3*64=192
        check(`${spell.name}.validTurns`, spell.validTurns, onChainValidTurns);
      }
    } catch (e: any) {
      console.error(`  ERROR reading spell ${spell.name}: ${e.message?.slice(0, 100)}`);
      mismatches++;
    }
  }
}

// ============ Combat Constants Verification ============

async function verifyCombatConstants() {
  console.log('\n=== Combat Constants (from sim constants.json) ===');

  const constantsPath = path.resolve(__dirname, 'constants.json');
  const simConstants = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));

  // These are Solidity constants, not stored in tables.
  // We verify by reading them from the compiled contract constants.
  // Since they're compile-time constants, the only way to verify is by checking
  // that our constants.json matches what we deployed. Print expected values for manual comparison.
  const expected = {
    attackModifier: simConstants.combat.damage.attackModifier,
    agiAttackModifier: simConstants.combat.damage.agiAttackModifier,
    doubleStrikeCap: simConstants.combat.doubleStrike.cap,
    evasionCap: simConstants.combat.evasion.cap,
    spellDodgeCap: simConstants.combat.spellDodge.cap,
    blockCap: simConstants.combat.block.cap,
    classMultiplierBase: simConstants.combat.classMultiplierBase,
    maxLevel: simConstants.leveling.maxLevel,
  };

  // Compare against known on-chain constants from constants.sol
  const onChainConstants = {
    attackModifier: 1.2,       // ATTACK_MODIFIER = 1.2 ether
    agiAttackModifier: 1.0,    // AGI_ATTACK_MODIFIER = 1.0 ether
    doubleStrikeCap: 40,       // DOUBLE_STRIKE_CAP = 40
    evasionCap: 35,            // EVASION_CAP = 35
    spellDodgeCap: 20,         // SPELL_DODGE_CAP = 20
    blockCap: 35,              // BLOCK_CAP = 35
    classMultiplierBase: 1000, // CLASS_MULTIPLIER_BASE = 1000
    maxLevel: 10,              // MAX_LEVEL = 10
  };

  for (const [key, expectedVal] of Object.entries(expected)) {
    const onChainVal = onChainConstants[key as keyof typeof onChainConstants];
    check(`constant.${key}`, expectedVal, onChainVal);
  }

  // Also check DEFAULT_MAX_TURNS — this was changed from 30 to 15
  console.log('  DEFAULT_MAX_TURNS: expected=15 (deployed via contract update)');
}

// ============ Main ============

async function main() {
  console.log('=== Verify On-Chain State ===');
  console.log(`World: ${worldAddress}`);
  console.log(`Chain: ${chainId}`);
  console.log(`RPC:   ${rpcUrl?.slice(0, 50)}...`);

  await verifyMonsters();
  await verifySpells();
  await verifyCombatConstants();

  console.log(`\n=== Results: ${mismatches} mismatches ===`);
  if (mismatches > 0) {
    console.error('FAIL — on-chain state has drifted from source of truth.');
    process.exit(1);
  } else {
    console.log('PASS — all checks match.');
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
