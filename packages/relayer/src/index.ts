import express from 'express';
import cors from 'cors';
import { type Address, formatEther, parseEther } from 'viem';
import { config } from './config.js';
import {
  relayerAddress,
  publicClient,
  getRelayerBalance,
  sendRelayerTx,
} from './tx.js';
import { initializePool, getPoolStatus, allAddresses } from './walletPool.js';
import { startSchedulers, stopSchedulers, getPendingChargeCount, getTotalPendingEth } from './gasCharge.js';
import { recordFunding } from './gasCharge.js';
import { gasChargingEnabled } from './config.js';
import { startRpcHealthCheck, stopRpcHealthCheck, getRpcStatus } from './rpcManager.js';
import { startBalanceMonitor, stopBalanceMonitor, trackFundedAddress, getFundedCount } from './balanceMonitor.js';

// Anti-griefing state
const fundedAddresses = new Set<string>();
const recentFundings: number[] = []; // timestamps
const ipFundings = new Map<string, number[]>(); // ip -> timestamps

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

  // Start gas charge schedulers (no-op if WORLD_ADDRESS/GOLD_TOKEN not set)
  startSchedulers();

  // Start RPC health monitoring (no-op if RPC_FALLBACK_URL not set)
  startRpcHealthCheck();

  // Start balance monitor (tops up funded players when low)
  startBalanceMonitor();

  const app = express();
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  // Health check
  app.get('/', async (_req, res) => {
    try {
      const poolStatus = await getPoolStatus(publicClient);
      res.json({
        status: 'ok',
        service: 'ud-gas-station',
        relayer: relayerAddress,
        poolSize: poolStatus.poolSize,
        wallets: poolStatus.wallets,
        totalInflight: poolStatus.totalInflight,
        chainId: config.chainId,
        gasCharging: gasChargingEnabled,
        pendingCharges: getPendingChargeCount(),
        pendingChargeEth: getTotalPendingEth(),
        fundedPlayers: getFundedCount(),
        rpcStatus: getRpcStatus(),
      });
    } catch (err) {
      res.status(500).json({ status: 'error', error: String(err) });
    }
  });

  // Fund a new user's wallet
  app.post('/fund', async (req, res) => {
    const { address } = req.body as { address?: string };

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      res.status(400).json({ error: 'Invalid address' });
      return;
    }

    const normalizedAddress = address.toLowerCase();

    // Already funded — no double-fund
    if (fundedAddresses.has(normalizedAddress)) {
      res.json({ status: 'already_funded' });
      return;
    }

    // Check balance first — skip if already has enough
    try {
      const balance = await publicClient.getBalance({ address: address as Address });
      if (balance >= config.fundingAmount) {
        fundedAddresses.add(normalizedAddress);
        trackFundedAddress(address as Address);
        res.json({ status: 'already_funded', balance: formatEther(balance) });
        return;
      }
    } catch {
      // If balance check fails, proceed with funding
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
      trackFundedAddress(address as Address);
      recentFundings.push(Date.now());
      const ipTimestamps = ipFundings.get(ip) || [];
      ipTimestamps.push(Date.now());
      ipFundings.set(ip, ipTimestamps);

      // Record for gas charging (Gold deduction)
      recordFunding(address as Address, config.fundingAmount);

      console.log(`[fund] Funded ${address} with ${formatEther(config.fundingAmount)} ETH — tx: ${txHash}`);
      res.json({ status: 'funded', txHash, amount: formatEther(config.fundingAmount) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[fund] Failed to fund ${address}:`, message);
      res.status(500).json({ error: 'Funding failed' });
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
    stopSchedulers();
    stopRpcHealthCheck();
    stopBalanceMonitor();
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
