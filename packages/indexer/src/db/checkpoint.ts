import { sql } from './connection.js';

/**
 * Sync checkpoint — stores the latest block number committed to Postgres.
 * On restart, we resume from (checkpoint - SAFETY_BUFFER) instead of
 * replaying from START_BLOCK (~450k+ blocks).
 */

/** Create the checkpoint table in the queue schema (singleton row) */
export async function initCheckpointTable(): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS queue`;
  await sql`
    CREATE TABLE IF NOT EXISTS queue.sync_checkpoint (
      id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
      block_number BIGINT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('[checkpoint] Checkpoint table ready');
}

/** Read the stored checkpoint block number, or null if none exists */
export async function getCheckpoint(): Promise<bigint | null> {
  const rows = await sql`
    SELECT block_number FROM queue.sync_checkpoint WHERE id = true
  `;
  if (rows.length === 0) return null;
  return BigInt(rows[0].block_number as string);
}

/** Upsert the checkpoint block number */
export async function saveCheckpoint(blockNumber: bigint): Promise<void> {
  await sql`
    INSERT INTO queue.sync_checkpoint (id, block_number, updated_at)
    VALUES (true, ${blockNumber.toString()}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      block_number = EXCLUDED.block_number,
      updated_at = NOW()
  `;
}

/**
 * Bootstrap: if no checkpoint exists but MUD tables do, seed from the
 * max __last_updated_block_number on ud__characters. This avoids full
 * replay even on the first deploy with this feature.
 */
export async function bootstrapCheckpoint(mudSchema: string): Promise<bigint | null> {
  const existing = await getCheckpoint();
  if (existing !== null) return existing;

  // Check if the MUD table exists
  const tableCheck = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = ${mudSchema} AND table_name = 'ud__characters'
    LIMIT 1
  `;
  if (tableCheck.length === 0) return null;

  // Seed from max block number
  const rows = await sql.unsafe(
    `SELECT MAX("__last_updated_block_number") as max_block FROM "${mudSchema}"."ud__characters"`,
  );
  if (rows.length === 0 || rows[0].max_block == null) return null;

  const maxBlock = BigInt(rows[0].max_block as string);
  await saveCheckpoint(maxBlock);
  console.log(`[checkpoint] Bootstrapped from ud__characters max block: ${maxBlock}`);
  return maxBlock;
}
