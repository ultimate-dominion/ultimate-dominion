import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import { sql, mudSchema } from '../db/connection.js';
import { serializeRow } from '../naming.js';

export function createConfigRouter(syncHandle: SyncHandle): Router {
  const router = Router();

  /**
   * GET /
   * Returns UltimateDominionConfig singleton + GasStationConfig.
   */
  router.get('/', async (_req, res) => {
    try {
      const t = (name: string) => syncHandle.tableNameMap.get(name);

      const configTable = t('UltimateDominionConfig');
      const gasConfigTable = t('GasStationConfig');

      const [configRows, gasConfigRows] = await Promise.all([
        configTable
          ? sql.unsafe(`SELECT * FROM "${mudSchema}"."${configTable}" LIMIT 1`)
          : [],
        gasConfigTable
          ? sql.unsafe(`SELECT * FROM "${mudSchema}"."${gasConfigTable}" LIMIT 1`)
          : [],
      ]);

      res.json({
        config: configRows[0] ? serializeRow(configRows[0] as Record<string, unknown>) : null,
        gasStationConfig: gasConfigRows[0] ? serializeRow(gasConfigRows[0] as Record<string, unknown>) : null,
        block: syncHandle.latestBlockNumber,
      });
    } catch (err) {
      console.error('[api/config] Error:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
