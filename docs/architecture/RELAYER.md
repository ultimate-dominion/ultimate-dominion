# Relayer (Gas Station)

Self-hosted gas relayer for Ultimate Dominion. It keeps burner wallets usable on Base, charges hidden Gold reserve on-chain for eligible players, and periodically swaps recovered Gold back into ETH.

---

## Purpose

Players should not need to think about ETH while playing. The relayer handles that by:

1. Funding burner wallets through `POST /fund`
2. Keeping tracked wallets above a small ETH buffer
3. Charging hidden reserve on-chain with `UD__fundAndCharge(player, characterId)`
4. Swapping accumulated Gold back into ETH on Uniswap V3
5. Optionally auto-funding the relayer pool from a separate deployer wallet

The design target is gas sponsorship, not a faucet. Active players get refilled quickly, but only up to a small target balance.

---

## Architecture

```text
Player Browser
    |
    |  POST /fund { address, delegatorAddress? } + x-api-key
    v
Gas Station (Express on Railway)
    |
    |  Pool of EOAs (least-inflight selection)
    |  Per-wallet nonce manager + RPC failover
    |  ETH top-up to burner wallet
    |  Immediate hidden-reserve charge via World.fundAndCharge()
    |
    |  Every 60s: balance monitor refills tracked wallets up to target
    |  Every 1h:  swap recovered Gold -> WETH -> ETH
    |  Every 5m:  optional pool funder tops relayer EOAs from deployer wallet
    |  Every 15s: RPC health check when fallback is configured
    v
Base Mainnet
```

`burnerAddress` is the wallet that needs ETH. `delegatorAddress` is the wallet that owns the character and hidden Gold reserve. For embedded wallets they are usually the same address. For external delegation flows they can differ.

---

## Funding Model

### Target-Buffer Refills

The relayer no longer sends a fixed `0.001 ETH` each time.

It uses a small buffer model:

- Refill only when balance is below `MIN_PLAYER_BALANCE`
- Send only the delta needed to reach `TARGET_PLAYER_BALANCE`
- Skip funding entirely if the player is already at or above target

Current defaults:

- `MIN_PLAYER_BALANCE = 0.00005 ETH`
- `TARGET_PLAYER_BALANCE = 0.00015 ETH`

`FUNDING_AMOUNT` is still accepted as a backward-compatible alias for `TARGET_PLAYER_BALANCE`, but the runtime behavior is now "top up to target", not "send fixed amount".

### `/fund` Flow

1. Client calls `POST /fund` with burner address and optional delegator address.
2. Relayer authenticates the request with `x-api-key` against `FUND_API_KEY`.
3. Relayer reads the burner's ETH balance from chain.
4. If balance is already at target, it records the player as tracked and returns `already_funded`.
5. If balance is below min, it computes the exact top-up delta to target.
6. It selects the least-busy pool wallet, sends the ETH transfer, then starts hidden Gold charging asynchronously.

Emergency re-funds for already tracked players are allowed, but gated by:

- Global rate limit: `MAX_FUNDINGS_PER_MINUTE` (default `10`)
- Per-IP rate limit: `3 fundings / 5 minutes`
- Per-address emergency cooldown: `15s`

---

## Player Charging

### On-Chain Charge Path

After every successful top-up, the relayer calls:

```solidity
UD__fundAndCharge(address player, bytes32 characterId)
```

This is the whole charging model now. There is no off-chain pending-charge batcher.

`fundAndCharge()` uses the player's hidden reserve path, so visible wallet Gold does not drop when the relayer sponsors gas.

### Decision Tree

For tracked players checked by the balance monitor:

1. ETH at or above minimum: do nothing
2. No character found: free top-up
3. Character level `< 3`: free top-up
4. Character level `>= 3`: top up first, then charge hidden reserve with `fundAndCharge()`

The relayer fails open for gameplay:

- If gas charging is disabled, everyone gets free top-ups
- If level reads fail, the player still gets topped up
- If `fundAndCharge()` fails after funding, the player is not stranded

---

## Balance Monitor

The balance monitor runs every 60 seconds and checks every tracked burner wallet.

