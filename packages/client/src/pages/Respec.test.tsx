import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { Respec } from './Respec';

let mockIsAuthenticated = true;
let mockIsConnecting = false;
const mockNavigate = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    isConnecting: mockIsConnecting,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../components/RespecPanel', () => ({
  RespecPanel: () => <div data-testid="respec-panel-stub">stub</div>,
}));

vi.mock('../components/PolygonalCard', () => ({
  PolygonalCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual<typeof import('@chakra-ui/react')>('@chakra-ui/react');
  return {
    ...actual,
    Box: ({ children }: any) => <div>{children}</div>,
    Button: ({ children, onClick }: any) => (
      <button onClick={onClick}>{children}</button>
    ),
    Heading: ({ children }: any) => <h1>{children}</h1>,
    HStack: ({ children }: any) => <div>{children}</div>,
    Spacer: () => <span />,
    Text: ({ children }: any) => <span>{children}</span>,
    VStack: ({ children }: any) => <div>{children}</div>,
  };
});

describe('Respec page', () => {
  beforeEach(() => {
    mockIsAuthenticated = true;
    mockIsConnecting = false;
    mockNavigate.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the Vel Morrow header and the respec panel when authenticated', () => {
    render(<Respec />);

    expect(screen.getByText('Vel Morrow')).toBeDefined();
    expect(screen.getByText(/Combat Trainer/i)).toBeDefined();
    expect(screen.getByTestId('respec-panel-stub')).toBeDefined();
  });

  it('redirects unauthenticated users to home and renders nothing', () => {
    mockIsAuthenticated = false;
    mockIsConnecting = false;

    render(<Respec />);

    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(screen.queryByTestId('respec-panel-stub')).toBeNull();
  });

  it('does not redirect while auth is still connecting', () => {
    mockIsAuthenticated = false;
    mockIsConnecting = true;

    render(<Respec />);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('leave button navigates back to the game board', () => {
    render(<Respec />);

    const leaveButton = screen.getByText('shop.leaveShop');
    leaveButton.click();

    expect(mockNavigate).toHaveBeenCalledWith('/game-board');
  });
});

describe('Respec host — structural', () => {
  it('RespecPanel is no longer imported or mounted from Character.tsx', () => {
    const characterSource = readFileSync(
      resolve(__dirname, './Character.tsx'),
      'utf8',
    );
    expect(characterSource).not.toMatch(/from ['"]\.\.\/components\/RespecPanel['"]/);
    expect(characterSource).not.toMatch(/<RespecPanel/);
  });
});
