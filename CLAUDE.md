# Ultimate Dominion - Project Memory

## Game Manifesto (Design North Star)

The manifesto (`packages/client/src/pages/Manifesto.tsx`) defines the game's identity. Every code change must align with these principles:

1. **Long-term world, not short-term game.** Progression is slow and measured. Never add shortcuts, skips, or instant gratification mechanics. The journey is the point.
2. **Player-authored stories.** Lore is shaped by what players do — their fights, choices, alliances, and betrayals. Systems should create emergent narrative, not scripted content.
3. **Permanent, provable ownership.** Gold, items, characters, and scars live on-chain. Players own their assets — no server can take them, alter them, or shut them off.
4. **Invisible technology.** Blockchain is infrastructure, not identity. No crypto jargon in the UI. No wallet terminology. No friction. Browser-first, zero downloads.
5. **Meaningful consequences.** Risk creates the tension that makes victory feel earned. Death, loss, and failure should matter.
6. **Fair economics.** Money may give a head start, never an insurmountable advantage. Earning is secondary to fun. When whales participate, everyone benefits.

**When making game design decisions, ask:** Does this make the world more permanent, more player-driven, and more worth coming back to in a year?

## Rules

### Documentation Consistency
**CRITICAL**: The docs (`docs/`) are the source of truth for game design. Before making any major code change:
1. Read the relevant doc(s) to verify the change aligns with documented design
2. If the change contradicts a doc, flag the inconsistency and ask before proceeding
3. After completing the change, update any affected docs to stay in sync
4. Key docs to check: `GAME_DESIGN.md` (mechanics), `ECONOMICS.md` (gold/pricing), `COMBAT_SYSTEM.md` (formulas), `SYSTEM_ARCHITECTURE.md` (contracts), `APP_FLOW.md` (UX flows)

### Performance & Speed
- This is a browser game — speed is a feature. Every interaction should feel instant.
- Minimize on-chain transaction counts. Batch operations where possible.
- Never add blocking operations to the UI thread. All chain reads/writes must be async with loading states.
- Be mindful of bundle size. Lazy-load routes. Don't add heavy dependencies without justification.
- Test that any UI change remains responsive on mobile browsers.

### Usability
- All UI must work without crypto knowledge. Follow the crypto abstraction table in `docs/architecture/frontend_guidelines.md`.
- Never expose wallet addresses, transaction hashes, gas fees, or chain IDs to the player.
- Every action needs clear feedback: loading states, success confirmations, error messages with recovery steps.
- Mobile-first — if it doesn't work on a phone browser, it doesn't ship.

### Security
- **Smart contracts**: Check for reentrancy, integer overflow, access control, and input validation on every change. Reference `docs/operations/launch_checklist.md` Section 10 for the full checklist.
- **Frontend**: No `dangerouslySetInnerHTML`, no `eval`, no user-controlled URLs without validation. Validate `chainId` against `supportedChains`.
- **API**: All endpoints must have rate limiting, CORS restrictions, input validation, and no secret/stack trace leakage.
- **Keys**: Never hardcode private keys or secrets. Always use environment variables.
- **Dependencies**: Pin versions. Run `pnpm audit` before adding new packages. Prefer well-maintained packages with small surface area.
- When in doubt, add the security check. A false alarm costs minutes; a vulnerability costs everything.

### Testing Before Shipping
- Run `forge test` before committing any contract changes.
- Run `pnpm build` in packages/client before pushing to verify no build errors.
- Verify function selectors after any `mud deploy`.
- Never deploy to mainnet without testnet verification first.

### Environment Separation
- `beta.ultimatedominion.com` = Base Mainnet (beta world)
- `ultimatedominion.com` = Base Mainnet (production world)
- Both on chain 8453, distinguished by WORLD_ADDRESS (and VITE_WORLD_ADDRESS on client).
- NEVER mix beta/production world addresses. Double-check WORLD_ADDRESS before any deploy.

### Deployment Convention (Branch → Environment)
Each package uses per-environment `.env` files. Scripts source the right file automatically.

| Branch | Target | Confirm? |
|---|---|---|
| `dev` | Beta (Base Mainnet, separate world) | No |
| `main` | Production (Base Mainnet) | **Always** |
| Feature branch | Ask user | Yes |

- **Contracts**: `deploy:testnet` / `deploy:mainnet` / `seed:testnet` / `zone:load:testnet` etc.
- **Client**: `pnpm dev` (local) / `pnpm build:staging` (testnet) / `pnpm build` (mainnet)
- **Forge admin scripts**: `source .env.testnet && forge script ...` (on dev) or `source .env.mainnet && forge script ...` (on main)
- When user says "deploy it": on `dev` → target testnet; on `main` → confirm before mainnet; on feature branch → ask which env.

