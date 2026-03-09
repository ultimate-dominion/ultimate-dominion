# Relayer (Gas Station)

Self-hosted gas relayer for Ultimate Dominion. Funds embedded wallet players with ETH so they can transact on Base, charges them Gold for the gas, and sells that Gold on Uniswap V3 to self-fund operations.

---

## Purpose

Players using Privy embedded wallets (Google/email login) have no ETH to pay gas. The relayer solves this by:

1. Sending ETH to new player wallets on first login (`POST /fund`)
2. Automatically topping up players whose balance drops below threshold
3. Charging players Gold for the gas it spent (`batchChargeGasGoldWithCounts`)
4. Selling that Gold on Uniswap V3 to recoup ETH (`swapGoldForEth`)

Players below level 3 are sponsored (free gas). Level 3+ players are charged Gold proportional to the ETH funded. The goal is self-sustainability: at Gold prices above ~$0.003, the relayer earns more from Gold sales than it spends on gas.

---

## Architecture

```
Player Browser (Privy embedded wallet)
    |
    |  POST /fund  { address: "0x..." }
    v
Gas Station (Express on Railway)
    |
    |  Pool of EOA wallets (least-inflight selection)
    |  Mutex-protected nonce management per EOA
    |  Sends ETH transfer to player wallet
    |  Records funding for Gold charge batching
    |
    |  Every 5 min: batchChargeGasGoldWithCounts() -> World contract
    |  Every 1 hour: swapGoldForEth() -> Uniswap V3 GOLD/WETH -> unwrap WETH
    |  Every 60s:   balanceMonitor checks funded players, tops up if low
    |  Every 15s:   RPC health check (failover to fallback if primary down)
    v
Base Mainnet (self-hosted RPC: rpc.ultimatedominion.com)
```

---

## How It Works

### Funding Flow

1. Player logs in via Privy (Google/email). Client checks wallet ETH balance.
2. If balance is below `MIN_PLAYER_BALANCE` (default 0.0003 ETH), client calls `POST /fund { address }`.
3. Relayer validates the address, checks rate limits (global + per-IP), confirms balance is actually low.
4. Acquires the least-busy EOA from the wallet pool, sends `FUNDING_AMOUNT` (default 0.001 ETH) to the player.
5. Records the funding event in the pending charges map for later Gold deduction.
6. Player now has ETH and can submit transactions directly to Base.

### Anti-Griefing

- **One-time funding**: Each address can only be funded once (in-memory set).
- **Global rate limit**: Max `MAX_FUNDINGS_PER_MINUTE` (default 10) fundings per minute.
- **IP rate limit**: Max 3 fundings per IP per 5 minutes.
- **Balance check**: Skips funding if the player already has enough ETH.
- **World address allowlist**: `ALLOWED_WORLD_ADDRESSES` restricts which world contracts the relayer serves.

---

## Wallet Pool

### Selection Strategy

The pool uses **least-inflight selection**, not round-robin. When a transaction is needed:

1. Scan all wallets, pick the one with the lowest `inflight` counter.
2. Acquire that wallet's nonce via its `NonceManager` mutex.
3. Increment `inflight`. Send the transaction.
4. On success: increment nonce, decrement `inflight`.
5. On failure: keep nonce unchanged (reject), decrement `inflight`, resync nonce from chain.

This prevents hot-spotting a single EOA under load and ensures nonce gaps don't accumulate.

### Nonce Management

Each EOA has its own `NonceManager` instance:

- **Initialize**: Read `pending` transaction count from chain on startup.
- **Acquire**: Wait for mutex lock, return current nonce.
- **Confirm**: Increment nonce, release lock (transaction landed).
- **Reject**: Release lock without incrementing (transaction failed).
- **Resync**: Re-read nonce from chain with `blockTag: 'pending'` after failures.

The mutex ensures only one transaction per EOA is in the signing/broadcast phase at a time, eliminating nonce collisions.

### RPC Failover

If `RPC_FALLBACK_URL` is set, the relayer monitors the primary RPC every 15 seconds:

