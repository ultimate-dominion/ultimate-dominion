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

vi.mock('howler', () => {
  const mockHowl = vi.fn().mockImplementation(() => ({
    play: mockPlay,
    stop: mockStop,
    fade: mockFade,
    unload: mockUnload,
    volume: mockVolume,
  }));
  return { Howl: mockHowl };
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

describe('SoundContext', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    mockUseMap.mockReturnValue({ currentZone: 1 });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

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
    expect(screen.getByTestId('status').textContent).toBe('on');
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('status').textContent).toBe('off');
    expect(localStorage.getItem('ud:sound-enabled')).toBe('false');
  });

  it('reads initial state from localStorage', () => {
    localStorage.setItem('ud:sound-enabled', 'true');
    renderWithProvider();
    expect(screen.getByTestId('status').textContent).toBe('on');
  });

  it('creates Howl for current zone when sound is enabled', async () => {
    const { Howl } = await import('howler');
    renderWithProvider();

    // Enable sound
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

    // Zone 1 playing — should have called play
    expect(mockPlay).toHaveBeenCalled();

    // Change to zone 2
    mockUseMap.mockReturnValue({ currentZone: 2 });
    rerender(
      <ChakraProvider>
        <SoundProvider>
          <TestConsumer />
        </SoundProvider>
      </ChakraProvider>,
    );

    // Should fade out old and fade in new
    expect(mockFade).toHaveBeenCalled();
    // New Howl created for zone 2
    expect(Howl).toHaveBeenCalledWith(
      expect.objectContaining({
        src: ['/audio/windy-peaks-mix.ogg'],
      }),
    );
  });

  it('stops all tracks when sound is disabled', () => {
    localStorage.setItem('ud:sound-enabled', 'true');
    renderWithProvider();

    expect(mockPlay).toHaveBeenCalled();

    // Disable sound
    fireEvent.click(screen.getByText('toggle'));
    expect(mockStop).toHaveBeenCalled();
  });

  it('auto-enables sound on authentication', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    renderWithProvider();
    expect(screen.getByTestId('status').textContent).toBe('on');
    expect(localStorage.getItem('ud:sound-enabled')).toBe('true');
  });

  it('does not auto-enable sound twice in the same session', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    renderWithProvider();
    expect(screen.getByTestId('status').textContent).toBe('on');

    // User manually toggles off
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('status').textContent).toBe('off');

    // Re-render — should NOT re-enable because session flag is set
    cleanup();
    renderWithProvider();
    expect(screen.getByTestId('status').textContent).toBe('off');
  });

  it('does not auto-enable if user previously had sound on (localStorage)', () => {
    localStorage.setItem('ud:sound-enabled', 'true');
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    renderWithProvider();
    expect(screen.getByTestId('status').textContent).toBe('on');
  });

  it('does not auto-enable when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    renderWithProvider();
    expect(screen.getByTestId('status').textContent).toBe('off');
  });
});
