# Ultimate Dominion Deploy Runbook

How to deploy every component of Ultimate Dominion, from contracts to infrastructure.

---

## 1. Environment Matrix

| Environment | Chain | Chain ID | World Address | Branch | Client URL |
|-------------|-------|----------|---------------|--------|------------|
| **Local** | Anvil | 31337 | Auto-generated | Any | `http://localhost:3000` |
| **Beta** | Base Mainnet | 8453 | `0xD2051EB4F5001d46c11F928BD6578Bd5f7e028A3` | `dev` | `https://beta.ultimatedominion.com` |
| **Production** | Base Mainnet | 8453 | `0x99d01939F58B965E6E84a1D167E710Abdf5764b0` | `main` | `https://ultimatedominion.com` |

Both beta and production run on Base Mainnet (chain 8453). They are distinguished **only** by world address. Never mix them.

### Environment Files (packages/contracts/)

| File | Purpose |
|------|---------|
| `.env` | Local Anvil (chain 31337) |
| `.env.testnet` | Beta (Base Mainnet, beta world) |
| `.env.mainnet` | Production (Base Mainnet, production world) |

Scripts source the correct `.env` file automatically. Forge admin scripts require manual sourcing: `source .env.testnet && forge script ...`

---

## 2. Contract Deployment

### Upgrade Deploy (Normal Case)

This is the standard deployment path. It upgrades existing system contracts in-place while preserving all player data.

```bash
cd packages/contracts

# Beta (from dev branch)
pnpm deploy:testnet

# Production (from main branch — ALWAYS confirm first)
pnpm deploy:mainnet
```

What these scripts do under the hood:
1. `source .env.testnet` (or `.env.mainnet`)
2. `pnpm build` (forge build)
3. `mud deploy --profile=base-mainnet --worldAddress $WORLD_ADDRESS`
4. `pnpm ensure-access:testnet` (runs `EnsureAccess.s.sol` to restore cross-namespace access grants)

### CRITICAL: Always Use --worldAddress

**Never deploy without `--worldAddress` to an existing chain.** The deploy scripts include it automatically, but if you're running `mud deploy` manually, always pass it.

Why: Changing compiler settings (optimizer_runs, via_ir, Solidity version) alters all bytecodes. Different bytecodes produce different CREATE2 addresses. MUD will deploy an entirely new world instead of upgrading the existing one. All player data lives in the old world — you've just created an empty copy.

### PostDeploy Scripts

`MinimalPostDeploy.s.sol` runs automatically on **fresh deploys only** (not upgrades). It registers ERC20 (Gold), ERC721 (Characters), ERC1155 (Items/Badges/Fragments), sets up delegation, and configures GasStation.

On upgrade deploys, MinimalPostDeploy does NOT run. You must handle config changes manually:
- GasStationSwapConfig: `cast send` after deploy
- Gold namespace access: Handled by auto-chained `EnsureAccess.s.sol`
- New cross-namespace systems: Update `EnsureAccess.s.sol` BEFORE deploying

### Content Pipeline

Zone data lives in `zones/dark_cave/` (items.json, monsters.json, effects.json, shops.json). This is the **single source of truth** for all game content. The zone-loader script is the only tool for loading content on-chain.

**Fresh deploy:** Load all content via zone-loader after MinimalPostDeploy:
```bash
pnpm zone:load:testnet dark_cave      # Beta
pnpm zone:load:mainnet dark_cave      # Production
```

**Updating existing content:** Use item-sync to diff and push changes:
```bash
# If items.json changed — diff first, then push
pnpm item:verify:testnet dark_cave    # Diff only (safe, read-only)
pnpm item:sync:testnet dark_cave      # Diff + push changes on-chain
```

**WARNING:** Never re-run `zone:load` on an existing world to update stats. It calls `createMob()`/`createItem()` which increment counters and create DUPLICATE entities. Old data stays at old IDs. Use `item:sync` for items.

### Fresh Deploy (Rare — New World)

Only needed when creating a brand new world (new chain, or intentionally starting fresh).

```bash
cd packages/contracts
source .env.testnet && pnpm build && mud deploy --profile base-mainnet --alwaysRunPostDeploy
```

