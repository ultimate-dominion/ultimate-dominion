import { Router } from 'express';
import { createWalletClient, createPublicClient, http, type Hex, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import type { SyncHandle } from '../sync/startSync.js';
import { sql, mudSchema } from '../db/connection.js';
import { config } from '../config.js';

export function createSessionRouter(syncHandle: SyncHandle): Router {
  const router = Router();

  /**
   * POST /cleanup
   * Finds expired characters (session timer > 300s) and removes them from the board.
   */
  router.post('/cleanup', async (req, res) => {
    try {
      // Auth — only internal cron or admin can trigger cleanup
      const apiKey = req.headers['x-api-key'] as string;
      if (!config.auth.apiKey || apiKey !== config.auth.apiKey) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!config.cleanup.privateKey) {
        return res.status(503).json({ error: 'Cleanup not configured (no PRIVATE_KEY)' });
      }

      const t = (name: string) => syncHandle.tableNameMap.get(name);
      const sessionTable = t('SessionTimer');
      const spawnedTable = t('Spawned');

      if (!sessionTable || !spawnedTable) {
        return res.status(503).json({ error: 'Tables not yet synced' });
      }

      const now = Math.floor(Date.now() / 1000);
      const SESSION_TIMEOUT = 300; // 5 minutes

      // Find expired characters that are still spawned
      const expired = await sql.unsafe(`
        SELECT st."character_id"
        FROM "${mudSchema}"."${sessionTable}" st
        JOIN "${mudSchema}"."${spawnedTable}" sp
          ON st."__key_bytes" = sp."__key_bytes"
        WHERE sp."spawned" = true
          AND st."last_action" + ${SESSION_TIMEOUT} < ${now}
      `);

      if (expired.length === 0) {
        return res.json({ expiredCharacterIds: [], removed: 0 });
      }

      const expiredIds: Hex[] = expired.map((row: any) => {
        const v = row.character_id;
        if (Buffer.isBuffer(v) || v instanceof Uint8Array) {
          return ('0x' + Buffer.from(v).toString('hex')) as Hex;
        }
        return v as Hex;
      });

      console.log(`[session] Found ${expiredIds.length} expired characters:`, expiredIds);

      // Submit cleanup transaction
      const account = privateKeyToAccount(config.cleanup.privateKey);
      const publicClient = createPublicClient({ chain: base, transport: http(config.chain.rpcHttpUrl) });
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(config.chain.rpcHttpUrl),
      });

      const worldAbi = [
        {
          type: 'function',
          name: 'UD__removeEntitiesFromBoard',
          inputs: [{ name: 'entityIds', type: 'bytes32[]' }],
          outputs: [],
          stateMutability: 'nonpayable',
        },
      ] as const;

      const txHash = await walletClient.writeContract({
        address: config.world.address,
        abi: worldAbi,
        functionName: 'UD__removeEntitiesFromBoard',
        args: [expiredIds],
      });

      console.log(`[session] Cleanup tx submitted: ${txHash}`);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 20_000,
      });

      console.log(`[session] Cleanup tx confirmed: ${receipt.status}`);

      res.json({
        expiredCharacterIds: expiredIds,
        removed: expiredIds.length,
        txHash,
      });
    } catch (err) {
      console.error('[session] Cleanup error:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
