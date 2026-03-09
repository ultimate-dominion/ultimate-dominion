import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import type { GameEvent } from '../ws/protocol.js';
/** Get the current event buffer (for initial load) */
export declare function getRecentEvents(): GameEvent[];
/**
 * Start watching MUD table changes for game events.
 * Polls every 10 seconds for new changes.
 */
export declare function startEventFeed(syncHandle: SyncHandle, broadcaster: Broadcaster): void;
