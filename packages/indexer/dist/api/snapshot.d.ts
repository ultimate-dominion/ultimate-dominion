import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
export declare function createSnapshotRouter(syncHandle: SyncHandle): Router;
