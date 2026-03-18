import { describe, expect, it } from 'vitest';
import { computeRanks } from './leaderboardRanks';
import { type Character } from './types';

const makeCharacter = (
  id: string,
  stats: { agi: bigint; str: bigint; int: bigint },
  gold: bigint = 0n,
  escrowGold: bigint = 0n,
): Character =>
  ({
    id,
    baseStats: {
      agility: stats.agi,
      strength: stats.str,
      intelligence: stats.int,
    },
    externalGoldBalance: gold,
    escrowGoldBalance: escrowGold,
  }) as Character;

describe('computeRanks', () => {
  it('returns null for empty character list', () => {
    expect(computeRanks([], 'abc')).toBeNull();
  });

  it('returns null for undefined characterId', () => {
    const chars = [makeCharacter('a', { agi: 10n, str: 10n, int: 10n })];
    expect(computeRanks(chars, undefined)).toBeNull();
  });

  it('returns null when character not found', () => {
    const chars = [makeCharacter('a', { agi: 10n, str: 10n, int: 10n })];
    expect(computeRanks(chars, 'missing')).toBeNull();
  });

  it('ranks sole player as #1 in both categories', () => {
    const chars = [makeCharacter('a', { agi: 5n, str: 5n, int: 5n }, 100n)];
    const result = computeRanks(chars, 'a');
    expect(result).toEqual({ statsRank: 1, goldRank: 1, totalPlayers: 1 });
  });

  it('computes correct stats rank by total base stats', () => {
    const chars = [
      makeCharacter('low', { agi: 1n, str: 1n, int: 1n }),
      makeCharacter('mid', { agi: 5n, str: 5n, int: 5n }),
      makeCharacter('high', { agi: 10n, str: 10n, int: 10n }),
    ];
    expect(computeRanks(chars, 'high')?.statsRank).toBe(1);
    expect(computeRanks(chars, 'mid')?.statsRank).toBe(2);
    expect(computeRanks(chars, 'low')?.statsRank).toBe(3);
  });

  it('computes correct gold rank by total gold (external + escrow)', () => {
    const chars = [
      makeCharacter('poor', { agi: 1n, str: 1n, int: 1n }, 10n),
      makeCharacter('middle', { agi: 1n, str: 1n, int: 1n }, 500n),
      makeCharacter('rich', { agi: 1n, str: 1n, int: 1n }, 1000n),
    ];
    expect(computeRanks(chars, 'rich')?.goldRank).toBe(1);
    expect(computeRanks(chars, 'middle')?.goldRank).toBe(2);
    expect(computeRanks(chars, 'poor')?.goldRank).toBe(3);
  });

  it('handles ties with dense ranking (same rank for equal values)', () => {
    const chars = [
      makeCharacter('a', { agi: 10n, str: 10n, int: 10n }, 100n),
      makeCharacter('b', { agi: 10n, str: 10n, int: 10n }, 100n),
      makeCharacter('c', { agi: 5n, str: 5n, int: 5n }, 50n),
    ];
    // a and b tied at rank 1
    expect(computeRanks(chars, 'a')?.statsRank).toBe(1);
    expect(computeRanks(chars, 'b')?.statsRank).toBe(1);
    // c has 2 players above
    expect(computeRanks(chars, 'c')?.statsRank).toBe(3);

    expect(computeRanks(chars, 'a')?.goldRank).toBe(1);
    expect(computeRanks(chars, 'b')?.goldRank).toBe(1);
    expect(computeRanks(chars, 'c')?.goldRank).toBe(3);
  });

  it('returns correct totalPlayers count', () => {
    const chars = [
      makeCharacter('a', { agi: 1n, str: 1n, int: 1n }),
      makeCharacter('b', { agi: 2n, str: 2n, int: 2n }),
      makeCharacter('c', { agi: 3n, str: 3n, int: 3n }),
      makeCharacter('d', { agi: 4n, str: 4n, int: 4n }),
    ];
    expect(computeRanks(chars, 'b')?.totalPlayers).toBe(4);
  });

  it('handles large bigint gold values correctly', () => {
    const chars = [
      makeCharacter('whale', { agi: 1n, str: 1n, int: 1n }, 10n ** 24n),
      makeCharacter('minnow', { agi: 1n, str: 1n, int: 1n }, 10n ** 18n),
    ];
    expect(computeRanks(chars, 'whale')?.goldRank).toBe(1);
    expect(computeRanks(chars, 'minnow')?.goldRank).toBe(2);
  });

  it('stats and gold ranks are independent', () => {
    const chars = [
      makeCharacter('strong-poor', { agi: 20n, str: 20n, int: 20n }, 10n),
      makeCharacter('weak-rich', { agi: 1n, str: 1n, int: 1n }, 1000n),
    ];
    const strongPoor = computeRanks(chars, 'strong-poor');
    expect(strongPoor?.statsRank).toBe(1);
    expect(strongPoor?.goldRank).toBe(2);

    const weakRich = computeRanks(chars, 'weak-rich');
    expect(weakRich?.statsRank).toBe(2);
    expect(weakRich?.goldRank).toBe(1);
  });

  it('escrow gold contributes to gold rank', () => {
    const chars = [
      makeCharacter('escrow-heavy', { agi: 1n, str: 1n, int: 1n }, 1n, 100n),
      makeCharacter('external-only', { agi: 1n, str: 1n, int: 1n }, 50n, 0n),
    ];
    expect(computeRanks(chars, 'escrow-heavy')?.goldRank).toBe(1);
    expect(computeRanks(chars, 'external-only')?.goldRank).toBe(2);
  });

  it('tied total gold (different split) shares same rank', () => {
    const chars = [
      makeCharacter('split', { agi: 1n, str: 1n, int: 1n }, 5n, 5n),
      makeCharacter('external', { agi: 1n, str: 1n, int: 1n }, 10n, 0n),
    ];
    expect(computeRanks(chars, 'split')?.goldRank).toBe(1);
    expect(computeRanks(chars, 'external')?.goldRank).toBe(1);
  });
});
