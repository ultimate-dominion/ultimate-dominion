import { render, screen, act, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { TileDetailsPanel } from './TileDetailsPanel';

// --- Shared mock state ---

const defaultCharacter = {
  id: '0xplayer',
  name: 'TestHero',
  owner: '0xowner',
  level: 5n,
  experience: 100n,
  currentHp: 50n,
  maxHp: 100n,
  strength: 10n,
  agility: 10n,
  intelligence: 10n,
  advancedClass: 0,
  image: '',
};

const testMonster = {
  id: '0xmonster1',
  name: 'Dire Rat',
  description: 'A big rat',
  image: '',
  mobId: '1',
  level: 3n,
  currentHp: 30n,
  maxHp: 30n,
  strength: 5n,
  agility: 5n,
  intelligence: 5n,
  armor: 0n,
  experience: 10n,
  entityClass: 0, // Strength
  hasBossAI: false,
  hitPoints: 30n,
  inventory: [],
  inBattle: false,
  isElite: false,
  isSpawned: true,
  position: { x: 1, y: 1 },
};

const normalBattle = {
  attackers: ['0xplayer'],
  defenders: ['0xmonster1'],
  encounterId: '0xenc1',
  encounterType: 0,
  end: 1n,
  start: 1n,
  currentTurn: 5n,
  maxTurns: 10n,
  currentTurnTimer: 0n,
};

const winOutcome = {
  attackers: ['0xplayer'],
  defenders: ['0xmonster1'],
  encounterId: '0xenc1',
  endTime: 100n,
  expDropped: 50n,
  goldDropped: 1000000000000000000n,
  itemsDropped: [],
  playerFled: false,
  winner: '0xplayer',
};

const mockAutoFight = vi.fn().mockResolvedValue({ success: true, error: null });
const mockCreateEncounter = vi.fn().mockResolvedValue({ success: true, error: null });
const mockRest = vi.fn().mockResolvedValue({ success: true, error: null });
const mockRefreshCharacter = vi.fn().mockResolvedValue(undefined);
const mockEncounterExecute = vi.fn();
const mockRestExecute = vi.fn();

// --- Context mocks ---

let battleState: Record<string, unknown> = {};
let characterState: Record<string, unknown> = {};
let movementState: Record<string, unknown> = {};
let mapState: Record<string, unknown> = {};
let fragmentState: Record<string, unknown> = {};
let mudState: Record<string, unknown> = {};

vi.mock('../contexts/BattleContext', () => ({
  useBattle: () => battleState,
}));

vi.mock('../contexts/CharacterContext', () => ({
  useCharacter: () => characterState,
}));

vi.mock('../contexts/MovementContext', () => ({
  useMovement: () => movementState,
}));

vi.mock('../contexts/MapContext', () => ({
  useMap: () => mapState,
}));

vi.mock('../contexts/FragmentContext', () => ({
  useFragments: () => fragmentState,
}));

vi.mock('../contexts/MUDContext', () => ({
  useMUD: () => mudState,
}));

// Track which transaction hook instance is being created (encounter vs rest)
let txCallCount = 0;
vi.mock('../hooks/useTransaction', () => ({
  useTransaction: () => {
    txCallCount++;
    // First call = encounterTx, second call = restTx
    if (txCallCount % 2 === 1) {
      return {
        execute: mockEncounterExecute,
        isLoading: false,
        statusMessage: '',
        status: 'idle',
        progress: { value: 0, status: 'idle' },
      };
    }
    return {
      execute: mockRestExecute,
      isLoading: false,
      statusMessage: '',
      status: 'idle',
      progress: { value: 0, status: 'idle' },
    };
  },
}));

vi.mock('../hooks/useBattleHpAnimation', () => ({
  useBattleHpAnimation: () => ({ displayedHp: 30n, isDotTicking: false }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    renderError: vi.fn(),
    renderSuccess: vi.fn(),
  }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; to: string }) =>
    <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock('../lib/gameStore', () => ({
  getTableValue: () => null,
  toBigInt: (v: unknown) => BigInt(v as number),
}));

vi.mock('../utils/monsterImages', () => ({
  getMonsterImage: (name: string) => name === 'Dire Rat' ? '/rat.png' : null,
}));

vi.mock('../utils/helpers', () => ({
  etherToFixedNumber: (val: bigint) => (Number(val) / 1e18).toFixed(2),
  getEmoji: () => '',
  removeEmoji: (s: string) => s,
}));

vi.mock('../utils/fragmentNarratives', () => ({
  getRomanNumeral: () => 'I',
}));

vi.mock('./AdventureEscrowModal', () => ({
  AdventureEscrowModal: () => null,
}));

vi.mock('./ClassSymbol', () => ({
  ClassSymbol: () => null,
}));

vi.mock('./FragmentClaimModal', () => ({
  FragmentClaimModal: () => null,
}));

vi.mock('./HealthBar', () => ({
  HealthBar: () => <div data-testid="health-bar" />,
}));

vi.mock('./InfoModal', () => ({
  InfoModal: () => null,
}));

vi.mock('./ShopRow', () => ({
  ShopRow: () => null,
}));

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual<typeof import('@chakra-ui/react')>('@chakra-ui/react');
  return {
    ...actual,
    useBreakpointValue: (values: Record<string, unknown>) => values.base ?? values.lg,
  };
});

