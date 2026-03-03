import { createPublicClient, createWalletClient, http, encodeFunctionData, formatEther, defineChain, } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from './config.js';
import { NonceManager } from './nonce.js';
// Chain definition from config
const chain = defineChain({
    id: config.chainId,
    name: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
});
// Relayer account
const account = privateKeyToAccount(config.relayerPrivateKey);
export const relayerAddress = account.address;
// Clients
export const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
});
const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
});
// Nonce manager
export const nonceManager = new NonceManager();
// Transaction queue: queueId -> txHash
export const txQueue = new Map();
// MinimalAccount ABI — only executeWithSig
const executeWithSigAbi = [
    {
        type: 'function',
        name: 'executeWithSig',
        inputs: [
            {
                name: 'wrappedCalls',
                type: 'tuple',
                components: [
                    {
                        name: 'calls',
                        type: 'tuple[]',
                        components: [
                            { name: 'target', type: 'address' },
                            { name: 'value', type: 'uint256' },
                            { name: 'data', type: 'bytes' },
                        ],
                    },
                    { name: 'uid', type: 'bytes32' },
                ],
            },
            { name: 'signature', type: 'bytes' },
        ],
        outputs: [],
        stateMutability: 'payable',
    },
];
export function encodeExecuteWithSig(wrappedCalls, signature) {
    return encodeFunctionData({
        abi: executeWithSigAbi,
        functionName: 'executeWithSig',
        args: [wrappedCalls, signature],
    });
}
export async function sendRelayerTx(params) {
    const { to, calldata, authorizationList } = params;
    const nonce = await nonceManager.acquire();
    try {
        // Estimate gas
        const gasEstimate = await publicClient.estimateGas({
            to,
            data: calldata,
            account: account.address,
            ...(authorizationList ? { authorizationList } : {}),
        });
        // 1.5x buffer
        const gas = (gasEstimate * 150n) / 100n;
        console.log(`[tx] Sending to ${to} | nonce=${nonce} | gas=${gas} | auth=${!!authorizationList}`);
        // Send transaction
        const hash = await walletClient.sendTransaction({
            to,
            data: calldata,
            gas,
            nonce,
            ...(authorizationList ? { authorizationList } : {}),
        });
        console.log(`[tx] Broadcast: ${hash}`);
        nonceManager.confirm();
        return hash;
    }
    catch (err) {
        console.error(`[tx] Failed:`, err);
        nonceManager.reject();
        await nonceManager.resync(publicClient, relayerAddress);
        throw err;
    }
}
export async function getRelayerBalance() {
    const balance = await publicClient.getBalance({ address: relayerAddress });
    return formatEther(balance);
}
//# sourceMappingURL=tx.js.map