- 2 consecutive failures marks primary as down, switches to fallback.
- Checks every 60s while on fallback to detect recovery.
- Uses viem's `fallback()` transport so all wallet clients automatically route through the healthy endpoint.

---

## Gas Charging

### batchChargeGasGoldWithCounts()

Runs on a scheduler (default every 5 minutes via `CHARGE_INTERVAL_MS`).

1. Snapshots the pending charges map (player address -> total ETH funded since last flush) and clears it.
2. For each player, looks up their `characterId` from the `CharacterOwner` MUD table (cached after first lookup).
3. Converts ETH amounts to proportional counts: 1 count per 0.001 ETH funded (minimum 1).
4. Calls `UD__batchChargeGasGoldWithCounts(players[], characterIds[], counts[])` on the World contract.
5. The on-chain function deducts Gold from each player's character. It is fault-tolerant: if one player lacks Gold, others still get charged (partial success).
6. On failure, re-queues all charges for the next flush cycle.

### Gold Swap: swapGoldForEth()

Runs on a scheduler (default every 1 hour via `SWAP_INTERVAL_MS`).

1. Checks relayer's Gold token balance.
2. If below `SWAP_THRESHOLD` (default 100 Gold), skips.
3. Approves the Uniswap V3 SwapRouter to spend the Gold.
4. Calls `exactInputSingle` to swap GOLD -> WETH on the configured pool (fee tier from `POOL_FEE`).
5. Unwraps WETH -> ETH via the WETH contract's `withdraw()`.
6. Logs the new ETH balance.

Gold is **not burned** -- it re-enters circulation through DEX buyers. The gas mechanism is a redistribution + sell pressure source, not a permanent sink.

### Self-Sustainability

| Gold Price | Gold Value Per Tx | Gas Cost Per Tx (Base) | Per-Tx P&L |
|---|---|---|---|
| $0.001 | $0.001 | ~$0.003 | -$0.002 (losing money) |
| $0.002 | $0.002 | ~$0.003 | -$0.001 (losing money) |
| $0.003 | $0.003 | ~$0.003 | ~breakeven |
| $0.005 | $0.005 | ~$0.003 | +$0.002 (sustainable) |

Below ~$0.003/Gold, the relayer cannot self-fund. It stops selling Gold on the DEX (removing sell pressure), which helps the price recover. This creates a self-correcting feedback loop.

---

## Balance Monitor

Runs every 60 seconds. Iterates all previously-funded player addresses and tops up any whose ETH balance has dropped below `MIN_PLAYER_BALANCE`. Rate-limited to 50 top-ups per hour to prevent drain attacks. Top-ups also get recorded as pending Gold charges.

---

## Gold Purchase Endpoint

`POST /gold-purchase` -- fulfills Stripe-initiated gold purchases by swapping ETH for Gold via Uniswap V3.

- Authenticated via `GOLD_PURCHASE_API_KEY` (Bearer token).
- Accepts `{ ownerAddress, ethAmount, stripeSessionId }`.
- Deduplicates on `stripeSessionId` to prevent double-fulfillment.
- Checks relayer ETH balance, then executes `exactInputSingle` ETH->GOLD with the Gold sent directly to the player's address.

---

## Configuration

All environment variables from `.env.example`:

### Required

| Variable | Description |
|---|---|
| `RELAYER_PRIVATE_KEY` | Single EOA private key (backward compat) |
| `RELAYER_PRIVATE_KEYS` | Comma-separated pool of EOA private keys. First key is primary (used for gas charging). Overrides `RELAYER_PRIVATE_KEY` if both set. |
| `RPC_URL` | Base Mainnet RPC endpoint (e.g. `https://rpc.ultimatedominion.com`) |

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Express server port (Railway assigns automatically) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `CHAIN_ID` | `8453` | Base Mainnet chain ID |

### RPC

| Variable | Default | Description |
|---|---|---|
| `RPC_AUTH_TOKEN` | (empty) | Bearer token for self-hosted RPC auth. Omit for third-party providers. |
| `RPC_FALLBACK_URL` | (empty) | Fallback RPC (e.g. Alchemy). Enables health-check failover when set. |

### Security

