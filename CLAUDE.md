# Ultimate Dominion - Project Memory

## Game Manifesto (Design North Star)

Full manifesto: `packages/client/src/pages/Manifesto.tsx`. Core principles: permanent world (no shortcuts), player-authored stories (emergent > scripted), provable on-chain ownership, invisible tech (no crypto jargon in UI), meaningful consequences, fair economics. **Filter: Does this make the world more permanent, more player-driven, and more worth coming back to in a year?**

## Rules

### Testing
**CRITICAL**: Every code change MUST have tests — happy paths, unhappy paths, and edge cases. No exceptions. We deploy directly to production; untested code goes straight to players.

### Item & Drop Rate Changes
**CRITICAL**: `items.json` is the SINGLE SOURCE OF TRUTH for all item stats, drop rates, and inventories. Violations of this rule have caused production bugs multiple times.

**The only allowed flow:**
1. Edit `items.json` (or `monsters.json` for inventories)
2. Commit the change
3. Run `item-sync dark_cave --update` to push to chain
4. Run `item-sync dark_cave` (verify mode) — must show 0 mismatches
5. If verify fails, STOP and investigate

**NEVER do any of these:**
- Change drop rates on-chain via `cast send` or one-off scripts without updating items.json first
- Run `item-sync --update` from uncommitted changes
- Manually set Items table values that bypass items.json
- Deploy PveRewardSystem from uncommitted code

**After any `mud deploy` that touches PveRewardSystem:**
- Run `item-sync dark_cave` to verify rates survived the upgrade
- Tag the deploy: `git tag deploy-prod-$(date +%Y%m%d-%H%M)`
- Run `npx tsx scripts/drop-sim.ts` to confirm player experience matches expectations

**Current known issues (as of 2026-03-19):**
- items.json is STALE: R3=3 (chain=4), R4=2 (chain=3), HP pots not updated. Must run `item-sync --pull` before any changes.
- Deployed PveRewardSystem bytecode does NOT match code on disk. Must redeploy from committed HEAD.

### Documentation Consistency
**CRITICAL**: The docs (`docs/`) are the source of truth for game design. Before making any major code change:
1. Read the relevant doc(s) to verify the change aligns with documented design
2. If the change contradicts a doc, flag the inconsistency and ask before proceeding
3. After completing the change, update any affected docs to stay in sync
4. Key docs to check: `GAME_DESIGN.md` (mechanics), `ECONOMICS.md` (gold/pricing), `COMBAT_SYSTEM.md` (formulas), `SYSTEM_ARCHITECTURE.md` (contracts), `APP_FLOW.md` (UX flows)

### Scope Control
- Keep changes focused — one feature or fix per branch/commit.
- Don't bundle unrelated work together.
- If a change touches more than 3 systems, plan it first.

### Git Workflow
- Commit style: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- Only commit what was worked on in the current session — don't sweep in unrelated uncommitted changes.
- Don't push without asking.

### Autonomy Rules
**Do freely** (no confirmation needed):
- Read files, search the web, run tests, check health endpoints
- Deploy to beta (`dev` branch, testnet)
- Fix obvious bugs, apply config changes to beta
- Run forge scripts against testnet

**Must ask first**:
- Push to `main` or deploy to production
- Spend money (any service, any amount)
- Delete files, branches, database records, or production resources
- Change env vars on Railway or Vercel
- Any security-sensitive change (keys, access control, permissions)
- Force push anywhere

### Dependencies
- Pin versions. Run `pnpm audit` before adding new packages.
- Prefer well-maintained packages with small surface area.

### Status Updates
- Before any operation that takes more than 10 seconds, say what you're doing and roughly how long it'll take.

### Definition of Done
- Every task needs a verification command, commit hash, or live URL before it's closed. No closing on vibes.

### Learn From Mistakes
- After any error that takes more than one attempt to fix, write the root cause and solution to `~/.claude/projects/-Users-michaelorourke/memory/learnings.md` (general) or `mud-gotchas.md` (MUD-specific) before moving on.

### Session State Persistence
- Maintain `~/.claude/projects/-Users-michaelorourke/memory/SESSION.md` as a working scratchpad.
- **Update it** when: starting a new task, completing a task, hitting a blocker, making a commit, or any significant state change.
- **Read it first** at the start of every session to resume where we left off.

## Tech Stack
- **Framework**: MUD (Lattice) v2 for on-chain game development
- **Contracts**: Solidity 0.8.24+, deployed via MUD World, tested with Forge (Foundry)
- **Frontend**: React 18, Chakra UI, Privy + RainbowKit, viem/wagmi
- **API**: Express on Vercel serverless, Pinata IPFS
- **Chain**: Base Mainnet (chain 8453) — both production and beta (separate world addresses)

## Key Documentation
- `docs/INDEX.md` — **Start here.** Master hub linking all docs.
- Key refs: `GAME_DESIGN.md`, `ECONOMICS.md`, `COMBAT_SYSTEM.md`, `SYSTEM_ARCHITECTURE.md`, `APP_FLOW.md`
- Operations: `operations/launch_checklist.md`, `operations/DEPLOY_RUNBOOK.md`, `operations/ERROR_REFERENCE.md`
- Architecture: `architecture/` dir — TOKEN_GUIDE, ACCESS_CONTROL, AUTH_INTEGRATION, INDEXER, RELAYER, frontend_guidelines

## Domain-Specific Rules
Loaded automatically via `.claude/rules/` when working in each domain:
- **`solidity.md`** — Security, access control patterns, MUD gotchas, gas safety, testing (activates on `packages/contracts/**/*.sol`)
- **`client.md`** — Performance, usability, crypto abstraction, SEO, player-facing copy (activates on `packages/client/**`)
- **`api.md`** — Rate limiting, CORS, input validation, no secret leakage (activates on `packages/api/**`, `packages/relayer/**`)
- **`deploy.md`** — Environment separation, branch conventions, MUD deploy safety, worlds.json (activates on deploy scripts, env files, mud.config)

## Reminders

### Launch Checklist Updates
After every git commit, check `docs/operations/launch_checklist.md` for items the commit addresses. Mark done with commit hash, update summary section, update timestamp.

## Critical Gaps
1. ~~Emergency pause/circuit breaker~~ (DONE)
2. No external security audit
3. Inconsistent access control on some admin functions

## Current Deploy State

> **Canonical source for world addresses:** `packages/client/src/mud/worlds.json` (both envs). After any deploy, read this file — don't rely on hardcoded addresses elsewhere.

| Env | Branch | Address Source |
|-----|--------|---------------|
| Production | `main` | `worlds.json` → chain `8453`, key `address` (production entry) |
| Beta | `dev` | `worlds.json` → chain `8453`, key `address` (beta entry) |

| Service | URL |
|---------|-----|
| Game (prod) | https://ultimatedominion.com |
| Game (beta) | https://beta.ultimatedominion.com |
| Guide | https://ud-guide.vercel.app |
| Tavern (forum) | https://tavern.ultimatedominion.com |
| Relayer | https://8453.relay.ultimatedominion.com |
| Indexer | https://indexer-production-d6df.up.railway.app |

**What's live for players:** Dark Cave (10x10 grid, levels 1-10), 3 races (Human/Elf/Dwarf), 9 advanced classes at level 10, turn-based PvE + PvP combat, NPC shop, player marketplace, escrow-based PvP economy, lore fragments, badges (Adventurer/Founder/Zone Conqueror), Tavern chat at level 3. Gas relayer abstracts all blockchain interaction.
