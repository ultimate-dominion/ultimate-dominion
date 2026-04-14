---
paths:
  - packages/contracts/script/**
  - packages/contracts/.env*
  - packages/contracts/mud.config.*
  - packages/contracts/worlds.json
  - packages/indexer/**
  - "**/deploy*"
  - "**/PostDeploy*"
  - "**/EnsureAccess*"
  - "**/zone-loader*"
---

# Deploy & Environment Rules

## Environment Separation (CRITICAL — incident 2026-03-30)
- `beta.ultimatedominion.com` = Base Mainnet (beta world address)
- `ultimatedominion.com` = Base Mainnet (production world address)
- Both on chain 8453, distinguished ONLY by WORLD_ADDRESS.
- **`.env` MUST default to beta.** Production requires explicit `.env.mainnet`.
- **Bare commands are blocked.** `zone:load`, `item:sync`, `item:verify` require `:testnet` or `:mainnet` suffix.
- NEVER add the production world address to `.env`. If you see it there, fix it immediately.

## Script Execution Safety (CRITICAL — incident 2026-03-30)
- **NEVER** run `source .env.testnet && npx tsx ...` — `source` does NOT export vars to subprocesses.
- **ALWAYS** use pnpm scripts (`pnpm zone:load:testnet`) or `bash -c 'set -a && source .env.testnet && set +a && npx tsx ...'`
- **ALWAYS** verify the world address in the first lines of script output before continuing.
- Production world: `0x99d01939F58B965E6E84a1D167E710Abdf5764b0` — all TS scripts now require `--confirm-production` flag.
- Beta world: `0xDc34AC3b06fa0ed899696A72B7706369864E5678`

## Branch Convention
| Branch | Target | Confirm? |
|---|---|---|
| `dev` | Beta | No |
| `main` | Production | **Always** |
| Feature branch | Ask user | Yes |

## MUD Deploy Safety
- **Always use `--worldAddress`** when deploying to existing chains. Without it, compiler changes can trigger a fresh world deploy.
- `mud deploy` with nonce errors can silently skip transactions — verify function selectors after every deploy.
- System upgrades create NEW contract addresses — re-run `EnsureAccess.s.sol` after every deploy.
- Always run PostDeploy seed/config scripts after a fresh deploy.
- Backup world state before mainnet upgrades.

## PostDeploy Is All-or-Nothing
PostDeploy.s.sol runs as a single transaction. If ANY line reverts, ALL access grants are lost. This is why `deploy:testnet` and `deploy:mainnet` auto-chain `ensure-access` after `mud deploy`.

When adding a new system that writes cross-namespace: update `EnsureAccess.s.sol` `ensureAll()`.

## worlds.json blockNumber
- Must be the ACTUAL world deployment block. If set too high, new clients miss seed data.
- Use binary search on `cast code` to find the exact deployment block.

## RPC for Deploys
- Base mainnet: use `base-rpc.publicnode.com` (supports 16K+ block ranges).
- dRPC free tier limits to 10K blocks — `mud deploy` will fail once gap exceeds 10K.

## Verification
- Run `pnpm build` in packages/client before pushing.
- Verify function selectors after any `mud deploy`.
- Never deploy to mainnet without testnet verification first.

## Pre-Deploy Required Reading
**BEFORE any `mud deploy` or `pnpm deploy:*`**, read these files for known failure patterns:
1. `~/.claude/projects/-Users-michaelorourke-ultimate-dominion/memory/game/mud-gotchas.md` — table name collisions, schema immutability, access control traps, bytecode issues
2. `~/.claude/projects/-Users-michaelorourke-ultimate-dominion/memory/infra/deploy-guide.md` → "Known Failure Patterns" table — EnsureAccess cache, CreateCollision, etc.

## Railway Service Deployment (CRITICAL — know your target)

Railway has SEPARATE beta and prod services. The naming is misleading.

| Service | Railway name | Service ID | Domain (current) |
|---|---|---|---|
| **Indexer (prod)** | `indexer` | `61172447-73de-410a-943e-49ed3cc20d10` | `indexer-production-d6df.up.railway.app` |
| **Indexer (beta)** | `indexer-beta-us` | `390336a9-3856-4ace-9949-f28fa1c4aa3d` | `indexer-beta-us-production.up.railway.app` |
| **Indexer (legacy)** | `indexer-beta` | `de09dafa-a4c1-4ad8-8873-67a7ae885b90` | `indexer-prod-production-45cf.up.railway.app` (NOT used by beta client) |
| **Relayer (prod)** | `relayer` | `dd62995a-cab5-4a98-b217-0c7bf111364e` | `8453.relay.ultimatedominion.com` |
| **Relayer (beta)** | `relayer-beta` | `c7a2c1e4-4bb8-4ce3-aa54-9a38b1a3d067` | `relayer-beta-us-production.up.railway.app` |

### How `railway up` actually works (read this before debugging a failed deploy — confirmed 2026-04-13)

- `railway up` uploads the files from the **main checkout working tree**, not the current worktree you run it from. Verified empirically: running from `.claude/worktrees/movement-monster-display` (pkg version 0.3.1) produced a build that logged `@ud/indexer@0.3.0` — the version sitting on disk in the main checkout. The worktree's files were completely ignored by the upload.
- Practical consequence: **to deploy a commit that's on a feature branch, the main checkout must have that commit's files on disk.** Either merge to the main checkout's current branch, or check out the target branch/SHA in the main checkout before running `railway up` (detached HEAD is fine if another worktree holds the branch).
- Railway builds using the service's configured **root directory** and Dockerfile. For `indexer-beta-us` / `indexer`, the service has `rootDirectory = packages/indexer` and uses `packages/indexer/Dockerfile`. **Do not pass `--path-as-root`** — it bypasses the service config and makes Railway fall back to RAILPACK, which fails.
- The upload context size limit is ~100 MB. Anything close to that will 413. The relevant ignore list is the main checkout's `.railwayignore` + `.gitignore`.

