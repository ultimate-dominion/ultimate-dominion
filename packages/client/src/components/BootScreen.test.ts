/**
 * Tests for the game-boot gate that decides whether AppInner should render
 * the BootScreen instead of the full app shell.
 *
 * AppInner (App.tsx) has ~30 context dependencies, so instead of rendering
 * it in a test we lift the predicate out as a pure function and assert its
 * behavior. The production code and this mirror must stay in sync — search
 * for `pathname === GAME_BOARD_PATH && (!ready || !isSynced)` in App.tsx.
 */
import { describe, expect, it } from 'vitest';

import { GAME_BOARD_PATH, HOME_PATH } from '../Routes';

function shouldShowBootScreen(
  pathname: string,
  ready: boolean,
  isSynced: boolean,
): boolean {
  return pathname === GAME_BOARD_PATH && (!ready || !isSynced);
}

describe('AppInner BootScreen gate', () => {
  it('shows BootScreen on /game-board when MUD is not ready', () => {
    expect(shouldShowBootScreen(GAME_BOARD_PATH, false, false)).toBe(true);
  });

  it('shows BootScreen on /game-board when ready but not synced', () => {
    // Covers the refresh window where setupPromise has resolved (ready=true)
    // but the wallet/burner path has not completed (isSynced=false). This is
    // the exact moment the orange shell used to flash before the fix.
    expect(shouldShowBootScreen(GAME_BOARD_PATH, true, false)).toBe(true);
  });

  it('shows BootScreen on /game-board when synced but setup not ready', () => {
    // Defensive: an impossible-in-practice combination today, but the gate
    // must still block if either signal is false. Pins the OR semantics.
    expect(shouldShowBootScreen(GAME_BOARD_PATH, false, true)).toBe(true);
  });

  it('releases to normal render on /game-board when fully ready', () => {
    expect(shouldShowBootScreen(GAME_BOARD_PATH, true, true)).toBe(false);
  });

  it('does NOT gate Welcome page even when MUD is not ready', () => {
    // Welcome (HOME_PATH) must paint immediately — it's the logged-out
    // landing and never needs game state.
    expect(shouldShowBootScreen(HOME_PATH, false, false)).toBe(false);
  });

  it('does NOT gate Marketplace/other routes while loading', () => {
    // Scope is intentionally narrow to /game-board. Other authenticated
    // routes still have their own AppRoutes Suspense fallback.
    expect(shouldShowBootScreen('/marketplace', false, false)).toBe(false);
    expect(shouldShowBootScreen('/leaderboard', false, false)).toBe(false);
    expect(shouldShowBootScreen('/privacy', false, false)).toBe(false);
  });

  it('does NOT gate Welcome even if game is ready', () => {
    expect(shouldShowBootScreen(HOME_PATH, true, true)).toBe(false);
  });

  it('matches GAME_BOARD_PATH exactly, not as prefix', () => {
    // If we ever add /game-board/foo, we want the gate to still decide per
    // full pathname — this test documents the current exact-match behavior.
    expect(shouldShowBootScreen('/game-board/foo', false, false)).toBe(false);
  });
});
