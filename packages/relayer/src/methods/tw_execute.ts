import { type Hex, type Address, numberToHex } from 'viem';
import { encodeExecuteWithSig, sendRelayerTx, txQueue } from '../tx.js';
import { recordRelay } from '../gasCharge.js';
import { config } from '../config.js';

// Function selectors for calls that need fixed gas limits.
// Move txs have highly variable gas (1.3M-2.5M) due to spawnOnTileEnter
// using block.prevrandao — estimateGas at block N often undershoots for block N+1.
const FIXED_GAS_SELECTORS: Record<string, bigint> = {
  '0xd1138fa1': 4_000_000n,  // UD__move(bytes32,uint16,uint16)
};

export async function handleExecute(params: unknown[]): Promise<{ queueId: string }> {
  const [eoaAddress, rawWrappedCalls, signature, rawAuthorization] = params as [
    Address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    Hex,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any?,
  ];

  if (!eoaAddress || !rawWrappedCalls || !signature) {
    throw new Error('Missing required params: [eoaAddress, wrappedCalls, signature]');
  }

  // Validate call targets against allowlist (if configured)
  if (config.allowedWorldAddresses.length > 0) {
    const targets = (rawWrappedCalls.calls as Array<{ target: string }>).map(
      c => c.target.toLowerCase(),
    );
    for (const target of targets) {
      if (!config.allowedWorldAddresses.includes(target)) {
        throw new Error(`Target ${target} not in ALLOWED_WORLD_ADDRESSES`);
      }
    }
  }

  // Normalize wrappedCalls — convert value strings to bigint
  const wrappedCalls = {
    calls: rawWrappedCalls.calls.map(
      (c: { target: Address; value: string | number | bigint; data: Hex }) => ({
        target: c.target as Address,
        value: BigInt(c.value),
        data: c.data as Hex,
      }),
    ),
    uid: rawWrappedCalls.uid as Hex,
  };

  // Normalize authorization if present
  let authorizationList: Array<{
    address: Address;
    chainId: number;
    nonce: number;
    r: Hex;
    s: Hex;
    yParity: number;
  }> | undefined;

  if (rawAuthorization) {
    // Thirdweb's enclave wallet returns r/s as BigInt, which gets JSON-serialized
    // to decimal strings (e.g. "68066441064328..."). viem expects 0x-prefixed hex.
    const toHexSig = (val: string): Hex => {
      if (val.startsWith('0x')) return val as Hex;
      return numberToHex(BigInt(val));
    };

    authorizationList = [
      {
        address: rawAuthorization.address as Address,
        chainId: Number(rawAuthorization.chainId),
        nonce: Number(rawAuthorization.nonce),
        r: toHexSig(rawAuthorization.r),
        s: toHexSig(rawAuthorization.s),
        yParity: Number(rawAuthorization.yParity),
      },
    ];
  }

  // Generate queue ID
  const queueId = crypto.randomUUID().replace(/-/g, '');

  // Initialize queue entry
  txQueue.set(queueId, { txHash: null, error: null });

  // Encode calldata
  const calldata = encodeExecuteWithSig(wrappedCalls, signature);

  // Check if any inner call matches a fixed-gas selector (e.g. UD__move).
  // This skips estimateGas on the relayer side, saving ~300-500ms and
  // preventing OOG reverts from variable gas paths (spawnOnTileEnter).
  let gasOverride: bigint | undefined;
  for (const call of wrappedCalls.calls) {
    const selector = call.data.slice(0, 10).toLowerCase();
    if (FIXED_GAS_SELECTORS[selector]) {
      gasOverride = FIXED_GAS_SELECTORS[selector];
      break;
    }
  }

  // Send transaction (synchronous — we wait for broadcast)
  try {
    const txHash = await sendRelayerTx({
      to: eoaAddress,
      calldata,
      authorizationList,
      gasOverride,
    });

    txQueue.set(queueId, { txHash, error: null });
    recordRelay(eoaAddress);
    console.log(`[tw_execute] ${queueId} → ${txHash}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    txQueue.set(queueId, { txHash: null, error: errorMsg });
    console.error(`[tw_execute] ${queueId} failed: ${errorMsg}`);
    throw err;
  }

  return { queueId };
}
