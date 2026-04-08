import { describe, expect, it } from 'vitest';

import type { AttackOutcomeType } from '../utils/types';

import { buildBattleSceneSignal } from './buildBattleSceneSignal';

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
});
