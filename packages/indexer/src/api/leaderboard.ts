import { Router } from 'express';
import type { SyncHandle } from '../sync/startSync.js';
import { sql, mudSchema } from '../db/connection.js';
import { serializeValue } from '../naming.js';

export function createLeaderboardRouter(syncHandle: SyncHandle): Router {
  const router = Router();

  /**
   * GET /nearby?characterId=<hex>&rankBy=stats|gold
   * Returns the 5 players surrounding the given character in the ranking.
   */
  router.get('/nearby', async (req, res) => {
    try {
      const { characterId, rankBy = 'stats' } = req.query;

      if (!characterId || typeof characterId !== 'string') {
        return res.status(400).json({ error: 'characterId is required' });
      }

      if (rankBy !== 'stats' && rankBy !== 'gold') {
        return res.status(400).json({ error: 'rankBy must be "stats" or "gold"' });
      }

      const t = (name: string) => resolveTable(syncHandle, name);

      const charsTable = t('Characters');
      const statsTable = t('Stats');
      const goldTable = t('GoldBalances');
      const escrowTable = t('AdventureEscrow');

      if (!charsTable || !statsTable) {
        return res.status(503).json({ error: 'Tables not yet synced' });
      }

      const charIdBuf = hexToBuffer(characterId);

      const rankColumn = rankBy === 'stats' ? 'stats_rank' : 'gold_rank';

      // Build the query with proper table references
      // GoldBalances and AdventureEscrow may not exist yet — handle with LEFT JOINs
      const goldJoin = goldTable
        ? `LEFT JOIN "${mudSchema}"."${goldTable}" g ON c."owner" = g."__key_bytes"`
        : '';
      const escrowJoin = escrowTable
        ? `LEFT JOIN "${mudSchema}"."${escrowTable}" e ON c."character_id" = e."character_id"`
        : '';

      const goldExpr = goldTable ? 'COALESCE(g."value", 0)' : '0';
      const escrowExpr = escrowTable ? 'COALESCE(e."balance", 0)' : '0';

      const query = `
        WITH ranked AS (
          SELECT
            c."character_id",
            c."name",
            c."owner",
            s."level",
            s."agility", s."strength", s."intelligence",
            (s."agility" + s."strength" + s."intelligence") AS total_stats,
            ${goldExpr} AS external_gold,
            ${escrowExpr} AS escrow_gold,
            (${goldExpr} + ${escrowExpr}) AS total_gold,
            DENSE_RANK() OVER (ORDER BY (s."agility" + s."strength" + s."intelligence") DESC) AS stats_rank,
            DENSE_RANK() OVER (ORDER BY (${goldExpr} + ${escrowExpr}) DESC) AS gold_rank
          FROM "${mudSchema}"."${charsTable}" c
          JOIN "${mudSchema}"."${statsTable}" s ON c."character_id" = s."entity_id"
          ${goldJoin}
          ${escrowJoin}
          WHERE c."locked" = true
        ),
        target AS (
          SELECT stats_rank, gold_rank FROM ranked WHERE character_id = $1
        )
        SELECT r.*, (SELECT count(*) FROM ranked) AS total_players
        FROM ranked r, target t
        WHERE r.${rankColumn} BETWEEN t.${rankColumn} - 2 AND t.${rankColumn} + 2
        ORDER BY r.${rankColumn} ASC
      `;

      const rows = await sql.unsafe(query, [charIdBuf]);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Character not found or not locked' });
      }

      // Find self row to extract self ranks
      const selfRow = rows.find(
        (r: any) => Buffer.isBuffer(r.character_id) &&
          Buffer.from(r.character_id).equals(charIdBuf),
      );

      const nearby = rows.map((r: any) => {
        const isSelf = Buffer.isBuffer(r.character_id) &&
          Buffer.from(r.character_id).equals(charIdBuf);

        return {
          characterId: serializeValue(r.character_id),
          name: r.name,
          level: Number(r.level),
          totalStats: Number(r.total_stats),
          totalGold: String(r.total_gold),
          statsRank: Number(r.stats_rank),
          goldRank: Number(r.gold_rank),
          isSelf,
        };
      });

      res.json({
        nearby,
        totalPlayers: Number(rows[0].total_players),
        selfStatsRank: selfRow ? Number(selfRow.stats_rank) : null,
        selfGoldRank: selfRow ? Number(selfRow.gold_rank) : null,
      });
    } catch (err) {
      console.error('[api/leaderboard] Error:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}

function resolveTable(syncHandle: SyncHandle, logicalName: string): string | null {
  return syncHandle.tableNameMap.get(logicalName) || null;
}

function hexToBuffer(hex: string): Buffer {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(clean, 'hex');
}
