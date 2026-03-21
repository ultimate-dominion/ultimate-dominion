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
    poolFee: 10000,
    swapSlippageBps: 500,
    swapIntervalMs: 3_600_000,
    swapThreshold: 100_000_000_000_000_000_000n,
    fundingAmount: 500_000_000_000_000n,
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

const { callFundAndCharge } = await import('./gasCharge.js');

// ==================== Helpers ====================

const CHARACTER_ID = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;

// ==================== Tests ====================

describe('callFundAndCharge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacterId.mockResolvedValue(CHARACTER_ID);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('calls UD__fundAndCharge on the world contract', async () => {
    mockSendPrimaryTx.mockResolvedValueOnce('0xhash' as `0x${string}`);

    await callFundAndCharge('0x0000000000000000000000000000000000001234' as Address);

    expect(mockSendPrimaryTx).toHaveBeenCalledTimes(1);
    expect(mockSendPrimaryTx.mock.calls[0][0].to).toBe('0x0000000000000000000000000000000000000001');

    // Verify it encodes UD__fundAndCharge
    const calldata = mockSendPrimaryTx.mock.calls[0][0].calldata as string;
    const { decodeFunctionData, parseAbi } = await import('viem');
    const abi = parseAbi([
      'function UD__fundAndCharge(address player, bytes32 characterId)',
    ]);
    const decoded = decodeFunctionData({ abi, data: calldata as `0x${string}` });
    expect(decoded.args[0].toLowerCase()).toBe('0x0000000000000000000000000000000000001234');
    expect(decoded.args[1]).toBe(CHARACTER_ID);
  });

  it('skips if player has no characterId', async () => {
    mockGetCharacterId.mockResolvedValueOnce(null);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await callFundAndCharge('0x0000000000000000000000000000000000005678' as Address);

    expect(mockSendPrimaryTx).not.toHaveBeenCalled();
  });

  it('propagates errors to caller', async () => {
    mockSendPrimaryTx.mockRejectedValueOnce(new Error('tx failed'));

    await expect(
      callFundAndCharge('0x0000000000000000000000000000000000009999' as Address)
    ).rejects.toThrow('tx failed');
  });
});
