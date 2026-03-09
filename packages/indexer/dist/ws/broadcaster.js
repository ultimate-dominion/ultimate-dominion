import { hexToResource } from '@latticexyz/common';
import { encodeMessage, decodeClientMessage } from './protocol.js';
import { queryUpdatedRows } from '../db/connection.js';
import { extractKeyBytes, serializeRow, resolveResourceName, snakeToPascal, fixAbbreviations } from '../naming.js';
import { GAME_NAMESPACE } from '../sync/startSync.js';
export class Broadcaster {
    clients = new Set();
    /** Logical table name → Postgres table name */
    tableNameMap = new Map();
    /** tableId (hex) → logical table name */
    tableIdMap = new Map();
    setTableNameMap(map) {
        this.tableNameMap = map;
    }
    addClient(ws, currentBlock) {
        const client = {
            ws,
            subscribedTables: new Set(),
            lastBlock: 0,
        };
        // Send connected message
        this.send(client, { type: 'connected', block: currentBlock });
        ws.on('message', (data) => {
            const msg = decodeClientMessage(data.toString());
            if (!msg)
                return;
            switch (msg.type) {
                case 'subscribe':
                    client.subscribedTables = new Set(msg.tables);
                    break;
                case 'resume':
                    client.lastBlock = msg.lastBlock;
                    this.sendMissedUpdates(client).catch((err) => console.error('[ws] resume error:', err));
                    break;
                case 'ping':
                    this.send(client, { type: 'pong' });
                    break;
            }
        });
        ws.on('close', () => {
            this.clients.delete(client);
        });
        ws.on('error', () => {
            this.clients.delete(client);
        });
        this.clients.add(client);
    }
    get clientCount() {
        return this.clients.size;
    }
    /**
     * Called when a new block has been processed by the sync engine.
     * Queries changed rows and broadcasts to subscribed clients.
     */
    async onBlockProcessed(blockNumber, changedTableIds) {
        if (this.clients.size === 0)
            return;
        // Map tableIds to logical names
        const changedLogicalNames = new Set();
        for (const tableId of changedTableIds) {
            let logicalName = this.tableIdMap.get(tableId);
            if (!logicalName) {
                try {
                    const resource = hexToResource(tableId);
                    if (resource.namespace === GAME_NAMESPACE) {
                        // Game namespace: just the table name with truncation resolution
                        logicalName = resolveResourceName(resource.name);
                    }
                    else {
                        // Other namespaces: include namespace prefix to match snapshot naming
                        // e.g., Items + Owners → ItemsOwners, Gold + Balances → GoldBalances
                        logicalName = fixAbbreviations(snakeToPascal(resource.namespace) + resolveResourceName(resource.name));
                    }
                    this.tableIdMap.set(tableId, logicalName);
                }
                catch {
                    continue;
                }
            }
            changedLogicalNames.add(logicalName);
        }
        // For each changed table, query the updated rows and broadcast
        for (const logicalName of changedLogicalNames) {
            const pgTableName = this.tableNameMap.get(logicalName);
            if (!pgTableName)
                continue;
            try {
                const rows = await queryUpdatedRows(pgTableName, BigInt(blockNumber));
                for (const row of rows) {
                    const keyBytes = extractKeyBytes(row);
                    const value = serializeRow(row);
                    const msg = {
                        type: 'update',
                        table: logicalName,
                        keyBytes,
                        key: {},
                        value,
                        block: blockNumber,
                    };
                    this.broadcastToSubscribed(logicalName, msg);
                }
            }
            catch (err) {
                console.error(`[ws] Error querying ${pgTableName}:`, err);
            }
        }
    }
    broadcastToSubscribed(tableName, msg) {
        for (const client of this.clients) {
            // Empty subscribedTables = subscribed to all
            if (client.subscribedTables.size === 0 || client.subscribedTables.has(tableName)) {
                this.send(client, msg);
            }
        }
    }
    send(client, msg) {
        try {
            if (client.ws.readyState === client.ws.OPEN) {
                client.ws.send(encodeMessage(msg));
            }
        }
        catch {
            this.clients.delete(client);
        }
    }
    /** Broadcast queue stats to all connected clients */
    broadcastQueueStats(stats) {
        const msg = { type: 'queue:stats', stats };
        this.broadcastToAll(msg);
    }
    /** Broadcast slot open notification to all clients (client filters by own wallet) */
    broadcastSlotOpen(wallet, readyUntil) {
        const msg = {
            type: 'queue:slot_open',
            wallet: wallet.toLowerCase(),
            readyUntil: readyUntil.toISOString(),
        };
        this.broadcastToAll(msg);
    }
    /** Broadcast a game event to all connected clients */
    broadcastGameEvent(event) {
        const msg = { type: 'game:event', event };
        this.broadcastToAll(msg);
    }
    broadcastToAll(msg) {
        for (const client of this.clients) {
            this.send(client, msg);
        }
    }
    /**
     * On client resume, send all updates since their lastBlock.
     */
    async sendMissedUpdates(client) {
        if (client.lastBlock <= 0)
            return;
        for (const [logicalName, pgTableName] of this.tableNameMap) {
            // Skip reverse mappings
            if (logicalName === pgTableName && logicalName.includes('__'))
                continue;
            // Skip if client has table filter and this table isn't in it
            if (client.subscribedTables.size > 0 && !client.subscribedTables.has(logicalName)) {
                continue;
            }
            try {
                const rows = await queryUpdatedRows(pgTableName, BigInt(client.lastBlock + 1));
                for (const row of rows) {
                    const keyBytes = extractKeyBytes(row);
                    const value = serializeRow(row);
                    const blockNum = Number(row.__last_updated_block_number) || 0;
                    this.send(client, {
                        type: 'update',
                        table: logicalName,
                        keyBytes,
                        key: {},
                        value,
                        block: blockNum,
                    });
                }
            }
            catch (err) {
                console.error(`[ws] Resume query error for ${pgTableName}:`, err);
            }
        }
    }
}
//# sourceMappingURL=broadcaster.js.map