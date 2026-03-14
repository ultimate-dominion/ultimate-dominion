import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { type Address, formatEther } from 'viem';

// ==================== Mocks ====================
// Must be defined before importing the module under test.

// Mock config
vi.mock('./config.js', () => ({
  config: {
    fundingAmount: 1_000_000_000_000_000n,   // 0.001 ETH
    minPlayerBalance: 300_000_000_000_000n,  // 0.0003 ETH
  },
  gasChargingEnabled: true,
}));

// Mock tx module
const mockGetBalance = vi.fn<(args: { address: Address }) => Promise<bigint>>();
const mockSendRelayerTx = vi.fn<() => Promise<`0x${string}`>>().mockResolvedValue('0xdeadbeef' as `0x${string}`);

vi.mock('./tx.js', () => ({
  publicClient: {
    getBalance: (args: { address: Address }) => mockGetBalance(args),
  },
  sendRelayerTx: () => mockSendRelayerTx(),
}));

// Mock chainReader
const mockGetCharacterId = vi.fn<() => Promise<`0x${string}` | null>>();
const mockGetPlayerLevel = vi.fn<() => Promise<bigint | null>>();
const mockGetGoldPerGasCharge = vi.fn<() => Promise<bigint | null>>();

vi.mock('./chainReader.js', () => ({
  getCharacterId: () => mockGetCharacterId(),
  getPlayerLevel: () => mockGetPlayerLevel(),
  getGoldPerGasCharge: () => mockGetGoldPerGasCharge(),
}));

// Mock gasCharge
const mockRecordFunding = vi.fn();
vi.mock('./gasCharge.js', () => ({
  recordFunding: (...args: unknown[]) => mockRecordFunding(...args),
}));

// ==================== Import module under test ====================
// Must happen AFTER vi.mock() calls.

const { trackPlayer, startBalanceMonitor, stopBalanceMonitor } = await import('./balanceMonitor.js');

// ==================== Helpers ====================

const BURNER = '0x1111111111111111111111111111111111111111' as Address;
const DELEGATOR = '0x2222222222222222222222222222222222222222' as Address;
const CHARACTER_ID = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;

async function runOneCheck(): Promise<void> {
  startBalanceMonitor();
  await vi.advanceTimersByTimeAsync(60_000);
  stopBalanceMonitor();
}

// ==================== Tests ====================

describe('balanceMonitor decision tree', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetGoldPerGasCharge.mockResolvedValue(1_000_000_000_000_000_000n); // 1e18 gold
  });

  it('skips players with sufficient ETH', async () => {
    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(500_000_000_000_000n); // 0.0005 ETH > minPlayerBalance

    await runOneCheck();

    expect(mockSendRelayerTx).not.toHaveBeenCalled();
    expect(mockRecordFunding).not.toHaveBeenCalled();
  });

  it('gives free top-up when gas charging is disabled', async () => {
    const configMod = await import('./config.js');
    (configMod as any).gasChargingEnabled = false;

    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(0n);

    await runOneCheck();

    expect(mockSendRelayerTx).toHaveBeenCalled();
    expect(mockRecordFunding).not.toHaveBeenCalled();

    (configMod as any).gasChargingEnabled = true;
  });

  it('gives free top-up when player has no character', async () => {
    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(0n);
    mockGetCharacterId.mockResolvedValue(null);

    await runOneCheck();

    expect(mockSendRelayerTx).toHaveBeenCalled();
    expect(mockRecordFunding).not.toHaveBeenCalled();
  });

  it('gives free top-up when player is below level 3', async () => {
    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(0n);
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    mockGetPlayerLevel.mockResolvedValue(2n);

    await runOneCheck();

    expect(mockSendRelayerTx).toHaveBeenCalled();
    expect(mockRecordFunding).not.toHaveBeenCalled();
  });

  it('tops up and charges level 3+ player', async () => {
    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(0n);
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    mockGetPlayerLevel.mockResolvedValue(5n);

    await runOneCheck();

    expect(mockSendRelayerTx).toHaveBeenCalled();
    expect(mockRecordFunding).toHaveBeenCalledWith(DELEGATOR, 1_000_000_000_000_000n);
  });

  it('tops up level 3+ player even with zero gold (no skip zone)', async () => {
    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(100_000_000_000_000n); // 0.0001 ETH — previously in skip zone
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    mockGetPlayerLevel.mockResolvedValue(5n);

    await runOneCheck();

    // Should STILL top up — no more skip zone
    expect(mockSendRelayerTx).toHaveBeenCalled();
    expect(mockRecordFunding).toHaveBeenCalledWith(DELEGATOR, 1_000_000_000_000_000n);
  });

  it('fails open on level read failure — gives free top-up', async () => {
    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(0n);
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    mockGetPlayerLevel.mockResolvedValue(null); // RPC failure

    await runOneCheck();

    expect(mockSendRelayerTx).toHaveBeenCalled();
    expect(mockRecordFunding).not.toHaveBeenCalled();
  });

  it('charges gold from delegator, not burner (MetaMask path)', async () => {
    const mmBurner = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as Address;
    const mmDelegator = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as Address;

    trackPlayer(mmBurner, mmDelegator);
    mockGetBalance.mockResolvedValue(0n);
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    mockGetPlayerLevel.mockResolvedValue(5n);

    await runOneCheck();

    expect(mockRecordFunding).toHaveBeenCalledWith(mmDelegator, 1_000_000_000_000_000n);
  });
});
