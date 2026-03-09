import { type WebSocket } from 'ws';
import { type Hex } from 'viem';
import { type QueueStats, type GameEvent } from './protocol.js';
export declare class Broadcaster {
    private clients;
    /** Logical table name → Postgres table name */
    private tableNameMap;
    /** tableId (hex) → logical table name */
    private tableIdMap;
    setTableNameMap(map: Map<string, string>): void;
    addClient(ws: WebSocket, currentBlock: number): void;
    get clientCount(): number;
    /**
     * Called when a new block has been processed by the sync engine.
     * Queries changed rows and broadcasts to subscribed clients.
     */
    onBlockProcessed(blockNumber: number, changedTableIds: Set<Hex>): Promise<void>;
    private broadcastToSubscribed;
    private send;
    /** Broadcast queue stats to all connected clients */
    broadcastQueueStats(stats: QueueStats): void;
    /** Broadcast slot open notification to all clients (client filters by own wallet) */
    broadcastSlotOpen(wallet: string, readyUntil: Date): void;
    /** Broadcast a game event to all connected clients */
    broadcastGameEvent(event: GameEvent): void;
    private broadcastToAll;
    /**
     * On client resume, send all updates since their lastBlock.
     */
    private sendMissedUpdates;
}
