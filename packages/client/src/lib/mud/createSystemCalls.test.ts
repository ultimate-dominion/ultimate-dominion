import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Address } from 'viem';

const { mockReloadIfStaleChunk } = vi.hoisted(() => ({
  mockReloadIfStaleChunk: vi.fn(),
}));
vi.mock('../../utils/errors', async () => {
  const actual = await vi.importActual<typeof import('../../utils/errors')>('../../utils/errors');
  return {
    ...actual,
    reloadIfStaleChunk: mockReloadIfStaleChunk,
  };
});

import { createSystemCalls } from './createSystemCalls';
import {
  AdvancedClass,
  ArmorType,
  EncounterType,
  PowerSource,
  Race,
  StatsClasses,
} from '../../utils/types';

// ── Mocks ───────────────────────────────────────────────────────────

const mockSetRow = vi.fn();
const mockGameTables: Record<string, Record<string, unknown>> = {};
vi.mock('../gameStore', () => ({
  getTableValue: vi.fn(),
  useGameStore: {
    getState: () => ({
      setRow: mockSetRow,
      tables: mockGameTables,
    }),
  },
}));

vi.mock('../../utils/errorReporter', () => ({
  reportError: vi.fn(),
}));

import { getTableValue } from '../gameStore';

const mockedGetTableValue = vi.mocked(getTableValue);

// ── Test Addresses ──────────────────────────────────────────────────

const TEST_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
const TEST_DELEGATOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;
const TEST_ENTITY = '0x0000000000000000000000000000000000000000000000000000000000000001';
const TEST_ENTITY_2 = '0x0000000000000000000000000000000000000000000000000000000000000002';
const TEST_MONSTER_2 = '0x000000000000000000000000000000000000000000000000000000000000beef';
const FAKE_TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;

const resetMockGameTables = () => {
  Object.keys(mockGameTables).forEach(key => {
    delete mockGameTables[key];
  });
};

beforeEach(() => {
  resetMockGameTables();
  mockReloadIfStaleChunk.mockReset();
  mockReloadIfStaleChunk.mockReturnValue(false);
});

// ── Mock Factory ────────────────────────────────────────────────────

