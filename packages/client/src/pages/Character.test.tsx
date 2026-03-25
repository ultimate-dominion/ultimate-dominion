import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { CharacterPage } from './Character';

// --- Mutable mock state ---

let mockCharacter: any = null;
const mockRefreshCharacter = vi.fn().mockResolvedValue(undefined);

let mockGameValues: Record<string, any> = {};
let mockTableEntries: Record<string, Record<string, any>> = {};
let mockIsSynced = true;
let mockIsAuthenticated = true;
let mockIsConnecting = false;

// --- vi.mock declarations ---

vi.mock('../contexts/CharacterContext', () => ({
  useCharacter: () => ({
    character: mockCharacter,
    refreshCharacter: mockRefreshCharacter,
    equippedArmor: [],
    equippedSpells: [],
    equippedWeapons: [],
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    isConnecting: mockIsConnecting,
  }),
}));

vi.mock('../contexts/MUDContext', () => ({
  useMUD: () => ({
    isSynced: mockIsSynced,
  }),
}));

vi.mock('../contexts/ChatContext', () => ({
  useChat: () => ({
    onOpen: vi.fn(),
  }),
}));

vi.mock('../contexts/ItemsContext', () => ({
  useItems: () => ({
    armorTemplates: [],
    consumableTemplates: [],
    isLoading: false,
    spellTemplates: [],
    weaponTemplates: [],
  }),
}));

vi.mock('../hooks/useBadges', () => ({
  useBadges: () => ({ badges: [] }),
}));

vi.mock('../hooks/useReactiveEntity', () => ({
  useReactiveEntity: () => null,
}));

