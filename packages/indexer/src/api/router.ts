import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import { createCharacterRouter } from './character.js';
import { createItemsRouter } from './items.js';
import { createMonstersRouter } from './monsters.js';
import { createMapRouter } from './map.js';
import { createBattleRouter } from './battle.js';
import { createOrdersRouter } from './orders.js';
import { createConfigRouter } from './config.js';
import { createSessionRouter } from './session.js';
import { createHealthRouter } from './health.js';
import { createSnapshotRouter } from './snapshot.js';
import { createDeltaRouter } from './delta.js';
import { createQueueRouter } from './queue.js';
import { createInviteRouter } from './invite.js';
import { createStatusRouter } from './status.js';

export function createApiRouter(syncHandle: SyncHandle, broadcaster: Broadcaster): Router {
  const router = Router();

  router.use('/character', createCharacterRouter(syncHandle));
  router.use('/items', createItemsRouter(syncHandle));
  router.use('/monsters', createMonstersRouter(syncHandle));
  router.use('/map', createMapRouter(syncHandle));
  router.use('/battle', createBattleRouter(syncHandle));
  router.use('/orders', createOrdersRouter(syncHandle));
  router.use('/config', createConfigRouter(syncHandle));
  router.use('/session', createSessionRouter(syncHandle));
  router.use('/health', createHealthRouter(syncHandle, broadcaster));
  router.use('/snapshot', createSnapshotRouter(syncHandle));
  router.use('/delta', createDeltaRouter(syncHandle));
  router.use('/queue', createQueueRouter(syncHandle, broadcaster));
  router.use('/invite', createInviteRouter());
  router.use('/status', createStatusRouter());

  return router;
}
