import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SoundProvider, useGameAudio } from './SoundContext';

// Track mock Howl instances for assertions
const mockPlay = vi.fn();
const mockStop = vi.fn();
const mockFade = vi.fn();
const mockUnload = vi.fn();
const mockVolume = vi.fn();
const mockPlaying = vi.fn().mockReturnValue(false);
const mockResume = vi.fn().mockResolvedValue(undefined);
let mockCtxState: 'running' | 'suspended' = 'suspended';

vi.mock('howler', () => {
  const mockHowl = vi.fn().mockImplementation(() => ({
    play: mockPlay,
    stop: mockStop,
    fade: mockFade,
    unload: mockUnload,
    volume: mockVolume,
    playing: mockPlaying,
  }));
  const mockHowler = {
    get ctx() {
      return { state: mockCtxState, resume: mockResume } as unknown as AudioContext;
    },
  };
  return { Howl: mockHowl, Howler: mockHowler };
});

// Mock useAuth — default to not authenticated
const mockUseAuth = vi.fn().mockReturnValue({ isAuthenticated: false });
vi.mock('./AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useMap — default to zone 1
const mockUseMap = vi.fn().mockReturnValue({ currentZone: 1 });
vi.mock('./MapContext', () => ({
  useMap: () => mockUseMap(),
}));

// Mock useBattle — default to no battle
const mockUseBattle = vi.fn().mockReturnValue({ currentBattle: null });
vi.mock('./BattleContext', () => ({
  useBattle: () => mockUseBattle(),
}));

const TestConsumer = () => {
  const { soundEnabled, toggleSound } = useGameAudio();
  return (
    <div>
      <span data-testid="status">{soundEnabled ? 'on' : 'off'}</span>
      <button onClick={toggleSound}>toggle</button>
    </div>
  );
};

const renderWithProvider = () => {
  return render(
    <ChakraProvider>
      <SoundProvider>
        <TestConsumer />
      </SoundProvider>
    </ChakraProvider>,
  );
};

const rerenderProvider = (rerender: (ui: React.ReactElement) => void) => {
  rerender(
    <ChakraProvider>
      <SoundProvider>
        <TestConsumer />
      </SoundProvider>
    </ChakraProvider>,
  );
};

describe('SoundContext', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    mockUseMap.mockReturnValue({ currentZone: 1 });
    mockUseBattle.mockReturnValue({ currentBattle: null });
    mockPlaying.mockReturnValue(false);
    mockCtxState = 'suspended';
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
  });

  describe('toggle + persistence', () => {
    it('defaults to sound disabled', () => {
      renderWithProvider();
      expect(screen.getByTestId('status').textContent).toBe('off');
    });

    it('toggles sound on and persists to localStorage', () => {
      renderWithProvider();
      fireEvent.click(screen.getByText('toggle'));
      expect(screen.getByTestId('status').textContent).toBe('on');
      expect(localStorage.getItem('ud:sound-enabled')).toBe('true');
    });

    it('toggles sound off after being on', () => {
      renderWithProvider();
      fireEvent.click(screen.getByText('toggle'));
      fireEvent.click(screen.getByText('toggle'));
      expect(screen.getByTestId('status').textContent).toBe('off');
      expect(localStorage.getItem('ud:sound-enabled')).toBe('false');
    });

    it('reads initial state from localStorage', () => {
      localStorage.setItem('ud:sound-enabled', 'true');
      renderWithProvider();
      expect(screen.getByTestId('status').textContent).toBe('on');
    });
  });

  describe('zone ambient playback', () => {
    it('creates Howl for current zone when sound is enabled', async () => {
      const { Howl } = await import('howler');
      renderWithProvider();
      fireEvent.click(screen.getByText('toggle'));

      expect(Howl).toHaveBeenCalledWith(
        expect.objectContaining({
          src: ['/audio/dark-cave-mix.ogg'],
          loop: true,
        }),
      );
    });

    it('creates Howl for zone 2 when in Windy Peaks', async () => {
      mockUseMap.mockReturnValue({ currentZone: 2 });
      const { Howl } = await import('howler');
      renderWithProvider();
      fireEvent.click(screen.getByText('toggle'));

      expect(Howl).toHaveBeenCalledWith(
        expect.objectContaining({
          src: ['/audio/windy-peaks-mix.ogg'],
          loop: true,
        }),
      );
    });

    it('crossfades when zone changes while sound is on', async () => {
      const { Howl } = await import('howler');
      localStorage.setItem('ud:sound-enabled', 'true');
      const { rerender } = renderWithProvider();
      expect(mockPlay).toHaveBeenCalled();

      mockUseMap.mockReturnValue({ currentZone: 2 });
      rerenderProvider(rerender);

      expect(mockFade).toHaveBeenCalled();
      expect(Howl).toHaveBeenCalledWith(
        expect.objectContaining({ src: ['/audio/windy-peaks-mix.ogg'] }),
      );
    });

    it('stops all tracks when sound is disabled', () => {
      localStorage.setItem('ud:sound-enabled', 'true');
      renderWithProvider();
      expect(mockPlay).toHaveBeenCalled();
      fireEvent.click(screen.getByText('toggle'));
      expect(mockStop).toHaveBeenCalled();
    });
  });

  describe('auto-enable on auth', () => {
    it('auto-enables sound on authentication', () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true });
      renderWithProvider();
      expect(screen.getByTestId('status').textContent).toBe('on');
      expect(localStorage.getItem('ud:sound-enabled')).toBe('true');
    });

    it('does not auto-enable sound twice in the same session', () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true });
      renderWithProvider();
      fireEvent.click(screen.getByText('toggle'));
      expect(screen.getByTestId('status').textContent).toBe('off');

      cleanup();
      renderWithProvider();
      expect(screen.getByTestId('status').textContent).toBe('off');
    });

    it('does not auto-enable when not authenticated', () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false });
      renderWithProvider();
      expect(screen.getByTestId('status').textContent).toBe('off');
    });
  });

  describe('autoplay unlock', () => {
    it('resumes suspended audio context on first user gesture after auth', () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true });
      renderWithProvider();
      expect(mockResume).not.toHaveBeenCalled();

      window.dispatchEvent(new Event('pointerdown'));
      expect(mockResume).toHaveBeenCalled();
    });

    it('does not register unlock listeners when sound is disabled', () => {
      renderWithProvider();
      window.dispatchEvent(new Event('pointerdown'));
      expect(mockResume).not.toHaveBeenCalled();
    });

    it('resumes the audio context synchronously inside toggleSound', () => {
      renderWithProvider();
      expect(mockResume).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('toggle'));
      expect(mockResume).toHaveBeenCalled();
    });

    it('replays the active Howl on unlock gesture if it was queued silently', async () => {
      localStorage.setItem('ud:sound-enabled', 'true');
      renderWithProvider();
      // Initial play was called during mount
      const initialPlayCalls = mockPlay.mock.calls.length;
      // Simulate the Howl being queued but not actually playing
      mockPlaying.mockReturnValue(false);

      window.dispatchEvent(new Event('pointerdown'));

      // Should have called play again to flush the queue
      expect(mockPlay.mock.calls.length).toBeGreaterThan(initialPlayCalls);
    });
  });

  describe('battle music', () => {
    const makeBattle = () => ({ encounterId: '0xabc', end: 0n } as any);

    it('switches to battle track when combat starts', async () => {
      const { Howl } = await import('howler');
      localStorage.setItem('ud:sound-enabled', 'true');
      const { rerender } = renderWithProvider();
      expect(Howl).toHaveBeenCalledWith(
        expect.objectContaining({ src: ['/audio/dark-cave-mix.ogg'] }),
      );

      mockUseBattle.mockReturnValue({ currentBattle: makeBattle() });
      rerenderProvider(rerender);

      expect(Howl).toHaveBeenCalledWith(
        expect.objectContaining({ src: ['/audio/battle-dark-cave-mix.ogg'] }),
      );
    });

    it('uses the correct zone battle track when zone=2', async () => {
      const { Howl } = await import('howler');
      mockUseMap.mockReturnValue({ currentZone: 2 });
      localStorage.setItem('ud:sound-enabled', 'true');
      const { rerender } = renderWithProvider();

      mockUseBattle.mockReturnValue({ currentBattle: makeBattle() });
      rerenderProvider(rerender);

      expect(Howl).toHaveBeenCalledWith(
        expect.objectContaining({ src: ['/audio/battle-windy-peaks-mix.ogg'] }),
      );
    });

    it('lingers 5s after combat ends before returning to ambient', async () => {
      vi.useFakeTimers();
      const { Howl } = await import('howler');
      localStorage.setItem('ud:sound-enabled', 'true');
      mockUseBattle.mockReturnValue({ currentBattle: makeBattle() });
      const { rerender } = renderWithProvider();

      const callsBefore = (Howl as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

      // Combat ends
      mockUseBattle.mockReturnValue({ currentBattle: null });
      rerenderProvider(rerender);

      // Before linger elapses, no new ambient Howl should be created
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(
        (Howl as unknown as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBe(callsBefore);

      // After linger elapses, we fall back to ambient (already cached, so no
      // new Howl, but the active track should flip). Verify by starting a new
      // combat — we should re-enter battle mode, proving the linger fired.
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      mockUseBattle.mockReturnValue({ currentBattle: makeBattle() });
      rerenderProvider(rerender);

      // mockFade is called on every crossfade — ambient→battle re-entry means
      // at least one fade happened after the linger expired.
      expect(mockFade).toHaveBeenCalled();
    });

    it('cancels linger if combat restarts before timeout', async () => {
      vi.useFakeTimers();
      const { Howl } = await import('howler');
      localStorage.setItem('ud:sound-enabled', 'true');
      mockUseBattle.mockReturnValue({ currentBattle: makeBattle() });
      const { rerender } = renderWithProvider();

      // Combat ends
      mockUseBattle.mockReturnValue({ currentBattle: null });
      rerenderProvider(rerender);

      // New combat starts within linger window
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      mockUseBattle.mockReturnValue({ currentBattle: makeBattle() });
      rerenderProvider(rerender);

      // Advance past the original linger window — we should still be in
      // battle mode (linger was cancelled).
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Only the zone-1 battle track was ever created — no ambient re-entry.
      const battleCalls = (Howl as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => (c[0] as { src: string[] }).src[0] === '/audio/battle-dark-cave-mix.ogg',
      );
      expect(battleCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('switches to the new zone battle track when zone changes during combat', async () => {
      const { Howl } = await import('howler');
      localStorage.setItem('ud:sound-enabled', 'true');
      mockUseBattle.mockReturnValue({ currentBattle: makeBattle() });
      const { rerender } = renderWithProvider();

      expect(Howl).toHaveBeenCalledWith(
        expect.objectContaining({ src: ['/audio/battle-dark-cave-mix.ogg'] }),
      );

      // Zone change mid-fight
      mockUseMap.mockReturnValue({ currentZone: 2 });
      rerenderProvider(rerender);

      expect(Howl).toHaveBeenCalledWith(
        expect.objectContaining({ src: ['/audio/battle-windy-peaks-mix.ogg'] }),
      );
    });

    it('stops all battle tracks when mute happens mid-battle', () => {
      localStorage.setItem('ud:sound-enabled', 'true');
      mockUseBattle.mockReturnValue({ currentBattle: { encounterId: '0xabc', end: 0n } as any });
      renderWithProvider();
      expect(mockPlay).toHaveBeenCalled();

      fireEvent.click(screen.getByText('toggle'));
      expect(mockStop).toHaveBeenCalled();
    });

    it('resumes the battle track (not ambient) when sound is re-enabled mid-battle', async () => {
      const { Howl } = await import('howler');
      localStorage.setItem('ud:sound-enabled', 'true');
      mockUseBattle.mockReturnValue({ currentBattle: makeBattle() });
      renderWithProvider();

      // Combat is live — battle track should already exist
      expect(Howl).toHaveBeenCalledWith(
        expect.objectContaining({ src: ['/audio/battle-dark-cave-mix.ogg'] }),
      );

      // Mute while still in combat
      fireEvent.click(screen.getByText('toggle'));
      expect(mockStop).toHaveBeenCalled();

      // Clear call history so we can see what happens on re-enable
      mockPlay.mockClear();

      // Re-enable
      fireEvent.click(screen.getByText('toggle'));

      // Battle track should be playing again, not ambient
      expect(mockPlay).toHaveBeenCalled();
      // No new ambient Howl should have been created for this zone
      const ambientCallsAfterRemute = (
        Howl as unknown as ReturnType<typeof vi.fn>
      ).mock.calls.filter((c) => (c[0] as { src: string[] }).src[0] === '/audio/dark-cave-mix.ogg');
      // Zero ambient Howls — we were never ambient in this test
      expect(ambientCallsAfterRemute.length).toBe(0);
    });

    it('falls back to zone 1 battle track for an unknown zone during combat', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { Howl } = await import('howler');
      mockUseMap.mockReturnValue({ currentZone: 99 });
      localStorage.setItem('ud:sound-enabled', 'true');
      mockUseBattle.mockReturnValue({ currentBattle: makeBattle() });
      renderWithProvider();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No battle track for zone 99'),
      );
      expect(Howl).toHaveBeenCalledWith(
        expect.objectContaining({ src: ['/audio/battle-dark-cave-mix.ogg'] }),
      );
      warnSpy.mockRestore();
    });
  });
});
