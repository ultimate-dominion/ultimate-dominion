import { Router } from 'express';
import { sql, mudSchema } from '../db/connection.js';
import { serializeRow } from '../naming.js';
let cachedMonsters = null;
let cacheBlock = 0;
export function createMonstersRouter(syncHandle) {
    const router = Router();
    /**
     * GET /
     * Returns all monster templates with stats. Cached since seed data rarely changes.
     */
    router.get('/', async (_req, res) => {
        try {
            if (cachedMonsters && syncHandle.latestBlockNumber - cacheBlock < 100) {
                return res.json(cachedMonsters);
            }
            const t = (name) => syncHandle.tableNameMap.get(name);
            const mobsTable = t('Mobs');
            if (!mobsTable)
                return res.status(503).json({ error: 'Tables not yet synced' });
            const [mobs, mobStats, mobsByLevel] = await Promise.all([
                queryAll(mobsTable),
                queryAll(t('MobStats')),
                queryAll(t('MobsByLevel')),
            ]);
            const mobStatsMap = new Map();
            for (const stat of mobStats) {
                mobStatsMap.set(String(stat.mobId), stat);
            }
            const joined = mobs.map((mob) => ({
                ...mob,
                mobStatsData: mobStatsMap.get(String(mob.mobId)) || null,
            }));
            const result = {
                monsters: joined,
                mobsByLevel,
                block: syncHandle.latestBlockNumber,
            };
            cachedMonsters = result;
            cacheBlock = syncHandle.latestBlockNumber;
            res.json(result);
        }
        catch (err) {
            console.error('[api/monsters] Error:', err);
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
async function queryAll(tableName) {
    if (!tableName)
        return [];
    try {
        const rows = await sql.unsafe(`SELECT * FROM "${mudSchema}"."${tableName}"`);
        return rows.map((r) => serializeRow(r));
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=monsters.js.map