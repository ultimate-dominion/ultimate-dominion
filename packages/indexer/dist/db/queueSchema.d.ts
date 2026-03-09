/**
 * Initialize queue-related tables in a dedicated 'queue' schema.
 * These are off-chain only — not MUD tables.
 */
export declare function initQueueTables(): Promise<void>;
/** Upsert a wallet→email mapping for queue notifications */
export declare function setPlayerEmail(wallet: string, email: string): Promise<void>;
/** Get the stored email for a wallet, or null */
export declare function getPlayerEmail(wallet: string): Promise<string | null>;
export declare function shouldNotifyAndMark(wallet: string): Promise<boolean>;
/** Get current queue position for a wallet (1-based, computed dynamically) */
export declare function getQueuePosition(wallet: string): Promise<{
    position: number;
    totalInQueue: number;
    priority: string;
    status: string;
    readyUntil: Date | null;
} | null>;
/** Get public queue stats */
export declare function getQueueStats(): Promise<{
    totalInQueue: number;
    waiting: number;
    ready: number;
}>;
/** Join the queue. Returns the new entry's position. */
export declare function joinQueue(wallet: string, priority: 'founder' | 'invited' | 'normal', inviteCodeUsed?: string): Promise<{
    position: number;
    totalInQueue: number;
    isNew: boolean;
}>;
/** Leave the queue voluntarily */
export declare function leaveQueue(wallet: string): Promise<boolean>;
/** Mark a player as having acknowledged their slot */
export declare function acknowledgeSlot(wallet: string): Promise<boolean>;
/** Mark a player as having successfully spawned (only valid for 'ready' players) */
export declare function markSpawned(wallet: string): Promise<boolean>;
/**
 * Advance the queue: find next N waiting players and mark them ready.
 * Returns wallets that were notified.
 */
export declare function advanceQueue(slotsAvailable: number): Promise<Array<{
    wallet: string;
    readyUntil: Date;
}>>;
/** Expire ready entries whose spawn window has passed. Re-add as waiting at same priority. */
export declare function expireReadyEntries(): Promise<string[]>;
