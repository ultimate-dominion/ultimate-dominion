import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ActionsPanel } from './ActionsPanel';

// --- Shared mock state ---

const defaultCharacter = {
  id: '0xplayer',
  name: 'TestHero',
  owner: '0xowner',
  level: 5n,
  experience: 100n,
  currentHp: 50n,
  maxHp: 100n,
};

const winOutcome = {
  attackers: ['0xplayer'],
  defenders: ['0xmonster'],
  encounterId: '0xenc1',
  endTime: 100n,
  expDropped: 50n,
  goldDropped: 1000000000000000000n, // 1 ether
  itemsDropped: ['0xitem1'],
  playerFled: false,
  winner: '0xplayer',
};

const lossOutcome = {
  ...winOutcome,
  winner: '0xmonster',
  expDropped: 0n,
  goldDropped: 500000000000000000n,
  itemsDropped: [],
};

const drawBattle = {
  attackers: ['0xplayer'],
  defenders: ['0xmonster'],
  encounterId: '0xenc1',
  encounterType: 0, // PvE
  end: 1n,
  start: 1n,
  currentTurn: 10n,
  maxTurns: 10n,
  currentTurnTimer: 0n,
};

const normalBattle = {
  ...drawBattle,
  currentTurn: 5n,
};

const mockOnContinueToBattleOutcome = vi.fn();
const mockRefreshCharacter = vi.fn().mockResolvedValue(undefined);

// --- Context mocks ---

let battleState: Record<string, unknown> = {};
let characterState: Record<string, unknown> = {};
let movementState: Record<string, unknown> = {};
let itemsState: Record<string, unknown> = {};
let mapState: Record<string, unknown> = {};

vi.mock('../contexts/BattleContext', () => ({
  useBattle: () => battleState,
}));

vi.mock('../contexts/CharacterContext', () => ({
  useCharacter: () => characterState,
}));

vi.mock('../contexts/MovementContext', () => ({
  useMovement: () => movementState,
}));

vi.mock('../contexts/ItemsContext', () => ({
  useItems: () => itemsState,
}));

vi.mock('../contexts/MapContext', () => ({
  useMap: () => mapState,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; to: string }) =>
    <a {...props}>{children}</a>,
}));

vi.mock('./SafeTypist', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./ConsumableQuickUse', () => ({
  ConsumableQuickUse: () => null,
}));

vi.mock('./ItemCard', () => ({
  ItemCard: ({ name, onClick }: { name: string; onClick?: () => void }) => (
    <div data-testid={`item-card-${name}`} onClick={onClick}>{name}</div>
  ),
}));

vi.mock('./ItemEquipModal', () => ({
  ItemEquipModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="item-equip-modal"><button onClick={onClose}>Close</button></div> : null,
}));

vi.mock('./SVGs/PotionSvg', () => ({
  PotionSvg: () => null,
}));

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual<typeof import('@chakra-ui/react')>('@chakra-ui/react');
  return {
    ...actual,
    useBreakpointValue: (values: Record<string, unknown>) => values.base ?? values.lg,
  };
});

vi.mock('../utils/itemImages', () => ({
  getItemImage: () => null,
}));

vi.mock('../utils/helpers', () => ({
  etherToFixedNumber: (val: bigint) => (Number(val) / 1e18).toFixed(2),
  removeEmoji: (s: string) => s,
}));

const armorTemplate = {
  tokenId: '0xitem1',
  name: 'Iron Shield',
  rarity: 2,
  itemType: 1,
  balance: 0n,
  itemId: '0x0',
  owner: '0x0',
};

function setDefaults() {
  battleState = {
    attackOutcomes: [],
    attackingItemId: null,
    attackStatusMessage: '',
    currentBattle: null,
    dotActions: [],
    isFleeing: false,
    lastestBattleOutcome: null,
    onAttack: vi.fn(),
    onContinueToBattleOutcome: mockOnContinueToBattleOutcome,
    onFleePvp: vi.fn(),
    opponent: { id: '0xmonster', name: 'Dire Rat', mobId: '1', isElite: false },
    statusEffectActions: [],
  };

  characterState = {
    character: defaultCharacter,
    equippedArmor: [],
    equippedConsumables: [],
    equippedSpells: [],
    equippedWeapons: [{ tokenId: '0xweapon1', name: 'Short Sword' }],
    refreshCharacter: mockRefreshCharacter,
  };

  movementState = {
    autoAdventureMode: true,
    isRefreshing: false,
    onToggleAutoAdventure: vi.fn(),
  };

  itemsState = {
    armorTemplates: [armorTemplate],
    isLoading: false,
    spellTemplates: [],
    weaponTemplates: [],
  };

  mapState = {
    isSpawned: true,
    monstersOnTile: [],
    visibleMonstersOnTile: [],
    position: { x: 1, y: 1 },
  };
}

