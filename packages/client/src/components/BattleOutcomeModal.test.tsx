import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { BattleOutcomeModal } from './BattleOutcomeModal';

// --- Mutable mock state ---

let mockCharacter: any = null;
let mockGameValues: Record<string, any> = {};
let mockTableEntries: Record<string, Record<string, any>> = {};
let mockLeaderboardRank: any = null;
let mockOpponent: any = null;
let mockCurrentBattle: any = null;

const mockRefreshCharacter = vi.fn().mockResolvedValue(undefined);
const mockOnContinueToBattleOutcome = vi.fn();

// --- vi.mock declarations ---

vi.mock('../contexts/CharacterContext', () => ({
  useCharacter: () => ({
    character: mockCharacter,
    refreshCharacter: mockRefreshCharacter,
    equippedArmor: [],
    equippedConsumables: [],
    equippedSpells: [],
    equippedWeapons: [],
  }),
}));

vi.mock('../contexts/BattleContext', () => ({
  useBattle: () => ({
    currentBattle: mockCurrentBattle,
    onContinueToBattleOutcome: mockOnContinueToBattleOutcome,
    opponent: mockOpponent,
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

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    renderError: vi.fn(),
    renderSuccess: vi.fn(),
  }),
}));

vi.mock('../hooks/useLeaderboardRank', () => ({
  useLeaderboardRank: () => mockLeaderboardRank,
}));

vi.mock('../lib/gameStore', () => ({
  useGameValue: (_table: string, _key: string | undefined) => {
    if (!_key) return undefined;
    return mockGameValues[_key] ?? undefined;
  },
  useGameTable: (table: string) => mockTableEntries[table] ?? {},
  getTableEntries: (table: string) => mockTableEntries[table] ?? {},
  encodeUint256Key: (n: bigint) => `0x${n.toString(16).padStart(64, '0')}`,
  toBigInt: (v: any) => (v != null ? BigInt(v) : BigInt(0)),
}));

vi.mock('../utils/helpers', () => ({
  etherToFixedNumber: (val: bigint) => (Number(val) / 1e18).toFixed(2),
}));

// Mock child components
vi.mock('./ItemCard', () => ({
  ItemCard: () => null,
}));

vi.mock('./ItemEquipModal', () => ({
  ItemEquipModal: () => null,
}));

vi.mock('./LevelUpBanner', () => ({
  LevelUpBanner: (props: any) => (
    <div data-testid="level-up-banner" data-level={props.level?.toString()} />
  ),
}));

vi.mock('./LevelingPanel', () => ({
  LevelingPanel: (props: any) => (
    <div
      data-testid="leveling-panel"
      data-can-level={String(props.canLevel)}
      data-compact={String(props.compact)}
    />
  ),
}));

