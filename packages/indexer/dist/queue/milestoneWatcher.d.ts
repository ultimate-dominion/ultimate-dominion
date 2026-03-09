import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster } from '../ws/broadcaster.js';
/** Generate an invite code for a wallet at a given milestone */
export declare function generateInviteCode(wallet: string, milestone: string): Promise<string>;
/**
 * Start watching for level milestones in the Stats table.
 * Called once at startup. Hooks into periodic polling of the Stats table
 * to detect level changes and generate invite codes.
 */
export declare function startMilestoneWatcher(syncHandle: SyncHandle, broadcaster: Broadcaster): void;