It:

- Refills only players below `MIN_PLAYER_BALANCE`
- Sends only enough ETH to reach `TARGET_PLAYER_BALANCE`
- Tracks burner -> delegator mappings for external delegation cases
- Caps automated refills at `50` top-ups per hour

Tracked players are restored from disk on startup, so the relayer keeps monitoring known wallets across restarts.

---

## Gold Recovery

### Gold -> ETH Swap

Recovered Gold sits on the relayer address until it crosses `SWAP_THRESHOLD` (default `100 Gold`).

On each swap interval (default `1 hour`), the relayer:

1. Reads its Gold balance
2. Skips if below threshold
3. Approves the Uniswap V3 router
4. Swaps `Gold -> WETH`
5. Unwraps `WETH -> ETH`
6. Logs the new ETH balance

There is no Gold burn here. Gold is sold back into the pool, so the relayer creates sell pressure unless buy-side demand absorbs it.

---

## Wallet Pool

### Pool EOAs

Funding transactions are sent from a pool of EOAs defined by `RELAYER_PRIVATE_KEYS`. The first key is the primary wallet and is used for:

- `fundAndCharge()` transactions
- Gold -> ETH swaps
- Health reporting as the canonical relayer address

Other pool wallets only handle ETH top-up transfers.

### Selection and Nonces

The pool uses least-inflight selection:

1. Pick the wallet with the fewest in-flight transactions
2. Acquire its nonce through a per-wallet mutex
3. Send the transaction
4. Confirm or reject the nonce based on outcome
5. Resync from chain after failures

This avoids nonce collisions and hot-spotting one wallet under load.

---

## Pool Funder

If `FUNDER_PRIVATE_KEY` is set, the relayer can keep its own pool wallets funded automatically.

The pool funder:

- Checks pool wallet balances on an interval
- Tops wallets up from `POOL_MIN_BALANCE` to `POOL_TARGET_BALANCE`
- Leaves a small ETH reserve in the deployer wallet for its own gas

Default pool settings:

- `POOL_MIN_BALANCE = 0.005 ETH`
- `POOL_TARGET_BALANCE = 0.01 ETH`
- `POOL_FUND_CHECK_INTERVAL_MS = 300000`

---

## Persistence

Persistent files live under `DATA_DIR` and currently store:

- `funded-addresses.json`: burner wallets already seen by the relayer
- `fulfilled-sessions.json`: Stripe session dedupe for gold purchases
- `player-map.json`: burner -> delegator mapping

The relayer restores this state on boot before starting the balance monitor.

---

## Health Endpoint

`GET /`

- Public response: `{ status, service }`
- Authenticated response with `x-api-key: FUND_API_KEY` includes:
  - pool wallet balances, nonces, in-flight counts
  - pool size and total in-flight transactions
  - `gasCharging` enabled/disabled
  - tracked player count
  - pool funder status
  - RPC health/failover status

Example:

```bash
curl -s https://gas.ultimatedominion.com/ -H "x-api-key: $FUND_API_KEY" | jq
```

---

## Gold Purchase Endpoint

`POST /gold-purchase`

This endpoint is separate from gas sponsorship. It fulfills Stripe purchases by swapping relayer ETH for Gold on Uniswap and sending the Gold directly to the player wallet.

- Auth: `Authorization: Bearer $GOLD_PURCHASE_API_KEY`
- Dedup key: `stripeSessionId`
- Balance guard: relayer must have purchase amount plus a small ETH reserve

---

## Configuration

### Required

| Variable | Description |
|---|---|
| `RELAYER_PRIVATE_KEY` | Single EOA private key (backward compatible) |
| `RELAYER_PRIVATE_KEYS` | Comma-separated EOA pool. First key is primary. |
| `RPC_URL` | Base RPC endpoint |
| `FUND_API_KEY` | Required auth key for `/fund` |

### Funding

