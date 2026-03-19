import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import { sql, mudSchema } from '../db/connection.js';
import { serializeRow } from '../naming.js';

let cachedMonsters: unknown = null;
let cacheBlock = 0;

export function createMonstersRouter(syncHandle: SyncHandle): Router {
  const router = Router();

  /**
   * GET /
   * Returns all monster templates with stats. Cached since seed data rarely changes.
   */
  router.get('/', async (_req, res) => {
    try {
      if (cachedMonsters && syncHandle.latestStoredBlockNumber - cacheBlock < 100) {
        return res.json(cachedMonsters);
      }

      const t = (name: string) => syncHandle.tableNameMap.get(name);

      const mobsTable = t('Mobs');
      if (!mobsTable) return res.status(503).json({ error: 'Tables not yet synced' });

      const [mobs, mobStats, mobsByLevel] = await Promise.all([
        queryAll(mobsTable),
        queryAll(t('MobStats')),
        queryAll(t('MobsByLevel')),
      ]);

      const mobStatsMap = new Map<string, Record<string, unknown>>();
      for (const stat of mobStats) {
        mobStatsMap.set(String(stat.mobId), stat);
      }

      const joined = mobs.map((mob: Record<string, unknown>) => ({
        ...mob,
        mobStatsData: mobStatsMap.get(String(mob.mobId)) || null,
      }));

      const result = {
        monsters: joined,
        mobsByLevel,
        block: syncHandle.latestStoredBlockNumber,
      };

      cachedMonsters = result;
      cacheBlock = syncHandle.latestStoredBlockNumber;

      res.json(result);
    } catch (err) {
      console.error('[api/monsters] Error:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}

async function queryAll(tableName: string | undefined): Promise<Record<string, unknown>[]> {
  if (!tableName) return [];
  try {
    const rows = await sql.unsafe(`SELECT * FROM "${mudSchema}"."${tableName}"`);
    return rows.map((r) => serializeRow(r as Record<string, unknown>));
  } catch {
    return [];
  }
}
