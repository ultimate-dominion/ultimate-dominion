import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import { sql, mudSchema } from '../db/connection.js';
import { extractKeyBytes, serializeRow } from '../naming.js';

/**
 * Delta endpoint: returns all rows updated at or after a given block number.
 *
 * GET /api/delta?block=N
 *
 * Response: { block: number, tables: { TableName: { keyBytes: rowData } } }
 * Same shape as /api/snapshot, but only includes rows changed since block N.
 */
export function createDeltaRouter(syncHandle: SyncHandle): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const blockParam = req.query.block;
    if (!blockParam || typeof blockParam !== 'string') {
      res.status(400).json({ error: 'Missing required query parameter: block' });
      return;
    }

    const sinceBlock = parseInt(blockParam, 10);
    if (isNaN(sinceBlock) || sinceBlock < 0) {
      res.status(400).json({ error: 'Invalid block number' });
      return;
    }

    try {
      const delta: Record<string, Record<string, Record<string, unknown>>> = {};

      for (const [logicalName, pgTableName] of syncHandle.tableNameMap) {
        // Skip reverse mappings (full pg name → full pg name)
        if (logicalName === pgTableName && logicalName.includes('__')) continue;

        try {
          const rows = await sql.unsafe(
            `SELECT * FROM "${mudSchema}"."${pgTableName}" WHERE "__last_updated_block_number" >= $1`,
            [sinceBlock]
          );

          if (rows.length === 0) continue;

          const tableData: Record<string, Record<string, unknown>> = {};
          for (const row of rows) {
            const keyBytes = extractKeyBytes(row as Record<string, unknown>);
            tableData[keyBytes] = serializeRow(row as Record<string, unknown>);
          }

          delta[logicalName] = tableData;
        } catch (err) {
          console.error(`[delta] Error querying table ${pgTableName}:`, (err as Error).message);
        }
      }

      res.json({
        block: syncHandle.latestBlockNumber,
        tables: delta,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
