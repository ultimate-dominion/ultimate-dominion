import { sql } from './connection.js';

/**
 * Initialize queue-related tables in a dedicated 'queue' schema.
 * These are off-chain only — not MUD tables.
 */
export async function initQueueTables() {
  console.log('[queue] Initializing queue tables...');

  await sql`CREATE SCHEMA IF NOT EXISTS queue`;

  // Players waiting for a slot
  await sql`
    CREATE TABLE IF NOT EXISTS queue.queue_entries (
      wallet TEXT PRIMARY KEY,
      priority TEXT NOT NULL DEFAULT 'normal',
      priority_rank INTEGER NOT NULL DEFAULT 2,
      invite_code_used TEXT,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'waiting',
      ready_until TIMESTAMPTZ
    )
  `;

  // Invite codes earned via gameplay milestones
  await sql`
    CREATE TABLE IF NOT EXISTS queue.invite_codes (
      code TEXT PRIMARY KEY,
      creator_wallet TEXT NOT NULL,
      milestone TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      used_by TEXT,
      used_at TIMESTAMPTZ
    )
  `;

  // Tracks invitee progress toward activation (Level 5)
  await sql`
    CREATE TABLE IF NOT EXISTS queue.referral_activations (
      invite_code TEXT NOT NULL REFERENCES queue.invite_codes(code),
      invitee_wallet TEXT NOT NULL,
      activated_at TIMESTAMPTZ,
      referrer_notified BOOLEAN NOT NULL DEFAULT false,
      PRIMARY KEY (invite_code, invitee_wallet)
    )
  `;

  // Indexes for common queries
  await sql`CREATE INDEX IF NOT EXISTS idx_queue_entries_status ON queue.queue_entries(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_queue_entries_ordering ON queue.queue_entries(priority_rank, joined_at) WHERE status = 'waiting'`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invite_codes_creator ON queue.invite_codes(creator_wallet)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invite_codes_unused ON queue.invite_codes(used_by) WHERE used_by IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_referral_activations_invitee ON queue.referral_activations(invitee_wallet)`;

  // Player email mapping for queue notifications
  await sql`
    CREATE TABLE IF NOT EXISTS queue.player_emails (
      wallet TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  console.log('[queue] Queue tables ready');
}

/** Upsert a wallet→email mapping for queue notifications */
export async function setPlayerEmail(wallet: string, email: string): Promise<void> {
  await sql`
    INSERT INTO queue.player_emails (wallet, email, updated_at)
    VALUES (${wallet.toLowerCase()}, ${email}, NOW())
    ON CONFLICT (wallet) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
  `;
}

/** Get the stored email for a wallet, or null */
export async function getPlayerEmail(wallet: string): Promise<string | null> {
  const rows = await sql`
    SELECT email FROM queue.player_emails WHERE wallet = ${wallet.toLowerCase()}
  `;
  return rows.length > 0 ? (rows[0].email as string) : null;
}

/** Get current queue position for a wallet (1-based, computed dynamically) */
export async function getQueuePosition(wallet: string): Promise<{
  position: number;
  totalInQueue: number;
  priority: string;
  status: string;
  readyUntil: Date | null;
} | null> {
  const rows = await sql`
    WITH ranked AS (
      SELECT
        wallet,
        priority,
        status,
        ready_until,
        ROW_NUMBER() OVER (ORDER BY priority_rank ASC, joined_at ASC) as position
      FROM queue.queue_entries
      WHERE status = 'waiting' OR status = 'ready'
    )
    SELECT * FROM ranked WHERE wallet = ${wallet.toLowerCase()}
  `;

  if (rows.length === 0) return null;

  const totalRows = await sql`
    SELECT COUNT(*) as count FROM queue.queue_entries
    WHERE status = 'waiting' OR status = 'ready'
  `;

  return {
    position: Number(rows[0].position),
    totalInQueue: Number(totalRows[0].count),
    priority: rows[0].priority as string,
    status: rows[0].status as string,
    readyUntil: rows[0].ready_until ? new Date(rows[0].ready_until as string) : null,
  };
}

/** Get public queue stats */
export async function getQueueStats() {
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'waiting' OR status = 'ready') as total_in_queue,
      COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
      COUNT(*) FILTER (WHERE status = 'ready') as ready
    FROM queue.queue_entries
  `;
  return {
    totalInQueue: Number(rows[0].total_in_queue),
    waiting: Number(rows[0].waiting),
    ready: Number(rows[0].ready),
  };
}

/** Join the queue. Returns the new entry's position. */
export async function joinQueue(
  wallet: string,
  priority: 'founder' | 'invited' | 'normal',
  inviteCodeUsed?: string,
): Promise<{ position: number; totalInQueue: number; isNew: boolean }> {
  const w = wallet.toLowerCase();
  const priorityRank = priority === 'founder' ? 0 : priority === 'invited' ? 1 : 2;

  // Upsert: if already in queue with expired/spawned status, re-add
  const result = await sql`
    INSERT INTO queue.queue_entries (wallet, priority, priority_rank, invite_code_used, status)
    VALUES (${w}, ${priority}, ${priorityRank}, ${inviteCodeUsed ?? null}, 'waiting')
    ON CONFLICT (wallet) DO UPDATE SET
      status = CASE
        WHEN queue.queue_entries.status IN ('expired', 'spawned') THEN 'waiting'
        ELSE queue.queue_entries.status
      END,
      priority = CASE
        WHEN queue.queue_entries.status IN ('expired', 'spawned') THEN EXCLUDED.priority
        ELSE queue.queue_entries.priority
      END,
      priority_rank = CASE
        WHEN queue.queue_entries.status IN ('expired', 'spawned') THEN EXCLUDED.priority_rank
        ELSE queue.queue_entries.priority_rank
      END,
      joined_at = CASE
        WHEN queue.queue_entries.status IN ('expired', 'spawned') THEN NOW()
        ELSE queue.queue_entries.joined_at
      END
    RETURNING status
  `;

  const pos = await getQueuePosition(w);
  return {
    position: pos?.position ?? 0,
    totalInQueue: pos?.totalInQueue ?? 0,
    isNew: result[0]?.status === 'waiting',
  };
}

/** Leave the queue voluntarily */
export async function leaveQueue(wallet: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM queue.queue_entries
    WHERE wallet = ${wallet.toLowerCase()} AND status IN ('waiting', 'ready')
    RETURNING wallet
  `;
  return result.length > 0;
}