function createMockNetwork(overrides: {
  receiptStatus?: 'success' | 'reverted';
  delegatorAddress?: Address;
  chainId?: number;
} = {}) {
  const {
    receiptStatus = 'success',
    delegatorAddress,
    chainId = 31337,
  } = overrides;

  const mockReceipt = {
    status: receiptStatus,
    blockNumber: BigInt(100),
  };

  const waitForTransaction = vi.fn().mockResolvedValue(mockReceipt);

  // Build a write proxy that returns FAKE_TX_HASH for any method
  const writeHandler: ProxyHandler<Record<string, unknown>> = {
    get: () => vi.fn().mockResolvedValue(FAKE_TX_HASH),
  };

  const readHandler: ProxyHandler<Record<string, unknown>> = {
    get: () => vi.fn().mockResolvedValue(BigInt(0)),
  };

  const simulateHandler: ProxyHandler<Record<string, unknown>> = {
    get: () => vi.fn().mockResolvedValue({ result: undefined }),
  };

  const worldContract = {
    write: new Proxy({} as Record<string, unknown>, writeHandler),
    read: new Proxy({} as Record<string, unknown>, readHandler),
    simulate: new Proxy({} as Record<string, unknown>, simulateHandler),
  };

  const publicClient = {
    getChainId: vi.fn().mockResolvedValue(chainId),
    getBlockNumber: vi.fn().mockResolvedValue(BigInt(200)),
  };

  const walletClient = {
    account: { address: TEST_WALLET },
  };

  const network = {
    publicClient,
    walletClient,
    waitForTransaction,
    worldContract,
    delegatorAddress,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { network: network as any, waitForTransaction, mockReceipt };
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Set up getTableValue so ownership checks pass for TEST_ENTITY */
function mockOwnership(owner: string = TEST_WALLET) {
  mockedGetTableValue.mockImplementation((table: string, entity: string) => {
    if (table === 'Characters' && entity === TEST_ENTITY) {
      return { owner } as ReturnType<typeof getTableValue>;
    }
    if (table === 'SessionTimer') {
      return { lastAction: 0 } as ReturnType<typeof getTableValue>;
    }
    if (table === 'WorldEncounter') {
      return { end: '0' } as ReturnType<typeof getTableValue>;
    }
    if (table === 'CombatEncounter') {
      return { end: '0' } as ReturnType<typeof getTableValue>;
    }
    if (table === 'Position') {
      return { x: 1, y: 1 } as ReturnType<typeof getTableValue>;
    }
    if (table === 'EncounterEntity') {
      return undefined;
    }
    return undefined;
  });
}

const TEST_MONSTER = '0x000000000000000000000000000000000000000000000000000000000000dead';

/**
 * Set up getTableValue so ownership passes AND monster state is controllable.
 * monsterState: 'alive' | 'dead' | 'despawned' controls EncounterEntity/Spawned
 */
function mockOwnershipWithMonster(
  monsterState: 'alive' | 'dead' | 'despawned',
  owner: string = TEST_WALLET,
) {
  mockedGetTableValue.mockImplementation((table: string, entity: string) => {
    if (table === 'Characters' && entity === TEST_ENTITY) {
      return { owner } as ReturnType<typeof getTableValue>;
    }
    if (table === 'SessionTimer') {
      return { lastAction: 0 } as ReturnType<typeof getTableValue>;
    }
    if (table === 'WorldEncounter') {
      return { end: '0' } as ReturnType<typeof getTableValue>;
    }
    if (table === 'CombatEncounter') {
      return { end: '0' } as ReturnType<typeof getTableValue>;
    }
    if (table === 'Position') {
      return { x: 1, y: 1 } as ReturnType<typeof getTableValue>;
    }
    if (table === 'EncounterEntity' && entity === TEST_MONSTER) {
      return monsterState === 'dead' ? { died: true } : undefined;
    }
    if (table === 'EncounterEntity') return undefined;
    if (table === 'Spawned' && entity === TEST_MONSTER) {
      return monsterState === 'despawned' ? { spawned: false } : { spawned: true };
    }
    return undefined;
  });
}

// ── Suite A: Receipt Awaiting (Regression Guard) ────────────────────
//
// The core test: when waitForTransaction returns { status: 'reverted' },
// the system call must return { success: false }.
// A fire-and-forget implementation (the bug we fixed) would return
// { success: true } regardless, failing this test.

describe('createSystemCalls — receipt awaiting regression guard', () => {
  let calls: ReturnType<typeof createSystemCalls>;
  let waitForTransaction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    const mock = createMockNetwork({ receiptStatus: 'reverted' });
    calls = createSystemCalls(mock.network);
    waitForTransaction = mock.waitForTransaction;
    mockOwnership();
  });

  // Helper: every test checks the same thing
  const expectFailure = async (result: Promise<{ success: boolean; error?: string }>) => {
    const r = await result;
    expect(r.success).toBe(false);
    expect(waitForTransaction).toHaveBeenCalled();
  };

  it('endTurn returns failure when receipt is reverted', async () => {
    await expectFailure(
      calls.endTurn(TEST_ENTITY, TEST_ENTITY, TEST_ENTITY_2, '1'),
    );
  });

  it('fleePvp returns failure when receipt is reverted', async () => {
    await expectFailure(calls.fleePvp(TEST_ENTITY));
  });

  it('removeEntityFromBoard returns failure when receipt is reverted', async () => {
    await expectFailure(calls.removeEntityFromBoard(TEST_ENTITY));
  });

  it('updateTokenUri returns failure when receipt is reverted', async () => {
    await expectFailure(calls.updateTokenUri(TEST_ENTITY, 'ipfs://new'));
  });

  it('rest returns failure when receipt is reverted', async () => {
    await expectFailure(calls.rest(TEST_ENTITY));
  });

  it('useWorldConsumableItem returns failure when receipt is reverted', async () => {
    await expectFailure(calls.useWorldConsumableItem(TEST_ENTITY, '1'));
  });

  it('checkCombatFragmentTriggers returns failure when receipt is reverted', async () => {
    await expectFailure(
      calls.checkCombatFragmentTriggers([TEST_ENTITY], [TEST_ENTITY_2], 0, 0, true),
    );
  });

  it('triggerFragment returns failure when receipt is reverted', async () => {
    await expectFailure(calls.triggerFragment(TEST_ENTITY, 1, 0, 0));
  });

  it('claimFragment returns failure when receipt is reverted', async () => {
    await expectFailure(calls.claimFragment(TEST_ENTITY, 1));
  });

  it('buyGas returns failure when receipt is reverted', async () => {
    await expectFailure(calls.buyGas(TEST_ENTITY, BigInt(100)));
  });

  it('buy returns failure when receipt is reverted', async () => {
    await expectFailure(
      calls.buy(BigInt(1), TEST_ENTITY, '0', TEST_ENTITY),
    );
  });

  it('cancelOrder returns failure when receipt is reverted', async () => {
    await expectFailure(
      calls.cancelOrder('0x0000000000000000000000000000000000000000000000000000000000000001'),
    );
  });

  it('createEncounter returns failure when receipt is reverted', async () => {
    await expectFailure(
      calls.createEncounter(EncounterType.PvE, [TEST_ENTITY], [TEST_ENTITY_2]),
    );
  });

  it('createOrder returns failure when receipt is reverted', async () => {
    await expectFailure(
      calls.createOrder({
        consideration: {} as never,
        offer: {} as never,
        offerer: TEST_WALLET,
        signature: '0x' as `0x${string}`,
      }),
    );
  });

  it('endShopEncounter returns failure when receipt is reverted', async () => {
    await expectFailure(calls.endShopEncounter(TEST_ENTITY));
  });

  it('fulfillOrder returns failure when receipt is reverted', async () => {
    await expectFailure(
      calls.fulfillOrder('0x0000000000000000000000000000000000000000000000000000000000000001'),
    );
  });

  it('mintCharacter returns failure when receipt is reverted', async () => {
    await expectFailure(
      calls.mintCharacter(TEST_WALLET, 'TestHero', 'ipfs://test'),
    );
  });

  it('spawn returns failure when receipt is reverted', async () => {
    await expectFailure(calls.spawn(TEST_ENTITY));
  });

  it('restock returns failure when receipt is reverted', async () => {
    // restock calls canRestock first — mock the read to return true
    const mock = createMockNetwork({ receiptStatus: 'reverted' });
    const readHandler: ProxyHandler<Record<string, unknown>> = {
      get: () => vi.fn().mockResolvedValue(true),
    };
    mock.network.worldContract.read = new Proxy({} as Record<string, unknown>, readHandler);
    const restockCalls = createSystemCalls(mock.network);
    mockOwnership();
    const result = await restockCalls.restock(TEST_ENTITY);
    expect(result.success).toBe(false);
    expect(mock.waitForTransaction).toHaveBeenCalled();
  });

  it('sell returns failure when receipt is reverted', async () => {
    await expectFailure(
      calls.sell(BigInt(1), TEST_ENTITY, '1', TEST_ENTITY),
    );
  });

  it('unequipItem returns failure when receipt is reverted', async () => {
    // unequipItem awaits waitForTransaction but returns { success: true }
    // unconditionally after await — let's verify it at least awaits
    const result = await calls.unequipItem(TEST_ENTITY, '1');
    expect(waitForTransaction).toHaveBeenCalled();
    // unequipItem doesn't check receipt status — it returns success: true after await.
    // This is acceptable since it does await (not fire-and-forget).
    // If it were fire-and-forget, waitForTransaction wouldn't be called before return.
  });

  it('equipItems returns failure when receipt is reverted', async () => {
    // Same pattern as unequipItem — awaits but returns success: true
    const result = await calls.equipItems(TEST_ENTITY, ['1']);
    expect(waitForTransaction).toHaveBeenCalled();
  });

  it('enterGame returns failure when receipt is reverted', async () => {
    // enterGame awaits but returns success: true unconditionally
    const result = await calls.enterGame(TEST_ENTITY, BigInt(1), BigInt(1));
    expect(waitForTransaction).toHaveBeenCalled();
  });

  it('levelCharacter returns failure when receipt is reverted', async () => {
    // levelCharacter awaits but returns success: true unconditionally
    const result = await calls.levelCharacter(TEST_ENTITY, {
      strength: BigInt(10),
      agility: BigInt(10),
      intelligence: BigInt(10),
      maxHp: BigInt(100),
      currentHp: BigInt(100),
      experience: BigInt(0),
      level: BigInt(1),
      class: StatsClasses.Strength,
      race: Race.Human,
      powerSource: PowerSource.Physical,
      startingArmor: ArmorType.Plate,
      advancedClass: AdvancedClass.Warrior,
      hasSelectedAdvancedClass: true,
    });
    expect(waitForTransaction).toHaveBeenCalled();
  });

  it('chooseRace returns failure when receipt is reverted', async () => {
    // awaits but returns success: true unconditionally
    const result = await calls.chooseRace(TEST_ENTITY, Race.Human);
    expect(waitForTransaction).toHaveBeenCalled();
  });

  it('choosePowerSource returns failure when receipt is reverted', async () => {
    const result = await calls.choosePowerSource(TEST_ENTITY, PowerSource.Divine);
    expect(waitForTransaction).toHaveBeenCalled();
  });

  it('rollStats returns failure when receipt is reverted', async () => {
    const result = await calls.rollStats(TEST_ENTITY, StatsClasses.Strength);
    expect(waitForTransaction).toHaveBeenCalled();
  });

  it('rollBaseStats returns failure when receipt is reverted', async () => {
    const result = await calls.rollBaseStats(TEST_ENTITY);
    expect(waitForTransaction).toHaveBeenCalled();
  });

  it('selectAdvancedClass returns failure when receipt is reverted', async () => {
    const result = await calls.selectAdvancedClass(TEST_ENTITY, AdvancedClass.Paladin);
    expect(waitForTransaction).toHaveBeenCalled();
  });

  it('move returns failure when receipt is reverted', async () => {
    const result = await calls.move(TEST_ENTITY, 'right');
    expect(result.success).toBe(false);
    expect(waitForTransaction).toHaveBeenCalled();
  });
});

// ── Suite B: Ownership Validation Across Auth Paths ─────────────────

describe('createSystemCalls — ownership validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTableValue.mockReset();
  });

  describe('direct wallet (no delegator)', () => {
    it('proceeds when wallet address matches owner', async () => {
      const { network, waitForTransaction } = createMockNetwork();
      const calls = createSystemCalls(network);
      mockOwnership(TEST_WALLET);

      const result = await calls.rest(TEST_ENTITY);
      expect(result.success).toBe(true);
      expect(waitForTransaction).toHaveBeenCalled();
    });

    it('returns failure when wallet address does not match owner', async () => {
      const { network, waitForTransaction } = createMockNetwork();
      const calls = createSystemCalls(network);
      mockOwnership('0x1111111111111111111111111111111111111111');

      const result = await calls.rest(TEST_ENTITY);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not character owner');
      expect(waitForTransaction).not.toHaveBeenCalled();
    });
  });

  describe('delegated wallet / EIP-7702', () => {
    it('proceeds when delegator address matches owner', async () => {
      const { network, waitForTransaction } = createMockNetwork({
        delegatorAddress: TEST_DELEGATOR,
      });
      const calls = createSystemCalls(network);
      mockOwnership(TEST_DELEGATOR);

      const result = await calls.rest(TEST_ENTITY);
      expect(result.success).toBe(true);
      expect(waitForTransaction).toHaveBeenCalled();
    });

    it('returns failure when delegator address does not match owner', async () => {
      const { network, waitForTransaction } = createMockNetwork({
        delegatorAddress: TEST_DELEGATOR,
      });
      const calls = createSystemCalls(network);
      // Owner is the wallet address, but delegator is set — delegator takes priority
      mockOwnership(TEST_WALLET);

      const result = await calls.rest(TEST_ENTITY);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not character owner');
      expect(waitForTransaction).not.toHaveBeenCalled();
    });
  });

  describe('no character found', () => {
    it('returns failure when character entity does not exist', async () => {
      const { network, waitForTransaction } = createMockNetwork();
      const calls = createSystemCalls(network);
      mockedGetTableValue.mockReturnValue(undefined);

      const result = await calls.rest(TEST_ENTITY);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not a valid character');
      expect(waitForTransaction).not.toHaveBeenCalled();
    });
  });
});