| Variable | Default | Description |
|---|---|---|
| `ALLOWED_WORLD_ADDRESSES` | (empty) | Comma-separated world addresses the relayer will serve. Leave empty only in dev. |

### Gas Funding

| Variable | Default | Description |
|---|---|---|
| `FUNDING_AMOUNT` | `1000000000000000` (0.001 ETH) | ETH sent per initial funding |
| `MIN_PLAYER_BALANCE` | `300000000000000` (0.0003 ETH) | Balance threshold for top-up eligibility |
| `MAX_FUNDINGS_PER_MINUTE` | `10` | Global rate limit on fundings |

### Gas Charging (optional -- disabled if either is unset)

| Variable | Default | Description |
|---|---|---|
| `WORLD_ADDRESS` | (empty) | MUD World contract address. Required for Gold charging. |
| `GOLD_TOKEN` | (empty) | Gold ERC20 address. Required for Gold charging + swaps. |
| `CHARGE_INTERVAL_MS` | `300000` (5 min) | How often to flush pending Gold charges |
| `SWAP_INTERVAL_MS` | `3600000` (1 hour) | How often to swap accumulated Gold for ETH |
| `SWAP_THRESHOLD` | `100000000000000000000` (100 Gold) | Minimum Gold balance to trigger a swap |

### DEX / Swap

| Variable | Default | Description |
|---|---|---|
| `WETH` | `0x4200000000000000000000000000000000000006` | WETH address on Base |
| `SWAP_ROUTER` | `0x2626664c2603336E57B271c5C0b26F421741e481` | Uniswap V3 SwapRouter02 on Base |
| `POOL_FEE` | `3000` | Uniswap V3 fee tier (3000 = 0.3%, 10000 = 1%). Must match deployed pool. |

### Gold Purchase

| Variable | Default | Description |
|---|---|---|
| `GOLD_PURCHASE_API_KEY` | (empty) | API key for `/gold-purchase` endpoint (Bearer auth). Endpoint disabled if unset. |

---

## Deployment

### Railway Docker

The relayer runs as a Docker service on Railway (project `sweet-quietude`).

- **Dockerfile**: Multi-stage build. Stage 1 compiles TypeScript. Stage 2 copies `dist/` and installs production deps only.
- **Custom domain**: `gas.ultimatedominion.com` (CNAME in Cloudflare -> Railway, DNS-only / orange cloud off -- Railway handles TLS).
- **Environment variables**: Set in the Railway dashboard. `PORT` is assigned by Railway automatically.

### Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `tsx watch src/index.ts` | Local development with hot reload |
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `start` | `node dist/index.js` | Production start (used by Dockerfile) |

### Deploy Steps

1. Push to `dev` branch -- Railway auto-deploys from the branch.
2. Verify health: `curl https://gas.ultimatedominion.com/`
3. Check logs in Railway dashboard for startup output and pool initialization.

---

## Operations

### Check EOA Balances

```bash
curl -s https://gas.ultimatedominion.com/ | jq '.wallets'
```

Returns each pool wallet's address, current nonce, inflight count, and ETH balance.

### Check Health

```bash
curl -s https://gas.ultimatedominion.com/ | jq
```

Response includes:
- `status`: "ok" or "error"
- `poolSize`: Number of EOAs in the pool
- `totalInflight`: Current in-flight transactions across all wallets
- `gasCharging`: Whether Gold charging is enabled
- `pendingCharges`: Number of players with unflushed Gold charges
- `pendingChargeEth`: Total ETH value of unflushed charges
- `fundedPlayers`: Number of unique addresses funded this session
- `rpcStatus`: Primary/fallback RPC health

### Handle Stuck Nonces

If a wallet gets a stuck nonce (transaction submitted but never mined):

1. The automatic resync on failure usually handles this -- failed sends trigger `resync()` which re-reads the nonce from chain with `blockTag: 'pending'`.
2. If the relayer is stuck, restart it. On startup, `initializePool()` re-reads all nonces from chain.
3. For a truly stuck pending transaction, send a replacement transaction (same nonce, higher gas) from the affected EOA using cast or a separate script.

### Add or Rotate EOAs

