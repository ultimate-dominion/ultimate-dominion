import { describe, it, expect, vi } from 'vitest';

// ── Mock setup ────────────────────────────────────────────────────────────
const mockSql = vi.fn() as unknown as ReturnType<typeof vi.fn> & { unsafe: ReturnType<typeof vi.fn> };
mockSql.unsafe = vi.fn();

vi.mock('../db/connection.js', () => ({
  sql: mockSql,
  mudSchema: 'test_schema',
}));

const { extractWalletHex } = await import('./eventFeed.js');

describe('extractWalletHex', () => {
  const REAL_WALLET = '0x5a4b5547bfdc0922b45bec76e3129f9fa46195e5';
  const FULL_ENTITY = '0x5a4b5547bfdc0922b45bec76e3129f9fa46195e5000000000000000000000077';

  it('extracts wallet from JSON array string format', () => {
    const raw = `["${FULL_ENTITY}"]`;
    expect(extractWalletHex(raw)).toBe(REAL_WALLET);
  });

  it('extracts wallet from {json:[...]} string format', () => {
    const raw = `{"json":["${FULL_ENTITY}"]}`;
    expect(extractWalletHex(raw)).toBe(REAL_WALLET);
  });

  it('extracts wallet from {json:[...]} object format', () => {
    const raw = { json: [FULL_ENTITY] };
    expect(extractWalletHex(raw)).toBe(REAL_WALLET);
  });

  it('extracts wallet from plain hex string', () => {
    expect(extractWalletHex(FULL_ENTITY)).toBe(REAL_WALLET);
  });

  it('extracts wallet from array format', () => {
    expect(extractWalletHex([FULL_ENTITY])).toBe(REAL_WALLET);
  });

  it('returns mob entity address for mob entity keys', () => {
    // Mob entities have small numbers — extractWalletHex returns them,
    // but the caller uses attackers_are_mobs to decide which field to use
    const mobEntity = '0x0000000a00000000000000000000000000000000000000000000036a00030007';
    expect(extractWalletHex(mobEntity)).toBe('0x0000000a00000000000000000000000000000000');
  });

  it('returns null for short hex strings', () => {
    expect(extractWalletHex('0x1234')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(extractWalletHex(null)).toBeNull();
    expect(extractWalletHex(undefined)).toBeNull();
  });

  it('returns null for empty values', () => {
    expect(extractWalletHex('')).toBeNull();
    expect(extractWalletHex([])).toBeNull();
  });
});

describe('mob attack wallet resolution', () => {
  it('uses defenders when attackers_are_mobs is true', () => {
    const row = {
      attackers_are_mobs: true,
      attackers: { json: ['0x0000000a00000000000000000000000000000000000000000000036a00030007'] },
      defenders: { json: ['0x5a4b5547bfdc0922b45bec76e3129f9fa46195e5000000000000000000000077'] },
    };

    const isMobAttack = row.attackers_are_mobs === true;
    const walletAddress = isMobAttack
      ? extractWalletHex(row.defenders)
      : extractWalletHex(row.attackers);

    expect(walletAddress).toBe('0x5a4b5547bfdc0922b45bec76e3129f9fa46195e5');
  });

  it('uses attackers when attackers_are_mobs is false', () => {
    const row = {
      attackers_are_mobs: false,
      attackers: { json: ['0x5a4b5547bfdc0922b45bec76e3129f9fa46195e5000000000000000000000077'] },
      defenders: { json: ['0x0000000a00000000000000000000000000000000000000000000036a00030007'] },
    };

    const isMobAttack = row.attackers_are_mobs === true;
    const walletAddress = isMobAttack
      ? extractWalletHex(row.defenders)
      : extractWalletHex(row.attackers);

    expect(walletAddress).toBe('0x5a4b5547bfdc0922b45bec76e3129f9fa46195e5');
  });

  it('falls back to attackers when attackers_are_mobs is null', () => {
    const row = {
      attackers_are_mobs: null,
      attackers: { json: ['0x5a4b5547bfdc0922b45bec76e3129f9fa46195e5000000000000000000000077'] },
      defenders: { json: ['0x0000000a00000000000000000000000000000000000000000000036a00030007'] },
    };

    const isMobAttack = row.attackers_are_mobs === true;
    const walletAddress = isMobAttack
      ? extractWalletHex(row.defenders)
      : extractWalletHex(row.attackers);

    expect(walletAddress).toBe('0x5a4b5547bfdc0922b45bec76e3129f9fa46195e5');
  });
});
