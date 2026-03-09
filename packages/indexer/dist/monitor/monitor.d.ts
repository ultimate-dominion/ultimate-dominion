import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster } from '../ws/broadcaster.js';
export declare function startMonitor(syncHandle: SyncHandle, broadcaster: Broadcaster): void;
export declare function stopMonitor(): void;
export declare function getMonitorStatus(): Record<string, unknown>;