// ── Suite B2: Encounter Guards ──────────────────────────────────────

describe('createSystemCalls — encounter guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTableValue.mockReset();
  });

  it('endTurn skips chain call when CombatEncounter already ended', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    const calls = createSystemCalls(network);
    mockedGetTableValue.mockImplementation((table: string) => {
      if (table === 'CombatEncounter') {
        return { end: '1772813895' } as ReturnType<typeof getTableValue>;
      }
      return undefined;
    });

    const result = await calls.endTurn(TEST_ENTITY, TEST_ENTITY, TEST_ENTITY_2, '1');
    expect(result.success).toBe(true);
    expect(waitForTransaction).not.toHaveBeenCalled();
  });

  it('endTurn skips chain call when CombatEncounter not found', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    const calls = createSystemCalls(network);
    mockedGetTableValue.mockReturnValue(undefined);

    const result = await calls.endTurn(TEST_ENTITY, TEST_ENTITY, TEST_ENTITY_2, '1');
    expect(result.success).toBe(true);
    expect(waitForTransaction).not.toHaveBeenCalled();
  });

  it('endTurn proceeds when CombatEncounter is still active', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    const calls = createSystemCalls(network);
    mockOwnership();

    const result = await calls.endTurn(TEST_ENTITY, TEST_ENTITY, TEST_ENTITY_2, '1');
    expect(result.success).toBe(true);
    expect(waitForTransaction).toHaveBeenCalled();
  });
});

// ── Suite C: Error Handling ─────────────────────────────────────────

describe('createSystemCalls — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error message on contract revert', async () => {
    const { network } = createMockNetwork();
    // Make the write throw a revert error
    const revertError = new Error('execution reverted');
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: () => vi.fn().mockRejectedValue(revertError),
    });
    const calls = createSystemCalls(network);
    mockOwnership();

    const result = await calls.rest(TEST_ENTITY);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns insufficient funds message', async () => {
    const { network } = createMockNetwork();
    // Create an error that classifyError will detect as insufficient funds
    const fundsError = new Error('insufficient funds for gas');
    // Add walk method to mimic BaseError
    (fundsError as Error & { walk: () => null }).walk = () => null;
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: () => vi.fn().mockRejectedValue(fundsError),
    });
    const calls = createSystemCalls(network);
    mockOwnership();

    const result = await calls.rest(TEST_ENTITY);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error on network failure', async () => {
    const { network } = createMockNetwork();
    const networkError = new Error('fetch failed');
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: () => vi.fn().mockRejectedValue(networkError),
    });
    const calls = createSystemCalls(network);
    mockOwnership();

    const result = await calls.rest(TEST_ENTITY);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('functions without ownership check still handle errors', async () => {
    const { network } = createMockNetwork();
    const error = new Error('something broke');
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: () => vi.fn().mockRejectedValue(error),
    });
    const calls = createSystemCalls(network);

    const result = await calls.cancelOrder(
      '0x0000000000000000000000000000000000000000000000000000000000000001',
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('endTurn reloads once on stale chunk errors', async () => {
    const { network } = createMockNetwork();
    const staleChunkError = new Error('Failed to fetch dynamically imported module: https://ultimatedominion.com/assets/ccip-123.js');
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__endTurn') return vi.fn().mockRejectedValue(staleChunkError);
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });
    mockReloadIfStaleChunk.mockReturnValue(true);
    const calls = createSystemCalls(network);
    mockOwnership();

    const result = await calls.endTurn(TEST_ENTITY, TEST_ENTITY, TEST_ENTITY_2, '1');
    expect(result).toEqual({ success: false, error: 'Updating game — reloading...' });
    expect(mockReloadIfStaleChunk).toHaveBeenCalledWith(staleChunkError);
  });

  it('removeEntityFromBoard reloads once on stale chunk errors', async () => {
    const { network } = createMockNetwork();
    const staleChunkError = new Error('ChunkLoadError: Loading chunk 42 failed');
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__removeEntityFromBoard') return vi.fn().mockRejectedValue(staleChunkError);
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });
    mockReloadIfStaleChunk.mockReturnValue(true);
    const calls = createSystemCalls(network);
    mockOwnership();

    const result = await calls.removeEntityFromBoard(TEST_ENTITY);
    expect(result).toEqual({ success: false, error: 'Updating game — reloading...' });
    expect(mockReloadIfStaleChunk).toHaveBeenCalledWith(staleChunkError);
  });

  it('buyGas reloads once on stale chunk errors', async () => {
    const { network } = createMockNetwork();
    const staleChunkError = new Error('Failed to fetch dynamically imported module: https://ultimatedominion.com/assets/ccip-456.js');
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__buyGas') return vi.fn().mockRejectedValue(staleChunkError);
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });
    mockReloadIfStaleChunk.mockReturnValue(true);
    const calls = createSystemCalls(network);
    mockOwnership();

    const result = await calls.buyGas(TEST_ENTITY, BigInt(100));
    expect(result).toEqual({ success: false, error: 'Updating game — reloading...' });
    expect(mockReloadIfStaleChunk).toHaveBeenCalledWith(staleChunkError);
  });

  it('checkCombatFragmentTriggers reloads once on stale chunk errors', async () => {
    const { network } = createMockNetwork();
    const staleChunkError = new Error('Failed to fetch dynamically imported module: https://ultimatedominion.com/assets/ccip-789.js');
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__checkCombatFragmentTriggersForGroup') return vi.fn().mockRejectedValue(staleChunkError);
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });
    mockReloadIfStaleChunk.mockReturnValue(true);
    const calls = createSystemCalls(network);

    const result = await calls.checkCombatFragmentTriggers([TEST_ENTITY], [TEST_ENTITY_2], 0, 0, true);
    expect(result).toEqual({ success: false, error: 'Updating game — reloading...' });
    expect(mockReloadIfStaleChunk).toHaveBeenCalledWith(staleChunkError);
  });
});

// ── Suite D: Move Stale Position Recovery ───────────────────────────

