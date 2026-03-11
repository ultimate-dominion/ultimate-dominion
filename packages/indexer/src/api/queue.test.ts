import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for invite code validation/redemption and queue priority logic.
 */

// ── Mock setup ────────────────────────────────────────────────────────────
let sqlResults: Record<string, unknown>[] = [];

const mockSql = vi.fn((..._args: unknown[]) => Promise.resolve(sqlResults)) as unknown as
  ReturnType<typeof vi.fn> & { unsafe: ReturnType<typeof vi.fn> };
mockSql.unsafe = vi.fn((..._args: unknown[]) => Promise.resolve(sqlResults));

vi.mock('../db/connection.js', () => ({
  sql: mockSql,
  mudSchema: 'test_schema',
}));

// Mock the captcha module (not under test)
vi.mock('./captcha.js', () => ({
  verifyCaptcha: vi.fn().mockResolvedValue(true),
}));

// Mock the event feed (not under test)
vi.mock('../queue/eventFeed.js', () => ({
  getRecentEvents: vi.fn().mockReturnValue([]),
}));

// Mock milestone watcher (not under test here)
vi.mock('../queue/milestoneWatcher.js', () => ({
  generateInviteCode: vi.fn().mockResolvedValue('TESTCODE'),
}));

// Mock config
vi.mock('../config.js', () => ({
  config: {
    captcha: { turnstileSecret: 'test-secret' },
  },
}));

const { validateAndRedeemInviteCode } = await import('./queue.js');

beforeEach(() => {
  vi.clearAllMocks();
  sqlResults = [];
  mockSql.mockImplementation((..._args: unknown[]) => Promise.resolve(sqlResults));
});

function sqlReturnsSequence(seq: Record<string, unknown>[][]) {
  let call = 0;
  mockSql.mockImplementation(() => {
    const result = seq[call] ?? [];
    call++;
    return Promise.resolve(result);
  });
}

// ── validateAndRedeemInviteCode ───────────────────────────────────────────

describe('validateAndRedeemInviteCode', () => {
  it('returns true when code is valid and unused', async () => {
    sqlReturnsSequence([
      [{ code: 'ABCD1234', creator_wallet: '0xcreator' }], // UPDATE found unused code
      [],                                                     // INSERT activation tracking
    ]);

    expect(await validateAndRedeemInviteCode('abcd1234', '0xinvitee')).toBe(true);
  });

  it('returns false when code does not exist', async () => {
    sqlResults = []; // UPDATE found nothing
    expect(await validateAndRedeemInviteCode('INVALID1', '0xinvitee')).toBe(false);
  });

  it('returns false when code is already used', async () => {
    sqlResults = []; // UPDATE WHERE used_by IS NULL → no match
    expect(await validateAndRedeemInviteCode('ABCD1234', '0xinvitee')).toBe(false);
  });

  it('uppercases the code for lookup', async () => {
    sqlResults = [];
    await validateAndRedeemInviteCode('abcd1234', '0xinvitee');

    // sql`SET used_by = ${wallet}, ... WHERE code = ${code.toUpperCase()}` → wallet, code
    const codeArg = mockSql.mock.calls[0][2];
    expect(codeArg).toBe('ABCD1234');
  });

  it('atomically marks code as used (UPDATE WHERE used_by IS NULL)', async () => {
    sqlResults = [];
    await validateAndRedeemInviteCode('ABCD1234', '0xinvitee');

    const queryTemplate = mockSql.mock.calls[0][0].join('');
    expect(queryTemplate).toContain('used_by IS NULL');
    expect(queryTemplate).toContain('SET used_by');
  });

  it('creates activation tracking record on success', async () => {
    sqlReturnsSequence([
      [{ code: 'ABCD1234', creator_wallet: '0xcreator' }],
      [],
    ]);

    await validateAndRedeemInviteCode('ABCD1234', '0xinvitee');

    // Second call should be the activation INSERT
    expect(mockSql).toHaveBeenCalledTimes(2);
    const trackingQuery = mockSql.mock.calls[1][0].join('');
    expect(trackingQuery).toContain('referral_activations');
    expect(trackingQuery).toContain('ON CONFLICT DO NOTHING');
  });

  it('uses uppercase code for activation tracking', async () => {
    sqlReturnsSequence([
      [{ code: 'ABCD1234', creator_wallet: '0xcreator' }],
      [],
    ]);

    await validateAndRedeemInviteCode('abcd1234', '0xinvitee');

    const activationCodeArg = mockSql.mock.calls[1][1];
    expect(activationCodeArg).toBe('ABCD1234');
  });

  it('does not create tracking record on failure', async () => {
    sqlResults = []; // code not found
    await validateAndRedeemInviteCode('INVALID1', '0xinvitee');
    expect(mockSql).toHaveBeenCalledTimes(1); // only the UPDATE, no INSERT
  });
});
