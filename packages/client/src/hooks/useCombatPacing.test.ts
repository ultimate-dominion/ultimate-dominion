import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useCombatPacing } from './useCombatPacing';
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
    blockNumber: 1n,
    crit: [false],
    currentTurn: 1n,
    damagePerHit: [10n],
    defenderDamageDelt: 0n,
    defenderDied: false,
    defenderId: MONSTER_ID,
    effectIds: [],
    encounterId: '0xenc',
    hit: [true],
    itemId: '0xsword',
    miss: [false],
    timestamp: 1000n,
    ...overrides,
  };
}

describe('useCombatPacing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Happy paths ---

  it('player attack only (monster dies) — no delay, all visible', () => {
    const playerAttack = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: MONSTER_ID,
      currentTurn: 1n,
      defenderDied: true,
    });

    const { result } = renderHook(() =>
      useCombatPacing({
        attackOutcomes: [playerAttack],
        characterId: PLAYER_ID,
        isInBattle: true,
      }),
    );

    expect(result.current.visibleOutcomes).toEqual([playerAttack]);
    expect(result.current.isCounterattackPending).toBe(false);
    expect(result.current.isBattleResolutionPending).toBe(true);
    expect(result.current.pendingCounterattackDamage).toBe(0n);
    expect(result.current.pendingTurn).toBeNull();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(result.current.isBattleResolutionPending).toBe(false);
  });

  it('full turn (player + monster) — counterattack hidden for 600ms, then revealed', () => {
    const playerAttack = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: MONSTER_ID,
      currentTurn: 1n,
    });
    const monsterAttack = makeOutcome({
      attackerId: MONSTER_ID,
      defenderId: PLAYER_ID,
      attackerDamageDelt: 5n,
      currentTurn: 1n,
    });

    const { result } = renderHook(() =>
      useCombatPacing({
        attackOutcomes: [playerAttack, monsterAttack],
        characterId: PLAYER_ID,
        isInBattle: true,
      }),
    );

    // During delay: counterattack hidden
    expect(result.current.visibleOutcomes).toEqual([playerAttack]);
    expect(result.current.isCounterattackPending).toBe(true);
    expect(result.current.isBattleResolutionPending).toBe(true);
    expect(result.current.pendingCounterattackDamage).toBe(5n);
    expect(result.current.pendingTurn).toBe(1n);

    // After 600ms: revealed
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.visibleOutcomes).toEqual([playerAttack, monsterAttack]);
    expect(result.current.isCounterattackPending).toBe(false);
    expect(result.current.isBattleResolutionPending).toBe(false);
    expect(result.current.pendingCounterattackDamage).toBe(0n);
    expect(result.current.pendingTurn).toBeNull();
  });

  it('self-use (potion) — always immediately visible', () => {
    const selfUse = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: PLAYER_ID,
      attackerDamageDelt: 0n,
      currentTurn: 1n,
    });

    const { result } = renderHook(() =>
      useCombatPacing({
        attackOutcomes: [selfUse],
        characterId: PLAYER_ID,
        isInBattle: true,
      }),
    );

    expect(result.current.visibleOutcomes).toEqual([selfUse]);
    expect(result.current.isCounterattackPending).toBe(false);
  });

  it('monster misses — same 600ms delay', () => {
    const playerAttack = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: MONSTER_ID,
      currentTurn: 1n,
    });
    const monsterMiss = makeOutcome({
      attackerId: MONSTER_ID,
      defenderId: PLAYER_ID,
      attackerDamageDelt: 0n,
      miss: [true],
      currentTurn: 1n,
    });

    const { result } = renderHook(() =>
      useCombatPacing({
        attackOutcomes: [playerAttack, monsterMiss],
        characterId: PLAYER_ID,
        isInBattle: true,
      }),
    );

    // Counterattack hidden even on miss
    expect(result.current.visibleOutcomes).toEqual([playerAttack]);
    expect(result.current.isCounterattackPending).toBe(true);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.visibleOutcomes).toEqual([playerAttack, monsterMiss]);
    expect(result.current.isCounterattackPending).toBe(false);
  });

  it('multiple turns arrive at once — only latest turn delayed', () => {
    const t1Player = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: MONSTER_ID,
      currentTurn: 1n,
    });
    const t1Monster = makeOutcome({
      attackerId: MONSTER_ID,
      defenderId: PLAYER_ID,
      attackerDamageDelt: 3n,
      currentTurn: 1n,
    });
    const t2Player = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: MONSTER_ID,
      currentTurn: 2n,
    });
    const t2Monster = makeOutcome({
      attackerId: MONSTER_ID,
      defenderId: PLAYER_ID,
      attackerDamageDelt: 7n,
      currentTurn: 2n,
    });

    const { result } = renderHook(() =>
      useCombatPacing({
        attackOutcomes: [t1Player, t1Monster, t2Player, t2Monster],
        characterId: PLAYER_ID,
        isInBattle: true,
      }),
    );

    // Turn 1 outcomes visible, turn 2 counterattack hidden
    expect(result.current.visibleOutcomes).toEqual([t1Player, t1Monster, t2Player]);
    expect(result.current.pendingCounterattackDamage).toBe(7n);
    expect(result.current.pendingTurn).toBe(2n);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.visibleOutcomes).toEqual([t1Player, t1Monster, t2Player, t2Monster]);
    expect(result.current.isCounterattackPending).toBe(false);
  });

  it('battle ends — state resets, all outcomes visible', () => {
    const playerAttack = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: MONSTER_ID,
      currentTurn: 1n,
    });
    const monsterAttack = makeOutcome({
      attackerId: MONSTER_ID,
      defenderId: PLAYER_ID,
      attackerDamageDelt: 5n,
      currentTurn: 1n,
    });

    const { result, rerender } = renderHook(
      ({ isInBattle }) =>
        useCombatPacing({
          attackOutcomes: [playerAttack, monsterAttack],
          characterId: PLAYER_ID,
          isInBattle,
        }),
      { initialProps: { isInBattle: true } },
    );

    expect(result.current.isCounterattackPending).toBe(true);

    // Battle ends
    rerender({ isInBattle: false });

    expect(result.current.isCounterattackPending).toBe(false);
    expect(result.current.isBattleResolutionPending).toBe(false);
    expect(result.current.pendingTurn).toBeNull();
  });

  it('safety timeout — force reveal at 1500ms', () => {
    const playerAttack = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: MONSTER_ID,
      currentTurn: 1n,
    });
    const monsterAttack = makeOutcome({
      attackerId: MONSTER_ID,
      defenderId: PLAYER_ID,
      attackerDamageDelt: 5n,
      currentTurn: 1n,
    });

    const { result } = renderHook(() =>
      useCombatPacing({
        attackOutcomes: [playerAttack, monsterAttack],
        characterId: PLAYER_ID,
        isInBattle: true,
      }),
    );

    expect(result.current.isCounterattackPending).toBe(true);

    // Skip past the 600ms delay, advance to safety timeout
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.isCounterattackPending).toBe(false);
    expect(result.current.visibleOutcomes).toEqual([playerAttack, monsterAttack]);
  });

  it('pendingCounterattackDamage returns correct value during delay, 0n after', () => {
    const playerAttack = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: MONSTER_ID,
      currentTurn: 1n,
    });
    const monsterAttack = makeOutcome({
      attackerId: MONSTER_ID,
      defenderId: PLAYER_ID,
      attackerDamageDelt: 42n,
      currentTurn: 1n,
    });

    const { result } = renderHook(() =>
      useCombatPacing({
        attackOutcomes: [playerAttack, monsterAttack],
        characterId: PLAYER_ID,
        isInBattle: true,
      }),
    );

    expect(result.current.pendingCounterattackDamage).toBe(42n);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.pendingCounterattackDamage).toBe(0n);
  });

  it('lethal counterattack stays pending after reveal so the finisher can play', () => {
    const playerAttack = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: MONSTER_ID,
      currentTurn: 1n,
    });
    const monsterAttack = makeOutcome({
      attackerId: MONSTER_ID,
      defenderId: PLAYER_ID,
      attackerDamageDelt: 42n,
      currentTurn: 1n,
      defenderDied: true,
    });

    const { result } = renderHook(() =>
      useCombatPacing({
        attackOutcomes: [playerAttack, monsterAttack],
        characterId: PLAYER_ID,
        isInBattle: true,
      }),
    );

    expect(result.current.isCounterattackPending).toBe(true);
    expect(result.current.isBattleResolutionPending).toBe(true);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.visibleOutcomes).toEqual([playerAttack, monsterAttack]);
    expect(result.current.isCounterattackPending).toBe(false);
    expect(result.current.isBattleResolutionPending).toBe(true);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(result.current.isBattleResolutionPending).toBe(false);
  });

  // --- Edge cases ---

  it('empty outcomes — no delay', () => {
    const { result } = renderHook(() =>
      useCombatPacing({
        attackOutcomes: [],
        characterId: PLAYER_ID,
        isInBattle: true,
      }),
    );

    expect(result.current.visibleOutcomes).toEqual([]);
    expect(result.current.isCounterattackPending).toBe(false);
  });

  it('no characterId — no filtering', () => {
    const playerAttack = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: MONSTER_ID,
      currentTurn: 1n,
    });
    const monsterAttack = makeOutcome({
      attackerId: MONSTER_ID,
      defenderId: PLAYER_ID,
      currentTurn: 1n,
    });

    const { result } = renderHook(() =>
      useCombatPacing({
        attackOutcomes: [playerAttack, monsterAttack],
        characterId: undefined,
        isInBattle: true,
      }),
    );

    expect(result.current.visibleOutcomes).toEqual([playerAttack, monsterAttack]);
    expect(result.current.isCounterattackPending).toBe(false);
  });

  it('not in battle — returns all outcomes, no delay', () => {
    const playerAttack = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: MONSTER_ID,
      currentTurn: 1n,
    });
    const monsterAttack = makeOutcome({
      attackerId: MONSTER_ID,
      defenderId: PLAYER_ID,
      currentTurn: 1n,
    });

    const { result } = renderHook(() =>
      useCombatPacing({
        attackOutcomes: [playerAttack, monsterAttack],
        characterId: PLAYER_ID,
        isInBattle: false,
      }),
    );

    expect(result.current.visibleOutcomes).toEqual([playerAttack, monsterAttack]);
    expect(result.current.isCounterattackPending).toBe(false);
  });
});
