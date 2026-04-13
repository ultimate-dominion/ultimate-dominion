import { describe, expect, it } from 'vitest';

import type { AttackOutcomeType } from '../utils/types';

import { buildBattleSceneSignal, buildBattleSceneSignals } from './buildBattleSceneSignal';

const baseOutcome: AttackOutcomeType = {
  attackerDamageDelt: 0n,
  attackerDied: false,
  attackerId: '0xattacker',
  attackNumber: 1n,
  blocked: false,
  blockNumber: 1n,
  crit: [false],
  currentTurn: 1n,
  damagePerHit: [5n],
  defenderDamageDelt: 0n,
  defenderDied: false,
  defenderId: '0xdefender',
  doubleStrike: false,
  effectIds: [],
  encounterId: '0xencounter',
  hit: [true],
  itemId: '0xitem',
  miss: [false],
  spellDodged: false,
  timestamp: 1n,
};

describe('buildBattleSceneSignal', () => {
  it('builds a readable player damage callout', () => {
    const signal = buildBattleSceneSignal({
      outcome: baseOutcome,
      characterId: '0xattacker',
      opponentName: 'Giant Spider',
      weaponTypeForItem: () => 'melee',
    });

    expect(signal.isPlayerAttack).toBe(true);
    expect(signal.damage).toBe(5);
    expect(signal.callout).toEqual({
      title: '5 DAMAGE',
      detail: 'You hit Giant Spider.',
      tone: 'player',
    });
    expect(signal.isCombo).toBe(false);
  });

  it('builds a readable enemy crit callout', () => {
    const signal = buildBattleSceneSignal({
      outcome: {
        ...baseOutcome,
        attackerId: '0xmonster',
        crit: [true],
        damagePerHit: [12n],
      },
      characterId: '0xattacker',
      opponentName: 'Giant Spider',
      weaponTypeForItem: () => 'melee',
    });

    expect(signal.isPlayerAttack).toBe(false);
    expect(signal.callout).toEqual({
      title: 'CRIT 12',
      detail: 'Giant Spider hits you.',
      tone: 'crit',
    });
  });

  it('builds a readable miss callout', () => {
    const signal = buildBattleSceneSignal({
      outcome: {
        ...baseOutcome,
        miss: [true],
        hit: [false],
        damagePerHit: [0n],
      },
      characterId: '0xattacker',
      opponentName: 'Giant Spider',
      weaponTypeForItem: () => 'ranged',
    });

    expect(signal.callout).toEqual({
      title: 'MISS',
      detail: 'You fail to hit Giant Spider.',
      tone: 'miss',
    });
  });

  // ── Block / dodge flags ────────────────────────────────────────────

  it('sets blocked flag from outcome.blocked', () => {
    const signal = buildBattleSceneSignal({
      outcome: { ...baseOutcome, blocked: true },
      characterId: '0xattacker',
      opponentName: 'Giant Spider',
      weaponTypeForItem: () => 'melee',
    });

    expect(signal.blocked).toBe(true);
    expect(signal.dodged).toBe(false);
    expect(signal.callout.detail).toContain('through a block');
  });

  it('keeps normal misses separate from dodges', () => {
    const signal = buildBattleSceneSignal({
      outcome: { ...baseOutcome, miss: [true], hit: [false], damagePerHit: [0n] },
      characterId: '0xattacker',
      opponentName: 'Giant Spider',
      weaponTypeForItem: () => 'melee',
    });

    expect(signal.dodged).toBe(false);
    expect(signal.blocked).toBe(false);
  });

  it('sets dodged flag from spellDodged', () => {
    const signal = buildBattleSceneSignal({
      outcome: { ...baseOutcome, spellDodged: true },
      characterId: '0xattacker',
      opponentName: 'Giant Spider',
      weaponTypeForItem: () => 'spell',
    });

    expect(signal.dodged).toBe(true);
  });

  it('blocked counterattack mentions "through your block"', () => {
    const signal = buildBattleSceneSignal({
      outcome: { ...baseOutcome, attackerId: '0xmonster', blocked: true },
      characterId: '0xattacker',
      opponentName: 'Giant Spider',
      weaponTypeForItem: () => 'melee',
    });

    expect(signal.blocked).toBe(true);
    expect(signal.isPlayerAttack).toBe(false);
    expect(signal.callout.detail).toContain('through your block');
  });

  it('standard hit has both flags false', () => {
    const signal = buildBattleSceneSignal({
      outcome: baseOutcome,
      characterId: '0xattacker',
      opponentName: 'Giant Spider',
      weaponTypeForItem: () => 'melee',
    });

    expect(signal.blocked).toBe(false);
    expect(signal.dodged).toBe(false);
  });

  // ── Double strike / combo ─────────────────────────────────────────

  it('consolidates double strikes into single signal with total damage', () => {
    const signals = buildBattleSceneSignals({
      outcome: {
        ...baseOutcome,
        damagePerHit: [4n, 7n],
        hit: [true, true],
        miss: [false, false],
        crit: [false, true],
        doubleStrike: true,
        defenderDied: true,
      },
      characterId: '0xattacker',
      opponentName: 'Giant Spider',
      weaponTypeForItem: () => 'melee',
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      damage: 11, // 4 + 7 total
      hitCount: 2,
      isCrit: true, // any crit in combo
      didHit: true,
      targetDied: true,
      isCombo: true,
    });
  });

  it('consolidates multi-hit combos into one signal', () => {
    const signals = buildBattleSceneSignals({
      outcome: {
        ...baseOutcome,
        damagePerHit: [11n, 12n, 12n, 6n, 6n, 1n, 4n],
        hit: [true, true, true, true, true, true, true],
        miss: [false, false, false, false, false, false, false],
        crit: [false, false, false, false, false, false, false],
        attackerDamageDelt: 52n,
      },
      characterId: '0xattacker',
      opponentName: 'Hook Horror',
      weaponTypeForItem: () => 'melee',
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      damage: 52,
      hitCount: 7,
      isCombo: true,
      isCrit: false,
    });
  });

  it('returns hitCount=1 for single-hit attacks', () => {
    const signal = buildBattleSceneSignal({
      outcome: baseOutcome,
      characterId: '0xattacker',
      opponentName: 'Giant Spider',
      weaponTypeForItem: () => 'melee',
    });

    expect(signal.hitCount).toBe(1);
    expect(signal.isCombo).toBe(false);
  });

  it('all-miss multi-hit still returns one signal', () => {
    const signals = buildBattleSceneSignals({
      outcome: {
        ...baseOutcome,
        damagePerHit: [0n, 0n],
        hit: [false, false],
        miss: [true, true],
        crit: [false, false],
      },
      characterId: '0xattacker',
      opponentName: 'Giant Spider',
      weaponTypeForItem: () => 'melee',
    });

    expect(signals).toHaveLength(1);
    expect(signals[0].dodged).toBe(false);
    expect(signals[0].damage).toBe(0);
  });
});
