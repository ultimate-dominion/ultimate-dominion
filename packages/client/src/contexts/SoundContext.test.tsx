import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SoundProvider, useGameAudio } from './SoundContext';

// Mock howler — we don't want actual audio in tests
vi.mock('howler', () => {
  const mockHowl = vi.fn().mockImplementation(() => ({
    play: vi.fn(),
    stop: vi.fn(),
    unload: vi.fn(),
  }));
  return { Howl: mockHowl };
});

// Mock useAuth — default to not authenticated
const mockUseAuth = vi.fn().mockReturnValue({ isAuthenticated: false });
vi.mock('./AuthContext', () => ({
  useAuth: () => mockUseAuth(),
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

  it('creates Howl instance when sound is enabled', async () => {
    const { Howl } = await import('howler');
    renderWithProvider();

    // Enable sound
    fireEvent.click(screen.getByText('toggle'));

    expect(Howl).toHaveBeenCalledWith(
      expect.objectContaining({
        src: ['/audio/cave-melody.ogg'],
        loop: true,
      }),
    );
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
    // Sound already on from localStorage — auto-start shouldn't interfere
    expect(screen.getByTestId('status').textContent).toBe('on');
  });

  it('does not auto-enable when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    renderWithProvider();
    expect(screen.getByTestId('status').textContent).toBe('off');
  });
});