vi.mock('./PolygonalCard', () => ({
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
    worldStatusEffects: [],
    ...overrides,
  };
}

function makeWinOutcome(overrides: Record<string, any> = {}) {
  return {
    attackers: ['0xchar1'],
    defenders: ['0xmonster1'],
    encounterId: '0xenc1',
    endTime: 100n,
    expDropped: 50n,
    goldDropped: 1000000000000000000n,
    itemsDropped: [] as string[],
    playerFled: false,
    winner: '0xchar1',
    ...overrides,
  };
}

// MAX_LEVEL = 10 (from constants.ts). canLevel = false when Number(character.level) >= MAX_LEVEL.

// --- Tests ---

describe('BattleOutcomeModal — max level behavior', () => {
  beforeEach(() => {
    mockCharacter = null;
    mockGameValues = {};
    mockTableEntries = {};
    mockLeaderboardRank = null;
    mockOpponent = { name: 'Dire Rat' };
    mockCurrentBattle = null;
    mockRefreshCharacter.mockClear();
    mockOnContinueToBattleOutcome.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  // --- Happy path: maxed character (level 10) ---

  it('does NOT render LevelingPanel when character is at max level', () => {
    mockCharacter = makeCharacter({ level: 10n, experience: 5000n });
    const outcome = makeWinOutcome();

    render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    // canLevel is false at max level -> no LevelingPanel
    expect(screen.queryByTestId('leveling-panel')).toBeNull();
  });

  it('does NOT render LevelUpBanner when character is at max level', () => {
    mockCharacter = makeCharacter({ level: 10n, experience: 5000n });

    // Provide next level data so the XP comparison would pass if not maxed
    const nextLevelKey = '0x' + 'a'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 4000n };

    const outcome = makeWinOutcome();

    render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    // justBecameEligible is false when maxed
    expect(screen.queryByTestId('level-up-banner')).toBeNull();
  });

  it('shows victory text but no leveling UI when maxed and winning', () => {
    mockCharacter = makeCharacter({ level: 10n, experience: 5000n });
    const outcome = makeWinOutcome();

    render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    expect(screen.getByText('Victory!')).toBeDefined();
    expect(screen.getByText(/You defeated/)).toBeDefined();
    expect(screen.queryByTestId('leveling-panel')).toBeNull();
    expect(screen.queryByTestId('level-up-banner')).toBeNull();
  });

  // --- Happy path: non-maxed character with enough XP ---

  it('renders LevelingPanel with canLevel=true when not maxed with enough XP', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 300n });

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };

    const outcome = makeWinOutcome();

    render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    const levelingPanel = screen.getByTestId('leveling-panel');
    expect(levelingPanel).toBeDefined();
    expect(levelingPanel.getAttribute('data-can-level')).toBe('true');
    expect(levelingPanel.getAttribute('data-compact')).toBe('true');
  });

  it('renders LevelUpBanner when this battle pushed XP over threshold', () => {
    // Mount with experience below threshold, then update above it
    mockCharacter = makeCharacter({ level: 5n, experience: 150n });

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };

    const outcome = makeWinOutcome();

    const { rerender } = render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    // Simulate character update after battle: XP crosses threshold
    mockCharacter = makeCharacter({ level: 5n, experience: 250n });

    rerender(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    // justBecameEligible: initialExperience(150) < 200 && 250 >= 200 = true
    expect(screen.getByTestId('level-up-banner')).toBeDefined();
    expect(screen.getByTestId('leveling-panel')).toBeDefined();
  });

  // --- Edge cases ---

  it('treats level > MAX_LEVEL as maxed', () => {
    mockCharacter = makeCharacter({ level: 15n, experience: 99999n });

    const nextLevelKey = '0x' + 'f'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 100n };

    const outcome = makeWinOutcome();

    render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    expect(screen.queryByTestId('leveling-panel')).toBeNull();
    expect(screen.queryByTestId('level-up-banner')).toBeNull();
  });

  it('canLevel is false when level < max but XP is below threshold', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 50n });

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };

    const outcome = makeWinOutcome();

    render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    expect(screen.queryByTestId('leveling-panel')).toBeNull();
  });

  it('level 8 with enough XP shows leveling UI (boundary test)', () => {
    mockCharacter = makeCharacter({ level: 8n, experience: 5000n });

    const nextLevelKey = '0x' + '8'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 4000n };

    const outcome = makeWinOutcome();

    render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    const levelingPanel = screen.getByTestId('leveling-panel');
    expect(levelingPanel).toBeDefined();
    expect(levelingPanel.getAttribute('data-can-level')).toBe('true');
  });

  it('level 9 is NOT maxed — shows leveling UI with enough XP', () => {
    mockCharacter = makeCharacter({ level: 9n, experience: 5000n });

    const nextLevelKey = '0x' + '9'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 4000n };

    const outcome = makeWinOutcome();

    render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    // level 9 < MAX_LEVEL(10) -> canLevel = true (XP 5000 >= threshold 4000)
    const levelingPanel = screen.getByTestId('leveling-panel');
    expect(levelingPanel).toBeDefined();
    expect(levelingPanel.getAttribute('data-can-level')).toBe('true');
  });

  it('renders empty Box when character is null', () => {
    mockCharacter = null;
    const outcome = makeWinOutcome();

    render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    expect(screen.queryByText('Victory!')).toBeNull();
    expect(screen.queryByTestId('leveling-panel')).toBeNull();
  });

  it('does not render leveling UI on defeat', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 300n });

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };

    const outcome = makeWinOutcome({ winner: '0xmonster1' });

    render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    expect(screen.getByText('Defeat...')).toBeDefined();
    // LevelingPanel and LevelUpBanner gated by winner === character.id
    expect(screen.queryByTestId('leveling-panel')).toBeNull();
    expect(screen.queryByTestId('level-up-banner')).toBeNull();
  });

  it('does not render leveling content on a draw', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 300n });
    mockCurrentBattle = {
      maxTurns: 10n,
      currentTurn: 10n,
    };

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };

    const outcome = makeWinOutcome({ winner: '0xchar1' });

    render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    expect(screen.getByText('Draw...')).toBeDefined();
    expect(screen.queryByTestId('level-up-banner')).toBeNull();
  });

  it('fled battle does not show leveling UI', () => {
    mockCharacter = makeCharacter({ level: 5n, experience: 300n });

    const nextLevelKey = '0x' + '5'.padStart(64, '0');
    mockGameValues[nextLevelKey] = { experience: 200n };

    const outcome = makeWinOutcome({ playerFled: true, winner: '0xmonster1' });

    render(
      <BattleOutcomeModal
        isOpen={true}
        onClose={vi.fn()}
        battleOutcome={outcome as any}
      />,
    );

    expect(screen.getByText('Defeat...')).toBeDefined();
    expect(screen.queryByTestId('leveling-panel')).toBeNull();
    expect(screen.queryByTestId('level-up-banner')).toBeNull();
  });
});