### MUD Deploy Safety
- **Always use `--worldAddress` when deploying to existing chains** to force upgrade instead of accidental fresh deploy. Compiler setting changes (optimizer_runs, via_ir) change all bytecodes → different CREATE2 addresses → MUD deploys a new world instead of upgrading.
- `mud deploy` with nonce errors can silently skip transactions — always verify function selectors after deploy.
- System upgrades create NEW contract addresses — data keyed by `address(this)` is orphaned at the old address.
- Always run PostDeploy seed/config scripts after a fresh deploy.
- Backup world state before mainnet upgrades.

### Backwards Compatibility / Migrations
- Before modifying any MUD table schema: check if live player data exists in that table.
- If yes: write a migration script or add a new table instead of modifying the existing one.
- Never delete a table with live data without a migration plan.

### Player-Facing Copy (Vibecoding)
Any text that appears in the game — item descriptions, system messages, patch notes, NPC dialogue, UI labels — must sound like a specific person wrote it. No generic AI language ("In today's fast-paced world...", unnecessary bullet points, robotic transitions). If a player can tell AI wrote it, it failed.

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

### Status Updates
- Before any operation that takes more than 10 seconds, say what you're doing and roughly how long it'll take.
- "Downloading snapshot, ~2.5 hrs" is better than silence.

### Definition of Done
- Every task needs a verification command, commit hash, or live URL before it's closed. No closing on vibes.
- Examples: `forge test` passing, `curl` returning expected response, commit hash confirmed, URL loading correctly.

### Learn From Mistakes
- After any error that takes more than one attempt to fix, write the root cause and solution to `~/.claude/projects/-Users-michaelorourke/memory/learnings.md` (general) or `mud-gotchas.md` (MUD-specific) before moving on.
- Check memory at the start of every session. Past mistakes must not repeat.

### Session State Persistence
- Maintain `~/.claude/projects/-Users-michaelorourke/memory/SESSION.md` as a working scratchpad.
- **Update it** when: starting a new task, completing a task, hitting a blocker, making a commit, or any significant state change.
- **Read it first** at the start of every session to resume where we left off.
- Track: current branch, what just happened, uncommitted changes, pending items, recently resolved items.
- Clean up resolved items as they're completed. Keep only the last 1-2 sessions of context.

## Tech Stack
- **Framework**: MUD (Lattice) v2 for on-chain game development
- **Contracts**: Solidity 0.8.24+, deployed via MUD World, tested with Forge (Foundry)
- **Frontend**: React 18, Chakra UI, Privy + RainbowKit, viem/wagmi
- **API**: Express on Vercel serverless, Pinata IPFS
- **Chain**: Base Mainnet (chain 8453) — both production and beta (separate world addresses)

## Key Documentation
- `docs/INDEX.md` - **Master documentation hub** — start here
- `docs/GAME_DESIGN.md` - Canonical game mechanics reference
- `docs/ECONOMICS.md` - Token economy and gold balance
- `docs/GOLD_SUPPLY_PLAN.md` - Supply modeling and founder allocation
- `docs/ROADMAP.md` - Feature roadmap with pre-defined MUD tables
- `docs/architecture/SYSTEM_ARCHITECTURE.md` - Smart contract systems
- `docs/architecture/TOKEN_GUIDE.md` - ERC20/ERC721/ERC1155 token architecture
- `docs/architecture/ACCESS_CONTROL.md` - Namespace permissions and access patterns
- `docs/architecture/AUTH_INTEGRATION.md` - Privy embedded wallet + RainbowKit
- `docs/architecture/INDEXER.md` - Custom MUD indexer
- `docs/architecture/RELAYER.md` - Gas relayer service
- `docs/architecture/frontend_guidelines.md` - UI design system
- `docs/architecture/tech_stack.md` - Full tech stack details
- `docs/combat-stats/COMBAT_SYSTEM.md` - Combat formulas and constants
- `docs/combat-stats/COMBAT_BALANCE.md` - Balance issues and tuning
- `docs/operations/launch_checklist.md` - Launch readiness tracking
- `docs/operations/DEPLOY_RUNBOOK.md` - Deployment procedures
- `docs/operations/ERROR_REFERENCE.md` - Error codes and troubleshooting
- `docs/APP_FLOW.md` - User-facing app flow
- `docs/LAUNCH_STRATEGY.md` - Launch plan and anti-abuse
- `docs/GO_TO_MARKET.md` - Marketing and distribution

## Reminders

### Launch Checklist Updates
**IMPORTANT**: After every git commit, check `docs/operations/launch_checklist.md` for items that the commit addresses. If a checklist item is resolved by the commit:

1. **Mark it done**: Change `[ ]` to `[x]`, add the commit hash (e.g., `✓ Fixed shop buy flow (\`bc589ab7\`)`).
2. **Update stale descriptions**: If the item describes a problem that's now fixed, rewrite it to reflect current state.
3. **Update the Summary section**: Keep "What's Left for Production Launch" accurate.
4. **Update the timestamp**: Change `_Last updated:_` at the bottom.

This keeps the checklist in sync with actual work as it happens, not after the fact.

## Critical Gaps (Pre-Launch Blockers)
1. ~~No emergency pause/circuit breaker mechanism~~ (DONE)
2. No external security audit
3. Inconsistent access control on some admin functions
