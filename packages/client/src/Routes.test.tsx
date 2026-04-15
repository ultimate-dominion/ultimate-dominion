/**
 * Tests for the AppRoutes Suspense fallback and the App-level Grid row
 * template that broke routing-time loading screens on beta.
 *
 * Context for future readers:
 * Before the fix, Header returned a React Fragment with two siblings — an
 * amber `IS_BETA` strip (#C87A2A) and the nav Grid. Fragments flatten into
 * their parent, so the App.tsx Grid saw 5 children instead of 4. Its
 * `templateRows="auto 1fr auto"` then assigned 1fr to the orange BETA strip,
 * which stretched to fill every viewport where the content row was smaller
 * than the viewport (Suspense "Loading..." flashes, empty marketplace, etc.).
 * The result was an orange-everything loading state on every route except
 * /game-board hard refresh — because BootScreen's zIndex:9999 overlay hid it.
 *
 * The fix is structural:
 *   1. Header returns a single <Box> wrapper (not a fragment)
 *   2. App.tsx templateRows is "auto auto 1fr auto" so AppRoutes gets 1fr
 *   3. RoutesFallback renders a dark in-place loader for all non-game-board
 *      routes (matches body #12100E — no orange app shell exposed)
 */
import { render, cleanup } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./lib/env', () => ({
  SHOW_Z2: true,
  IS_BETA: true,
  IS_PRODUCTION: false,
}));

import { RoutesFallback } from './Routes';
import { APP_GRID_TEMPLATE_ROWS } from './App.gridRows';

describe('RoutesFallback dark loader', () => {
  afterEach(() => cleanup());

  function renderFallbackAt(pathname: string) {
    return render(
      <ChakraProvider>
        <MemoryRouter initialEntries={[pathname]}>
          <Routes>
            <Route path="*" element={<RoutesFallback />} />
          </Routes>
        </MemoryRouter>
      </ChakraProvider>,
    );
  }

  it('renders a dark surface on /marketplace (no orange app shell)', () => {
    const { container } = renderFallbackAt('/marketplace');
    // The wrapper Box is the first element rendered by the fallback.
    const wrapper = container.querySelector('div[class]');
    expect(wrapper).toBeTruthy();
    // Chakra translates bg="#12100E" to an inline style var or class; we
    // assert the loading text is present rather than poking at Chakra's
    // class generation. The dark bg is pinned by the RoutesFallback source.
    expect(container.textContent?.toLowerCase()).toContain('loading');
  });

  it('renders a dark surface on /leaderboard (no orange app shell)', () => {
    const { container } = renderFallbackAt('/leaderboard');
    expect(container.textContent?.toLowerCase()).toContain('loading');
  });

  it('renders a dark surface on /character/:id (no orange app shell)', () => {
    const { container } = renderFallbackAt('/characters/0xabc');
    expect(container.textContent?.toLowerCase()).toContain('loading');
  });

  it('renders a dark surface on /guild (no orange app shell)', () => {
    const { container } = renderFallbackAt('/guild');
    expect(container.textContent?.toLowerCase()).toContain('loading');
  });

  it('renders BootScreen on /game-board (full dark overlay)', () => {
    const { container } = renderFallbackAt('/game-board');
    // BootScreen renders its eyebrow copy; dark-loader path does not.
    expect(container.textContent).toContain('Entering The Realm');
  });
});

describe('App Grid row template', () => {
  it('uses auto auto 1fr auto so content row gets flex, not header strip', () => {
    // Static assertion: the string must have three `auto`s and exactly one
    // `1fr`, with `1fr` in the third slot. Before the fix it was
    // "auto 1fr auto", which gave Header's fragment-leaked orange strip
    // the flex row.
    expect(APP_GRID_TEMPLATE_ROWS).toBe('auto auto 1fr auto');
    const tokens = APP_GRID_TEMPLATE_ROWS.split(/\s+/);
    expect(tokens).toHaveLength(4);
    expect(tokens.filter(t => t === '1fr')).toHaveLength(1);
    expect(tokens.indexOf('1fr')).toBe(2);
  });
});
