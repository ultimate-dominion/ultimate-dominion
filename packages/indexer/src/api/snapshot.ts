import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import { sql, mudSchema } from '../db/connection.js';
import { extractKeyBytes, serializeRow } from '../naming.js';

export function createSnapshotRouter(syncHandle: SyncHandle): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const snapshot: Record<string, Record<string, Record<string, unknown>>> = {};

      for (const [logicalName, pgTableName] of syncHandle.tableNameMap) {
        // Skip reverse mappings (full pg name → full pg name)
        if (logicalName === pgTableName && logicalName.includes('__')) continue;

        try {
          const rows = await sql.unsafe(
            `SELECT * FROM "${mudSchema}"."${pgTableName}"`
          );

          const tableData: Record<string, Record<string, unknown>> = {};
          for (const row of rows) {
            const keyBytes = extractKeyBytes(row as Record<string, unknown>);
            tableData[keyBytes] = serializeRow(row as Record<string, unknown>);
          }

          if (Object.keys(tableData).length > 0) {
            snapshot[logicalName] = tableData;
          }
        } catch (err) {
          // Log errors instead of silently swallowing them
          console.error(`[snapshot] Error querying table ${pgTableName}:`, (err as Error).message);
        }
      }

      res.json({
        block: syncHandle.latestStoredBlockNumber,
        tables: snapshot,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
