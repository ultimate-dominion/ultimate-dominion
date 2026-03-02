import type { Broadcaster } from '../ws/broadcaster.js';
export type SyncHandle = {
    stopSync: () => void;
    /** Observable of latest indexed block number */
    latestBlockNumber: number;
    /** Map of discovered Postgres table names → column names */
    tables: Map<string, string[]>;
    /** Logical table name → Postgres table name mapping */
    tableNameMap: Map<string, string>;
};
/**
 * Start syncing MUD Store events to Postgres using the decoded mode.
 * Returns the sync handle with observables and table metadata.
 */
export declare function startSync(broadcaster: Broadcaster): Promise<SyncHandle>;
