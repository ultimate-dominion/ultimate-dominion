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
      ready_until TIMESTAMPTZ,
      last_notified_at TIMESTAMPTZ,
      last_poll_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ready_attempts INTEGER NOT NULL DEFAULT 0
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

  // Migrations: add columns if missing (existing deployments)
  await sql`
    ALTER TABLE queue.queue_entries
    ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE queue.queue_entries
    ADD COLUMN IF NOT EXISTS last_poll_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `;
  await sql`
    ALTER TABLE queue.queue_entries
    ADD COLUMN IF NOT EXISTS ready_attempts INTEGER NOT NULL DEFAULT 0
  `;

  // Indexes for common queries
  await sql`CREATE INDEX IF NOT EXISTS idx_queue_entries_status ON queue.queue_entries(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_queue_entries_ordering ON queue.queue_entries(priority_rank, joined_at) WHERE status = 'waiting'`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invite_codes_creator ON queue.invite_codes(creator_wallet)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invite_codes_unused ON queue.invite_codes(used_by) WHERE used_by IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_referral_activations_invitee ON queue.referral_activations(invitee_wallet)`;

  // Prevent duplicate invite codes for same wallet+milestone (race condition guard)
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_codes_wallet_milestone ON queue.invite_codes(creator_wallet, milestone)`;

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

/** Check if enough time has passed since the last email, and mark as notified. */
export async function shouldNotifyAndMark(wallet: string): Promise<boolean> {
  const w = wallet.toLowerCase();
  const rows = await sql`
    UPDATE queue.queue_entries
    SET last_notified_at = NOW()
    WHERE wallet = ${w}
      AND (last_notified_at IS NULL OR last_notified_at < NOW() - INTERVAL '15 minutes')
    RETURNING wallet
  `;
  return rows.length > 0;
}

/** Get current queue position for a wallet (1-based, computed dynamically) */
export async function getQueuePosition(wallet: string): Promise<{
  position: number;
  totalInQueue: number;
  priority: string;
  status: string;
  readyUntil: Date | null;
} | null> {
  // Check if player is in queue and touch last_poll_at to prove client is alive
  const entryRows = await sql`
    UPDATE queue.queue_entries
    SET last_poll_at = NOW()
    WHERE wallet = ${wallet.toLowerCase()} AND status IN ('waiting', 'ready')
    RETURNING wallet, priority, status, ready_until
  `;

  if (entryRows.length === 0) return null;

  const entry = entryRows[0];

  // Position only counts 'waiting' entries ahead of this player
  // 'ready' players are out of the queue (they have a slot)
  const posRows = await sql`
    SELECT COUNT(*) + 1 as position FROM queue.queue_entries
    WHERE status = 'waiting'
      AND (priority_rank < (SELECT priority_rank FROM queue.queue_entries WHERE wallet = ${wallet.toLowerCase()})
        OR (priority_rank = (SELECT priority_rank FROM queue.queue_entries WHERE wallet = ${wallet.toLowerCase()})
            AND joined_at < (SELECT joined_at FROM queue.queue_entries WHERE wallet = ${wallet.toLowerCase()})))
  `;

  const totalRows = await sql`
    SELECT COUNT(*) as count FROM queue.queue_entries
    WHERE status IN ('waiting', 'ready')
  `;

  return {
    position: entry.status === 'ready' ? 0 : Number(posRows[0].position),
    totalInQueue: Number(totalRows[0].count),
    priority: entry.priority as string,
    status: entry.status as string,
    readyUntil: entry.ready_until ? new Date(entry.ready_until as string) : null,
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

  // Upsert: if already in queue with expired/spawned status, re-add with fresh state
  const result = await sql`
    INSERT INTO queue.queue_entries (wallet, priority, priority_rank, invite_code_used, status, last_poll_at, ready_attempts)
    VALUES (${w}, ${priority}, ${priorityRank}, ${inviteCodeUsed ?? null}, 'waiting', NOW(), 0)
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
      END,
      ready_attempts = CASE
        WHEN queue.queue_entries.status IN ('expired', 'spawned') THEN 0
        ELSE queue.queue_entries.ready_attempts
      END,
      last_poll_at = NOW()
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

/** Mark a player as having successfully spawned (valid for 'ready' or 'waiting' entries) */
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

/**
 * Expire ready entries whose spawn window has passed.
 * Entries that have exceeded maxReadyAttempts are permanently expired (ghost prevention).
 * Others are recycled back to waiting with incremented attempt counter.
 */
export async function expireReadyEntries(maxReadyAttempts = 3): Promise<{
  recycled: string[];
  expired: string[];
}> {
  // Permanently expire ghosts that have been cycled too many times
  const permanentlyExpired = await sql`
    UPDATE queue.queue_entries
    SET status = 'expired', ready_until = NULL
    WHERE status = 'ready' AND ready_until < NOW()
      AND ready_attempts >= ${maxReadyAttempts - 1}
    RETURNING wallet
  `;

  // Recycle remaining entries back to waiting
  const recycled = await sql`
    UPDATE queue.queue_entries
    SET status = 'waiting', ready_until = NULL, ready_attempts = ready_attempts + 1
    WHERE status = 'ready' AND ready_until < NOW()
    RETURNING wallet
  `;

  return {
    recycled: recycled.map((r) => r.wallet as string),
    expired: permanentlyExpired.map((r) => r.wallet as string),
  };
}

/**
 * Remove stale waiting entries whose client hasn't polled recently.
 * Indicates the user closed their browser/tab.
 */
export async function cleanupStaleEntries(staleMinutes = 30): Promise<string[]> {
  const rows = await sql`
    DELETE FROM queue.queue_entries
    WHERE status = 'waiting'
      AND last_poll_at < NOW() - INTERVAL '1 minute' * ${staleMinutes}
    RETURNING wallet
  `;
  return rows.map((r) => r.wallet as string);
}