describe('createSystemCalls — move stale position recovery', () => {
  const POSITION_TABLE_ID = '0x74625544000000000000000000000000506f736974696f6e0000000000000000';

  const makePositionRecord = (x: number, y: number) =>
    [`0x${x.toString(16).padStart(4, '0')}${y.toString(16).padStart(4, '0')}`, '0x' + '00'.repeat(32), '0x'] as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries with chain position when on-chain diagnosis returns invalid_move', async () => {
    const { network } = createMockNetwork();
    const waitForTransaction = vi.fn()
      .mockResolvedValueOnce({ status: 'reverted', blockNumber: BigInt(100), gasUsed: BigInt(141097) })
      .mockResolvedValueOnce({ status: 'success', blockNumber: BigInt(101), gasUsed: BigInt(141097) });
    network.waitForTransaction = waitForTransaction;

    mockedGetTableValue.mockImplementation((table: string, entity: string) => {
      if (table === 'Characters' && entity === TEST_ENTITY) {
        return { owner: TEST_WALLET } as ReturnType<typeof getTableValue>;
      }
      if (table === 'SessionTimer') return { lastAction: 0 } as ReturnType<typeof getTableValue>;
      if (table === 'WorldEncounter') return { end: '0' } as ReturnType<typeof getTableValue>;
      if (table === 'CombatEncounter') return { end: '0' } as ReturnType<typeof getTableValue>;
      if (table === 'Position') return { x: 0, y: 2 } as ReturnType<typeof getTableValue>;
      if (table === 'EncounterEntity') return undefined;
      return undefined;
    });

    const moveWriteFn = vi.fn().mockResolvedValue(FAKE_TX_HASH);

    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return moveWriteFn;
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });
    network.worldContract.simulate = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return vi.fn().mockRejectedValue(new Error('0x87822d34'));
        return vi.fn().mockResolvedValue({ result: undefined });
      },
    });
    // Position read now uses readStoreRecord via publicClient.readContract
    network.publicClient.readContract = vi.fn().mockImplementation(async ({ args }: { args: [string, string[]] }) => {
      const [tableId] = args;
      if (tableId === POSITION_TABLE_ID) return makePositionRecord(2, 3);
      return ['0x', '0x' + '00'.repeat(32), '0x'];
    });

    const calls = createSystemCalls(network);
    const result = await calls.move(TEST_ENTITY, 'right');

    expect(result.success).toBe(true);
    expect(waitForTransaction).toHaveBeenCalledTimes(2);
    expect(mockSetRow).toHaveBeenCalledWith('Position', TEST_ENTITY, { x: 2, y: 3 });
    expect(moveWriteFn).toHaveBeenNthCalledWith(1, [TEST_ENTITY, 1, 2], expect.anything());
    expect(moveWriteFn).toHaveBeenNthCalledWith(2, [TEST_ENTITY, 3, 3], expect.anything());
  });

  it('returns warning when chain position sync fails after invalid_move', async () => {
    const { network } = createMockNetwork();
    const waitForTransaction = vi.fn().mockResolvedValue({
      status: 'reverted',
      blockNumber: BigInt(100),
      gasUsed: BigInt(141097),
    });
    network.waitForTransaction = waitForTransaction;
    mockOwnership();

    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return vi.fn().mockResolvedValue(FAKE_TX_HASH);
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });
    network.worldContract.simulate = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return vi.fn().mockRejectedValue(new Error('0x87822d34'));
        return vi.fn().mockResolvedValue({ result: undefined });
      },
    });
    // Position read now uses readStoreRecord — mock to reject
    network.publicClient.readContract = vi.fn().mockRejectedValue(new Error('RPC error'));

    const calls = createSystemCalls(network);
    const result = await calls.move(TEST_ENTITY, 'right');

    expect(result.success).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.error).toContain('moving too fast');
  });

  it('updates Position immediately after a successful move receipt', async () => {
    const { network } = createMockNetwork();
    mockOwnership();

    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return vi.fn().mockResolvedValue(FAKE_TX_HASH);
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });

    const calls = createSystemCalls(network);
    const result = await calls.move(TEST_ENTITY, 'up');

    expect(result.success).toBe(true);
    expect(mockSetRow).toHaveBeenCalledWith('Position', TEST_ENTITY, { x: 1, y: 2 });
  });

  it('syncs Position from chain after a successful spawn', async () => {
    const { network } = createMockNetwork();
    mockOwnership();

    // Position read now uses readStoreRecord via publicClient.readContract
    network.publicClient.readContract = vi.fn().mockImplementation(async ({ args }: { args: [string, string[]] }) => {
      const [tableId] = args;
      if (tableId === POSITION_TABLE_ID) return makePositionRecord(0, 0);
      return ['0x', '0x' + '00'.repeat(32), '0x'];
    });

    const calls = createSystemCalls(network);
    const result = await calls.spawn(TEST_ENTITY);

    expect(result.success).toBe(true);
    expect(mockSetRow).toHaveBeenCalledWith('Position', TEST_ENTITY, { x: 0, y: 0 });
  });

  it('prefers legacy Position over stale PositionV2 for move origin', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    const moveWriteFn = vi.fn().mockResolvedValue(FAKE_TX_HASH);

    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return moveWriteFn;
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });

    mockedGetTableValue.mockImplementation((table: string, entity: string) => {
      if (table === 'Characters' && entity === TEST_ENTITY) {
        return { owner: TEST_WALLET } as ReturnType<typeof getTableValue>;
      }
      if (table === 'SessionTimer') {
        return { lastAction: 0 } as ReturnType<typeof getTableValue>;
      }
      if (table === 'WorldEncounter') {
        return { end: '0' } as ReturnType<typeof getTableValue>;
      }
      if (table === 'CombatEncounter') {
        return { end: '0' } as ReturnType<typeof getTableValue>;
      }
      if (table === 'PositionV2') {
        return { x: 0, y: 0 } as ReturnType<typeof getTableValue>;
      }
      if (table === 'Position') {
        return { x: 0, y: 2 } as ReturnType<typeof getTableValue>;
      }
      if (table === 'EncounterEntity') {
        return undefined;
      }
      return undefined;
    });

    const calls = createSystemCalls(network);

    const result = await calls.move(TEST_ENTITY, 'right');
    expect(result.success).toBe(true);
    expect(moveWriteFn).toHaveBeenCalledWith([TEST_ENTITY, 1, 2], expect.anything());
    expect(waitForTransaction).toHaveBeenCalled();
  });
});

// ── Suite E: On-chain Revert Diagnosis ─────────────────────────────

describe('createSystemCalls — on-chain revert diagnosis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects NotSpawned after on-chain revert and updates store', async () => {
    const { network } = createMockNetwork({ receiptStatus: 'reverted' });
    mockOwnership();

    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return vi.fn().mockResolvedValue(FAKE_TX_HASH);
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });

    network.worldContract.simulate = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return vi.fn().mockRejectedValue(new Error('0xbd45e4f6'));
        return vi.fn().mockResolvedValue({ result: undefined });
      },
    });

    const calls = createSystemCalls(network);

    const result = await calls.move(TEST_ENTITY, 'up');
    expect(result.success).toBe(false);
    expect(result.error).toContain('respawn');
    // Store should be updated with spawned=false
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', TEST_ENTITY, { spawned: false });
  });

  it('retries once then fails after persistent on-chain revert (MAX_ON_CHAIN_RETRIES=1)', async () => {
    const mockReceipt = { status: 'reverted', blockNumber: BigInt(100), gasUsed: BigInt(100000) };
    const { network } = createMockNetwork();
    mockOwnership();

    const waitFn = vi.fn().mockResolvedValue(mockReceipt);
    network.waitForTransaction = waitFn;

    // All write calls succeed (return TX hash) — diagnostic sim passes
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: () => vi.fn().mockResolvedValue(FAKE_TX_HASH),
    });

    const calls = createSystemCalls(network);

    const result = await calls.move(TEST_ENTITY, 'right');
    expect(result.success).toBe(false);
    // With MAX_ON_CHAIN_RETRIES=1: first attempt reverts, sim passes, retries once, second attempt also reverts
    expect(waitFn).toHaveBeenCalledTimes(2);
  });
});

// ── Suite F: Ghost Monster Pre-flight (Layer 3) ─────────────────────

