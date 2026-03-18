import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mutable mock state ---

let mockNearbyRanks: any = {
  nearby: [],
  totalPlayers: 0,
  selfStatsRank: null,
  selfGoldRank: null,
  isLoading: true,
  rankBy: 'stats' as const,
  setRankBy: vi.fn(),
};

const mockNavigate = vi.fn();

// --- vi.mock declarations ---

vi.mock('../hooks/useNearbyRanks', () => ({
  useNearbyRanks: () => mockNearbyRanks,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../utils/helpers', () => ({
  etherToFixedNumber: (val: bigint | string) => {
    const n = Number(BigInt(val));
    return (n / 1e18).toFixed(2);
  },
}));

vi.mock('../Routes', () => ({
  LEADERBOARD_PATH: '/leaderboard',
}));

vi.mock('./PolygonalCard', () => ({
  PolygonalCard: ({ children, ...props }: any) => (
    <div data-testid="polygonal-card" {...props}>{children}</div>
  ),
}));

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual<typeof import('@chakra-ui/react')>('@chakra-ui/react');
  return {
    ...actual,
    useBreakpointValue: (values: Record<string, unknown>) => values.lg ?? values.base,
  };
});

import { MiniLeaderboard } from './MiniLeaderboard';

// --- Helpers ---

function makePlayer(
  id: string,
  name: string,
  overrides: Record<string, any> = {},
) {
  return {
    characterId: id,
    name,
    level: 5,
    totalStats: 30,
    totalGold: '1000000000000000000',
    statsRank: 3,
    goldRank: 3,
    isSelf: false,
    ...overrides,
  };
}

// --- Tests ---

describe('MiniLeaderboard', () => {
  beforeEach(() => {
    mockNearbyRanks = {
      nearby: [],
      totalPlayers: 0,
      selfStatsRank: null,
      selfGoldRank: null,
      isLoading: true,
      rankBy: 'stats' as const,
      setRankBy: vi.fn(),
    };
    mockNavigate.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('returns null while loading', () => {
    mockNearbyRanks.isLoading = true;
    mockNearbyRanks.nearby = [];

    const { container } = render(<MiniLeaderboard />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when no nearby players', () => {
    mockNearbyRanks.isLoading = false;
    mockNearbyRanks.nearby = [];

    const { container } = render(<MiniLeaderboard />);
    expect(container.innerHTML).toBe('');
  });

  it('renders 5 rows when 5 nearby players', () => {
    mockNearbyRanks.isLoading = false;
    mockNearbyRanks.nearby = [
      makePlayer('0x01', 'Player1', { statsRank: 1, isSelf: false }),
      makePlayer('0x02', 'Player2', { statsRank: 2, isSelf: false }),
      makePlayer('0x03', 'Self', { statsRank: 3, isSelf: true }),
      makePlayer('0x04', 'Player4', { statsRank: 4, isSelf: false }),
      makePlayer('0x05', 'Player5', { statsRank: 5, isSelf: false }),
    ];

    render(<MiniLeaderboard />);

    expect(screen.getByText('Player1')).toBeDefined();
    expect(screen.getByText('Player2')).toBeDefined();
    expect(screen.getByText('Self')).toBeDefined();
    expect(screen.getByText('Player4')).toBeDefined();
    expect(screen.getByText('Player5')).toBeDefined();
  });

  it('limits to 5 rows even with more data', () => {
    mockNearbyRanks.isLoading = false;
    mockNearbyRanks.nearby = [
      makePlayer('0x01', 'P1', { statsRank: 1 }),
      makePlayer('0x02', 'P2', { statsRank: 2 }),
      makePlayer('0x03', 'P3', { statsRank: 3, isSelf: true }),
      makePlayer('0x04', 'P4', { statsRank: 4 }),
      makePlayer('0x05', 'P5', { statsRank: 5 }),
      makePlayer('0x06', 'P6', { statsRank: 6 }),
      makePlayer('0x07', 'P7', { statsRank: 7 }),
    ];

    render(<MiniLeaderboard />);

    expect(screen.getByText('P1')).toBeDefined();
    expect(screen.getByText('P5')).toBeDefined();
    expect(screen.queryByText('P6')).toBeNull();
    expect(screen.queryByText('P7')).toBeNull();
  });

  it('displays rank numbers with # prefix', () => {
    mockNearbyRanks.isLoading = false;
    mockNearbyRanks.rankBy = 'stats';
    mockNearbyRanks.nearby = [
      makePlayer('0x01', 'Player1', { statsRank: 1 }),
      makePlayer('0x02', 'Self', { statsRank: 2, isSelf: true }),
    ];

    render(<MiniLeaderboard />);

    expect(screen.getByText('#1')).toBeDefined();
    expect(screen.getByText('#2')).toBeDefined();
  });

  it('shows gold ranks when rankBy is gold', () => {
    mockNearbyRanks.isLoading = false;
    mockNearbyRanks.rankBy = 'gold';
    mockNearbyRanks.nearby = [
      makePlayer('0x01', 'Rich', { goldRank: 1, statsRank: 5 }),
      makePlayer('0x02', 'Self', { goldRank: 2, statsRank: 3, isSelf: true }),
    ];

    render(<MiniLeaderboard />);

    // Should show gold ranks, not stats ranks
    expect(screen.getByText('#1')).toBeDefined();
    expect(screen.getByText('#2')).toBeDefined();
  });

  it('navigates to character page when clicking a row', () => {
    mockNearbyRanks.isLoading = false;
    mockNearbyRanks.nearby = [
      makePlayer('0xchar1', 'ClickMe', { statsRank: 1 }),
    ];

    render(<MiniLeaderboard />);

    fireEvent.click(screen.getByText('ClickMe'));
    expect(mockNavigate).toHaveBeenCalledWith('/characters/0xchar1');
  });

  it('navigates to leaderboard when clicking heading', () => {
    mockNearbyRanks.isLoading = false;
    mockNearbyRanks.nearby = [
      makePlayer('0x01', 'Player1', { statsRank: 1 }),
    ];

    render(<MiniLeaderboard />);

    fireEvent.click(screen.getByText('Nearby Ranks'));
    expect(mockNavigate).toHaveBeenCalledWith('/leaderboard');
  });

  it('calls setRankBy when clicking tab buttons', () => {
    mockNearbyRanks.isLoading = false;
    mockNearbyRanks.rankBy = 'stats';
    mockNearbyRanks.nearby = [
      makePlayer('0x01', 'Player1', { statsRank: 1 }),
    ];

    render(<MiniLeaderboard />);

    fireEvent.click(screen.getByText('Gold'));
    expect(mockNearbyRanks.setRankBy).toHaveBeenCalledWith('gold');
  });

  it('renders with fewer than 5 players', () => {
    mockNearbyRanks.isLoading = false;
    mockNearbyRanks.nearby = [
      makePlayer('0x01', 'OnlyPlayer', { statsRank: 1, isSelf: true }),
    ];

    render(<MiniLeaderboard />);

    expect(screen.getByText('OnlyPlayer')).toBeDefined();
  });
});
