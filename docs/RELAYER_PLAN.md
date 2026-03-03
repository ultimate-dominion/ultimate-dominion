# Self-Hosted EIP-7702 Relayer

## Context
Thirdweb's dedicated relayer ($99/mo) only works with the REST API (secret key), NOT with in-app wallet SDK transactions (client ID). All player transactions go through Thirdweb's shared relayer pool, causing nonce collisions and unpredictable latency. We need a self-hosted relayer that the SDK can talk to directly.

The SDK exposes `setThirdwebDomains({ bundler: "..." })` which overrides the bundler URL globally. Custom domains don't receive Thirdweb auth headers (`x-client-id`, `authorization`), simplifying our implementation — we just need to implement the 3 JSON-RPC methods the SDK calls.

## Architecture

```
Player Browser (thirdweb SDK)
    │
    │  setThirdwebDomains({ bundler: "relay.ultimatedominion.com" })
    │  POST /v2  (JSON-RPC)
    ▼
Self-Hosted Relayer (Express on Railway)
    │
    │  Single EOA wallet, mutex-protected nonce
    │  Builds raw tx with EIP-7702 authorization list
    │  Sends via eth_sendRawTransaction
    ▼
Base Mainnet (Alchemy RPC)
```

## Changes

### 1. Create `packages/relayer/` — Express JSON-RPC server

Follow the indexer pattern (`packages/indexer/`): Dockerfile multi-stage build, ES modules, `src/config.ts` with `required()` helper, graceful shutdown.

