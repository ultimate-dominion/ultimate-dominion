# Monster Roster Redesign

Replacing custom/invented monsters with classic D&D/RPG archetypes.
Neither Z1 nor Z2 monsters are finalized on-chain — this is the time to get them right.

## Design Principles
- Classic fantasy archetypes players recognize instantly (D&D, WoW, Keep on the Borderlands)
- Power scale should feel natural — kobolds are scrappy, basilisks are terrifying
- Dragons/drakes reserved for special encounters, not regular mobs
- Bosses are ~2 levels above the zone cap

---

## Zone 1: Dark Cave (Levels 1-10)

| Lvl | Current (live) | New | Class | Notes |
|-----|---------------|-----|-------|-------|
| 1 | Dire Rat | **Dire Rat** | AGI | Keep — classic starter. Art done (skeleton system). |
| 2 | Fungal Shaman | **Kobold** | INT | Art done (skeleton system, extreme crouch, spear). |
| 3 | Cavern Brute | **Goblin** | STR | Sword + shield, sneering. Classic cave fodder. |
| 4 | Crystal Elemental | **Giant Spider** | AGI | Web, fangs, 8 legs. Phase Spider art can be adapted. |
| 5 | Ironhide Troll | **Skeleton** | STR | Sword + tattered armor. Undead — fits cave lore. |
| 6 | Phase Spider | **Goblin Shaman** | INT | Upgraded goblin with staff + magic effects. |
| 7 | Bonecaster | **Gelatinous Ooze** | INT | Translucent cube/blob. Unique silhouette. |
| 8 | Rock Golem | **Bugbear** | STR | Big, hairy, club. The "oh shit" goblinoid. |
| 9 | Pale Stalker | **Carrion Crawler** | AGI | Multi-legged centipede thing. Creepy. |
| 10 | Dusk Drake | **Hook Horror** | STR | Armored, hook-clawed. Iconic Underdark creature. |
| 12 | Basilisk (boss) | **Basilisk** | STR | Keep — petrifying gaze boss. May need art refresh. |

### Art Status
- [x] Dire Rat — skeleton system, quadruped, red-orange eyes, fur texture
- [x] Kobold — skeleton system, extreme crouch, spear thrust, S-curve tail
- [x] Goblin — skeleton system, oversized head, huge ears, two-handed axe overhead
- [x] Giant Spider — modified skeleton (5-node spine, 8 limbs), cluster of red eyes, wide leg spread
- [x] Skeleton — skeleton system, ribcage with dark gaps, skull brow ridge, sword up
- [x] Goblin Shaman — skeleton system, pointed hat, staff with glowing amber orb, big ears, tattered robes
- [x] Gelatinous Ooze — no skeleton (pure canvas), translucent cube, dissolved skull/bones/dagger inside
- [ ] Bugbear — large muscular goblinoid, shaggy fur, bear-like snout, massive club
- [ ] Carrion Crawler — segmented worm body, multiple legs (centipede), face tentacles
- [ ] Hook Horror — bird-like head, hooked beak, massive hook-claws, exoskeleton
- [ ] Basilisk — large lizard/serpent, petrifying gaze eyes (bright), thick scales, heavy tail

---

## Zone 2: Windy Peaks (Levels 11-20)

| Lvl | Current (placeholder) | New | Class | Notes |
|-----|----------------------|-----|-------|-------|
| 11 | Ridge Stalker | **Dire Wolf** | AGI | Pack hunter. Mountain variant. |
| 12 | Frost Wraith | **Harpy** | INT | Flying, shrieking. Fits mountain peaks. |
| 13 | Granite Sentinel | **Ogre** | STR | Big, dumb, hits hard. Classic mid-tier brute. |
| 14 | Gale Phantom | **Worg** | AGI | Giant evil wolf. Smarter than dire wolf. |
| 15 | Blighthorn | **Orc** | STR | Armored, disciplined. The real threat. |
| 16 | Storm Shrike | **Orc Shaman** | INT | Orc with elemental magic. |
| 17 | Hollow Scout | **Troll** | AGI | Regenerating. Classic mid-high threat. |
| 18 | Ironpeak Charger | **Griffon** | STR | Lion + eagle. Majestic but territorial. |
| 19 | Peakfire Wraith | **Manticore** | INT | Lion + scorpion tail + wings. Deadly. |
| 20 | — | **Wyvern** | STR | Proto-dragon. The zone capstone. |
| 22 | Korrath's Warden (boss) | **Korrath's Warden** | STR | Keep name — fits lore. ~2 levels above zone cap. |

### Art Status
- [ ] Dire Wolf
- [ ] Harpy
- [ ] Ogre
- [ ] Worg
- [ ] Orc
- [ ] Orc Shaman
- [ ] Troll
- [ ] Griffon
- [ ] Manticore
- [ ] Wyvern
- [ ] Korrath's Warden

---

## Migration Notes

### What needs to change per monster:
1. **Art** — creature-lab iteration → port to `monsterTemplatesRedux.ts`
2. **monsters.json** — name, metadataUri, stats, inventoryNames
3. **items.json** — any monster-specific drops (e.g., "Dire Rat Fang" → new equivalents)
4. **Template array** — update `monsterTemplates` in monsterTemplatesRedux.ts
5. **On-chain sync** — `item-sync dark_cave --update` + verify

### Stats approach:
- Keep the existing stat curves (they're balanced for progression)
- Just rename and re-theme — don't rebalance everything at once
- Boss stats stay the same, names may change

### Items to watch:
- Monster-specific named drops (Sporecap Wand, Crystal Shard, etc.) need renaming
- Generic drops (potions, consumables, crafting mats) stay the same
- Signature weapons should match new monster identity
