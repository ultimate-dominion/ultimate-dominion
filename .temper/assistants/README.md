# Temper Assistant Surfaces

Temper is installed for `ultimate-dominion`.

- Project root: `.`
- Family: `data-driven-progression-rpg`
- Stack: `browser-typescript-monorepo`
- Runtime: `pnpm exec temper`
- Shared canon: `.temper/assistants/shared-canon.json`

## Core Commands

- `pnpm exec temper coach --cwd . --json --intent "<what you're designing>"`
- `pnpm exec temper ship lite --cwd . --intent "<what you just built>"`
- `pnpm exec temper ship full --cwd . --intent "<summary>"`
- `pnpm exec temper hotfix --cwd . --json --env prod --intent "<what broke>"`
- `pnpm exec temper handoff --cwd . --slug <slug> --summary "<summary>" --next "<next step>"`

## Continuity

- Session board: `SESSION.md`
- Handoff pattern: `HANDOFF_<slug>.md`
- Preferred handoff command: `pnpm exec temper handoff --cwd . --slug <slug> --summary "<summary>" --next "<next step>"`

If `pnpm exec temper` is unavailable, install Temper into this repo from GitHub first, then rerun the command from the repo root.

## Runtime Rule

Read `.temper/assistants/shared-canon.json` first, then adapt it to the current assistant surface instead of inventing repo policy from scratch.
