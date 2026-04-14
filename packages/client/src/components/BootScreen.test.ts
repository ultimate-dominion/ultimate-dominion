/**
 * Tests for the game-boot gate that decides whether AppInner should render
 * the BootScreen instead of the full app shell.
 *
 * AppInner (App.tsx) has ~30 context dependencies, so instead of rendering
 * it in a test we lift the predicate out as a pure function and assert its
 * behavior. The production code and this mirror must stay in sync — search
 * for the gate in App.tsx that uses: ready, isSynced, gameStoreHydrated,
 * gameBoardChunkLoaded.
 */
import { describe, expect, it } from 'vitest';

import { GAME_BOARD_PATH, HOME_PATH } from '../Routes';

function shouldShowBootScreen(
  pathname: string,
  ready: boolean,
  isSynced: boolean,
  gameStoreHydrated: boolean,
  gameBoardChunkLoaded: boolean,
): boolean {
  return (
    pathname === GAME_BOARD_PATH &&
    (!ready || !isSynced || !gameStoreHydrated || !gameBoardChunkLoaded)
  );
}

describe('AppInner BootScreen gate', () => {
  it('shows BootScreen on /game-board when MUD is not ready', () => {
    expect(shouldShowBootScreen(GAME_BOARD_PATH, false, false, false, false)).toBe(true);
  });

  it('shows BootScreen on /game-board when ready but not synced', () => {
    // Refresh window where setupPromise has resolved (ready=true) but the
    // wallet/burner path has not completed (isSynced=false).
    expect(shouldShowBootScreen(GAME_BOARD_PATH, true, false, false, false)).toBe(true);
  });

  it('shows BootScreen on /game-board when synced but setup not ready', () => {
    // Defensive: an impossible-in-practice combination today, but the gate
    // must still block if any signal is false. Pins the OR semantics.
    expect(shouldShowBootScreen(GAME_BOARD_PATH, false, true, true, true)).toBe(true);
  });

  it('shows BootScreen on /game-board when ready+synced but gameStore NOT hydrated', () => {
    // MUD wallet path is complete so the old gate would release, but the
    // network snapshot has not yet hydrated Zustand — GameBoard would paint
    // empty/partial and snap-down once character data arrives.
    expect(shouldShowBootScreen(GAME_BOARD_PATH, true, true, false, true)).toBe(true);
  });

  it('shows BootScreen on /game-board when everything is ready but GameBoard chunk NOT loaded', () => {
    // The exact window this signal covers: MUD is up, gameStore has hydrated,
    // but the lazy-loaded GameBoard module is still downloading. Without this
    // gate, AppRoutes would render its Suspense fallback (the orange shell +
    // "Loading..." VStack) between gate release and GameBoard paint.
    expect(shouldShowBootScreen(GAME_BOARD_PATH, true, true, true, false)).toBe(true);
  });

  it('releases to normal render on /game-board only when ALL four signals are true', () => {
    expect(shouldShowBootScreen(GAME_BOARD_PATH, true, true, true, true)).toBe(false);
  });

  it('does NOT gate Welcome page even when nothing is ready', () => {
    // Welcome (HOME_PATH) must paint immediately — it's the logged-out
    // landing and never needs game state.
    expect(shouldShowBootScreen(HOME_PATH, false, false, false, false)).toBe(false);
  });

  it('does NOT gate Marketplace/other routes while loading', () => {
    // Scope is intentionally narrow to /game-board. Other authenticated
    // routes still have their own AppRoutes Suspense fallback.
    expect(shouldShowBootScreen('/marketplace', false, false, false, false)).toBe(false);
    expect(shouldShowBootScreen('/leaderboard', false, false, false, false)).toBe(false);
    expect(shouldShowBootScreen('/privacy', false, false, false, false)).toBe(false);
  });

  it('does NOT gate Welcome even if game is fully ready', () => {
    expect(shouldShowBootScreen(HOME_PATH, true, true, true, true)).toBe(false);
  });

  it('matches GAME_BOARD_PATH exactly, not as prefix', () => {
    // If we ever add /game-board/foo, we want the gate to still decide per
    // full pathname — this test documents the current exact-match behavior.
    expect(shouldShowBootScreen('/game-board/foo', false, false, false, false)).toBe(false);
  });
});
