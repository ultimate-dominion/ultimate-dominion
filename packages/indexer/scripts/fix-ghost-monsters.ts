/**
 * Beta-only ghost monster repair for the indexer database.
 *
 * This mirrors chain-verified monster state into decoded Postgres tables and
 * mud.records. It defaults to dry-run and refuses to run against non-beta worlds.
 *
 * Required env:
 *   DATABASE_URL or DATABASE_PUBLIC_URL
 *   WORLD_ADDRESS
 *   RPC_URL, RPC_HTTP_URL, or MONITOR_BASE_NODE_URL
 *
 * Usage:
 *   pnpm --filter @ud/indexer exec tsx scripts/fix-ghost-monsters.ts
 *   pnpm --filter @ud/indexer exec tsx scripts/fix-ghost-monsters.ts --apply
 */

import postgres, { type Sql } from 'postgres';
import { createPublicClient, http, type Hex } from 'viem';
import { base } from 'viem/chains';

const BETA_WORLD = '0xDc34AC3b06fa0ed899696A72B7706369864E5678';
const WORLD = process.env.WORLD_ADDRESS as Hex | undefined;
const RPC_URL = process.env.RPC_URL || process.env.RPC_HTTP_URL || process.env.MONITOR_BASE_NODE_URL;
const RPC_TOKEN = process.env.MONITOR_BASE_NODE_TOKEN;
const DB_URL = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
const APPLY = process.argv.includes('--apply');

const ZERO_BYTES32 = '0x' + '0'.repeat(64);
const ZERO_LENGTHS = Buffer.alloc(32, 0);
const EMPTY = Buffer.alloc(0);

const TABLE_IDS = {
  Spawned: '0x74625544000000000000000000000000537061776e6564000000000000000000' as Hex,
  Position: '0x74625544000000000000000000000000506f736974696f6e0000000000000000' as Hex,
  PositionV2: '0x74625544000000000000000000000000506f736974696f6e5632000000000000' as Hex,
  EncounterEntity: '0x74625544000000000000000000000000456e636f756e746572456e7469747900' as Hex,
};

const TABLE_NAMES = {
  Spawned: 'ud__spawned',
  Position: 'ud__position',
  PositionV2: 'ud__position_v2',
  EncounterEntity: 'ud__encounter_entity',
  Characters: 'ud__characters',
};

const getRecordAbi = [{
  name: 'getRecord',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'tableId', type: 'bytes32' },
    { name: 'keyTuple', type: 'bytes32[]' },
  ],
  outputs: [
    { name: 'staticData', type: 'bytes' },
    { name: 'encodedLengths', type: 'bytes32' },
    { name: 'dynamicData', type: 'bytes' },
  ],
}] as const;

type StoreRecord = {
  staticData: Hex;
  encodedLengths: Hex;
  dynamicData: Hex;
};

type ChainState = {
  spawned: boolean;
  position: { x: number; y: number };
  positionV2: { zoneId: bigint; x: number; y: number };
  encounter: { encounterId: Hex; died: boolean; pvpTimer: bigint };
  records: {
    spawned: StoreRecord;
    position: StoreRecord;
    positionV2: StoreRecord;
    encounter: StoreRecord;
  };
};

function requireEnv() {
  if (!WORLD) throw new Error('WORLD_ADDRESS is required');
  if (!RPC_URL) throw new Error('RPC_URL, RPC_HTTP_URL, or MONITOR_BASE_NODE_URL is required');
  if (!DB_URL) throw new Error('DATABASE_URL or DATABASE_PUBLIC_URL is required');
  if (WORLD.toLowerCase() !== BETA_WORLD.toLowerCase()) {
    throw new Error(`Refusing to run ghost repair against non-beta world: ${WORLD}`);
  }
}

function hexToBuffer(hex: Hex, fallbackBytes = 0): Buffer {
  if (hex === '0x') return Buffer.alloc(fallbackBytes, 0);
  return Buffer.from(hex.slice(2), 'hex');
}

function tableIdBuffer(tableId: Hex): Buffer {
  return Buffer.from(tableId.slice(2), 'hex');
}

function keyToHex(keyBuf: Buffer): Hex {
  return ('0x' + keyBuf.toString('hex')) as Hex;
}

function isZeroHex(hex: Hex): boolean {
  return hex === '0x' || /^0x0*$/.test(hex);
}

function parseSpawned(staticData: Hex): boolean {
  return !isZeroHex(staticData);
}

function parsePosition(staticData: Hex): { x: number; y: number } {
  const raw = staticData.slice(2).padEnd(8, '0');
  return {
    x: Number.parseInt(raw.slice(0, 4), 16),
    y: Number.parseInt(raw.slice(4, 8), 16),
  };
}

function parsePositionV2(staticData: Hex): { zoneId: bigint; x: number; y: number } {
  const raw = staticData.slice(2).padEnd(72, '0');
  return {
    zoneId: BigInt('0x' + raw.slice(0, 64)),
    x: Number.parseInt(raw.slice(64, 68), 16),
    y: Number.parseInt(raw.slice(68, 72), 16),
  };
}

