import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
        src: ['/audio/cave-ambient.ogg'],
        loop: true,
      }),
    );
  });
});
