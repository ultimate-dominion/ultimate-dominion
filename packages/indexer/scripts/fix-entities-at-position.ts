/**
 * Fix EntitiesAtPosition indexer corruption.
 *
 * Reads on-chain state for all tiles in the 10x10 grid, compares with
 * the indexer's Postgres, and patches both the raw records table and
 * the decoded table to match on-chain truth.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL=postgresql://... npx tsx scripts/fix-entities-at-position.ts
 *
 * Or with env vars from Railway:
 *   DATABASE_PUBLIC_URL=$(railway variables --service Postgres --json | jq -r .DATABASE_PUBLIC_URL) \
 *   npx tsx scripts/fix-entities-at-position.ts
 */

import postgres from 'postgres';
import { createPublicClient, http, type Hex, encodePacked, concatHex, pad, toHex, hexToBytes } from 'viem';
import { base } from 'viem/chains';

// --- Config ---
const WORLD = '0x99d01939F58B965E6E84a1D167E710Abdf5764b0' as const;
const RPC_URL = process.env.RPC_URL || 'https://rpc.ultimatedominion.com';
const DB_URL = process.env.DATABASE_PUBLIC_URL
  || 'postgresql://postgres:LyiHVtbzDZzJWgcTDdeNpuJnkYbukpXl@mainline.proxy.rlwy.net:24965/railway';
const DECODED_SCHEMA = WORLD.toLowerCase();
const DECODED_TABLE = 'ud__entities_at_positi';
const EAP_TABLE_ID = '0x74625544000000000000000000000000456e7469746965734174506f73697469' as Hex;
const EAP_FIELD_LAYOUT = '0x0000000100000000000000000000000000000000000000000000000000000000' as Hex;
const GRID_MIN = 1;
const GRID_MAX = 10;

// --- Helpers ---

/** Encode (x, y) as MUD keyTuple: [bytes32(uint256(x)), bytes32(uint256(y))] */
function encodeKeyTuple(x: number, y: number): [Hex, Hex] {
  return [
    pad(toHex(x), { size: 32 }),
    pad(toHex(y), { size: 32 }),
  ];
}

/** Encode keyTuple as packed keyBytes (for raw records table) */
function keyTupleToKeyBytes(keyTuple: [Hex, Hex]): Buffer {
  const packed = concatHex(keyTuple);
  return Buffer.from(packed.slice(2), 'hex');
}

/** Parse raw dynamic data (packed bytes32[]) into array of hex strings */
function parseDynamicData(data: Hex): string[] {
  if (!data || data === '0x' || data.length <= 2) return [];
  const raw = data.slice(2); // strip 0x
  const entities: string[] = [];
  for (let i = 0; i < raw.length; i += 64) {
    entities.push('0x' + raw.slice(i, i + 64));
  }
  return entities;
}

