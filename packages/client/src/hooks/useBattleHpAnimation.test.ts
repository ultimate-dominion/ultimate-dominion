import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useBattleHpAnimation } from './useBattleHpAnimation';

describe('useBattleHpAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Existing behavior ---

  it('displays actualHp when no DoT', () => {
    const { result } = renderHook(() =>
      useBattleHpAnimation({
        actualHp: 100n,
        dotDamage: 0n,
        dotTurnNumber: 0n,
        isInBattle: true,
      }),
    );

    expect(result.current.displayedHp).toBe(100n);
    expect(result.current.isDotTicking).toBe(false);
  });

  it('two-step DoT animation: weapon damage first, then DoT after 800ms', () => {
    const { result } = renderHook(() =>
      useBattleHpAnimation({
        actualHp: 80n, // actual = 80 (took 10 weapon + 10 DoT)
        dotDamage: 10n,
        dotTurnNumber: 1n,
        isInBattle: true,
      }),
    );

    // Step 1: HP shows weapon damage only (holds back DoT)
    expect(result.current.displayedHp).toBe(90n); // 80 + 10 = 90
    expect(result.current.isDotTicking).toBe(false);

    // Step 2: after 800ms, drops to actual HP (DoT fires)
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(result.current.displayedHp).toBe(80n);
    expect(result.current.isDotTicking).toBe(true);

    // Ticking indicator clears after 800ms more
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(result.current.isDotTicking).toBe(false);
  });

  it('safety timeout snaps to actualHp at 2000ms', () => {
    const { result } = renderHook(() =>
      useBattleHpAnimation({
        actualHp: 50n,
        dotDamage: 15n,
        dotTurnNumber: 1n,
        isInBattle: true,
      }),
    );

    expect(result.current.displayedHp).toBe(65n);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.displayedHp).toBe(50n);
    expect(result.current.isDotTicking).toBe(false);
  });

  it('resets on battle exit', () => {
    const { result, rerender } = renderHook(
      ({ isInBattle, actualHp }) =>
        useBattleHpAnimation({
          actualHp,
          dotDamage: 10n,
          dotTurnNumber: 1n,
          isInBattle,
        }),
      { initialProps: { isInBattle: true, actualHp: 80n } },
    );

    expect(result.current.displayedHp).toBe(90n); // holding DoT

    rerender({ isInBattle: false, actualHp: 80n });

    expect(result.current.displayedHp).toBe(80n);
    expect(result.current.isDotTicking).toBe(false);
  });

  // --- New: mid-animation actualHp change (pacing introduces this) ---

  it('mid-animation actualHp change cancels old timeouts and snaps to new value', () => {
    const { result, rerender } = renderHook(
      ({ actualHp, dotDamage, dotTurnNumber }) =>
        useBattleHpAnimation({
          actualHp,
          dotDamage,
          dotTurnNumber,
          isInBattle: true,
        }),
      { initialProps: { actualHp: 90n, dotDamage: 10n, dotTurnNumber: 1n } },
    );

    // Step 1 of DoT animation: showing 100 (90 + 10)
    expect(result.current.displayedHp).toBe(100n);

    // At T+600ms, pacing changes actualHp (counterattack reveals, dropping HP further)
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Rerender with new actualHp and no DoT for this update
    rerender({ actualHp: 70n, dotDamage: 0n, dotTurnNumber: 1n });

    // Should snap to new value, not the stale DoT timeout value
    expect(result.current.displayedHp).toBe(70n);

    // Advance past old timeout — should NOT overwrite with stale 90n
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.displayedHp).toBe(70n);
  });

  it('does not animate same turn twice', () => {
    const { result, rerender } = renderHook(
      ({ actualHp }) =>
        useBattleHpAnimation({
          actualHp,
          dotDamage: 10n,
          dotTurnNumber: 1n,
          isInBattle: true,
        }),
      { initialProps: { actualHp: 80n } },
    );

    // First render: animates
    expect(result.current.displayedHp).toBe(90n);

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(result.current.displayedHp).toBe(80n);

    // Re-render with same turn number but different HP
    rerender({ actualHp: 75n });

    // Should snap directly, not re-animate the DoT
    expect(result.current.displayedHp).toBe(75n);
  });
});
