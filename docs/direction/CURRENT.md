# Current Direction

**This file is auto-generated on every `/handoff`.** It is the live
working memory for this project — what is actively being shipped, where
every thread stands, what changed recently. Agents (Claude, Codex, and
any other) should treat this as ground truth for "where are we right
now". Regenerated: `2026-04-14T15:11:00+00:00`.

When this file conflicts with older docs, trust this one.

---
## Focus

All major feature branches (audio zones, zone unlock, movement sync, creatures.json, respec) merged to `dev` on **2026-04-14**. Music + SFX live on beta via Vercel git integration. **CRITICAL BLOCKER:** SpellStats table empty—all spells show zero damage/stats because `ItemCreationSystem.createItem()` lacks `ItemType.Spell` branch, blocking spell-casting classes.

## Active threads

- **[spell-stats]** — 2026-04-14 (CRITICAL). `ItemCreationSystem.createItem()` has no `ItemType.Spell` branch—all spells show zero damage/stats. Next: write SpellStats migration, add Spell branch to createItem, run `mud deploy`.

- **[audio]** — 2026-04-14. Music merged via PRs #355–#359 (battle/ambient crossfading, 5s linger). SFX layer committed (`dfe27edc`), 50/50 tests passing. Next: manual playtest for SFX timing + music ducking (50% level-up 4s, 3% Epic+ loot 3s).

- **[zone-unlock]** — 2026-04-14. L10 zone exit merged (`573a7ad1`), decoupled from advanced class state. Exit prompt uses `completedLevel` callback. Next: manual verify L10 characters exit Dark Cave → Windy Peaks on beta.

- **[movement-monsters]** — 2026-04-14. Receipt-based sync hardening merged (`4242f24f`). 164 ghosts repaired on beta block 44660659. Indexer snapshot filter (`2986663f`) ready for Railway deploy (`indexer-beta-us`). Next: deploy, verify PositionV2 (0,0) filtered.

- **[respec]** — 2026-04-14. Moved to dedicated `/respec` page hosted by Vel Morrow (Z2 NPC), gated behind `SHOW_Z2`. Tal Z1 shopkeeper renamed from "Grizzled Merchant". 5 commits shipped (`3d0ce4a1` through `6cb97b1c`). Next: manual QA verify routing and Tal label display.

- **[creatures-json]** — 2026-04-14. Single source of truth for game/lab creature definitions. Basilisk grid dims fixed (26×9 lab → 18×18 game). Symlinked from lab to `packages/client/src/components/pretext/game/creatures.json`. Shipped (`1ed203ad`). Next: verify all Z1 creatures preview correctly in lab.

- **[item-icons]** — 2026-04-10. ASCII oversample+compress pipeline live (GLB→toon-shaded 3D→MonsterAsciiRenderer→cached canvas). Epic+ animated Y-rotation every 250ms. Next: profile 250ms rAF throttle on mobile, expand to marketplace/tooltips/shop/trade UI.

- **[prod-battle-results]** — 2026-04-08. Stale-active-battle suppression + state race fix (`b13e4346`). Unpushed from worktree. Next: push to origin, Vercel git integration auto-deploys production.

## Recent pivots (last 14 days)

- **2026-04-14** — All 6 major feature branches merged to dev in single day (audio, zone unlock, movement sync, creatures, respec). Aggressive batching to unblock production deploy window.
- **2026-04-14** — Audio SFX integrated direct to dev instead of PR — faster ship path once review confirmed clean.
- **2026-04-14** — Zone exit unlock decoupled from advanced class state — L10 characters exit immediately without class selection gate.
- **2026-04-14** — Creatures.json single source of truth — unified game/lab grid dims, fixed basilisk preview bug, symlink pattern.
- **2026-04-13** — Receipt-based movement monster display sync hardening — concurrent `Promise.all` + `positionIsCleared` guard eliminates TOCTOU ghost eviction.

## Blocked / waiting

- **SpellStats population** — blocked on `ItemCreationSystem.createItem()` Spell branch + `mud deploy`. Blocks spell-casting classes.
- **Railway indexer ghost snapshot filter** — `2986663f` ready for deploy to `indexer-beta-us`.
- **Prod battle results hotfix** — `b13e4346` ready; awaiting push to origin + Vercel git-integration deploy.
- **Prod contract deploy window** — queued: spell stats, ghost mob fix (beta verified), level cap, zone completion. Deploy once spell stats unblocked.

## Open questions

- Should missing battle SFX (dodge, miss, take-damage) be sourced now or deferred? Currently placeholder keys.
- Is 250ms rAF throttle for animated Epic+ item icons sufficient on mobile, or will dropped frames occur?
- Battle music ducking levels (50% level-up 4s, 3% Epic+ loot 3s) — correct after live playtest?
- Spell system: deploy `ItemCreationSystem.createItem()` Spell branch in same window as ghost/level-cap fixes, or separate?