After a fresh deploy:
1. Note the new WORLD_ADDRESS and deploy block number from output
2. Run `EnsureAccess.s.sol` for cross-namespace access grants
3. Run `DeployClassSpells.s.sol`
4. Load zones: `bash -c 'set -a && source .env.testnet && set +a && WORLD_ADDRESS=<NEW> npx tsx scripts/zone-loader.ts dark_cave'`
5. Set maxPlayers: `cast send <WORLD> "UD__setMaxPlayers(uint256)" <N> --private-key $PRIVATE_KEY --rpc-url $RPC_URL`
6. Update `.env.testnet` (or `.env.mainnet`) with new WORLD_ADDRESS
7. Update Vercel env vars: `VITE_WORLD_ADDRESS` (use `printf` not `echo` to avoid trailing newline)
8. Update Railway indexer: `WORLD_ADDRESS` + `START_BLOCK`, then redeploy
9. Push to `dev` (or `main`) to trigger Vercel client rebuild
10. Verify the site loads with the new world

### Verify Function Selectors

After every `mud deploy`, verify function selectors in the deploy output. MUD deploy with nonce errors can silently skip transactions — if selectors don't match expectations, systems may not be registered correctly.

---

## 3. Client Deployment

### Auto-Deploy via Git (Standard)

Vercel auto-deploys from the connected GitHub repo:

| Git Action | Vercel Result | URL |
|------------|--------------|-----|
| Push to `dev` | Preview deployment | `https://beta.ultimatedominion.com` |
| Push to `main` | Production deployment | `https://ultimatedominion.com` |

No manual steps needed. Just push your branch.

### Build Scripts

```bash
cd packages/client

pnpm dev              # Local dev server (waits for Anvil on port 8545)
pnpm build:staging    # Build for beta (Vite --mode staging)
pnpm build            # Build for production
```

### Key Environment Variables (set in Vercel dashboard)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_WORLD_ADDRESS` | MUD world contract address | `0x99d01939F58B965E6E84a1D167E710Abdf5764b0` |
| `VITE_CHAIN_ID` | Target chain ID | `8453` |
| `VITE_PRIVY_APP_ID` | Privy authentication app ID | (set in dashboard) |

**Important:** Only `VITE_`-prefixed env vars are baked into the Vite client build. Env vars are baked at BUILD time — changing them in the Vercel dashboard requires a rebuild (push a commit or trigger manual redeploy).

### Gotchas

- `vercel --prod=false` creates a detached preview, NOT a branch deploy. Push to `dev` to update beta.
- `vercel redeploy` reuses old build artifacts — it will NOT pick up new env vars. Push a new commit instead (even `git commit --allow-empty -m "chore: trigger rebuild"`).
- Wrong `VITE_CHAIN_ID` causes cascading, misleading errors (React hooks errors, CORS failures) that look completely unrelated. Always check env vars first when debugging production errors.
- Vercel SSO/deployment protection on preview deployments can block public access and cause misleading JS errors. Check and disable if beta needs to be public.

---

## 4. API Deployment

The API (`packages/api/`) runs as Vercel serverless functions on the **ud-api** project.

| Item | Value |
|------|-------|
| Vercel Project | `ud-api` (`prj_x0ZxYA17MsLi8KICwsRt4dWaJgob`) |
| URL | `https://ultimate-dominion-api-iota.vercel.app` |
| Framework | Express-style handlers as Vercel serverless functions |
| Routing | Defined in `packages/api/vercel.json` |

Deploys automatically from git pushes (same repo, same branch convention as client). Endpoints include IPFS upload, session management, Stripe payments, drip faucet, and health check.

### Key Secrets (set in Vercel dashboard, NOT in repo)

- `PINATA_JWT` — IPFS uploads via Pinata
- `RESEND_API_KEY` — Email via Resend
- `RESEND_AUDIENCE_ID` — Email list management
- `PRIVATE_KEY` — Deployer key for on-chain operations
- Stripe keys for payment processing

### Cron Job

A daily drip endpoint runs at 14:00 UTC: `GET /api/drip` (configured in `vercel.json`).

---

## 5. Indexer Deployment

Custom MUD indexer that syncs Store events from on-chain to PostgreSQL, providing a REST API + WebSocket interface for the client.

| Item | Value |
|------|-------|
| Platform | Railway (Docker) |
| Package | `packages/indexer/` |
| Service ID | `61172447-73de-410a-943e-49ed3cc20d10` |
| URL | `https://indexer-production-d6df.up.railway.app` |
| Health | `GET /api/health` |
| Status | `GET /api/status` (full infra status) |
| Dashboard | `GET /dashboard` |

### Deploying New Code

Railway services are NOT connected to GitHub auto-deploy. Deploy manually:

```bash
# Step 1: Build locally (catches declaration emit errors that tsc --noEmit misses)
cd packages/indexer && pnpm build && cd ../..

# Step 2: Upload and deploy
railway up --service indexer --detach

# Step 3: Check build status IMMEDIATELY (railway up exits 0 even on failure)
RAILWAY_TOKEN=$(cat ~/.railway/config.json | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['token'])")
curl -s -H "Authorization: Bearer $RAILWAY_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"query { deployments(input: { serviceId: \"61172447-73de-410a-943e-49ed3cc20d10\" }) { edges { node { id status createdAt } } } }"}' \
  https://backboard.railway.com/graphql/v2 | python3 -c "import sys,json; [print(f'{e[\"node\"][\"id\"][:8]} {e[\"node\"][\"status\"]} {e[\"node\"][\"createdAt\"]}') for e in json.load(sys.stdin)['data']['deployments']['edges'][:3]]"

# Step 4: Once status is SUCCESS, verify live endpoint
curl -s https://indexer-production-d6df.up.railway.app/api/health
```

**Never use `railway redeploy`** — it reuses the old image and will NOT include your new code.

### Key Environment Variables (set in Railway dashboard)

| Variable | Description |
|----------|-------------|
| `WORLD_ADDRESS` | Must match the deployed world |
| `START_BLOCK` | Block number of world deployment |
| `RPC_HTTP_URL` | Self-hosted RPC (`https://rpc.ultimatedominion.com?token=...`) |
| `DATABASE_URL` | Auto-provisioned Railway Postgres |
| `CORS_ORIGINS` | Allowed origins |
| `CHAIN_ID` | `8453` |
| `RESEND_API_KEY` | For email alerts |
| `ALERT_EMAIL` | Alert recipient |

### After Contract Upgrades

For standard system upgrades, no indexer changes needed — the indexer auto-syncs new events. Just verify health:

```bash
curl -s https://indexer-production-d6df.up.railway.app/api/health
```

For fresh world deploys, update `WORLD_ADDRESS` + `START_BLOCK` in Railway env vars and redeploy. May need a DB reset if schema changed significantly.

Schema changes are handled dynamically — the indexer discovers tables from Postgres automatically.

---

## 6. Relayer Deployment

Self-hosted transaction relayer with a pool of 5 EOA wallets. Pays gas on behalf of players using EIP-7702 embedded wallets.

| Item | Value |
|------|-------|
| Platform | Railway (Docker) |
| Package | `packages/relayer/` |
| Service ID | `dd62995a-cab5-4a98-b217-0c7bf111364e` |
| URL | `https://8453.relay.ultimatedominion.com` |
| Health | `GET /` (returns pool status + rpcStatus) |

### Deploying New Code

Same pattern as indexer:

```bash
# Step 1: Build locally
cd packages/relayer && pnpm build && cd ../..

# Step 2: Upload and deploy
railway up --service relayer --detach

# Step 3: Check build status
RAILWAY_TOKEN=$(cat ~/.railway/config.json | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['token'])")
curl -s -H "Authorization: Bearer $RAILWAY_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"query { deployments(input: { serviceId: \"dd62995a-cab5-4a98-b217-0c7bf111364e\" }) { edges { node { id status createdAt } } } }"}' \
  https://backboard.railway.com/graphql/v2 | python3 -c "import sys,json; [print(f'{e[\"node\"][\"id\"][:8]} {e[\"node\"][\"status\"]} {e[\"node\"][\"createdAt\"]}') for e in json.load(sys.stdin)['data']['deployments']['edges'][:3]]"

# Step 4: Verify
curl -s https://8453.relay.ultimatedominion.com/ | python3 -c "import sys,json; d=json.load(sys.stdin); print('rpcStatus:', d.get('rpcStatus',{}).get('active','MISSING'))"
```

### Key Environment Variables (set in Railway dashboard)

| Variable | Description |
|----------|-------------|
| `RELAYER_PRIVATE_KEYS` | 5 EOA private keys, comma-separated |
| `RPC_URL` | Self-hosted RPC |
| `RPC_AUTH_TOKEN` | Bearer token for self-hosted RPC |
| `RPC_FALLBACK_URL` | Alchemy fallback URL |
| `ALLOWED_WORLD_ADDRESSES` | Comma-separated world addresses to relay for |
| `CHAIN_ID` | `8453` |
| `CORS_ORIGINS` | Allowed origins |
| `WORLD_ADDRESS` | For gas charging |
| `GOLD_TOKEN` | Gold ERC20 address (for gas charging) |

### Wallet Pool

The relayer uses 5 EOA wallets for parallel transaction submission. The first key is the primary (used for gas charging). If wallets run low on ETH:

```bash
cast send <primary_relayer_address> --value 0.05ether --private-key <funding_key> --rpc-url https://rpc.ultimatedominion.com
```

---

## 7. Uniswap V3 Pool (GasStation)

