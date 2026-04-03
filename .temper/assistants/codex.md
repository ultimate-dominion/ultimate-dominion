# Temper For Codex

Temper is installed as the operating layer for this repo.

## Defaults

- repo root: `/Users/michaelorourke/ultimate-dominion`
- family: `data-driven-progression-rpg`
- stack: `browser-typescript-monorepo`
- runtime: `pnpm exec temper`
- shared canon: `.temper/assistants/shared-canon.json`
- session board: `SESSION.md`

## Codex Workflow

- read `.temper/assistants/shared-canon.json` before major design or release guidance
- use the shared canon as the source of truth and render Claude/Codex-specific behavior from it
- keep repo-local policy in `temper.config.json` and `.temper/assistants/shared-canon.json`

## Capability Defaults

- before designing a new system, feature, or data model — run this first, not after: `pnpm exec temper coach --cwd . --json --intent "<what you're designing>"`
- after the first working version of a feature is done — before moving to the next thing: `pnpm exec temper ship lite --cwd . --intent "<what you just built>"`
- before sharing with anyone, or when touching player-facing, economy, or multi-system code: `pnpm exec temper ship full --cwd . --intent "<summary>"`
- something is broken in a live environment and you need a recovery plan: `pnpm exec temper hotfix --cwd . --json --env prod --intent "<what broke>"`
- ending a session, switching to a different workstream, or handing work to another agent: `pnpm exec temper handoff --cwd . --slug <slug> --summary "<summary>" --next "<next step>"`

## Continuity

- read `SESSION.md` before assuming current workstream state
- use `pnpm exec temper handoff --cwd . --slug <slug> --summary "<summary>" --next "<next step>"` when handing off or pausing a branch
- keep handoff detail in `HANDOFF_<slug>.md` and keep `SESSION.md` short

## Resurfacing

- Keep full-flow live verification explicit. Promote only when needed: smoke.
- Do not read root `test` as real release confidence until the repo splits lint from verification.
- Keep AGENTS, SESSION, and handoff surfaces current so restart cost does not creep back in.
- Recurring failure modes to keep visible: Root `test` currently resolves to lint-style validation rather than a real test or verify path.; deep verification has shared-state steps that should stay promoted, not default: smoke
