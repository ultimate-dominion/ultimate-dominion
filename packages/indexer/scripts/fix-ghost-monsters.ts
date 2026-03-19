/**
 * Fix ghost monster entities in the indexer.
 *
 * Problem: ~213 monster entities show spawned=true in the indexer but are
 * actually dead on-chain (Spawned=false, Position=(0,0), EncounterEntity.died=true).
 * The client renders them on the map but attacks fail with InvalidCombatEntity.
 *
 * Approach:
 * 1. Get all entities with spawned=true from the indexer
 * 2. Exclude characters (they have entries in the Characters table)
 * 3. Get entities listed in EntitiesAtPosition (these are legit live monsters)
 * 4. The difference = ghost candidates
 * 5. Verify each ghost on-chain (Spawned table)
 * 6. For confirmed ghosts: update Spawned, Position, Stats, EncounterEntity
 *    in both decoded and raw tables
 *
 * Usage:
 *   DATABASE_PUBLIC_URL=postgresql://... npx tsx scripts/fix-ghost-monsters.ts
 *
 * Or with Railway env:
 *   DATABASE_PUBLIC_URL=$(railway variables --service Postgres --json | jq -r .DATABASE_PUBLIC_URL) \
 *   npx tsx scripts/fix-ghost-monsters.ts
 */

import postgres from 'postgres';
import { createPublicClient, http, type Hex, pad, toHex } from 'viem';
import { base } from 'viem/chains';

// --- Config ---
const WORLD = '0x99d01939F58B965E6E84a1D167E710Abdf5764b0' as const;
const RPC_URL = process.env.RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/uXm8ZFNQVb8YQausdDqGA';
const DB_URL = process.env.DATABASE_PUBLIC_URL
  || 'postgresql://postgres:LyiHVtbzDZzJWgcTDdeNpuJnkYbukpXl@mainline.proxy.rlwy.net:24965/railway';
const DECODED_SCHEMA = WORLD.toLowerCase();
const DRY_RUN = process.argv.includes('--dry-run');

// MUD table IDs (bytes32)
const TABLE_IDS = {
  Spawned:         '0x74625544000000000000000000000000537061776e6564000000000000000000' as Hex,
  Position:        '0x74625544000000000000000000000000506f736974696f6e0000000000000000' as Hex,
  Stats:           '0x74625544000000000000000000000000537461747300000000000000000000000' as Hex,
  EncounterEntity: '0x74625544000000000000000000000000456e636f756e746572456e7469747900' as Hex,
};