Allows players to swap Gold for ETH (gas) via an on-chain Uniswap V3 pool.

### Beta Pool (Current)

| Item | Value |
|------|-------|
| Pool | `0xEfD246617d0af80a6A6cF2B602b44CF37c58a057` |
| Token0 (Gold) | `0x34a865B51D37F4f0Ea1BF116F8D20b6Bb69cBb81` |
| Token1 (WETH) | `0x4200000000000000000000000000000000000006` |
| Liquidity | Minimal test pool (5K gold + 0.02 ETH) |

### Production Pool

Not yet deployed. Steps when ready:

1. Set GasStationSwapConfig via `cast send` (router, WETH address, pool fee, gold-per-gas-charge)
2. Grant Gold namespace access via `EnsureAccess.s.sol`
3. Mint gold to deployer for pool seeding
4. Deploy pool via `DeployGoldPool.s.sol`
5. Verify pool liquidity and config
6. Fund with meaningful liquidity (gold + ETH)

### Key Uniswap Addresses (Base)

| Contract | Address |
|----------|---------|
| Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| PositionManager | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1` |
| SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| WETH | `0x4200000000000000000000000000000000000006` |

---

## 8. Pre-Deploy Checklist

Before deploying contracts to any live environment:

- [ ] All changes committed — **never deploy from a dirty working tree** (uncommitted changes persist on-chain even if source isn't committed, causing confusion in future sessions)
- [ ] `forge test` passes
- [ ] `pnpm build` in `packages/client` succeeds (no build errors)
- [ ] On `dev` branch for beta, `main` branch for production
- [ ] Correct `.env` file has correct `WORLD_ADDRESS` (double-check — wrong address = wrong world)
- [ ] Compiler settings unchanged (optimizer_runs, via_ir, Solidity version) — or intentionally changed with awareness that bytecodes will differ
- [ ] If new cross-namespace systems added: `EnsureAccess.s.sol` updated BEFORE deploy
- [ ] If modifying MUD table schemas: checked for live player data, written migration script if needed
- [ ] For production: explicit confirmation from Michael

---

## 9. Post-Deploy Verification

Run these after every deployment:

### Contracts

```bash
# Verify function selectors in mud deploy output (check for skipped transactions)

# Verify EnsureAccess ran (auto-chained, but verify):
# Check deploy output for EnsureAccess broadcast

# If items changed:
pnpm item:verify:testnet dark_cave  # Should show no diffs (or expected diffs)
```

### Indexer

```bash
# Health check — verify sync lag is low
curl -s https://indexer-production-d6df.up.railway.app/api/health

# Full infra status
curl -s https://indexer-production-d6df.up.railway.app/api/status
```

### Relayer

```bash
# Pool status + RPC connectivity
curl -s https://8453.relay.ultimatedominion.com/
```

### Base RPC

```bash
# Self-hosted node responding
curl -s "https://rpc.ultimatedominion.com?token=<RPC_TOKEN>" \
  -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}'
```

### Client

```bash
# Verify deployment
curl -s https://beta.ultimatedominion.com/ | head -5   # Should return HTML, not auth wall
curl -s https://ultimatedominion.com/ | head -5
```

### Smoke Test (In-Game)

After contract upgrades, manually verify in the game client:
1. Character loads correctly
2. Combat works (start fight, take turns, complete)
3. Shop works (buy/sell items)
4. Inventory displays correctly
5. Gold balance updates
6. Map navigation works

---

## 10. Rollback

### Contract Rollback

MUD system upgrades create NEW contract addresses. The old system contracts still exist on-chain. To rollback:

1. **Revert to previous commit**: `git checkout <previous-commit> -- packages/contracts/`
2. **Redeploy**: `pnpm deploy:testnet` (or `:mainnet`) — this will deploy the old bytecodes back as new system addresses
3. **Re-run EnsureAccess**: Access grants point to new addresses, so they need refreshing
4. **Verify**: Check function selectors match the pre-upgrade state

**Data considerations:** Player data stored in MUD tables is NOT affected by system upgrades/rollbacks (tables are separate from systems). However, data keyed by `address(this)` in system contracts IS orphaned when systems change — rolling back creates yet another new address. Check if any data was written to `address(this)` during the broken deploy.

### Client Rollback

Vercel keeps deployment history. Options:
- Push a revert commit to the branch
- In Vercel dashboard: promote a previous deployment to production
- `vercel rollback` CLI (rolls back to previous production deployment)

### Relayer / Indexer Rollback

Railway keeps deployment history:
1. Open Railway dashboard
2. Find the last working deployment
3. Click "Redeploy" on that specific deployment (this IS safe for Railway — it reruns the same image)

Or deploy the previous version:
```bash
git checkout <previous-commit> -- packages/relayer/
cd packages/relayer && pnpm build && cd ../..
railway up --service relayer --detach
```

### Emergency: Pause the World

If something is critically broken and players are losing assets:

```bash
source .env.testnet && cast send $WORLD_ADDRESS "UD__setPaused(bool)" true \
  --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

