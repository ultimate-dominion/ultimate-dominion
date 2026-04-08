import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBattleSceneSignals, type BattleSceneHandle } from './useBattleSceneSignals';
import type { AttackOutcomeType } from '../utils/types';

const PLAYER_ID = '0xplayer';
const MONSTER_ID = '0xmonster';

function makeOutcome(
  overrides: Partial<AttackOutcomeType> = {},
): AttackOutcomeType {
  return {
    attackerDamageDelt: 10n,
    attackerDied: false,
    attackerId: PLAYER_ID,
    attackNumber: 1n,
    blocked: false,
    blockNumber: 1n,
    crit: [false],
    currentTurn: 1n,
    damagePerHit: [10n],
    defenderDamageDelt: 0n,
    defenderDied: false,
    defenderId: MONSTER_ID,
    doubleStrike: false,
    effectIds: [],
    encounterId: '0xenc1',
    hit: [true],
    itemId: '0xsword',
    miss: [false],
    spellDodged: false,
    timestamp: 1000n,
    ...overrides,
  };
}

describe('useBattleSceneSignals', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits hit metadata so misses do not animate as clean hits', async () => {
    vi.useFakeTimers();
    const triggerAttack = vi.fn();
    const sceneRef = {
      current: { triggerAttack },
    } as React.RefObject<BattleSceneHandle | null>;

    renderHook(() =>
      useBattleSceneSignals({
        visibleOutcomes: [
          makeOutcome({
            attackerId: MONSTER_ID,
            defenderId: PLAYER_ID,
            attackerDamageDelt: 0n,
            damagePerHit: [0n],
            hit: [false],
            miss: [true],
          }),
        ],
        characterId: PLAYER_ID,
        opponentName: 'Giant Spider',
        sceneRef,
        weaponTypeForItem: () => 'melee',
      }),
    );

    await vi.runAllTimersAsync();

    expect(triggerAttack).toHaveBeenCalledTimes(1);
    expect(triggerAttack).toHaveBeenCalledWith({
      weaponType: 'melee',
      damage: 0,
      isCrit: false,
      isPlayerAttack: false,
      didHit: false,
      targetDied: false,
      isCombo: false,
      callout: {
        title: 'DODGED',
        detail: 'Giant Spider misses you.',
        tone: 'enemy',
      },
    });
  });

  it('resets processed outcomes when a new encounter replaces the old one', async () => {
    vi.useFakeTimers();
    const triggerAttack = vi.fn();
    const sceneRef = {
      current: { triggerAttack },
    } as React.RefObject<BattleSceneHandle | null>;

    const { rerender } = renderHook(
      ({ visibleOutcomes }) =>
        useBattleSceneSignals({
          visibleOutcomes,
          characterId: PLAYER_ID,
          opponentName: 'Giant Spider',
          sceneRef,
          weaponTypeForItem: () => 'melee',
        }),
      {
        initialProps: {
          visibleOutcomes: [
            makeOutcome({ encounterId: '0xenc1', attackNumber: 1n }),
          ],
        },
      },
    );

    await vi.runAllTimersAsync();
    expect(triggerAttack).toHaveBeenCalledTimes(1);

    rerender({
      visibleOutcomes: [
        makeOutcome({
          encounterId: '0xenc2',
          attackNumber: 1n,
          defenderDied: true,
        }),
      ],
    });

    await vi.runAllTimersAsync();
    expect(triggerAttack).toHaveBeenCalledTimes(2);
    expect(triggerAttack).toHaveBeenLastCalledWith({
      weaponType: 'melee',
      damage: 10,
      isCrit: false,
      isPlayerAttack: true,
      didHit: true,
      targetDied: true,
      isCombo: false,
      callout: {
        title: '10 DAMAGE',
        detail: 'You hit Giant Spider.',
        tone: 'player',
      },
    });
  });

  it('stages multi-hit outcomes into separate attack beats', async () => {
    vi.useFakeTimers();
    const triggerAttack = vi.fn();
    const sceneRef = {
      current: { triggerAttack },
    } as React.RefObject<BattleSceneHandle | null>;

    renderHook(() =>
      useBattleSceneSignals({
        visibleOutcomes: [
          makeOutcome({
            damagePerHit: [4n, 6n],
            hit: [true, true],
            crit: [false, true],
            miss: [false, false],
            doubleStrike: true,
            defenderDied: true,
          }),
        ],
        characterId: PLAYER_ID,
        opponentName: 'Giant Spider',
        sceneRef,
        weaponTypeForItem: () => 'melee',
      }),
    );

    await vi.advanceTimersByTimeAsync(1);
    expect(triggerAttack).toHaveBeenNthCalledWith(1, expect.objectContaining({
      damage: 4,
      targetDied: false,
      isCombo: true,
    }));

    await vi.advanceTimersByTimeAsync(240);
    expect(triggerAttack).toHaveBeenCalledTimes(2);
    expect(triggerAttack).toHaveBeenNthCalledWith(2, expect.objectContaining({
      damage: 6,
      isCrit: true,
      targetDied: true,
      isCombo: true,
    }));
  });
});
