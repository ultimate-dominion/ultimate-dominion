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
  if (currentLevel > lastSeenLevel && !isLevelUpModalOpen && !isBattleOutcomeModalOpen) {
    onOpenLevelUpModal();
    return currentLevel;
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

  it('does not fire when BattleOutcomeModal is open (BattleOutcomeModal will trigger it on close)', () => {
    const onOpen = vi.fn();
    runLevelWatcher(6, 5, false, /* isBattleOutcomeModalOpen */ true, onOpen);
    expect(onOpen).not.toHaveBeenCalled();
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
