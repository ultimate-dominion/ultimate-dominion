import { type Address, formatEther } from 'viem';
import { config } from './config.js';
import { publicClient, sendRelayerTx } from './tx.js';

/** Set of addresses we've funded — monitored for top-ups */
const fundedAddresses = new Set<Address>();

let monitorTimer: ReturnType<typeof setInterval> | null = null;
let topUpCount = 0;
let topUpResetTimer: ReturnType<typeof setInterval> | null = null;

const MAX_TOP_UPS_PER_HOUR = 50;

export function trackFundedAddress(address: Address): void {
  fundedAddresses.add(address);
}

export function getFundedCount(): number {
  return fundedAddresses.size;
}

/**
 * Check all funded addresses and top up any that are below minPlayerBalance.
 */
async function checkBalances(): Promise<void> {
  if (fundedAddresses.size === 0) return;

  for (const address of fundedAddresses) {
    if (topUpCount >= MAX_TOP_UPS_PER_HOUR) {
      console.warn('[balanceMonitor] Hit hourly top-up limit, skipping remaining');
      break;
    }

    try {
      const balance = await publicClient.getBalance({ address });
      if (balance < config.minPlayerBalance) {
        console.log(`[balanceMonitor] Topping up ${address} (balance: ${formatEther(balance)} ETH)`);
        const txHash = await sendRelayerTx({
          to: address,
          value: config.fundingAmount,
        });
        topUpCount++;
        console.log(`[balanceMonitor] Top-up tx: ${txHash}`);
      }
    } catch (err) {
      console.error(`[balanceMonitor] Failed to check/top-up ${address}:`, err);
    }
  }
}

export function startBalanceMonitor(): void {
  console.log(`[balanceMonitor] Starting — check every 60s, min balance ${formatEther(config.minPlayerBalance)} ETH`);

  monitorTimer = setInterval(() => {
    checkBalances().catch(err => console.error('[balanceMonitor] Error:', err));
  }, 60_000);

  // Reset top-up counter every hour
  topUpResetTimer = setInterval(() => {
    topUpCount = 0;
  }, 3_600_000);
}

export function stopBalanceMonitor(): void {
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
  if (topUpResetTimer) { clearInterval(topUpResetTimer); topUpResetTimer = null; }
}
