import { createWalletClient, http, fallback, formatEther, defineChain, } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from './config.js';
import { NonceManager } from './nonce.js';
export const chain = defineChain({
    id: config.chainId,
    name: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
});
// Auth headers for self-hosted RPC (optional — set RPC_AUTH_TOKEN env var)
const rpcFetchOptions = config.rpcAuthToken
    ? { headers: { Authorization: `Bearer ${config.rpcAuthToken}` } }
    : undefined;
export const rpcTransport = () => {
    const transports = [http(config.rpcUrl, { fetchOptions: rpcFetchOptions })];
    if (config.rpcFallbackUrl) {
        transports.push(http(config.rpcFallbackUrl)); // No auth for Alchemy
    }
    return transports.length > 1 ? fallback(transports) : transports[0];
};
const pool = [];
// Build pool from config keys
for (const key of config.relayerPrivateKeys) {
    const account = privateKeyToAccount(key);
    const walletClient = createWalletClient({
        account,
        chain,
        transport: rpcTransport(),
    });
    pool.push({
        account,
        walletClient,
        nonceManager: new NonceManager(),
        address: account.address,
        inflight: 0,
    });
}
/** Primary EOA — used for gas charging, health reporting */
export const primaryAddress = pool[0].address;
/** All EOA addresses in the pool */
export const allAddresses = pool.map(w => w.address);
/** Initialize all nonce managers from chain */
export async function initializePool(publicClient) {
    console.log(`[pool] Initializing ${pool.length} wallet(s)`);
    await Promise.all(pool.map(async (w) => {
        await w.nonceManager.initialize(publicClient, w.address);
        console.log(`[pool] ${w.address.slice(0, 10)}... nonce=${w.nonceManager.pending}`);
    }));
}
/** Acquire the least-busy wallet + nonce */
export async function acquireWallet() {
    // Find wallet with lowest inflight count
    let best = pool[0];
    for (let i = 1; i < pool.length; i++) {
        if (pool[i].inflight < best.inflight) {
            best = pool[i];
        }
    }
    const nonce = await best.nonceManager.acquire();
    best.inflight++;
    return { wallet: best, nonce };
}
/** Acquire the primary wallet specifically (for gas charging — must match on-chain relayer address) */
export async function acquirePrimaryWallet() {
    const primary = pool[0];
    const nonce = await primary.nonceManager.acquire();
    primary.inflight++;
    return { wallet: primary, nonce };
}
/** Release wallet back to pool after tx completes */
export function releaseWallet(wallet, success) {
    wallet.inflight--;
    if (success) {
        wallet.nonceManager.confirm();
    }
    else {
        wallet.nonceManager.reject();
    }
}
/** Resync a wallet's nonce from chain (after failure) */
export async function resyncWallet(wallet, publicClient) {
    await wallet.nonceManager.resync(publicClient, wallet.address);
}
/** Pool status for health endpoint */
export async function getPoolStatus(publicClient) {
    const wallets = await Promise.all(pool.map(async (w) => {
        const balance = await publicClient.getBalance({ address: w.address });
        return {
            address: w.address,
            nonce: w.nonceManager.pending,
            inflight: w.inflight,
            balance: `${formatEther(balance)} ETH`,
        };
    }));
    return {
        poolSize: pool.length,
        totalInflight: pool.reduce((sum, w) => sum + w.inflight, 0),
        wallets,
    };
}
//# sourceMappingURL=walletPool.js.map