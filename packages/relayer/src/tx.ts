import {
  createPublicClient,
  encodeFunctionData,
  formatEther,
  type Hex,
  type Address,
  type PublicClient,
} from 'viem';
import { acquireWallet, releaseWallet, resyncWallet, primaryAddress, chain, rpcTransport } from './walletPool.js';

// Backward compat alias — gasCharge.ts and others import this
export const relayerAddress: Address = primaryAddress;

// Public client (shared, no wallet-specific state)
export const publicClient: PublicClient = createPublicClient({
  chain,
  transport: rpcTransport(),
});

// Transaction queue: queueId -> txHash
export const txQueue = new Map<
  string,
  { txHash: Hex | null; error: string | null }
>();

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
] as const;

interface WrappedCalls {
  calls: Array<{ target: Address; value: bigint; data: Hex }>;
  uid: Hex;
}

interface SignedAuthorization {
  address: Address;
  chainId: number;
  nonce: number;
  r: Hex;
  s: Hex;
  yParity: number;
}

export function encodeExecuteWithSig(
  wrappedCalls: WrappedCalls,
  signature: Hex,
): Hex {
  return encodeFunctionData({
    abi: executeWithSigAbi,
    functionName: 'executeWithSig',
    args: [wrappedCalls, signature],
  });
}

export async function sendRelayerTx(params: {
  to: Address;
  calldata: Hex;
  authorizationList?: SignedAuthorization[];
}): Promise<Hex> {
  const { to, calldata, authorizationList } = params;

  const { wallet, nonce } = await acquireWallet();
  try {
    // Estimate gas
    const gasEstimate = await publicClient.estimateGas({
      to,
      data: calldata,
      account: wallet.address,
      ...(authorizationList ? { authorizationList } : {}),
    });

    // 1.5x buffer
    const gas = (gasEstimate * 150n) / 100n;

    console.log(
      `[tx] Sending via ${wallet.address.slice(0, 10)} | nonce=${nonce} | gas=${gas} | auth=${!!authorizationList}`,
    );

    // Send transaction
    const hash = await wallet.walletClient.sendTransaction({
      account: wallet.account,
      chain,
      to,
      data: calldata,
      gas,
      nonce,
      ...(authorizationList ? { authorizationList } : {}),
    });

    console.log(`[tx] Broadcast: ${hash}`);
    releaseWallet(wallet, true);
    return hash;
  } catch (err) {
    console.error(`[tx] Failed on ${wallet.address.slice(0, 10)}:`, err);
    releaseWallet(wallet, false);
    await resyncWallet(wallet, publicClient);
    throw err;
  }
}

export async function getRelayerBalance(): Promise<string> {
  const balance = await publicClient.getBalance({ address: relayerAddress });
  return formatEther(balance);
}
