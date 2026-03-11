import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { type Address, formatEther } from 'viem';

// ==================== Mocks ====================
// Must be defined before importing the module under test.

// Mock config
vi.mock('./config.js', () => ({
  config: {
    fundingAmount: 1_000_000_000_000_000n,   // 0.001 ETH
    minPlayerBalance: 300_000_000_000_000n,  // 0.0003 ETH
    lifelineAmount: 300_000_000_000_000n,    // 0.0003 ETH
    lifelineCooldownMs: 86_400_000,           // 24 hours
    lifelineMinBalance: 50_000_000_000_000n, // 0.00005 ETH
    dataDir: '/tmp/test-data',
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
const mockGetGoldBalance = vi.fn<() => Promise<bigint | null>>();
const mockGetGoldPerGasCharge = vi.fn<() => Promise<bigint | null>>();

vi.mock('./chainReader.js', () => ({
  getCharacterId: () => mockGetCharacterId(),
  getPlayerLevel: () => mockGetPlayerLevel(),
  getGoldBalance: () => mockGetGoldBalance(),
  getGoldPerGasCharge: () => mockGetGoldPerGasCharge(),
}));

// Mock gasCharge
const mockRecordFunding = vi.fn();
vi.mock('./gasCharge.js', () => ({
  recordFunding: (...args: unknown[]) => mockRecordFunding(...args),
}));

// Mock persistence — stateful so lifeline cooldowns persist across start/stop cycles
let persistedCooldowns = new Map<string, number>();
vi.mock('./persistence.js', () => ({
  loadLifelineCooldowns: () => new Map(persistedCooldowns),
  saveLifelineCooldowns: (cooldowns: Map<string, number>) => { persistedCooldowns = new Map(cooldowns); },
}));

// ==================== Import module under test ====================
// Must happen AFTER vi.mock() calls.

const { trackPlayer, startBalanceMonitor, stopBalanceMonitor } = await import('./balanceMonitor.js');

// ==================== Helpers ====================

const BURNER = '0x1111111111111111111111111111111111111111' as Address;
const DELEGATOR = '0x2222222222222222222222222222222222222222' as Address;
const CHARACTER_ID = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;

// Access the private checkBalances by running the monitor briefly
// We'll call the internal check by triggering the interval timer.
// Instead, we import and test via the exported API + side effects.

// For testing the decision tree, we expose checkBalances via a wrapper.
// Since checkBalances is not exported, we test through the monitor interval.
// But vitest has fake timers — let's use that approach.

async function runOneCheck(): Promise<void> {
  // Start monitor, advance timer once, stop
  startBalanceMonitor();
  // The interval is 60s. We flush one tick.
  await vi.advanceTimersByTimeAsync(60_000);
  stopBalanceMonitor();
}

// ==================== Tests ====================

describe('balanceMonitor decision tree', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    persistedCooldowns = new Map(); // Reset lifeline cooldowns between tests
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
    // Override gasChargingEnabled for this test
    const configMod = await import('./config.js');
    (configMod as any).gasChargingEnabled = false;

    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(0n);

    await runOneCheck();

    expect(mockSendRelayerTx).toHaveBeenCalled();
    expect(mockRecordFunding).not.toHaveBeenCalled();

    // Restore
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

  it('charges gold when level 3+ player has enough gold', async () => {
    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(0n);
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    mockGetPlayerLevel.mockResolvedValue(5n);
    mockGetGoldBalance.mockResolvedValue(2_000_000_000_000_000_000n); // 2e18 > fee

    await runOneCheck();

    expect(mockSendRelayerTx).toHaveBeenCalled();
    expect(mockRecordFunding).toHaveBeenCalledWith(DELEGATOR, 1_000_000_000_000_000n);
  });

  it('skips level 3+ player with low gold but some ETH', async () => {
    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(100_000_000_000_000n); // 0.0001 ETH — above lifelineMinBalance
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    mockGetPlayerLevel.mockResolvedValue(5n);
    mockGetGoldBalance.mockResolvedValue(100n); // way below fee

    await runOneCheck();

    expect(mockSendRelayerTx).not.toHaveBeenCalled();
    expect(mockRecordFunding).not.toHaveBeenCalled();
  });

  it('grants lifeline when level 3+ player has no gold AND near-zero ETH', async () => {
    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(10_000_000_000_000n); // 0.00001 ETH — below lifelineMinBalance
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    mockGetPlayerLevel.mockResolvedValue(5n);
    mockGetGoldBalance.mockResolvedValue(0n);

    await runOneCheck();

    expect(mockSendRelayerTx).toHaveBeenCalled();
    // Lifeline should NOT record funding (it's free)
    expect(mockRecordFunding).not.toHaveBeenCalled();
  });

  it('enforces lifeline cooldown', async () => {
    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(0n);
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    mockGetPlayerLevel.mockResolvedValue(5n);
    mockGetGoldBalance.mockResolvedValue(0n);

    // First lifeline should succeed
    await runOneCheck();
    expect(mockSendRelayerTx).toHaveBeenCalledTimes(1);

    // Second attempt within cooldown should be skipped
    mockSendRelayerTx.mockClear();
    startBalanceMonitor();
    await vi.advanceTimersByTimeAsync(60_000);
    stopBalanceMonitor();

    expect(mockSendRelayerTx).not.toHaveBeenCalled();
  });

  it('fails open on level read failure — gives free top-up', async () => {
    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(0n);
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    mockGetPlayerLevel.mockResolvedValue(null); // RPC failure

    await runOneCheck();

    expect(mockSendRelayerTx).toHaveBeenCalled();
    expect(mockRecordFunding).not.toHaveBeenCalled(); // fail-open = free
  });

  it('fails conservatively on gold read failure — charges', async () => {
    trackPlayer(BURNER, DELEGATOR);
    mockGetBalance.mockResolvedValue(0n);
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    mockGetPlayerLevel.mockResolvedValue(5n);
    mockGetGoldBalance.mockResolvedValue(null); // RPC failure

    await runOneCheck();

    expect(mockSendRelayerTx).toHaveBeenCalled();
    expect(mockRecordFunding).toHaveBeenCalledWith(DELEGATOR, 1_000_000_000_000_000n);
  });

  it('charges gold from delegator, not burner (MetaMask path)', async () => {
    const mmBurner = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as Address;
    const mmDelegator = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as Address;

    trackPlayer(mmBurner, mmDelegator);
    mockGetBalance.mockResolvedValue(0n);
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    mockGetPlayerLevel.mockResolvedValue(5n);
    mockGetGoldBalance.mockResolvedValue(2_000_000_000_000_000_000n);

    await runOneCheck();

    // Gold is charged from the delegator (MetaMask wallet), not the burner
    expect(mockRecordFunding).toHaveBeenCalledWith(mmDelegator, 1_000_000_000_000_000n);
  });
});