function parseEncounter(staticData: Hex): { encounterId: Hex; died: boolean; pvpTimer: bigint } {
  const raw = staticData.slice(2).padEnd(130, '0');
  return {
    encounterId: ('0x' + raw.slice(0, 64)) as Hex,
    died: raw.slice(64, 66) === '01',
    pvpTimer: BigInt('0x' + raw.slice(66, 130)),
  };
}

function isClearedPosition(position: { x: number; y: number }): boolean {
  return position.x === 0 && position.y === 0;
}

function isGhost(state: ChainState): boolean {
  return !state.spawned || isClearedPosition(state.positionV2) || state.encounter.died;
}

async function tableExists(sql: Sql, schema: string, table: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = ${schema}
      AND table_name = ${table}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function readRecord(
  client: ReturnType<typeof createPublicClient>,
  tableId: Hex,
  keyHex: Hex,
): Promise<StoreRecord> {
  const [staticData, encodedLengths, dynamicData] = await client.readContract({
    address: WORLD!,
    abi: getRecordAbi,
    functionName: 'getRecord',
    args: [tableId, [keyHex]],
  }) as [Hex, Hex, Hex];

  return { staticData, encodedLengths, dynamicData };
}

async function readChainState(
  client: ReturnType<typeof createPublicClient>,
  keyHex: Hex,
): Promise<ChainState> {
  const [spawnedRecord, positionRecord, positionV2Record, encounterRecord] = await Promise.all([
    readRecord(client, TABLE_IDS.Spawned, keyHex),
    readRecord(client, TABLE_IDS.Position, keyHex),
    readRecord(client, TABLE_IDS.PositionV2, keyHex),
    readRecord(client, TABLE_IDS.EncounterEntity, keyHex),
  ]);

  return {
    spawned: parseSpawned(spawnedRecord.staticData),
    position: parsePosition(positionRecord.staticData),
    positionV2: parsePositionV2(positionV2Record.staticData),
    encounter: parseEncounter(encounterRecord.staticData),
    records: {
      spawned: spawnedRecord,
      position: positionRecord,
      positionV2: positionV2Record,
      encounter: encounterRecord,
    },
  };
}

async function getSpawnedMonsterCandidates(sql: Sql, schema: string): Promise<Buffer[]> {
  const [hasSpawned, hasCharacters] = await Promise.all([
    tableExists(sql, schema, TABLE_NAMES.Spawned),
    tableExists(sql, schema, TABLE_NAMES.Characters),
  ]);

  if (!hasSpawned) throw new Error(`Missing decoded table ${schema}.${TABLE_NAMES.Spawned}`);

  const spawnedRows = await sql.unsafe(
    `SELECT __key_bytes FROM "${schema}"."${TABLE_NAMES.Spawned}" WHERE spawned = true`,
  );

  const characterKeys = new Set<string>();
  if (hasCharacters) {
    const characterRows = await sql.unsafe(
      `SELECT __key_bytes FROM "${schema}"."${TABLE_NAMES.Characters}"`,
    );
    for (const row of characterRows) {
      characterKeys.add((row.__key_bytes as Buffer).toString('hex').toLowerCase());
    }
  }

  const candidates: Buffer[] = [];
  for (const row of spawnedRows) {
    const keyBuf = row.__key_bytes as Buffer;
    if (characterKeys.has(keyBuf.toString('hex').toLowerCase())) continue;
    candidates.push(keyBuf);
  }

  console.log(`  Spawned=true rows: ${spawnedRows.length}`);
  console.log(`  Characters excluded: ${characterKeys.size}`);
  console.log(`  Monster candidates: ${candidates.length}`);

  return candidates;
}

async function applyDecodedUpdates(sql: Sql, schema: string, keyBuf: Buffer, state: ChainState, blockNumber: bigint) {
  const block = blockNumber.toString();

  if (await tableExists(sql, schema, TABLE_NAMES.Spawned)) {
    await sql.unsafe(
      `UPDATE "${schema}"."${TABLE_NAMES.Spawned}"
       SET spawned = $1, "__last_updated_block_number" = $2
       WHERE __key_bytes = $3`,
      [state.spawned, block, keyBuf],
    );
  }

  if (await tableExists(sql, schema, TABLE_NAMES.Position)) {
    await sql.unsafe(
      `UPDATE "${schema}"."${TABLE_NAMES.Position}"
       SET x = $1, y = $2, "__last_updated_block_number" = $3
       WHERE __key_bytes = $4`,
      [state.position.x, state.position.y, block, keyBuf],
    );
  }

  if (await tableExists(sql, schema, TABLE_NAMES.PositionV2)) {
    await sql.unsafe(
      `UPDATE "${schema}"."${TABLE_NAMES.PositionV2}"
       SET zone_id = $1, x = $2, y = $3, "__last_updated_block_number" = $4
       WHERE __key_bytes = $5`,
      [state.positionV2.zoneId.toString(), state.positionV2.x, state.positionV2.y, block, keyBuf],
    );
  }

  if (await tableExists(sql, schema, TABLE_NAMES.EncounterEntity)) {
    await sql.unsafe(
      `UPDATE "${schema}"."${TABLE_NAMES.EncounterEntity}"
       SET encounter_id = $1, died = $2, pvp_timer = $3, "__last_updated_block_number" = $4
       WHERE __key_bytes = $5`,
      [
        hexToBuffer(state.encounter.encounterId as Hex, 32),
        state.encounter.died,
        state.encounter.pvpTimer.toString(),
        block,
        keyBuf,
      ],
    );
  }
}

async function applyRawRecordUpdates(sql: Sql, keyBuf: Buffer, state: ChainState, blockNumber: bigint) {
  const block = blockNumber.toString();

  await sql`
    UPDATE mud.records
    SET static_data = ${hexToBuffer(state.records.spawned.staticData, 1)},
        block_number = ${block}
    WHERE table_id = ${tableIdBuffer(TABLE_IDS.Spawned)}
      AND key_bytes = ${keyBuf}
  `;

  await sql`
    UPDATE mud.records
    SET static_data = ${hexToBuffer(state.records.position.staticData, 4)},
        block_number = ${block}
    WHERE table_id = ${tableIdBuffer(TABLE_IDS.Position)}
      AND key_bytes = ${keyBuf}
  `;

  await sql`
    UPDATE mud.records
    SET static_data = ${hexToBuffer(state.records.positionV2.staticData, 36)},
        block_number = ${block}
    WHERE table_id = ${tableIdBuffer(TABLE_IDS.PositionV2)}
      AND key_bytes = ${keyBuf}
  `;

  await sql`
    UPDATE mud.records
    SET static_data = ${hexToBuffer(state.records.encounter.staticData)},
        encoded_lengths = ${state.records.encounter.encodedLengths === '0x'
          ? ZERO_LENGTHS
          : hexToBuffer(state.records.encounter.encodedLengths, 32)},
        dynamic_data = ${state.records.encounter.dynamicData === '0x'
          ? EMPTY
          : hexToBuffer(state.records.encounter.dynamicData)},
        block_number = ${block}
    WHERE table_id = ${tableIdBuffer(TABLE_IDS.EncounterEntity)}
      AND key_bytes = ${keyBuf}
  `;
}

async function main() {
  requireEnv();

  const schema = WORLD!.toLowerCase();
  const sql = postgres(DB_URL!, { max: 5 });
  const client = createPublicClient({
    chain: base,
    transport: http(RPC_URL!, RPC_TOKEN
      ? { fetchOptions: { headers: { Authorization: `Bearer ${RPC_TOKEN}` } } }
      : undefined),
  });

  console.log(`[ghost-repair] World: ${WORLD}`);
  console.log(`[ghost-repair] Schema: ${schema}`);
  console.log(`[ghost-repair] Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  try {
    const candidates = await getSpawnedMonsterCandidates(sql, schema);
    const ghosts: Array<{ keyBuf: Buffer; state: ChainState }> = [];
    let checked = 0;
    let errors = 0;

    for (const keyBuf of candidates) {
      const keyHex = keyToHex(keyBuf);
      try {
        const state = await readChainState(client, keyHex);
        if (isGhost(state)) ghosts.push({ keyBuf, state });
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`  Error reading ${keyHex}: ${(err as Error).message.slice(0, 140)}`);
        }
      }

      checked++;
      if (checked % 50 === 0) {
        console.log(`  Checked ${checked}/${candidates.length}; ghosts=${ghosts.length}; errors=${errors}`);
      }
    }

    console.log(`\n[ghost-repair] Chain-verified ghost rows: ${ghosts.length}`);
    console.log(`[ghost-repair] RPC errors: ${errors}`);

    for (const { keyBuf, state } of ghosts.slice(0, 20)) {
      console.log(
        `  ${keyToHex(keyBuf)} spawned=${state.spawned} positionV2=(${state.positionV2.zoneId},${state.positionV2.x},${state.positionV2.y}) died=${state.encounter.died}`,
      );
    }
    if (ghosts.length > 20) console.log(`  ... ${ghosts.length - 20} more`);

    if (!APPLY) {
      console.log('\n[ghost-repair] Dry run only. Re-run with --apply to write beta indexer rows.');
      return;
    }

    const blockNumber = await client.getBlockNumber();
    let fixed = 0;

    for (const { keyBuf, state } of ghosts) {
      await applyDecodedUpdates(sql, schema, keyBuf, state, blockNumber);
      await applyRawRecordUpdates(sql, keyBuf, state, blockNumber);
      fixed++;
      if (fixed % 25 === 0) console.log(`  Fixed ${fixed}/${ghosts.length}`);
    }

    console.log(`\n[ghost-repair] Fixed ${fixed}/${ghosts.length} ghost rows at block ${blockNumber}.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
