# Current Direction

**This file is auto-generated on every `/handoff`.** It is the live
working memory for this project — what is actively being shipped, where
every thread stands, what changed recently. Agents (Claude, Codex, and
any other) should treat this as ground truth for "where are we right
now". Regenerated: `2026-04-14T11:13:34+00:00`.

When this file conflicts with older docs, trust this one.

---
## Focus

Audio system is shipping in two phases: the music/crossfade layer merged to dev today and auto-deployed to beta via Vercel (live for players). The SFX integration (battle hits/crits/kills, level up, rare+ loot) is 3 commits ahead in the worktree (`92ca5564`), tests green, ready for PR. In parallel, **SpellStats table is empty on beta** — spells show in inventory but with zero damage/stats — blocking spell combat until the migration populates entries and adds the Spell branch to ItemCreationSystem. Indexer ghost fix is built and awaiting Railway deployment.

## Active threads

- **[CRITICAL] SpellStats table empty** — 2026-04-10. All spells show zero damage on beta. Root cause: `ItemCreationSystem.createItem()` has no `ItemType.Spell` branch; stats never written to SpellStats table. Next: identify correct spell item IDs, add Spell branch to createItem, run migration to populate existing spells on beta.

- **[BETA] Audio SFX integration pending PR** — 2026-04-14. Battle hits/crits/kills, level up, rare+ loot drop SFX ready (`92ca5564`). 50/50 tests passing. Music layer merged and live on beta via #355-#359. Next: open PR for SFX layer `feat/audio-zones` → `dev`, gut-check in beta after merge.

- **[BETA] Indexer ghost fix deploy pending** — 2026-04-14. PositionV2 snapshot fix + Railway preflight complete (`a4de21fc`). Next: deploy to Railway `indexer-beta-us` (service `390336a9`).

- **[PROD] Battle hotfix + contract fixes queued** — 2026-04-13. Battle state hotfix `b13e4346` ready; three contract changes: MapSystem Position.get() broken on production (root cause 2026-04-03), level 10 XP cap admin TX, zone completion backfill. Next: confirm deploy window (no active combat), run fixes in sequence, verify post-deploy state.

- **[ITEM-UI] ASCII icons expansion** — 2026-04-10. Epic+ icons animating on beta (MonsterAsciiRenderer pipeline live). Need marketplace, tooltips, shop, trade UI. Also profile mobile perf (250ms rAF throttle may cause GPU burn). Next: build icon component for marketplace, test mobile before expanding further.

- **[CREATURE] Forge batch 8/43** — 2026-04-09. 35 items forged (weapons/armor/consumables/monsters). 8 armor pieces remaining. Badge idempotent fix deployed to beta. Cooldown script working. Next: resume forge batch on demand.

- **[ONBOARDING] Spawn speed + embedded gas validation** — 2026-04-10. Fixed gas for `UD__spawn`, fire during post-enterGame celebration. Embedded gas refills stable after Privy decoupling (removed token refresh from hot path). Need longer soak test (movement, combat, multiple top-ups). Next: add fixed gas to spawn, validate 48h+ cycle in beta before inviting more players.

- **[BETA] Ghost encounter race condition patched** — 2026-04-07. Client force-ends stale encounters on-chain; contract checks Spawned + HP > 0 before creating. Auto-dismiss increased from 15s to 30s. Needs longer production soak to confirm no regressions. Next: monitor logs for false evictions after prod deploy.

## Recent pivots (last 14 days)

- **2026-04-14** — Audio music layer merged to dev; verified live on beta via Vercel. SFX layer follows in separate PR. Workflow: feature branches in worktrees merge to dev via PR, auto-deploy to beta, then production window.
- **2026-04-09** — Zone badge minting made idempotent: skip if already exists. Unblocks character progression through L10.
- **2026-04-08** — Embedded gas refill decoupled from Privy token refresh: hot path was hitting Privy 429 rate limits under repeated movement/combat. Removed refresh from critical path; relayer gates first-time funds but allows repeats.
- **2026-04-07** — Ghost auto-dismiss increased from 15s to 30s: 15s killed real battles with slow opponent data load. 30s gives time for data while catching client-side ghost encounters.
- **2026-04-03** — Ghost mob root cause pinpointed: production MapSystem `Position.get()` returns (0,0) for ALL entities. Client patch shipped; contract deploy still pending.

## Blocked / waiting

- SpellStats migration — blocks spell combat on beta. Depends on identifying correct spell item IDs and adding Spell branch to ItemCreationSystem.
- Production contract deploy window — three fixes queued (MapSystem, level cap, zone backfill). Needs confirm green light + timing (no active combat, deployer balance verified).
- Battle hotfix push — coordinating with contract deploy sequence (independent paths, confirm order).
- ASCII icon expansion — awaiting mobile perf profile (250ms rAF throttle assessment) before expanding to marketplace/tooltips/shop.

## Open questions

- Should prod battle hotfix (`b13e4346`) deploy before or after contract fixes (independent paths, confirm order)?
- Spell stats: silent failure (client handles zero-damage gracefully) or user alert?
- Embedded gas confidence: ready to invite more players to beta or wait for 48h+ cycle validation?
- Production contract deploy window: when is it scheduled?
