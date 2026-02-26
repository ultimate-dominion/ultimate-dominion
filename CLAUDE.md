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
- All UI must work without crypto knowledge. Follow the crypto abstraction table in `docs/architecture/FRONTEND_GUIDELINES.md`.
- Never expose wallet addresses, transaction hashes, gas fees, or chain IDs to the player.
- Every action needs clear feedback: loading states, success confirmations, error messages with recovery steps.
- Mobile-first — if it doesn't work on a phone browser, it doesn't ship.

### Security
- **Smart contracts**: Check for reentrancy, integer overflow, access control, and input validation on every change. Reference `docs/launch_checklist.md` Section 10 for the full checklist.
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

### Scope Control
- Keep changes focused — one feature or fix per branch/commit.
- Don't bundle unrelated work together.
- If a change touches more than 3 systems, plan it first.

### Git Workflow
- Commit style: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- Only commit what was worked on in the current session — don't sweep in unrelated uncommitted changes.
- Don't push without asking.

### Learn From Mistakes
- After any error that takes more than one attempt to fix, write the root cause and solution to memory (`~/.claude/projects/-Users-michaelorourke/memory/MEMORY.md`) before moving on.
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
- **Frontend**: React 18, Chakra UI, Thirdweb + RainbowKit, viem/wagmi
- **API**: Express on Vercel serverless, Pinata IPFS
- **Chain**: Base Mainnet (chain 8453) — both production and beta (separate world addresses)

## Key Documentation
- `docs/launch_checklist.md` - Launch readiness tracking
- `docs/GAME_DESIGN.md` - Canonical game mechanics reference
- `docs/ECONOMICS.md` - Token economy and gold balance
- `docs/architecture/TECH_STACK.md` - Full tech stack details
- `docs/architecture/SYSTEM_ARCHITECTURE.md` - Smart contract systems
- `docs/architecture/FRONTEND_GUIDELINES.md` - UI design system
- `docs/combat-stats/COMBAT_SYSTEM.md` - Combat formulas and constants
- `docs/combat-stats/COMBAT_BALANCE.md` - Balance issues and tuning
- `docs/APP_FLOW.md` - User-facing app flow
- `docs/LAUNCH_STRATEGY.md` - Launch plan and anti-abuse
- `docs/GO_TO_MARKET.md` - Marketing and distribution

## Reminders

### Launch Checklist Updates
**IMPORTANT**: After completing any significant work, update `docs/launch_checklist.md` to reflect progress. Key areas to track:

- [x] Non-Crypto Authentication (Done - Google OAuth via Thirdweb embedded wallet)
- [ ] PvP Testing & Balance (50% - Phase 1 done, Phase 2-3 pending)
- [ ] Item Drop Balance (40% - needs zone-specific tuning)
- [x] Delegation Revoke (Done - Revoke button + logout revoke implemented)
- [x] Emergency Pause Mechanism (Done - PauseSystem + PauseLib on all user-facing entry points)
- [ ] Security Audit (CRITICAL - not done)

When updating, change `[ ]` to `[x]` for completed items and add notes on partial progress.

## Critical Gaps (Pre-Launch Blockers)
1. ~~No emergency pause/circuit breaker mechanism~~ (DONE)
2. No external security audit
3. Inconsistent access control on some admin functions
