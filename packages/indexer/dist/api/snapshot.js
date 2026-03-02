import { Router } from 'express';
import { sql, mudSchema } from '../db/connection.js';
import { extractKeyBytes, serializeRow } from '../naming.js';
export function createSnapshotRouter(syncHandle) {
    const router = Router();
    router.get('/', async (_req, res) => {
        try {
            const snapshot = {};
            for (const [logicalName, pgTableName] of syncHandle.tableNameMap) {
                // Skip reverse mappings (full pg name → full pg name)
                if (logicalName === pgTableName && logicalName.includes('__'))
                    continue;
                try {
                    const rows = await sql.unsafe(`SELECT * FROM "${mudSchema}"."${pgTableName}"`);
                    const tableData = {};
                    for (const row of rows) {
                        const keyBytes = extractKeyBytes(row);
                        tableData[keyBytes] = serializeRow(row);
                    }
                    if (Object.keys(tableData).length > 0) {
                        snapshot[logicalName] = tableData;
                    }
                }
                catch (err) {
                    // Log errors instead of silently swallowing them
                    console.error(`[snapshot] Error querying table ${pgTableName}:`, err.message);
                }
            }
            res.json({
                block: syncHandle.latestBlockNumber,
                tables: snapshot,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
//# sourceMappingURL=snapshot.js.map