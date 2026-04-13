import { Router } from 'express';
import { gzipSync } from 'node:zlib';
import type { SyncHandle } from '../sync/startSync.js';
import { sql, mudSchema } from '../db/connection.js';
import { extractKeyBytes, serializeRow } from '../naming.js';

// Tables completely excluded from the snapshot — either unused by the client
// or combat-log tables delivered via WebSocket in real-time.
const SNAPSHOT_EXCLUDE_TABLES = new Set([
  'RngLogs',               // Never used by client
  'RandomNumbers',         // Never used by client
  'ActionOutcome',         // Live turns via WS
  'CombatOutcome',         // Live results via WS
  'DamageOverTimeApplied', // Live DoT via WS
  'CombatFlags',           // Live combat only via WS (58K rows / 22MB)
  'SpellUsesTrackin',      // Not used by client (MUD name truncation)
]);

// Tables processed in the first pass to build the dead entity set.
// Skipped in the main loop — their filtered data is added during first pass.
const FIRST_PASS_TABLES = new Set(['Position', 'PositionV2', 'Spawned']);

const ZERO_BYTES32 = '0x' + '0'.repeat(64);

// Only these tables get dead-entity filtering. Player-persistent tables
// (Characters, equipment, inventory, etc.) must never be filtered — offline
// players have the same position (0,0) and spawned=false as dead mobs.
const DEAD_ENTITY_FILTERED_TABLES = new Set([
  'Stats', 'MobStats', 'WorldStatusEffects',
]);

/**
 * Check if a serialized row should be excluded from the snapshot.
 */
function shouldExcludeRow(
  logicalName: string,
  serialized: Record<string, unknown>,
  deadEntityKeys: Set<string>,
  characterEntityKeys: Set<string>,
  keyBytes: string,
): boolean {
  // Dead entity — only filter mob-specific tables, not player-persistent ones.
  // Character entities are never considered "dead" — offline players share
  // position (0,0) and spawned=false with dead mobs but must keep their Stats.
  if (DEAD_ENTITY_FILTERED_TABLES.has(logicalName) && deadEntityKeys.has(keyBytes) && !characterEntityKeys.has(keyBytes)) return true;

  // Zeroed EncounterEntity — encounter ended, record never deleted
  if (logicalName === 'EncounterEntity') {
    return serialized.encounterId === ZERO_BYTES32;
  }

  // Completed CombatEncounter — all historical, no active encounters needed
  if (logicalName === 'CombatEncounter') {
    return serialized.end !== '0' && serialized.end !== 0;
  }

  return false;
}

// --- In-memory snapshot cache ---
// The snapshot is identical for all clients at a given block. Cache the built
// JSON + pre-compressed gzip buffer so concurrent/repeated requests skip both
// the 265-table query cycle AND on-the-fly compression.
//
// TTL-based (not block-based) because Base produces blocks every ~2s — a pure
// block cache would miss almost every request. 3s TTL means at most ~1 block
// of staleness, which is well within the client's tolerance (WS catches up).
const CACHE_TTL_MS = 3000;

let cachedJson: string | null = null;
let cachedGzip: Buffer | null = null;
let cachedAt = 0;
let cacheBuilding = false;
let cacheBuildPromise: Promise<string> | null = null;

/** Reset cache state — used by tests only. */
export function _resetSnapshotCache() {
  cachedJson = null;
  cachedGzip = null;
  cachedAt = 0;
  cacheBuilding = false;
  cacheBuildPromise = null;
}

function isCacheFresh(): boolean {
  return cachedJson !== null && (Date.now() - cachedAt) < CACHE_TTL_MS;
}

function sendSnapshot(res: import('express').Response, json: string, gzip: Buffer | null, cacheStatus: string, acceptsGzip: boolean) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=2');
  res.setHeader('X-Snapshot-Cache', cacheStatus);
  if (acceptsGzip && gzip) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', gzip.length);
    res.removeHeader('Transfer-Encoding');
    res.end(gzip);
  } else {
    res.send(json);
  }
}

export function createSnapshotRouter(syncHandle: SyncHandle): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const acceptsGzip = (req.headers['accept-encoding'] ?? '').includes('gzip');

      // Serve from cache if TTL hasn't expired
      if (isCacheFresh() && cachedJson) {
        sendSnapshot(res, cachedJson, cachedGzip, 'HIT', acceptsGzip);
        return;
      }

      // If another request is already building the cache, wait for it
      if (cacheBuilding && cacheBuildPromise) {
        await cacheBuildPromise;
        if (cachedJson) {
          sendSnapshot(res, cachedJson, cachedGzip, 'COALESCED', acceptsGzip);
          return;
        }
      }

      // Build fresh snapshot
      cacheBuilding = true;
      cacheBuildPromise = buildSnapshot(syncHandle).then((json) => {
        cachedJson = json;
        cachedGzip = gzipSync(json);
        cachedAt = Date.now();
        cacheBuilding = false;
        cacheBuildPromise = null;
        return json;
      }).catch((err) => {
        cacheBuilding = false;
        cacheBuildPromise = null;
        throw err;
      });

      const json = await cacheBuildPromise;
      sendSnapshot(res, json, cachedGzip, 'MISS', acceptsGzip);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}

