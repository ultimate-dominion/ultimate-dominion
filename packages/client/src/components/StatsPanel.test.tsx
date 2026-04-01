import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { StatsPanel } from './StatsPanel';

// --- Mutable mock state ---

let mockCharacter: any = null;
let mockGameValues: Record<string, any> = {};
let mockGameTables: Record<string, Record<string, any>> = {};
let mockLeaderboardRank: any = null;
const mockNearbyRanks = {
  dataRankBy: 'stats',
  isLoading: false,
  nearby: [],
  rankBy: 'stats',
  setRankBy: vi.fn(),
};

// --- vi.mock declarations ---

vi.mock('../contexts/CharacterContext', () => ({
  useCharacter: () => ({
    character: mockCharacter,
    refreshCharacter: vi.fn(),
    equippedArmor: [],
    equippedSpells: [],
    equippedWeapons: [],
  }),
}));

vi.mock('../contexts/FragmentContext', () => ({
  useFragments: () => ({
    fragments: [],
  }),
}));

vi.mock('../contexts/GoldMerchantContext', () => ({
  useGoldMerchant: () => ({
    onOpen: vi.fn(),
  }),
}));

vi.mock('../hooks/useLeaderboardRank', () => ({
  useLeaderboardRank: () => mockLeaderboardRank,
}));

vi.mock('../hooks/useNearbyRanks', () => ({
  useNearbyRanks: () => mockNearbyRanks,
}));

vi.mock('../hooks/useOnboardingStage', () => ({
  OnboardingStage: {
    PRE_SPAWN: 0,
    JUST_SPAWNED: 1,
    FIRST_STEPS: 2,
    FIRST_BLOOD: 3,
    SETTLING_IN: 4,
    ESTABLISHED: 5,
    VETERAN: 6,
  },
  useOnboardingStage: () => 6,
}));

vi.mock('../lib/gameStore', () => ({
  useGameValue: (_table: string, _key: string | undefined) => {
    if (!_key) return undefined;
    return mockGameValues[_key] ?? undefined;
  },
  useGameTable: (table: string) => mockGameTables[table] ?? {},
  encodeUint256Key: (n: bigint) => `0x${n.toString(16).padStart(64, '0')}`,
  toBigInt: (v: any) => (v != null ? BigInt(v) : BigInt(0)),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../utils/helpers', () => ({
  etherToFixedNumber: (val: bigint) => (Number(val) / 1e18).toFixed(2),
}));

// Mock child components
vi.mock('./ClassSymbol', () => ({
  ClassSymbol: () => null,
}));

vi.mock('./EquippedLoadout', () => ({
  EquippedLoadout: () => null,
}));

vi.mock('./LevelUpModal', () => ({
  LevelUpModal: () => null,
}));

vi.mock('./Level', () => ({
  Level: (props: any) => (
    <div
      data-testid="level"
      data-current-level={props.currentLevel?.toString()}
      data-level-percent={props.levelPercent}
      data-maxed={props.maxed}
    />
  ),
}));

vi.mock('./MiniLeaderboard', () => ({
  MiniLeaderboard: () => null,
}));

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual<typeof import('@chakra-ui/react')>('@chakra-ui/react');
  return {
    ...actual,
    useBreakpointValue: (values: Record<string, unknown>) => values.base ?? values.lg,
  };
});

// --- Helpers ---

function makeCharacter(overrides: Record<string, any> = {}) {
  return {
    id: '0xchar1',
    name: 'TestHero',
    description: 'A brave hero',
    owner: '0xowner',
    level: 5n,
    experience: 100n,
    currentHp: 50n,
    maxHp: 100n,
    strength: 10n,
    agility: 10n,
    intelligence: 10n,
    advancedClass: 0,
    entityClass: 0,
    hasSelectedAdvancedClass: false,
    image: '',
    externalGoldBalance: 0n,
    worldStatusEffects: [],
    ...overrides,
  };
}

// MAX_LEVEL = 10 (from constants.ts). maxed = Number(character.level) >= MAX_LEVEL.

// --- Tests ---

