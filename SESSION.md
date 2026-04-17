# Active Work — Ultimate Dominion

Updated: 2026-04-17 (WP quest HUD + dragon + fragment echo fixes shipped to beta; prereq gate deployed)

## Pending
1. **SpellStats migration** — critical blocker. Add `ItemType.Spell` branch to `ItemCreationSystem.createItem()`, flip deploy script to `ITEM_TYPE_SPELL = 2`. Research complete.
2. Push `b13e4346` from prod-battle-results hotfix for prod.
3. Expand ASCII item icons to marketplace, tooltips, shop, trade UI.
4. Run BackfillZoneCompletions.s.sol for ALL characters on beta/prod.
5. **Onboarding spawn speed** — add fixed gas for `UD__spawn`, fire spawn during post-`enterGame` celebration.
6. **Production contract deploy window** — ghost mob fix + level cap + zone completion + spell stats all queued.
7. **Source missing battle SFX** (dodge, miss, take-damage) into `public/audio/sfx/battle/`.
8. **Railway indexer** — `2986663f` redeploy (413 failure still open).
