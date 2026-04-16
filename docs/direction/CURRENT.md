# Current Direction

**This file is auto-generated on every `/handoff`.** It is the live
working memory for this project — what is actively being shipped, where
every thread stands, what changed recently. Agents (Claude, Codex, and
any other) should treat this as ground truth for "where are we right
now". Regenerated: `2026-04-16T16:32:37+00:00`.

When this file conflicts with older docs, trust this one.

---
## Focus

Visual polish shipped 2026-04-15 to 2026-04-16 (BootScreen flash fixed, battle HUD snap eliminated, orange shell flash on all routes finally resolved). Large feature cluster merged 2026-04-14: audio/SFX (50 tests passing, music + 13 SFX assets live on beta), zone unlock decoupled from class state, creatures.json extracted as single source, respec relocated to dedicated /respec page hosted by Vel Morrow. **Critical blocker:** SpellStats table is empty — spells created without stats since ItemCreationSystem.createItem() has no Spell branch. Blocking spell viability in combat.

## Active threads

- **[critical] SpellStats table empty** — last touched 2026-04-10. Spells created without stats; ItemCreationSystem.createItem() has no Spell branch. Needs: (1) populate SpellStats for items 1-9, 214/232-257, 551-559; (2) add ItemType.Spell branch to createItem(). Next: write migration script, deploy to beta, test.

- **[shipped] Audio/SFX + zone unlock** — last touched 2026-04-14. 50 tests passing, merged to dev (`92ca5564`/`573a7ad1`), music ducking + SFX live, zone exit unlocks at L10. Next: verify audio and unlock on beta, then push to production.

- **[shipped] Visual polish (BootScreen + HUD + orange shell)** — last touched 2026-04-16. Orange flash eliminated via pathname-aware Suspense + grid layout fix (`f0dc23e6`), BootScreen Suspense fallback (`ea785a4f`), battle HUD snap fixed via stable HealthBar height + flex column (`24fd3f6a`). Item ticker removed. Vercel auto-deployed to beta. Next: monitor beta for regressions.

- **[shipped] creatures.json refactor** — last touched 2026-04-14. Grid dims extracted to shared source; all Z1 creatures aligned; basilisk 26×9 → 18×18 (`1ed203ad`). Lab symlinks to canonical JSON. Next: verify basilisk and other creatures render correctly on beta (user reported pixelated spider).

- **[deploy] Railway indexer ghost fix** — last touched 2026-04-14. Beta DB repaired (164 ghost rows cleared), code on dev `2986663f`. Indexer deploy failed with 413 Payload Too Large. Next: redeploy `2986663f` to Railway indexer-beta-us with explicit Dockerfile config, verify snapshot clears stale positions.

- **[beta-z2] Onboarding spawn speed** — last touched 2026-04-13. Spawn not in fixed-gas map, fires async after navigation. Feels slower because it triggers after UI celebration/board load rather than during. Next: add UD__spawn to fixed-gas (2-4M), fire during post-enterGame celebration, gate nav on spawn receipt.

- **[prod] Battle results hotfix** — last touched 2026-04-08. Code ready `b13e4346`. Next: push to GitHub so Vercel auto-deploys prod.

- **[infra] Worktree hygiene + global CLI** — last touched 2026-04-14. `wt-audit.sh`, `wt-done.sh`, `wt-enforce.sh` hooks deployed globally. Prevents cross-contamination, auto-heals SESSION.md. Desktop notification spam fixed (removed Stop + SessionEnd hooks). Next: verify worktree discipline holds across concurrent sessions.

## Recent pivots (last 14 days)

- **2026-04-16** — Orange shell flash eliminated by wrapping Header Fragment in single Box (was leaking 2 children to Grid) + fixing App.gridRows template + making RoutesFallback dark/pathname-aware. Item ticker removed from GameBoard.

- **2026-04-15** — BootScreen flash eliminated by making RoutesFallback pathname-aware (renders full-screen BootScreen on /game-board during React.lazy Suspense window). Battle HUD snap eliminated by reserving HealthBar badges row unconditionally (minH="14px") and making battle container a flex column.

- **2026-04-14** — Audio SFX fully integrated (13 OGG assets, 50 tests, all surfaces hooked). Creatures.json extracted as single source of truth for game and lab (all Z1 creatures had divergent grid dims). Respec relocated from Character modal to dedicated /respec page hosted by Vel Morrow (dead code path — Character.tsx never read query param; now live NPC interaction).

- **2026-04-14** — Zone exit unlock decoupled from advanced class state — players at L10 without class picked were stuck; now exit shows at L10 regardless.

- **2026-04-14** — Worktree hygiene system built and deployed globally (wt-audit.sh, wt-done.sh, wt-enforce.sh hooks). Enforces branch discipline, prevents cross-contamination, auto-heals SESSION.md.

## Blocked / waiting

- SpellStats population — needs migration for items 1-9, 214/232-257, 551-559, then deploy.
- Railway indexer deploy — `2986663f` failed with 413. Needs explicit Dockerfile redeploy from indexer-beta-us service.
- Production battle hotfix push — `b13e4346` ready to push for Vercel auto-deploy.
- Production contract deploy window — SpellStats + level cap fix + zone completion all queued.

## Open questions

- **Basilisk display on beta** — User saw pixelated spider in Victory screen. Investigate: missing asset, rendering path bug, or stale Vercel build serving old dims.

- **Spawn speed perception vs reality** — Is spawn actually slower, or just feels slower because it fires async after UI navigation? Spawn not in fixed-gas map. Needs verification post-fix.
