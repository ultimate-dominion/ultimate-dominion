# Ultimate Dominion — Shared Agent Workflow

This file is the shared workflow for Codex and Claude in this repo. Keep `CLAUDE.md` and `.claude/rules/` as the deep project reference; use this file for the common operating flow.

## Startup Contract

### Must Read

1. `SESSION.md` in the main checkout root
2. `CLAUDE.md`
3. `git worktree list`
4. `git status -sb`

If any required file or command output is missing, say so before starting implementation work.

### Read On Demand

- Relevant `.claude/rules/*.md` for the area being changed
- Relevant memory topics under `~/.claude/projects/-Users-michaelorourke-ultimate-dominion/memory/`
- Strategic docs under `~/Documents/ultimate-dominion/docs/`

### Live State

- `SESSION.md` in the main checkout root
- `HANDOFF_*.md` in the main checkout root
- Active worktrees and branch ownership
- Current deploy state: local, beta, prod

If `SESSION.md` and the live worktree list disagree about what is active, flag that before starting implementation work.

### Archive

- `~/Documents/ultimate-dominion/docs/handoffs/`
- Older memory topics that are not relevant to the current task

## Read Order

1. `SESSION.md` in the main checkout root
2. `CLAUDE.md`
3. The relevant `.claude/rules/*.md` file for the files you will touch
4. The relevant project memory topics under `~/.claude/projects/-Users-michaelorourke-ultimate-dominion/memory/`

## Session Start

- Run `git worktree list` and `git status -sb`.
- Compare `SESSION.md` against the live worktree list and flag any mismatch.
- Confirm whether you are in the main checkout or a named worktree.
- If the task needs code changes, switch into or create the correct worktree first.
- Treat the main checkout as review/prod-ops context unless the task clearly belongs there.
- Load only the domain memory you need. Do not read the full memory tree.

## Domain Rules

Domain-specific rules live in `.claude/rules/`. Claude auto-loads these based on file patterns; **Codex must read the relevant file manually before working in that domain.**

| Domain | Rules file | Read when touching... |
|--------|-----------|----------------------|
| Game systems, balance, items, combat | `.claude/rules/game.md` | `packages/contracts/src/systems/`, `items.json`, `effects.json`, `monsters.json` |
| Frontend, client UX | `.claude/rules/client.md` | `packages/client/**` |
| API, relayer | `.claude/rules/api.md` | `packages/api/**`, `packages/relayer/**` |
| Indexer, Railway | `.claude/rules/indexer.md` | `packages/indexer/**` |
| Solidity, MUD contracts | `.claude/rules/solidity.md` | `packages/contracts/**/*.sol`, `mud.config.*` |
| Deploys, env, infra | `.claude/rules/deploy.md` | deploy scripts, `.env*`, `worlds.json`, Railway/Vercel ops |

## Core Rules

- Every code change needs tests or the strongest relevant verification the repo supports, and the result must be reported honestly.
- `items.json`, `effects.json`, and domain docs remain source-of-truth surfaces. Follow the documented sync/verify flows.
- Active implementation work happens in a named worktree/workbranch, not in the main checkout.
- Workbranches/worktrees are durable session state. Never delete, prune, or remove one unless Michael explicitly asks.
- Explain work in plain English by default. Lead with player impact, product risk, and whether the change is only local, on beta, or on prod.
- Do not expect Michael to speak like an engineer. He is technical, but the reporting default is plain language.
- Local verification means the code builds successfully unless a task explicitly requires stronger local checks.
- Default shipping path for code changes: verify local build, deploy to beta on `dev`, then run the relevant integration tests there before calling the change ready.
- UD does not use local Anvil as the default validation path. Some legacy package scripts still mention `127.0.0.1:8545`; do not reach for those during normal work. Read `docs/operations/DEPLOY_RUNBOOK.md`, compile locally, then validate chain behavior on beta via fork/smoke/manual beta playtests.
- Commit after each logical unit with conventional commits.
- Do not sweep unrelated files into a commit.
- Do not push without approval.
- Keep mobile responsiveness in scope for frontend work.

## Ask First

- Any push to `main`
- Any production deploy
- Any `vercel --prod` equivalent or production Vercel action
- Railway production service deploys or env-var changes
- Security/access-control changes
- Spending money
- Deleting files, branches, records, or production resources
- Force push

## Project Memory

- Project memory root: `~/.claude/projects/-Users-michaelorourke-ultimate-dominion/memory/`
- Strategic docs: `~/Documents/ultimate-dominion/docs/`
- Handoff archive: `~/Documents/ultimate-dominion/docs/handoffs/`

Start with `MEMORY.md`, then read only the relevant topic files:
- `memory/game/` for balance, systems, client sync, design, and game gotchas
- `memory/infra/` for deploys, Railway, relayer, recovery, and runbooks
- `feedback_*.md` for validated corrections
- `gotcha_*.md` for sharp edges and failure patterns

## Handoff

- Update `SESSION.md` before ending a workstream.
- Preferred handoff artifact: `~/Documents/ultimate-dominion/docs/handoffs/YYYY-MM-DD_[task-slug].md`
- If you create `HANDOFF_*.md` in repo root for compatibility with existing Claude tooling, archive it immediately after writing it.
- Include branch/worktree, commit hashes, decisions made, blockers, exact next steps, deploy state, and anything surprising.

<!-- TEMPER_RUNTIME:BEGIN -->
## Temper

Temper is installed as the operating layer for this repo.

- Read `.temper/assistants/shared-canon.json` before major design or release guidance.
- Use `pnpm exec temper coach --cwd . --json --intent "<what you're designing>"` before major design, balance, UX, infra, security, or release guidance.
- Use `pnpm exec temper ship lite --cwd . --intent "<what you just built>"` for narrow implementation confidence.
- Use `pnpm exec temper ship full --cwd . --intent "<summary>"` for player-facing, infra, economy, security, or multi-system work.
- Read `SESSION.md` first and use `pnpm exec temper handoff --cwd . --slug <slug> --summary "<summary>" --next "<next step>"` when leaving a workstream.
- Treat `temper.config.json`, `.temper/assistants/shared-canon.json`, and `.temper/assistants/*.md` as the local Temper operating contract.
- Promote gated full steps explicitly with `pnpm exec temper ship full --cwd . --promote <step>` when you intend to run them.
<!-- TEMPER_RUNTIME:END -->
