# Ultimate Dominion — Rules

## Design Filter
Does this make the world more permanent, more player-driven, and more worth coming back to in a year? (Full manifesto: `packages/client/src/pages/Manifesto.tsx`)


## Testing
Every code change MUST have tests — happy paths, unhappy paths, edge cases. No exceptions.

## Item & Drop Rate Changes
`items.json` is the SINGLE SOURCE OF TRUTH. `effects.json` likewise. Never bypass with cast/scripts.
Flow: edit JSON → commit → `item-sync dark_cave --update` → verify (0 mismatches) → stop if verify fails.
After any `mud deploy`: run item-sync + effect-sync to verify, tag the deploy, run drop-sim.

## Documentation Consistency
`docs/` is source of truth for game design. Read relevant docs before major changes. Flag contradictions. Update docs after changes.

## Scope Control
One feature or fix per branch/commit. If it touches >3 systems, plan first.

## Git Workflow
Conventional commits. Only commit current session work. Don't push without asking.

## Feature Flow (Beta → Prod)
- Features land on `dev` first → PR to `main` for production. `main` has branch protection.
- Hotfixes: 1-commit PR to `main`, `sync-dev.yml` syncs back to dev.
- Unreleased features: gate with `SHOW_Z2` from `packages/client/src/lib/env.ts` (`!IS_PRODUCTION`).

## Autonomy
**Do freely:** read, search, test, deploy to beta, fix obvious bugs, run forge scripts on testnet.
**Must ask:** push to main, deploy to prod, spend money, delete resources, change env vars, security changes, force push.

## Session Management
- `SESSION.md` (repo root) is a multi-task log — append new tasks, remove finished ones.
- Each entry: branch, task, next step, blockers. Keep it under 20 lines.
- Learnings go to memory topic files immediately, not SESSION.md.
- On session start: read SESSION.md + `git status` + `git log --oneline -5` to orient.

## Learn From Mistakes
After any error taking >1 attempt: write root cause + solution to UD-scoped memory immediately.

## After Any Deploy
Tag: `git tag deploy-prod-$(date +%Y%m%d-%H%M)`. Verify items + effects survived. Run drop-sim.

## Reference (read on demand, not here)
- Tech stack, service URLs, world addresses → UD-scoped memory (`reference_production_addresses.md`, `infra/tools.md`)
- Game docs index → `docs/INDEX.md`
- Domain rules → `.claude/rules/` (auto-loaded per file type)
- Deploy runbook → `docs/operations/DEPLOY_RUNBOOK.md`
