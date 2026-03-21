import {
  createPublicClient,
  formatEther,
  type Hex,
  type Address,
  type PublicClient,
} from 'viem';
import { acquireWallet, acquirePrimaryWallet, releaseWallet, resyncWallet, primaryAddress, chain, rpcTransport } from './walletPool.js';

// Backward compat alias — gasCharge.ts and others import this
export const relayerAddress: Address = primaryAddress;

// Public client (shared, no wallet-specific state)
export const publicClient: PublicClient = createPublicClient({
  chain,
  transport: rpcTransport(),
});

export async function sendRelayerTx(params: {
  to: Address;
  value?: bigint;
  calldata?: Hex;
  gasOverride?: bigint;
}): Promise<Hex> {
  const { to, value, calldata, gasOverride } = params;
  const t0 = Date.now();

  const { wallet, nonce } = await acquireWallet();
  const tAcquire = Date.now();

  try {
    let gas: bigint;

    if (gasOverride) {
      gas = gasOverride;
    } else if (calldata) {
      const gasEstimate = await publicClient.estimateGas({
        to,
        data: calldata,
        account: wallet.address,
      });
      gas = (gasEstimate * 150n) / 100n;
    } else {
      gas = 21_000n; // simple ETH transfer
    }
    const tEstimate = Date.now();

    // Pre-flight balance check — catch "total cost exceeds balance" before it hits the RPC
    const txValue = value ?? 0n;
    const balance = await publicClient.getBalance({ address: wallet.address });
    // Rough cost estimate: gas * 0.1 gwei (Base L2 typical) + value + L1 data buffer
    const estimatedCost = gas * 100_000_000n + txValue;
    if (balance < estimatedCost) {
      console.error(
        `[tx] INSUFFICIENT POOL BALANCE on ${wallet.address.slice(0, 10)} | balance=${formatEther(balance)} ETH | estimated cost=${formatEther(estimatedCost)} ETH (gas=${gas}, value=${formatEther(txValue)})`,
      );
    }

    console.log(
      `[tx] Sending via ${wallet.address.slice(0, 10)} | nonce=${nonce} | gas=${gas}${gasOverride ? ' (fixed)' : ''} | bal=${formatEther(balance)} | acquire=${tAcquire - t0}ms est=${tEstimate - tAcquire}ms`,
    );

    const hash = await wallet.walletClient.sendTransaction({
      account: wallet.account,
      chain,
      to,
      data: calldata,
      value: value ?? 0n,
      gas,
      nonce,
    });

    const tBroadcast = Date.now();
    console.log(`[tx] Broadcast: ${hash} | send=${tBroadcast - tEstimate}ms | total=${tBroadcast - t0}ms`);
    releaseWallet(wallet, true);
    return hash;
  } catch (err) {
    console.error(`[tx] Failed on ${wallet.address.slice(0, 10)} (${Date.now() - t0}ms):`, err);
    releaseWallet(wallet, false);
    await resyncWallet(wallet, publicClient);
    throw err;
  }
}

/**
 * Send a transaction from the primary wallet only.
 * Used for gas charging — the on-chain config only authorizes the primary address.
 */
export async function sendPrimaryTx(params: {
  to: Address;
  value?: bigint;
  calldata?: Hex;
}): Promise<Hex> {
  const { to, value, calldata } = params;
  const t0 = Date.now();

  const { wallet, nonce } = await acquirePrimaryWallet();

  try {
    let gas: bigint;

    if (calldata) {
      const gasEstimate = await publicClient.estimateGas({
        to,
        data: calldata,
        account: wallet.address,
      });
      gas = (gasEstimate * 150n) / 100n;
    } else {
      gas = 21_000n;
    }

    console.log(
      `[tx] Primary send via ${wallet.address.slice(0, 10)} | nonce=${nonce} | gas=${gas}`,
    );

    const hash = await wallet.walletClient.sendTransaction({
      account: wallet.account,
      chain,
      to,
      data: calldata,
      value: value ?? 0n,
      gas,
      nonce,
    });

    releaseWallet(wallet, true);
    return hash;
  } catch (err) {
    console.error(`[tx] Primary send failed on ${wallet.address.slice(0, 10)} (${Date.now() - t0}ms):`, err);
    releaseWallet(wallet, false);
    await resyncWallet(wallet, publicClient);
    throw err;
  }
}

export async function getRelayerBalance(): Promise<string> {
  const balance = await publicClient.getBalance({ address: relayerAddress });
  return formatEther(balance);
}