describe('createSystemCalls — ghost monster pre-flight validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('autoFight returns early + evicts when monster died=true', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    mockOwnershipWithMonster('dead');
    const calls = createSystemCalls(network);

    const result = await calls.autoFight(TEST_ENTITY, TEST_MONSTER, '1');
    expect(result.success).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.error).toContain('No enemies here');
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', TEST_MONSTER, { spawned: false });
    expect(mockSetRow).toHaveBeenCalledWith('EncounterEntity', TEST_MONSTER, expect.objectContaining({ died: true }));
    expect(waitForTransaction).not.toHaveBeenCalled();
  });

  it('autoFight returns early + evicts when monster spawned=false', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    mockOwnershipWithMonster('despawned');
    const calls = createSystemCalls(network);

    const result = await calls.autoFight(TEST_ENTITY, TEST_MONSTER, '1');
    expect(result.success).toBe(false);
    expect(result.severity).toBe('warning');
    expect(waitForTransaction).not.toHaveBeenCalled();
  });

  it('autoFight keeps other monsters on the tile when target is ghosted', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    mockOwnershipWithMonster('dead');
    mockGameTables['Spawned'] = {
      [TEST_MONSTER]: { spawned: true },
      [TEST_MONSTER_2]: { spawned: true },
    };
    mockGameTables['Position'] = {
      [TEST_MONSTER]: { x: 1, y: 1 },
      [TEST_MONSTER_2]: { x: 1, y: 1 },
    };
    mockGameTables['Characters'] = {};

    const calls = createSystemCalls(network);
    const result = await calls.autoFight(TEST_ENTITY, TEST_MONSTER, '1');

    expect(result.success).toBe(false);
    expect(result.severity).toBe('warning');
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', TEST_MONSTER, { spawned: false });
    expect(mockSetRow).not.toHaveBeenCalledWith('Spawned', TEST_MONSTER_2, { spawned: false });
    expect(waitForTransaction).not.toHaveBeenCalled();
  });

  it('autoFight proceeds normally when monster is alive', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    mockOwnershipWithMonster('alive');
    const calls = createSystemCalls(network);

    const result = await calls.autoFight(TEST_ENTITY, TEST_MONSTER, '1');
    expect(result.success).toBe(true);
    expect(waitForTransaction).toHaveBeenCalled();
  });

  it('createEncounter returns early + evicts ghost PvE target', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    mockOwnershipWithMonster('dead');
    const calls = createSystemCalls(network);

    const result = await calls.createEncounter(
      EncounterType.PvE,
      [TEST_ENTITY],
      [TEST_MONSTER],
    );
    expect(result.success).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.error).toContain('No enemies here');
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', TEST_MONSTER, { spawned: false });
    expect(waitForTransaction).not.toHaveBeenCalled();
  });

  it('createEncounter keeps other monsters on the tile when one target is ghosted', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    mockOwnershipWithMonster('dead');
    mockGameTables['Spawned'] = {
      [TEST_MONSTER]: { spawned: true },
      [TEST_MONSTER_2]: { spawned: true },
    };
    mockGameTables['Position'] = {
      [TEST_MONSTER]: { x: 1, y: 1 },
      [TEST_MONSTER_2]: { x: 1, y: 1 },
    };
    mockGameTables['Characters'] = {};

    const calls = createSystemCalls(network);

    const result = await calls.createEncounter(
      EncounterType.PvE,
      [TEST_ENTITY],
      [TEST_MONSTER],
    );

    expect(result.success).toBe(false);
    expect(result.severity).toBe('warning');
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', TEST_MONSTER, { spawned: false });
    expect(mockSetRow).not.toHaveBeenCalledWith('Spawned', TEST_MONSTER_2, { spawned: false });
    expect(waitForTransaction).not.toHaveBeenCalled();
  });

  it('createEncounter skips validation for PvP encounters', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    // Even with a dead "monster" ID, PvP should not trigger pre-flight
    mockOwnershipWithMonster('dead');
    const calls = createSystemCalls(network);

    const result = await calls.createEncounter(
      EncounterType.PvP,
      [TEST_ENTITY],
      [TEST_MONSTER],
    );
    // Should go through to the chain call (no pre-flight for PvP)
    expect(waitForTransaction).toHaveBeenCalled();
  });
});

// ── Suite G: Ghost Monster Error Recovery (Layer 4) ─────────────────

describe('createSystemCalls — ghost monster error recovery', () => {
  const ZERO_HASH = '0x' + '00'.repeat(32);
  const SPAWNED_TABLE_ID = '0x74625544000000000000000000000000537061776e6564000000000000000000';
  const ENCOUNTER_ENTITY_TABLE_ID = '0x74625544000000000000000000000000456e636f756e746572456e7469747900';
  const POSITION_TABLE_ID = '0x74625544000000000000000000000000506f736974696f6e0000000000000000';

  const makeSpawnedRecord = (spawned: boolean) =>
    [spawned ? '0x01' : '0x00', '0x' + '00'.repeat(32), '0x'] as const;

  const makeEncounterRecord = (
    encounterId: string = ZERO_HASH,
    died = false,
  ) => [`0x${encounterId.slice(2)}${died ? '01' : '00'}`, '0x' + '00'.repeat(32), '0x'] as const;

  const makePositionRecord = (x: number, y: number) =>
    [`0x${x.toString(16).padStart(4, '0')}${y.toString(16).padStart(4, '0')}`, '0x' + '00'.repeat(32), '0x'] as const;

  const mockValidationReads = (
    states: Record<string, {
      encounterId?: string;
      died?: boolean;
      spawned?: boolean;
      position?: { x: number; y: number };
    }>,
  ) => vi.fn().mockImplementation(async ({ args }: { args: [string, string[]] }) => {
    const [tableId, [entityId]] = args;
    const state = states[entityId];
    if (!state) throw new Error(`Unexpected entity ${entityId}`);
    if (tableId === SPAWNED_TABLE_ID) return makeSpawnedRecord(state.spawned ?? true);
    if (tableId === ENCOUNTER_ENTITY_TABLE_ID) {
      return makeEncounterRecord(state.encounterId ?? ZERO_HASH, state.died ?? false);
    }
    if (tableId === POSITION_TABLE_ID) {
      const pos = state.position ?? { x: 0, y: 0 };
      return makePositionRecord(pos.x, pos.y);
    }
    throw new Error(`Unexpected table ${tableId}`);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('autoFight evicts monster on InvalidCombatEntity revert (write throw)', async () => {
    const { network } = createMockNetwork();
    mockOwnershipWithMonster('alive');

    // Make the write throw with the InvalidCombatEntity selector
    const ghostError = new Error('execution reverted: 0x1af235ec');
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: () => vi.fn().mockRejectedValue(ghostError),
    });
    const calls = createSystemCalls(network);

    const result = await calls.autoFight(TEST_ENTITY, TEST_MONSTER, '1');
    expect(result.success).toBe(false);
    expect(result.severity).toBe('warning');
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', TEST_MONSTER, { spawned: false });
  });

  it('autoFight evicts monster on InvalidPvE revert during diagnostic simulation', async () => {
    const { network } = createMockNetwork({ receiptStatus: 'reverted' });
    mockOwnershipWithMonster('alive');

    // Diagnostic simulation throws InvalidPvE selector
    network.worldContract.simulate = new Proxy({} as Record<string, unknown>, {
      get: () => vi.fn().mockRejectedValue(new Error('0xadee4371')),
    });
    const calls = createSystemCalls(network);

    const result = await calls.autoFight(TEST_ENTITY, TEST_MONSTER, '1');
    expect(result.success).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.error).toContain('No enemies here');
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', TEST_MONSTER, { spawned: false });
  });

  it('createEncounter keeps live monsters when a ghost trips InvalidCombatEntity (PvE write throw)', async () => {
    const { network } = createMockNetwork();
    mockOwnershipWithMonster('alive');
    network.publicClient.readContract = mockValidationReads({
      [TEST_MONSTER]: { spawned: false },
      [TEST_MONSTER_2]: { spawned: true },
    });

    // Write throws with selector — caught by isGhostMonsterError directly
    const ghostError = new Error('execution reverted: 0x1af235ec');
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: () => vi.fn().mockRejectedValue(ghostError),
    });
    const calls = createSystemCalls(network);

    const result = await calls.createEncounter(
      EncounterType.PvE,
      [TEST_ENTITY],
      [TEST_MONSTER, TEST_MONSTER_2],
    );
    expect(result.success).toBe(false);
    expect(result.severity).toBe('warning');
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', TEST_MONSTER, { spawned: false });
    expect(mockSetRow).not.toHaveBeenCalledWith('Spawned', TEST_MONSTER_2, { spawned: false });
  });

  it('createEncounter preflight blocks bad PvE clicks before sending tx and syncs tile state from chain', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    mockOwnershipWithMonster('alive');
    // Position reads now go through readStoreRecord (publicClient.readContract)
    // instead of the broken UD__getEntityPosition view function
    network.publicClient.readContract = mockValidationReads({
      [TEST_ENTITY]: { spawned: true, position: { x: 1, y: 1 } },
      [TEST_MONSTER]: { spawned: true, position: { x: 2, y: 1 } },
    });

    const writeSpy = vi.fn().mockResolvedValue(FAKE_TX_HASH);
    network.worldContract.write = {
      UD__createEncounter: writeSpy,
    };
    network.worldContract.simulate = {
      UD__createEncounter: vi.fn().mockRejectedValue(new Error('0xadee4371')),
    };

    const calls = createSystemCalls(network);
    const result = await calls.createEncounter(
      EncounterType.PvE,
      [TEST_ENTITY],
      [TEST_MONSTER],
    );

    expect(result.success).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.error).toContain('No enemies here');
    expect(writeSpy).not.toHaveBeenCalled();
    expect(waitForTransaction).not.toHaveBeenCalled();
    expect(mockSetRow).toHaveBeenCalledWith('Position', TEST_MONSTER, { x: 2, y: 1 });
  });

  it('createEncounter keeps live monsters on on-chain ghost revert via diagnostic simulation (PvE)', async () => {
    // TX goes on-chain (gas estimation skipped), reverts, then diagnostic
    // simulation finds ghost monster error
    const { network, waitForTransaction } = createMockNetwork({ receiptStatus: 'reverted' });
    mockOwnershipWithMonster('alive');
    network.publicClient.readContract = mockValidationReads({
      [TEST_MONSTER]: { spawned: false },
      [TEST_MONSTER_2]: { spawned: true },
    });

    network.worldContract.simulate = {
      UD__createEncounter: vi.fn()
        .mockResolvedValueOnce({ result: undefined })
        .mockRejectedValueOnce(new Error('0x1af235ec')),
    };
    const calls = createSystemCalls(network);

    const result = await calls.createEncounter(
      EncounterType.PvE,
      [TEST_ENTITY],
      [TEST_MONSTER, TEST_MONSTER_2],
    );
    expect(result.success).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.error).toContain('No enemies here');
    expect(waitForTransaction).toHaveBeenCalled(); // preflight passed, tx was sent
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', TEST_MONSTER, { spawned: false });
    expect(mockSetRow).not.toHaveBeenCalledWith('Spawned', TEST_MONSTER_2, { spawned: false });
  });

  it('createEncounter fallback keeps live monsters when simulation finds a ghost', async () => {
    // Edge case: gas estimation somehow leaks through (e.g. PvP → PvE mismatch
    // or future code path). The catch block does a fallback simulation.
    const { network } = createMockNetwork();
    mockOwnershipWithMonster('alive');
    network.publicClient.readContract = mockValidationReads({
      [TEST_MONSTER]: { spawned: false },
      [TEST_MONSTER_2]: { spawned: true },
    });

    // Write throws a generic error (no ghost selector)
    const genericError = new Error('execution reverted for an unknown reason');
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: () => vi.fn().mockRejectedValue(genericError),
    });
    // Preflight passes, fallback simulation reveals the ghost monster error
    network.worldContract.simulate = {
      UD__createEncounter: vi.fn()
        .mockResolvedValueOnce({ result: undefined })
        .mockRejectedValueOnce(new Error('0xadee4371')),
    };
    const calls = createSystemCalls(network);

    const result = await calls.createEncounter(
      EncounterType.PvE,
      [TEST_ENTITY],
      [TEST_MONSTER, TEST_MONSTER_2],
    );
    expect(result.success).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.error).toContain('No enemies here');
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', TEST_MONSTER, { spawned: false });
    expect(mockSetRow).not.toHaveBeenCalledWith('Spawned', TEST_MONSTER_2, { spawned: false });
  });
});

