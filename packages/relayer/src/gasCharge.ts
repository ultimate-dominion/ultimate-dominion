import {
  type Address,
  type Hex,
  encodeFunctionData,
  parseAbi,
  formatEther,
} from 'viem';
import { config, gasChargingEnabled } from './config.js';
import { publicClient, relayerAddress, sendPrimaryTx } from './tx.js';
import { getCharacterId } from './chainReader.js';

// ==================== State ====================

/** Pending ETH funded per player since last flush (in wei) */
const pendingCharges = new Map<Address, bigint>();

/** Retry count per player — dead-letter after 3 failures */
const chargeRetries = new Map<Address, number>();

let chargeTimer: ReturnType<typeof setInterval> | null = null;
let swapTimer: ReturnType<typeof setInterval> | null = null;

// ==================== ABI fragments ====================

const worldAbi = parseAbi([
  'function UD__fundAndCharge(address player, bytes32 characterId)',
]);

const erc20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const swapRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut)',
]);

const quoterV2Abi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);

const wethAbi = parseAbi([
  'function withdraw(uint256 wad)',
]);

async function getSwapMinimum(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<bigint> {
  try {
    const { result } = await publicClient.simulateContract({
      address: config.quoterV2,
      abi: quoterV2Abi,
      functionName: 'quoteExactInputSingle',
      args: [{ tokenIn, tokenOut, amountIn, fee: config.poolFee, sqrtPriceLimitX96: 0n }],
    });
    const expectedOut = result[0];
    return expectedOut * BigInt(10000 - config.swapSlippageBps) / 10000n;
  } catch (err) {
    console.warn('[gasCharge] Quote failed, using 1 minimum:', err);
    return 1n;
  }
}

// ==================== Core Functions ====================

/**
 * Record a gas funding event for a player. Called after successful fund/top-up.
 * Synchronous — zero latency impact on funding path.
 */
export function recordFunding(eoaAddress: Address, ethAmount: bigint): void {
  if (!gasChargingEnabled) return;
  const current = pendingCharges.get(eoaAddress) || 0n;
  pendingCharges.set(eoaAddress, current + ethAmount);
}

/**
 * Flush pending charges — charge Gold from players via fundAndCharge.
 * Runs on interval (default 5 min).
 */
export async function flushCharges(): Promise<void> {
  if (pendingCharges.size === 0) return;

  // Snapshot and clear
  const snapshot = new Map(pendingCharges);
  pendingCharges.clear();

  console.log(`[gasCharge] Flushing ${snapshot.size} players, ${formatEther(getTotalFromMap(snapshot))} total ETH funded`);

  for (const [player, ethFunded] of snapshot) {
    const charId = await getCharacterId(player);
    if (!charId) {
      console.log(`[gasCharge] Skipping ${player} — no characterId found`);
      continue;
    }

    try {
      const calldata = encodeFunctionData({
        abi: worldAbi,
        functionName: 'UD__fundAndCharge',
        args: [player, charId],
      });

      const txHash = await sendPrimaryTx({
        to: config.worldAddress,
        calldata,
      });

      console.log(`[gasCharge] Charged ${player} tx: ${txHash}`);
      chargeRetries.delete(player);
    } catch (err) {
      const retries = (chargeRetries.get(player) || 0) + 1;
      if (retries >= 3) {
        console.warn(`[gasCharge] Dead-lettering charge for ${player} after ${retries} failures (${formatEther(ethFunded)} ETH)`);
        chargeRetries.delete(player);
      } else {
        chargeRetries.set(player, retries);
        const existing = pendingCharges.get(player) || 0n;
        pendingCharges.set(player, existing + ethFunded);
        console.warn(`[gasCharge] Charge failed for ${player}, retry ${retries}/3:`, (err as Error).message?.slice(0, 100));
      }
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

    const approveTx = await sendPrimaryTx({
      to: config.goldToken,
      calldata: approveCalldata,
    });
    console.log(`[gasCharge] Approve tx: ${approveTx}`);

    // Wait for approve to be included before swapping — otherwise the swap's
    // gas estimation runs against stale allowance and reverts with STF.
    await publicClient.waitForTransactionReceipt({ hash: approveTx, timeout: 30_000 });

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
        amountOutMinimum: await getSwapMinimum(config.goldToken, config.weth, goldBalance),
        sqrtPriceLimitX96: 0n,
      }],
    });

    const swapTx = await sendPrimaryTx({
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

      const unwrapTx = await sendPrimaryTx({
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

// ==================== Testing ====================

/** Reset internal state — test use only */
export function _resetForTesting(): void {
  pendingCharges.clear();
  chargeRetries.clear();
}

// ==================== Health ====================

function getTotalFromMap(map: Map<Address, bigint>): bigint {
  let total = 0n;
  for (const amount of map.values()) total += amount;
  return total;
}

export function getPendingChargeCount(): number {
  return pendingCharges.size;
}

export function getTotalPendingEth(): string {
  return formatEther(getTotalFromMap(pendingCharges));
}
