import { Router } from 'express';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import { config } from '../config.js';

export function createHealthRouter(syncHandle: SyncHandle, broadcaster: Broadcaster): Router {
  const router = Router();

  const publicClient = createPublicClient({
    chain: base,
    transport: http(config.chain.rpcHttpUrl),
  });

  router.get('/', async (_req, res) => {
    try {
      const chainHead = Number(await publicClient.getBlockNumber());
      const indexedBlock = syncHandle.latestBlockNumber;
      const lag = chainHead - indexedBlock;

      res.json({
        status: lag < 50 ? 'healthy' : 'lagging',
        indexedBlock,
        chainHead,
        lag,
        wsClients: broadcaster.clientCount,
        tables: syncHandle.tables.size,
        worldAddress: config.world.address,
      });
    } catch (err) {
      res.status(500).json({
        status: 'error',
        error: (err as Error).message,
      });
    }
  });

  /**
   * GET /ready — readiness probe for Railway health checks.
   * Returns 200 once tables are discovered (server is functional).
   * Lag info is in the response body for monitoring — a lagging indexer
   * that serves traffic is better than no indexer at all.
   */
  router.get('/ready', async (_req, res) => {
    try {
      const chainHead = Number(await publicClient.getBlockNumber());
      const storedBlock = syncHandle.latestStoredBlockNumber;
      const lag = chainHead - storedBlock;
      const tablesReady = syncHandle.tables.size > 0;

      res.status(tablesReady ? 200 : 503).json({
        ready: tablesReady,
        synced: lag < 50,
        storedBlock,
        chainHead,
        lag,
        tables: syncHandle.tables.size,
      });
    } catch (err) {
      res.status(503).json({
        ready: false,
        error: (err as Error).message,
      });
    }
  });

  /**
   * GET /tables — debug endpoint listing all discovered tables
   * and their logical name mappings.
   */
  router.get('/tables', async (_req, res) => {
    const pgTables: Record<string, string[]> = {};
    for (const [name, cols] of syncHandle.tables) {
      pgTables[name] = cols;
    }

    const nameMap: Record<string, string> = {};
    for (const [logical, pg] of syncHandle.tableNameMap) {
      if (logical !== pg || !logical.includes('__')) {
        nameMap[logical] = pg;
      }
    }

    res.json({ pgTables, nameMap });
  });

  return router;
}