describe('StatsPanel — max level behavior', () => {
  beforeEach(() => {
    mockCharacter = null;
    mockGameValues = {};
    mockGameTables = {};
    mockLeaderboardRank = null;
  });

  afterEach(() => {
    cleanup();
  });

  // --- Happy path: maxed character ---

  it('passes maxed=true to Level component when character is at max level', () => {
    mockCharacter = makeCharacter({ level: 10n, experience: 5000n });

    render(<StatsPanel />);

    const level = screen.getByTestId('level');
    expect(level.getAttribute('data-maxed')).toBe('true');
  });

  it('does NOT show "Level Up!" button when character is at max level', () => {
    // Even with XP exceeding any possible threshold
    mockCharacter = makeCharacter({ level: 10n, experience: 99999n });

    // Provide next level data so the XP check would pass if not for maxed guard
    const nextLevelKey = '0x' + 'a'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 100n };

    render(<StatsPanel />);

    expect(screen.queryByText('Level Up!')).toBeNull();
  });

  it('shows XP with "(MAX)" when maxed', () => {
    mockCharacter = makeCharacter({ level: 10n, experience: 16000n });

    render(<StatsPanel />);

    expect(screen.getByText('16000 (MAX)')).toBeDefined();
  });

  // --- Happy path: normal character (not maxed) ---

  it('passes maxed=false to Level component when not at max level', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 100n });

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    const currentLevelKey = '0x' + '4'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };
    mockGameValues[currentLevelKey] = { experience: 50n };

    render(<StatsPanel />);

    const level = screen.getByTestId('level');
    expect(level.getAttribute('data-maxed')).toBe('false');
  });

  it('shows "Level Up!" button when XP >= threshold and NOT maxed', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 200n });

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    const currentLevelKey = '0x' + '4'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };
    mockGameValues[currentLevelKey] = { experience: 50n };

    render(<StatsPanel />);

    expect(screen.getByText('Level Up!')).toBeDefined();
  });

  it('does NOT show "Level Up!" button when XP < threshold and NOT maxed', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 50n });

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    const currentLevelKey = '0x' + '4'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };
    mockGameValues[currentLevelKey] = { experience: 40n };

    render(<StatsPanel />);

    expect(screen.queryByText('Level Up!')).toBeNull();
  });

  it('shows XP fraction with threshold when not maxed', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 100n });

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    const currentLevelKey = '0x' + '4'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };
    mockGameValues[currentLevelKey] = { experience: 50n };

    render(<StatsPanel />);

    expect(screen.getByText('100')).toBeDefined();
    expect(screen.getByText(/200/)).toBeDefined();
  });

  // --- Edge cases ---

  it('treats level > MAX_LEVEL as maxed', () => {
    mockCharacter = makeCharacter({ level: 15n, experience: 9999n });

    render(<StatsPanel />);

    const level = screen.getByTestId('level');
    expect(level.getAttribute('data-maxed')).toBe('true');
    expect(screen.queryByText('Level Up!')).toBeNull();
  });

  it('shows spinner when character is null', () => {
    mockCharacter = null;

    render(<StatsPanel />);

    expect(screen.queryByTestId('level')).toBeNull();
    expect(screen.queryByText('Level Up!')).toBeNull();
  });

  it('level 8 with enough XP is NOT maxed and can level up (boundary)', () => {
    mockCharacter = makeCharacter({ level: 8n, experience: 5000n });

    const nextLevelKey = '0x' + '8'.padStart(64, '0');
    const currentLevelKey = '0x' + '7'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 4000n };
    mockGameValues[currentLevelKey] = { experience: 2000n };

    render(<StatsPanel />);

    const level = screen.getByTestId('level');
    expect(level.getAttribute('data-maxed')).toBe('false');
    expect(screen.getByText('Level Up!')).toBeDefined();
  });

  it('level 9 is NOT maxed (below MAX_LEVEL = 10)', () => {
    mockCharacter = makeCharacter({ level: 9n, experience: 5000n });

    const nextLevelKey = '0x' + '9'.padStart(64, '0');
    const currentLevelKey = '0x' + '8'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 4000n };
    mockGameValues[currentLevelKey] = { experience: 2000n };

    render(<StatsPanel />);

    const level = screen.getByTestId('level');
    expect(level.getAttribute('data-maxed')).toBe('false');
    // Has enough XP → shows Level Up!
    expect(screen.getByText('Level Up!')).toBeDefined();
  });

  it('level 1 is NOT maxed (MAX_LEVEL constant governs, not table)', () => {
    mockCharacter = makeCharacter({ level: 1n, experience: 10n });

    render(<StatsPanel />);

    const level = screen.getByTestId('level');
    expect(level.getAttribute('data-maxed')).toBe('false');
  });
});
