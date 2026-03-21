import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type Hex, padHex, encodePacked, toHex } from 'viem';

// ==================== Mocks ====================

vi.mock('./config.js', () => ({
  config: {
    worldAddress: '0x5554b8F69526eFebf6cb32161A314Eaff1c8c39b' as Address,
  },
}));

const mockReadContract = vi.fn();

vi.mock('./tx.js', () => ({
  publicClient: {
    readContract: (...args: unknown[]) => mockReadContract(...args),
  },
}));

// ==================== Import ====================

const { getCharacterId, getPlayerLevel, getGoldBalance, getGoldPerGasCharge, _resetCharacterIdCacheForTesting } = await import('./chainReader.js');

// ==================== Helpers ====================

/**
 * Build a Stats staticData hex string with a known level value.
 * Stats layout (tightly packed):
 *   strength(int256,32) + agility(int256,32) + class(uint8,1) + intelligence(int256,32)
 *   + maxHp(int256,32) + currentHp(int256,32) + experience(uint256,32) + level(uint256,32) + ...
 * Total bytes before level: 32+32+1+32+32+32+32 = 193
 * Level starts at byte 193, 32 bytes.
 */
function buildStatsData(level: bigint): Hex {
  // 193 zero bytes before level
  const prefix = '00'.repeat(193);
  // Level as 32 bytes (64 hex chars), big-endian
  const levelHex = level.toString(16).padStart(64, '0');
  // Some trailing bytes (powerSource, race, etc.) — 5 bytes
  const suffix = '00'.repeat(5);
  return ('0x' + prefix + levelHex + suffix) as Hex;
}

/**
 * Build CharacterOwner staticData: [uint256 tokenId (32)] [bytes32 characterId (32)]
 */
function buildCharacterOwnerData(characterId: Hex): Hex {
  // tokenId = 1 (32 bytes)
  const tokenId = '0000000000000000000000000000000000000000000000000000000000000001';
  // characterId (strip 0x, pad to 64 hex chars)
  const charId = characterId.slice(2).padStart(64, '0');
  return ('0x' + tokenId + charId) as Hex;
}

// ==================== Tests ====================

