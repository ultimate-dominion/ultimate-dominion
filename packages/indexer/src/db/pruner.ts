import { sql, mudSchema } from './connection.js';

/**
 * Periodic pruning of stale records from Postgres.
 * The indexer mirrors ALL on-chain MUD state, but most historical combat data
 * and dead entity records are never needed after the encounter ends.
 * Pruning keeps the database lean and the snapshot endpoint fast.
 *
 * Safe to prune: the authoritative data is on-chain. A full re-sync from
 * START_BLOCK would restore everything if ever needed.
 */

// Combat log tables — written per-turn, accumulate indefinitely
const COMBAT_LOG_TABLES = [
  'ud__action_outcome',
  'ud__rng_logs',
  'ud__random_numbers',
  'ud__combat_outcome',
  'ud__damage_over_time_ap', // truncated: damage_over_time_applied
  'ud__combat_flags',
];

const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
// Keep recent combat logs (last 1000 blocks ≈ ~30 minutes on Base)
const KEEP_RECENT_BLOCKS = 1000;

export function startPruner(getLatestBlock: () => number): NodeJS.Timeout {
  console.log('[pruner] Starting periodic pruner (every 1h)');

  const prune = async () => {
    const latestBlock = getLatestBlock();
    if (latestBlock <= 0) return;
    const cutoffBlock = latestBlock - KEEP_RECENT_BLOCKS;

    let totalDeleted = 0;

    // Prune old combat log records
    for (const table of COMBAT_LOG_TABLES) {
      try {
        const result = await sql.unsafe(
          `DELETE FROM "${mudSchema}"."${table}" WHERE "__last_updated_block_number" < $1`,
          [cutoffBlock.toString()]
        );
        const count = result.count ?? 0;
        if (count > 0) {
          totalDeleted += count;
          console.log(`[pruner] Deleted ${count} rows from ${table}`);
        }
      } catch (err) {
        // Table might not exist yet — that's fine
        const msg = (err as Error).message;
        if (!msg.includes('does not exist')) {
          console.error(`[pruner] Error pruning ${table}:`, msg);
        }
      }
    }

    // Prune dead entity records (position 0,0 with old block numbers)
    try {
      const result = await sql.unsafe(
        `DELETE FROM "${mudSchema}"."ud__position" WHERE x = 0 AND y = 0 AND "__last_updated_block_number" < $1`,
        [cutoffBlock.toString()]
      );
      const posCount = result.count ?? 0;
      if (posCount > 0) {
        totalDeleted += posCount;
        console.log(`[pruner] Deleted ${posCount} dead entity positions`);
      }
    } catch (err) {
      console.error('[pruner] Error pruning dead positions:', (err as Error).message);
    }

    // Prune zeroed EncounterEntity records
    try {
      const zeroBytes32 = Buffer.alloc(32);
      const result = await sql.unsafe(
        `DELETE FROM "${mudSchema}"."ud__encounter_entity" WHERE encounter_id = $1 AND "__last_updated_block_number" < $2`,
        [zeroBytes32, cutoffBlock.toString()]
      );
      const eeCount = result.count ?? 0;
      if (eeCount > 0) {
        totalDeleted += eeCount;
        console.log(`[pruner] Deleted ${eeCount} zeroed EncounterEntity records`);
      }
    } catch (err) {
      console.error('[pruner] Error pruning EncounterEntity:', (err as Error).message);
    }

    // Prune completed CombatEncounter records
    try {
      const result = await sql.unsafe(
        `DELETE FROM "${mudSchema}"."ud__combat_encounter" WHERE "end" != 0 AND "__last_updated_block_number" < $1`,
        [cutoffBlock.toString()]
      );
      const ceCount = result.count ?? 0;
      if (ceCount > 0) {
        totalDeleted += ceCount;
        console.log(`[pruner] Deleted ${ceCount} completed CombatEncounter records`);
      }
    } catch (err) {
      console.error('[pruner] Error pruning CombatEncounter:', (err as Error).message);
    }

    if (totalDeleted > 0) {
      console.log(`[pruner] Total pruned: ${totalDeleted} rows`);
    }
  };

  // Run once on startup (after a short delay for sync to catch up)
  setTimeout(prune, 30_000);

  return setInterval(prune, PRUNE_INTERVAL_MS);
}
