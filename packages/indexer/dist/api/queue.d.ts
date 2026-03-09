import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster } from '../ws/broadcaster.js';
export declare function createQueueRouter(syncHandle: SyncHandle, broadcaster: Broadcaster): Router;
/**
 * Get current player count and maxPlayers from MUD tables.
 */
declare function getCurrentPlayerInfo(syncHandle: SyncHandle): Promise<{
    currentPlayers: number;
    maxPlayers: number;
}>;
/** Exported for use by cleanup cron */
export { getCurrentPlayerInfo };
