import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config.js';
import { Broadcaster } from './ws/broadcaster.js';
import { createWSServer } from './ws/server.js';
import { startSync } from './sync/startSync.js';
import { createApiRouter } from './api/router.js';
import { closeDb } from './db/connection.js';
import { initQueueTables, advanceQueue, expireReadyEntries, getQueueStats } from './db/queueSchema.js';
import { startMilestoneWatcher } from './queue/milestoneWatcher.js';
import { startEventFeed } from './queue/eventFeed.js';

async function main() {
  console.log('=== Ultimate Dominion Indexer ===');
  console.log(`World:  ${config.world.address}`);
  console.log(`Chain:  ${config.chain.chainId}`);
  console.log(`Port:   ${config.server.port}`);

  // Express app
  const app = express();
  app.use(cors({ origin: config.server.corsOrigins }));
  app.use(express.json());

  const httpServer = createServer(app);

  // Initialize queue tables
  await initQueueTables();

  // Broadcaster for WebSocket
  const broadcaster = new Broadcaster();

  // Start MUD sync
  const syncHandle = await startSync(broadcaster);
  broadcaster.setTableNameMap(syncHandle.tableNameMap);

  // Start milestone watcher and event feed
  startMilestoneWatcher(syncHandle, broadcaster);
  startEventFeed(syncHandle, broadcaster);

  // WebSocket server
  createWSServer(httpServer, broadcaster, () => syncHandle.latestBlockNumber);

  // REST API
  app.use('/api', createApiRouter(syncHandle, broadcaster));

  // Root health check
  app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'ud-indexer' });
  });

  // Start server
  httpServer.listen(config.server.port, () => {
    console.log(`[server] Listening on port ${config.server.port}`);
    console.log(`[server] REST: http://localhost:${config.server.port}/api`);
    console.log(`[server] WS:   ws://localhost:${config.server.port}/ws`);
  });

  // Queue cleanup cron: every 30 seconds
  const CLEANUP_INTERVAL = 30_000;
  setInterval(async () => {
    try {
      // 1. Call session cleanup to remove expired players
      const cleanupUrl = `http://localhost:${config.server.port}/api/session/cleanup`;
      const cleanupResp = await fetch(cleanupUrl, { method: 'POST' });
      const cleanupData = (await cleanupResp.json()) as { removed?: number };
      const slotsFreed = cleanupData.removed ?? 0;

      if (slotsFreed > 0) {
        console.log(`[cron] Cleanup freed ${slotsFreed} slots`);
      }

      // 2. Expire ready entries whose spawn window passed
      const expired = await expireReadyEntries();
      if (expired.length > 0) {
        console.log(`[cron] Expired ${expired.length} ready entries back to waiting`);
      }

      // 3. If slots available, advance the queue
      if (slotsFreed > 0 || expired.length > 0) {
        // Get current player count from MUD tables
        const { getCurrentPlayerInfo } = await import('./api/queue.js');
        const playerInfo = await getCurrentPlayerInfo(syncHandle);
        const slotsAvailable = Math.max(0, playerInfo.maxPlayers - playerInfo.currentPlayers);

        if (slotsAvailable > 0) {
          const notified = await advanceQueue(slotsAvailable);
          for (const { wallet, readyUntil } of notified) {
            console.log(`[cron] Slot open for ${wallet}, ready until ${readyUntil.toISOString()}`);
            broadcaster.broadcastSlotOpen(wallet, readyUntil);
          }
        }

        // Broadcast updated stats
        const stats = await getQueueStats();
        broadcaster.broadcastQueueStats({
          totalInQueue: stats.totalInQueue,
          slotsAvailable,
          currentPlayers: playerInfo.currentPlayers,
        });
      }
    } catch (err) {
      console.error('[cron] Queue cleanup error:', err);
    }
  }, CLEANUP_INTERVAL);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[server] Shutting down...');
    syncHandle.stopSync();
    httpServer.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