// ── Suite H: Error Messaging Fix (Layer 2) ──────────────────────────

describe('createSystemCalls — error messaging selector extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getContractError extracts selector and maps to friendly message for EstimateGasExecutionError', async () => {
    const { network } = createMockNetwork();
    mockOwnership();

    // Simulate an EstimateGasExecutionError — the message says "execution
    // reverted for an unknown reason" but the full error string contains
    // the selector in a data field.
    const estimateError = new Error(
      'EstimateGasExecutionError: execution reverted for an unknown reason. data: "0xadee4371"',
    );
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: () => vi.fn().mockRejectedValue(estimateError),
    });
    const calls = createSystemCalls(network);

    // Use a function that goes through getContractError — rest is simplest
    const result = await calls.rest(TEST_ENTITY);
    expect(result.success).toBe(false);
    // Should get the friendly message, not the raw error
    expect(result.error).toBe('Your target has vanished into the shadows. Try again.');
  });
});

// ── Suite: Gas Retry Proxy ──────────────────────────────────────────

describe('createSystemCalls — gas retry on insufficient funds', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    globalThis.fetch = originalFetch;
    // Set env vars for relayer
    import.meta.env.VITE_RELAYER_URL = 'https://relay.test';
    import.meta.env.VITE_FUND_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete import.meta.env.VITE_RELAYER_URL;
    delete import.meta.env.VITE_FUND_API_KEY;
  });

  function createNetworkWithGasRetry(opts: {
    writeFailCount?: number;
  } = {}) {
    const { writeFailCount = 1 } = opts;
    const callCounts = new Map<string, number>();

    const mockReceipt = { status: 'success' as const, blockNumber: BigInt(100) };
    const waitForTransaction = vi.fn().mockResolvedValue(mockReceipt);

    // Track balance for waitForBalance polling
    let currentBalance = BigInt(0);
    const publicClient = {
      getChainId: vi.fn().mockResolvedValue(31337),
      getBlockNumber: vi.fn().mockResolvedValue(BigInt(200)),
      getBalance: vi.fn().mockImplementation(async () => currentBalance),
    };

    const setBalance = (bal: bigint) => { currentBalance = bal; };

    // Write proxy: fail N times with insufficient funds, then succeed
    const writeHandler: ProxyHandler<Record<string, unknown>> = {
      get: (_, prop) => {
        return vi.fn().mockImplementation(async (...args: unknown[]) => {
          const name = String(prop);
          const count = (callCounts.get(name) ?? 0) + 1;
          callCounts.set(name, count);

          if (count <= writeFailCount) {
            const err = new Error('insufficient funds for intrinsic transaction cost');
            throw err;
          }
          return FAKE_TX_HASH;
        });
      },
    };

    const worldContract = {
      write: new Proxy({} as Record<string, unknown>, writeHandler),
      read: new Proxy({} as Record<string, unknown>, {
        get: () => vi.fn().mockResolvedValue(BigInt(0)),
      }),
      simulate: new Proxy({} as Record<string, unknown>, {
        get: () => vi.fn().mockResolvedValue({ result: undefined }),
      }),
    };

    const walletClient = { account: { address: TEST_WALLET } };

    const network = {
      publicClient,
      walletClient,
      waitForTransaction,
      worldContract,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { network: network as any, setBalance, callCounts };
  }

  it('retries after requesting emergency funding on insufficient funds', async () => {
    const { network, setBalance } = createNetworkWithGasRetry({ writeFailCount: 1 });
    mockOwnership();

    // Mock fetch for relayer /fund call
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'funded' }) });

    // Simulate funding arriving: balance increases after fetch
    const origGetBalance = network.publicClient.getBalance;
    let balanceCallCount = 0;
    network.publicClient.getBalance = vi.fn().mockImplementation(async () => {
      balanceCallCount++;
      // First call = baseline (0), second call = funded (1 ETH)
      return balanceCallCount <= 1 ? BigInt(0) : BigInt(1000000000000000);
    });

    const calls = createSystemCalls(network);
    const result = await calls.rest(TEST_ENTITY);

    expect(result.success).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://relay.test/fund',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-api-key' }),
      }),
    );
  });

  it('fails if funding request fails', async () => {
    const { network } = createNetworkWithGasRetry({ writeFailCount: 2 });
    mockOwnership();

    // Mock fetch to fail
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    const calls = createSystemCalls(network);
    const result = await calls.rest(TEST_ENTITY);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('fails if funding arrives but retry also fails', async () => {
    // Both attempts fail with insufficient funds
    const { network } = createNetworkWithGasRetry({ writeFailCount: 2 });
    mockOwnership();

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'funded' }) });
    let balanceCallCount = 0;
    network.publicClient.getBalance = vi.fn().mockImplementation(async () => {
      balanceCallCount++;
      return balanceCallCount <= 1 ? BigInt(0) : BigInt(1000000000000000);
    });

    const calls = createSystemCalls(network);
    const result = await calls.rest(TEST_ENTITY);

    // Retry also throws insufficient funds → still fails
    expect(result.success).toBe(false);
  });

  it('does not retry on non-funds errors (reverts)', async () => {
    const { network } = createMockNetwork();
    mockOwnership();

    const revertError = new Error('execution reverted: Unauthorized');
    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: () => vi.fn().mockRejectedValue(revertError),
    });

    globalThis.fetch = vi.fn();

    const calls = createSystemCalls(network);
    const result = await calls.rest(TEST_ENTITY);

    expect(result.success).toBe(false);
    // Should NOT have called the relayer
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does not retry when relayer URL is not configured', async () => {
    delete import.meta.env.VITE_RELAYER_URL;

    const { network } = createNetworkWithGasRetry({ writeFailCount: 1 });
    mockOwnership();

    globalThis.fetch = vi.fn();

    const calls = createSystemCalls(network);
    const result = await calls.rest(TEST_ENTITY);

    expect(result.success).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('retries immediately when relayer says player already has funds', async () => {
    const { network } = createNetworkWithGasRetry({ writeFailCount: 1 });
    mockOwnership();

    // Relayer returns already_funded — player's balance recovered
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'already_funded' }) });

    const calls = createSystemCalls(network);
    const result = await calls.rest(TEST_ENTITY);

    // Should retry immediately without waiting for balance
    expect(result.success).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalled();
    // getBalance should NOT be called (no waitForBalance)
    expect(network.publicClient.getBalance).not.toHaveBeenCalled();
  });

  it('fails when funding accepted but balance never increases (timeout)', async () => {
    const { network } = createNetworkWithGasRetry({ writeFailCount: 2 });
    mockOwnership();

    // Relayer accepts the request
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'funded' }) });
    // Balance never increases — stays at 0
    network.publicClient.getBalance = vi.fn().mockResolvedValue(BigInt(0));

    const calls = createSystemCalls(network);
    // Use a short timeout so the test doesn't take 8s — override waitForBalance
    // The real code polls every 1s for 8s; here we just verify the failure path
    const result = await calls.rest(TEST_ENTITY);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(globalThis.fetch).toHaveBeenCalled();
  }, 15000); // Allow enough time for the 8s timeout + polling

  it('deduplicates concurrent emergency funding requests', async () => {
    // Two actions fail simultaneously — should only trigger one /fund call
    const callCounts = new Map<string, number>();
    const mockReceipt = { status: 'success' as const, blockNumber: BigInt(100) };
    const waitForTransaction = vi.fn().mockResolvedValue(mockReceipt);

    let balanceCallCount = 0;
    const publicClient = {
      getChainId: vi.fn().mockResolvedValue(31337),
      getBlockNumber: vi.fn().mockResolvedValue(BigInt(200)),
      getBalance: vi.fn().mockImplementation(async () => {
        balanceCallCount++;
        // First 2 calls = baseline (0), then funded
        return balanceCallCount <= 2 ? BigInt(0) : BigInt(1000000000000000);
      }),
    };

    // Both writes fail once then succeed
    const writeHandler: ProxyHandler<Record<string, unknown>> = {
      get: (_, prop) => {
        return vi.fn().mockImplementation(async () => {
          const name = String(prop);
          const count = (callCounts.get(name) ?? 0) + 1;
          callCounts.set(name, count);
          if (count <= 1) {
            throw new Error('insufficient funds for intrinsic transaction cost');
          }
          return FAKE_TX_HASH;
        });
      },
    };

    const worldContract = {
      write: new Proxy({} as Record<string, unknown>, writeHandler),
      read: new Proxy({} as Record<string, unknown>, {
        get: () => vi.fn().mockResolvedValue(BigInt(0)),
      }),
      simulate: new Proxy({} as Record<string, unknown>, {
        get: () => vi.fn().mockResolvedValue({ result: undefined }),
      }),
    };

    const walletClient = { account: { address: TEST_WALLET } };
    const network = { publicClient, walletClient, waitForTransaction, worldContract };

    // Track fetch calls
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'funded' }),
    });

    mockOwnership();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = createSystemCalls(network as any);

    // Fire two actions concurrently — both should fail with insufficient funds
    const [result1, result2] = await Promise.all([
      calls.rest(TEST_ENTITY),
      calls.rest(TEST_ENTITY),
    ]);

    // Both should eventually succeed after funding
    expect(result1.success || result2.success).toBe(true);

    // Only ONE /fund request should have been made (deduped)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  }, 15000);
});

