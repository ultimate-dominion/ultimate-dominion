import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address } from 'viem';

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
    poolFee: 3000,
    swapSlippageBps: 500,
    chargeIntervalMs: 300_000,
    swapIntervalMs: 3_600_000,
    swapThreshold: 100_000_000_000_000_000_000n,
  },
  gasChargingEnabled: true,
}));

const mockSendPrimaryTx = vi.fn<() => Promise<`0x${string}`>>();

vi.mock('./tx.js', () => ({
  publicClient: {
    simulateContract: () => Promise.resolve({ result: [1n, 0n, 0, 0n] }),
    readContract: () => Promise.resolve(0n),
    getBalance: () => Promise.resolve(0n),
  },
  relayerAddress: '0x0000000000000000000000000000000000000099',
  sendPrimaryTx: () => mockSendPrimaryTx(),
}));

// ==================== Import ====================

const { recordFunding, flushCharges, getPendingChargeCount, _resetForTesting } = await import('./gasCharge.js');

// ==================== Helpers ====================

const CHARACTER_ID = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;

// Use unique numeric-only addresses per test to avoid shared chargeRetries state
let addrCounter = 1000;
function uniquePlayer(): Address {
  addrCounter++;
  return `0x${addrCounter.toString(16).padStart(40, '0')}` as Address;
}

// ==================== Tests ====================

describe('gasCharge dead-letter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetForTesting();
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
  });

  it('re-queues charges on first failure', async () => {
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
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
});
