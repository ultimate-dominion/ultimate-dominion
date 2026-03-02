import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config.js';
import { Broadcaster } from './ws/broadcaster.js';
import { createWSServer } from './ws/server.js';
import { startSync } from './sync/startSync.js';
import { createApiRouter } from './api/router.js';
import { closeDb } from './db/connection.js';

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

  // Broadcaster for WebSocket
  const broadcaster = new Broadcaster();

  // Start MUD sync
  const syncHandle = await startSync(broadcaster);
  broadcaster.setTableNameMap(syncHandle.tableNameMap);

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
