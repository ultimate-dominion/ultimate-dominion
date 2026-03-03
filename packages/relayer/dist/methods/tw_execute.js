import { encodeExecuteWithSig, sendRelayerTx, txQueue } from '../tx.js';
export async function handleExecute(params) {
    const [eoaAddress, rawWrappedCalls, signature, rawAuthorization] = params;
    if (!eoaAddress || !rawWrappedCalls || !signature) {
        throw new Error('Missing required params: [eoaAddress, wrappedCalls, signature]');
    }
    // Normalize wrappedCalls — convert value strings to bigint
    const wrappedCalls = {
        calls: rawWrappedCalls.calls.map((c) => ({
            target: c.target,
            value: BigInt(c.value),
            data: c.data,
        })),
        uid: rawWrappedCalls.uid,
    };
    // Normalize authorization if present
    let authorizationList;
    if (rawAuthorization) {
        authorizationList = [
            {
                address: rawAuthorization.address,
                chainId: Number(rawAuthorization.chainId),
                nonce: Number(rawAuthorization.nonce),
                r: rawAuthorization.r,
                s: rawAuthorization.s,
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
        console.log(`[tw_execute] ${queueId} → ${txHash}`);
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        txQueue.set(queueId, { txHash: null, error: errorMsg });
        console.error(`[tw_execute] ${queueId} failed: ${errorMsg}`);
        throw err;
    }
    return { queueId };
}
//# sourceMappingURL=tw_execute.js.map