# Temper Shared Canon

- Project: `ultimate-dominion`
- Root: `/Users/michaelorourke/ultimate-dominion`
- Family: `data-driven-progression-rpg`
- Stack: `browser-typescript-monorepo`
- Runtime: `pnpm exec temper`

## Defaults
- Treat Temper as the operating layer for this repo.
- Fetch doctrine and routing before major design or release guidance.
- Use ship lite for narrow implementation confidence.
- Use ship full for player-facing, infra, economy, security, or multi-system work.

## Capabilities
- `coach`: before designing a new system, feature, or data model — run this first, not after
- command: `pnpm exec temper coach --cwd . --json --intent "<what you're designing>"`
- result: fetch doctrine and routing before you answer
- `ship_lite`: after the first working version of a feature is done — before moving to the next thing
- command: `pnpm exec temper ship lite --cwd . --intent "<what you just built>"`
- result: run the default low-risk ship path
- `ship_full`: before sharing with anyone, or when touching player-facing, economy, or multi-system code
- command: `pnpm exec temper ship full --cwd . --intent "<summary>"`
- result: run the deeper blessed ship path and surface any gated follow-ups
- `hotfix`: something is broken in a live environment and you need a recovery plan
- command: `pnpm exec temper hotfix --cwd . --json --env prod --intent "<what broke>"`
- result: route the response through the hotfix doctrine surface
- `handoff`: ending a session, switching to a different workstream, or handing work to another agent
- command: `pnpm exec temper handoff --cwd . --slug <slug> --summary "<summary>" --next "<next step>"`
- result: write a canonical restart artifact and update SESSION.md

## Execution Policy
- stages: discovered -> recommended -> blessed -> gated
- promotion command: temper ship <lite|full> --promote <step>
- lite discovered: build, test, release_notes
- lite blessed default: build, test, release_notes
- lite gated: none
- full discovered: build, typecheck, test, balance_verify, smoke, release_notes
- full blessed default: build, typecheck, test, balance_verify, release_notes
- full gated: smoke
- Live-stateful steps start gated and require explicit `--promote <step>` to run.
- Production-sensitive steps require both `--promote <step>` and `--confirm-prod`.

## Continuity
- session file: SESSION.md
- handoff pattern: HANDOFF_<slug>.md
- handoff command: pnpm exec temper handoff --cwd . --slug <slug> --summary "<summary>" --next "<next step>"
- Read SESSION.md first for the active board.
- Read the relevant HANDOFF_<slug>.md for restart detail.
- Keep the session board short and push detail into handoffs.

## Workflow Memory
- release pattern: beta environment is modeled; prod environment is modeled; 5 GitHub workflow files detected
- continuity pattern: repo-native session tracking exists; 4 handoff surfaces detected
- recurring failure modes: Root `test` currently resolves to lint-style validation rather than a real test or verify path.; deep verification has shared-state steps that should stay promoted, not default: smoke
- recent signals: 2409 local commits available for pattern inference; recent commit mix fix:6, docs:5, chore:1; top recommendations split-root-test-from-lint, gate-live-verification

## Resurfacing
- Keep full-flow live verification explicit. Promote only when needed: smoke.
- Do not read root `test` as real release confidence until the repo splits lint from verification.
- Use Temper to keep the repo's good habits explicit instead of letting them drift back into chat.
- Recurring failure modes to keep visible: Root `test` currently resolves to lint-style validation rather than a real test or verify path.; deep verification has shared-state steps that should stay promoted, not default: smoke