This halts all game systems. Unpause after the fix:

```bash
cast send $WORLD_ADDRESS "UD__setPaused(bool)" false \
  --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

---

## Complete Upgrade Deploy Playbook (Quick Reference)

```
1. git status                          # Verify clean working tree
2. forge test                          # All tests pass
3. pnpm build (client)                 # No build errors
4. pnpm deploy:mainnet                 # System contracts + EnsureAccess
5. pnpm item:sync:mainnet dark_cave    # If zone JSON changed
6. curl indexer /api/health            # Indexer syncing
7. curl relayer /                      # Relayer healthy
8. Smoke test in-game                  # Combat, shop, drops
9. git add & commit deploy artifacts   # worlds.json, broadcast/
```

## CI/CD Pipeline

### Pipeline Flow

`dev` is the integration branch. All work lands on `dev` first, gets tested on beta, then promoted to `main` (production).

```
Feature branch → PR to dev → CI + Smoke → Merge to dev
                                              ↓
                                    Beta client rebuilds (Vercel)
                                    [If contracts] Deploy-beta workflow
                                    Playtest on beta.ultimatedominion.com
                                              ↓
                                    PR dev → main → CI → Merge
                                              ↓
                                    Prod client rebuilds (Vercel)
                                    [If contracts] pnpm deploy:mainnet
```

**Day-to-day:**
- Branch off `dev` for all work
- Push/PR to `dev` — CI + smoke tests run automatically
- Only merge `dev` → `main` when beta is verified
- Quick hotfixes can go straight to `main` if prod is broken

### Testing Tiers

| Tier | What | Trigger | Duration |
|------|------|---------|----------|
| **1** | Client vitest, indexer vitest, relayer vitest, pure Solidity unit tests | Push/PR to main or dev | ~3 min |
| **2** | PostDeploySmoke + fork-mode integration tests against beta world | Push/PR to dev | ~2 min |
| **2.5** | PostDeploySmoke against beta after contract deploy | After deploy-beta workflow | ~1 min |
| **3** | Manual playtest on beta.ultimatedominion.com | After beta is live | Variable |

### GitHub Actions Workflows

| Workflow | File | Trigger |
|----------|------|---------|
| CI | `.github/workflows/ci.yml` | Push to main/dev, PRs |
| Smoke Tests | `.github/workflows/smoke.yml` | Push to dev |
| Deploy Beta | `.github/workflows/deploy-beta.yml` | Manual (workflow_dispatch) |
| Sync main→dev | `.github/workflows/sync-dev.yml` | Weekly Monday 06:00 UTC, manual |

### Required GitHub Secrets

| Secret | Used by |
|--------|---------|
| `BETA_WORLD_ADDRESS` | smoke.yml, deploy-beta.yml |
| `BASE_RPC_URL` | smoke.yml, deploy-beta.yml |
| `DEPLOYER_PRIVATE_KEY` | deploy-beta.yml |

### Local Test Commands

```bash
# Client tests
pnpm --filter client run test

# Indexer tests
pnpm --filter @ud/indexer run test

# Relayer tests
pnpm --filter @ud/relayer run test

# Pure Solidity unit tests (no RPC needed)
cd packages/contracts && pnpm test:unit

# Fork-mode tests against beta
cd packages/contracts && pnpm test:fork:beta
```

### Deploy Playbook (Updated)

```
# Development (daily)
1. git checkout -b feat/my-change dev  # Branch off dev
2. Make changes, commit
3. Push branch, open PR to dev         # CI + Smoke run on PR
4. Merge to dev                        # Beta client rebuilds on Vercel
5. [If contracts changed] Run deploy-beta workflow in GitHub Actions
6. Playtest on beta.ultimatedominion.com

# Promotion to production
7. Open PR: dev → main                 # CI runs
8. Merge to main                       # Prod client rebuilds on Vercel
9. [If contracts changed] pnpm deploy:mainnet  # Manual, with confirmation
10. PostDeploySmoke against prod       # Verify

# Hotfix (prod is broken)
1. Push fix directly to main           # Bypass normal flow
2. Sync back: git checkout dev && git merge main && git push origin dev
```

---

*Last updated: March 17, 2026*
