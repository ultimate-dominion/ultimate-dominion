# Current Direction

**This file is auto-generated on every `/handoff`.** It is the live
working memory for this project — what is actively being shipped, where
every thread stands, what changed recently. Agents (Claude, Codex, and
any other) should treat this as ground truth for "where are we right
now". Regenerated: `2026-04-14T15:28:12+00:00`.

When this file conflicts with older docs, trust this one.

---
## Focus

Multiple features shipped to beta this week: audio/SFX integration (13 OGG assets, 50 tests), zone unlock at level 10 independent of class selection, creature visuals (basilisk fixed 26×9 → 18×18), and respec relocation to dedicated `/respec` page. **Production critically blocked**: SpellStats table is empty because `ItemCreationSystem.createItem()` has no `ItemType.Spell` branch — spells exist in inventory but have zero stats.

## Active threads

- **[critical] SpellStats table empty** — last touched 2026-04-14. Spells created without stats; createItem has no Spell branch. Next: populate for items 1-9, 214, 232-257, 551-559; add Spell branch to createItem; deploy.
- **[prod] Battle results hotfix** — last touched 2026-04-08. Code ready at `b13e4346`, needs push to GitHub to trigger Vercel prod deploy.
- **[deploy] Movement monster display indexer** — last touched 2026-04-13. Code shipped to dev (`2986663f`); Railway beta indexer deploy failed on 413 Payload Too Large, needs retry with explicit Dockerfile config.
- **[beta] Onboarding spawn speed** — last touched 2026-04-13. Spawn not in fixed-gas map. Fix: add `UD__spawn` to fixed-gas, fire during post-enterGame celebration, gate nav on spawn receipt.
- **[beta] Zone completion backfill** — last touched 2026-04-10. Code ready at `033f9414`, deployed to beta, blocked by prod contract deploy window.
- **[visual] creatures.json refactor** — last touched 2026-04-14. Grid dims extracted to shared source; basilisk fixed 26×9 → 18×18. Next: visual verification in game.
- **[beta-audio] Audio/SFX + zone unlock** — last touched 2026-04-14 (merged at `573a7ad1`). 50 tests passing, Vercel auto-deploying. Next: beta verification of music ducking, SFX triggers, zone exit at L10.
- **[beta-ui] Item icons (ASCII rendering)** — last touched 2026-04-10. Inventory/loadout using oversample+compress pipeline (Epic+ animated). Next: marketplace, tooltips, shop, trade UI.

## Recent pivots (last 14 days)

- **2026-04-14** — creatures.json extracted as single source of truth for game and lab. All Z1 creatures had divergent grid dims between two sources. Now symlinked, single edit point, eliminates category of bugs.
- **2026-04-14** — Audio SFX fully integrated (13 OGG assets, 50 tests, all surfaces hooked). Previous session's silent-playback diagnostic logs stripped on merge (root cause: muted Chrome tab, not code bug).
- **2026-04-14** — Respec relocated from `/character` modal to dedicated `/respec` page hosted by Vel Morrow. Was dead code (query param never read); now live NPC interaction with full page pattern.
- **2026-04-13** — Zone exit unlock decoupled from class selection. Players at L10 without advanced class picked were stuck. Now independent: exit shows at L10 regardless.
- **2026-04-10** — Zone completion backfill made idempotent. Changed from hard revert "Badge already minted" to skip-silently, allowing backfill to succeed for multi-level characters.

## Blocked / waiting

- **SpellStats population** — needs migration for items 1-9 (copy from WeaponStats), 214/232-257 (L10 from WeaponStats + L15 from script), 551-559 (hardcoded from script).
- **Railway indexer deploy** — `2986663f` failed with 413 Payload Too Large (worktree upload). Needs explicit Dockerfile redeploy from service.
- **Production contract deploy window** — SpellStats + ghost mob fix + level cap admin TX + zone completion backfill all queued.
- **Battle SFX assets** — dodge, miss, enemy-hit-player files sourced as placeholder keys (playSfx no-ops on unknown keys). Can drop in without code changes.
- **Beta manual QA** — respec relocation (Vel Morrow → `/respec`, Character.tsx has no RespecPanel), audio music/SFX (dips on level-up/epic loot), zone unlock (exit available at L10).

## Open questions

- **Spawn speed perception vs reality** — Is spawn actually slower, or just feels slower because it fires async after UI navigation finishes? Investigation showed `spawn` not in fixed-gas map (pays extra `estimateGas` round trip). Needs verification post-fix.
- **SSH push background hang** — creatures.json handoff notes: "SSH push works in foreground only — background bash processes consistently hang after SSH key exchange." Root cause unclear. Workaround: use gh token URL auth.