/** Encode EncodedLengths for a single dynamic field */
function encodeEncodedLengths(byteLength: number): Buffer {
  // MUD v2: (field0_len << 56) | total_len
  const buf = Buffer.alloc(32, 0);
  // total_len in lowest 7 bytes
  const total = BigInt(byteLength);
  // field0_len starting at byte offset 25 (bit 56)
  const field0 = BigInt(byteLength);
  const encoded = (field0 << 56n) | total;
  const hex = encoded.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

// --- Main ---

async function main() {
  const sql = postgres(DB_URL, { max: 5 });

  const client = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });

  console.log('Reading on-chain EntitiesAtPosition for all tiles...');

  // Build multicall for all tiles
  const tiles: { x: number; y: number; keyTuple: [Hex, Hex] }[] = [];
  for (let x = GRID_MIN; x <= GRID_MAX; x++) {
    for (let y = GRID_MIN; y <= GRID_MAX; y++) {
      tiles.push({ x, y, keyTuple: encodeKeyTuple(x, y) });
    }
  }

  // Read on-chain state via getDynamicField for each tile
  // Sequential to avoid rate limits on public RPC
  const onChainData = new Map<string, { entities: string[]; rawHex: Hex }>();
  let readErrors = 0;

  const getDynFieldAbi = [{
    name: 'getDynamicField',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tableId', type: 'bytes32' },
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'dynamicFieldIndex', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
  }] as const;

  for (const { x, y, keyTuple } of tiles) {
    try {
      const result = await client.readContract({
        address: WORLD,
        abi: getDynFieldAbi,
        functionName: 'getDynamicField',
        args: [EAP_TABLE_ID, keyTuple, 0],
      });
      const rawHex = result as Hex;
      onChainData.set(`${x},${y}`, { entities: parseDynamicData(rawHex), rawHex });
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('reverted') || msg.includes('StoreCore_DataIndexOverflow')) {
        // Record doesn't exist on-chain — genuinely empty tile
        onChainData.set(`${x},${y}`, { entities: [], rawHex: '0x' });
      } else if (msg.includes('429') || msg.includes('rate') || msg.includes('limit')) {
        // Rate limited — SKIP this tile entirely (don't write zeros)
        readErrors++;
        if (readErrors <= 3) console.error(`  RATE LIMITED (${x},${y}) — skipping`);
      } else {
        readErrors++;
        console.error(`  ERROR (${x},${y}):`, msg.substring(0, 120));
      }
    }
    // Small delay between calls to avoid rate limits
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`Read ${onChainData.size} tiles from chain (${readErrors} errors).`);

  // Read current indexer state
  const indexerRows = await sql.unsafe(
    `SELECT x, y, entities FROM "${DECODED_SCHEMA}"."${DECODED_TABLE}" WHERE x >= ${GRID_MIN} AND x <= ${GRID_MAX} AND y >= ${GRID_MIN} AND y <= ${GRID_MAX}`,
  );

  const indexerData = new Map<string, string[]>();
  for (const row of indexerRows) {
    const parsed = typeof row.entities === 'string' ? JSON.parse(row.entities) : row.entities;
    const ents = parsed?.json || parsed || [];
    indexerData.set(`${row.x},${row.y}`, ents);
  }

  // Compare and find mismatches
  let mismatches = 0;
  let matches = 0;
  const fixes: { x: number; y: number; onChain: string[]; rawHex: Hex }[] = [];

  for (const [key, chainState] of onChainData) {
    const indexerState = indexerData.get(key) || [];
    const chainSet = new Set(chainState.entities);
    const indexerSet = new Set(indexerState);

    const same = chainSet.size === indexerSet.size &&
      [...chainSet].every(e => indexerSet.has(e));

    if (!same) {
      const [x, y] = key.split(',').map(Number);
      mismatches++;
      fixes.push({ x, y, onChain: chainState.entities, rawHex: chainState.rawHex });
      if (mismatches <= 5) {
        console.log(`  MISMATCH (${x},${y}): chain=${chainState.entities.length} indexer=${indexerState.length}`);
      }
    } else {
      matches++;
    }
  }

  console.log(`\n${matches} tiles match, ${mismatches} tiles need fixing.`);

  if (mismatches === 0) {
    console.log('Nothing to fix!');
    await sql.end();
    return;
  }

  // Apply fixes
  console.log(`\nApplying ${fixes.length} fixes...`);

  const eapTableIdBuf = Buffer.from(EAP_TABLE_ID.slice(2), 'hex');

  for (const fix of fixes) {
    const keyTuple = encodeKeyTuple(fix.x, fix.y);
    const keyBytes = keyTupleToKeyBytes(keyTuple);
    const dynamicData = fix.rawHex === '0x' ? Buffer.alloc(0) : Buffer.from(fix.rawHex.slice(2), 'hex');
    const encodedLengths = encodeEncodedLengths(dynamicData.length);
    const entitiesJson = JSON.stringify({ json: fix.onChain });

    // Get current block number for metadata
    const blockNumber = await client.getBlockNumber();

    // Update raw records table
    await sql`
      UPDATE mud.records
      SET dynamic_data = ${dynamicData},
          encoded_lengths = ${encodedLengths},
          block_number = ${blockNumber.toString()}
      WHERE table_id = ${eapTableIdBuf}
        AND key_bytes = ${keyBytes}
    `.then(async (result) => {
      if (result.count === 0) {
        // Row doesn't exist in raw table — insert it
        const worldAddr = Buffer.from(WORLD.slice(2).toLowerCase(), 'hex');
        await sql`
          INSERT INTO mud.records (address, table_id, key_bytes, key0, key1, static_data, encoded_lengths, dynamic_data, is_deleted, block_number, log_index)
          VALUES (${worldAddr}, ${eapTableIdBuf}, ${keyBytes}, ${keyBytes.subarray(0, 32)}, ${keyBytes.subarray(32, 64)}, NULL, ${encodedLengths}, ${dynamicData}, false, ${blockNumber.toString()}, 0)
        `;
      }
    });

    // Update decoded table
    await sql.unsafe(
      `UPDATE "${DECODED_SCHEMA}"."${DECODED_TABLE}" SET entities = $1, "__last_updated_block_number" = $2 WHERE x = $3 AND y = $4`,
      [entitiesJson, blockNumber.toString(), fix.x, fix.y],
    ).then(async (result) => {
      if (result.count === 0) {
        // Row doesn't exist — insert it
        await sql.unsafe(
          `INSERT INTO "${DECODED_SCHEMA}"."${DECODED_TABLE}" (__key_bytes, x, y, entities, "__last_updated_block_number") VALUES ($1, $2, $3, $4, $5)`,
          [keyBytes, fix.x, fix.y, entitiesJson, blockNumber.toString()],
        );
      }
    });
  }

  console.log(`Fixed ${fixes.length} tiles.`);

  // Verify a few
  console.log('\nVerification (sample):');
  const verify = await sql.unsafe(
    `SELECT x, y, entities FROM "${DECODED_SCHEMA}"."${DECODED_TABLE}" WHERE x >= ${GRID_MIN} AND x <= ${GRID_MAX} AND y >= ${GRID_MIN} AND y <= ${GRID_MAX} ORDER BY x, y LIMIT 5`,
  );
  for (const row of verify) {
    const parsed = typeof row.entities === 'string' ? JSON.parse(row.entities) : row.entities;
    const ents = parsed?.json || parsed || [];
    const chainState = onChainData.get(`${row.x},${row.y}`);
    const match = chainState && chainState.entities.length === ents.length ? '✓' : '✗';
    console.log(`  (${row.x},${row.y}): ${ents.length} entities ${match}`);
  }

  await sql.end();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
