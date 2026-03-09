# Self-Hosted Gas Station

## Context
With Privy's MPC embedded wallets, players sign transactions directly as standard EOAs — no bundler, no meta-transactions, no EIP-7702 delegation. The "relayer" is now a **gas station**: it funds new user wallets with ETH so they can pay their own gas, and tops up wallets that run low.

The gas station exposes a single `POST /fund` endpoint. The client calls it after Privy login when the player's wallet has insufficient ETH. A pool of 5 funded EOAs handles the transfers with mutex-protected nonces to avoid collisions under load.

## Architecture

```
Player Browser (Privy embedded wallet)
    │
    │  POST /fund  { address: "0x..." }
    ▼
Gas Station (Express on Railway)
    │
    │  5-EOA pool, round-robin with mutex nonces
    │  Sends ETH transfer to player wallet
    │  Rate-limited per address
    ▼
Base Mainnet (self-hosted RPC: rpc.ultimatedominion.com)
```

## Implementation

### 1. `packages/relayer/` — Express gas station server

Follows the indexer pattern (`packages/indexer/`): Dockerfile multi-stage build, ES modules, `src/config.ts` with `required()` helper, graceful shutdown.

**`src/config.ts`** — Environment validation:
- `FUNDER_PRIVATE_KEYS` (required) — comma-separated list of 5 EOA private keys (the funding pool)
- `RPC_URL` (required) — self-hosted Base Mainnet endpoint (`rpc.ultimatedominion.com`)
- `PORT` (default 3001)
- `CORS_ORIGINS` (default `http://localhost:3000`)
- `CHAIN_ID` (default 8453)
- `FUND_AMOUNT` (default `0.0005`) — ETH to send per funding request
- `MIN_BALANCE` (default `0.0002`) — threshold below which a wallet qualifies for top-up

**`src/index.ts`** — Express server:
- `POST /fund` — accepts `{ address }`, validates, sends ETH from next available pool EOA
- `GET /` — Health check (pool EOA addresses, balances, pending queue size)
- CORS middleware, JSON body parsing, rate limiting (1 fund per address per hour), graceful shutdown

**`src/pool.ts`** — Round-robin EOA pool with per-EOA nonce mutex:
```typescript
class FundingPool {
  private eoas: { account, nonceManager }[];
  private index: number;

  async fund(recipient: Address, amount: bigint): Promise<Hash> {
    // Round-robin select next EOA
    // Acquire nonce mutex for that EOA
    // Send ETH transfer
    // Release mutex
  }
}
```
- Each EOA has its own `NonceManager` (initialized from chain on startup)
- Round-robin selection avoids hot-spotting a single EOA
- Re-sync nonce from chain on send failure

**`src/nonce.ts`** — Mutex-protected nonce manager (same pattern as before):
- Initialize from chain on startup
- Increment locally after each send
- Re-sync from chain on send failure (nonce too low/high)

**Key dependencies**: `viem` (2.35.1), `express`, `cors`, `express-rate-limit`, `dotenv`

**Directory structure**:
```
packages/relayer/
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts          (Express server + /fund endpoint)
    ├── config.ts         (env validation)
    ├── pool.ts           (round-robin EOA funding pool)
    └── nonce.ts          (per-EOA mutex nonce manager)
```

### 2. Client integration — `packages/client/src/contexts/AuthContext.tsx`

After Privy login, check the player's wallet ETH balance. If below `MIN_BALANCE`, call the gas station:

```typescript
const GAS_STATION_URL = import.meta.env.VITE_GAS_STATION_URL;

async function ensureFunded(address: string) {
  const balance = await publicClient.getBalance({ address });
  if (balance < parseEther('0.0002')) {
    await fetch(`${GAS_STATION_URL}/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
  }
}
```

Add env var `VITE_GAS_STATION_URL` to:
- `.env.development` — `http://localhost:3001`
- `.env.staging` — `https://gas.ultimatedominion.com`
- `.env.production` — `https://gas.ultimatedominion.com`

### 3. Railway deployment

- Existing Railway service in project (`sweet-quietude`), already deployed
- Docker build from `packages/relayer/Dockerfile`
- Custom domain: `gas.ultimatedominion.com` (CNAME in Cloudflare -> Railway)
- Environment variables set in Railway dashboard:
  - `FUNDER_PRIVATE_KEYS` — 5 funded EOAs, comma-separated
  - `RPC_URL` — `https://rpc.ultimatedominion.com`
  - `PORT` — Railway assigns automatically
  - `CORS_ORIGINS` — `https://beta.ultimatedominion.com,https://ultimatedominion.com`
  - `CHAIN_ID` — `8453`
  - `FUND_AMOUNT` — `0.0005`
  - `MIN_BALANCE` — `0.0002`

### 4. Cloudflare DNS

CNAME record:
- `gas` → Railway service domain (e.g., `relayer-production-xxxx.up.railway.app`)
- Proxy: DNS only (orange cloud off) — Railway handles TLS

## What NOT to change
- MUDContext.tsx gas buffer proxy — still needed (gas station doesn't change gas estimation)
- Any contract code — gas station is purely infrastructure
- Privy app ID / config — managed separately in Privy dashboard

## Files Modified
| File | Change |
|---|---|
| `packages/relayer/` | Gas station server — `POST /fund` endpoint, 5-EOA pool |
| `packages/client/src/contexts/AuthContext.tsx` | Call gas station after Privy login if wallet balance is low |
| `packages/client/.env.staging` | Add `VITE_GAS_STATION_URL=https://gas.ultimatedominion.com` |
| `packages/client/.env.development` | Add `VITE_GAS_STATION_URL=http://localhost:3001` |

## Verification
1. **Local**: Start gas station (`pnpm dev` in packages/relayer), start client, sign in with Privy — new wallet should receive funding (check gas station logs)
2. **Beta**: Deploy gas station to Railway, set up DNS, update client env, deploy client — verify new users get funded
3. **Health check**: `curl https://gas.ultimatedominion.com/` — should return pool EOA addresses + balances
4. **Nonce handling**: Fund 3 wallets rapidly — all should succeed without nonce collisions (round-robin across 5 EOAs)
5. **Rate limiting**: Same address requesting funding twice within 1 hour should be rejected
6. **Top-up**: Existing user with balance below threshold should receive a top-up on next login
