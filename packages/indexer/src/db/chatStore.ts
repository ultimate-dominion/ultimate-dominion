import { sql } from './connection.js';
import type { ChatMessage } from '../ws/protocol.js';

/**
 * Persistent chat store for player messages.
 * Lives in the `queue` schema alongside other off-chain tables.
 */

/** Initialize chat tables and indexes */
export async function initChatTables(): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS queue`;

  await sql`
    CREATE TABLE IF NOT EXISTS queue.chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel TEXT NOT NULL,
      sender_address TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_character_id TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_ts
    ON queue.chat_messages(channel, timestamp DESC)
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
    ON queue.chat_messages(sender_address, timestamp DESC)
  `);

  await sql`
    CREATE TABLE IF NOT EXISTS queue.chat_mutes (
      target_address TEXT PRIMARY KEY,
      muted_by TEXT NOT NULL,
      reason TEXT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  console.log('[chatStore] chat tables ready');
}

/** Persist a chat message. Returns the UUID. */
export async function persistChatMessage(msg: {
  channel: string;
  senderAddress: string;
  senderName: string;
  senderCharacterId: string;
  content: string;
  timestamp: number;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO queue.chat_messages (channel, sender_address, sender_name, sender_character_id, content, timestamp)
    VALUES (
      ${msg.channel},
      ${msg.senderAddress},
      ${msg.senderName},
      ${msg.senderCharacterId},
      ${msg.content},
      ${msg.timestamp}
    )
    RETURNING id
  `;
  return String(rows[0].id);
}

/**
 * Load chat history for a channel, oldest-first.
 * Supports cursor pagination via `beforeTimestamp`.
 */
export async function loadChatHistory(
  channel: string,
  limit: number = 50,
  beforeTimestamp?: number,
): Promise<ChatMessage[]> {
  const effectiveLimit = Math.min(limit, 200);

  let rows;
  if (beforeTimestamp) {
    rows = await sql`
      SELECT id, channel, sender_address, sender_name, sender_character_id, content, timestamp
      FROM queue.chat_messages
      WHERE channel = ${channel} AND timestamp < ${beforeTimestamp}
      ORDER BY timestamp DESC, id DESC
      LIMIT ${effectiveLimit}
    `;
  } else {
    rows = await sql`
      SELECT id, channel, sender_address, sender_name, sender_character_id, content, timestamp
      FROM queue.chat_messages
      WHERE channel = ${channel}
      ORDER BY timestamp DESC, id DESC
      LIMIT ${effectiveLimit}
    `;
  }

  // Return oldest-first
  return rows.reverse().map(row => ({
    id: String(row.id),
    channel: String(row.channel) as ChatMessage['channel'],
    senderAddress: String(row.sender_address),
    senderName: String(row.sender_name),
    senderCharacterId: String(row.sender_character_id),
    content: String(row.content),
    timestamp: Number(row.timestamp),
  }));
}

/** Check if an address is currently muted. Auto-expires past-due mutes. */
export async function isMuted(address: string): Promise<boolean> {
  const rows = await sql`
    SELECT expires_at FROM queue.chat_mutes
    WHERE target_address = ${address.toLowerCase()}
  `;
  if (rows.length === 0) return false;

  const expiresAt = rows[0].expires_at;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    // Auto-unmute expired entry
    await sql`DELETE FROM queue.chat_mutes WHERE target_address = ${address.toLowerCase()}`;
    return false;
  }
  return true;
}

/** Mute a player. Replaces existing mute if present. */
export async function mutePlayer(
  target: string,
  mutedBy: string,
  reason?: string,
  durationMinutes?: number,
): Promise<void> {
  const expiresAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60_000)
    : null;

  await sql`
    INSERT INTO queue.chat_mutes (target_address, muted_by, reason, expires_at)
    VALUES (${target.toLowerCase()}, ${mutedBy}, ${reason ?? null}, ${expiresAt})
    ON CONFLICT (target_address) DO UPDATE SET
      muted_by = ${mutedBy},
      reason = ${reason ?? null},
      expires_at = ${expiresAt},
      created_at = NOW()
  `;
}

/** Unmute a player. */
export async function unmutePlayer(target: string): Promise<void> {
  await sql`DELETE FROM queue.chat_mutes WHERE target_address = ${target.toLowerCase()}`;
}

/** List all active mutes. */
export async function listMutes(): Promise<Array<{
  targetAddress: string;
  mutedBy: string;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}>> {
  const rows = await sql`
    SELECT target_address, muted_by, reason, expires_at, created_at
    FROM queue.chat_mutes
    ORDER BY created_at DESC
  `;
  return rows.map(row => ({
    targetAddress: String(row.target_address),
    mutedBy: String(row.muted_by),
    reason: row.reason ? String(row.reason) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

/** Delete messages older than N days. Returns count deleted. */
export async function pruneOldMessages(daysOld: number): Promise<number> {
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
  const rows = await sql`
    DELETE FROM queue.chat_messages
    WHERE timestamp < ${cutoff}
    RETURNING id
  `;
  return rows.length;
}
