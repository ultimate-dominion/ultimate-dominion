import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config.js';
import { Broadcaster } from './ws/broadcaster.js';
import { createWSServer } from './ws/server.js';
import { startSync } from './sync/startSync.js';
import { createApiRouter } from './api/router.js';
import { createDashboardRouter } from './api/dashboard.js';
import { closeDb } from './db/connection.js';
import { initQueueTables, advanceQueue, expireReadyEntries, getQueueStats, getPlayerEmail } from './db/queueSchema.js';
import { sendSlotOpenEmail } from './lib/slotEmail.js';
import { startMilestoneWatcher } from './queue/milestoneWatcher.js';
import { startEventFeed } from './queue/eventFeed.js';
import { startMonitor } from './monitor/monitor.js';

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

  // Start infrastructure monitor
  startMonitor(syncHandle, broadcaster);

  // WebSocket server
  createWSServer(httpServer, broadcaster, () => syncHandle.latestBlockNumber);

  // REST API
  app.use('/api', createApiRouter(syncHandle, broadcaster));

  // Infrastructure dashboard
  app.use('/dashboard', createDashboardRouter());

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
      const cleanupResp = await fetch(cleanupUrl, {
        method: 'POST',
        headers: config.auth.apiKey ? { 'x-api-key': config.auth.apiKey } : {},
      });
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

      // 3. Always check actual player count from MUD tables (don't trust cleanup response)
      const { getCurrentPlayerInfo } = await import('./api/queue.js');
      const playerInfo = await getCurrentPlayerInfo(syncHandle);
      const slotsAvailable = Math.max(0, playerInfo.maxPlayers - playerInfo.currentPlayers);

      // Account for 'ready' players who haven't spawned yet (they hold a slot)
      const stats = await getQueueStats();
      const effectiveSlots = Math.max(0, slotsAvailable - stats.ready);

      if (effectiveSlots > 0) {
        const notified = await advanceQueue(effectiveSlots);
        for (const { wallet, readyUntil } of notified) {
          console.log(`[cron] Slot open for ${wallet}, ready until ${readyUntil.toISOString()}`);
          broadcaster.broadcastSlotOpen(wallet, readyUntil);

          // Send email notification if we have one on file
          getPlayerEmail(wallet).then((email) => {
            if (email) {
              sendSlotOpenEmail(email).catch((err) =>
                console.error(`[cron] Failed to send slot email to ${wallet}:`, err)
              );
            }
          }).catch(() => {});
        }
      }

      // Broadcast updated stats every tick
      const updatedStats = await getQueueStats();
      broadcaster.broadcastQueueStats({
        totalInQueue: updatedStats.totalInQueue,
        slotsAvailable,
        currentPlayers: playerInfo.currentPlayers,
      });
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