vi.mock('../lib/gameStore', () => ({
  useGameValue: (_table: string, _key: string | undefined) => {
    if (!_key) return undefined;
    return mockGameValues[_key] ?? undefined;
  },
  useGameTable: (table: string) => mockTableEntries[table] ?? {},
  getTableEntries: (table: string) => mockTableEntries[table] ?? {},
  encodeUint256Key: (n: bigint) => `0x${n.toString(16).padStart(64, '0')}`,
  encodeAddressKey: (a: string) => a,
  encodeCompositeKey: (a: string, b: string) => `${a}:${b}`,
  toBigInt: (v: any) => (v != null ? BigInt(v) : BigInt(0)),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '0xchar1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../utils/helpers', () => ({
  decodeCharacterId: () => ({ ownerAddress: '0xowner', characterTokenId: '1' }),
  etherToFixedNumber: (val: bigint) => (Number(val) / 1e18).toFixed(2),
}));

// Mock complex child components to isolate this component's logic
vi.mock('../components/AdvancedClassModal', () => ({
  AdvancedClassModal: () => null,
}));

vi.mock('../components/BadgeDisplay', () => ({
  BadgeIcons: () => null,
  BadgeShowcase: () => null,
}));

vi.mock('../components/ClassSymbol', () => ({
  ClassSymbol: () => null,
}));

vi.mock('../components/EditCharacterModal', () => ({
  EditCharacterModal: () => null,
}));

vi.mock('../components/FragmentCollection', () => ({
  FragmentCollection: () => null,
}));

vi.mock('../components/ItemCard', () => ({
  ItemCard: () => null,
}));

vi.mock('../components/ItemConsumeModal', () => ({
  ItemConsumeModal: () => null,
}));

vi.mock('../components/ItemEquipModal', () => ({
  ItemEquipModal: () => null,
}));

vi.mock('../components/Level', () => ({
  Level: (props: any) => (
    <div
      data-testid="level"
      data-current-level={props.currentLevel?.toString()}
      data-level-percent={props.levelPercent}
      data-maxed={props.maxed}
    />
  ),
}));

vi.mock('../components/LevelingPanel', () => ({
  LevelingPanel: (props: any) => (
    <div
      data-testid="leveling-panel"
      data-can-level={String(props.canLevel)}
    />
  ),
}));

vi.mock('../components/PolygonalCard', () => ({
  PolygonalCard: ({ children, ...props }: any) => <div {...props}>{children}</div>,
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
    inBattle: false,
    isSpawned: true,
    locked: false,
    position: { x: 0, y: 0 },
    pvpCooldownTimer: 0n,
    tokenId: '1',
    worldStatusEffects: [],
    race: 0,
    powerSource: 0,
    startingArmor: 0,
    baseStats: {
      agility: 10n,
      currentHp: 50n,
      entityClass: 0,
      experience: 100n,
      intelligence: 10n,
      level: 5n,
      maxHp: 100n,
      strength: 10n,
      race: 0,
      powerSource: 0,
      startingArmor: 0,
      advancedClass: 0,
      hasSelectedAdvancedClass: false,
    },
    ...overrides,
  };
}

// MAX_LEVEL = 10 (from constants.ts). maxed = Number(character.level) >= MAX_LEVEL.

// --- Tests ---

describe('CharacterPage — max level behavior', () => {
  beforeEach(() => {
    mockCharacter = null;
    mockGameValues = {};
    mockTableEntries = {};
    mockIsSynced = true;
    mockIsAuthenticated = true;
    mockIsConnecting = false;
  });

  afterEach(() => {
    cleanup();
  });

  // --- Happy path: maxed character (level >= MAX_LEVEL = 10) ---

  it('maxed is true when character level equals MAX_LEVEL', () => {
    mockCharacter = makeCharacter({ level: 10n, experience: 5000n });

    render(<CharacterPage />);

    const level = screen.getByTestId('level');
    expect(level.getAttribute('data-maxed')).toBe('true');
  });

  it('passes canLevel=false to LevelingPanel when character is at max level', () => {
    mockCharacter = makeCharacter({ level: 10n, experience: 5000n });

    render(<CharacterPage />);

    const levelingPanel = screen.getByTestId('leveling-panel');
    expect(levelingPanel.getAttribute('data-can-level')).toBe('false');
  });

  it('Level component receives levelPercent = 100 when maxed', () => {
    mockCharacter = makeCharacter({ level: 10n, experience: 16000n });

    render(<CharacterPage />);

    const level = screen.getByTestId('level');
    expect(level.getAttribute('data-level-percent')).toBe('100');
  });

  it('shows XP with "(MAX)" text when maxed', () => {
    mockCharacter = makeCharacter({ level: 10n, experience: 16000n });

    render(<CharacterPage />);

    expect(screen.getByText('16000 XP (MAX)')).toBeDefined();
  });

  // --- Happy path: normal character (not maxed) ---

  it('maxed is false when character level is below max level from table', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 100n });

    // Set up gameValues for XP display
    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    const currentLevelKey = '0x' + '4'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };
    mockGameValues[currentLevelKey] = { experience: 50n };

    render(<CharacterPage />);

    const level = screen.getByTestId('level');
    expect(level.getAttribute('data-maxed')).toBe('false');
  });

  it('passes canLevel=true when XP meets threshold and not maxed', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 200n });

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    const currentLevelKey = '0x' + '4'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };
    mockGameValues[currentLevelKey] = { experience: 50n };

    render(<CharacterPage />);

    const levelingPanel = screen.getByTestId('leveling-panel');
    expect(levelingPanel.getAttribute('data-can-level')).toBe('true');
  });

  it('shows XP fraction in display when not maxed', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 100n });

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    const currentLevelKey = '0x' + '4'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };
    mockGameValues[currentLevelKey] = { experience: 50n };

    render(<CharacterPage />);

    // Non-maxed XP display: "{experience}/{nextLevelXpRequirement} XP"
    expect(screen.getByText('100')).toBeDefined();
    expect(screen.getByText(/\/200 XP/)).toBeDefined();
  });

  // --- Edge cases ---

  it('level exceeding MAX_LEVEL is still maxed', () => {
    mockCharacter = makeCharacter({ level: 15n, experience: 9999n });

    render(<CharacterPage />);

    const level = screen.getByTestId('level');
    expect(level.getAttribute('data-maxed')).toBe('true');

    const levelingPanel = screen.getByTestId('leveling-panel');
    expect(levelingPanel.getAttribute('data-can-level')).toBe('false');
  });

  it('canLevel is false at max level even when XP exceeds any threshold', () => {
    mockCharacter = makeCharacter({ level: 10n, experience: 99999n });

    // Even if there happened to be a Levels[10] entry
    const nextLevelKey = '0x' + 'a'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 100n };

    render(<CharacterPage />);

    const levelingPanel = screen.getByTestId('leveling-panel');
    expect(levelingPanel.getAttribute('data-can-level')).toBe('false');
  });

  it('canLevel is false when XP is below threshold at non-maxed level', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 50n });

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    const currentLevelKey = '0x' + '4'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };
    mockGameValues[currentLevelKey] = { experience: 40n };

    render(<CharacterPage />);

    const levelingPanel = screen.getByTestId('leveling-panel');
    expect(levelingPanel.getAttribute('data-can-level')).toBe('false');
  });

  it('shows spinner when character data is not yet loaded', () => {
    // character = null, isSynced = true, id exists -> isLoadingCharacter = true
    mockCharacter = null;

    render(<CharacterPage />);

    expect(screen.queryByTestId('leveling-panel')).toBeNull();
    expect(screen.queryByTestId('level')).toBeNull();
  });

  it('level 9 is NOT maxed (below MAX_LEVEL = 10)', () => {
    mockCharacter = makeCharacter({ level: 9n, experience: 5000n });

    const nextLevelKey = '0x' + '9'.padStart(64, '0');
    const currentLevelKey = '0x' + '8'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 4000n };
    mockGameValues[currentLevelKey] = { experience: 2000n };

    render(<CharacterPage />);

    const level = screen.getByTestId('level');
    expect(level.getAttribute('data-maxed')).toBe('false');

    // Has enough XP, so canLevel = true
    const levelingPanel = screen.getByTestId('leveling-panel');
    expect(levelingPanel.getAttribute('data-can-level')).toBe('true');
  });
});