**`src/config.ts`** — Environment validation:
- `RELAYER_PRIVATE_KEY` (required) — EOA that pays gas and submits txs
- `RPC_URL` (required) — Alchemy Base Mainnet endpoint
- `PORT` (default 3001)
- `CORS_ORIGINS` (default `http://localhost:3000`)
- `CHAIN_ID` (default 8453)
- `DELEGATION_CONTRACT` (required) — MinimalAccount implementation address (from `tw_getDelegationContract` on Thirdweb's bundler, then hardcode)

**`src/index.ts`** — Express server:
- `POST /v2` — JSON-RPC dispatcher (routes to method handlers)
- `GET /` — Health check (relayer address, balance, nonce, pending queue size)
- CORS middleware, JSON body parsing, graceful shutdown

**`src/methods/tw_execute.ts`** — Submit transaction:
1. Parse params: `[eoaAddress, wrappedCalls, signature, authorization?]`
2. Generate `queueId` (random hex)
3. Encode calldata: `executeWithSig(wrappedCalls, signature)` — selector `0xba61557d`
4. Build transaction to `eoaAddress` (the user's EOA, which has MinimalAccount delegated)
5. If `authorization` is provided (first-time delegation), include in EIP-7702 authorization list
6. Acquire nonce mutex → get nonce → sign + send raw tx → release mutex
7. Store `queueId → { txHash, status }` in memory map
8. Return `{ result: { queueId } }`

**`src/methods/tw_getTransactionHash.ts`** — Poll for tx hash:
1. Parse params: `[queueId]`
2. Look up in memory map
3. Return `{ result: { transactionHash } }` or `{ result: { transactionHash: null } }` if pending

**`src/methods/tw_getDelegationContract.ts`** — Return MinimalAccount address:
1. No params
2. Return `{ result: { delegationContract: config.delegationContract } }`

**`src/nonce.ts`** — Mutex-protected nonce manager:
```typescript
class NonceManager {
  private nonce: number;
  private mutex: Promise<void>;

  async acquire(): Promise<number> { /* wait for mutex, return nonce++ */ }
  release(): void { /* resolve mutex */ }
  async sync(): Promise<void> { /* fetch from chain: eth_getTransactionCount */ }
}
```
- Initialize from chain on startup
- Increment locally after each send
- Re-sync from chain on send failure (nonce too low/high)

**`src/tx.ts`** — Transaction builder:
- Uses viem's `createWalletClient` + `privateKeyToAccount`
- Encodes `executeWithSig` calldata using ABI
- Estimates gas via `eth_estimateGas` with 1.5x buffer
- Fetches gas price via `eth_gasPrice`
- Signs and sends raw transaction
- For EIP-7702 authorization: includes `authorizationList` in tx

**Key dependencies**: `viem` (2.35.1), `express`, `cors`, `dotenv`

**Directory structure**:
```
packages/relayer/
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts          (Express server + JSON-RPC dispatcher)
    ├── config.ts         (env validation)
    ├── nonce.ts          (mutex nonce manager)
    ├── tx.ts             (transaction builder + sender)
    └── methods/
        ├── tw_execute.ts
        ├── tw_getTransactionHash.ts
        └── tw_getDelegationContract.ts
```

### 2. Client integration — `packages/client/src/contexts/AuthContext.tsx`

Add `setThirdwebDomains` call **before** `createThirdwebClient` (before line 42):

```typescript
import { setThirdwebDomains } from "thirdweb/utils";

const RELAYER_URL = import.meta.env.VITE_RELAYER_URL;
if (RELAYER_URL) {
  setThirdwebDomains({ bundler: RELAYER_URL });
}

const thirdwebClient = createThirdwebClient({ ... });
```

Add env var `VITE_RELAYER_URL` to:
- `.env.development` — `localhost:3001` (for local dev) or empty (use Thirdweb default)
- `.env.staging` — `relay.ultimatedominion.com` (Railway domain)
- `.env.production` — empty for now (keep Thirdweb default until verified on beta)

**Note**: The `setThirdwebDomains` bundler value is a **domain**, not a full URL. The SDK constructs the URL as:
- If starts with `localhost:` → `http://{domain}/v2?chain={chainId}`
- Otherwise → `https://{chainId}.{domain}/v2`

So `VITE_RELAYER_URL` should be set to the domain only (e.g., `relay.ultimatedominion.com`), and the relayer should handle the URL pattern `POST /:chainId/v2` or simply `POST /v2` (ignoring the chain prefix since we only support Base).

**Update**: The Express route should be `POST /v2` and also handle `POST /:prefix/v2` to match the SDK's URL construction (`https://8453.relay.ultimatedominion.com/v2` or route via path).

Since Railway gives us a single domain (not `8453.relay.ultimatedominion.com`), we'll configure:
- `VITE_RELAYER_URL = "localhost:3001"` (dev) — SDK makes `http://localhost:3001/v2?chain=8453`
- For production: set up `relay.ultimatedominion.com` as a custom domain on Railway, and use `setThirdwebDomains({ bundler: "relay.ultimatedominion.com" })`. The SDK will try `https://8453.relay.ultimatedominion.com/v2` which won't work with a single Railway domain.

**Alternative approach**: Instead of using `setThirdwebDomains`, we can pass `bundlerUrl` directly in the wallet connection options. Let me check... Actually, looking at the SDK code, `getDefaultBundlerUrl` is used when no explicit `bundlerUrl` is provided. The `bundlerUrl` can be passed in `BundlerOptions`.

**Simplest approach for Railway**: Use the raw bundler URL override. The SDK's `sendBundlerRequest` accepts `options.bundlerUrl` which takes precedence over the domain-based URL. We should use `setThirdwebDomains` with `bundler: "localhost:3001"` for local dev (which generates `http://localhost:3001/v2?chain=8453`), and for production we need the `{chainId}.{domain}` pattern.

**Railway solution**: Configure Railway custom domain as `8453.relay.ultimatedominion.com` (add CNAME in Cloudflare pointing to Railway). The SDK constructs `https://8453.relay.ultimatedominion.com/v2` which hits our relayer.

### 3. Railway deployment

- Create new Railway service in existing project (`sweet-quietude`)
- Docker build from `packages/relayer/Dockerfile`
- Custom domain: `8453.relay.ultimatedominion.com` (CNAME in Cloudflare → Railway)
- Environment variables set in Railway dashboard:
  - `RELAYER_PRIVATE_KEY` — fresh EOA, funded with ~0.1 ETH
  - `RPC_URL` — Alchemy Base Mainnet
  - `PORT` — Railway assigns automatically
  - `CORS_ORIGINS` — `https://beta.ultimatedominion.com,https://ultimatedominion.com`
  - `CHAIN_ID` — `8453`
  - `DELEGATION_CONTRACT` — MinimalAccount address (query from Thirdweb bundler first)

### 4. Cloudflare DNS

Add CNAME record:
- `8453.relay` → Railway service domain (e.g., `relayer-production-xxxx.up.railway.app`)
- Proxy: DNS only (orange cloud off) — Railway handles TLS

## What NOT to change
- Thirdweb client ID / secret key — still needed for auth (in-app wallet login, not bundler)
- MUDContext.tsx gas buffer proxy — still needed (relayer doesn't change gas estimation)
- Any contract code — relayer is purely infrastructure
- Production env — keep using Thirdweb bundler until beta is verified

## Files Modified
| File | Change |
|---|---|
| `packages/relayer/` (NEW) | Entire new package — Express JSON-RPC relayer |
| `packages/client/src/contexts/AuthContext.tsx` | Add `setThirdwebDomains` call before client creation |
| `packages/client/.env.staging` | Add `VITE_RELAYER_URL=relay.ultimatedominion.com` |
| `packages/client/.env.development` | Add `VITE_RELAYER_URL=localhost:3001` |

## Verification
1. **Local**: Start relayer (`pnpm dev` in packages/relayer), start client, create character or make a move — tx should route through local relayer (check relayer logs)
2. **Beta**: Deploy relayer to Railway, set up DNS, update client env, deploy client — verify transactions go through self-hosted relayer
3. **Health check**: `curl https://8453.relay.ultimatedominion.com/` — should return relayer address + balance
4. **Nonce handling**: Send 3 rapid transactions — all should succeed without nonce collisions
5. **First-time user**: New wallet with no delegation — EIP-7702 authorization should be included in first tx
6. **Fallback**: If `VITE_RELAYER_URL` is empty, SDK falls back to Thirdweb's default bundler (no breakage)