/** Mark a player as having acknowledged their slot */
export async function acknowledgeSlot(wallet: string): Promise<boolean> {
  const result = await sql`
    UPDATE queue.queue_entries
    SET status = 'ready'
    WHERE wallet = ${wallet.toLowerCase()} AND status = 'ready'
    RETURNING wallet
  `;
  return result.length > 0;
}

/** Mark a player as having successfully spawned */
export async function markSpawned(wallet: string): Promise<boolean> {
  const result = await sql`
    UPDATE queue.queue_entries
    SET status = 'spawned'
    WHERE wallet = ${wallet.toLowerCase()} AND status IN ('ready', 'waiting')
    RETURNING wallet
  `;
  return result.length > 0;
}

/**
 * Advance the queue: find next N waiting players and mark them ready.
 * Returns wallets that were notified.
 */
export async function advanceQueue(slotsAvailable: number): Promise<Array<{ wallet: string; readyUntil: Date }>> {
  if (slotsAvailable <= 0) return [];

  const readyUntil = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now

  const rows = await sql`
    UPDATE queue.queue_entries
    SET status = 'ready', ready_until = ${readyUntil.toISOString()}
    WHERE wallet IN (
      SELECT wallet FROM queue.queue_entries
      WHERE status = 'waiting'
      ORDER BY priority_rank ASC, joined_at ASC
      LIMIT ${slotsAvailable}
    )
    RETURNING wallet
  `;

  return rows.map((r) => ({ wallet: r.wallet as string, readyUntil }));
}

/** Expire ready entries whose spawn window has passed. Re-add as waiting at same priority. */
export async function expireReadyEntries(): Promise<string[]> {
  const rows = await sql`
    UPDATE queue.queue_entries
    SET status = 'waiting', ready_until = NULL
    WHERE status = 'ready' AND ready_until < NOW()
    RETURNING wallet
  `;
  return rows.map((r) => r.wallet as string);
}
