import {
  type Address,
  type Hex,
  encodeFunctionData,
  encodePacked,
  padHex,
  toHex,
  parseAbi,
  formatEther,
} from 'viem';
import { config, gasChargingEnabled } from './config.js';
import { publicClient, relayerAddress, sendRelayerTx } from './tx.js';

// ==================== State ====================

/** Pending tx counts per player since last flush */
const pendingCharges = new Map<Address, number>();

/** Cached characterId lookups (address → characterId) */
const characterIdCache = new Map<Address, Hex>();

let chargeTimer: ReturnType<typeof setInterval> | null = null;
let swapTimer: ReturnType<typeof setInterval> | null = null;

// ==================== ABI fragments ====================

const worldAbi = parseAbi([
  'function UD__batchChargeGasGoldWithCounts(address[] players, bytes32[] characterIds, uint256[] counts) returns (uint256[] charged)',
]);

const erc20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const swapRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut)',
]);

const wethAbi = parseAbi([
  'function withdraw(uint256 wad)',
]);

// ==================== Table ID for CharacterOwner ====================

// ResourceId: type=table(0x7462), namespace="UD" (14 bytes), name="CharacterOwner" (16 bytes)
const CHARACTER_OWNER_TABLE_ID = encodePacked(
  ['bytes2', 'bytes14', 'bytes16'],
  [toHex('tb', { size: 2 }) as Hex, toHex('UD', { size: 14 }) as Hex, toHex('CharacterOwner', { size: 16 }) as Hex],
);

// ==================== Core Functions ====================

/**
 * Record a relayed tx for a player. Called after successful relay.
 * Synchronous — zero latency impact on relay path.
 */
export function recordRelay(eoaAddress: Address): void {
  if (!gasChargingEnabled) return;
  const current = pendingCharges.get(eoaAddress) || 0;
  pendingCharges.set(eoaAddress, current + 1);
}

/**
 * Look up a player's characterId from the CharacterOwner MUD table.
 * Uses cache to avoid repeated on-chain reads.
 */
async function getCharacterId(player: Address): Promise<Hex | null> {
  const cached = characterIdCache.get(player);
  if (cached) return cached;

  try {
    // MUD getRecord: read static fields from CharacterOwner table
    // Key: [padded address], Value: [uint256 characterTokenId, bytes32 characterId]
    const keyTuple = [padHex(player, { size: 32 })] as const;

    const data = await publicClient.readContract({
      address: config.worldAddress,
      abi: parseAbi([
        'function getRecord(bytes32 tableId, bytes32[] calldata keyTuple) view returns (bytes memory staticData, bytes32 encodedLengths, bytes memory dynamicData)',
      ]),
      functionName: 'getRecord',
      args: [CHARACTER_OWNER_TABLE_ID, [...keyTuple]],
    });

    const staticData = data[0] as Hex;
    // staticData is 64 bytes: [uint256 characterTokenId (32)] [bytes32 characterId (32)]
    if (!staticData || staticData.length < 130) return null; // 0x + 128 hex chars = 66 bytes min

    // Extract characterId from bytes 32-63 (hex chars 66-130)
    const characterId = ('0x' + staticData.slice(66, 130)) as Hex;
    if (characterId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return null;
    }

    characterIdCache.set(player, characterId);
    return characterId;
  } catch (err) {
    console.error(`[gasCharge] Failed to look up characterId for ${player}:`, err);
    return null;
  }
}

/**
 * Flush pending charges — batch-charge Gold from players.
 * Runs on interval (default 5 min).
 */
export async function flushCharges(): Promise<void> {
  if (pendingCharges.size === 0) return;

  // Snapshot and clear
  const snapshot = new Map(pendingCharges);
  pendingCharges.clear();

  console.log(`[gasCharge] Flushing ${snapshot.size} players, ${getTotalFromMap(snapshot)} total txs`);

  try {
    // Build arrays
    const players: Address[] = [];
    const characterIds: Hex[] = [];
    const counts: bigint[] = [];

    for (const [player, count] of snapshot) {
      const charId = await getCharacterId(player);
      if (!charId) {
        console.log(`[gasCharge] Skipping ${player} — no characterId found`);
        continue;
      }
      players.push(player);
      characterIds.push(charId);
      counts.push(BigInt(count));
    }

    if (players.length === 0) {
      console.log('[gasCharge] No eligible players to charge');
      return;
    }

    // Encode the call to the World contract
    const calldata = encodeFunctionData({
      abi: worldAbi,
      functionName: 'UD__batchChargeGasGoldWithCounts',
      args: [players, characterIds, counts],
    });

    const txHash = await sendRelayerTx({
      to: config.worldAddress,
      calldata,
    });

    console.log(`[gasCharge] Batch charge tx: ${txHash} (${players.length} players)`);
  } catch (err) {
    console.error('[gasCharge] Batch charge failed, re-queuing:', err);
    // Re-add charges for next flush
    for (const [player, count] of snapshot) {
      const existing = pendingCharges.get(player) || 0;
      pendingCharges.set(player, existing + count);
    }
  }
}

