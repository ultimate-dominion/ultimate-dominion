# Handoff — Movement Monster Display / Beta Ghost Cleanup

## Restart Point

- workstream: `movement-monster-display`
- branch: `fix/movement-monster-display`
- head: `2986663f85a3`
- root: `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/movement-monster-display`
- status: ready to resume
- deploy state: beta DB repaired; code pushed to `dev`; Railway beta indexer deploy pending after failed latest attempt

## What Changed

Movement monster display sync hardening is committed and pushed to `dev`.

Follow-up beta indexer fix:
- `packages/indexer/src/api/snapshot.ts` now treats `PositionV2` rows at `(0,0)` as cleared/dead in the snapshot first pass.
- `packages/indexer/src/api/snapshot.test.ts` covers stale `Spawned=true` plus cleared `PositionV2`, ensuring dependent `Stats` are filtered.
- `packages/indexer/scripts/fix-ghost-monsters.ts` is now beta-only, dry-run by default, chain-verified, has no prod DB fallback, and uses project RPC env vars (`RPC_URL`, `RPC_HTTP_URL`, or `MONITOR_BASE_NODE_URL`) instead of public Base RPCs.
- `packages/indexer/package.json` bumped to `0.3.1` for Railway Docker cache busting.

Commits:
- `4242f24f fix: harden movement monster display sync`
- `c8ac3ed2 docs: note movement monster sync hardening`
- `a5e1d931 fix: tighten monster display sync guards`
- `69415623 docs: note monster sync guard follow-up`
- `10db5e03 fix: preserve monster selector bigint hp typing`
- `f9ca4052 docs: note monster selector type fix`
- `783c9b50 fix: clear beta ghost monster snapshots`
- `2986663f chore: bump indexer for beta ghost fix`

## Beta DB Repair

Applied successfully to beta Postgres:
- World: `0xDc34AC3b06fa0ed899696A72B7706369864E5678`
- Service/env source: `indexer-beta-us`
- DB service: `postgres-beta-us`
- Result: `164/164` chain-verified ghost rows repaired at block `44660659`
- RPC read errors: `0`

Important: the ghosts were not `Spawned=false` on-chain. The chain state was `Spawned=true` with `PositionV2=(0,0,0)`, so the client was correctly evicting cleared-position monsters and the beta indexer DB had stale nonzero `PositionV2` rows.

## Verification

Passed:
- `pnpm --filter @ud/indexer run build`
- `pnpm --filter @ud/indexer exec vitest run src/api/snapshot.test.ts`
- Earlier client movement sync targeted tests passed before this indexer follow-up.

Known unrelated state:
- Full client CI remains blocked by pre-existing client typecheck/test failures outside this workstream.

## Railway Deploy Status

Not live yet.

Current live beta indexer remains:
- deployment `78dc2765-bd40-490c-8c5d-986e22d2fe46`
- created `2026-04-09T13:29:45.724Z`
- builder `DOCKERFILE`
- rootDirectory `packages/indexer`

Latest attempted deploy:
- deployment `a9ef5112-4742-4995-a2d7-14e9ec4b7827`
- status `FAILED`
- builder `RAILPACK`
- created `2026-04-13T20:17:36.829Z`

What failed:
- `railway up --service indexer-beta-us --detach . --path-as-root` from the worktree uploaded the whole repo and hit `413 Payload Too Large`.
- Deploying `/tmp/ud-indexer-beta-deploy-2986663f/packages/indexer --path-as-root` uploaded a small context but Railway used `RAILPACK` instead of the existing Dockerfile/rootDirectory config and the deployment failed.

## Next Steps

1. Deploy commit `2986663f` to Railway service `indexer-beta-us` using the service's normal `packages/indexer` Dockerfile/rootDirectory config.
2. Verify `https://indexer-beta-us-production.up.railway.app/api/health`.
3. Fetch a fresh snapshot from `https://indexer-beta-us-production.up.railway.app/api/snapshot` and confirm cleared `PositionV2` rows are filtered.
4. Have Michael reload beta and confirm ghost creatures no longer appear/disappear while moving.

## Notes

Do not use public Base RPCs. Relevant memory: `feedback_rpc_ordering.md` says `rpc.ultimatedominion.com` / the project Base node is primary, Alchemy fallback only, no free public RPCs. The earlier repair dry-run with `https://mainnet.base.org` was aborted before running. The successful dry-run/apply used the `indexer-beta-us` Railway RPC env plus the `postgres-beta-us` public TCP proxy.

The worktree is clean and `fix/movement-monster-display` equals `origin/dev` at `2986663f`.