describe('ActionsPanel — Auto Adventure Inline Results', () => {
  beforeEach(() => {
    setDefaults();
    vi.useFakeTimers();
    mockOnContinueToBattleOutcome.mockClear();
    mockRefreshCharacter.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // --- Happy paths ---

  it('shows Defeated monster with gold, XP, and item names on win with items', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    render(<ActionsPanel />);

    expect(screen.getByText('Defeated Dire Rat!')).toBeTruthy();
    expect(screen.getByText(/You earned/)).toBeTruthy();
    expect(screen.getByText(/50 XP/)).toBeTruthy();
    expect(screen.getByText(/1\.00 Gold/)).toBeTruthy();
    expect(screen.getByText(/Picked up/)).toBeTruthy();
    expect(screen.getByText('Iron Shield')).toBeTruthy();
  });

  it('shows Defeated monster without items when no items dropped', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = { ...winOutcome, itemsDropped: [] };

    render(<ActionsPanel />);

    expect(screen.getByText('Defeated Dire Rat!')).toBeTruthy();
    expect(screen.getByText(/50 XP/)).toBeTruthy();
    expect(screen.queryByText(/Picked up/)).toBeNull();
  });

  it('shows Draw text on draw', () => {
    battleState.currentBattle = drawBattle;
    battleState.lastestBattleOutcome = { ...winOutcome, encounterId: '0xenc1' };

    render(<ActionsPanel />);

    expect(screen.getByText('Draw — Dire Rat')).toBeTruthy();
  });

  // --- Unhappy paths ---

  it('shows Defeated by monster and lost gold on loss', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = lossOutcome;

    render(<ActionsPanel />);

    expect(screen.getByText('Defeated by Dire Rat.')).toBeTruthy();
    expect(screen.getByText(/-0\.50 Gold/)).toBeTruthy();
  });

  it('shows idle state when no battle (autoFight TX not started)', () => {
    battleState.currentBattle = null;
    battleState.lastestBattleOutcome = null;

    render(<ActionsPanel />);

    expect(screen.getByText('No monsters here. Try another tile.')).toBeTruthy();
    expect(screen.queryByText('Defeated Dire Rat!')).toBeNull();
    expect(screen.queryByText('Defeated by Dire Rat.')).toBeNull();
  });

  // --- Edge cases ---

  it('immediately dismisses from BattleContext when results are captured', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    render(<ActionsPanel />);

    // Results captured on first render — BattleContext dismissed immediately
    expect(mockOnContinueToBattleOutcome).toHaveBeenCalledWith(false);
    expect(localStorage.getItem('latest-battle-outcome-seen')).toBe('0xenc1');
    // But results still visible (persisted in local state)
    expect(screen.getByText('Defeated Dire Rat!')).toBeTruthy();
  });

  it('keeps rolling history of results', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    const { rerender } = render(<ActionsPanel />);
    expect(screen.getByText('Defeated Dire Rat!')).toBeTruthy();

    // Simulate second battle result arriving
    mockOnContinueToBattleOutcome.mockClear();
    battleState.currentBattle = { ...normalBattle, encounterId: '0xenc2' };
    battleState.lastestBattleOutcome = { ...winOutcome, encounterId: '0xenc2', expDropped: 99n };

    act(() => { rerender(<ActionsPanel />); });

    // Both results should be visible
    expect(screen.getAllByText('Defeated Dire Rat!')).toHaveLength(2);
  });

  it('shows no-rewards message when XP, gold, and items are all zero', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = {
      ...winOutcome,
      expDropped: 0n,
      goldDropped: 0n,
      itemsDropped: [],
    };

    render(<ActionsPanel />);

    expect(screen.getByText('Defeated Dire Rat!')).toBeTruthy();
    expect(screen.getByText(/No rewards/)).toBeTruthy();
    expect(screen.queryByText(/XP/)).toBeNull();
    expect(screen.queryByText(/Gold/)).toBeNull();
  });

  it('renders standard combat log when autoAdventureMode is false', () => {
    movementState.autoAdventureMode = false;
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    render(<ActionsPanel />);

    // Standard flow shows "View Results" button, not inline results
    expect(screen.getByText('View Results')).toBeTruthy();
    expect(screen.queryByText('Defeated Dire Rat!')).toBeNull();
  });

  it('clicking an item name opens the equip modal', async () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    render(<ActionsPanel />);

    const itemText = screen.getByText('Iron Shield');
    fireEvent.click(itemText);

    expect(screen.getByTestId('item-equip-modal')).toBeTruthy();
  });

  it('tile guidance persists when results are showing', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    render(<ActionsPanel />);

    // Results should show
    expect(screen.getByText('Defeated Dire Rat!')).toBeTruthy();
    // The idle guidance stays visible while inline results are appended below it.
    expect(screen.getByText('No monsters here. Try another tile.')).toBeTruthy();
  });
});