const getRecordAbi = [{
  name: 'getRecord', type: 'function', stateMutability: 'view',
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

// --- Main ---
async function main() {
  const sql = postgres(DB_URL, { max: 5 });
  const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

  if (DRY_RUN) console.log('=== DRY RUN — no changes will be written ===\n');

  // Step 1: Get all spawned entities from the indexer
  console.log('Loading indexer state...');
  const spawnedRows = await sql.unsafe(
    `SELECT __key_bytes, spawned FROM "${DECODED_SCHEMA}"."ud__spawned" WHERE spawned = true`,
  );
  console.log(`  Spawned=true: ${spawnedRows.length} entities`);

  // Step 2: Get characters (to exclude)
  const charRows = await sql.unsafe(
    `SELECT __key_bytes FROM "${DECODED_SCHEMA}"."ud__characters"`,
  );
  const charKeys = new Set(charRows.map((r: any) => (r.__key_bytes as Buffer).toString('hex')));
  console.log(`  Characters: ${charKeys.size}`);

  // Step 3: Get all entities listed in EntitiesAtPosition
  const eapRows = await sql.unsafe(
    `SELECT entities FROM "${DECODED_SCHEMA}"."ud__entities_at_positi"`,
  );
  const eapEntities = new Set<string>();
  for (const row of eapRows) {
    const entities = typeof row.entities === 'string' ? JSON.parse(row.entities) : row.entities;
    const list = entities?.json || entities || [];
    for (const e of list) {
      // Normalize: remove 0x prefix, lowercase
      eapEntities.add(e.replace(/^0x/, '').toLowerCase());
    }
  }
  console.log(`  Entities in EAP: ${eapEntities.size}`);

  // Step 4: Find ghost candidates (spawned=true, not character, not in EAP)
  const ghosts: Buffer[] = [];
  for (const row of spawnedRows) {
    const keyBuf = row.__key_bytes as Buffer;
    const keyHex = keyBuf.toString('hex').toLowerCase();
    if (charKeys.has(keyHex)) continue;
    if (eapEntities.has(keyHex)) continue;
    ghosts.push(keyBuf);
  }
  console.log(`\nGhost candidates: ${ghosts.length}`);

  if (ghosts.length === 0) {
    console.log('No ghosts found. Nothing to fix.');
    await sql.end();
    return;
  }

  // Step 5: Verify on-chain — check Spawned for each ghost
  console.log('\nVerifying on-chain Spawned state...');
  let confirmedDead = 0;
  let confirmedAlive = 0;
  let checkErrors = 0;
  const deadGhosts: Buffer[] = [];

  for (let i = 0; i < ghosts.length; i++) {
    const keyHex = ('0x' + ghosts[i].toString('hex')) as Hex;

    try {
      const [staticData] = await client.readContract({
        address: WORLD,
        abi: getRecordAbi,
        functionName: 'getRecord',
        args: [TABLE_IDS.Spawned, [keyHex]],
      }) as [Hex, Hex, Hex];

      // Spawned static data is 1 byte: 0x01 = true, 0x00 = false
      const spawned = staticData !== '0x' && staticData !== '0x00';

      if (!spawned) {
        confirmedDead++;
        deadGhosts.push(ghosts[i]);
      } else {
        confirmedAlive++;
        if (confirmedAlive <= 5) {
          console.log(`  ALIVE on-chain (unexpected): ${keyHex.slice(0, 24)}...`);
        }
      }
    } catch (err: any) {
      checkErrors++;
      if (checkErrors <= 3) {
        console.error(`  Error checking ${keyHex.slice(0, 24)}...: ${(err.message || '').slice(0, 80)}`);
      }
    }

    // Rate limit
    if (i % 10 === 9) await new Promise(r => setTimeout(r, 100));

    // Progress
    if ((i + 1) % 50 === 0) {
      console.log(`  Checked ${i + 1}/${ghosts.length} (${confirmedDead} dead, ${confirmedAlive} alive, ${checkErrors} errors)`);
    }
  }

  console.log(`\nVerification complete:`);
  console.log(`  Confirmed dead: ${confirmedDead}`);
  console.log(`  Confirmed alive: ${confirmedAlive}`);
  console.log(`  Errors: ${checkErrors}`);

  if (deadGhosts.length === 0) {
    console.log('\nNo dead ghosts to fix.');
    await sql.end();
    return;
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN: Would fix ${deadGhosts.length} ghost entities.`);
    await sql.end();
    return;
  }

  // Step 6: Fix dead ghosts in the indexer
  console.log(`\nFixing ${deadGhosts.length} dead ghost entities...`);
  const blockNumber = await client.getBlockNumber();
  let fixed = 0;

  for (const keyBuf of deadGhosts) {
    const keyHex = ('0x' + keyBuf.toString('hex')) as Hex;

    try {
      // Read on-chain records for all tables to get true state
      const [spawnedStatic] = await client.readContract({
        address: WORLD, abi: getRecordAbi, functionName: 'getRecord',
        args: [TABLE_IDS.Spawned, [keyHex]],
      }) as [Hex, Hex, Hex];

      const [positionStatic] = await client.readContract({
        address: WORLD, abi: getRecordAbi, functionName: 'getRecord',
        args: [TABLE_IDS.Position, [keyHex]],
      }) as [Hex, Hex, Hex];

      const [encounterStatic, encounterEncodedLengths, encounterDynamic] = await client.readContract({
        address: WORLD, abi: getRecordAbi, functionName: 'getRecord',
        args: [TABLE_IDS.EncounterEntity, [keyHex]],
      }) as [Hex, Hex, Hex];

      // Update decoded tables

      // Spawned: set spawned=false
      await sql.unsafe(
        `UPDATE "${DECODED_SCHEMA}"."ud__spawned"
         SET spawned = false, "__last_updated_block_number" = $1
         WHERE __key_bytes = $2`,
        [blockNumber.toString(), keyBuf],
      );

      // Position: set x=0, y=0 (on-chain value)
      const posX = positionStatic.length >= 6 ? parseInt(positionStatic.slice(2, 6), 16) : 0;
      const posY = positionStatic.length >= 10 ? parseInt(positionStatic.slice(6, 10), 16) : 0;
      await sql.unsafe(
        `UPDATE "${DECODED_SCHEMA}"."ud__position"
         SET x = $1, y = $2, "__last_updated_block_number" = $3
         WHERE __key_bytes = $4`,
        [posX, posY, blockNumber.toString(), keyBuf],
      );

      // EncounterEntity: update died=true, clear encounterId
      // Static: encounterId (32 bytes) + died (1 byte) + pvpTimer (32 bytes) = 65 bytes static
      const died = encounterStatic.length >= 68 && encounterStatic.slice(66, 68) === '01';
      const encounterId = encounterStatic.length >= 66
        ? Buffer.from(encounterStatic.slice(2, 66), 'hex')
        : Buffer.alloc(32, 0);
      // Parse applied_status_effects from dynamic data (JSON array of bytes32)
      const appliedStatusEffects = encounterDynamic === '0x' || encounterDynamic.length <= 2
        ? '{"json":[]}'
        : JSON.stringify({ json: (() => {
            const raw = encounterDynamic.slice(2);
            const arr: string[] = [];
            for (let j = 0; j < raw.length; j += 64) arr.push('0x' + raw.slice(j, j + 64));
            return arr;
          })() });
      await sql.unsafe(
        `UPDATE "${DECODED_SCHEMA}"."ud__encounter_entity"
         SET died = $1, encounter_id = $2, "__last_updated_block_number" = $3
         WHERE __key_bytes = $4`,
        [died, encounterId, blockNumber.toString(), keyBuf],
      ).then(async (result) => {
        if (result.count === 0) {
          // Row doesn't exist — insert it with applied_status_effects
          await sql.unsafe(
            `INSERT INTO "${DECODED_SCHEMA}"."ud__encounter_entity"
             (encounter_entity_id, encounter_id, died, pvp_timer, applied_status_effects, __key_bytes, "__last_updated_block_number")
             VALUES ($1, $2, $3, 0, $4, $5, $6)`,
            [keyBuf, encounterId, died, appliedStatusEffects, keyBuf, blockNumber.toString()],
          );
        }
      });

      // Update raw records for Spawned table
      const spawnedTableIdBuf = Buffer.from(TABLE_IDS.Spawned.slice(2), 'hex');
      const spawnedStaticBuf = spawnedStatic === '0x' ? Buffer.alloc(1, 0) : Buffer.from(spawnedStatic.slice(2), 'hex');
      await sql`
        UPDATE mud.records
        SET static_data = ${spawnedStaticBuf},
            block_number = ${blockNumber.toString()}
        WHERE table_id = ${spawnedTableIdBuf}
          AND key_bytes = ${keyBuf}
      `;

      // Update raw records for Position table
      const positionTableIdBuf = Buffer.from(TABLE_IDS.Position.slice(2), 'hex');
      const positionStaticBuf = positionStatic === '0x' ? Buffer.alloc(4, 0) : Buffer.from(positionStatic.slice(2), 'hex');
      await sql`
        UPDATE mud.records
        SET static_data = ${positionStaticBuf},
            block_number = ${blockNumber.toString()}
        WHERE table_id = ${positionTableIdBuf}
          AND key_bytes = ${keyBuf}
      `;

      // Update raw records for EncounterEntity table
      const encounterTableIdBuf = Buffer.from(TABLE_IDS.EncounterEntity.slice(2), 'hex');
      const encounterStaticBuf = encounterStatic === '0x' ? Buffer.alloc(0) : Buffer.from(encounterStatic.slice(2), 'hex');
      const encounterEncodedLengthsBuf = Buffer.from(encounterEncodedLengths.slice(2), 'hex');
      const encounterDynamicBuf = encounterDynamic === '0x' ? Buffer.alloc(0) : Buffer.from(encounterDynamic.slice(2), 'hex');
      await sql`
        UPDATE mud.records
        SET static_data = ${encounterStaticBuf},
            encoded_lengths = ${encounterEncodedLengthsBuf},
            dynamic_data = ${encounterDynamicBuf},
            block_number = ${blockNumber.toString()}
        WHERE table_id = ${encounterTableIdBuf}
          AND key_bytes = ${keyBuf}
      `;

      fixed++;
      if (fixed % 25 === 0) {
        console.log(`  Fixed ${fixed}/${deadGhosts.length}...`);
      }
    } catch (err: any) {
      console.error(`  Error fixing ${keyHex.slice(0, 24)}...: ${(err.message || '').slice(0, 100)}`);
    }

    // Rate limit RPC calls
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\nFixed ${fixed}/${deadGhosts.length} ghost entities.`);

  // Verify
  const verifyCount = await sql.unsafe(
    `SELECT COUNT(*) as cnt FROM "${DECODED_SCHEMA}"."ud__spawned" WHERE spawned = true`,
  );
  console.log(`\nPost-fix spawned=true count: ${verifyCount[0].cnt}`);

  await sql.end();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
