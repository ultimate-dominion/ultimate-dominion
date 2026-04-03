# Temper Onboarding Report

```text
()==========>  T E M P E R
  Heat. Hammer. Quench. Ship.
```

- Project: ultimate-dominion
- Root: /Users/michaelorourke/ultimate-dominion
- Family: Data-Driven Progression RPG (data-driven-progression-rpg)
- Stack: Browser + TypeScript Monorepo (browser-typescript-monorepo)
- Lifecycle inference: Live Service / Existing Users Likely
- Current startup token load: ~5K-15K tokens
- Projected after Temper contract + recommendations: ~2K-5K tokens

## What Temper Sees
- environments: local:*, beta:dev, prod:main
- workflow surfaces: agents=AGENTS.md; session=SESSION.md; claude=CLAUDE.md; claude_rules=.claude/rules/api.md, .claude/rules/client.md, .claude/rules/deploy.md, .claude/rules/game.md, .claude/rules/indexer.md, .claude/rules/solidity.md
- source of truth: packages/contracts/zones/dark_cave/effects.json, packages/contracts/zones/dark_cave/items.json, packages/contracts/zones/dark_cave/monsters.json, packages/contracts/zones/windy_peaks/effects.json, packages/contracts/zones/windy_peaks/items.json, packages/contracts/zones/windy_peaks/monsters.json, packages/contracts/worlds.json, packages/contracts/mud.config.ts, monsters.json, CHANGELOG.md
- github workflows: .github/workflows/ci.yml, .github/workflows/deploy-beta.yml, .github/workflows/release.yml, .github/workflows/smoke.yml, .github/workflows/sync-dev.yml
- git history: 2431 commits; recent types fix:8, chore:2, docs:2

## What Already Looks Good
- The repo already has explicit operator context files for startup and session continuity.
- Domain rules are already broken out into file-scoped guidance instead of one giant doc.
- The project distinguishes local, beta, and prod instead of treating release as one flat surface.
- Temper can detect canonical data and workflow surfaces without custom per-project code.
- GitHub workflow files exist, so the repo has machine-readable release or validation paths.
- The repo has enough local history for Temper to infer patterns instead of guessing from a shallow snapshot.

## Lifecycle And Operator Posture
- A beta environment is explicitly modeled in repo workflows or deploy rules.
- A production environment is explicitly modeled, which usually means operator mistakes have real user impact.
- Both beta and prod exist alongside GitHub workflows, so release discipline already matters.
- The repo has 2431 commits locally, which suggests an established system rather than a throwaway prototype.
- The stack includes live-service overlays, so environment mistakes can mutate real state or real services.
- operator habit: Treat default automation as a safety rail, not a shortcut. Beta and prod paths should stay explicit.
- player impact: Small workflow mistakes can hit players directly through progression, deploy, or economy surfaces.

## Workflow Memory
- release pattern: beta environment is modeled; prod environment is modeled; 5 GitHub workflow files detected
- continuity pattern: repo-native session tracking exists
- recurring failure mode: Root `test` currently resolves to lint-style validation rather than a real test or verify path.
- recurring failure mode: deep verification has shared-state steps that should stay promoted, not default: smoke
- recent signal: 2431 local commits available for pattern inference
- recent signal: recent commit mix fix:8, chore:2, docs:2
- recent signal: top recommendations split-root-test-from-lint, gate-live-verification

## Token Efficiency
- score: 70/100
- No handoff docs detected. End-of-session context is more likely to get lost.
- Root `test` is acting like lint. That creates false confidence and expensive backtracking.
- Default `ship full` currently includes live-stateful verification. That is expensive, slower, and easier to misuse.
- Shared operating instructions exist, which lowers repeated orientation cost.
- Session state is already explicit, which helps carry work across turns and agents.
- Domain-specific rule files exist, so assistants can stay narrower and cheaper.
- Canonical source-of-truth surfaces are detectable, which is one of the biggest token savers in long-lived repos.

## Execution Policy
- safe local: test, release_notes
- expensive local: build, typecheck, balance_verify
- network readonly: none
- live stateful: smoke
- prod sensitive: none

## Policy Lifecycle
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

## Recommended Hook Shape
- ship lite current: build, test, release_notes
- ship lite recommended default: build, test, release_notes
- ship full current: build, typecheck, test, balance_verify, smoke, release_notes
- ship full recommended default: build, typecheck, test, balance_verify, release_notes
- promote to explicit beta/live verification: smoke
- keep behind explicit prod confirmation: none

## Resurfacing
- [high] Keep full-flow live verification explicit. Promote only when needed: smoke.
- [high] Do not read root `test` as real release confidence until the repo splits lint from verification.
- [medium] Keep AGENTS, SESSION, and handoff surfaces current so restart cost does not creep back in.
- [medium] Recurring failure modes to keep visible: Root `test` currently resolves to lint-style validation rather than a real test or verify path.; deep verification has shared-state steps that should stay promoted, not default: smoke

## Recommendations
- [high] Split root lint from root verification
- why: Humans and assistants both read `test` as a confidence signal. If it only lints, the repo looks safer than it is.
- operator change: Rename the root lint path or add a stronger root verify path that matches what `test` implies.
- player impact: Fewer releases will be called validated when only style checks ran.
- tradeoff: One-time script and CI cleanup. Slightly more explicit command names afterward.
- token impact: Saves rework tokens by reducing false-positive confidence during shipping.
- [high] Keep live-stateful verification out of the default `ship full` path
- why: Environment-bound smoke tests and sync-style commands are valuable, but they should be promoted deliberately, not inferred as routine local validation.
- operator change: Use `ship full` for local/deep local confidence and run beta/live verification as an explicit next step.
- player impact: Reduces accidental mutation of shared game state while keeping beta confidence available when it matters.
- tradeoff: One more explicit step when you want deep environment validation.
- token impact: Cuts long, expensive runs from the default path and avoids recovery sessions after accidental live writes.
- [medium] Codify startup, session, and handoff surfaces
- why: Every missing operator doc pushes context back into chat, which is the most expensive place to store it.
- operator change: Keep AGENTS, SESSION, and handoff docs short, current, and repo-native.
- player impact: Less operator drift means fewer avoidable mistakes during hotfixes and live changes.
- tradeoff: Requires a few minutes of discipline at the start and end of a workstream.
- token impact: This is one of the biggest recurring token savings because the same explanation stops repeating.
