# Current Direction

**This file is auto-generated on every `/handoff`.** It is the live
working memory for this project — what is actively being shipped, where
every thread stands, what changed recently. Agents (Claude, Codex, and
any other) should treat this as ground truth for "where are we right
now". Regenerated: `2026-04-14T15:36:40+00:00`.

When this file conflicts with older docs, trust this one.

---
## Focus

Six commits merged to dev overnight (Audio/SFX, zone unlock, creatures.json, respec relocation, and supporting fixes). **Production blocked by SpellStats critical issue** — spells created without stats because `ItemCreationSystem.createItem()` has no `ItemType.Spell` branch. Railway indexer ghost fix (`2986663f`) is code-ready but deploy failed with 413 Payload Too Large; needs explicit Dockerfile redeploy.

## Active threads

- **[critical] SpellStats table empty** — last touched 2026-04-14. Spells created without stats. Blocks production deployment. Needs: (1) populate SpellStats for items 1-9, 214/232-257, 551-559; (2) add Spell branch to `ItemCreationSystem.createItem()` (requires `mud deploy`).
- **[deploy] Railway indexer ghost fix** — last touched 2026-04-14. `2986663f` failed with 413 Payload Too Large. Next: redeploy with explicit Dockerfile from `indexer-beta-us`, verify snapshot clears stale positions.
- **[beta] Audio/SFX + zone unlock + creatures** — last touched 2026-04-14 (merged to dev). 13 OGG assets, 50 tests passing. Zone exit unlocks at L10 regardless of class state. creatures.json now centralizes grid dims. Next: verify audio plays on beta, verify basilisk + animated creatures render correctly.
- **[beta-z2] Onboarding spawn speed** — last touched 2026-04-13. Spawn not in fixed-gas map, fires async after navigation. Next: add `UD__spawn` to fixed-gas (2-4M), fire during post-enterGame celebration, gate navigation on spawn receipt.
- **[prod] Battle results hotfix** — last touched 2026-04-08. Code `b13e4346` ready on branch. Fixes double-attack animation and stale battle state. Next: push to GitHub, let Vercel prod auto-deploy.
- **[beta-ui] Item ASCII icons** — last touched 2026-04-10. Inventory/loadout using oversample+compress pipeline (epic+ animated). Next: expand to marketplace, tooltips, shop, trade UI.
- **[prod] Zone completion backfill** — last touched 2026-04-10. Idempotent badge minting fixed on beta. Next: backfill ALL characters on production.
- **[infra] Push dev to origin** — last touched 2026-04-14. dev has 7 commits ahead (worktree hygiene cleanup + creatures.json refactor + audio/zone merges). Awaiting user confirmation before push.

## Recent pivots (last 14 days)

- **2026-04-14** — creatures.json extracted as single source of truth for grid dims. All Z1 creatures had divergent dims between lab and game (basilisk was 26×9 in lab, 18×18 in game — invisible sync bug).
- **2026-04-14** — Respec relocated from `/character` modal query param to dedicated `/respec` page hosted by Vel Morrow (reason: dead code path — Character.tsx never read the query param; now live NPC interaction).
- **2026-04-14** — Audio SFX fully integrated (13 OGG assets, 50 tests, all surfaces hooked). Diagnostic logs stripped on merge (reason: silent-playback investigation complete; root cause was muted Chrome tab, not code).
- **2026-04-13** — Zone exit unlock decoupled from advanced class state (reason: players at L10 without advanced class were stuck; exit now shows at L10 regardless).
- **2026-04-10** — Zone completion backfill made idempotent: skip-silently instead of hard revert "Badge already minted" (reason: enables backfill for multi-level characters).

## Blocked / waiting

- **SpellStats population** — needs migration for items 1-9, 214/232-257, 551-559 and requires `mud deploy` to add Spell branch to `ItemCreationSystem.createItem()`.
- **Railway indexer deploy** — `2986663f` failed with 413 Payload Too Large. Needs explicit Dockerfile redeploy from `indexer-beta-us` (not RAILPACK fallback).
- **Push to origin/dev** — local dev is 7 commits ahead. Awaiting user confirmation before push.
- **Missing battle SFX assets** — dodge, miss, enemy-hit-player files sourced as placeholder keys. Can drop in later without code changes.

## Open questions

- **Basilisk display on beta** — User saw pixelated spider in Victory screen on earlier build. Investigate: missing asset, rendering path bug, or stale Vercel serving old dims? (creatures.json now centralizes dims; needs verification.)
- **Spawn speed perception vs reality** — Is spawn actually slower, or just feels slower because it fires async after UI navigation? Likely: not in fixed-gas map, pays extra `estimateGas` round trip. Needs verification post-fix.