/**
 * Swap accumulated Gold for ETH via Uniswap V3.
 * Runs on interval (default 1 hour).
 */
export async function swapGoldForEth(): Promise<void> {
  try {
    // Check relayer's Gold balance
    const goldBalance = await publicClient.readContract({
      address: config.goldToken,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [relayerAddress],
    });

    if (goldBalance < config.swapThreshold) {
      console.log(`[gasCharge] Gold balance ${formatEther(goldBalance)} below threshold, skipping swap`);
      return;
    }

    console.log(`[gasCharge] Swapping ${formatEther(goldBalance)} Gold for ETH`);

    // 1. Approve SwapRouter to spend Gold
    const approveCalldata = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [config.swapRouter, goldBalance],
    });

    const approveTx = await sendRelayerTx({
      to: config.goldToken,
      calldata: approveCalldata,
    });
    console.log(`[gasCharge] Approve tx: ${approveTx}`);

    // 2. Swap Gold → WETH via exactInputSingle
    const swapCalldata = encodeFunctionData({
      abi: swapRouterAbi,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: config.goldToken,
        tokenOut: config.weth,
        fee: config.poolFee,
        recipient: relayerAddress,
        amountIn: goldBalance,
        amountOutMinimum: 1n, // Accept any output — these are small relayer recoup swaps
        sqrtPriceLimitX96: 0n,
      }],
    });

    const swapTx = await sendRelayerTx({
      to: config.swapRouter,
      calldata: swapCalldata,
    });
    console.log(`[gasCharge] Swap tx: ${swapTx}`);

    // 3. Unwrap WETH → ETH
    const wethBalance = await publicClient.readContract({
      address: config.weth,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [relayerAddress],
    });

    if (wethBalance > 0n) {
      const unwrapCalldata = encodeFunctionData({
        abi: wethAbi,
        functionName: 'withdraw',
        args: [wethBalance],
      });

      const unwrapTx = await sendRelayerTx({
        to: config.weth,
        calldata: unwrapCalldata,
      });
      console.log(`[gasCharge] Unwrap WETH tx: ${unwrapTx}`);
    }

    // Log new ETH balance
    const ethBalance = await publicClient.getBalance({ address: relayerAddress });
    console.log(`[gasCharge] Relayer ETH balance after swap: ${formatEther(ethBalance)}`);
  } catch (err) {
    console.error('[gasCharge] Gold→ETH swap failed:', err);
  }
}

// ==================== Schedulers ====================

export function startSchedulers(): void {
  if (!gasChargingEnabled) {
    console.log('[gasCharge] Disabled (WORLD_ADDRESS or GOLD_TOKEN not set)');
    return;
  }

  console.log(`[gasCharge] Enabled — charge every ${config.chargeIntervalMs / 1000}s, swap every ${config.swapIntervalMs / 1000}s`);
  console.log(`[gasCharge] World: ${config.worldAddress}`);
  console.log(`[gasCharge] Gold token: ${config.goldToken}`);
  console.log(`[gasCharge] Swap threshold: ${formatEther(config.swapThreshold)} Gold`);

  chargeTimer = setInterval(() => {
    flushCharges().catch((err) => console.error('[gasCharge] flushCharges error:', err));
  }, config.chargeIntervalMs);

  swapTimer = setInterval(() => {
    swapGoldForEth().catch((err) => console.error('[gasCharge] swapGoldForEth error:', err));
  }, config.swapIntervalMs);
}

export function stopSchedulers(): void {
  if (chargeTimer) {
    clearInterval(chargeTimer);
    chargeTimer = null;
  }
  if (swapTimer) {
    clearInterval(swapTimer);
    swapTimer = null;
  }
}

// ==================== Health ====================

function getTotalFromMap(map: Map<Address, number>): number {
  let total = 0;
  for (const count of map.values()) total += count;
  return total;
}

export function getPendingChargeCount(): number {
  return pendingCharges.size;
}

export function getTotalPendingTxs(): number {
  return getTotalFromMap(pendingCharges);
}
