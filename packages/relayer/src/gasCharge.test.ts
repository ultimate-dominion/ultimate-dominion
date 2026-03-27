import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, decodeFunctionData, parseAbi } from 'viem';

// ==================== Mocks ====================

const mockGetCharacterId = vi.fn<() => Promise<`0x${string}` | null>>();

vi.mock('./chainReader.js', () => ({
  getCharacterId: () => mockGetCharacterId(),
}));

vi.mock('./config.js', () => ({
  config: {
    worldAddress: '0x0000000000000000000000000000000000000001',
    goldToken: '0x0000000000000000000000000000000000000002',
    weth: '0x4200000000000000000000000000000000000006',
    swapRouter: '0x2626664c2603336E57B271c5C0b26F421741e481',
    quoterV2: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    poolFee: 10000,
    swapSlippageBps: 500,
    chargeIntervalMs: 300_000,
    swapIntervalMs: 3_600_000,
    swapThreshold: 100_000_000_000_000_000_000n,
    fundingAmount: 500_000_000_000_000n, // 0.0005 ETH — matches prod
  },
  gasChargingEnabled: true,
}));

const mockSendPrimaryTx = vi.fn<(args: { to: string; calldata: string }) => Promise<`0x${string}`>>();

vi.mock('./tx.js', () => ({
  publicClient: {
    simulateContract: () => Promise.resolve({ result: [1n, 0n, 0, 0n] }),
    readContract: () => Promise.resolve(0n),
    getBalance: () => Promise.resolve(0n),
  },
  relayerAddress: '0x0000000000000000000000000000000000000099',
  sendPrimaryTx: (args: unknown) => mockSendPrimaryTx(args as { to: string; calldata: string }),
}));

// ==================== Import ====================

const { recordFunding, flushCharges, getPendingChargeCount, _resetForTesting } = await import('./gasCharge.js');

// ==================== Helpers ====================

const CHARACTER_ID = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;

const fundAndChargeAbi = parseAbi([
  'function UD__fundAndCharge(address player, bytes32 characterId)',
]);

// Use unique numeric-only addresses per test to avoid shared chargeRetries state
let addrCounter = 1000;
function uniquePlayer(): Address {
  addrCounter++;
  return `0x${addrCounter.toString(16).padStart(40, '0')}` as Address;
}

// ==================== Tests ====================

describe('gasCharge fundAndCharge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetForTesting();
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('calls fundAndCharge once per player', async () => {
    const player = uniquePlayer();
    recordFunding(player, 500_000_000_000_000n);

    mockSendPrimaryTx.mockResolvedValueOnce('0xhash' as `0x${string}`);
    await flushCharges();

    expect(mockSendPrimaryTx).toHaveBeenCalledTimes(1);
    const calldata = mockSendPrimaryTx.mock.calls[0][0].calldata;
    const decoded = decodeFunctionData({ abi: fundAndChargeAbi, data: calldata as `0x${string}` });
    expect(decoded.functionName).toBe('UD__fundAndCharge');
  });

  it('sends one tx per player for multiple players', async () => {
    for (let i = 0; i < 5; i++) {
      recordFunding(uniquePlayer(), 500_000_000_000_000n);
    }

    mockSendPrimaryTx.mockResolvedValue('0xhash' as `0x${string}`);
    await flushCharges();

    expect(mockSendPrimaryTx).toHaveBeenCalledTimes(5);
  });

  it('skips players with no character', async () => {
    const p1 = uniquePlayer();
    const p2 = uniquePlayer();
    recordFunding(p1, 500_000_000_000_000n);
    recordFunding(p2, 500_000_000_000_000n);

    // First call returns null (no character), second returns valid ID
    mockGetCharacterId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(CHARACTER_ID);

    mockSendPrimaryTx.mockResolvedValue('0xhash' as `0x${string}`);
    await flushCharges();

    expect(mockSendPrimaryTx).toHaveBeenCalledTimes(1);
  });

  it('multiple top-ups for same player result in single charge call', async () => {
    const player = uniquePlayer();
    for (let i = 0; i < 10; i++) {
      recordFunding(player, 500_000_000_000_000n);
    }

    mockSendPrimaryTx.mockResolvedValueOnce('0xhash' as `0x${string}`);
    await flushCharges();

    // One fundAndCharge call regardless of how many top-ups
    expect(mockSendPrimaryTx).toHaveBeenCalledTimes(1);
  });
});

describe('gasCharge dead-letter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetForTesting();
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
  });

  it('re-queues charges on first failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const player = uniquePlayer();
    recordFunding(player, 1_000_000_000_000_000n);
    expect(getPendingChargeCount()).toBe(1);

    mockSendPrimaryTx.mockRejectedValueOnce(new Error('tx failed'));
    await flushCharges();

    // Should be re-queued
    expect(getPendingChargeCount()).toBe(1);
  });

  it('dead-letters after 3 consecutive failures', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const player = uniquePlayer();

    // Failure 1
    recordFunding(player, 1_000_000_000_000_000n);
    mockSendPrimaryTx.mockRejectedValueOnce(new Error('tx failed'));
    await flushCharges();
    expect(getPendingChargeCount()).toBe(1);

    // Failure 2
    mockSendPrimaryTx.mockRejectedValueOnce(new Error('tx failed'));
    await flushCharges();
    expect(getPendingChargeCount()).toBe(1);

    // Failure 3 — dead-letter
    mockSendPrimaryTx.mockRejectedValueOnce(new Error('tx failed'));
    await flushCharges();
    expect(getPendingChargeCount()).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Dead-lettering'),
    );

    consoleSpy.mockRestore();
  });

  it('clears retry counter on success', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const player = uniquePlayer();

    // Failure 1
    recordFunding(player, 1_000_000_000_000_000n);
    mockSendPrimaryTx.mockRejectedValueOnce(new Error('tx failed'));
    await flushCharges();
    expect(getPendingChargeCount()).toBe(1);

    // Success — resets retry counter
    mockSendPrimaryTx.mockResolvedValueOnce('0xsuccesshash' as `0x${string}`);
    await flushCharges();
    expect(getPendingChargeCount()).toBe(0);

    // New charge + 3 failures should dead-letter (counter was reset)
    recordFunding(player, 1_000_000_000_000_000n);
    mockSendPrimaryTx.mockRejectedValueOnce(new Error('fail 1'));
    await flushCharges();
    mockSendPrimaryTx.mockRejectedValueOnce(new Error('fail 2'));
    await flushCharges();
    mockSendPrimaryTx.mockRejectedValueOnce(new Error('fail 3'));
    await flushCharges();
    expect(getPendingChargeCount()).toBe(0); // dead-lettered after fresh 3
  });

  it('per-player failure does not affect other players', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const p1 = uniquePlayer();
    const p2 = uniquePlayer();
    recordFunding(p1, 500_000_000_000_000n);
    recordFunding(p2, 500_000_000_000_000n);

    // p1 succeeds, p2 fails
    mockSendPrimaryTx
      .mockResolvedValueOnce('0xhash1' as `0x${string}`)
      .mockRejectedValueOnce(new Error('p2 failed'));

    await flushCharges();

    // Only p2 should be re-queued
    expect(getPendingChargeCount()).toBe(1);
  });
});
