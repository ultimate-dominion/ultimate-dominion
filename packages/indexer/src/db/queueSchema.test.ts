import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Queue schema tests.
 *
 * Strategy: mock the postgres `sql` tagged template to capture queries and
 * return canned results, then verify function behaviour (return values,
 * which statuses are targeted, parameter handling).
 */

// ── Mock setup ────────────────────────────────────────────────────────────
// The sql export from ./connection.js is a tagged-template function.
// We replace it with a vi.fn() that records calls and returns configurable results.

let sqlResults: Record<string, unknown>[] = [];

const mockSql = vi.fn((..._args: unknown[]) => {
  // Return a promise-like array (postgres library returns Row[])
  return Promise.resolve(sqlResults);
}) as unknown as ReturnType<typeof vi.fn> & {
  unsafe: ReturnType<typeof vi.fn>;
};
mockSql.unsafe = vi.fn((..._args: unknown[]) => Promise.resolve(sqlResults));

vi.mock('./connection.js', () => ({
  sql: mockSql,
  mudSchema: 'test_schema',
}));

// Must import AFTER vi.mock
const {
  getQueuePosition,
  joinQueue,
  markSpawned,
  expireReadyEntries,
  cleanupStaleEntries,
  advanceQueue,
  getQueueStats,
  leaveQueue,
  setPlayerEmail,
  getPlayerEmail,
  shouldNotifyAndMark,
} = await import('./queueSchema.js');

beforeEach(() => {
  vi.clearAllMocks();
  sqlResults = [];
  // Restore default implementation (sqlReturnsSequence replaces it)
  mockSql.mockImplementation((..._args: unknown[]) => Promise.resolve(sqlResults));
});

// ── Helpers ───────────────────────────────────────────────────────────────

