import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { relayerAddress, publicClient, nonceManager, getRelayerBalance, txQueue, } from './tx.js';
import { handleExecute } from './methods/tw_execute.js';
import { handleGetTransactionHash } from './methods/tw_getTransactionHash.js';
import { handleGetDelegationContract } from './methods/tw_getDelegationContract.js';
async function main() {
    console.log('=== Ultimate Dominion Relayer ===');
    console.log(`Relayer: ${relayerAddress}`);
    console.log(`Chain:   ${config.chainId}`);
    console.log(`Port:    ${config.port}`);
    // Initialize nonce from chain
    await nonceManager.initialize(publicClient, relayerAddress);
    const balance = await getRelayerBalance();
    console.log(`Balance: ${balance} ETH`);
    const app = express();
    app.use(cors({ origin: config.corsOrigins }));
    app.use(express.json());
    // Health check
    app.get('/', async (_req, res) => {
        try {
            const bal = await getRelayerBalance();
            res.json({
                status: 'ok',
                service: 'ud-relayer',
                relayer: relayerAddress,
                balance: `${bal} ETH`,
                nonce: nonceManager.pending,
                queueSize: txQueue.size,
                chainId: config.chainId,
            });
        }
        catch (err) {
            res.status(500).json({ status: 'error', error: String(err) });
        }
    });
    // JSON-RPC endpoint — handles both /v2 and /:prefix/v2
    const rpcHandler = async (req, res) => {
        const { method, params, id } = req.body;
        if (!method) {
            res.status(400).json({
                jsonrpc: '2.0',
                id: id ?? null,
                error: { code: -32600, message: 'Missing method' },
            });
            return;
        }
        try {
            let result;
            switch (method) {
                case 'tw_execute':
                    result = await handleExecute(params || []);
                    break;
                case 'tw_getTransactionHash':
                    result = await handleGetTransactionHash(params || []);
                    break;
                case 'tw_getDelegationContract':
                    result = await handleGetDelegationContract();
                    break;
                default:
                    res.json({
                        jsonrpc: '2.0',
                        id: id ?? null,
                        error: { code: -32601, message: `Method not found: ${method}` },
                    });
                    return;
            }
            res.json({ jsonrpc: '2.0', id: id ?? null, result });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[rpc] ${method} error:`, message);
            res.json({
                jsonrpc: '2.0',
                id: id ?? null,
                error: { code: -32000, message },
            });
        }
    };
    app.post('/v2', rpcHandler);
    app.post('/:prefix/v2', rpcHandler);
    const server = app.listen(config.port, () => {
        console.log(`[server] Listening on port ${config.port}`);
        console.log(`[server] RPC: http://localhost:${config.port}/v2`);
    });
    // Graceful shutdown
    const shutdown = () => {
        console.log('\n[server] Shutting down...');
        server.close();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map