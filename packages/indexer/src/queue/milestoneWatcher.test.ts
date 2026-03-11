import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock setup ────────────────────────────────────────────────────────────
let sqlResults: Record<string, unknown>[] = [];

const mockSql = vi.fn((..._args: unknown[]) => Promise.resolve(sqlResults)) as unknown as
  ReturnType<typeof vi.fn> & { unsafe: ReturnType<typeof vi.fn> };
mockSql.unsafe = vi.fn((..._args: unknown[]) => Promise.resolve(sqlResults));

vi.mock('../db/connection.js', () => ({
  sql: mockSql,
  mudSchema: 'test_schema',
}));

const {
  detectCrossedMilestones,
  processCharacterLevel,
  generateInviteCode,
  hasCodeForMilestone,
  checkAndActivateReferral,
  LEVEL_MILESTONES,
  ACTIVATION_LEVEL,
} = await import('./milestoneWatcher.js');

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

// ── Pure function: detectCrossedMilestones ────────────────────────────────

describe('detectCrossedMilestones', () => {
  it('returns empty for no level change', () => {
    expect(detectCrossedMilestones(5, 5)).toEqual([]);
  });

  it('returns empty for level decrease', () => {
    expect(detectCrossedMilestones(10, 5)).toEqual([]);
  });

  it('detects crossing a single milestone', () => {
    expect(detectCrossedMilestones(2, 3)).toEqual([3]);
  });

  it('detects crossing multiple milestones at once', () => {
    expect(detectCrossedMilestones(1, 25)).toEqual([3, 10, 20]);
  });

  it('does not include milestones already passed', () => {
    expect(detectCrossedMilestones(5, 12)).toEqual([10]);
  });

  it('handles exact milestone level', () => {
    expect(detectCrossedMilestones(9, 10)).toEqual([10]);
  });

  it('handles jump past milestone without landing on it', () => {
    expect(detectCrossedMilestones(2, 7)).toEqual([3]);
  });

  it('works with custom milestones', () => {
    expect(detectCrossedMilestones(0, 50, [5, 15, 30, 50])).toEqual([5, 15, 30, 50]);
  });

  it('returns empty when between milestones', () => {
    expect(detectCrossedMilestones(4, 9)).toEqual([]);
  });

  it('handles prevLevel 0 (initial scan / new character)', () => {
    // This is the key fix — level 10 character seen for the first time
    expect(detectCrossedMilestones(0, 10)).toEqual([3, 10]);
  });

  it('handles prevLevel 0 with level above all milestones', () => {
    expect(detectCrossedMilestones(0, 25)).toEqual([3, 10, 20]);
  });

  it('uses default LEVEL_MILESTONES when none provided', () => {
    const result = detectCrossedMilestones(0, 100);
    expect(result).toEqual(LEVEL_MILESTONES);
  });
});

// ── generateInviteCode ────────────────────────────────────────────────────

describe('generateInviteCode', () => {
  it('returns an 8-char code', async () => {
    const code = await generateInviteCode('0xABC', 'level_3');
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
  });

  it('lowercases wallet before inserting', async () => {
    await generateInviteCode('0xABCDEF', 'level_3');
    // sql`VALUES (${code}, ${wallet}, ${milestone})` → args: code, wallet, milestone
    const walletArg = mockSql.mock.calls[0][2];
    expect(walletArg).toBe('0xabcdef');
  });

  it('passes milestone to the insert', async () => {
    await generateInviteCode('0xabc', 'level_10');
    const milestoneArg = mockSql.mock.calls[0][3];
    expect(milestoneArg).toBe('level_10');
  });

  it('uses ON CONFLICT DO NOTHING for idempotency', async () => {
    await generateInviteCode('0xabc', 'test');
    const queryTemplate = mockSql.mock.calls[0][0].join('');
    expect(queryTemplate).toContain('ON CONFLICT DO NOTHING');
  });
});

// ── hasCodeForMilestone ───────────────────────────────────────────────────

describe('hasCodeForMilestone', () => {
  it('returns true when code exists', async () => {
    sqlResults = [{ '?column?': 1 }];
    expect(await hasCodeForMilestone('0xabc', 'level_3')).toBe(true);
  });

  it('returns false when no code exists', async () => {
    sqlResults = [];
    expect(await hasCodeForMilestone('0xabc', 'level_3')).toBe(false);
  });

  it('lowercases wallet', async () => {
    sqlResults = [];
    await hasCodeForMilestone('0xABC', 'level_3');
    expect(mockSql.mock.calls[0][1]).toBe('0xabc');
  });
});