1. Generate new EOA private key.
2. Fund it with ETH (enough for ~1000 fundings at 0.001 ETH each = 1 ETH).
3. Add the key to `RELAYER_PRIVATE_KEYS` in Railway env vars (comma-separated).
4. Redeploy. The pool initializes all keys on startup.

To remove an EOA, remove its key from `RELAYER_PRIVATE_KEYS` and redeploy. Drain remaining ETH from the retired EOA separately.

### Restart the Relayer

In Railway dashboard: click "Restart" on the service, or push a new commit to trigger redeploy. On startup, the relayer:

1. Initializes all wallet nonces from chain.
2. Starts gas charge scheduler (5-min flush).
3. Starts Gold swap scheduler (1-hour swap).
4. Starts balance monitor (60s check).
5. Starts RPC health check (15s check, if fallback configured).

Note: Pending charges in memory are lost on restart. This is acceptable -- the amounts are small and players will be charged on the next cycle after their next funding event.

### Fund Pool Wallets

When pool wallets run low on ETH, transfer ETH to them from a funded wallet. Check balances via the health endpoint. Each wallet needs enough to cover its share of fundings (at 0.001 ETH per funding, 1 ETH covers ~1000 fundings).

---

## Troubleshooting

### "Rate limited -- too many fundings"

Global rate limit hit. Default: 10 fundings/minute. Increase `MAX_FUNDINGS_PER_MINUTE` if legitimate load exceeds this.

### "Rate limited -- too many fundings from this IP"

Per-IP limit: 3 fundings per 5 minutes. This prevents a single IP from draining the pool. If a legitimate service (e.g., a shared proxy) hits this, consider whitelisting at the application level.

### Gas charging not working

Check `gasCharging` in the health endpoint. If `false`, either `WORLD_ADDRESS` or `GOLD_TOKEN` is not set. Both are required.

### Gold swap not executing

- Check relayer's Gold balance -- must exceed `SWAP_THRESHOLD` (default 100 Gold).
- Verify `SWAP_ROUTER` and `POOL_FEE` match the deployed Uniswap V3 pool.
- Check logs for "Gold->ETH swap failed" errors, which typically indicate approval issues or pool liquidity problems.

### Nonce collisions / "nonce too low"

Usually self-healing: the failed transaction triggers `resyncWallet()` which re-reads the nonce from chain. If it persists, restart the relayer to re-initialize all nonces.

### RPC errors / timeouts

- If `RPC_FALLBACK_URL` is configured, check `rpcStatus` in the health endpoint to see if the relayer has failed over.
- Self-hosted RPC issues: check the Base node at `rpc.ultimatedominion.com`.
- Set `RPC_FALLBACK_URL` to a third-party provider (e.g., Alchemy) as a safety net.

### Pool wallet balance low

The relayer will fail to fund players if pool wallets have insufficient ETH. Monitor via the health endpoint. Top up wallets by sending ETH to the addresses listed in the pool status.

### Player not receiving funding

1. Check if the address was already funded (`already_funded` response).
2. Check rate limit status.
3. Verify the player's wallet address is valid (0x + 40 hex chars).
4. Check relayer logs for the specific address.

---

## Source Files

```
packages/relayer/
  Dockerfile          Multi-stage Docker build (node:20-slim)
  package.json        Dependencies: viem, express, cors, dotenv
  tsconfig.json       TypeScript config
  .env.example        All env vars with descriptions
  src/
    index.ts          Express server, /fund and /gold-purchase endpoints, startup
    config.ts         Env var parsing and validation
    walletPool.ts     EOA pool: least-inflight selection, nonce init, pool status
    nonce.ts          Per-EOA mutex nonce manager (acquire/confirm/reject/resync)
    tx.ts             sendRelayerTx() — acquires wallet, estimates gas, broadcasts, handles failure
    gasCharge.ts      Gold charge batching + Gold-to-ETH swap scheduler
    balanceMonitor.ts Periodic balance checks and auto top-ups for funded players
    rpcManager.ts     Primary/fallback RPC health monitoring and failover
```

---

*Last updated: March 9, 2026*
