import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFloatingDamageSignals } from './useFloatingDamageSignals';
import type { AttackOutcomeType } from '../utils/types';
import type { BattleFloatingDamageHandle } from '../components/pretext/game/BattleFloatingDamage';

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

describe('useFloatingDamageSignals', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resets processed outcomes when a new encounter starts', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const spawn = vi.fn();
    const damageRef = {
      current: { spawn },
    } as React.RefObject<BattleFloatingDamageHandle | null>;

    const { rerender } = renderHook(
      ({ visibleOutcomes }) =>
        useFloatingDamageSignals({
          visibleOutcomes,
          characterId: PLAYER_ID,
          damageRef,
          containerWidth: 1000,
          containerHeight: 500,
        }),
      {
        initialProps: {
          visibleOutcomes: [makeOutcome({ encounterId: '0xenc1', attackNumber: 1n })],
        },
      },
    );

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledTimes(1);

    rerender({
      visibleOutcomes: [makeOutcome({ encounterId: '0xenc2', attackNumber: 1n })],
    });

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('uses larger floating text variants for combo and crit-combo hits', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const spawn = vi.fn();
    const damageRef = {
      current: { spawn },
    } as React.RefObject<BattleFloatingDamageHandle | null>;

    renderHook(() =>
      useFloatingDamageSignals({
        visibleOutcomes: [
          makeOutcome({
            damagePerHit: [4n, 9n],
            hit: [true, true],
            miss: [false, false],
            crit: [false, true],
            doubleStrike: true,
          }),
        ],
        characterId: PLAYER_ID,
        damageRef,
        containerWidth: 1000,
        containerHeight: 500,
      }),
    );

    await vi.runAllTimersAsync();

    expect(spawn).toHaveBeenNthCalledWith(1, 600, 125, 'double', 4);
    expect(spawn).toHaveBeenNthCalledWith(2, 612, 125, 'critDouble', 9);
  });
});
