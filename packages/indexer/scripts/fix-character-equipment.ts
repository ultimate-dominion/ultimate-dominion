/**
 * Fix CharacterEquipment indexer corruption.
 *
 * Reads on-chain state for all characters in the decoded table,
 * compares with indexer Postgres, and patches mismatches.
 *
 * CharacterEquipment schema:
 *   Key: bytes32 (character entity ID)
 *   Static (5 fields, 160 bytes): strBonus, agiBonus, intBonus, hpBonus, armor
 *   Dynamic (5 fields):
 *     0: equippedArmor (uint256[])
 *     1: equippedWeapons (uint256[])
 *     2: equippedSpells (uint256[])
 *     3: equippedConsumables (uint256[])
 *     4: equippedAccessories (uint256[])
 */

import postgres from 'postgres';
import { createPublicClient, http, type Hex, concatHex, hexToBytes, numberToHex, pad } from 'viem';
import { base } from 'viem/chains';

const WORLD = '0x99d01939F58B965E6E84a1D167E710Abdf5764b0' as const;
const RPC_URL = process.env.RPC_URL || 'https://rpc.ultimatedominion.com';
const DB_URL = process.env.DATABASE_PUBLIC_URL
  || 'postgresql://postgres:LyiHVtbzDZzJWgcTDdeNpuJnkYbukpXl@mainline.proxy.rlwy.net:24965/railway';
const DECODED_SCHEMA = WORLD.toLowerCase();
const DECODED_TABLE = 'ud__character_equipme';
const CE_TABLE_ID = '0x7462554400000000000000000000000043686172616374657245717569706d65' as Hex;

const getDynAbi = [{
  name: 'getDynamicField', type: 'function', stateMutability: 'view',
  inputs: [
    { name: 'tableId', type: 'bytes32' },
    { name: 'keyTuple', type: 'bytes32[]' },
    { name: 'dynamicFieldIndex', type: 'uint8' },
  ],
  outputs: [{ name: '', type: 'bytes' }],
}] as const;

const getStaticAbi = [{
  name: 'getStaticField', type: 'function', stateMutability: 'view',
  inputs: [
    { name: 'tableId', type: 'bytes32' },
    { name: 'keyTuple', type: 'bytes32[]' },
    { name: 'fieldIndex', type: 'uint8' },
    { name: 'fieldLayout', type: 'bytes32' },
  ],
  outputs: [{ name: '', type: 'bytes32' }],
}] as const;

const CE_FIELD_LAYOUT = '0x00a0050520202020200000000000000000000000000000000000000000000000' as Hex;

// Dynamic field name mapping (index → decoded column name)
const DYN_FIELDS = [
  'equipped_armor',       // index 0
  'equipped_weapons',     // index 1
  'equipped_spells',      // index 2
  'equipped_consumables', // index 3
  'equipped_accessories', // index 4
] as const;

function parseUint256Array(hex: Hex): number[] {
  if (!hex || hex === '0x' || hex.length <= 2) return [];
  const raw = hex.slice(2);
  const arr: number[] = [];
  for (let i = 0; i < raw.length; i += 64) {
    arr.push(parseInt(raw.slice(i, i + 64), 16));
  }
  return arr;
}

function encodeUint256Array(values: number[]): Buffer {
  const hex = values.map(v => v.toString(16).padStart(64, '0')).join('');
  return Buffer.from(hex, 'hex');
}

function encodeEncodedLengths(fieldLengths: number[]): Buffer {
  const total = fieldLengths.reduce((a, b) => a + b, 0);
  let encoded = BigInt(total);
  for (let i = 0; i < fieldLengths.length; i++) {
    encoded |= BigInt(fieldLengths[i]) << BigInt(56 + i * 40);
  }
  return Buffer.from(encoded.toString(16).padStart(64, '0'), 'hex');
}

