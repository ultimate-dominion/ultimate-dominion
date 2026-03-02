import { Router } from 'express';
import { sql, mudSchema } from '../db/connection.js';
import { serializeRow } from '../naming.js';
export function createOrdersRouter(syncHandle) {
    const router = Router();
    /**
     * GET /
     * Returns all active marketplace orders with offers and considerations.
     */
    router.get('/', async (_req, res) => {
        try {
            const t = (name) => syncHandle.tableNameMap.get(name);
            const ordersTable = t('Orders');
            const offersTable = t('Offers');
            const considerationsTable = t('Considerations');
            if (!ordersTable)
                return res.status(503).json({ error: 'Tables not yet synced' });
            // OrderStatus.Active = 1
            const activeOrders = await sql.unsafe(`SELECT * FROM "${mudSchema}"."${ordersTable}" WHERE "order_status" = 1`);
            if (activeOrders.length === 0) {
                return res.json({ orders: [], block: syncHandle.latestBlockNumber });
            }
            // Get order hashes for batch lookup
            const orderHashes = activeOrders.map((o) => o.order_hash);
            const [offers, considerations] = await Promise.all([
                offersTable
                    ? sql.unsafe(`SELECT * FROM "${mudSchema}"."${offersTable}" WHERE "order_hash" = ANY($1)`, [orderHashes])
                    : [],
                considerationsTable
                    ? sql.unsafe(`SELECT * FROM "${mudSchema}"."${considerationsTable}" WHERE "order_hash" = ANY($1)`, [orderHashes])
                    : [],
            ]);
            const offerMap = new Map(offers.map((o) => [bufferToHex(o.order_hash), serializeRow(o)]));
            const considerationMap = new Map(considerations.map((c) => [bufferToHex(c.order_hash), serializeRow(c)]));
            const joined = activeOrders.map((order) => {
                const hash = bufferToHex(order.order_hash);
                return {
                    ...serializeRow(order),
                    offer: offerMap.get(hash) || null,
                    consideration: considerationMap.get(hash) || null,
                };
            });
            res.json({
                orders: joined,
                block: syncHandle.latestBlockNumber,
            });
        }
        catch (err) {
            console.error('[api/orders] Error:', err);
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
function bufferToHex(v) {
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) {
        return '0x' + Buffer.from(v).toString('hex');
    }
    return String(v);
}
//# sourceMappingURL=orders.js.map