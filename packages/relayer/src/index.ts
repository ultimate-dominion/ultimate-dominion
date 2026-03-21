import express from 'express';
import cors from 'cors';
import { type Address, encodeFunctionData, formatEther, parseAbi, parseEther } from 'viem';
import { config } from './config.js';
import {
  relayerAddress,
  publicClient,
  getRelayerBalance,
  sendRelayerTx,
} from './tx.js';
import { initializePool, getPoolStatus, allAddresses } from './walletPool.js';
import { startSwapScheduler, stopSwapScheduler } from './gasCharge.js';
import { callFundAndCharge } from './gasCharge.js';
import { gasChargingEnabled } from './config.js';
import { startRpcHealthCheck, stopRpcHealthCheck, getRpcStatus } from './rpcManager.js';
import { startBalanceMonitor, stopBalanceMonitor, trackFundedAddress, trackPlayer, getFundedCount } from './balanceMonitor.js';
import { startPoolFunder, stopPoolFunder, getFunderStatus } from './poolFunder.js';
import { loadFundedAddresses, saveFundedAddresses, loadFulfilledSessions, saveFulfilledSessions, loadPlayerMap, savePlayerMap } from './persistence.js';

// Gold purchase dedup (stripeSessionId → fulfilled) — persisted to disk
const fulfilledSessions = loadFulfilledSessions();

// Player map: burnerAddress → delegatorAddress — persisted to disk
const playerMap = loadPlayerMap();

const swapRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
]);

const quoterV2Abi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);

