import { describe, it, expect } from 'vitest';
import { getDominantStat, getThreatColor } from './threatAssessment';

// ============================================================
// getDominantStat
// ============================================================

describe('getDominantStat', () => {
  it('returns STR when strength is highest', () => {
    const [idx, val] = getDominantStat({ strength: 10n, agility: 5n, intelligence: 3n });
    expect(idx).toBe(0);
    expect(val).toBe(10n);
  });

  it('returns AGI when agility is highest', () => {
    const [idx, val] = getDominantStat({ strength: 5n, agility: 12n, intelligence: 3n });
    expect(idx).toBe(1);
    expect(val).toBe(12n);
  });

  it('returns INT when intelligence is highest', () => {
    const [idx, val] = getDominantStat({ strength: 3n, agility: 5n, intelligence: 13n });
    expect(idx).toBe(2);
    expect(val).toBe(13n);
  });

  it('ties: STR wins over AGI and INT when all equal', () => {
    const [idx] = getDominantStat({ strength: 7n, agility: 7n, intelligence: 7n });
    expect(idx).toBe(0); // STR >= AGI && STR >= INT
  });

  it('ties: AGI wins over INT when both beat STR', () => {
    const [idx] = getDominantStat({ strength: 3n, agility: 8n, intelligence: 8n });
    expect(idx).toBe(1); // AGI > STR && AGI >= INT
  });
});

// ============================================================
// getThreatColor
// ============================================================

const makePlayer = (overrides: Partial<{
  strength: bigint; agility: bigint; intelligence: bigint;
  level: bigint; maxHp: bigint;
}> = {}) => ({
  strength: 10n,
  agility: 10n,
  intelligence: 10n,
  level: 5n,
  maxHp: 40n,
  ...overrides,
});

const makeMonster = (overrides: Partial<{
  strength: bigint; agility: bigint; intelligence: bigint;
  level: bigint; maxHp: bigint; armor: bigint; isElite: boolean;
}> = {}) => ({
  strength: 6n,
  agility: 3n,
  intelligence: 2n,
  level: 1n,
  maxHp: 10n,
  armor: 0n,
  isElite: false,
  ...overrides,
});

describe('getThreatColor', () => {
  // --- Green: player clearly favored ---

  it('level 5 player vs level 1 Dire Rat = green', () => {
    const color = getThreatColor(
      makePlayer(),
      makeMonster({ strength: 3n, agility: 6n, intelligence: 2n, level: 1n, maxHp: 10n }),
    );
    expect(color).toBe('green');
  });

  it('level 5 STR player vs level 2 Fungal Shaman (INT) = green despite triangle disadvantage', () => {
    // This was the broken case: old code returned red/yellow because INT beats STR in triangle
    const color = getThreatColor(
      makePlayer({ strength: 11n, agility: 5n, intelligence: 3n }),
      makeMonster({ strength: 3n, agility: 4n, intelligence: 8n, level: 2n, maxHp: 12n }),
    );
    expect(color).toBe('green');
  });

  // --- Red: monster is significantly stronger ---

  it('level 1 player vs level 10 Dusk Drake = red', () => {
    const color = getThreatColor(
      makePlayer({ strength: 5n, agility: 7n, intelligence: 7n, level: 1n, maxHp: 18n }),
      makeMonster({ strength: 13n, agility: 13n, intelligence: 15n, level: 10n, maxHp: 52n, armor: 2n }),
    );
    expect(color).toBe('red');
  });

  it('level 3 player vs level 8 Rock Golem (high armor) = red', () => {
    const color = getThreatColor(
      makePlayer({ strength: 8n, agility: 6n, intelligence: 5n, level: 3n, maxHp: 24n }),
      makeMonster({ strength: 14n, agility: 8n, intelligence: 7n, level: 8n, maxHp: 38n, armor: 3n }),
    );
    expect(color).toBe('red');
  });

  // --- Yellow: close fight ---

  it('similar power levels = yellow', () => {
    const color = getThreatColor(
      makePlayer({ strength: 9n, agility: 6n, intelligence: 5n, level: 5n, maxHp: 30n }),
      makeMonster({ strength: 11n, agility: 6n, intelligence: 5n, level: 5n, maxHp: 26n, armor: 2n }),
    );
    expect(color).toBe('yellow');
  });

  // --- Elite modifier pushes difficulty up ---

  it('elite version of same monster is harder', () => {
    const base = makeMonster({ strength: 9n, agility: 4n, intelligence: 3n, level: 3n, maxHp: 18n });
    const player = makePlayer({ strength: 8n, agility: 7n, intelligence: 5n, level: 4n, maxHp: 28n });

    const normalColor = getThreatColor(player, { ...base, isElite: false });
    const eliteColor = getThreatColor(player, { ...base, isElite: true });

    // Elite should be same or harder
    const colorRank: Record<string, number> = { green: 2, yellow: 1, red: 0 };
    expect(colorRank[eliteColor]).toBeLessThanOrEqual(colorRank[normalColor]);
  });

  // --- Combat triangle gives edge ---

  it('triangle advantage helps: STR player vs AGI monster', () => {
    const player = makePlayer({ strength: 10n, agility: 5n, intelligence: 5n, level: 5n, maxHp: 30n });
    // AGI-dominant monster — player's STR beats it
    const advantaged = getThreatColor(player,
      makeMonster({ strength: 5n, agility: 10n, intelligence: 5n, level: 5n, maxHp: 30n }),
    );
    // INT-dominant monster — beats player's STR
    const disadvantaged = getThreatColor(player,
      makeMonster({ strength: 5n, agility: 5n, intelligence: 10n, level: 5n, maxHp: 30n }),
    );

    const colorRank: Record<string, number> = { green: 2, yellow: 1, red: 0 };
    expect(colorRank[advantaged]).toBeGreaterThanOrEqual(colorRank[disadvantaged]);
  });

  // --- Armor matters ---

  it('high armor makes monster harder', () => {
    const player = makePlayer({ level: 5n, maxHp: 30n });
    const noArmor = getThreatColor(player, makeMonster({ level: 5n, maxHp: 30n, armor: 0n }));
    const heavyArmor = getThreatColor(player, makeMonster({ level: 5n, maxHp: 30n, armor: 4n }));

    const colorRank: Record<string, number> = { green: 2, yellow: 1, red: 0 };
    expect(colorRank[heavyArmor]).toBeLessThanOrEqual(colorRank[noArmor]);
  });

  // --- Edge: null opponent stats default to yellow ---

  it('returns yellow when opponent stats are null', () => {
    const color = getThreatColor(
      makePlayer(),
      { strength: null as any, agility: null as any, intelligence: null as any },
    );
    expect(color).toBe('yellow');
  });

  // --- PvP: Character vs Character (no armor/elite fields) ---

  it('works for PvP opponents without armor/isElite', () => {
    const color = getThreatColor(
      makePlayer(),
      { strength: 8n, agility: 8n, intelligence: 8n, level: 4n, maxHp: 35n },
    );
    expect(['green', 'yellow', 'red']).toContain(color);
  });

  // --- Boss: Basilisk should be red for most players ---

  it('Basilisk boss is red for a level 5 player', () => {
    const color = getThreatColor(
      makePlayer({ strength: 10n, agility: 7n, intelligence: 7n, level: 5n, maxHp: 35n }),
      makeMonster({ strength: 17n, agility: 12n, intelligence: 10n, level: 12n, maxHp: 130n, armor: 4n }),
    );
    expect(color).toBe('red');
  });
});
