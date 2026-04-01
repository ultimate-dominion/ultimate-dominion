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

vi.mock('../hooks/useNpcFlavor', () => ({
  useNpcFlavor: () => ({ title: '', flavor: '' }),
}));

vi.mock('./ClassSymbol', () => ({
  ClassSymbol: () => null,
}));

vi.mock('./FragmentClaimModal', () => ({
  FragmentClaimModal: () => null,
}));

vi.mock('./NpcDialogueModal', () => ({
  NpcDialogueModal: ({ npcName, npcId, metadataUri }: { npcName: string; npcId: string; metadataUri: string }) => (
    <div data-testid="npc-dialogue-modal">
      <span data-testid="dialogue-npc-name">{npcName}</span>
      <span data-testid="dialogue-npc-id">{npcId}</span>
    </div>
  ),
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
    npcsOnTile: [],
    otherCharactersOnTile: [],
    position: { x: 1, y: 1 },
    shopsOnTile: [],
    visibleMonstersOnTile: [testMonster],
    worldBosses: [],
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

  it('shows loading screen while TX is in flight, clears when TX completes', async () => {
    // Make execute hang (never resolve) to simulate in-flight TX
    let resolveExecute!: (value: unknown) => void;
    mockEncounterExecute.mockImplementation(() => new Promise(resolve => {
      resolveExecute = resolve;
    }));

    render(<TileDetailsPanel />);

    const monsterButton = screen.getByText('Dire Rat').closest('button');
    expect(monsterButton).toBeTruthy();

    // Click starts the TX — loading screen should show while TX is in flight
    act(() => {
      fireEvent.click(monsterButton!);
    });

    expect(screen.getByText('Fighting Dire Rat')).toBeTruthy();

    // TX completes — loading screen drops
    await act(async () => {
      resolveExecute(true);
    });

    expect(screen.queryByText('Fighting Dire Rat')).toBeNull();
    expect(screen.getByText('Dire Rat')).toBeTruthy();
  });

  it('drops loading screen when TX completes (not waiting for store sync)', async () => {
    render(<TileDetailsPanel />);

    // Click monster — setPendingOpponent then execute, both resolve immediately
    const monsterButton = screen.getByText('Dire Rat').closest('button');
    await act(async () => {
      fireEvent.click(monsterButton!);
    });

    // Loading screen should be gone — pendingOpponent cleared when execute resolved
    expect(screen.queryByText('Fighting Dire Rat')).toBeNull();
    // Monster list is visible
    expect(screen.getByText('Dire Rat')).toBeTruthy();
  });

  // --- Edge cases ---

  it('safety timeout clears loading screen after 5s if TX hangs', async () => {
    // Make execute never resolve to simulate hung TX
    mockEncounterExecute.mockImplementation(() => new Promise(() => {}));

    render(<TileDetailsPanel />);

    const monsterButton = screen.getByText('Dire Rat').closest('button');
    act(() => {
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

// --- Monster Collapse ---

const makeMonster = (overrides: Record<string, unknown>) => ({
  ...testMonster,
  ...overrides,
});

describe('TileDetailsPanel — Monster Collapse', () => {
  beforeEach(() => {
    setDefaults();
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows all monsters when 3 or fewer', () => {
    const monsters = [
      makeMonster({ id: '0xm1', name: 'Rat A', level: 2n }),
      makeMonster({ id: '0xm2', name: 'Rat B', level: 3n }),
    ];
    mapState.visibleMonstersOnTile = monsters;
    mapState.monstersOnTile = monsters;

    render(<TileDetailsPanel />);

    expect(screen.getByText('Rat A')).toBeTruthy();
    expect(screen.getByText('Rat B')).toBeTruthy();
    expect(screen.queryByText(/more monster/)).toBeNull();
  });

  it('collapses to 3 when more than 3 monsters, shows expand link', () => {
    const monsters = [
      makeMonster({ id: '0xm1', name: 'Rat A', level: 2n }),
      makeMonster({ id: '0xm2', name: 'Rat B', level: 3n }),
      makeMonster({ id: '0xm3', name: 'Rat C', level: 4n }),
      makeMonster({ id: '0xm4', name: 'Rat D', level: 6n }),
      makeMonster({ id: '0xm5', name: 'Rat E', level: 8n }),
    ];
    mapState.visibleMonstersOnTile = monsters;
    mapState.monstersOnTile = monsters;

    render(<TileDetailsPanel />);

    // 3 visible, 2 hidden
    expect(screen.getByText(/2 more monsters/)).toBeTruthy();
  });

  it('expands to show all monsters when clicked', async () => {
    // Player level = 5. Sorted by distance: Rat B(diff=0), Rat A(diff=1), Rat C(diff=2), Rat D(diff=5)
    const monsters = [
      makeMonster({ id: '0xm1', name: 'Rat A', level: 4n }),
      makeMonster({ id: '0xm2', name: 'Rat B', level: 5n }),
      makeMonster({ id: '0xm3', name: 'Rat C', level: 3n }),
      makeMonster({ id: '0xm4', name: 'Rat D', level: 10n }),
    ];
    mapState.visibleMonstersOnTile = monsters;
    mapState.monstersOnTile = monsters;

    render(<TileDetailsPanel />);

    // Initially only 3 visible — Rat D (furthest from player level) is hidden
    expect(screen.getByText(/1 more monster\.\.\./)).toBeTruthy();
    expect(screen.queryByText('Rat D')).toBeNull();

    // Expand
    await act(async () => {
      fireEvent.click(screen.getByText(/1 more monster/));
    });

    expect(screen.getByText('Rat D')).toBeTruthy();
    expect(screen.getByText('Show fewer')).toBeTruthy();
  });

  it('sorts elites first, then by level closeness to player', () => {
    // Player is level 5 (from defaultCharacter)
    const monsters = [
      makeMonster({ id: '0xm1', name: 'Far Rat', level: 1n, isElite: false }),
      makeMonster({ id: '0xm2', name: 'Close Rat', level: 4n, isElite: false }),
      makeMonster({ id: '0xm3', name: 'Elite Rat', level: 8n, isElite: true }),
      makeMonster({ id: '0xm4', name: 'Mid Rat', level: 3n, isElite: false }),
    ];
    mapState.visibleMonstersOnTile = monsters;
    mapState.monstersOnTile = monsters;

    render(<TileDetailsPanel />);

    // Only 3 shown (collapsed). Elite should be first, then Close Rat (diff=1), then Mid Rat (diff=2).
    // Far Rat (diff=4) should be hidden.
    const buttons = screen.getAllByRole('button');
    const monsterNames = buttons
      .map(b => b.textContent)
      .filter(t => t && ['Elite Rat', 'Close Rat', 'Mid Rat', 'Far Rat'].some(n => t.includes(n)));

    expect(monsterNames[0]).toContain('Elite Rat');
    expect(monsterNames[1]).toContain('Close Rat');
    expect(monsterNames[2]).toContain('Mid Rat');
    expect(screen.queryByText('Far Rat')).toBeNull();
  });
});

describe('TileDetailsPanel — NPC Dialogue Wiring', () => {
  beforeEach(() => {
    setDefaults();
  });

  afterEach(() => {
    cleanup();
  });

  it('clicking a dialogue NPC opens NpcDialogueModal with correct props', async () => {
    mapState.npcsOnTile = [{
      entityId: '0xvel123',
      mobId: '25',
      name: 'Vel Morrow',
      interaction: 'dialogue',
      position: { x: 1, y: 1 },
      metadataUri: 'npc:vel_morrow',
    }];
    mapState.monstersOnTile = [];
    mapState.visibleMonstersOnTile = [];

    render(<TileDetailsPanel />);

    const npcButton = screen.getByText('Vel Morrow').closest('button');
    expect(npcButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(npcButton!);
    });

    expect(screen.getByTestId('npc-dialogue-modal')).toBeTruthy();
    expect(screen.getByTestId('dialogue-npc-name').textContent).toBe('Vel Morrow');
    expect(screen.getByTestId('dialogue-npc-id').textContent).toBe('0xvel123');
  });

  it('clicking an examine NPC opens NpcDialogueModal', async () => {
    mapState.npcsOnTile = [{
      entityId: '0xjournal456',
      mobId: '30',
      name: 'Camp Journal',
      interaction: 'examine',
      position: { x: 1, y: 1 },
      metadataUri: 'worldobj:camp_journal',
    }];
    mapState.monstersOnTile = [];
    mapState.visibleMonstersOnTile = [];

    render(<TileDetailsPanel />);

    const npcButton = screen.getByText('Camp Journal').closest('button');
    expect(npcButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(npcButton!);
    });

    expect(screen.getByTestId('npc-dialogue-modal')).toBeTruthy();
    expect(screen.getByTestId('dialogue-npc-name').textContent).toBe('Camp Journal');
  });

  it('clicking a respec NPC does NOT open dialogue modal', async () => {
    mapState.npcsOnTile = [{
      entityId: '0xvel123',
      mobId: '25',
      name: 'Vel Morrow',
      interaction: 'respec',
      position: { x: 1, y: 1 },
      metadataUri: 'npc:vel_morrow',
    }];
    mapState.monstersOnTile = [];
    mapState.visibleMonstersOnTile = [];

    render(<TileDetailsPanel />);

    const npcButton = screen.getByText('Vel Morrow').closest('button');
    expect(npcButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(npcButton!);
    });

    expect(screen.queryByTestId('npc-dialogue-modal')).toBeNull();
  });
});