async function buildSnapshot(syncHandle: SyncHandle): Promise<string> {
  const start = Date.now();
  const snapshot: Record<string, Record<string, Record<string, unknown>>> = {};

  // Step 1a: Build character entity key set FIRST so Position/Spawned
  // filtering never strips data for player characters.
  // Characters at (0,0) are legitimate (that's the spawn point) — only
  // dead mobs at (0,0) should be filtered.
  const characterEntityKeys = new Set<string>();
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  if (charactersTable) {
    try {
      const charRows = await sql.unsafe(
        `SELECT * FROM "${mudSchema}"."${charactersTable}"`
      );
      for (const row of charRows) {
        characterEntityKeys.add(extractKeyBytes(row as Record<string, unknown>));
      }
    } catch (err) {
      console.error('[snapshot] Error querying Characters for key set:', (err as Error).message);
    }
  }

  // Step 1b: Build dead entity set from Position, PositionV2, and Spawned tables.
  // Dead mobs have position (0,0) AND spawned=false. We collect keys from
  // both tables so we can exclude dead entities from Stats, MobStats, etc.
  const deadEntityKeys = new Set<string>();

  // Position — entities at (0,0) are despawned (unless they're characters)
  const positionTable = syncHandle.tableNameMap.get('Position');
  if (positionTable) {
    try {
      const posRows = await sql.unsafe(
        `SELECT * FROM "${mudSchema}"."${positionTable}"`
      );
      const posData: Record<string, Record<string, unknown>> = {};
      for (const row of posRows) {
        const keyBytes = extractKeyBytes(row as Record<string, unknown>);
        const serialized = serializeRow(row as Record<string, unknown>);
        if (serialized.x === 0 && serialized.y === 0 && !characterEntityKeys.has(keyBytes)) {
          deadEntityKeys.add(keyBytes);
        } else {
          posData[keyBytes] = serialized;
        }
      }
      if (Object.keys(posData).length > 0) {
        snapshot['Position'] = posData;
      }
    } catch (err) {
      console.error('[snapshot] Error querying Position:', (err as Error).message);
    }
  }

  // PositionV2 — entities at zone-relative (0,0) are despawned (unless they're characters)
  const positionV2Table = syncHandle.tableNameMap.get('PositionV2');
  if (positionV2Table) {
    try {
      const posRows = await sql.unsafe(
        `SELECT * FROM "${mudSchema}"."${positionV2Table}"`
      );
      const posData: Record<string, Record<string, unknown>> = {};
      for (const row of posRows) {
        const keyBytes = extractKeyBytes(row as Record<string, unknown>);
        const serialized = serializeRow(row as Record<string, unknown>);
        if (serialized.x === 0 && serialized.y === 0 && !characterEntityKeys.has(keyBytes)) {
          deadEntityKeys.add(keyBytes);
        } else {
          posData[keyBytes] = serialized;
        }
      }
      if (Object.keys(posData).length > 0) {
        snapshot['PositionV2'] = posData;
      }
    } catch (err) {
      console.error('[snapshot] Error querying PositionV2:', (err as Error).message);
    }
  }

  // 1c: Spawned — entities with spawned=false are dead
  const spawnedTable = syncHandle.tableNameMap.get('Spawned');
  if (spawnedTable) {
    try {
      const spawnedRows = await sql.unsafe(
        `SELECT * FROM "${mudSchema}"."${spawnedTable}"`
      );
      const spawnedData: Record<string, Record<string, unknown>> = {};
      for (const row of spawnedRows) {
        const keyBytes = extractKeyBytes(row as Record<string, unknown>);
        const serialized = serializeRow(row as Record<string, unknown>);
        if (serialized.spawned === false) {
          deadEntityKeys.add(keyBytes);
        } else {
          spawnedData[keyBytes] = serialized;
        }
      }
      if (Object.keys(spawnedData).length > 0) {
        snapshot['Spawned'] = spawnedData;
      }
    } catch (err) {
      console.error('[snapshot] Error querying Spawned:', (err as Error).message);
    }
  }

  // Step 2: Iterate remaining tables with filtering
  for (const [logicalName, pgTableName] of syncHandle.tableNameMap) {
    if (logicalName === pgTableName && logicalName.includes('__')) continue;
    if (SNAPSHOT_EXCLUDE_TABLES.has(logicalName)) continue;
    if (FIRST_PASS_TABLES.has(logicalName)) continue;

    try {
      const rows = await sql.unsafe(
        `SELECT * FROM "${mudSchema}"."${pgTableName}"`
      );

      const tableData: Record<string, Record<string, unknown>> = {};
      for (const row of rows) {
        const keyBytes = extractKeyBytes(row as Record<string, unknown>);
        const serialized = serializeRow(row as Record<string, unknown>);

        if (shouldExcludeRow(logicalName, serialized, deadEntityKeys, characterEntityKeys, keyBytes)) continue;

        tableData[keyBytes] = serialized;
      }

      if (Object.keys(tableData).length > 0) {
        snapshot[logicalName] = tableData;
      }
    } catch (err) {
      console.error(`[snapshot] Error querying table ${pgTableName}:`, (err as Error).message);
    }
  }

  const json = JSON.stringify({
    block: syncHandle.latestStoredBlockNumber,
    tables: snapshot,
  });

  const elapsed = Date.now() - start;
  const sizeMB = (json.length / 1024 / 1024).toFixed(1);
  console.log(`[snapshot] Built in ${elapsed}ms (${sizeMB}MB, block ${syncHandle.latestStoredBlockNumber})`);

  return json;
}