function setDefaults() {
  txCallCount = 0;

  battleState = {
    attackOutcomes: [],
    currentBattle: null,
    dotActions: [],
    lastestBattleOutcome: null,
    opponent: null,
    statusEffectActions: [],
    userCharacterForBattleRendering: null,
  };

  characterState = {
    character: defaultCharacter,
    equippedSpells: [],
    equippedWeapons: [{ tokenId: '0xweapon1', name: 'Short Sword', strModifier: 10n, agiModifier: 0n, intModifier: 0n, maxDamage: 10n }],
    isMoveEquipped: true,
    isRefreshing: false,
    refreshCharacter: mockRefreshCharacter,
  };

  movementState = {
    autoAdventureMode: true,
    isRefreshing: false,
  };

  mapState = {
    inSafetyZone: false,
    isSpawned: true,
    monstersOnTile: [testMonster],
    otherCharactersOnTile: [],
    position: { x: 1, y: 1 },
    shopsOnTile: [],
  };

  fragmentState = {
    pendingEcho: null,
  };

  mudState = {
    delegatorAddress: '0xdelegator',
    systemCalls: {
      autoFight: mockAutoFight,
      createEncounter: mockCreateEncounter,
      rest: mockRest,
    },
  };

  // Default: execute calls the callback and returns result (success path)
  mockEncounterExecute.mockImplementation(async (fn: () => Promise<unknown>) => {
    return await fn();
  });
  mockRestExecute.mockImplementation(async (fn: () => Promise<unknown>) => {
    return await fn();
  });
}

