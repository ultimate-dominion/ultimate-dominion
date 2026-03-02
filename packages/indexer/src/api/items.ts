import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import { sql, mudSchema } from '../db/connection.js';
import { serializeRow as sharedSerializeRow } from '../naming.js';

let cachedItems: unknown = null;
let cacheBlock = 0;

export function createItemsRouter(syncHandle: SyncHandle): Router {
  const router = Router();

  /**
   * GET /
   * Returns all item templates with stats. Cached since seed data rarely changes.
   */
  router.get('/', async (_req, res) => {
    try {
      // Return cache if fresh (within 100 blocks)
      if (cachedItems && syncHandle.latestBlockNumber - cacheBlock < 100) {
        return res.json(cachedItems);
      }

      const t = (name: string) => syncHandle.tableNameMap.get(name);

      const itemsTable = t('Items');
      if (!itemsTable) return res.status(503).json({ error: 'Tables not yet synced' });

      // Fetch all items and their stat tables in parallel
      const [items, weapons, armor, spells, consumables, accessories, restrictions, effects, effectValidity] =
        await Promise.all([
          queryAll(itemsTable),
          queryAll(t('WeaponStats')),
          queryAll(t('ArmorStats')),
          queryAll(t('SpellStats')),
          queryAll(t('ConsumableStats')),
          queryAll(t('AccessoryStats')),
          queryAll(t('StatRestrictions')),
          queryAll(t('StatusEffectStats')),
          queryAll(t('StatusEffectValidity')),
        ]);

      // Index stats by itemId for fast lookup
      const weaponMap = indexByKey(weapons, 'itemId');
      const armorMap = indexByKey(armor, 'itemId');
      const spellMap = indexByKey(spells, 'itemId');
      const consumableMap = indexByKey(consumables, 'itemId');
      const accessoryMap = indexByKey(accessories, 'itemId');
      const restrictionMap = indexByKey(restrictions, 'itemId');
      const effectMap = indexByKey(effects, 'effectId');
      const effectValidityMap = indexByKey(effectValidity, 'effectId');

      // Join items with their stats
      const joined = items.map((item: Record<string, unknown>) => {
        const id = item.itemId as string;
        return {
          ...item,
          weaponStats: weaponMap.get(id) || null,
          armorStats: armorMap.get(id) || null,
          spellStats: spellMap.get(id) || null,
          consumableStats: consumableMap.get(id) || null,
          accessoryStats: accessoryMap.get(id) || null,
          statRestrictions: restrictionMap.get(id) || null,
        };
      });

      const result = {
        items: joined,
        effects: Object.fromEntries(effectMap),
        effectValidity: Object.fromEntries(effectValidityMap),
        block: syncHandle.latestBlockNumber,
      };

      cachedItems = result;
      cacheBlock = syncHandle.latestBlockNumber;

      res.json(result);
    } catch (err) {
      console.error('[api/items] Error:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}

async function queryAll(tableName: string | undefined): Promise<Record<string, unknown>[]> {
  if (!tableName) return [];
  try {
    const rows = await sql.unsafe(`SELECT * FROM "${mudSchema}"."${tableName}"`);
    return rows.map((r) => sharedSerializeRow(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

function indexByKey(rows: Record<string, unknown>[], keyField: string): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = String(row[keyField] || '');
    map.set(key, row);
  }
  return map;
}
