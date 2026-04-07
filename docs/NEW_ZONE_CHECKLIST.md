# New Zone Checklist

Use this checklist when designing and deploying a new zone. Organized by phase — complete each phase before moving to the next.

---

# Phase 1: Design

Everything in this phase is pen-and-paper / doc work. No code yet. Get the design right before building anything.

## 1.1 Narrative & Identity

- [ ] Zone name
- [ ] Level range (10 levels per zone)
- [ ] One-sentence pitch ("What is this place?")
- [ ] Connection to previous zone (how do players get here?)
- [ ] Connection to next zone (how do players leave?)
- [ ] Lore role — what do players LEARN in this zone?
- [ ] Emotional arc (e.g., "hope → disillusionment → resolve")
- [ ] Is this a Marrow, Fraying zone, or civilization?
- [ ] Environmental description (what does it look, sound, smell like?)
- [ ] How the Fraying manifests here specifically

## 1.2 Naming Conventions

Every zone has a distinct identity reflected in all names. Names escalate in quality and mystique as zones progress.

### Naming Escalation by Zone
| Zone | Tone | Weapon Examples | Armor Examples | Monster Examples |
|------|------|-----------------|----------------|------------------|
| 1 (Dark Cave) | Rough, scrappy, improvised | Broken Sword, Iron Axe, Bone Staff | Tattered Cloth, Worn Leather, Rusty Chainmail | Cave Rat, Fungal Crawler |
| 2 (Windy Peaks) | Weathered, hardy, forged | Galeforged Blade, Peakstone Hammer, Stormwood Bow | Mountaineer's Plate, Windsworn Leather, Peakclimber Robes | Ridge Stalker, Storm Harpy |
| 3 (Mystic Grove) | Natural, enchanted, ancient | Thornweave Staff, Moonpetal Blade, Briarvine Bow | Living Bark Plate, Duskbloom Robes, Feythread Cloak | Elderwood Sentinel, Mossback Troll |
| 4+ (Later zones) | Mythic, divine, corrupted | Names reference gods, wounds, or faction relics | Named armor sets, legendary origins | Named creatures from lore bible |

