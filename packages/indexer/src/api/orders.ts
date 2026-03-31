import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import { sql, mudSchema } from '../db/connection.js';
import { serializeRow, serializeValue } from '../naming.js';

export function createOrdersRouter(syncHandle: SyncHandle): Router {
  const router = Router();

  /**
   * GET /
   * Returns all active marketplace orders with offers and considerations.
   */
  router.get('/', async (_req, res) => {
    try {
      const t = (name: string) => syncHandle.tableNameMap.get(name);

      const ordersTable = t('Orders');
      const offersTable = t('Offers');
      const considerationsTable = t('Considerations');

      if (!ordersTable) return res.status(503).json({ error: 'Tables not yet synced' });

      // OrderStatus.Active = 1
      const activeOrders = await sql.unsafe(
        `SELECT * FROM "${mudSchema}"."${ordersTable}" WHERE "order_status" = 1`
      );

      if (activeOrders.length === 0) {
        return res.json({ orders: [], block: syncHandle.latestStoredBlockNumber });
      }

      // Get order hashes for batch lookup — use IN with individual params
      // (sql.unsafe + ANY($1) fails with bytea[] because postgres.js doesn't
      // serialize Buffer arrays into a Postgres array literal)
      const orderHashes = activeOrders.map((o: any) => o.order_hash);
      const placeholders = orderHashes.map((_: unknown, i: number) => `$${i + 1}`).join(', ');

      const [offers, considerations] = await Promise.all([
        offersTable
          ? sql.unsafe(
              `SELECT * FROM "${mudSchema}"."${offersTable}" WHERE "order_hash" IN (${placeholders})`,
              orderHashes
            )
          : [],
        considerationsTable
          ? sql.unsafe(
              `SELECT * FROM "${mudSchema}"."${considerationsTable}" WHERE "order_hash" IN (${placeholders})`,
              orderHashes
            )
          : [],
      ]);

      const offerMap = new Map(
        (offers as any[]).map((o) => [bufferToHex(o.order_hash), serializeRow(o as Record<string, unknown>)])
      );
      const considerationMap = new Map(
        (considerations as any[]).map((c) => [bufferToHex(c.order_hash), serializeRow(c as Record<string, unknown>)])
      );

      const joined = activeOrders.map((order: any) => {
        const hash = bufferToHex(order.order_hash);
        return {
          ...serializeRow(order as Record<string, unknown>),
          offer: offerMap.get(hash) || null,
          consideration: considerationMap.get(hash) || null,
        };
      });

      res.json({
        orders: joined,
        block: syncHandle.latestStoredBlockNumber,
      });
    } catch (err) {
      console.error('[api/orders] Error:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}

function bufferToHex(v: unknown): string {
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) {
    return '0x' + Buffer.from(v).toString('hex');
  }
  return String(v);
}
