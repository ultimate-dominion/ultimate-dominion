import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, formatEther } from 'viem';

// ==================== Mocks ====================

const mockGetBalance = vi.fn<(args: { address: Address }) => Promise<bigint>>();

vi.mock('./config.js', () => ({
  config: {
    funderPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // hardhat #0
    poolMinBalance: 5_000_000_000_000_000n,     // 0.005 ETH
    poolTargetBalance: 10_000_000_000_000_000n,  // 0.01 ETH
    poolFundCheckIntervalMs: 300_000,
    chainId: 8453,
    rpcUrl: 'http://localhost:8545',
    rpcAuthToken: '',
    rpcFallbackUrl: '',
    relayerPrivateKeys: ['0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'],
    relayerPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  },
}));

const mockSendTransaction = vi.fn().mockResolvedValue('0xfundtx' as `0x${string}`);

// Mock viem wallet creation
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createWalletClient: () => ({
      sendTransaction: mockSendTransaction,
    }),
  };
});

vi.mock('./tx.js', () => ({
  publicClient: {
    getBalance: (args: { address: Address }) => mockGetBalance(args),
    getTransactionCount: () => Promise.resolve(0),
  },
}));

vi.mock('./walletPool.js', () => ({
  allAddresses: [
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
  ],
  chain: {
    id: 8453,
    name: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['http://localhost:8545'] } },
  },
  rpcTransport: () => ({}),
}));

// ==================== Import ====================

const { checkAndFundPool } = await import('./poolFunder.js');

// ==================== Tests ====================

describe('poolFunder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('funds wallet below threshold to target', async () => {
    const poolAddr1 = '0x1111111111111111111111111111111111111111';
    const poolAddr2 = '0x2222222222222222222222222222222222222222';

    // Pool wallet 1: below min (0.002 ETH), Pool wallet 2: above min (0.01 ETH)
    // Funder balance calls (initial check + before each top-up)
    mockGetBalance
      .mockResolvedValueOnce(100_000_000_000_000_000n) // funder balance check (initial)
      .mockResolvedValueOnce(2_000_000_000_000_000n)   // pool wallet 1 balance
      .mockResolvedValueOnce(100_000_000_000_000_000n) // funder balance (before funding wallet 1)
      .mockResolvedValueOnce(10_000_000_000_000_000n); // pool wallet 2 balance (above min)

    await checkAndFundPool();

    expect(mockSendTransaction).toHaveBeenCalledTimes(1);
    // Should have sent topUp = 0.01 - 0.002 = 0.008 ETH
    const call = mockSendTransaction.mock.calls[0][0] as any;
    expect(call.to).toBe(poolAddr1);
    expect(call.value).toBe(8_000_000_000_000_000n);
  });

  it('skips wallet above threshold', async () => {
    mockGetBalance
      .mockResolvedValueOnce(100_000_000_000_000_000n)  // funder balance
      .mockResolvedValueOnce(10_000_000_000_000_000n)   // pool wallet 1: at target
      .mockResolvedValueOnce(20_000_000_000_000_000n);  // pool wallet 2: above target

    await checkAndFundPool();

    expect(mockSendTransaction).not.toHaveBeenCalled();
  });

  it('logs warning and skips when funder has insufficient balance', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockGetBalance
      .mockResolvedValueOnce(2_000_000_000_000_000n) // funder balance (low — initial check)
      .mockResolvedValueOnce(1_000_000_000_000_000n) // pool wallet 1: below min
      .mockResolvedValueOnce(2_000_000_000_000_000n) // funder balance (before funding — too low)
      .mockResolvedValueOnce(1_000_000_000_000_000n) // pool wallet 2: below min
      .mockResolvedValueOnce(2_000_000_000_000_000n); // funder balance (before funding — too low)

    await checkAndFundPool();

    // Should not crash, should not send tx
    expect(mockSendTransaction).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
