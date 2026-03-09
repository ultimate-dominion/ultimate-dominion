import express from 'express';
import cors from 'cors';
import { encodeFunctionData, formatEther, parseAbi, parseEther } from 'viem';
import { config } from './config.js';
import { relayerAddress, publicClient, getRelayerBalance, sendRelayerTx, } from './tx.js';
import { initializePool, getPoolStatus, allAddresses } from './walletPool.js';
import { startSchedulers, stopSchedulers, getPendingChargeCount, getTotalPendingEth } from './gasCharge.js';
import { recordFunding } from './gasCharge.js';
import { gasChargingEnabled } from './config.js';
import { startRpcHealthCheck, stopRpcHealthCheck, getRpcStatus } from './rpcManager.js';
import { startBalanceMonitor, stopBalanceMonitor, trackFundedAddress, getFundedCount } from './balanceMonitor.js';
import { loadFundedAddresses, saveFundedAddresses, loadFulfilledSessions, saveFulfilledSessions } from './persistence.js';
// Gold purchase dedup (stripeSessionId → fulfilled) — persisted to disk
const fulfilledSessions = loadFulfilledSessions();
const swapRouterAbi = parseAbi([
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
]);
const quoterV2Abi = parseAbi([
    'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);
async function getMinimumOutput(tokenIn, tokenOut, amountIn) {
    try {
        const { result } = await publicClient.simulateContract({
            address: config.quoterV2,
            abi: quoterV2Abi,
            functionName: 'quoteExactInputSingle',
            args: [{ tokenIn, tokenOut, amountIn, fee: config.poolFee, sqrtPriceLimitX96: 0n }],
        });
        const expectedOut = result[0];
        // Apply slippage tolerance
        return expectedOut * BigInt(10000 - config.swapSlippageBps) / 10000n;
    }
    catch (err) {
        console.warn('[swap] Quote failed, using 0 minimum:', err);
        return 1n; // Fallback — better to succeed than revert, but log the warning
    }
}
// Anti-griefing state — persisted to disk
const fundedAddresses = loadFundedAddresses();
const recentFundings = []; // timestamps
const ipFundings = new Map(); // ip -> timestamps
function rateLimitOk() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    // Clean old entries
    while (recentFundings.length > 0 && recentFundings[0] < oneMinuteAgo) {
        recentFundings.shift();
    }
    return recentFundings.length < config.maxFundingsPerMinute;
}
function ipRateLimitOk(ip) {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;
    let timestamps = ipFundings.get(ip) || [];
    timestamps = timestamps.filter(t => t > fiveMinutesAgo);
    ipFundings.set(ip, timestamps);
    return timestamps.length < 3; // max 3 fundings per IP per 5 minutes
}
async function main() {
    console.log('=== Ultimate Dominion Gas Station ===');
    console.log(`Primary: ${relayerAddress}`);
    console.log(`Pool:    ${allAddresses.length} EOA(s)`);
    console.log(`Chain:   ${config.chainId}`);
    console.log(`Port:    ${config.port}`);
    console.log(`Funding: ${formatEther(config.fundingAmount)} ETH per user`);
    // Initialize all wallet nonces from chain
    await initializePool(publicClient);
    const balance = await getRelayerBalance();
    console.log(`Primary balance: ${balance} ETH`);
    // Start gas charge schedulers (no-op if WORLD_ADDRESS/GOLD_TOKEN not set)
    startSchedulers();
    // Start RPC health monitoring (no-op if RPC_FALLBACK_URL not set)
    startRpcHealthCheck();
    // Start balance monitor (tops up funded players when low)
    startBalanceMonitor();
    const app = express();
    app.use(cors({ origin: config.corsOrigins }));
    app.use(express.json());
    // Health check — minimal public info; full details require API key
    app.get('/', async (req, res) => {
        const apiKey = req.headers['x-api-key'];
        const isAuthed = config.fundApiKey && apiKey === config.fundApiKey;
        try {
            if (isAuthed) {
                const poolStatus = await getPoolStatus(publicClient);
                res.json({
                    status: 'ok',
                    service: 'ud-gas-station',
                    poolSize: poolStatus.poolSize,
                    wallets: poolStatus.wallets,
                    totalInflight: poolStatus.totalInflight,
                    chainId: config.chainId,
                    gasCharging: gasChargingEnabled,
                    pendingCharges: getPendingChargeCount(),
                    pendingChargeEth: getTotalPendingEth(),
                    fundedPlayers: getFundedCount(),
                    rpcStatus: getRpcStatus(),
                });
            }
            else {
                res.json({ status: 'ok', service: 'ud-gas-station' });
            }
        }
        catch (err) {
            res.status(500).json({ status: 'error' });
        }
    });
    // Fund a new user's wallet
    app.post('/fund', async (req, res) => {
        // API key auth — prevents unauthenticated ETH drain
        if (!config.fundApiKey) {
            res.status(503).json({ error: 'Fund endpoint not configured' });
            return;
        }
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== config.fundApiKey) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { address } = req.body;
        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            res.status(400).json({ error: 'Invalid address' });
            return;
        }
        const normalizedAddress = address.toLowerCase();
        // Already funded — no double-fund
        if (fundedAddresses.has(normalizedAddress)) {
            res.json({ status: 'already_funded' });
            return;
        }
        // Check balance first — skip if already has enough
        try {
            const balance = await publicClient.getBalance({ address: address });
            if (balance >= config.fundingAmount) {
                fundedAddresses.add(normalizedAddress);
                saveFundedAddresses(fundedAddresses);
                trackFundedAddress(address);
                res.json({ status: 'already_funded', balance: formatEther(balance) });
                return;
            }
        }
        catch {
            // If balance check fails, proceed with funding
        }
        // Rate limits
        if (!rateLimitOk()) {
            res.status(429).json({ error: 'Rate limited — too many fundings' });
            return;
        }
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        if (!ipRateLimitOk(ip)) {
            res.status(429).json({ error: 'Rate limited — too many fundings from this IP' });
            return;
        }
        try {
            const txHash = await sendRelayerTx({
                to: address,
                value: config.fundingAmount,
            });
            fundedAddresses.add(normalizedAddress);
            saveFundedAddresses(fundedAddresses);
            trackFundedAddress(address);
            recentFundings.push(Date.now());
            const ipTimestamps = ipFundings.get(ip) || [];
            ipTimestamps.push(Date.now());
            ipFundings.set(ip, ipTimestamps);
            // Record for gas charging (Gold deduction)
            recordFunding(address, config.fundingAmount);
            console.log(`[fund] Funded ${address} with ${formatEther(config.fundingAmount)} ETH — tx: ${txHash}`);
            res.json({ status: 'funded', txHash, amount: formatEther(config.fundingAmount) });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[fund] Failed to fund ${address}:`, message);
            res.status(500).json({ error: 'Funding failed' });
        }
    });
    // Gold purchase — Stripe webhook → Uniswap ETH→Gold swap
    app.post('/gold-purchase', async (req, res) => {
        // Auth check
        const authHeader = req.headers.authorization;
        if (!config.goldPurchaseApiKey || authHeader !== `Bearer ${config.goldPurchaseApiKey}`) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { ownerAddress, ethAmount, stripeSessionId } = req.body;
        if (!ownerAddress || !/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)) {
            res.status(400).json({ error: 'Invalid ownerAddress' });
            return;
        }
        if (!ethAmount || !/^\d+$/.test(ethAmount)) {
            res.status(400).json({ error: 'Invalid ethAmount' });
            return;
        }
        if (!stripeSessionId) {
            res.status(400).json({ error: 'Missing stripeSessionId' });
            return;
        }
        // Dedup — already fulfilled this session
        if (fulfilledSessions.has(stripeSessionId)) {
            res.json({ status: 'already_fulfilled' });
            return;
        }
        const swapValue = BigInt(ethAmount);
        // Balance check
        try {
            const balance = await publicClient.getBalance({ address: relayerAddress });
            if (balance < swapValue + parseEther('0.001')) {
                console.error(`[gold-purchase] Insufficient relayer balance: ${formatEther(balance)} ETH, need ${formatEther(swapValue)}`);
                res.status(500).json({ error: 'Insufficient relayer balance' });
                return;
            }
        }
        catch (err) {
            console.error('[gold-purchase] Balance check failed:', err);
            res.status(500).json({ error: 'Balance check failed' });
            return;
        }
        // Swap ETH → Gold via Uniswap V3 (native ETH auto-wraps to WETH)
        try {
            const minOutput = await getMinimumOutput(config.weth, config.goldToken, swapValue);
            console.log(`[gold-purchase] Quote: ${formatEther(swapValue)} ETH → min ${minOutput} Gold (${config.swapSlippageBps / 100}% slippage)`);
            const calldata = encodeFunctionData({
                abi: swapRouterAbi,
                functionName: 'exactInputSingle',
                args: [{
                        tokenIn: config.weth,
                        tokenOut: config.goldToken,
                        fee: config.poolFee,
                        recipient: ownerAddress,
                        amountIn: swapValue,
                        amountOutMinimum: minOutput,
                        sqrtPriceLimitX96: 0n,
                    }],
            });
            const txHash = await sendRelayerTx({
                to: config.swapRouter,
                calldata,
                value: swapValue,
            });
            fulfilledSessions.add(stripeSessionId);
            saveFulfilledSessions(fulfilledSessions);
            console.log(`[gold-purchase] Swapped ${formatEther(swapValue)} ETH → Gold for ${ownerAddress} | tx: ${txHash} | session: ${stripeSessionId}`);
            res.json({ status: 'fulfilled', txHash });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[gold-purchase] Swap failed for ${ownerAddress}:`, message);
            res.status(500).json({ error: 'Swap failed' });
        }
    });
    const server = app.listen(config.port, () => {
        console.log(`[server] Listening on port ${config.port}`);
        console.log(`[server] Health: http://localhost:${config.port}/`);
        console.log(`[server] Fund:   POST http://localhost:${config.port}/fund`);
    });
    // Graceful shutdown
    const shutdown = () => {
        console.log('\n[server] Shutting down...');
        stopSchedulers();
        stopRpcHealthCheck();
        stopBalanceMonitor();
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