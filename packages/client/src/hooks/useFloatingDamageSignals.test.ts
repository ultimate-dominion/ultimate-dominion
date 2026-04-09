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

function setup(visibleOutcomes: AttackOutcomeType[]) {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const spawn = vi.fn();
  const damageRef = {
    current: { spawn },
  } as React.RefObject<BattleFloatingDamageHandle | null>;

  const hookResult = renderHook(
    ({ outcomes }) =>
      useFloatingDamageSignals({
        visibleOutcomes: outcomes,
        characterId: PLAYER_ID,
        damageRef,
        containerWidth: 1000,
        containerHeight: 500,
      }),
    { initialProps: { outcomes: visibleOutcomes } },
  );

  return { spawn, damageRef, hookResult };
}

describe('useFloatingDamageSignals', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('resets processed outcomes when a new encounter starts', async () => {
    vi.useFakeTimers();
    const { spawn, hookResult } = setup([
      makeOutcome({ encounterId: '0xenc1', attackNumber: 1n }),
    ]);

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledTimes(1);

    hookResult.rerender({
      outcomes: [makeOutcome({ encounterId: '0xenc2', attackNumber: 1n })],
    });

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('uses larger floating text variants for combo and crit-combo hits', async () => {
    vi.useFakeTimers();
    const { spawn } = setup([
      makeOutcome({
        damagePerHit: [4n, 9n],
        hit: [true, true],
        miss: [false, false],
        crit: [false, true],
        doubleStrike: true,
      }),
    ]);

    await vi.runAllTimersAsync();

    // Consolidated: one spawn with total damage (4+9=13), critDouble (combo+crit), hitCount=2
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith(600, 125, 'critDouble', 13, 2);
  });

  // ── Player attack types ──────────────────────────────────────────────

  it('spawns "damage" type for regular player hit', async () => {
    vi.useFakeTimers();
    const { spawn } = setup([makeOutcome({ damagePerHit: [15n] })]);

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledWith(600, 125, 'damage', 15, undefined);
  });

  it('spawns "crit" type for player critical hit', async () => {
    vi.useFakeTimers();
    const { spawn } = setup([
      makeOutcome({ damagePerHit: [30n], crit: [true] }),
    ]);

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledWith(600, 125, 'crit', 30, undefined);
  });

  it('spawns "double" type for player double strike', async () => {
    vi.useFakeTimers();
    const { spawn } = setup([
      makeOutcome({
        damagePerHit: [8n, 8n],
        hit: [true, true],
        miss: [false, false],
        crit: [false, false],
        doubleStrike: true,
      }),
    ]);

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledWith(600, 125, 'double', 16, 2);
  });

  it('spawns "miss" for player miss', async () => {
    vi.useFakeTimers();
    const { spawn } = setup([
      makeOutcome({ damagePerHit: [0n], hit: [false], miss: [true] }),
    ]);

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledWith(600, 125, 'miss');
  });

  // ── Enemy attack types ───────────────────────────────────────────────

  it('spawns "enemyDamage" for regular enemy hit on player', async () => {
    vi.useFakeTimers();
    const { spawn } = setup([
      makeOutcome({
        attackerId: MONSTER_ID,
        defenderId: PLAYER_ID,
        damagePerHit: [12n],
      }),
    ]);

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledWith(200, 125, 'enemyDamage', 12, undefined);
  });

  it('spawns "enemyCrit" for enemy critical hit on player', async () => {
    vi.useFakeTimers();
    const { spawn } = setup([
      makeOutcome({
        attackerId: MONSTER_ID,
        defenderId: PLAYER_ID,
        damagePerHit: [25n],
        crit: [true],
      }),
    ]);

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledWith(200, 125, 'enemyCrit', 25, undefined);
  });

  it('spawns "blocked" when player blocks an enemy attack', async () => {
    vi.useFakeTimers();
    const { spawn } = setup([
      makeOutcome({
        attackerId: MONSTER_ID,
        defenderId: PLAYER_ID,
        damagePerHit: [5n],
        blocked: true,
      }),
    ]);

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledWith(200, 125, 'blocked', 5, undefined);
  });

  it('spawns "dodged" when spell is dodged', async () => {
    vi.useFakeTimers();
    const { spawn } = setup([
      makeOutcome({
        attackerId: MONSTER_ID,
        defenderId: PLAYER_ID,
        damagePerHit: [0n],
        hit: [false],
        miss: [true],
        spellDodged: true,
      }),
    ]);

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledWith(200, 125, 'dodged');
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  it('does not re-spawn when counterattack is revealed (same encounter)', async () => {
    vi.useFakeTimers();
    const playerAttack = makeOutcome({
      attackerId: PLAYER_ID,
      attackNumber: 1n,
      damagePerHit: [20n],
    });
    const counterattack = makeOutcome({
      attackerId: MONSTER_ID,
      attackNumber: 2n,
      damagePerHit: [8n],
    });

    const { spawn, hookResult } = setup([playerAttack]);

    await vi.runAllTimersAsync();
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith(600, 125, 'damage', 20, undefined);

    // Counterattack revealed — both outcomes now visible
    hookResult.rerender({ outcomes: [playerAttack, counterattack] });
    await vi.runAllTimersAsync();

    // Player attack NOT re-spawned, only counterattack added
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(spawn).toHaveBeenLastCalledWith(200, 125, 'enemyDamage', 8, undefined);
  });

  it('player attack with monster block still uses player damage type', async () => {
    vi.useFakeTimers();
    const { spawn } = setup([
      makeOutcome({
        attackerId: PLAYER_ID,
        damagePerHit: [7n],
        blocked: true,
      }),
    ]);

    await vi.runAllTimersAsync();
    // Player's attack that got partially blocked — still shows as player damage (red)
    expect(spawn).toHaveBeenCalledWith(600, 125, 'damage', 7, undefined);
  });
});
