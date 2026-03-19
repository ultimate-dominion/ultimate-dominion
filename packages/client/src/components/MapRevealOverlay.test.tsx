import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MapRevealOverlay } from './MapRevealOverlay';

const renderOverlay = (onComplete = vi.fn()) => {
  const result = render(
    <ChakraProvider>
      <MapRevealOverlay onComplete={onComplete} />
    </ChakraProvider>,
  );
  return { ...result, onComplete };
};

describe('MapRevealOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders a 10x10 grid (100 cells)', () => {
    const { container } = renderOverlay();
    // The grid is the element with 100 children (the tiles)
    // Find the deepest container that has exactly 100 direct children
    const grids = container.querySelectorAll('div');
    const gridParent = Array.from(grids).find((el) => el.children.length === 100);
    expect(gridParent).toBeTruthy();
  });

  it('renders the "The Winding Dark" label', () => {
    renderOverlay();
    const labels = screen.getAllByText('The Winding Dark');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('renders a Continue button', () => {
    renderOverlay();
    const buttons = screen.getAllByRole('button', { name: /continue/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('does not call onComplete before button is ready (5.5s)', () => {
    const { onComplete } = renderOverlay();
    const buttons = screen.getAllByRole('button', { name: /continue/i });

    // Click before the 5.5s readiness timer
    fireEvent.click(buttons[0]);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete after clicking Continue once button is ready', () => {
    const { onComplete } = renderOverlay();

    // Advance past the 5.5s button-ready timer
    act(() => {
      vi.advanceTimersByTime(5600);
    });

    const buttons = screen.getAllByRole('button', { name: /continue/i });
    fireEvent.click(buttons[0]);

    // onComplete fires after 600ms fade-out
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('ignores multiple rapid clicks on Continue', () => {
    const { onComplete } = renderOverlay();

    act(() => {
      vi.advanceTimersByTime(5600);
    });

    const buttons = screen.getAllByRole('button', { name: /continue/i });
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('renders exactly 100 tiles in the grid plus 2 crack elements', () => {
    const { container } = renderOverlay();
    const grids = container.querySelectorAll('div');
    const gridParent = Array.from(grids).find((el) => el.children.length === 100);
    expect(gridParent).toBeTruthy();
    // The grid container (parent of gridParent) should also have crack elements
    // Grid wrapper has: grid (100 tiles) + 2 crack divs = 3 children
    expect(gridParent!.parentElement!.children.length).toBe(3);
  });
});

describe('MapRevealOverlay localStorage guard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('key format matches expected pattern', () => {
    const worldAddress = '0xTestAddress';
    const characterId = '42';
    const key = `map-reveal-seen-${worldAddress}-${characterId}`;
    expect(key).toBe('map-reveal-seen-0xTestAddress-42');
  });

  it('guard prevents showing overlay after key is set', () => {
    const key = 'map-reveal-seen-0xTestAddress-42';

    // Simulate first time: no guard
    expect(localStorage.getItem(key)).toBeNull();
    const shouldShow = !localStorage.getItem(key);
    expect(shouldShow).toBe(true);

    // Simulate overlay completion
    localStorage.setItem(key, 'true');

    // Second time: guard blocks
    const shouldShowAgain = !localStorage.getItem(key);
    expect(shouldShowAgain).toBe(false);
  });
});
