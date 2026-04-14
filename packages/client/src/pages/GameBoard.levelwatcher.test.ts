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
  // Preserve the signal while a modal blocks so a later re-run can still fire.
  // Only advance the ref when we actually fire the modal or level did not
  // increase.
  if (currentLevel > lastSeenLevel) {
    if (!isLevelUpModalOpen && !isBattleOutcomeModalOpen) {
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

  it('preserves lastSeenLevel when LevelUpModal blocks — ref does NOT advance', () => {
    const onOpen = vi.fn();
    const nextRef = runLevelWatcher(6, 5, true, false, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
    expect(nextRef).toBe(5);
  });

  it('fires on re-run after BattleOutcomeModal closes (end-to-end battle-block sequence)', () => {
    const onOpen = vi.fn();
    // Step 1: player levels up mid-battle, BattleOutcomeModal is open.
    let ref: number | null = 5;
    ref = runLevelWatcher(6, ref, false, true, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
    expect(ref).toBe(5); // ref preserved
    // Step 2: BattleOutcomeModal closes, useEffect re-runs with same level.
    ref = runLevelWatcher(6, ref, false, false, onOpen);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(ref).toBe(6); // ref finally advances
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
