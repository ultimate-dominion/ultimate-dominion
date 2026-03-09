import { createPublicClient, formatEther, } from 'viem';
import { acquireWallet, releaseWallet, resyncWallet, primaryAddress, chain, rpcTransport } from './walletPool.js';
// Backward compat alias — gasCharge.ts and others import this
export const relayerAddress = primaryAddress;
// Public client (shared, no wallet-specific state)
export const publicClient = createPublicClient({
    chain,
    transport: rpcTransport(),
});
export async function sendRelayerTx(params) {
    const { to, value, calldata, gasOverride } = params;
    const t0 = Date.now();
    const { wallet, nonce } = await acquireWallet();
    const tAcquire = Date.now();
    try {
        let gas;
        if (gasOverride) {
            gas = gasOverride;
        }
        else if (calldata) {
            const gasEstimate = await publicClient.estimateGas({
                to,
                data: calldata,
                account: wallet.address,
            });
            gas = (gasEstimate * 150n) / 100n;
        }
        else {
            gas = 21000n; // simple ETH transfer
        }
        const tEstimate = Date.now();
        console.log(`[tx] Sending via ${wallet.address.slice(0, 10)} | nonce=${nonce} | gas=${gas}${gasOverride ? ' (fixed)' : ''} | acquire=${tAcquire - t0}ms est=${tEstimate - tAcquire}ms`);
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
    }
    catch (err) {
        console.error(`[tx] Failed on ${wallet.address.slice(0, 10)} (${Date.now() - t0}ms):`, err);
        releaseWallet(wallet, false);
        await resyncWallet(wallet, publicClient);
        throw err;
    }
}
export async function getRelayerBalance() {
    const balance = await publicClient.getBalance({ address: relayerAddress });
    return formatEther(balance);
}
//# sourceMappingURL=tx.js.map