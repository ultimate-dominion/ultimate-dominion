# Current Direction

**This file is auto-generated on every `/handoff`.** It is the live
working memory for this project — what is actively being shipped, where
every thread stands, what changed recently. Agents (Claude, Codex, and
any other) should treat this as ground truth for "where are we right
now". Regenerated: `2026-04-16T16:42:14+00:00`.

When this file conflicts with older docs, trust this one.

---
## Focus

Visual polish cluster shipped to beta 2026-04-15 to 2026-04-16 (BootScreen Suspense fallback, battle HUD snap fix, orange shell flash on all routes eliminated via Header Box wrapper). Audio/SFX integration, zone unlock decoupling, and creatures.json refactor all merged 2026-04-14. **Critical blocker:** SpellStats table is empty — spells created without stats since ItemCreationSystem.createItem() has no Spell branch. Blocking spell viability in combat and production deploy window.

## Active threads

- **[critical] SpellStats table empty** — last touched 2026-04-16. Spells created without stats; ItemCreationSystem.createItem() has no Spell branch. Needs: (1) add ItemType.Spell branch to createItem() writing to SpellStats, (2) migrate historical items (1-9, 214/232-257, 551-559). Next: implement branch + migration script, deploy to beta, test.

- **[shipped] Visual polish (BootScreen + HUD + orange shell)** — last touched 2026-04-16 (`f0dc23e6`). Orange flash eliminated via Header Box wrapper + pathname-aware RoutesFallback (`ea785a4f`). Battle HUD snap fixed via stable HealthBar height + flex column (`24fd3f6a`). Item ticker removed. Vercel auto-deployed to beta. Next: verify on beta, no regressions.

- **[shipped] Audio/SFX integration** — last touched 2026-04-14 (`92ca5564`). 50 tests passing, 13 OGG assets, merged to dev. Music ducking + SFX hooked on all surfaces (battle/loot/level/fragments). Next: verify audio and SFX playback on beta.

- **[shipped] Zone unlock + creatures.json refactor** — last touched 2026-04-14 (`573a7ad1`, `1ed203ad`). Zone exit unlocks at L10 regardless of class state. Creatures.json extracted as single source; all Z1 creatures aligned (basilisk 26×9 → 18×18). Lab symlinks to canonical JSON. Next: verify basilisk and other creatures render correctly on beta.

- **[deploy] Railway indexer ghost fix** — last touched 2026-04-14. Beta DB repaired (164 ghost rows cleared), code on dev (`2986663f`). Indexer deploy failed with 413 Payload Too Large. Next: redeploy `2986663f` to Railway indexer-beta-us with explicit Dockerfile config, verify snapshot clears stale positions.

- **[beta-z2] Onboarding spawn speed** — last touched 2026-04-13. Spawn fires async after UI celebration/navigation, feels slower than movement/battle. Spawn not in fixed-gas map. Next: add UD__spawn to fixed-gas (2-4M), fire during post-enterGame celebration, gate nav on spawn receipt.

- **[prod] Battle results hotfix** — last touched 2026-04-08 (`b13e4346`). Code ready. Next: push to GitHub so Vercel auto-deploys prod.

## Recent pivots (last 14 days)

- **2026-04-16** — Orange shell flash eliminated by wrapping Header Fragment in single Box (was leaking 2 children to Grid) + fixing App.gridRows template + making RoutesFallback dark/pathname-aware. Item ticker removed from GameBoard.

- **2026-04-15** — BootScreen flash eliminated by making RoutesFallback pathname-aware (renders full-screen BootScreen on /game-board during React.lazy Suspense). Battle HUD snap eliminated by reserving HealthBar badges row unconditionally (minH="14px") and making battle container flex column.

- **2026-04-14** — Audio SFX fully integrated (13 OGG assets, 50 tests, all surfaces hooked). Creatures.json extracted as single source of truth for game and lab (all Z1 creatures had divergent grid dims). Respec relocated from Character modal to dedicated /respec page hosted by Vel Morrow. Zone exit unlock decoupled from advanced class state.

- **2026-04-13** — Embedded wallet gas funding token path fixed (fetch identity token actively). Movement monster display sync hardened (concurrent Promise.all + positionIsCleared guard).

## Blocked / waiting

- SpellStats population — needs ItemType.Spell branch implementation + migration
- Railway indexer deploy — `2986663f` failed with 413, awaits explicit Dockerfile redeploy
- Production battle hotfix — `b13e4346` ready to push
- Basilisk visual verification — user reported pixelated spider in Victory screen

## Open questions

- **Basilisk display on beta** — missing asset, rendering path bug, or stale Vercel build serving old dims?
- **Spawn speed perception vs reality** — is spawn actually slower, or just feels slower because it fires async after UI navigation?