async function getMinimumOutput(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<bigint> {
  try {
    const { result } = await publicClient.simulateContract({
      address: config.quoterV2,
      abi: quoterV2Abi,
      functionName: 'quoteExactInputSingle',
      args: [{ tokenIn, tokenOut, amountIn, fee: config.poolFee, sqrtPriceLimitX96: 0n }],
    });
    const expectedOut = result[0];
    // Apply slippage tolerance
    return expectedOut * BigInt(10000 - config.swapSlippageBps) / 10000n;
  } catch (err) {
    console.warn('[swap] Quote failed, using 0 minimum:', err);
    return 1n; // Fallback — better to succeed than revert, but log the warning
  }
}

// Anti-griefing state — persisted to disk
const fundedAddresses = loadFundedAddresses();
const recentFundings: number[] = []; // timestamps
const ipFundings = new Map<string, number[]>(); // ip -> timestamps
const emergencyFundTimestamps = new Map<string, number>(); // address -> last emergency fund time

const EMERGENCY_FUND_COOLDOWN_MS = 60_000; // 1 per address per 60s

function emergencyFundOk(address: string): boolean {
  const last = emergencyFundTimestamps.get(address);
  if (!last) return true;
  return Date.now() - last >= EMERGENCY_FUND_COOLDOWN_MS;
}

function rateLimitOk(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  // Clean old entries
  while (recentFundings.length > 0 && recentFundings[0] < oneMinuteAgo) {
    recentFundings.shift();
  }
  return recentFundings.length < config.maxFundingsPerMinute;
}

function ipRateLimitOk(ip: string): boolean {
  const now = Date.now();
  const fiveMinutesAgo = now - 300_000;
  let timestamps = ipFundings.get(ip) || [];
  timestamps = timestamps.filter(t => t > fiveMinutesAgo);
  ipFundings.set(ip, timestamps);
  return timestamps.length < 3; // max 3 fundings per IP per 5 minutes
}

async function main() {
  console.log('=== Ultimate Dominion Gas Station ===');
  console.log(`Primary: ${relayerAddress}`);
  console.log(`Pool:    ${allAddresses.length} EOA(s)`);
  console.log(`Chain:   ${config.chainId}`);
  console.log(`Port:    ${config.port}`);
  console.log(`Funding: ${formatEther(config.fundingAmount)} ETH per user`);

  // Initialize all wallet nonces from chain
  await initializePool(publicClient);

  const balance = await getRelayerBalance();
  console.log(`Primary balance: ${balance} ETH`);

  // Start Gold→ETH swap scheduler (no-op if WORLD_ADDRESS/GOLD_TOKEN not set)
  startSwapScheduler();

  // Start RPC health monitoring (no-op if RPC_FALLBACK_URL not set)
  startRpcHealthCheck();

  // Restore tracked players from persisted data
  for (const addr of fundedAddresses) {
    const delegator = playerMap.get(addr) || addr;
    trackPlayer(addr as Address, delegator as Address);
  }
  console.log(`Restored ${fundedAddresses.size} tracked players (${playerMap.size} with separate delegators)`);

  // Start pool funder (auto-fund pool wallets from deployer)
  await startPoolFunder();

  // Start balance monitor (tops up funded players when low, with level gating)
  startBalanceMonitor();

  const app = express();
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  // Health check — minimal public info; full details require API key
  app.get('/', async (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    const isAuthed = config.fundApiKey && apiKey === config.fundApiKey;

    try {
      if (isAuthed) {
        const poolStatus = await getPoolStatus(publicClient);
        res.json({
          status: 'ok',
          service: 'ud-gas-station',
          poolSize: poolStatus.poolSize,
          wallets: poolStatus.wallets,
          totalInflight: poolStatus.totalInflight,
          chainId: config.chainId,
          gasCharging: gasChargingEnabled,
          fundedPlayers: getFundedCount(),
          poolFunder: getFunderStatus(),
          rpcStatus: getRpcStatus(),
        });
      } else {
        res.json({ status: 'ok', service: 'ud-gas-station' });
      }
    } catch (err) {
      res.status(500).json({ status: 'error' });
    }
  });

  // Fund a new user's wallet
  app.post('/fund', async (req, res) => {
    // API key auth — prevents unauthenticated ETH drain
    if (!config.fundApiKey) {
      res.status(503).json({ error: 'Fund endpoint not configured' });
      return;
    }
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey !== config.fundApiKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { address, delegatorAddress } = req.body as { address?: string; delegatorAddress?: string };

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      res.status(400).json({ error: 'Invalid address' });
      return;
    }

    // delegatorAddress = wallet that owns the character / holds gold.
    // For embedded wallets: same as address (or omitted).
    // For MetaMask: the MetaMask address (address is the burner).
    const delegator = (delegatorAddress && /^0x[a-fA-F0-9]{40}$/.test(delegatorAddress))
      ? delegatorAddress
      : address;

    const normalizedAddress = address.toLowerCase();

    // Already funded — check if they need emergency gas before rejecting
    if (fundedAddresses.has(normalizedAddress)) {
      trackPlayer(address as Address, delegator as Address);
      try {
        const balance = await publicClient.getBalance({ address: address as Address });
        if (balance >= config.minPlayerBalance) {
          res.json({ status: 'already_funded', balance: formatEther(balance) });
          return;
        }
        // Below minimum — allow emergency re-fund with per-address rate limit
        if (!emergencyFundOk(normalizedAddress)) {
          console.warn(`[fund] Emergency re-fund rate limited: ${address} balance=${formatEther(balance)}`);
          res.status(429).json({ error: 'Emergency re-fund rate limited — try again in 60s' });
          return;
        }
        // Lock before async work to prevent concurrent duplicate fundings
        emergencyFundTimestamps.set(normalizedAddress, Date.now());
        console.info(`[fund] Emergency re-fund: ${address} balance=${formatEther(balance)} < min=${formatEther(config.minPlayerBalance)}`);
        // Fall through to funding logic below
      } catch {
        // Balance check failed — don't re-fund blindly
        res.json({ status: 'already_funded' });
        return;
      }
    }

    // New address: check balance first — skip if already has enough
    if (!fundedAddresses.has(normalizedAddress)) {
      try {
        const balance = await publicClient.getBalance({ address: address as Address });
        if (balance >= config.fundingAmount) {
          fundedAddresses.add(normalizedAddress);
          saveFundedAddresses(fundedAddresses);
          trackPlayer(address as Address, delegator as Address);
          if (delegator !== address) {
            playerMap.set(normalizedAddress, delegator.toLowerCase());
            savePlayerMap(playerMap);
          }
          res.json({ status: 'already_funded', balance: formatEther(balance) });
          return;
        }
      } catch {
        // If balance check fails, proceed with funding
      }
    }

    // Rate limits
    if (!rateLimitOk()) {
      res.status(429).json({ error: 'Rate limited — too many fundings' });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!ipRateLimitOk(ip)) {
      res.status(429).json({ error: 'Rate limited — too many fundings from this IP' });
      return;
    }

    try {
      const txHash = await sendRelayerTx({
        to: address as Address,
        value: config.fundingAmount,
      });

      fundedAddresses.add(normalizedAddress);
      saveFundedAddresses(fundedAddresses);
      trackPlayer(address as Address, delegator as Address);
      if (delegator !== address) {
        playerMap.set(normalizedAddress, delegator.toLowerCase());
        savePlayerMap(playerMap);
      }
      recentFundings.push(Date.now());
      emergencyFundTimestamps.set(normalizedAddress, Date.now());
      const ipTimestamps = ipFundings.get(ip) || [];
      ipTimestamps.push(Date.now());
      ipFundings.set(ip, ipTimestamps);

      // Charge Gold atomically on-chain (fire-and-forget)
      callFundAndCharge(delegator as Address).catch(err =>
        console.error(`[fund] fundAndCharge failed for ${delegator}:`, err)
      );

      console.log(`[fund] Funded ${address} (delegator: ${delegator}) with ${formatEther(config.fundingAmount)} ETH — tx: ${txHash}`);
      res.json({ status: 'funded', txHash, amount: formatEther(config.fundingAmount) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[fund] Failed to fund ${address}:`, message);
      res.status(500).json({ error: 'Funding failed' });
    }
  });

  // Gold purchase — Stripe webhook → Uniswap ETH→Gold swap
  app.post('/gold-purchase', async (req, res) => {
    // Auth check
    const authHeader = req.headers.authorization;
    if (!config.goldPurchaseApiKey || authHeader !== `Bearer ${config.goldPurchaseApiKey}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { ownerAddress, ethAmount, stripeSessionId } = req.body as {
      ownerAddress?: string;
      ethAmount?: string;
      stripeSessionId?: string;
    };

    if (!ownerAddress || !/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)) {
      res.status(400).json({ error: 'Invalid ownerAddress' });
      return;
    }
    if (!ethAmount || !/^\d+$/.test(ethAmount)) {
      res.status(400).json({ error: 'Invalid ethAmount' });
      return;
    }
    if (!stripeSessionId) {
      res.status(400).json({ error: 'Missing stripeSessionId' });
      return;
    }

    // Dedup — already fulfilled this session
    if (fulfilledSessions.has(stripeSessionId)) {
      res.json({ status: 'already_fulfilled' });
      return;
    }

    const swapValue = BigInt(ethAmount);

    // Balance check
    try {
      const balance = await publicClient.getBalance({ address: relayerAddress });
      if (balance < swapValue + parseEther('0.001')) {
        console.error(`[gold-purchase] Insufficient relayer balance: ${formatEther(balance)} ETH, need ${formatEther(swapValue)}`);
        res.status(500).json({ error: 'Insufficient relayer balance' });
        return;
      }
    } catch (err) {
      console.error('[gold-purchase] Balance check failed:', err);
      res.status(500).json({ error: 'Balance check failed' });
      return;
    }

    // Swap ETH → Gold via Uniswap V3 (native ETH auto-wraps to WETH)
    try {
      const minOutput = await getMinimumOutput(config.weth, config.goldToken, swapValue);
      console.log(`[gold-purchase] Quote: ${formatEther(swapValue)} ETH → min ${minOutput} Gold (${config.swapSlippageBps/100}% slippage)`);

      const calldata = encodeFunctionData({
        abi: swapRouterAbi,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn: config.weth,
          tokenOut: config.goldToken,
          fee: config.poolFee,
          recipient: ownerAddress as Address,
          amountIn: swapValue,
          amountOutMinimum: minOutput,
          sqrtPriceLimitX96: 0n,
        }],
      });

      const txHash = await sendRelayerTx({
        to: config.swapRouter,
        calldata,
        value: swapValue,
      });

      fulfilledSessions.add(stripeSessionId);
      saveFulfilledSessions(fulfilledSessions);
      console.log(`[gold-purchase] Swapped ${formatEther(swapValue)} ETH → Gold for ${ownerAddress} | tx: ${txHash} | session: ${stripeSessionId}`);
      res.json({ status: 'fulfilled', txHash });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[gold-purchase] Swap failed for ${ownerAddress}:`, message);
      res.status(500).json({ error: 'Swap failed' });
    }
  });

  const server = app.listen(config.port, () => {
    console.log(`[server] Listening on port ${config.port}`);
    console.log(`[server] Health: http://localhost:${config.port}/`);
    console.log(`[server] Fund:   POST http://localhost:${config.port}/fund`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[server] Shutting down...');
    stopSwapScheduler();
    stopRpcHealthCheck();
    stopBalanceMonitor();
    stopPoolFunder();
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