async function main() {
  const sql = postgres(DB_URL, { max: 5 });
  const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

  console.log('Reading CharacterEquipment from indexer...');

  const rows = await sql.unsafe(
    `SELECT __key_bytes, equipped_weapons, equipped_armor, equipped_consumables, equipped_spells, equipped_accessories FROM "${DECODED_SCHEMA}"."${DECODED_TABLE}"`,
  );

  console.log(`Found ${rows.length} rows. Comparing with on-chain...`);

  const ceTableIdBuf = Buffer.from(CE_TABLE_ID.slice(2), 'hex');
  let mismatches = 0;
  let matches = 0;
  let fixed = 0;
  const blockNumber = await client.getBlockNumber();

  for (const row of rows) {
    const kb = row.__key_bytes as Buffer;
    const entityKey = ('0x' + kb.toString('hex')) as Hex;
    const addr = entityKey.slice(2, 42);

    // Read all 5 dynamic fields on-chain
    const chainFields: number[][] = [];
    for (let i = 0; i < 5; i++) {
      try {
        const r = await client.readContract({
          address: WORLD, abi: getDynAbi, functionName: 'getDynamicField',
          args: [CE_TABLE_ID, [entityKey], i],
        });
        chainFields.push(parseUint256Array(r as Hex));
      } catch {
        chainFields.push([]);
      }
      await new Promise(r => setTimeout(r, 30));
    }

    // Read static fields (5 int256/uint256 values)
    const chainStatic: bigint[] = [];
    for (let i = 0; i < 5; i++) {
      try {
        const r = await client.readContract({
          address: WORLD, abi: getStaticAbi, functionName: 'getStaticField',
          args: [CE_TABLE_ID, [entityKey], i, CE_FIELD_LAYOUT],
        });
        chainStatic.push(BigInt(r as Hex));
      } catch {
        chainStatic.push(0n);
      }
      await new Promise(r => setTimeout(r, 30));
    }

    // Compare dynamic fields
    const idxArmor = ((row.equipped_armor || []) as any[]).map(Number).sort();
    const idxWeapons = ((row.equipped_weapons || []) as any[]).map(Number).sort();
    const idxSpells = ((row.equipped_spells || []) as any[]).map(Number).sort();
    const idxConsumables = ((row.equipped_consumables || []) as any[]).map(Number).sort();
    const idxAccessories = ((row.equipped_accessories || []) as any[]).map(Number).sort();

    const chainArmor = [...chainFields[0]].sort();
    const chainWeapons = [...chainFields[1]].sort();
    const chainSpells = [...chainFields[2]].sort();
    const chainConsumables = [...chainFields[3]].sort();
    const chainAccessories = [...chainFields[4]].sort();

    const armorOk = JSON.stringify(idxArmor) === JSON.stringify(chainArmor);
    const weaponsOk = JSON.stringify(idxWeapons) === JSON.stringify(chainWeapons);
    const spellsOk = JSON.stringify(idxSpells) === JSON.stringify(chainSpells);
    const consumablesOk = JSON.stringify(idxConsumables) === JSON.stringify(chainConsumables);
    const accessoriesOk = JSON.stringify(idxAccessories) === JSON.stringify(chainAccessories);

    if (armorOk && weaponsOk && spellsOk && consumablesOk && accessoriesOk) {
      matches++;
      continue;
    }

    mismatches++;
    console.log(`  MISMATCH ${addr}:`);
    if (!armorOk) console.log(`    armor: chain=${JSON.stringify(chainFields[0])} idx=${JSON.stringify(idxArmor)}`);
    if (!weaponsOk) console.log(`    weapons: chain=${JSON.stringify(chainFields[1])} idx=${JSON.stringify(idxWeapons)}`);
    if (!spellsOk) console.log(`    spells: chain=${JSON.stringify(chainFields[2])} idx=${JSON.stringify(idxSpells)}`);
    if (!consumablesOk) console.log(`    consumables: chain=${JSON.stringify(chainFields[3])} idx=${JSON.stringify(idxConsumables)}`);
    if (!accessoriesOk) console.log(`    accessories: chain=${JSON.stringify(chainFields[4])} idx=${JSON.stringify(idxAccessories)}`);

    // Fix: update decoded table (Postgres native array format)
    const toPgArray = (arr: number[]) => `{${arr.join(',')}}`;

    await sql.unsafe(
      `UPDATE "${DECODED_SCHEMA}"."${DECODED_TABLE}" SET
        equipped_armor = $1::numeric[], equipped_weapons = $2::numeric[], equipped_spells = $3::numeric[],
        equipped_consumables = $4::numeric[], equipped_accessories = $5::numeric[],
        "__last_updated_block_number" = $6
       WHERE __key_bytes = $7`,
      [toPgArray(chainFields[0]), toPgArray(chainFields[1]), toPgArray(chainFields[2]),
       toPgArray(chainFields[3]), toPgArray(chainFields[4]), blockNumber.toString(), kb],
    );

    // Fix: update raw records table
    // Reconstruct dynamic_data = concat of all 5 dynamic fields (tightly packed)
    const dynBuffers = chainFields.map(f => encodeUint256Array(f));
    const dynamicData = Buffer.concat(dynBuffers);
    const fieldLengths = dynBuffers.map(b => b.length);
    const encodedLengths = encodeEncodedLengths(fieldLengths);

    // Also reconstruct static_data (5 x 32-byte int256/uint256 values)
    const staticParts: Buffer[] = [];
    for (const val of chainStatic) {
      // Handle signed int256: if negative, it's already in two's complement as uint256
      const hex = (val < 0n
        ? (BigInt('0x10000000000000000000000000000000000000000000000000000000000000000') + val).toString(16)
        : val.toString(16)
      ).padStart(64, '0');
      staticParts.push(Buffer.from(hex, 'hex'));
    }
    const staticData = Buffer.concat(staticParts);

    const keyBytes = Buffer.from(entityKey.slice(2), 'hex');
    await sql`
      UPDATE mud.records
      SET static_data = ${staticData},
          encoded_lengths = ${encodedLengths},
          dynamic_data = ${dynamicData},
          block_number = ${blockNumber.toString()}
      WHERE table_id = ${ceTableIdBuf}
        AND key_bytes = ${keyBytes}
    `;

    fixed++;
  }

  console.log(`\n${matches} match, ${mismatches} mismatch, ${fixed} fixed.`);
  await sql.end();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
