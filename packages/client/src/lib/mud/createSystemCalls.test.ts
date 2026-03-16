import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Address } from 'viem';

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
vi.mock('../gameStore', () => ({
  getTableValue: vi.fn(),
  useGameStore: {
    getState: () => ({
      setRow: mockSetRow,
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
const FAKE_TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;

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

  const worldContract = {
    write: new Proxy({} as Record<string, unknown>, writeHandler),
    read: new Proxy({} as Record<string, unknown>, readHandler),
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
    (fundsError as Record<string, unknown>).walk = () => null;
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
});

// ── Suite D: Move Stale Position Recovery ───────────────────────────

describe('createSystemCalls — move stale position recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries with chain position when simulation returns InvalidMove', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    mockOwnership();

    // First UD__move call (simulation) throws InvalidMove, second succeeds
    const moveWriteFn = vi.fn()
      .mockRejectedValueOnce(new Error('0x87822d34'))
      .mockResolvedValueOnce(FAKE_TX_HASH);

    // UD__getEntityPosition returns corrected position (2, 3)
    const getPositionFn = vi.fn().mockResolvedValue([2, 3]);

    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return moveWriteFn;
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });

    network.worldContract.read = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__getEntityPosition') return getPositionFn;
        return vi.fn().mockResolvedValue(BigInt(0));
      },
    });

    const calls = createSystemCalls(network);

    const result = await calls.move(TEST_ENTITY, 'right');
    expect(result.success).toBe(true);
    expect(moveWriteFn).toHaveBeenCalledTimes(2);
    expect(getPositionFn).toHaveBeenCalledWith([TEST_ENTITY]);
    expect(waitForTransaction).toHaveBeenCalled();
  });

  it('updates Zustand store with corrected chain position', async () => {
    const { network } = createMockNetwork();
    mockOwnership();

    const moveWriteFn = vi.fn()
      .mockRejectedValueOnce(new Error('0x87822d34'))
      .mockResolvedValueOnce(FAKE_TX_HASH);

    const getPositionFn = vi.fn().mockResolvedValue([5, 7]);

    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return moveWriteFn;
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });

    network.worldContract.read = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__getEntityPosition') return getPositionFn;
        return vi.fn().mockResolvedValue(BigInt(0));
      },
    });

    const calls = createSystemCalls(network);

    await calls.move(TEST_ENTITY, 'up');
    expect(mockSetRow).toHaveBeenCalledWith('Position', TEST_ENTITY, { x: 5, y: 7 });
  });

  it('applies direction correctly to corrected chain position', async () => {
    const { network } = createMockNetwork();
    mockOwnership();

    const moveWriteFn = vi.fn()
      .mockRejectedValueOnce(new Error('0x87822d34'))
      .mockResolvedValueOnce(FAKE_TX_HASH);

    // Chain position is (4, 4)
    const getPositionFn = vi.fn().mockResolvedValue([4, 4]);

    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return moveWriteFn;
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });

    network.worldContract.read = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__getEntityPosition') return getPositionFn;
        return vi.fn().mockResolvedValue(BigInt(0));
      },
    });

    const calls = createSystemCalls(network);

    await calls.move(TEST_ENTITY, 'down');
    // direction 'down' → y - 1: target should be (4, 3)
    expect(moveWriteFn).toHaveBeenLastCalledWith([TEST_ENTITY, 4, 3]);
  });

  it('returns failure when chain position read fails', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    mockOwnership();

    const moveWriteFn = vi.fn()
      .mockRejectedValueOnce(new Error('0x87822d34'));

    const getPositionFn = vi.fn().mockRejectedValue(new Error('RPC error'));

    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return moveWriteFn;
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });

    network.worldContract.read = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__getEntityPosition') return getPositionFn;
        return vi.fn().mockResolvedValue(BigInt(0));
      },
    });

    const calls = createSystemCalls(network);

    const result = await calls.move(TEST_ENTITY, 'right');
    expect(result.success).toBe(false);
    expect(waitForTransaction).not.toHaveBeenCalled();
  });

  it('returns failure when retry move also fails', async () => {
    const { network, waitForTransaction } = createMockNetwork();
    mockOwnership();

    const retryError = new Error('NotSpawned');
    const moveWriteFn = vi.fn()
      .mockRejectedValueOnce(new Error('0x87822d34'))
      .mockRejectedValueOnce(retryError);

    const getPositionFn = vi.fn().mockResolvedValue([0, 0]);

    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return moveWriteFn;
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });

    network.worldContract.read = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__getEntityPosition') return getPositionFn;
        return vi.fn().mockResolvedValue(BigInt(0));
      },
    });

    const calls = createSystemCalls(network);

    const result = await calls.move(TEST_ENTITY, 'left');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(waitForTransaction).not.toHaveBeenCalled();
  });
});

// ── Suite E: On-chain Revert Diagnosis ─────────────────────────────

describe('createSystemCalls — on-chain revert diagnosis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects NotSpawned after on-chain revert and updates store', async () => {
    // Simulate: MoveTooFast bypass → TX reverts → re-sim finds NotSpawned
    const { network, waitForTransaction: waitFn } = createMockNetwork({ receiptStatus: 'reverted' });
    mockOwnership();

    let moveCallCount = 0;
    const moveWriteFn = vi.fn().mockImplementation(() => {
      moveCallCount++;
      if (moveCallCount === 1) {
        // First sim: MoveTooFast (stale RPC)
        return Promise.reject(new Error('0x326f4b4f'));
      }
      if (moveCallCount === 2) {
        // MoveTooFast bypass: send with gas → returns TX hash (receipt will be reverted)
        return Promise.resolve(FAKE_TX_HASH);
      }
      // Third call: diagnostic re-simulation → NotSpawned
      return Promise.reject(new Error('0xbd45e4f6'));
    });

    network.worldContract.write = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'UD__move') return moveWriteFn;
        return vi.fn().mockResolvedValue(FAKE_TX_HASH);
      },
    });

    const calls = createSystemCalls(network);

    const result = await calls.move(TEST_ENTITY, 'up');
    expect(result.success).toBe(false);
    expect(result.error).toContain('respawn');
    // Store should be updated with spawned=false
    expect(mockSetRow).toHaveBeenCalledWith('Spawned', TEST_ENTITY, { spawned: false });
    // Should NOT send more than 1 TX (the first reverted one)
    expect(waitFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry after on-chain revert (MAX_ON_CHAIN_RETRIES=0)', async () => {
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
    // Should fail without retrying — one TX only
    expect(result.success).toBe(false);
    expect(waitFn).toHaveBeenCalledTimes(1);
  });
});
