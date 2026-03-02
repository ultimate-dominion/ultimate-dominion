import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster } from '../ws/broadcaster.js';
export declare function createHealthRouter(syncHandle: SyncHandle, broadcaster: Broadcaster): Router;
