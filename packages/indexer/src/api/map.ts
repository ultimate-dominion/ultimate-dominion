import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import { sql, mudSchema } from '../db/connection.js';
import { extractKeyBytes, serializeRow, serializeValue } from '../naming.js';

export function createMapRouter(syncHandle: SyncHandle): Router {
  const router = Router();

  /**
   * GET /entities
   * Returns all spawned entities with positions (characters, monsters, shops).
   */
  router.get('/entities', async (_req, res) => {
    try {
      const t = (name: string) => syncHandle.tableNameMap.get(name);

      const posTable = t('Position');
      const spawnedTable = t('Spawned');
      const charsTable = t('Characters');
      const shopsTable = t('Shops');

      if (!posTable || !spawnedTable) {
        return res.status(503).json({ error: 'Tables not yet synced' });
      }

      // Get all spawned entities with positions
      const spawnedPositions = await sql.unsafe(`
        SELECT p.*, s."spawned"
        FROM "${mudSchema}"."${posTable}" p
        JOIN "${mudSchema}"."${spawnedTable}" s
          ON p."__key_bytes" = s."__key_bytes"
        WHERE s."spawned" = true
      `);

      // Get character and shop data for type identification
      const [characters, shops] = await Promise.all([
        charsTable ? sql.unsafe(`SELECT "__key_bytes", "owner", "name" FROM "${mudSchema}"."${charsTable}"`) : [],
        shopsTable ? sql.unsafe(`SELECT "__key_bytes" FROM "${mudSchema}"."${shopsTable}"`) : [],
      ]);

      const charKeySet = new Set((characters as any[]).map((c) => {
        const kb = c.__key_bytes;
        return Buffer.isBuffer(kb) || kb instanceof Uint8Array
          ? '0x' + Buffer.from(kb).toString('hex')
          : String(kb);
      }));
      const shopKeySet = new Set((shops as any[]).map((s) => {
        const kb = s.__key_bytes;
        return Buffer.isBuffer(kb) || kb instanceof Uint8Array
          ? '0x' + Buffer.from(kb).toString('hex')
          : String(kb);
      }));
      const charMap = new Map((characters as any[]).map((c) => {
        const kb = extractKeyBytes(c as Record<string, unknown>);
        return [kb, serializeRow(c as Record<string, unknown>)];
      }));

      const entities = (spawnedPositions as any[]).map((row) => {
        const keyBytes = extractKeyBytes(row as Record<string, unknown>);
        const entity: Record<string, unknown> = {
          keyBytes,
          x: row.x,
          y: row.y,
          type: charKeySet.has(keyBytes) ? 'character' : shopKeySet.has(keyBytes) ? 'shop' : 'monster',
        };
        if (charKeySet.has(keyBytes)) {
          entity.character = charMap.get(keyBytes) || null;
        }
        return entity;
      });

      res.json({
        entities,
        block: syncHandle.latestBlockNumber,
      });
    } catch (err) {
      console.error('[api/map] Error:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * GET /config
   * Returns map dimensions.
   */
  router.get('/config', async (_req, res) => {
    try {
      const mapConfigTable = syncHandle.tableNameMap.get('MapConfig');
      if (!mapConfigTable) return res.status(503).json({ error: 'Tables not yet synced' });

      const rows = await sql.unsafe(`SELECT * FROM "${mudSchema}"."${mapConfigTable}" LIMIT 1`);
      res.json({ mapConfig: rows[0] ? serializeRow(rows[0] as Record<string, unknown>) : null });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
