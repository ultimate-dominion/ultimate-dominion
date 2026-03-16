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
    opponent: { id: '0xmonster', name: 'Dire Rat', mobId: '1' },
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

  it('shows Victory with gold, XP, and item cards on win with items', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    render(<ActionsPanel />);

    expect(screen.getByText('Victory!')).toBeTruthy();
    expect(screen.getByText(/\+50 XP/)).toBeTruthy();
    expect(screen.getByText(/\+1\.00 Gold/)).toBeTruthy();
    expect(screen.getByText('Loot:')).toBeTruthy();
    expect(screen.getByTestId('item-card-Iron Shield')).toBeTruthy();
  });

  it('shows Victory without loot section when no items dropped', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = { ...winOutcome, itemsDropped: [] };

    render(<ActionsPanel />);

    expect(screen.getByText('Victory!')).toBeTruthy();
    expect(screen.getByText(/\+50 XP/)).toBeTruthy();
    expect(screen.queryByText('Loot:')).toBeNull();
  });

  it('shows Draw text on draw', () => {
    battleState.currentBattle = drawBattle;
    battleState.lastestBattleOutcome = { ...winOutcome, encounterId: '0xenc1' };

    render(<ActionsPanel />);

    expect(screen.getByText('Draw')).toBeTruthy();
  });

  // --- Unhappy paths ---

  it('shows Defeat and lost gold on loss, does NOT auto-dismiss', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = lossOutcome;

    render(<ActionsPanel />);

    expect(screen.getByText('Defeat...')).toBeTruthy();
    expect(screen.getByText(/-0\.50 Gold/)).toBeTruthy();

    // Advance past auto-dismiss timer — should NOT fire
    act(() => { vi.advanceTimersByTime(5000); });
    expect(mockOnContinueToBattleOutcome).not.toHaveBeenCalled();
  });

  it('shows idle state when no battle (autoFight TX not started)', () => {
    battleState.currentBattle = null;
    battleState.lastestBattleOutcome = null;

    render(<ActionsPanel />);

    expect(screen.getByText(/Auto Adventure/)).toBeTruthy();
    expect(screen.queryByText('Victory!')).toBeNull();
    expect(screen.queryByText('Defeat...')).toBeNull();
  });

  // --- Edge cases ---

  it('auto-dismiss fires after 3s on win', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    render(<ActionsPanel />);

    expect(mockOnContinueToBattleOutcome).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(3000); });

    expect(mockOnContinueToBattleOutcome).toHaveBeenCalledWith(false);
    expect(mockRefreshCharacter).toHaveBeenCalled();
    expect(localStorage.getItem('latest-battle-outcome-seen')).toBe('0xenc1');
  });

  it('new outcome resets the dismiss timer', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    const { rerender, unmount } = render(<ActionsPanel />);

    // Advance 2s — not yet dismissed
    act(() => { vi.advanceTimersByTime(2000); });
    expect(mockOnContinueToBattleOutcome).not.toHaveBeenCalled();

    // Remount with new outcome (must also update currentBattle encounterId to match)
    unmount();
    const newOutcome = { ...winOutcome, encounterId: '0xenc2' };
    battleState.lastestBattleOutcome = newOutcome;
    battleState.currentBattle = { ...normalBattle, encounterId: '0xenc2' };
    render(<ActionsPanel />);

    // Full 3s from new outcome
    act(() => { vi.advanceTimersByTime(3000); });
    expect(mockOnContinueToBattleOutcome).toHaveBeenCalledWith(false);
    expect(localStorage.getItem('latest-battle-outcome-seen')).toBe('0xenc2');
  });

  it('hides gold and XP lines when amounts are zero', () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = {
      ...winOutcome,
      expDropped: 0n,
      goldDropped: 0n,
      itemsDropped: [],
    };

    render(<ActionsPanel />);

    expect(screen.getByText('Victory!')).toBeTruthy();
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
    expect(screen.queryByText('Victory!')).toBeNull();
  });

  it('clicking an item card opens the equip modal', async () => {
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;

    render(<ActionsPanel />);

    const itemCard = screen.getByTestId('item-card-Iron Shield');
    fireEvent.click(itemCard);

    expect(screen.getByTestId('item-equip-modal')).toBeTruthy();
  });
});