// ── processCharacterLevel ─────────────────────────────────────────────────

describe('processCharacterLevel', () => {
  it('does nothing when level did not increase', async () => {
    const result = await processCharacterLevel('0xabc', 5, 5);
    expect(result.codesGenerated).toEqual([]);
    expect(result.activationChecked).toBe(false);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('does nothing when level decreased', async () => {
    const result = await processCharacterLevel('0xabc', 10, 5);
    expect(result.codesGenerated).toEqual([]);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('generates code for crossed milestone when none exists', async () => {
    sqlReturnsSequence([
      [], // hasCodeForMilestone → no existing code
      [], // generateInviteCode INSERT
    ]);

    const result = await processCharacterLevel('0xabc', 2, 4);
    expect(result.codesGenerated).toHaveLength(1);
    expect(result.activationChecked).toBe(false);
  });

  it('skips code generation when milestone code already exists', async () => {
    sqlReturnsSequence([
      [{ '?column?': 1 }], // hasCodeForMilestone → already exists
    ]);

    const result = await processCharacterLevel('0xabc', 2, 4);
    expect(result.codesGenerated).toEqual([]);
    // Only 1 sql call (the dedup check), no INSERT
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('checks activation when crossing level 5', async () => {
    sqlReturnsSequence([
      [], // hasCodeForMilestone for level_3 → no code
      [], // generateInviteCode for level_3
      [], // checkAndActivateReferral → no activation found
    ]);

    const result = await processCharacterLevel('0xabc', 0, 6);
    expect(result.activationChecked).toBe(true);
  });

  it('does not check activation when already past level 5', async () => {
    sqlReturnsSequence([
      [], // hasCodeForMilestone for level_10 → no code
      [], // generateInviteCode for level_10
    ]);

    const result = await processCharacterLevel('0xabc', 9, 11);
    expect(result.activationChecked).toBe(false);
  });

  it('handles initial scan (prevLevel 0) — retroactive milestone grant', async () => {
    // This is the key behavior fix: prevLevel 0 means first time seeing this character.
    // Should process milestones retroactively, dedup prevents duplicates.
    sqlReturnsSequence([
      [{ '?column?': 1 }], // hasCodeForMilestone level_3 → already has it
      [],                   // hasCodeForMilestone level_10 → no code
      [],                   // generateInviteCode level_10
      [],                   // checkAndActivateReferral (level >= 5)
    ]);

    const result = await processCharacterLevel('0xabc', 0, 12);
    // Only level_10 code generated (level_3 was already there)
    expect(result.codesGenerated).toHaveLength(1);
    expect(result.activationChecked).toBe(true);
  });
});

// ── checkAndActivateReferral ──────────────────────────────────────────────

describe('checkAndActivateReferral', () => {
  it('returns false when invitee was not referred', async () => {
    sqlResults = []; // UPDATE RETURNING → no rows
    expect(await checkAndActivateReferral('0xinvitee')).toBe(false);
  });

  it('activates referral and generates bonus code for referrer', async () => {
    sqlReturnsSequence([
      [{ invite_code: 'ABCD1234' }],           // activation found
      [{ creator_wallet: '0xreferrer' }],       // lookup referrer
      [],                                        // generateInviteCode
    ]);

    expect(await checkAndActivateReferral('0xinvitee')).toBe(true);

    // Third sql call is generateInviteCode(referrerWallet, 'activation_bonus')
    // sql`VALUES (${code}, ${wallet}, ${milestone})` → args: code, wallet, milestone
    const genCall = mockSql.mock.calls[2];
    const queryTemplate = genCall[0].join('');
    expect(queryTemplate).toContain('queue.invite_codes');
    expect(genCall[2]).toBe('0xreferrer'); // wallet (arg index 2)
    expect(genCall[3]).toBe('activation_bonus'); // milestone (arg index 3)
  });

  it('returns false when invite code lookup fails', async () => {
    sqlReturnsSequence([
      [{ invite_code: 'ABCD1234' }], // activation found
      [],                              // code lookup → not found
    ]);

    expect(await checkAndActivateReferral('0xinvitee')).toBe(false);
  });

  it('uses activated_at IS NULL guard for idempotency', async () => {
    sqlResults = [];
    await checkAndActivateReferral('0xinvitee');
    const queryTemplate = mockSql.mock.calls[0][0].join('');
    expect(queryTemplate).toContain('activated_at IS NULL');
  });
});
