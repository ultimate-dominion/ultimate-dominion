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
