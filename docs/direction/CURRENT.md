# Current Direction

**This file is auto-generated on every `/handoff`.** It is the live
working memory for this project — what is actively being shipped, where
every thread stands, what changed recently. Agents (Claude, Codex, and
any other) should treat this as ground truth for "where are we right
now". Regenerated: `2026-04-15T00:29:19+00:00`.

When this file conflicts with older docs, trust this one.

---
## Focus

Latest activity clusters around 2026-04-14 with 5+ features merged to `dev` simultaneously: audio/SFX (50 tests passing), zone unlock decoupling (L10 independent of class state), creatures.json single source of truth (basilisk fixed 26×9 → 18×18), respec relocation to /respec page, movement monster display hardening (164 ghost rows cleared from beta DB). Vercel auto-deploys from dev. **Critical blocker:** SpellStats table is empty — spells created without stats. Railway indexer redeploy pending after failed 413 error.

## Active threads

- **[critical] SpellStats table empty** — last touched 2026-04-10. Spells created without stats; ItemCreationSystem.createItem() has no Spell branch. Needs: (1) populate SpellStats for items 1-9, 214/232-257, 551-559; (2) add ItemType.Spell branch to createItem(). Next: write migration script, deploy to beta, test.

- **[deploy] Movement monster display + Railway indexer** — last touched 2026-04-14. Beta DB repaired (164 ghost rows cleared), code on dev `2986663f`. Indexer deploy failed with 413 Payload Too Large on latest attempt. Next: redeploy `2986663f` to Railway indexer-beta-us with explicit Dockerfile config, verify snapshot clears stale positions.

- **[beta-audio] Audio/SFX + zone unlock** — last touched 2026-04-14. 50 tests passing, merged to dev (`92ca5564`/`573a7ad1`), music ducking + SFX live, zone exit unlocks at L10. Next: verify audio and unlock on beta, then push to production.

- **[visual] creatures.json refactor** — last touched 2026-04-14. Grid dims extracted to shared source; all Z1 creatures aligned; basilisk 26×9 → 18×18. Committed as `1ed203ad`. Next: verify basilisk and other creatures render correctly on beta (user reported pixelated spider).

- **[prod] Battle results hotfix** — last touched 2026-04-08. Code ready `b13e4346`. Next: push to GitHub so Vercel auto-deploys prod.

- **[infra] Worktree hygiene + Privy hotfix** — last touched 2026-04-14. Global audit/enforce/done scripts deployed; Privy fix (`a6acdde6`) merged allowing new user funding. Next: verify funding works on beta.

- **[beta-z2] Onboarding spawn speed** — last touched 2026-04-13. Spawn not in fixed-gas map, fires async after navigation. Next: add UD__spawn to fixed-gas (2-4M), fire during post-enterGame celebration, gate nav on spawn receipt.

- **[visual] Item ASCII icons** — last touched 2026-04-10. Oversample+compress approach working on Epic+ items. Next: expand to all item views (marketplace, tooltips, shop).

## Recent pivots (last 14 days)

- **2026-04-14** — Worktree hygiene system built and deployed globally (wt-audit.sh, wt-done.sh, wt-enforce.sh hooks). Enforces branch discipline, prevents cross-contamination, auto-heals SESSION.md. (reason: prior sessions had orphan branches and manual cleanup burden)

- **2026-04-14** — creatures.json extracted as single source of truth for game and lab. All Z1 creatures had divergent grid dims. Now symlinked, single edit point. (reason: basilisk was 26×9 in lab, 18×18 in game)

- **2026-04-14** — Audio SFX fully integrated (13 OGG assets, 50 tests, all surfaces hooked). Diagnostic logs stripped on merge. (reason: silent-playback investigation complete; root cause was muted Chrome tab)

- **2026-04-14** — Respec relocated from Character modal to dedicated /respec page hosted by Vel Morrow. (reason: dead code path — Character.tsx never read query param; now live NPC interaction)

- **2026-04-13** — Zone exit unlock decoupled from advanced class state. (reason: players at L10 without class picked were stuck; now exit shows at L10 regardless)

## Blocked / waiting

- SpellStats population — needs migration for items 1-9, 214/232-257, 551-559, then deploy.
- Railway indexer deploy — `2986663f` failed with 413. Needs explicit Dockerfile redeploy from indexer-beta-us service.
- Production battle hotfix push — `b13e4346` ready to push for Vercel auto-deploy.
- Production contract deploy window — SpellStats + level cap fix + zone completion backfill all queued.

## Open questions

- **Basilisk display on beta** — User saw pixelated spider in Victory screen. Investigate: missing asset, rendering path bug, or stale Vercel build serving old dims.

- **Spawn speed perception vs reality** — Is spawn actually slower, or just feels slower because it fires async after UI navigation? Spawn not in fixed-gas map. Needs verification post-fix.
