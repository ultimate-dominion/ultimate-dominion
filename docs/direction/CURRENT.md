# Current Direction

**This file is auto-generated on every `/handoff`.** It is the live
working memory for this project — what is actively being shipped, where
every thread stands, what changed recently. Agents (Claude, Codex, and
any other) should treat this as ground truth for "where are we right
now". Regenerated: `2026-04-17T20:32:56+00:00`.

When this file conflicts with older docs, trust this one.

---
## Focus

**Windy Peaks quest HUD + creature visibility shipped to beta 2026-04-17.** Three client bugs fixed (dragon off-map, fragment lookup encoding, echo icon) and contract prereq gate removed from ZoneTransitionSystem. Vercel auto-deploying from `dev`. Visual polish cluster (orange flash, HUD alignment, item ticker) merged through 2026-04-16. **Critical blocker:** SpellStats table empty — spells created without stats since ItemCreationSystem.createItem() has no Spell branch. Blocking prod deploy window.

## Active threads

- **[critical] SpellStats table empty** — last touched 2026-04-16. Spells created without stats; ItemCreationSystem.createItem() has no Spell branch. Needs: (1) add ItemType.Spell branch to createItem() writing to SpellStats, (2) migrate historical items (1-9, 214/232-257, 551-559). Next: implement branch + migration script, deploy to beta, test.

- **[shipped] Windy Peaks quest HUD + dragon + fragment echo** — last touched 2026-04-17 (`d880474f`). Fixed 3 bugs: dragon coords (PositionV2 vs legacy Position math), fragment key encoding (decimal vs hex in encodeCompositeKey), echo icon missing from map. Contract fix (`abe5a30a`) drops prereq gate from ZoneTransitionSystem. Next: verify on beta, test quest pickup + HUD display + creature rendering.

- **[shipped] Visual polish (orange flash + HUD + ticker)** — last touched 2026-04-16 (`f0dc23e6`). Orange shell flash eliminated via Header Box wrapper + pathname-aware RoutesFallback. Battle HUD snap fixed via stable HealthBar height + flex column. Item ticker removed. Next: verify on beta, no regressions.

- **[shipped] Audio/SFX integration** — last touched 2026-04-14 (`92ca5564`). 50 tests passing, 13 OGG assets, merged to dev. Music ducking + SFX hooked on all surfaces (battle/loot/level/fragments). Next: verify audio and SFX playback on beta.

- **[shipped] Zone unlock + creatures.json refactor** — last touched 2026-04-14 (`573a7ad1`, `1ed203ad`). Zone exit unlocks at L10 regardless of class state. Creatures.json extracted as single source; all Z1 creatures aligned (basilisk 26×9 → 18×18). Lab symlinks to canonical JSON. Next: verify basilisk and other creatures render correctly on beta.

- **[deploy] Railway indexer ghost fix** — last touched 2026-04-14. Beta DB repaired (164 ghost rows cleared), code on dev (`2986663f`). Indexer deploy failed with 413 Payload Too Large. Next: redeploy `2986663f` to Railway indexer-beta-us with explicit Dockerfile config, verify snapshot clears stale positions.

- **[beta-z2] Onboarding spawn speed** — last touched 2026-04-13. Spawn fires async after UI celebration/navigation, feels slower than movement/battle. Spawn not in fixed-gas map. Next: add UD__spawn to fixed-gas (2-4M), fire during post-enterGame celebration, gate nav on spawn receipt.

- **[prod] Battle results hotfix** — last touched 2026-04-08 (`b13e4346`). Code ready. Next: push to GitHub so Vercel auto-deploys prod.

## Recent pivots (last 14 days)

- **2026-04-17** — Windy Peaks quest HUD shipped. Fixed dragon off-map (PositionV2 coords already zone-relative, don't subtract offset). Fixed fragment chain lookups (decimal string was being hex-encoded, need toString(16)). Fragment echo icon was dead code, now rendering.
- **2026-04-16** — Orange shell flash eliminated by wrapping Header Fragment in single Box (was leaking 2 children to Grid) + making RoutesFallback dark/pathname-aware. Item ticker removed from GameBoard.
- **2026-04-15** — Battle HUD snap eliminated by reserving HealthBar badges row unconditionally (minH="14px") and making battle container flex column.
- **2026-04-14** — Audio SFX fully integrated (13 OGG assets, 50 tests, all surfaces hooked). Creatures.json extracted as single source of truth for game and lab (all Z1 creatures had divergent grid dims). Respec relocated from Character modal to dedicated /respec page. Zone exit unlock decoupled from advanced class state.

## Blocked / waiting

- SpellStats population — needs ItemType.Spell branch implementation + migration
- Railway indexer deploy — `2986663f` failed with 413, awaits explicit Dockerfile redeploy
- Production battle hotfix — `b13e4346` ready to push
- Basilisk visual verification — user reported pixelated in Victory screen; verify post-creatures.json alignment

## Open questions

- **Basilisk display on beta** — is the 18×18 alignment now rendering correctly, or still pixelated/missing?
- **Spawn speed perception vs reality** — is spawn actually slower, or just feels slower because it fires async after UI navigation?
