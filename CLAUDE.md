# Ultimate Dominion

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

**Effect changes follow the same flow** — `effects.json` is the source of truth:
1. Edit `effects.json`
2. Commit the change
3. Run `effect-sync dark_cave --update` to push to chain
4. Run `effect-sync dark_cave` (verify mode) — must show 0 mismatches

**After any `mud deploy`:**
- Run `item-sync dark_cave` to verify items AND effects survived the upgrade
- Run `effect-sync dark_cave` to deep-verify effect stats if item-sync reports missing effects
- Tag the deploy: `git tag deploy-prod-$(date +%Y%m%d-%H%M)`
- Run `npx tsx scripts/drop-sim.ts` to confirm player experience matches expectations

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

### Dependencies
- Pin versions. Run `pnpm audit` before adding new packages.
- Prefer well-maintained packages with small surface area.

### Definition of Done
- Every task needs a verification command, commit hash, or live URL before it's closed. No closing on vibes.
- Local baseline: the build passes.
- Standard validation path: local build, beta deploy on `dev`, then the relevant integration tests in beta.

## Key Documentation
- Start at `docs/INDEX.md` — master hub linking all docs.

## Reminders

### Launch Checklist Updates
After every git commit, check `docs/operations/launch_checklist.md` for items the commit addresses. Mark done with commit hash, update summary section, update timestamp.

## Critical Gaps
1. ~~Emergency pause/circuit breaker~~ (DONE)
2. No external security audit
3. Inconsistent access control on some admin functions

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
