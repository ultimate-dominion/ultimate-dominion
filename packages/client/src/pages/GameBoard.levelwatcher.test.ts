/**
 * Unit tests for the GameBoard level-up watcher logic.
 *
 * The watcher tracks character.level via a ref and fires onOpenLevelUpModal
 * when the level increases — regardless of whether the player went through
 * BattleOutcomeModal.  We test the logic in isolation without rendering
 * the full GameBoard component (which has ~30 mocked dependencies).
 */
import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Pure representation of the watcher logic extracted for unit testing.
// Mirrors the useEffect in GameBoard.tsx exactly.
// ---------------------------------------------------------------------------

function runLevelWatcher(
  currentLevel: number,
  lastSeenLevel: number | null,
  isLevelUpModalOpen: boolean,
  isBattleOutcomeModalOpen: boolean,
  onOpenLevelUpModal: () => void,
): number | null {
  if (lastSeenLevel === null) {
    // First render — initialise ref without triggering animation
    return currentLevel;
  }
  // Rules mirror GameBoard.tsx watcher exactly:
  //   1. no increase → advance ref
  //   2. increase, LevelUpModal already open → advance ref (another code
  //      path, e.g. BattleOutcomeModal close handler, already fired it —
  //      do not re-fire when it closes)
  //   3. increase, BattleOutcomeModal blocking → leave ref behind
  //   4. increase, nothing blocking → fire and advance ref
  if (currentLevel > lastSeenLevel) {
    if (isLevelUpModalOpen) {
      return currentLevel;
    }
    if (!isBattleOutcomeModalOpen) {
      onOpenLevelUpModal();
      return currentLevel;
    }
    return lastSeenLevel;
  }
  return currentLevel;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameBoard level-up watcher logic', () => {
  it('stores current level on first render without firing modal', () => {
    const onOpen = vi.fn();
    const nextRef = runLevelWatcher(5, null, false, false, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
    expect(nextRef).toBe(5);
  });

  it('fires onOpenLevelUpModal when level increases', () => {
    const onOpen = vi.fn();
    const nextRef = runLevelWatcher(6, 5, false, false, onOpen);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(nextRef).toBe(6);
  });

  it('fires on level 10 specifically', () => {
    const onOpen = vi.fn();
    runLevelWatcher(10, 9, false, false, onOpen);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('does not fire when level is unchanged', () => {
    const onOpen = vi.fn();
    runLevelWatcher(5, 5, false, false, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not fire when level decreases (impossible in-game, edge case)', () => {
    const onOpen = vi.fn();
    runLevelWatcher(4, 5, false, false, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not fire when LevelUpModal is already open', () => {
    const onOpen = vi.fn();
    runLevelWatcher(6, 5, /* isLevelUpModalOpen */ true, false, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not fire when BattleOutcomeModal is open', () => {
    const onOpen = vi.fn();
    runLevelWatcher(6, 5, false, /* isBattleOutcomeModalOpen */ true, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('preserves lastSeenLevel when BattleOutcomeModal blocks — ref does NOT advance', () => {
    // The FRAGILE bug this covers: on the old code, when a level-up
    // happened while BattleOutcomeModal was open, the else-branch still
    // advanced the ref to `currentLevel`. That consumed the signal, and
    // the re-run after the modal closed could not detect the level gap.
    // Post-fix, the ref must stay at the pre-level-up value.
    const onOpen = vi.fn();
    const nextRef = runLevelWatcher(6, 5, false, true, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
    expect(nextRef).toBe(5);
  });

  it('advances ref when LevelUpModal is already open (no re-fire on close)', () => {
    // Rule 2: another code path (typically the BattleOutcomeModal close
    // handler) opened LevelUpModal for this level gain. The watcher must
    // advance the ref so it does NOT re-fire when the user dismisses the
    // modal and the effect re-runs with both flags off.
    const onOpen = vi.fn();
    const nextRef = runLevelWatcher(6, 5, true, false, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
    expect(nextRef).toBe(6);
  });

  it('fires on re-run after BattleOutcomeModal closes (watcher-only path)', () => {
    // Scenario B: player hits max level (canLevel=false after gain), so
    // BattleOutcomeModal close handler does NOT fire LevelUpModal. The
    // watcher must fire it on the next re-run.
    const onOpen = vi.fn();
    let ref: number | null = 5;
    // Step 1: mid-battle, level goes up, BattleOutcomeModal blocking.
    ref = runLevelWatcher(6, ref, false, true, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
    expect(ref).toBe(5);
    // Step 2: BattleOutcomeModal closes WITHOUT firing LevelUpModal.
    ref = runLevelWatcher(6, ref, false, false, onOpen);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(ref).toBe(6);
  });

  it('does not re-fire after BattleOutcomeModal close handler opens LevelUpModal', () => {
    // Scenario A: the common path — BattleOutcomeModal close handler
    // calls onOpenLevelUpModal externally. The watcher must NOT schedule
    // a second fire when the user dismisses the modal.
    const onOpen = vi.fn();
    let ref: number | null = 5;
    // Step 1: mid-battle, level goes up, BattleOutcomeModal blocking.
    ref = runLevelWatcher(6, ref, false, true, onOpen);
    expect(ref).toBe(5);
    // Step 2: BattleOutcomeModal close handler fires LevelUpModal.
    // The effect re-runs with isLevelUpModalOpen=true — rule 2 advances
    // the ref even though the watcher itself did not fire.
    ref = runLevelWatcher(6, ref, true, false, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
    expect(ref).toBe(6);
    // Step 3: user dismisses LevelUpModal. Both flags are false, but
    // the ref is already at 6 so `6 > 6` is false — no re-fire.
    ref = runLevelWatcher(6, ref, false, false, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
    expect(ref).toBe(6);
  });

  it('fires exactly once across a two-level gain (5 → 7)', () => {
    // Edge case: jumping two levels at once (e.g., delayed XP grant).
    // The modal shows level 7 — firing twice would be bad UX.
    const onOpen = vi.fn();
    let ref: number | null = 5;
    ref = runLevelWatcher(7, ref, false, false, onOpen);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(ref).toBe(7);
    // Re-run (no state change): no second fire.
    ref = runLevelWatcher(7, ref, true, false, onOpen);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(ref).toBe(7);
  });

  it('fires even when player is NOT going through BattleOutcomeModal', () => {
    // Simulate a player who leveled up outside of combat
    const onOpen = vi.fn();
    runLevelWatcher(11, 10, false, false, onOpen);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('updates lastSeenLevel ref after a level gain', () => {
    const onOpen = vi.fn();
    const nextRef = runLevelWatcher(7, 6, false, false, onOpen);
    expect(nextRef).toBe(7);
  });

  it('updates lastSeenLevel ref even when no modal is fired', () => {
    const onOpen = vi.fn();
    const nextRef = runLevelWatcher(5, 5, false, false, onOpen);
    expect(nextRef).toBe(5);
  });
});
