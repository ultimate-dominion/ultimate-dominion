import { sql } from './connection.js';
import crypto from 'crypto';

/**
 * Persistent event store for game events.
 * Lives in the `queue` schema alongside other off-chain tables.
 * The in-memory ring buffer in eventFeed.ts handles fast WS broadcasting;
 * this table is the source of truth for API reads and restart recovery.
 */

/** Initialize the game_events table and indexes */
export async function initEventStore(): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS queue`;

  await sql`
    CREATE TABLE IF NOT EXISTS queue.game_events (
      id UUID PRIMARY KEY,
      event_type TEXT NOT NULL,
      player_name TEXT NOT NULL,
      description TEXT NOT NULL,
      timestamp BIGINT NOT NULL,
      block_number BIGINT,
      dedup_key TEXT NOT NULL UNIQUE,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Conditional index creation — postgres doesn't support IF NOT EXISTS on CREATE INDEX
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_game_events_timestamp ON queue.game_events(timestamp DESC)
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_game_events_type ON queue.game_events(event_type)
  `);

  console.log('[eventStore] game_events table ready');
}

/** Persist a game event. Returns true if inserted, false if dedup_key already existed. */
export async function persistEvent(
  event: { id: string; eventType: string; playerName: string; description: string; timestamp: number },
  blockNumber: number | null,
  dedupKey: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  const rows = await sql`
    INSERT INTO queue.game_events (id, event_type, player_name, description, timestamp, block_number, dedup_key, metadata)
    VALUES (
      ${event.id},
      ${event.eventType},
      ${event.playerName},
      ${event.description},
      ${event.timestamp},
      ${blockNumber},
      ${dedupKey},
      ${metadata ? JSON.stringify(metadata) : null}
    )
    ON CONFLICT (dedup_key) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Load recent events from the DB, newest first.
 * Supports cursor-based pagination via `beforeTimestamp` and catch-up via `sinceTimestamp`.
 */
export async function loadRecentEvents(
  limit: number = 50,
  options?: { beforeTimestamp?: number; sinceTimestamp?: number },
): Promise<Array<{ id: string; eventType: string; playerName: string; description: string; timestamp: number; metadata?: Record<string, unknown> }>> {
  let rows;

  if (options?.beforeTimestamp) {
    rows = await sql`
      SELECT id, event_type, player_name, description, timestamp, metadata
      FROM queue.game_events
      WHERE timestamp < ${options.beforeTimestamp}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;
  } else if (options?.sinceTimestamp) {
    rows = await sql`
      SELECT id, event_type, player_name, description, timestamp, metadata
      FROM queue.game_events
      WHERE timestamp > ${options.sinceTimestamp}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;
  } else {
    rows = await sql`
      SELECT id, event_type, player_name, description, timestamp, metadata
      FROM queue.game_events
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;
  }

  return rows.map(row => ({
    id: String(row.id),
    eventType: String(row.event_type),
    playerName: String(row.player_name),
    description: String(row.description),
    timestamp: Number(row.timestamp),
    metadata: row.metadata as Record<string, unknown> | undefined,
  })).reverse(); // Return in chronological order (oldest first)
}

/** Get total event count (for stats) */
export async function getEventCount(): Promise<number> {
  const rows = await sql`SELECT COUNT(*)::int as count FROM queue.game_events`;
  return rows[0].count as number;
}