| Variable | Default | Description |
|---|---|---|
| `TARGET_PLAYER_BALANCE` | `150000000000000` | Top players up to `0.00015 ETH` |
| `MIN_PLAYER_BALANCE` | `50000000000000` | Refill trigger at `0.00005 ETH` |
| `FUNDING_AMOUNT` | unset | Legacy alias for `TARGET_PLAYER_BALANCE` |
| `MAX_FUNDINGS_PER_MINUTE` | `10` | Global `/fund` rate limit |

### Gas Charging / Swap

| Variable | Default | Description |
|---|---|---|
| `WORLD_ADDRESS` | unset | Required for hidden-reserve charging and swaps |
| `GOLD_TOKEN` | unset | Gold ERC20 address |
| `POOL_FEE` | `10000` | Uniswap V3 fee tier |
| `QUOTER_V2` | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | Quoter used for min-out estimation |
| `SWAP_ROUTER` | `0x2626664c2603336E57B271c5C0b26F421741e481` | Uniswap V3 router |
| `WETH` | `0x4200000000000000000000000000000000000006` | Base WETH |
| `SWAP_INTERVAL_MS` | `3600000` | Gold -> ETH swap interval |
| `SWAP_THRESHOLD` | `100000000000000000000` | Minimum Gold balance before swapping |
| `SWAP_SLIPPAGE_BPS` | `500` | Default slippage protection (5%) |

### Pool Funder

| Variable | Default | Description |
|---|---|---|
| `FUNDER_PRIVATE_KEY` | unset | Optional deployer wallet for pool refills |
| `POOL_MIN_BALANCE` | `5000000000000000` | Refill pool wallet below `0.005 ETH` |
| `POOL_TARGET_BALANCE` | `10000000000000000` | Refill pool wallet to `0.01 ETH` |
| `POOL_FUND_CHECK_INTERVAL_MS` | `300000` | Pool funder interval |

### Misc

| Variable | Default | Description |
|---|---|---|
| `RPC_FALLBACK_URL` | unset | Optional fallback RPC |
| `RPC_AUTH_TOKEN` | unset | Bearer token for self-hosted RPC |
| `GOLD_PURCHASE_API_KEY` | unset | Enables `/gold-purchase` |
| `DATA_DIR` | `./data` | Persistent state directory |

---

## Operations

### Restart Behavior

On startup the relayer:

1. Initializes wallet nonces from chain
2. Starts the Gold swap scheduler
3. Starts RPC health monitoring
4. Restores tracked players and burner/delegator mappings from disk
5. Starts the optional pool funder
6. Starts the balance monitor

Tracked players survive restarts because they are persisted. Emergency cooldown timestamps do not.

### Check Pool State

```bash
curl -s https://gas.ultimatedominion.com/ -H "x-api-key: $FUND_API_KEY" | jq '.wallets'
```

### Handle Stuck Nonces

1. Most failures self-heal through nonce resync after a rejected send
2. If a wallet remains stuck, restart the relayer to reinitialize pending nonces from chain
3. If needed, replace the pending transaction from the affected EOA with the same nonce and a higher gas price

### Add or Rotate Pool EOAs

1. Generate the new key
2. Add it to `RELAYER_PRIVATE_KEYS`
3. Ensure the pool wallet has enough ETH buffer for expected top-up traffic
4. Redeploy the relayer

### Fund Pool Wallets

If the pool funder is disabled, top up the pool EOAs manually. Use the authenticated health endpoint to see which wallets are low.

---

## Source Files

```text
packages/relayer/
  .env.example         Runtime configuration template
  src/
    index.ts          Express server, /fund and /gold-purchase, startup
    config.ts         Env parsing and runtime defaults
    walletPool.ts     EOA pool, least-inflight selection, health data
    nonce.ts          Per-wallet nonce manager
    tx.ts             Transaction send helpers
    playerFunding.ts  Refill threshold + target calculations
    balanceMonitor.ts Automated burner wallet refills
    chainReader.ts    On-chain MUD reads for character/level/config
    gasCharge.ts      fundAndCharge calls + Gold -> ETH swaps
    poolFunder.ts     Optional pool-wallet auto-funding
    persistence.ts    Disk-backed funded address / session / player state
    rpcManager.ts     Primary/fallback RPC health monitoring
```

---

*Last updated: April 7, 2026*