describe('getCharacterId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCharacterIdCacheForTesting();
  });

  it('extracts characterId from CharacterOwner staticData', async () => {
    const expectedId = '0x000000000000000000000000000000000000000000000000000000000000002a' as Hex;
    mockReadContract.mockResolvedValue([
      buildCharacterOwnerData(expectedId),
      '0x' as Hex,
      '0x' as Hex,
    ]);

    const result = await getCharacterId('0x1111111111111111111111111111111111111111' as Address);
    expect(result).toBe(expectedId);
  });

  it('returns null for zero characterId', async () => {
    const zeroId = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;
    mockReadContract.mockResolvedValue([
      buildCharacterOwnerData(zeroId),
      '0x' as Hex,
      '0x' as Hex,
    ]);

    const result = await getCharacterId('0x3333333333333333333333333333333333333333' as Address);
    expect(result).toBeNull();
  });

  it('returns null on RPC failure', async () => {
    mockReadContract.mockRejectedValue(new Error('RPC timeout'));

    const result = await getCharacterId('0x4444444444444444444444444444444444444444' as Address);
    expect(result).toBeNull();
  });

  it('returns null for empty/short staticData', async () => {
    mockReadContract.mockResolvedValue(['0x', '0x', '0x']);

    const result = await getCharacterId('0x5555555555555555555555555555555555555555' as Address);
    expect(result).toBeNull();
  });

  it('serves cached value within TTL', async () => {
    vi.useFakeTimers();
    const expectedId = '0x000000000000000000000000000000000000000000000000000000000000007b' as Hex;
    mockReadContract.mockResolvedValue([
      buildCharacterOwnerData(expectedId),
      '0x' as Hex,
      '0x' as Hex,
    ]);

    const addr = '0x6666666666666666666666666666666666666666' as Address;
    const first = await getCharacterId(addr);
    expect(first).toBe(expectedId);
    expect(mockReadContract).toHaveBeenCalledTimes(1);

    // Advance 30 minutes — still within 1-hour TTL
    vi.advanceTimersByTime(30 * 60 * 1000);
    mockReadContract.mockClear();

    const second = await getCharacterId(addr);
    expect(second).toBe(expectedId);
    expect(mockReadContract).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('re-fetches after TTL expires', async () => {
    vi.useFakeTimers();
    const oldId = '0x000000000000000000000000000000000000000000000000000000000000007b' as Hex;
    const newId = '0x00000000000000000000000000000000000000000000000000000000000000ff' as Hex;

    mockReadContract.mockResolvedValue([
      buildCharacterOwnerData(oldId),
      '0x' as Hex,
      '0x' as Hex,
    ]);

    const addr = '0x7777777777777777777777777777777777777777' as Address;
    const first = await getCharacterId(addr);
    expect(first).toBe(oldId);

    // Advance past 1-hour TTL
    vi.advanceTimersByTime(61 * 60 * 1000);
    mockReadContract.mockClear();
    mockReadContract.mockResolvedValue([
      buildCharacterOwnerData(newId),
      '0x' as Hex,
      '0x' as Hex,
    ]);

    const second = await getCharacterId(addr);
    expect(second).toBe(newId);
    expect(mockReadContract).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

describe('getPlayerLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts level from Stats staticData at correct offset', async () => {
    mockReadContract.mockResolvedValue([
      buildStatsData(7n),
      '0x' as Hex,
      '0x' as Hex,
    ]);

    const level = await getPlayerLevel('0xabc' as Hex);
    expect(level).toBe(7n);
  });

  it('handles level 1', async () => {
    mockReadContract.mockResolvedValue([
      buildStatsData(1n),
      '0x' as Hex,
      '0x' as Hex,
    ]);

    const level = await getPlayerLevel('0xdef' as Hex);
    expect(level).toBe(1n);
  });

  it('handles level 10', async () => {
    mockReadContract.mockResolvedValue([
      buildStatsData(10n),
      '0x' as Hex,
      '0x' as Hex,
    ]);

    const level = await getPlayerLevel('0x123' as Hex);
    expect(level).toBe(10n);
  });

  it('returns null on RPC failure', async () => {
    mockReadContract.mockRejectedValue(new Error('RPC down'));

    const level = await getPlayerLevel('0xfff' as Hex);
    expect(level).toBeNull();
  });

  it('returns null for short staticData', async () => {
    mockReadContract.mockResolvedValue(['0x0000', '0x', '0x']);

    const level = await getPlayerLevel('0xeee' as Hex);
    expect(level).toBeNull();
  });
});

describe('getGoldBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads gold balance from Balances table', async () => {
    // Single uint256 = 32 bytes
    const balance = 5_000_000_000_000_000_000n; // 5e18
    const staticData = ('0x' + balance.toString(16).padStart(64, '0')) as Hex;

    mockReadContract.mockResolvedValue([staticData, '0x', '0x']);

    const result = await getGoldBalance('0x1111111111111111111111111111111111111111' as Address);
    expect(result).toBe(balance);
  });

  it('returns 0n for empty record', async () => {
    mockReadContract.mockResolvedValue(['0x', '0x', '0x']);

    const result = await getGoldBalance('0x2222222222222222222222222222222222222222' as Address);
    expect(result).toBe(0n);
  });

  it('returns null on RPC failure', async () => {
    mockReadContract.mockRejectedValue(new Error('timeout'));

    const result = await getGoldBalance('0x3333333333333333333333333333333333333333' as Address);
    expect(result).toBeNull();
  });
});

describe('getGoldPerGasCharge', () => {
  // goldPerGasCharge has an internal 5-min cache that persists across tests.
  // Run these tests in a specific order that accounts for the cache.

  it('returns null on RPC failure (cold cache)', async () => {
    // This runs first — cache is empty, so it hits RPC
    vi.clearAllMocks();
    mockReadContract.mockRejectedValue(new Error('RPC error'));

    const result = await getGoldPerGasCharge();
    expect(result).toBeNull();
  });

  it('extracts goldPerGasCharge from GasStationSwapConfig at correct offset', async () => {
    vi.clearAllMocks();
    // GasStationSwapConfig static layout:
    // swapRouter(address, 20 bytes) + weth(address, 20 bytes) + poolFee(uint24, 3 bytes)
    // + relayerAddress(address, 20 bytes) + goldPerGasCharge(uint256, 32 bytes)
    // goldPerGasCharge starts at byte 63

    const swapRouter = '2626664c2603336E57B271c5C0b26F421741e481'.toLowerCase();       // 20 bytes
    const weth = '4200000000000000000000000000000000000006';                             // 20 bytes
    const poolFee = '002710';                                                             // 3 bytes (10000)
    const relayer = '1111111111111111111111111111111111111111';                            // 20 bytes
    const goldPerCharge = 2_000_000_000_000_000_000n; // 2e18
    const chargeHex = goldPerCharge.toString(16).padStart(64, '0');                       // 32 bytes

    const staticData = ('0x' + swapRouter + weth + poolFee + relayer + chargeHex) as Hex;
    mockReadContract.mockResolvedValue([staticData, '0x', '0x']);

    const result = await getGoldPerGasCharge();
    expect(result).toBe(goldPerCharge);
  });

  it('caches result for 5 minutes', async () => {
    // Previous test populated the cache. This call should use it.
    vi.clearAllMocks(); // Clear RPC mock call count

    await getGoldPerGasCharge();

    // Should NOT have called RPC — served from cache
    expect(mockReadContract).not.toHaveBeenCalled();
  });
});
