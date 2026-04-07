import { render, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useContext, createContext } from 'react';

import { MovementProvider, useMovement } from './MovementContext';

// --- Mocks ---

const mockMove = vi.fn().mockResolvedValue({ success: true });
const mockAutoAdventure = vi.fn().mockResolvedValue({ success: true });
const mockExecute = vi.fn();
const mockRenderError = vi.fn();
const mockRenderWarning = vi.fn();

let mudState: Record<string, unknown> = {};
let battleState: Record<string, unknown> = {};
let characterState: Record<string, unknown> = {};
let mapState: Record<string, unknown> = {};
let chatState: Record<string, unknown> = {};

vi.mock('./MUDContext', () => ({
  useMUD: () => mudState,
}));

vi.mock('./BattleContext', () => ({
  useBattle: () => battleState,
}));

vi.mock('./CharacterContext', () => ({
  useCharacter: () => characterState,
}));

vi.mock('./MapContext', () => ({
  useMap: () => mapState,
}));

vi.mock('./ChatContext', () => ({
  useChat: () => chatState,
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/game' }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ renderError: mockRenderError, renderWarning: mockRenderWarning, renderSuccess: vi.fn() }),
}));

vi.mock('../hooks/useTransaction', () => ({
  useTransaction: () => ({
    execute: mockExecute,
    progress: { phase: 'idle', percent: 0, transitionMs: 0 },
    statusMessage: '',
    isLoading: false,
  }),
}));

vi.mock('../Routes', () => ({
  GAME_BOARD_PATH: '/game',
}));

// --- Helper to capture context value ---

let capturedContext: ReturnType<typeof useMovement> | null = null;

function ContextCapture() {
  capturedContext = useMovement();
  return null;
}

// --- Tests ---

describe('MovementContext', () => {
  beforeEach(() => {
    capturedContext = null;
    mockMove.mockClear();
    mockAutoAdventure.mockClear();
    mockExecute.mockClear();
    mockRenderError.mockClear();
    mockRenderWarning.mockClear();

    mudState = {
      delegatorAddress: '0xowner',
      systemCalls: { move: mockMove, autoAdventure: mockAutoAdventure },
    };
    battleState = { currentBattle: null };
    characterState = {
      character: { id: '0xplayer', level: 5n, name: 'TestHero' },
      isMoveEquipped: true,
    };
    mapState = {
      isSpawned: true,
      position: { x: 1, y: 1 },
    };
    chatState = { isMessageInputFocused: false };

    // mockExecute runs the callback it receives (catches throws like useTransaction does)
    mockExecute.mockImplementation(async (fn: () => Promise<unknown>) => {
      try {
        return await fn();
      } catch {
        return undefined;
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('calls move() when autoAdventureMode is off', async () => {
    render(
      <MovementProvider>
        <ContextCapture />
      </MovementProvider>,
    );

    expect(capturedContext).not.toBeNull();
    expect(capturedContext!.autoAdventureMode).toBe(false);

    await act(async () => {
      await capturedContext!.onMove('right');
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    // The execute callback should have called move, not autoAdventure
    expect(mockMove).toHaveBeenCalledWith('0xplayer', 'right');
    expect(mockAutoAdventure).not.toHaveBeenCalled();
  });

  it('always calls move() regardless of autoAdventureMode', async () => {
    // Auto adventure mode on — move is still used (autoFight is triggered separately by TileDetailsPanel)
    localStorage.setItem('ud_auto_adventure', 'true');

    render(
      <MovementProvider>
        <ContextCapture />
      </MovementProvider>,
    );

    expect(capturedContext!.autoAdventureMode).toBe(true);

    await act(async () => {
      await capturedContext!.onMove('up');
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockMove).toHaveBeenCalledWith('0xplayer', 'up');

    localStorage.removeItem('ud_auto_adventure');
  });

  it('does not move when at grid boundary', async () => {
    mapState = { isSpawned: true, position: { x: 9, y: 5 } };

    render(
      <MovementProvider>
        <ContextCapture />
      </MovementProvider>,
    );

    await act(async () => {
      await capturedContext!.onMove('right');
    });

    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockMove).not.toHaveBeenCalled();
  });

  it('shows error toast when move fails with error severity', async () => {
    mockMove.mockResolvedValue({ success: false, error: 'Character is locked and cannot be modified.' });

    render(
      <MovementProvider>
        <ContextCapture />
      </MovementProvider>,
    );

    await act(async () => {
      await capturedContext!.onMove('right');
    });

    expect(mockMove).toHaveBeenCalledWith('0xplayer', 'right');
    expect(mockRenderError).toHaveBeenCalledWith('Character is locked and cannot be modified.');
    expect(mockRenderWarning).not.toHaveBeenCalled();
  });

  it('shows warning toast when move fails with warning severity (stale state)', async () => {
    mockMove.mockResolvedValue({
      success: false,
      error: "You're moving too fast! Take a moment and try again.",
      severity: 'warning',
    });

    render(
      <MovementProvider>
        <ContextCapture />
      </MovementProvider>,
    );

    await act(async () => {
      await capturedContext!.onMove('right');
    });

    expect(mockMove).toHaveBeenCalledWith('0xplayer', 'right');
    expect(mockRenderWarning).toHaveBeenCalledWith("You're moving too fast! Take a moment and try again.");
    expect(mockRenderError).not.toHaveBeenCalled();
  });

  it('does not move when not spawned', async () => {
    mapState = { isSpawned: false, position: { x: 1, y: 1 } };

    render(
      <MovementProvider>
        <ContextCapture />
      </MovementProvider>,
    );

    await act(async () => {
      await capturedContext!.onMove('up');
    });

    expect(mockExecute).not.toHaveBeenCalled();
  });
});
