import { type Hex, type Address, numberToHex } from 'viem';
import { encodeExecuteWithSig, sendRelayerTx, txQueue } from '../tx.js';
import { recordRelay } from '../gasCharge.js';

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

  // Send transaction (synchronous — we wait for broadcast)
  try {
    const txHash = await sendRelayerTx({
      to: eoaAddress,
      calldata,
      authorizationList,
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