/** Set mock to return different results on successive calls */
function sqlReturnsSequence(seq: Record<string, unknown>[][]) {
  let call = 0;
  mockSql.mockImplementation(() => {
    const result = seq[call] ?? [];
    call++;
    return Promise.resolve(result);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('getQueuePosition', () => {
  it('returns null when wallet is not in queue', async () => {
    sqlResults = []; // UPDATE RETURNING returns no rows
    const result = await getQueuePosition('0xabc');
    expect(result).toBeNull();
  });

  it('returns position for a waiting player', async () => {
    sqlReturnsSequence([
      // 1st call: UPDATE...RETURNING (entry found)
      [{ wallet: '0xabc', priority: 'normal', status: 'waiting', ready_until: null }],
      // 2nd call: position count
      [{ position: 3 }],
      // 3rd call: total count
      [{ count: 5 }],
    ]);

    const result = await getQueuePosition('0xABC');
    expect(result).toEqual({
      position: 3,
      totalInQueue: 5,
      priority: 'normal',
      status: 'waiting',
      readyUntil: null,
    });
  });

  it('returns position 0 for a ready player', async () => {
    const readyUntil = new Date('2026-01-01T00:00:00Z').toISOString();
    sqlReturnsSequence([
      [{ wallet: '0xabc', priority: 'founder', status: 'ready', ready_until: readyUntil }],
      [{ position: 1 }],
      [{ count: 3 }],
    ]);

    const result = await getQueuePosition('0xABC');
    expect(result?.position).toBe(0);
    expect(result?.status).toBe('ready');
    expect(result?.readyUntil).toEqual(new Date(readyUntil));
  });

  it('lowercases wallet address', async () => {
    sqlResults = [];
    await getQueuePosition('0xABCDEF1234567890ABCDEF1234567890ABCDEF12');

    // The first sql call should use the lowercased wallet
    const call = mockSql.mock.calls[0];
    // Tagged template: first arg is string array, second is the wallet param
    expect(call[0][0]).toContain('UPDATE');
    // The interpolated value (wallet) should be lowercased
    const walletArg = call[1];
    expect(walletArg).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
  });

  it('touches last_poll_at on every call', async () => {
    sqlResults = [];
    await getQueuePosition('0xabc');

    const queryTemplate = mockSql.mock.calls[0][0].join('');
    expect(queryTemplate).toContain('last_poll_at');
    expect(queryTemplate).toContain('NOW()');
  });
});

describe('markSpawned', () => {
  it('returns true when entry exists with ready status', async () => {
    sqlResults = [{ wallet: '0xabc' }];
    const result = await markSpawned('0xABC');
    expect(result).toBe(true);
  });

  it('returns false when no matching entry', async () => {
    sqlResults = [];
    const result = await markSpawned('0xabc');
    expect(result).toBe(false);
  });

  it('accepts both ready and waiting status', async () => {
    sqlResults = [];
    await markSpawned('0xabc');

    const queryTemplate = mockSql.mock.calls[0][0].join('');
    expect(queryTemplate).toContain("'ready'");
    expect(queryTemplate).toContain("'waiting'");
  });
});

describe('expireReadyEntries', () => {
  it('returns empty arrays when nothing to expire', async () => {
    sqlReturnsSequence([[], []]);
    const result = await expireReadyEntries();
    expect(result).toEqual({ recycled: [], expired: [] });
  });

  it('permanently expires entries that exceeded max attempts', async () => {
    sqlReturnsSequence([
      [{ wallet: '0xghost1' }, { wallet: '0xghost2' }], // permanently expired
      [], // recycled (none left after permanent expiry)
    ]);

    const result = await expireReadyEntries(3);
    expect(result.expired).toEqual(['0xghost1', '0xghost2']);
    expect(result.recycled).toEqual([]);
  });

  it('recycles entries under the attempt limit', async () => {
    sqlReturnsSequence([
      [], // none permanently expired
      [{ wallet: '0xactive' }], // recycled back to waiting
    ]);

    const result = await expireReadyEntries(3);
    expect(result.expired).toEqual([]);
    expect(result.recycled).toEqual(['0xactive']);
  });

  it('uses maxReadyAttempts - 1 as the threshold', async () => {
    sqlReturnsSequence([[], []]);
    await expireReadyEntries(5);

    // First query should check ready_attempts >= 4 (maxReadyAttempts - 1)
    const firstCall = mockSql.mock.calls[0];
    const thresholdArg = firstCall[1]; // second interpolated value
    expect(thresholdArg).toBe(4);
  });

  it('increments ready_attempts on recycle', async () => {
    sqlReturnsSequence([[], []]);
    await expireReadyEntries();

    // Second query (recycle) should increment ready_attempts
    const secondCall = mockSql.mock.calls[1];
    const queryTemplate = secondCall[0].join('');
    expect(queryTemplate).toContain('ready_attempts + 1');
  });
});

describe('cleanupStaleEntries', () => {
  it('returns empty array when no stale entries', async () => {
    sqlResults = [];
    const result = await cleanupStaleEntries(30);
    expect(result).toEqual([]);
  });

  it('returns deleted wallet addresses', async () => {
    sqlResults = [{ wallet: '0xstale1' }, { wallet: '0xstale2' }];
    const result = await cleanupStaleEntries(30);
    expect(result).toEqual(['0xstale1', '0xstale2']);
  });

  it('uses configured stale minutes threshold', async () => {
    sqlResults = [];
    await cleanupStaleEntries(60);

    const call = mockSql.mock.calls[0];
    const minutesArg = call[1];
    expect(minutesArg).toBe(60);
  });

  it('defaults to 30 minutes', async () => {
    sqlResults = [];
    await cleanupStaleEntries();

    const call = mockSql.mock.calls[0];
    const minutesArg = call[1];
    expect(minutesArg).toBe(30);
  });

  it('only targets waiting entries', async () => {
    sqlResults = [];
    await cleanupStaleEntries();

    const queryTemplate = mockSql.mock.calls[0][0].join('');
    expect(queryTemplate).toContain("status = 'waiting'");
    // Should NOT affect ready, spawned, or expired entries
    expect(queryTemplate).not.toContain("'ready'");
    expect(queryTemplate).not.toContain("'spawned'");
  });
});

describe('joinQueue', () => {
  it('computes correct priority ranks', async () => {
    // Each joinQueue call makes 2 sql calls: INSERT + getQueuePosition
    // getQueuePosition itself makes up to 3 calls
    // So we need to mock 4 calls total (INSERT + UPDATE/RETURNING + position + total)

    for (const [priority, expectedRank] of [
      ['founder', 0],
      ['invited', 1],
      ['normal', 2],
    ] as const) {
      vi.clearAllMocks();
      sqlReturnsSequence([
        [{ status: 'waiting' }], // INSERT RETURNING
        [], // getQueuePosition UPDATE (no entry — fine, returns null)
      ]);

      await joinQueue('0xabc', priority);

      // The INSERT call should use the correct priority rank
      const insertCall = mockSql.mock.calls[0];
      // priority_rank is the 3rd interpolated value: wallet, priority, priorityRank, inviteCode, ...
      const rankArg = insertCall[3];
      expect(rankArg).toBe(expectedRank);
    }
  });

  it('lowercases wallet', async () => {
    sqlReturnsSequence([
      [{ status: 'waiting' }],
      [],
    ]);

    await joinQueue('0xABCDEF', 'normal');

    const walletArg = mockSql.mock.calls[0][1];
    expect(walletArg).toBe('0xabcdef');
  });

  it('resets ready_attempts on re-join from expired/spawned', async () => {
    sqlReturnsSequence([
      [{ status: 'waiting' }],
      [],
    ]);

    await joinQueue('0xabc', 'normal');

    // The INSERT query should contain ready_attempts reset logic in both VALUES and ON CONFLICT
    const queryTemplate = mockSql.mock.calls[0][0].join('');
    expect(queryTemplate).toContain('ready_attempts');
    // The ON CONFLICT clause should reset ready_attempts for expired/spawned statuses
    expect(queryTemplate).toContain("WHEN queue.queue_entries.status IN ('expired', 'spawned') THEN 0");
  });

  it('always updates last_poll_at', async () => {
    sqlReturnsSequence([
      [{ status: 'waiting' }],
      [],
    ]);

    await joinQueue('0xabc', 'normal');

    const queryTemplate = mockSql.mock.calls[0][0].join('');
    expect(queryTemplate).toContain('last_poll_at = NOW()');
  });
});

describe('leaveQueue', () => {
  it('returns true when entry was deleted', async () => {
    sqlResults = [{ wallet: '0xabc' }];
    expect(await leaveQueue('0xabc')).toBe(true);
  });

  it('returns false when no entry found', async () => {
    sqlResults = [];
    expect(await leaveQueue('0xabc')).toBe(false);
  });
});

describe('getQueueStats', () => {
  it('returns parsed stats', async () => {
    sqlResults = [{ total_in_queue: '5', waiting: '3', ready: '2' }];
    const stats = await getQueueStats();
    expect(stats).toEqual({ totalInQueue: 5, waiting: 3, ready: 2 });
  });
});

describe('setPlayerEmail / getPlayerEmail', () => {
  it('setPlayerEmail lowercases wallet', async () => {
    sqlResults = [];
    await setPlayerEmail('0xABC', 'test@test.com');
    expect(mockSql.mock.calls[0][1]).toBe('0xabc');
  });

  it('getPlayerEmail returns email when found', async () => {
    sqlResults = [{ email: 'test@test.com' }];
    expect(await getPlayerEmail('0xabc')).toBe('test@test.com');
  });

  it('getPlayerEmail returns null when not found', async () => {
    sqlResults = [];
    expect(await getPlayerEmail('0xabc')).toBeNull();
  });
});

describe('shouldNotifyAndMark', () => {
  it('returns true when notification sent', async () => {
    sqlResults = [{ wallet: '0xabc' }];
    expect(await shouldNotifyAndMark('0xABC')).toBe(true);
  });

  it('returns false when cooldown not elapsed', async () => {
    sqlResults = [];
    expect(await shouldNotifyAndMark('0xabc')).toBe(false);
  });
});

describe('advanceQueue', () => {
  it('returns empty array when no slots available', async () => {
    const result = await advanceQueue(0);
    expect(result).toEqual([]);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('returns empty array for negative slots', async () => {
    const result = await advanceQueue(-1);
    expect(result).toEqual([]);
  });

  it('returns notified wallets with readyUntil timestamp', async () => {
    sqlResults = [{ wallet: '0xabc' }, { wallet: '0xdef' }];
    const before = Date.now();
    const result = await advanceQueue(2);
    const after = Date.now();

    expect(result).toHaveLength(2);
    expect(result[0].wallet).toBe('0xabc');
    expect(result[1].wallet).toBe('0xdef');
    // readyUntil should be ~2 minutes in the future
    const readyMs = result[0].readyUntil.getTime();
    expect(readyMs).toBeGreaterThanOrEqual(before + 2 * 60 * 1000 - 100);
    expect(readyMs).toBeLessThanOrEqual(after + 2 * 60 * 1000 + 100);
  });

  it('orders by priority_rank ASC then joined_at ASC', async () => {
    sqlResults = [];
    await advanceQueue(5);

    const queryTemplate = mockSql.mock.calls[0][0].join('');
    expect(queryTemplate).toContain('ORDER BY priority_rank ASC, joined_at ASC');
  });

  it('only advances waiting entries', async () => {
    sqlResults = [];
    await advanceQueue(1);

    const queryTemplate = mockSql.mock.calls[0][0].join('');
    expect(queryTemplate).toContain("status = 'waiting'");
  });

  it('sets status to ready with ready_until', async () => {
    sqlResults = [];
    await advanceQueue(1);

    const queryTemplate = mockSql.mock.calls[0][0].join('');
    expect(queryTemplate).toContain("SET status = 'ready'");
    expect(queryTemplate).toContain('ready_until');
  });

  it('limits to slotsAvailable', async () => {
    sqlResults = [];
    await advanceQueue(3);

    // The LIMIT value is the slotsAvailable parameter
    const limitArg = mockSql.mock.calls[0][2];
    expect(limitArg).toBe(3);
  });
});
