import {
  type Address,
  type Hex,
  encodePacked,
  padHex,
  parseAbi,
  toHex,
} from 'viem';
import { config } from './config.js';
import { publicClient } from './tx.js';

// ==================== Table IDs ====================
// MUD ResourceId: bytes2 type + bytes14 namespace + bytes16 name

// CharacterOwner — namespace "UD", name "CharacterOwner"
const CHARACTER_OWNER_TABLE_ID = encodePacked(
  ['bytes2', 'bytes14', 'bytes16'],
  [toHex('tb', { size: 2 }) as Hex, toHex('UD', { size: 14 }) as Hex, toHex('CharacterOwner', { size: 16 }) as Hex],
);

// Stats — namespace "UD", name "Stats"
const STATS_TABLE_ID = encodePacked(
  ['bytes2', 'bytes14', 'bytes16'],
  [toHex('tb', { size: 2 }) as Hex, toHex('UD', { size: 14 }) as Hex, toHex('Stats', { size: 16 }) as Hex],
);

// Gold Balances — namespace "Gold", name "Balances" (ERC20 module)
const GOLD_BALANCES_TABLE_ID = encodePacked(
  ['bytes2', 'bytes14', 'bytes16'],
  [toHex('tb', { size: 2 }) as Hex, toHex('Gold', { size: 14 }) as Hex, toHex('Balances', { size: 16 }) as Hex],
);

// GasStationSwapConfig — namespace "UD", name "GasStationSwapCo" (truncated to 16 chars)
const GAS_STATION_SWAP_CONFIG_TABLE_ID = encodePacked(
  ['bytes2', 'bytes14', 'bytes16'],
  [toHex('tb', { size: 2 }) as Hex, toHex('UD', { size: 14 }) as Hex, toHex('GasStationSwapCo', { size: 16 }) as Hex],
);

// ==================== ABI ====================

const getRecordAbi = parseAbi([
  'function getRecord(bytes32 tableId, bytes32[] calldata keyTuple) view returns (bytes memory staticData, bytes32 encodedLengths, bytes memory dynamicData)',
]);

// ==================== Caches ====================

const characterIdCache = new Map<string, Hex>();

let goldPerGasChargeCache: { value: bigint; fetchedAt: number } | null = null;
const GOLD_PER_CHARGE_TTL = 300_000; // 5 min

// ==================== Read Functions ====================

/**
 * Look up a player's characterId from the CharacterOwner MUD table.
 * Caches results to avoid repeated on-chain reads.
 */
export async function getCharacterId(player: Address): Promise<Hex | null> {
  const key = player.toLowerCase();
  const cached = characterIdCache.get(key);
  if (cached) return cached;

  try {
    const keyTuple = [padHex(player, { size: 32 })] as const;
    const data = await publicClient.readContract({
      address: config.worldAddress,
      abi: getRecordAbi,
      functionName: 'getRecord',
      args: [CHARACTER_OWNER_TABLE_ID, [...keyTuple]],
    });

    const staticData = data[0] as Hex;
    // staticData: [uint256 characterTokenId (32 bytes)] [bytes32 characterId (32 bytes)]
    if (!staticData || staticData.length < 130) return null; // 0x + 128 hex chars

    const characterId = ('0x' + staticData.slice(66, 130)) as Hex;
    if (characterId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return null;
    }

    characterIdCache.set(key, characterId);
    return characterId;
  } catch (err) {
    console.error(`[chainReader] Failed to look up characterId for ${player}:`, err);
    return null;
  }
}

/**
 * Read a player's level from the Stats MUD table.
 * Stats schema (static, tightly packed):
 *   strength(int256,32) + agility(int256,32) + class(uint8,1) + intelligence(int256,32)
 *   + maxHp(int256,32) + currentHp(int256,32) + experience(uint256,32) + level(uint256,32) + ...
 * Level is at byte offset 193, 32 bytes.
 */
export async function getPlayerLevel(characterId: Hex): Promise<bigint | null> {
  try {
    const keyTuple = [characterId] as const;
    const data = await publicClient.readContract({
      address: config.worldAddress,
      abi: getRecordAbi,
      functionName: 'getRecord',
      args: [STATS_TABLE_ID, [...keyTuple]],
    });

    const staticData = data[0] as Hex;
    // Level at byte 193 = hex offset 2 + 193*2 = 388, length 32 bytes = 64 hex chars
    if (!staticData || staticData.length < 452) return null;

    const levelHex = '0x' + staticData.slice(388, 452);
    return BigInt(levelHex);
  } catch (err) {
    console.error(`[chainReader] Failed to read level for ${characterId}:`, err);
    return null;
  }
}

/**
 * Read a player's gold balance from the ERC20 Balances table (Gold namespace).
 * The table stores a single uint256 per address key.
 */
export async function getGoldBalance(player: Address): Promise<bigint | null> {
  try {
    const keyTuple = [padHex(player, { size: 32 })] as const;
    const data = await publicClient.readContract({
      address: config.worldAddress,
      abi: getRecordAbi,
      functionName: 'getRecord',
      args: [GOLD_BALANCES_TABLE_ID, [...keyTuple]],
    });

    const staticData = data[0] as Hex;
    // Single uint256 field = 32 bytes = 64 hex chars + 0x prefix
    if (!staticData || staticData.length < 66) return 0n;

    return BigInt(staticData);
  } catch (err) {
    console.error(`[chainReader] Failed to read gold balance for ${player}:`, err);
    return null;
  }
}

/**
 * Read goldPerGasCharge from the GasStationSwapConfig singleton table.
 * Schema: swapRouter(20) + weth(20) + poolFee(3) + relayerAddress(20) + goldPerGasCharge(32)
 * goldPerGasCharge is at byte offset 63, 32 bytes.
 * Cached for 5 minutes.
 */
export async function getGoldPerGasCharge(): Promise<bigint | null> {
  const now = Date.now();
  if (goldPerGasChargeCache && (now - goldPerGasChargeCache.fetchedAt) < GOLD_PER_CHARGE_TTL) {
    return goldPerGasChargeCache.value;
  }

  try {
    const data = await publicClient.readContract({
      address: config.worldAddress,
      abi: getRecordAbi,
      functionName: 'getRecord',
      args: [GAS_STATION_SWAP_CONFIG_TABLE_ID, []],
    });

    const staticData = data[0] as Hex;
    // goldPerGasCharge at byte 63 = hex offset 2 + 63*2 = 128, length 32 bytes = 64 hex chars
    if (!staticData || staticData.length < 192) return null;

    const value = BigInt('0x' + staticData.slice(128, 192));
    goldPerGasChargeCache = { value, fetchedAt: now };
    return value;
  } catch (err) {
    console.error('[chainReader] Failed to read goldPerGasCharge:', err);
    return null;
  }
}