describe('ActionsPanel — Low HP Warning', () => {
  beforeEach(() => {
    setDefaults();
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows low HP warning when HP is at 40% in auto adventure mode', () => {
    characterState.character = { ...defaultCharacter, currentHp: 40n, maxHp: 100n };

    render(<ActionsPanel />);

    expect(screen.getByText(/HP Low/)).toBeTruthy();
    expect(screen.getByText(/40\/100/)).toBeTruthy();
    expect(screen.getByText(/Consider using a potion/)).toBeTruthy();
  });

  it('shows critical HP warning when HP is at 20% in auto adventure mode', () => {
    characterState.character = { ...defaultCharacter, currentHp: 20n, maxHp: 100n };

    render(<ActionsPanel />);

    expect(screen.getByText(/HP Critical/)).toBeTruthy();
    expect(screen.getByText(/20\/100/)).toBeTruthy();
    expect(screen.getByText(/close to death/)).toBeTruthy();
  });

  it('does not show warning when HP is above 40%', () => {
    characterState.character = { ...defaultCharacter, currentHp: 50n, maxHp: 100n };

    render(<ActionsPanel />);

    expect(screen.queryByText(/HP Low/)).toBeNull();
    expect(screen.queryByText(/HP Critical/)).toBeNull();
  });

  it('does not show warning when auto adventure mode is off', () => {
    movementState.autoAdventureMode = false;
    characterState.character = { ...defaultCharacter, currentHp: 10n, maxHp: 100n };

    render(<ActionsPanel />);

    expect(screen.queryByText(/HP Low/)).toBeNull();
    expect(screen.queryByText(/HP Critical/)).toBeNull();
  });

  it('shows critical warning at exactly 20% threshold', () => {
    characterState.character = { ...defaultCharacter, currentHp: 20n, maxHp: 100n };

    render(<ActionsPanel />);

    expect(screen.getByText(/HP Critical/)).toBeTruthy();
  });

  it('shows low warning at exactly 40% threshold', () => {
    characterState.character = { ...defaultCharacter, currentHp: 40n, maxHp: 100n };

    render(<ActionsPanel />);

    expect(screen.getByText(/HP Low/)).toBeTruthy();
    expect(screen.queryByText(/HP Critical/)).toBeNull();
  });

  it('shows warning between inline results and controls', () => {
    characterState.character = { ...defaultCharacter, currentHp: 30n, maxHp: 100n };
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    render(<ActionsPanel />);

    // Both warning and results should be visible
    expect(screen.getByText(/HP Low/)).toBeTruthy();
    expect(screen.getByText('Defeated Dire Rat!')).toBeTruthy();
  });
});

describe('ActionsPanel — Elite Mob Display', () => {
  beforeEach(() => {
    setDefaults();
    vi.useFakeTimers();
    mockOnContinueToBattleOutcome.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows "Elite" prefix in auto adventure inline results for elite mobs', () => {
    battleState.opponent = { id: '0xmonster', name: 'Dire Rat', mobId: '1', isElite: true };
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    render(<ActionsPanel />);

    expect(screen.getByText('Defeated Elite Dire Rat!')).toBeTruthy();
  });

  it('does not show "Elite" prefix for normal mobs', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    render(<ActionsPanel />);

    expect(screen.getByText('Defeated Dire Rat!')).toBeTruthy();
    expect(screen.queryByText(/Elite/)).toBeNull();
  });

  it('shows "Elite" prefix in defeat text for elite mobs', () => {
    battleState.opponent = { id: '0xmonster', name: 'Dire Rat', mobId: '1', isElite: true };
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = lossOutcome;

    render(<ActionsPanel />);

    expect(screen.getByText('Defeated by Elite Dire Rat.')).toBeTruthy();
  });
});
