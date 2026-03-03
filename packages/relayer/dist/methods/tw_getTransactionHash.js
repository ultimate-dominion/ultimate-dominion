import { txQueue } from '../tx.js';
export async function handleGetTransactionHash(params) {
    const [queueId] = params;
    if (!queueId) {
        throw new Error('Missing required param: [queueId]');
    }
    const entry = txQueue.get(queueId);
    if (!entry) {
        throw new Error(`Unknown queueId: ${queueId}`);
    }
    if (entry.error) {
        throw new Error(`Transaction failed: ${entry.error}`);
    }
    return { transactionHash: entry.txHash };
}
//# sourceMappingURL=tw_getTransactionHash.js.map