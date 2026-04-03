# Temper Adoption Report

- Project: ultimate-dominion
- Root: /Users/michaelorourke/ultimate-dominion
- Family: Data-Driven Progression RPG (data-driven-progression-rpg)
- Stack: Browser + TypeScript Monorepo (browser-typescript-monorepo)
- Package manager: pnpm

## Source Of Truth Candidates
- packages/contracts/zones/dark_cave/effects.json
- packages/contracts/zones/dark_cave/items.json
- packages/contracts/zones/dark_cave/monsters.json
- packages/contracts/zones/windy_peaks/effects.json
- packages/contracts/zones/windy_peaks/items.json
- packages/contracts/zones/windy_peaks/monsters.json
- packages/contracts/worlds.json
- packages/contracts/mud.config.ts
- monsters.json
- CHANGELOG.md

## Workflow Surfaces
- agents: AGENTS.md
- session: SESSION.md
- claude: CLAUDE.md
- handoffs: HANDOFF_monster-images-beta.md, HANDOFF_prod-ghost-mob-live-repair.md, HANDOFF_prod-ghost-mob-root-cause.md, HANDOFF_prod-ghost-mob.md
- claude_rules: .claude/rules/api.md, .claude/rules/client.md, .claude/rules/deploy.md, .claude/rules/game.md, .claude/rules/indexer.md, .claude/rules/solidity.md

## Inferred Commands
- build: pnpm build (root:scripts.build)
- test: pnpm test (root:scripts.test)
- release_notes: pnpm changelog:dry (root:scripts.changelog:dry)
- typecheck: pnpm --filter client run typecheck (client:scripts.typecheck)
- smoke: pnpm --filter contracts run test:smoke:all (contracts:scripts.test:smoke:all)
- balance_verify: pnpm --filter contracts run test:balance (contracts:scripts.test:balance)

## Recommended Ship Steps
- ship lite: build, test, release_notes
- ship full: build, typecheck, test, balance_verify, release_notes

## Recommended Migration Stages
- 1. Install Temper config and assistant surfaces in read-only mode.
- 2. Use `temper ship lite --dry-run` against the repo until the inferred hooks feel right.
- 3. Tighten source-of-truth paths and environment branches inside temper.config.json.
- 4. Promote `ship full` and hotfix flows once the report matches lived workflow.