### Naming Rules
- [ ] Item names reflect the zone's environment and materials (cave=rough minerals, peaks=wind/stone, grove=flora/fey)
- [ ] **Common (Rarity 0)**: Descriptive, utilitarian — *what it is* (Iron Sword, Padded Vest)
- [ ] **Uncommon (Rarity 1)**: Slightly better craft — *a step above basic* (Reinforced Blade, Sturdy Leather)
- [ ] **Rare (Rarity 2)**: Environmental flavor — *where it's from* (Galeforged Blade, Ridgeline Bow)
- [ ] **Epic (Rarity 3)**: Evocative, unique identity — *what it does/means* (Stormcaller, Voidtouched Mantle)
- [ ] **Legendary (Rarity 4)**: Named, storied — *who made it or what happened* (Vel's Last Arrow, The Unbroken Wall)
- [ ] Monster names use zone-specific fauna/creatures, not generic fantasy (no "Goblin", "Skeleton")
- [ ] Monster weapon names are thematic attacks, not equipment (Razor Talons, Gale Screech, Thorn Lash)
- [ ] Consumable names escalate: Zone 1 = "potion", Zone 2 = "draught/elixir", Zone 3 = "essence/tincture"
- [ ] Vendor trash names tell micro-stories about the zone (Cracked Expedition Compass, Wind-Bleached Bone)
- [ ] No duplicate names across ANY zone — zone loader resolves items by name globally

## 1.3 Map Layout

- [ ] Grid dimensions (default 10x10)
- [ ] Spawn point coordinates
- [ ] Safe zone boundaries (PvE only)
- [ ] Danger zone boundaries (PvP enabled)
- [ ] Shop location(s)
- [ ] Fragment trigger tile(s)
- [ ] Points of interest (ruins, landmarks, transitions)
- [ ] Mob spawn rules (level range by distance from spawn)
- [ ] Zone transition tiles (entry from previous zone, exit to next zone)
- [ ] Zone feature locations (boss arena, quest givers, PvP arena — see §1.9)

## 1.4 Monsters (10 per zone, one per level)

- [ ] Class sequence designed (W/R/M spread, irregular pattern)
- [ ] No exploitable pattern in class ordering
- [ ] Each monster has:
  - [ ] Name (follows zone naming conventions — see §1.2)
  - [ ] Level
  - [ ] Class (0=Warrior, 1=Rogue, 2=Mage)
  - [ ] HP, STR, AGI, INT, ARM
  - [ ] XP reward
  - [ ] Monster weapon (0% drop, combat-only)
  - [ ] Loot table (weapons, armor, consumables)
  - [ ] Flavor description (2-3 sentences)
- [ ] Stats validated against player power budget at entry/exit level
- [ ] XP curve continues smoothly from previous zone
- [ ] Monster descriptions connect to zone theme and lore

## 1.5 Items — Weapons

### Rarity Tiers (code: uint256 rarity 0-4)
| Rarity | Code | Zone Placement | Drop Rate Target | Purpose |
|--------|------|----------------|-------------------|---------|
| Common | 0 | Entry zone / shop stock | 60-75% | Baseline, purchasable safety net |
| Uncommon | 1 | Early zone | 50-65% | First small upgrade |
| Rare | 2 | Mid zone | 35-50% | Meaningful upgrade, build options |
| Epic | 3 | Late zone | 20-35% | Build-defining, hybrid options |
| Legendary | 4 | Zone boss / endzone | 10-20% | Aspirational, carries into next zone |

### Player Weapons (5 tiers)
- [ ] **Common (Rarity 0)** — 3 weapons (STR/AGI/INT), available in shop
- [ ] **Uncommon (Rarity 1)** — 3 weapons (STR/AGI/INT), early drops
- [ ] **Rare (Rarity 2)** — 3-4 weapons (pure stat + 1 hybrid)
- [ ] **Epic (Rarity 3)** — 4-6 weapons (pure + hybrid builds for multi-stat classes)
- [ ] **Legendary (Rarity 4)** — 2-3 weapons (zone's best, aspirational)
- [ ] Each weapon has:
  - [ ] Name (follows zone naming conventions)
  - [ ] Damage type (Physical / Magic)
  - [ ] Min/Max damage range
  - [ ] Stat bonuses (STR, AGI, INT, HP)
  - [ ] Base price
  - [ ] Drop chance percentage (scaled by rarity tier)
  - [ ] Stat requirements (minSTR, minAGI, minINT — NO minLevel)
  - [ ] Rarity tier (0-4)
  - [ ] Flavor description
- [ ] Hybrid weapons exist for multi-stat classes (Druid, Warlock, Sorcerer, Paladin)
- [ ] Damage ranges scale above previous zone's best
- [ ] Stat requirements are reachable at appropriate level
- [ ] At least one weapon per rarity tier for each primary stat (STR/AGI/INT)

### Monster Weapons
- [ ] One per monster (10 total)
- [ ] dropChance: 0, price: 0
- [ ] Damage range appropriate for monster level
- [ ] Named as thematic attacks, not equipment (claws, screams, magic blasts)

## 1.6 Items — Armor

### Player Armor (5 tiers)
- [ ] **Common (Rarity 0)** — 3 armor (Plate/Leather/Cloth), available in shop
- [ ] **Uncommon (Rarity 1)** — 3 armor (Plate/Leather/Cloth), early drops
- [ ] **Rare (Rarity 2)** — 3-4 armor (one per type + hybrid)
- [ ] **Epic (Rarity 3)** — 3-4 armor (pure + hybrid builds)
- [ ] **Legendary (Rarity 4)** — 2-3 armor (zone's best, aspirational)
- [ ] Each armor piece has:
  - [ ] Name (follows zone naming conventions)
  - [ ] Armor type (Plate / Leather / Cloth)
  - [ ] Stat bonuses (STR, AGI, INT, HP)
  - [ ] Armor value
  - [ ] Base price
  - [ ] Drop chance percentage (scaled by rarity tier)
  - [ ] Stat requirements
  - [ ] Rarity tier (0-4)
  - [ ] Flavor description
- [ ] At least one hybrid armor per tier for multi-stat builds
- [ ] Armor values scale above previous zone's best

## 1.7 Items — Consumables

- [ ] **Healing potions** — 2-3 tiers scaling with zone level
- [ ] **Stat buffs** — STR/AGI/INT versions, scaled up from previous zone
- [ ] **Utility** — antidote, zone-specific debuff cure, tactical item (blind/stun)
- [ ] **Vendor trash** — 4-6 thematic drops with lore-flavored descriptions and zone-specific naming
- [ ] Each consumable has:
  - [ ] Name (escalating terminology — see §1.2)
  - [ ] Effect (heal amount, buff value, duration)
  - [ ] Base price
  - [ ] Rarity
  - [ ] Drop chance
  - [ ] Flavor description
- [ ] Buff values scale from previous zone (Zone 1: +5, Zone 2: +8, Zone 3: +12, Zone 4: +16)
- [ ] Zone-specific debuff cure exists if zone has a signature debuff

## 1.8 Class Abilities (1-2 new abilities per class per zone)

Each zone unlocks new abilities for all 9 advanced classes, tied to the level milestones in that zone. Abilities are learned from the zone's mentor NPC and purchased with gold.

### Ability Schedule (from Lore Bible)
| Zone | Levels | Ability Milestone(s) | Gold Cost |
|------|--------|----------------------|-----------|
| 1 (Dark Cave) | 1-10 | Class selection at Lv10 (no abilities yet) | — |
| 2 (Windy Peaks) | 11-20 | **Lv15**: 1st ability (9 total, one per class) | 600-750g |
| 3 (Mystic Grove) | 21-30 | **Lv20**: 2nd ability, **Lv25**: 3rd ability (18 total) | 2,000g / 5,000g |
| 4+ | 31-40 | **Lv30**: Ultimate ability (9 total) | 12,000-15,000g |

### Per-Zone Ability Checklist
- [ ] Which level milestone(s) fall in this zone's range?
- [ ] 1 or 2 new abilities designed per class (9 or 18 total)
- [ ] Each ability has:
  - [ ] Name (thematic to class identity)
  - [ ] Class it belongs to
  - [ ] Level requirement
  - [ ] Gold cost (escalates per tier)
  - [ ] Effect description (damage, healing, buff, CC, utility)
  - [ ] Duration / cooldown / range / targeting
  - [ ] Any unique conditions (once per day, channel time, health threshold)
- [ ] Abilities interact meaningfully with zone mechanics and monsters
- [ ] No ability trivializes the zone
- [ ] Abilities create interesting choices between classes, not strict upgrades
- [ ] Gold cost is achievable by zone entry

## 1.9 Zone Feature — New Gameplay Mechanic

Every zone introduces at least one new gameplay mechanic to keep the game feeling fresh.

### Design Principles
- Feature feels **native to the zone** — motivated by environment, lore, or monsters
- **Simple to learn**, deep enough to master
- Creates **new player stories** — emergent moments worth talking about
- Remains relevant after leaving the zone

### Feature Ideas (pick 1-2 per zone, or invent new ones)

**Combat & Encounters**
- [ ] Elite/Boss monsters — rare, powerful variants with unique loot and mechanics
- [ ] Multiplayer boss fights — cooperative encounters requiring 2+ players
- [ ] PvP arena — structured 1v1 or team PvP with rankings
- [ ] Multi-PvP — free-for-all or team battles in danger zones
- [ ] Environmental hazards — terrain effects during combat (wind knockback, falling rocks, poison fog)

**Exploration & Quests**
- [ ] Solo quests — objectives while exploring (rescue NPC, clear infestation, find lost item)
- [ ] Bounty board — rotating kill/collection tasks with bonus rewards
- [ ] Hidden areas — secret tiles unlocked by puzzles or conditions
- [ ] Timed events — zone-wide events on a schedule (storm on peaks, bloom in grove)
- [ ] Exploration objectives — discover all points of interest for zone completion reward

**Social & Economy**
- [ ] Player trading — direct item/gold exchange at shop locations
- [ ] Faction missions — Covenant vs Unbound objectives advancing faction war
- [ ] Crafting — combine vendor trash + materials into useful items
- [ ] Gambling/risk encounters — stake gold or items for better rewards

**Progression & Rewards**
- [ ] Zone mastery — bonus rewards for zone completion under specific conditions
- [ ] Class-specific challenges — unique objectives per class with exclusive rewards
- [ ] Achievement system — tracked accomplishments with rewards
- [ ] Leaderboards — per-zone rankings (fastest clear, most kills, lowest deaths)

### Feature Checklist
- [ ] Feature(s) chosen for this zone (1-2)
- [ ] Feature is thematically motivated by the zone's environment/lore
- [ ] Feature has clear player-facing rules (how to start, what to do, what you get)
- [ ] Feature doesn't break existing progression (optional enhancement, not gate)

### Planned Feature Roadmap
| Zone | Feature(s) | Status |
|------|-----------|--------|
| 1 (Dark Cave) | Core game loop (combat, loot, shop, fragments) | Shipped |
| 2 (Windy Peaks) | *TBD* | Design |
| 3 (Mystic Grove) | *TBD* | Design |
| 4+ | *TBD* | Design |

## 1.10 Staggering & Loot Table Balance

- [ ] **Staggering validated**: No class gets weapon + armor upgrade from the same monster
- [ ] STR weapon drops from one monster, STR armor from a different (later) monster
- [ ] Same for AGI and INT
- [ ] Consumable buffs drop BEFORE the next encounter where they're most useful
- [ ] **Rarity staggering**: Common/Uncommon from early monsters, Rare from mid, Epic from late, Legendary from boss
- [ ] Zone boss drops all Legendary armor (guarantees access at max difficulty)
- [ ] Loot tables reviewed for each monster — appropriate mix
- [ ] Drop rates decrease with rarity (Common 60-75%, Uncommon 50-65%, Rare 35-50%, Epic 20-35%, Legendary 10-20%)

## 1.11 Status Effects

- [ ] Zone signature debuff designed (thematic to environment)
- [ ] Corresponding cure consumable exists
- [ ] New buff effects for upgraded consumables
- [ ] Each effect has:
  - [ ] Unique ID (bytes32)
  - [ ] Stat modifiers (STR, AGI, INT, armor, hit)
  - [ ] Duration (turns)
  - [ ] Cooldown
  - [ ] Max stacks
  - [ ] Type (buff / debuff / DoT)
- [ ] Effects reviewed for class balance — no single class disproportionately punished
- [ ] Base physical/magic damage effects carried over from Zone 1

## 1.12 Shop(s)

- [ ] NPC name and role
- [ ] Map position
- [ ] Starting gold, max gold
- [ ] Price markup (buy multiplier) / markdown (sell multiplier)
- [ ] Inventory list with stock amounts and restock quantities
- [ ] Sells Common-tier zone weapons and armor (safety net)
- [ ] Sells all healing potions and buff consumables
- [ ] Sells utility items (antidote, zone debuff cure, tactical items)
- [ ] Pricing validated — players can afford entry gear with gold earned from previous zone
- [ ] NPC has character description and lore connection
- [ ] NPC quotes (first meeting, idle, milestone)

## 1.13 Lore Fragments (8 per zone)

- [ ] 8 fragments designed, continuing numbering from previous zone
- [ ] **Diverse trigger types** — no two fragments use the same action:
  - [ ] Zone transition / first entry
  - [ ] Exploration (reach specific tile)
  - [ ] Shop interaction (buy/sell)
  - [ ] Combat survival (win at low HP)
  - [ ] Progression milestone (reach level X)
  - [ ] Equipment (equip specific rarity)
  - [ ] Death (die in zone)
  - [ ] Class selection / other milestone
- [ ] Each fragment has:
  - [ ] Number and title
  - [ ] Trigger condition (specific and implementable)
  - [ ] Action type label
  - [ ] Full prose text (3-6 paragraphs, matches existing tone)
  - [ ] Narrative purpose (what does the player learn?)
- [ ] Fragment progression tells a coherent sub-story
- [ ] At least one fragment hints at the NEXT zone
- [ ] At least one fragment ties to the zone's new feature (§1.9)
- [ ] Trigger hooks identified in contract code (existing or needs new)

## 1.14 NPC & Character Placement

- [ ] **Mentor NPC** for this zone identified (from lore bible):
  - Zone 2: Vel (The Blade) — combat trainer
  - Zone 3: Edric (The Mender) — healer/support trainer
  - Zone 4: Senna (The Broker) — tactical/economic trainer
- [ ] Mentor teaches this zone's class abilities (see §1.8)
- [ ] Mentor has ability-purchase dialogue and quest/training scenes
- [ ] **Shop NPC** placed with character description and lore connection
- [ ] Supporting NPCs placed (quest givers, faction representatives)
- [ ] NPC arcs reference previous zone events
- [ ] Faction presence designed (Covenant/Unbound signs, graffiti, camps)

## 1.15 Class Balance Review

- [ ] Player power budget calculated at zone entry and exit
- [ ] **New abilities factored into power budget**
- [ ] Each of the 9 advanced classes can progress through the zone
- [ ] No class is unplayable against the monster roster
- [ ] Class spells interact meaningfully with zone mechanics
- [ ] Zone signature debuff doesn't disproportionately punish one stat
- [ ] Hybrid items exist for multi-stat classes
- [ ] Combat triangle engagement: roughly equal W/R/M monsters
- [ ] Documented which classes are strong/weak in this zone
- [ ] **Zone feature (§1.9) doesn't unfairly favor one class**

## 1.16 Economy Validation

- [ ] Gold drops from zone monsters cover consumable costs
- [ ] Entry gear (Common tier) is purchasable from previous zone's gold
- [ ] Shop prices don't create impossible gold walls
- [ ] Vendor trash prices are meaningful but not farm-worthy
- [ ] **Ability costs are achievable** — players can afford at least 1 ability by milestone level
- [ ] **Total gold sinks validated**: gear + abilities + consumables don't exceed gold income
- [ ] XP curve validated — time to clear zone is appropriate
- [ ] Drop rates set per rarity tier
- [ ] Anti-farming: no gold drops if player 5+ levels above mob
- [ ] **No gold duplication vectors** via shop buy/sell price gaps
- [ ] **Cross-zone economy**: gold earned in this zone doesn't trivialize next zone's shop

---

# Phase 2: Art & Visual Assets

Zone identity isn't just data — it's visual. Every zone should look and feel distinct.

## 2.1 Zone Theming

- [ ] **Color palette** defined for this zone (UI accents, backgrounds, borders)
  - Dark Cave: dark grays, purples, amber torchlight
  - Windy Peaks: slate blue, snow white, storm gray
  - Mystic Grove: deep green, gold, bioluminescent teal
- [ ] **Map tileset** — ground, walls, obstacles, transitions match zone environment
- [ ] **Background art** or atmosphere effect for the game board
- [ ] **UI skin** — how does the zone's theme affect panels, buttons, cards?

## 2.2 Item Art

- [ ] **Weapon icons** — at minimum one icon per rarity tier (5 total), ideally per item
- [ ] **Armor icons** — at minimum one per armor type per tier
- [ ] **Consumable icons** — healing potions, buffs, utility items
- [ ] **Vendor trash icons** — can be generic per zone or per item
- [ ] Rarity tier visual treatment (border glow, color coding):
  - Common: gray/white border
  - Uncommon: green border
  - Rare: blue border
  - Epic: purple border
  - Legendary: gold/orange border + glow effect
- [ ] Icons uploaded and `metadataUri` fields populated in items.json

## 2.3 Monster Art

- [ ] **Monster portraits/sprites** — one per monster (10 total)
- [ ] Art matches flavor descriptions from §1.4
- [ ] Elite variant visual treatment (if elite monsters are a zone feature)
- [ ] Art uploaded and `metadataUri` fields populated in monsters.json

## 2.4 NPC Art

- [ ] **Mentor NPC portrait** (for dialogue/training screens)
- [ ] **Shop NPC portrait** (for shop interaction)
- [ ] Supporting NPC art (if applicable)

## 2.5 Fragment Art

- [ ] Fragment card art or border design (consistent with zone theme)
- [ ] Impression tile visual on the map

---

# Phase 3: Data Files (JSON)

Convert the design into actual zone data files matching Dark Cave format.

## 3.1 File Creation

- [ ] `zones/<zone_name>/manifest.json`
- [ ] `zones/<zone_name>/items.json`
- [ ] `zones/<zone_name>/monsters.json`
- [ ] `zones/<zone_name>/effects.json`
- [ ] `zones/<zone_name>/shops.json`
- [ ] All files follow exact format of `zones/dark_cave/` equivalents
- [ ] Item names are unique across ALL zones (zone loader resolves by name)
- [ ] Monster names are unique across ALL zones
- [ ] Effect IDs are unique (new bytes32 hashes)
- [ ] **Naming conventions (§1.2) verified** — all names match zone identity
- [ ] `metadataUri` fields populated with IPFS/HTTP links to art assets (§2)

## 3.2 Data Validation

- [ ] Every item has all required fields (no missing stats, prices, or requirements)
- [ ] Every monster's loot table references valid item names from this zone's items.json
- [ ] Every weapon's effects array references valid effect IDs from effects.json
- [ ] Shop inventory references valid item names
- [ ] Stat requirements are integers, not floats
- [ ] Prices are in correct denomination (gold uses 18 decimals: "5" = 5 * 10^18)
- [ ] No negative stats or negative prices

---

# Phase 4: Contract Changes

Update smart contracts for the new zone, abilities, features, and any schema changes.

## 4.1 Zone Infrastructure

- [ ] **Multi-zone spawn system**: Update `MapSpawnSystem.sol` to support zone-aware spawning (currently hardcoded to Dark Cave's `(0,0)` origin and two distance bands)
- [ ] **Zone transition system**: Contract logic for players to move between zones (level check, position update)
- [ ] New zone ID constant added to `constants.sol` (e.g., `ZONE_WINDY_PEAKS = 2`)
- [ ] Zone map config registered (grid size, spawn point, boundaries)

## 4.2 Rarity System Update

- [ ] **If this is the first zone after Dark Cave**: Rarity range updated from 0-3 to 0-4 in contracts
- [ ] Zone loader updated to handle rarity 4 (Legendary)
- [ ] Client updated to display 5th rarity tier with appropriate styling

## 4.3 Ability System

- [ ] **Ability contract system** implemented (if not yet built):
  - Ability registration (name, class, level requirement, gold cost, effects)
  - Ability purchase flow (gold deduction, ability grant to character)
  - Ability use in combat (cooldown, targeting, damage/healing/CC)
- [ ] New abilities registered for this zone's milestone levels
- [ ] Mentor NPC ability-teaching logic implemented

## 4.4 Zone Feature Contracts

- [ ] New systems or extensions for §1.9 feature implemented
- [ ] Feature contracts have proper access control
- [ ] Feature contracts use `PauseLib.requireNotPaused()`

## 4.5 Fragment System

- [ ] New fragment types added to `common.sol` enum (if new trigger types)
- [ ] Fragment trigger hooks added to relevant systems
- [ ] Fragment mob IDs updated in `constants.sol` if fragment triggers reference specific monsters
- [ ] No hardcoded Dark Cave assumptions in fragment triggers

## 4.6 Hardcoded Reference Cleanup

- [ ] `MapContext.tsx` `SHOP_MOB_ID_TO_NAME` — make dynamic or extend for new zone shops
- [ ] `constants.sol` fragment mob ID constants — parameterize or add new zone's IDs
- [ ] Any other single-zone assumptions identified and fixed

## 4.7 Build & Test

- [ ] `forge build` passes
- [ ] `forge test` passes (update any struct constructors if schema changed)
- [ ] New tests written for:
  - [ ] New ability system (purchase, use, cooldown)
  - [ ] Zone transition logic
  - [ ] New zone feature contracts
  - [ ] New status effects
- [ ] Existing tests still pass (regression check)

---

# Phase 5: Deployment

Deploy zone data and contracts to the target environment.

## 5.1 Pre-Deployment

- [ ] Apply MUD CLI patch (see deploy-guide.md — REQUIRED after any `pnpm install`)
- [ ] Target environment confirmed (beta on dev branch, production on main)
- [ ] `WORLD_ADDRESS` verified — never fresh deploy on existing world
- [ ] Backup world state before mainnet deploy

## 5.2 Contract Deployment

- [ ] `mud deploy --profile base-mainnet --worldAddress $WORLD_ADDRESS`
- [ ] Function selectors verified after deploy
- [ ] New system addresses confirmed

## 5.3 Data Seeding (order matters!)

- [ ] Effects seeded first (items reference effect IDs)
- [ ] Items seeded second (monsters reference item names)
- [ ] Monsters seeded third
- [ ] Shops seeded last (reference item names)
- [ ] Abilities seeded (if new ability system data)
- [ ] **No re-seeding existing data** (creates duplicates — counters increment, old data stays)

## 5.4 Post-Deployment Verification

- [ ] Spot-check: at least one monster, one item, one shop confirmed on-chain
- [ ] Fragment triggers tested (mint works, no duplicate mints)
- [ ] Zone feature tested end-to-end on testnet
- [ ] Ability purchase flow tested
- [ ] Zone transition tested (entering from previous zone)

## 5.5 Rollback Plan

- [ ] Document what to do if seeding fails halfway:
  - Which data was already written?
  - Can remaining data be seeded separately?
  - Are there orphaned items/effects that need cleanup?
- [ ] Admin functions available to fix or remove bad data
- [ ] Pause system ready to activate if critical issues found

---

# Phase 6: Client Updates

Update the frontend to support the new zone.

## 6.1 Zone UI

- [ ] Zone appears on world map / zone selection (if zone selector exists)
- [ ] Zone-specific **color scheme** applied (from §2.1)
- [ ] Zone-specific **background/atmosphere** rendering
- [ ] Zone transition UX works (entering from previous zone)

## 6.2 Content Display

- [ ] New items render correctly (names, descriptions, stats, **rarity colors**)
- [ ] New item **icons/images** display (from §2.2)
- [ ] New monsters render correctly with **art/portraits** (from §2.3)
- [ ] New shop NPC accessible with **portrait** (from §2.4)
- [ ] New status effects display correctly in combat
- [ ] New fragment UI works (trigger → echo → claim → display)

## 6.3 Ability UI

- [ ] Ability purchase screen (mentor NPC interaction)
- [ ] Ability display in character sheet
- [ ] Ability hotbar/combat integration
- [ ] Ability cooldown visualization

## 6.4 Zone Feature UI

- [ ] New screens, interactions, or HUD elements for §1.9 feature
- [ ] Feature tutorial or first-time guidance

## 6.5 Hardcoded Fixes

- [ ] `SHOP_MOB_ID_TO_NAME` in `MapContext.tsx` updated or made dynamic
- [ ] Any other zone-1-only UI assumptions fixed

## 6.6 Build Verification

- [ ] `pnpm build` passes (no TypeScript errors, no broken imports)
- [ ] Mobile responsive — test on phone browser
- [ ] Loading states work for new data (items, monsters, abilities)

---

# Phase 7: Security Review

Dedicated security pass before anything goes live.

## 7.1 Contract Security

- [ ] **Access control**: All admin/system functions use `_requireAccess`, `_requireOwner`, or `_requireSystemOrAdmin`
- [ ] **Pause integration**: All new user-facing entry points use `PauseLib.requireNotPaused()`
- [ ] **Input validation**: New systems validate all inputs (level ranges, stat bounds, item existence)
- [ ] **Reentrancy**: No external calls before state changes (CEI pattern)
- [ ] **Integer overflow**: Stat additions, gold calculations, effect stacking can't overflow
- [ ] **Effect stacking abuse**: New status effects can't stack to create invincibility or infinite damage
- [ ] **Gold exploits**: Shop buy/sell prices don't allow gold duplication (buy low, sell high)
- [ ] **XP exploits**: No way to farm XP from zone monsters at inappropriate levels
- [ ] **Ability exploits**: New abilities can't be chained or stacked to bypass cooldowns
- [ ] **Cross-zone exploits**: Players can't use zone transition to duplicate items or escape combat

## 7.2 Data Integrity

- [ ] All item stats are within expected ranges (no accidentally 999999 damage weapon)
- [ ] All monster stats are within expected ranges for their level
- [ ] Effect durations and magnitudes are reasonable (no permanent buffs, no instant-kill debuffs)
- [ ] Drop chances sum to < 100% per monster (sanity check)
- [ ] No item with 0 price AND high drop chance (infinite gold via vendor)

## 7.3 Client Security

- [ ] No `dangerouslySetInnerHTML` with user/chain data
- [ ] No client-side authority over game state
- [ ] Item/monster metadata URIs validated (no javascript: or data: URIs)
- [ ] Transaction error messages don't leak internal details

---

# Phase 8: QA & Testing

Structured testing before launch.

## 8.1 Balance Playtesting

- [ ] Play through the zone as each base class archetype (STR/AGI/INT)
- [ ] Verify no class hits a hard wall (unbeatable monster, unaffordable gear)
- [ ] Verify gold income covers expenses (consumables, gear, abilities)
- [ ] Verify XP curve feels right (not too grindy, not too fast)
- [ ] Test with minimum gear (shop Common only) and maximum gear (previous zone Legendary)

## 8.2 End-to-End Flows

- [ ] New player → Zone 1 → Zone transition → Zone 2 (full flow)
- [ ] Buy all shop items → verify correct items, prices, inventory
- [ ] Fight every monster → verify loot drops, XP, gold
- [ ] Trigger every fragment → verify mint, display, no duplicates
- [ ] Purchase abilities from mentor → verify gold deduction, ability granted
- [ ] Use abilities in combat → verify effects, cooldowns, damage
- [ ] Zone feature flow → complete start to finish
- [ ] Die in zone → verify death handling, respawn, penalties

## 8.3 Edge Cases

- [ ] What happens if player is too low level for this zone?
- [ ] What happens if player has no gold and no gear?
- [ ] What happens if zone seeding is partially complete?
- [ ] What happens if player disconnects mid-combat?
- [ ] What happens if two players trigger the same fragment simultaneously?

## 8.4 Regression

- [ ] All Zone 1 content still works correctly
- [ ] Existing characters unaffected by new zone data
- [ ] Previous zone's shop, monsters, items unchanged
- [ ] `forge test` still passes
- [ ] `pnpm build` still passes

---

# Phase 9: Community & Launch

Coordinate the zone launch externally.

## 9.1 Community Communications

- [ ] **Teaser announcement** (1-2 weeks before) — hint at the zone without full reveal
  - [ ] Twitter/X thread with zone concept art or lore teaser
  - [ ] Forum post on Discourse (patch notes category)
  - [ ] Email to mailing list (via Resend) with teaser
- [ ] **Launch announcement** (day of)
  - [ ] Twitter/X thread with full zone details, screenshots, key features
  - [ ] Forum post with patch notes (auto-generated from release tag via `release.yml`)
  - [ ] Email blast to mailing list
  - [ ] Discord announcement (if applicable)
- [ ] **Guide/walkthrough** (day of or day after)
  - [ ] Forum post: new monsters, items, abilities overview (spoiler-tagged)
  - [ ] Tips for each class in the new zone

## 9.2 Content Assets for Comms

- [ ] Screenshots of the new zone (map, combat, shop, items)
- [ ] Zone banner/header image for social media
- [ ] Short description for link previews (Twitter cards, OG tags)
- [ ] Key feature highlights (1-3 bullet points for announcements)

## 9.3 Website Updates

- [ ] Landing page reflects new content (if applicable)
- [ ] OG meta tags updated if zone launch changes the pitch
- [ ] SEO: new pages/routes have proper Helmet titles and meta descriptions

---

# Phase 10: Documentation

Update all docs to stay in sync.

## 10.1 Game Docs

- [ ] Lore bible updated with zone lore section
- [ ] `LORE_NFT_FRAGMENTS.md` updated with new fragments
- [ ] `GAME_DESIGN.md` zone table updated
- [ ] `GAME_DESIGN.md` updated with new abilities for this zone's milestone(s)
- [ ] `GAME_DESIGN.md` updated with zone feature mechanics

## 10.2 Technical Docs

- [ ] `game-balance.md` (memory file) updated with new item ID mappings
- [ ] `deploy-guide.md` updated if deploy process changed
- [ ] `constants.sol` zone ID constants documented
- [ ] Any new contract systems documented in `SYSTEM_ARCHITECTURE.md`

## 10.3 Operational

- [ ] Launch checklist updated
- [ ] This zone checklist marked complete for the zone
- [ ] SESSION.md updated with deployment status
- [ ] Post-mortem notes if anything went wrong during deploy

---

# Quick Reference Tables

## Scaling Targets

| Zone | Levels | Stat Pts/Zone | HP/Zone | Buff Size | Heal Top | Monster HP Range | Monster Stat Range |
|------|--------|---------------|---------|-----------|----------|------------------|--------------------|
| 1 (Dark Cave) | 1-10 | +10 | +20 | +5 | 75 | 10-48 | 11-44 total |
| 2 (Windy Peaks) | 11-20 | +5 | +10 | +8 | 120 | 45-100 | 36-62 total |
| 3 (Mystic Grove) | 21-30 | +5 | +10 | +12 | 180 | 80-160 | 55-85 total |
| 4+ | 31-40 | +5 | +10 | +16 | 250 | 130-220 | 75-110 total |

## Rarity Tiers

| Rarity | Code | Drop Rate | Price Multiplier | Naming Style |
|--------|------|-----------|------------------|--------------|
| Common | 0 | 60-75% | 1x | Descriptive, utilitarian |
| Uncommon | 1 | 50-65% | 1.5-2x | Slightly better craft |
| Rare | 2 | 35-50% | 3-5x | Environmental flavor |
| Epic | 3 | 20-35% | 8-12x | Evocative, unique identity |
| Legendary | 4 | 10-20% | 15-25x | Named, storied |

## Ability Gold Sinks

| Level | Ability Tier | Gold Cost | Zone |
|-------|-------------|-----------|------|
| 10 | Class selection | Free | Zone 1 |
| 15 | 1st ability | 600-750g | Zone 2 |
| 20 | 2nd ability | 2,000g | Zone 3 |
| 25 | 3rd ability | 5,000g | Zone 3 |
| 30 | Ultimate | 12,000-15,000g | Zone 4 |

## Known Hardcoded References (must fix for multi-zone)

### Contracts
| File | What | Fix |
|------|------|-----|
| `MapSpawnSystem.sol` | Spawns from `(0,0)`, two distance bands | Zone-aware spawn config |
| `constants.sol:21` | `ZONE_DARK_CAVE = 1` only | Add new zone IDs |
| `constants.sol:77-79` | Fragment mob IDs hardcoded to Dark Cave | Parameterize per zone |
| Items table | Rarity is uint256, current range 0-3 | Extend to 0-4 |

### Client
| File | What | Fix |
|------|------|-----|
| `MapPanel.tsx:160` | "Dark Cave" zone name hardcoded | Dynamic from context |
| `MapPanel.tsx:36` | `MAP_SIZE = 10` hardcoded | Zone-configurable |
| `MapPanel.tsx:31-34` | `SAFE_ZONE_AREA` hardcoded `{0,4,4,0}` | Zone-configurable |
| `MapContext.tsx:44` | `SHOP_MOB_ID_TO_NAME` 4 shops hardcoded | Fetch from chain or extend |
| `MapContext.tsx:154` | Safe zone check `x<5 && y<5` | Zone-configurable bounds |
| `ActionsPanel.tsx:36-67` | `MONSTER_MOVE_MAPPING` mobId 1-30 | Fetch from chain or extend for new monsters |
| `fragmentNarratives.ts` | `TOTAL_FRAGMENTS = 8`, all Dark Cave lore | Per-zone fragment sets |
| `itemImages.ts` | 20 item names → image paths | Add new zone items |
| `monsterImages.ts` | 10 monster names → image paths | Add new zone monsters |
| `constants.ts:56-104` | `STATUS_EFFECT_NAME_MAPPING` 20 effects | Extend with new zone effects |

---

*Last updated: March 9, 2026*
