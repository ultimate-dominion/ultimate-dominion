import {
  createWalletClient,
  http,
  fallback,
  formatEther,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from './config.js';
import { publicClient } from './tx.js';
import { allAddresses, chain, rpcTransport } from './walletPool.js';
import { NonceManager } from './nonce.js';

// ==================== State ====================

let funderTimer: ReturnType<typeof setInterval> | null = null;
let lastCheckTime = 0;

const funderAccount = config.funderPrivateKey
  ? privateKeyToAccount(config.funderPrivateKey)
  : null;

const funderWalletClient = funderAccount
  ? createWalletClient({
      account: funderAccount,
      chain,
      transport: rpcTransport(),
    })
  : null;

const funderNonce = new NonceManager();

// ==================== Core ====================

export async function checkAndFundPool(): Promise<void> {
  if (!funderAccount || !funderWalletClient) return;

  lastCheckTime = Date.now();

  // Check funder's own balance first
  const funderBalance = await publicClient.getBalance({ address: funderAccount.address });
  if (funderBalance < config.poolTargetBalance) {
    console.warn(`[poolFunder] Funder wallet ${funderAccount.address.slice(0, 10)}... balance low: ${formatEther(funderBalance)} ETH`);
  }

  for (const poolAddr of allAddresses) {
    try {
      const balance = await publicClient.getBalance({ address: poolAddr });

      if (balance >= config.poolMinBalance) continue;

      const topUp = config.poolTargetBalance - balance;

      // Can't fund more than we have (reserve 0.001 ETH for gas)
      const currentFunderBalance = await publicClient.getBalance({ address: funderAccount.address });
      const reserve = 1_000_000_000_000_000n; // 0.001 ETH
      if (currentFunderBalance < topUp + reserve) {
        console.warn(`[poolFunder] Insufficient funder balance to top up ${poolAddr.slice(0, 10)}... (need ${formatEther(topUp)}, have ${formatEther(currentFunderBalance)})`);
        continue;
      }

      const nonce = await funderNonce.acquire();
      try {
        const hash = await funderWalletClient.sendTransaction({
          account: funderAccount,
          chain,
          to: poolAddr,
          value: topUp,
          gas: 21_000n,
          nonce,
        });
        funderNonce.confirm();
        console.log(`[poolFunder] Funded ${poolAddr.slice(0, 10)}... with ${formatEther(topUp)} ETH (was ${formatEther(balance)}) | tx: ${hash}`);
      } catch (err) {
        funderNonce.reject();
        console.error(`[poolFunder] Failed to fund ${poolAddr.slice(0, 10)}...:`, err);
        // Resync nonce on failure
        await funderNonce.resync(publicClient, funderAccount.address);
      }
    } catch (err) {
      console.error(`[poolFunder] Error checking ${poolAddr.slice(0, 10)}...:`, err);
    }
  }
}

// ==================== Lifecycle ====================

export async function startPoolFunder(): Promise<void> {
  if (!config.funderPrivateKey) {
    console.log('[poolFunder] Disabled (FUNDER_PRIVATE_KEY not set)');
    return;
  }

  if (!funderAccount) return;

  // Initialize nonce
  await funderNonce.initialize(publicClient, funderAccount.address);
  console.log(`[poolFunder] Enabled — funder: ${funderAccount.address.slice(0, 10)}...`);
  console.log(`[poolFunder] Min balance: ${formatEther(config.poolMinBalance)} ETH, target: ${formatEther(config.poolTargetBalance)} ETH`);
  console.log(`[poolFunder] Check interval: ${config.poolFundCheckIntervalMs / 1000}s`);

  // Run immediately, then on interval
  await checkAndFundPool();
  funderTimer = setInterval(() => {
    checkAndFundPool().catch(err => console.error('[poolFunder] Check error:', err));
  }, config.poolFundCheckIntervalMs);
}

export function stopPoolFunder(): void {
  if (funderTimer) {
    clearInterval(funderTimer);
    funderTimer = null;
  }
}

// ==================== Health ====================

export function getFunderStatus(): {
  enabled: boolean;
  address: string | null;
  lastCheckTime: number;
} {
  return {
    enabled: !!funderAccount,
    address: funderAccount?.address ?? null,
    lastCheckTime,
  };
}