describe('TileDetailsPanel — Loading Screen Timing', () => {
  beforeEach(() => {
    setDefaults();
    vi.useFakeTimers();
    mockAutoFight.mockClear();
    mockRefreshCharacter.mockClear();
    mockEncounterExecute.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // --- Happy paths ---

  it('shows loading screen with spinner when monster is clicked in auto-adventure', async () => {
    const { container } = render(<TileDetailsPanel />);

    // Find and click the monster row
    const monsterButton = screen.getByText('Dire Rat').closest('button');
    expect(monsterButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(monsterButton!);
    });

    // Loading screen should show with "Fighting Dire Rat" text
    expect(screen.getByText('Fighting Dire Rat')).toBeTruthy();
  });

  it('holds loading screen when currentBattle arrives (does not drop early)', async () => {
    const { rerender } = render(<TileDetailsPanel />);

    // Click monster to set pendingOpponent
    const monsterButton = screen.getByText('Dire Rat').closest('button');
    await act(async () => {
      fireEvent.click(monsterButton!);
    });

    expect(screen.getByText('Fighting Dire Rat')).toBeTruthy();

    // Simulate store sync: currentBattle arrives
    battleState.currentBattle = normalBattle;
    battleState.opponent = { ...testMonster, currentHp: 20n, worldStatusEffects: [] };
    battleState.userCharacterForBattleRendering = { ...defaultCharacter, currentHp: 45n, worldStatusEffects: [] };

    await act(async () => {
      rerender(<TileDetailsPanel />);
    });

    // Loading screen should STILL be showing — not dropped early
    // pendingOpponent is still set, battleWasActiveRef is now true
    expect(screen.queryByText('Fighting Dire Rat') || screen.queryByText('Dire Rat defeated')).toBeTruthy();
  });

  it('shows "defeated" text and hides spinner when battle is resolved', async () => {
    const { rerender } = render(<TileDetailsPanel />);

    // Click monster
    const monsterButton = screen.getByText('Dire Rat').closest('button');
    await act(async () => {
      fireEvent.click(monsterButton!);
    });

    // Simulate store sync: battle + outcome arrive
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;
    battleState.opponent = { ...testMonster, currentHp: 0n, worldStatusEffects: [] };
    battleState.userCharacterForBattleRendering = { ...defaultCharacter, currentHp: 45n, worldStatusEffects: [] };

    await act(async () => {
      rerender(<TileDetailsPanel />);
    });

    // Should show "defeated" text instead of "fighting"
    expect(screen.getByText('Dire Rat defeated')).toBeTruthy();
    // Spinner should not be present
    expect(screen.queryByText('Fighting Dire Rat')).toBeNull();
  });

  it('drops loading screen when currentBattle goes null (auto-dismiss fires)', async () => {
    const { rerender } = render(<TileDetailsPanel />);

    // Click monster
    const monsterButton = screen.getByText('Dire Rat').closest('button');
    await act(async () => {
      fireEvent.click(monsterButton!);
    });

    // Step 1: currentBattle arrives (battleWasActiveRef = true)
    battleState.currentBattle = normalBattle;
    battleState.lastestBattleOutcome = winOutcome;
    battleState.opponent = { ...testMonster, currentHp: 0n, worldStatusEffects: [] };
    battleState.userCharacterForBattleRendering = { ...defaultCharacter, currentHp: 45n, worldStatusEffects: [] };

    await act(async () => {
      rerender(<TileDetailsPanel />);
    });

    // Loading screen should still be up
    expect(screen.getByText('Dire Rat defeated')).toBeTruthy();

    // Step 2: auto-dismiss fires in ActionsPanel → currentBattle goes null
    battleState.currentBattle = null;
    battleState.opponent = null;
    battleState.userCharacterForBattleRendering = null;

    await act(async () => {
      rerender(<TileDetailsPanel />);
    });

    // Loading screen should be gone — monster list should show
    expect(screen.queryByText('Dire Rat defeated')).toBeNull();
    expect(screen.queryByText('Fighting Dire Rat')).toBeNull();
    // Monster list is visible again
    expect(screen.getByText('Dire Rat')).toBeTruthy();
  });

  // --- Edge cases ---

  it('safety timeout clears loading screen after 15s if store sync never arrives', async () => {
    render(<TileDetailsPanel />);

    // Click monster
    const monsterButton = screen.getByText('Dire Rat').closest('button');
    await act(async () => {
      fireEvent.click(monsterButton!);
    });

    expect(screen.getByText('Fighting Dire Rat')).toBeTruthy();

    // Advance 4s — should still show loading
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText('Fighting Dire Rat')).toBeTruthy();

    // Advance past 5s — safety timeout should clear
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Loading screen should be gone
    expect(screen.queryByText('Fighting Dire Rat')).toBeNull();
    expect(screen.getByText('Dire Rat')).toBeTruthy();
  });

  it('TX failure clears loading screen immediately', async () => {
    // Make execute return undefined (TX failure)
    mockEncounterExecute.mockImplementation(async () => undefined);

    render(<TileDetailsPanel />);

    const monsterButton = screen.getByText('Dire Rat').closest('button');
    await act(async () => {
      fireEvent.click(monsterButton!);
    });

    // Loading screen should NOT show — pendingOpponent was cleared on failure
    expect(screen.queryByText('Fighting Dire Rat')).toBeNull();
    expect(screen.getByText('Dire Rat')).toBeTruthy();
  });

  // --- Manual battle path (auto-adventure OFF) ---

  it('manual battle: loading screen drops when battle data is ready', async () => {
    movementState.autoAdventureMode = false;

    const { rerender } = render(<TileDetailsPanel />);

    // In manual mode, clicking sets isWaitingForBattle + pendingOpponent
    const monsterButton = screen.getByText('Dire Rat').closest('button');
    await act(async () => {
      fireEvent.click(monsterButton!);
    });

    // Loading screen should show
    expect(screen.getByText('Fighting Dire Rat')).toBeTruthy();

    // Battle data arrives — manual mode clears isWaitingForBattle and pendingOpponent immediately
    battleState.currentBattle = normalBattle;
    battleState.opponent = { ...testMonster, currentHp: 20n, maxHp: 30n, strength: 5n, agility: 5n, intelligence: 5n, entityClass: 0, worldStatusEffects: [] };
    battleState.userCharacterForBattleRendering = { ...defaultCharacter, currentHp: 45n, maxHp: 100n, strength: 10n, agility: 10n, intelligence: 10n, worldStatusEffects: [] };

    await act(async () => {
      rerender(<TileDetailsPanel />);
    });

    // Loading screen should be gone — battle view should render (manual mode shows full battle UI)
    expect(screen.queryByText('Fighting Dire Rat')).toBeNull();
  });
});
