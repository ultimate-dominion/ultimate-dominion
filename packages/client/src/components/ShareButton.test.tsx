import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChakraProvider } from '@chakra-ui/react';

import { ShareButton } from './ShareButton';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider>{children}</ChakraProvider>
);

describe('ShareButton', () => {
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders share and copy buttons', () => {
    render(<ShareButton text="Test" />, { wrapper });
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to X intent when canvas is unavailable', async () => {
    render(<ShareButton text="Slew the Basilisk" />, { wrapper });
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    // Canvas fails in jsdom → falls back to window.open X intent
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    const url = decodeURIComponent(openSpy.mock.calls[0][0] as string);
    expect(url).toContain('x.com/intent/tweet');
    expect(url).toContain('Slew the Basilisk');
    expect(url).toContain('#UltimateDominion');
  });

  it('includes share params in fallback URL', async () => {
    render(
      <ShareButton text="Test" shareParams={{ type: 'kill', monster: 'Basilisk' }} />,
      { wrapper },
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    const decoded = decodeURIComponent(openSpy.mock.calls[0][0] as string);
    expect(decoded).toContain('/s?');
    expect(decoded).toContain('type=kill');
    expect(decoded).toContain('monster=Basilisk');
  });

  it('renders with custom color accent', () => {
    const { container } = render(
      <ShareButton text="Test" colorAccent="#B85C3A" />,
      { wrapper },
    );
    expect(container.querySelector('button')).toBeTruthy();
  });
});
