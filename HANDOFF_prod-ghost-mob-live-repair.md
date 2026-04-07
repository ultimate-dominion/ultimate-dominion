# Prod Ghost Mob Live Repair Handoff

- Date: 2026-04-02
- Worktree: `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob`
- Branch: `release/prod-ghost-mob`
- Current HEAD: `ef6b8960` (`chore: refresh mud system metadata`)

## What Was Done

- Ran the approved live production tile repair against the production world using the authenticated OVH RPC and the mainnet env from the main checkout.
- The live repair rewrote every stale `EntitiesAtPosition` row whose referenced monster already had live `Position(0,0)`.
- Confirmed the repair completed successfully and a fresh post-write dry run now reports zero stale rows.
- Committed the permanent local contract fix that hardens board cleanup invariants:
  - `376e03c8` `fix: harden board cleanup invariant`
  - `ef6b8960` `chore: refresh mud system metadata`

## Proven Current State

- Production live repair was run on:
  - world `0x99d01939F58B965E6E84a1D167E710Abdf5764b0`
- Pre-repair live dry run showed:
  - `Tiles with stale entries: 99`
  - `Zero-position ghost entries: 1968`
  - `Non-zero mismatches left untouched: 0`
- Post-repair verification dry run showed:
  - `Tiles with stale entries: 0`
  - `Zero-position ghost entries: 0`
  - `Non-zero mismatches left untouched: 0`
- The repair intentionally did **not** run `--despawn`, so it only cleaned the stale board rows and skipped the extra `Spawned=false` writes.

## What Was Attempted But Didn't Fully Verify

- `pnpm run build` in `packages/contracts` started compilation but never returned in this workspace.
- `forge build --skip test script` also started cleanly (`Compiling 13 files with Solc 0.8.28`) but never returned here either.
- `forge fmt --check` passed on the touched Solidity files after formatting, so parser/format-level verification is clean, but there is still no completed local compile result to claim.

## Files Touched And Why

- `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob/packages/contracts/src/libraries/BoardPositionLib.sol`
  - new shared primitive for removing entities from tile membership and reverting on drift
- `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob/packages/contracts/src/libraries/BoardCleanupLib.sol`
  - now routes cleanup through the shared invariant-preserving primitive
- `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob/packages/contracts/src/systems/MapRemovalSystem.sol`
  - removal path now reverts on stale tile membership instead of silently zeroing state
- `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob/packages/contracts/src/systems/ZoneTransitionSystem.sol`
  - zone transitions now fail on board drift instead of hiding it
- `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob/packages/contracts/src/systems/MapSystem.sol`
  - movement path now shares the same board-removal primitive
- `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob/packages/contracts/src/systems/AutoAdventureSystem.sol`
  - auto-adventure move path now shares the same board-removal primitive
- `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob/packages/contracts/src/systems/AdminEntitySystem.sol`
  - admin move path now shares the same board-removal primitive
- `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob/packages/contracts/test/BoardCleanupLib.t.sol`
  - added regressions for the exact drift case: missing tile membership must revert and preserve entity state
- `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob/packages/contracts/test/MobSystem.t.sol`
  - added remove-from-board regression when character is missing from the tile list
- `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob/packages/contracts/test/Z2Badges.t.sol`
  - added zone-transition regression when character is missing from the source tile list
- `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob/packages/contracts/test/mocks/BoardCleanupProbeSystem.sol`
  - probe harness updated to use the shared primitive
- `/Users/michaelorourke/ultimate-dominion/.claude/worktrees/prod-ghost-mob/packages/contracts/.mud/local/systems.json`
  - refreshed generated metadata to include the new `EntityNotAtPosition()` ABI exposure on the affected systems

## Decisions Made

- Immediate player relief came first: run the narrowly scoped live repair before attempting a contract rollout.
- Do not run the optional `--despawn` pass now. The visible prod issue was stale board membership, and the post-repair dry run is clean.
- Keep the permanent contract fix local-only for now until it goes through the normal beta validation path.

## Exact Next Steps

1. Do a quick production smoke check:
   - move a character
   - start at least one PvE encounter
   - zone transition once or twice if relevant
2. Push `release/prod-ghost-mob` only after approval.
3. Validate the invariant patch on beta using the normal contract deploy path.
4. If beta is clean, decide whether to ship the permanent contract fix to production.

## Deploy / Environment State

- Production state:
  - live repair script has been run successfully
  - live board scan now reports zero stale tile rows
- Beta state:
  - no new beta deploy was done in this session
- Git state:
  - `release/prod-ghost-mob` contains the local commits `376e03c8` and `ef6b8960`
  - nothing has been pushed

## Non-Obvious Notes

- `packages/contracts/.env.mainnet` is present in the main checkout, not symlinked into this worktree. Manual prod script execution from the worktree must source the absolute main-checkout env path:
  - `source /Users/michaelorourke/ultimate-dominion/packages/contracts/.env.mainnet`
- `SESSION.md` had drifted from the live worktree list again; this handoff updates it to include `temper-onboard` and the current prod-ghost-mob head.