### Pre-deploy sequence (exact steps — follow in order)

```bash
# 1. Make sure the commit you want is reachable on origin/dev (or wherever)
cd ~/ultimate-dominion/.claude/worktrees/<your-worktree>
git push origin <branch>              # get the fix onto the remote

# 2. Switch to the main checkout
cd ~/ultimate-dominion
git fetch origin

# 3. Stash any uncommitted work (leave untracked files alone)
git stash push -m "pre-deploy $(date +%F)" -- <modified-tracked-files>

# 4. Check out the target SHA. If dev is locked by another worktree,
#    use a detached HEAD at the remote SHA.
git checkout <sha-or-branch>           # or: git checkout origin/dev

# 5. Preflight
bash scripts/railway-preflight.sh      # must print < 50 MB and exit 0
railway status                         # must show the expected service

# 6. Deploy
railway up --detach

# 7. Verify (see "Verify after deploy" below). If the build log shows
#    the wrong @ud/indexer version, the upload came from a stale main
#    checkout — fix that before anything else.

# 8. Restore main checkout
git checkout <original-branch>
git stash pop
```

### Deploy commands (the only commands you should run)
- Beta: `railway service indexer-beta-us && railway up --detach`  (service ID: `390336a9`)
- Prod: `railway service indexer && railway up --detach`  (**MUST ASK MICHAEL FIRST**)

### Required rules
- NEVER use `railway redeploy` — it reuses cached images and doesn't pull fresh code.
- ALWAYS bump `packages/indexer/package.json` version before deploying (Docker cache busting). Note: `health.ts` hardcodes a separate version string that does NOT auto-update; don't use the `/api/health` `version` field as proof of fresh code. Verify via the Railway **build logs** instead (they print `> @ud/indexer@X.Y.Z build`).
- ALWAYS run `scripts/railway-preflight.sh` before `railway up` to catch `.railwayignore` rot.
- ALWAYS verify with `railway status` that the linked service is correct before `railway up`.
- ALWAYS verify with the Railway GraphQL **build logs** (not the live `/api/health`) that the right version was built.

### If a deploy fails: the debugging order
1. **413 / "Payload Too Large"** → run `scripts/railway-preflight.sh` from the **main checkout**. Find the bloat, add it to `.railwayignore`. Do not try `--path-as-root`, `/tmp/` sub-packages, or any upload-root workaround — those trigger RAILPACK fallback.
2. **Railway used `RAILPACK` instead of the Dockerfile** → you passed `--path-as-root` or pointed at `packages/indexer` as the upload root. Go back to running `railway up --detach` from the repo root of the main checkout.
3. **Build log shows the wrong version / old code** → the main checkout's working tree is on the wrong branch/SHA. `railway up` uploads files from the main checkout, not from your worktree. Checkout the target SHA in the main checkout (detached HEAD is fine) and redeploy.
4. **Build failed inside the Dockerfile** → read the build logs, do not bump versions blindly.
5. **Deployment succeeds but clients don't see changes** → wrong domain. `indexer-beta-us-production.up.railway.app` is the beta client's URL; other indexer services exist but are not wired up. See the service table above.

**Verify after deploy:**
```bash
# Check build status
RAILWAY_TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.railway/config.json'))['user']['token'])")
# Beta:
curl -s -H "Authorization: Bearer $RAILWAY_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"query { deployments(input: { serviceId: \"390336a9-3856-4ace-9949-f28fa1c4aa3d\" }) { edges { node { id status createdAt } } } }"}' \
  https://backboard.railway.com/graphql/v2 | python3 -c "import sys,json; [print(f'{e[\"node\"][\"id\"][:8]} {e[\"node\"][\"status\"]}') for e in json.load(sys.stdin)['data']['deployments']['edges'][:3]]"
# Verify code is live:
curl -s https://indexer-beta-us-production.up.railway.app/api/health
# Prod: swap service ID to 61172447-73de-410a-943e-49ed3cc20d10
```

## Smart Contract Upgrade Checklist (ALWAYS follow)

Full playbook with failure patterns: `~/.claude/projects/-Users-michaelorourke-ultimate-dominion/memory/infra/deploy-guide.md` → "Complete Upgrade Deploy Playbook"

**Before deploy:**
1. Commit all changes — NEVER deploy from dirty tree
2. Run `verify-onchain.ts` — sim vs on-chain must be 0 mismatches
3. Check no players in active combat (schema changes break mid-fight encoding)
4. If schema changed: expect ALL systems to redeploy (new addresses, grants refresh)
5. If new cross-namespace access needed: update EnsureAccess.s.sol FIRST
6. If effect types changed (e.g. MagicDamage→StatusEffect): deploy when no one is using that effect

**After deploy:**
7. `pnpm deploy:mainnet` auto-chains EnsureAccess — verify it ran
8. Run any data scripts (DeployClassSpellsV2, item-sync, effect-sync, etc.)
9. Test incrementally: basic combat → spells → shop → marketplace
10. Check indexer health — reindex if schema changed
11. Monitor relayer logs for `Access_Denied` errors for 5 min
12. Commit deploy artifacts