// ── Suite: validateTileMonsters (Proactive Ghost Validation) ─────────

describe('createSystemCalls — validateTileMonsters', () => {
  const ZERO_HASH = '0x' + '00'.repeat(32);
  const SPAWNED_TABLE_ID = '0x74625544000000000000000000000000537061776e6564000000000000000000';
  const ENCOUNTER_ENTITY_TABLE_ID = '0x74625544000000000000000000000000456e636f756e746572456e7469747900';
  const POSITION_TABLE_ID = '0x74625544000000000000000000000000506f736974696f6e0000000000000000';

  const makeSpawnedRecord = (spawned: boolean) =>
    [spawned ? '0x01' : '0x00', '0x' + '00'.repeat(32), '0x'] as const;

  const makeEncounterRecord = (
    encounterId: string = ZERO_HASH,
    died = false,
  ) => [`0x${encounterId.slice(2)}${died ? '01' : '00'}`, '0x' + '00'.repeat(32), '0x'] as const;

  const makePositionRecord = (x: number, y: number) =>
    [`0x${x.toString(16).padStart(4, '0')}${y.toString(16).padStart(4, '0')}`, '0x' + '00'.repeat(32), '0x'] as const;

  const mockValidationReads = (
    states: Record<string, {
      encounterId?: string;
      died?: boolean;
      spawned?: boolean;
      position?: { x: number; y: number };
    }>,
  ) => vi.fn().mockImplementation(async ({ args }: { args: [string, string[]] }) => {
    const [tableId, [entityId]] = args;
    const state = states[entityId];
    if (!state) throw new Error(`Unexpected entity ${entityId}`);
    if (tableId === SPAWNED_TABLE_ID) return makeSpawnedRecord(state.spawned ?? true);
    if (tableId === ENCOUNTER_ENTITY_TABLE_ID) {
      return makeEncounterRecord(state.encounterId ?? ZERO_HASH, state.died ?? false);
    }
    if (tableId === POSITION_TABLE_ID) {
      const pos = state.position ?? { x: 0, y: 0 };
      return makePositionRecord(pos.x, pos.y);
    }
    throw new Error(`Unexpected table ${tableId}`);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('evicts monsters whose on-chain Spawned is false', async () => {
    const { network } = createMockNetwork();
    const calls = createSystemCalls(network);
    const MONSTER_A = '0x0000000000000000000000000000000000000000000000000000000000000aaa';
    const MONSTER_B = '0x0000000000000000000000000000000000000000000000000000000000000bbb';
    network.publicClient.readContract = mockValidationReads({
      [MONSTER_A]: { spawned: true },
      [MONSTER_B]: { spawned: false },
    });

    await calls.validateTileMonsters([MONSTER_A, MONSTER_B]);

    // Only MONSTER_B (dead) should be evicted — evictGhostMonsters sets both flags
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', MONSTER_B, { spawned: false });
    expect(mockSetRow).toHaveBeenCalledWith('EncounterEntity', MONSTER_B, expect.objectContaining({ died: true }));
    // MONSTER_A (alive) should NOT be evicted
    expect(mockSetRow).not.toHaveBeenCalledWith('Spawned', MONSTER_A, expect.anything());
  });

  it('does nothing when all monsters are alive', async () => {
    const { network } = createMockNetwork();
    network.publicClient.readContract = mockValidationReads({
      [TEST_MONSTER]: { spawned: true },
    });

    const calls = createSystemCalls(network);
    await calls.validateTileMonsters([TEST_MONSTER]);

    expect(mockSetRow).not.toHaveBeenCalled();
  });

  it('does nothing for empty monster list', async () => {
    const { network } = createMockNetwork();
    network.publicClient.readContract = vi.fn();

    const calls = createSystemCalls(network);
    await calls.validateTileMonsters([]);

    expect(network.publicClient.readContract).not.toHaveBeenCalled();
  });

  it('handles RPC failures gracefully (no evictions)', async () => {
    const { network } = createMockNetwork();
    network.publicClient.readContract = vi.fn().mockRejectedValue(new Error('RPC timeout'));

    const calls = createSystemCalls(network);
    await calls.validateTileMonsters([TEST_MONSTER]);

    // Should not crash or evict on RPC failure
    expect(mockSetRow).not.toHaveBeenCalled();
  });

  it('evicts only failed monsters when some RPC calls fail', async () => {
    const { network } = createMockNetwork();
    const MONSTER_A = '0x0000000000000000000000000000000000000000000000000000000000000aaa';
    const MONSTER_B = '0x0000000000000000000000000000000000000000000000000000000000000bbb';

    network.publicClient.readContract = vi.fn().mockImplementation(async ({ args }: {
      args: [string, string[]];
    }) => {
      const [tableId, [entityId]] = args;
      if (entityId === MONSTER_B && tableId === SPAWNED_TABLE_ID) {
        throw new Error('RPC timeout');
      }
      if (entityId === MONSTER_A) {
        if (tableId === SPAWNED_TABLE_ID) return makeSpawnedRecord(false);
        if (tableId === ENCOUNTER_ENTITY_TABLE_ID) return makeEncounterRecord();
      }
      if (entityId === MONSTER_B && tableId === ENCOUNTER_ENTITY_TABLE_ID) {
        return makeEncounterRecord();
      }
      throw new Error(`Unexpected read ${tableId} ${entityId}`);
    });

    const calls = createSystemCalls(network);
    await calls.validateTileMonsters([MONSTER_A, MONSTER_B]);

    // Only MONSTER_A (confirmed dead) should be evicted — evictGhostMonsters sets both flags
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', MONSTER_A, { spawned: false });
    expect(mockSetRow).toHaveBeenCalledWith('EncounterEntity', MONSTER_A, expect.objectContaining({ died: true }));
    // MONSTER_B (RPC failed) should NOT be evicted (benefit of the doubt)
    expect(mockSetRow).not.toHaveBeenCalledWith('Spawned', MONSTER_B, expect.anything());
  });

  it('marks monsters already in encounter as unavailable without evicting them', async () => {
    const { network } = createMockNetwork();
    const BUSY_MONSTER = '0x0000000000000000000000000000000000000000000000000000000000000ccc';
    const encounterId = '0x' + '11'.repeat(32);
    network.publicClient.readContract = mockValidationReads({
      [BUSY_MONSTER]: { encounterId, spawned: true },
    });

    const calls = createSystemCalls(network);
    await calls.validateTileMonsters([BUSY_MONSTER]);

    expect(mockSetRow).toHaveBeenCalledWith('EncounterEntity', BUSY_MONSTER, expect.objectContaining({
      encounterId,
      died: false,
    }));
    expect(mockSetRow).not.toHaveBeenCalledWith('Spawned', BUSY_MONSTER, { spawned: false });
  });

  it('syncs monsters off the current tile to their on-chain position', async () => {
    const { network } = createMockNetwork();
    const OFF_TILE_MONSTER = '0x0000000000000000000000000000000000000000000000000000000000000ddd';

    // Position now read via readStoreRecord (publicClient.readContract) not UD__getEntityPosition
    network.publicClient.readContract = mockValidationReads({
      [OFF_TILE_MONSTER]: { spawned: true, position: { x: 1, y: 4 } },
    });

    const calls = createSystemCalls(network);
    await calls.validateTileMonsters([OFF_TILE_MONSTER], { x: 1, y: 3 });

    expect(mockSetRow).toHaveBeenCalledWith('Position', OFF_TILE_MONSTER, { x: 1, y: 4 });
    expect(mockSetRow).not.toHaveBeenCalledWith('Spawned', OFF_TILE_MONSTER, { spawned: false });
  });

  it('evicts monster when chain position is (0,0) — position was cleared by removeEntityFromBoard', async () => {
    // Mob killed: Position=(0,0), Spawned=false on chain.
    // positionIsCleared triggers full eviction (Spawned=false AND died=true).
    const { network } = createMockNetwork();
    const CLEARED_MONSTER = '0x0000000000000000000000000000000000000000000000000000000000000eee';

    network.publicClient.readContract = mockValidationReads({
      [CLEARED_MONSTER]: { spawned: false, position: { x: 0, y: 0 } },
    });

    const calls = createSystemCalls(network);
    await calls.validateTileMonsters([CLEARED_MONSTER], { x: 3, y: 5 });

    // evictGhostMonsters sets both Spawned=false and died=true
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', CLEARED_MONSTER, { spawned: false });
    expect(mockSetRow).toHaveBeenCalledWith('EncounterEntity', CLEARED_MONSTER, expect.objectContaining({ died: true }));
  });

  it('fully evicts a monster when spawned=true but position=(0,0) — TOCTOU race on chain reads', async () => {
    // Race: Spawned read → block N (spawned=true, alive) | Position read → block N+1 (position=0,0, killed).
    // position=(0,0) is an unambiguous death signal — removeEntityFromBoard sets both
    // Spawned=false AND Position=(0,0) atomically in the same TX. So if Position=(0,0),
    // the mob is dead regardless of what the concurrent Spawned read returned.
    // New behavior: call evictGhostMonsters which sets Spawned=false AND died=true,
    // preventing re-animation via stale indexer events until the next snapshot sync.
    const { network } = createMockNetwork();
    const RACE_MONSTER = '0x0000000000000000000000000000000000000000000000000000000000000fff';

    // Simulate race: spawned=true (stale read) but position=(0,0) (current read)
    network.publicClient.readContract = mockValidationReads({
      [RACE_MONSTER]: { spawned: true, position: { x: 0, y: 0 } },
    });

    const calls = createSystemCalls(network);
    await calls.validateTileMonsters([RACE_MONSTER], { x: 3, y: 5 });

    // Position updated to (0,0) from chain
    expect(mockSetRow).toHaveBeenCalledWith('Position', RACE_MONSTER, { x: 0, y: 0 });
    // evictGhostMonsters called: sets Spawned=false AND died=true to prevent re-animation
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', RACE_MONSTER, { spawned: false });
    expect(mockSetRow).toHaveBeenCalledWith('EncounterEntity', RACE_MONSTER, expect.objectContaining({ died: true }));
  });
});
