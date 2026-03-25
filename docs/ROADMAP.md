# Ultimate Dominion — Feature Roadmap

This document maps every planned feature area to the MUD tables already defined in `mud.config.ts`. The schema has been future-proofed — tables exist for systems that have not yet been built. This roadmap tracks what those tables represent, which ones are active today, and where each feature sits on the timeline.

**How to read this document:** Each feature area lists its MUD tables and marks them as **USED** (system code exists and references the table) or **UNUSED** (table defined in config, no system code yet). Links to design docs are provided where detailed designs exist.

---

## Tier 1: Imminent

Detailed design documents exist. Tables are defined. These are the next things to build.

---

### Guild System (MVP + Full)

The social backbone of the game. Guilds (called "Orders" in lore) give players a reason to depend on each other through a tax-funded treasury, regear insurance, territory control, and seasonal competition.

**Design doc:** [`docs/future/GUILDS.md`](future/GUILDS.md)

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Guild` | UNUSED | Guild identity, leader, tax rate, treasury balance, member count |
| `GuildMember` | UNUSED | Per-character guild membership, rank, join date, activity tracking |
| `GuildBuff` | UNUSED | Time-limited buffs purchased from guild treasury |
| `GuildContract` | UNUSED | Weekly cooperative objectives with progress tracking |
| `GuildSeason` | UNUSED | 12-week seasonal competition scoring per guild |
| `GuildWar` | UNUSED | Declared wars between guilds with kill tracking |
| `Territory` | UNUSED | Tile ownership by guilds in the danger zone |
| `TerritoryBonus` | UNUSED | XP/gold/drop rate bonuses on guild-held tiles |
| `RegearRequest` | UNUSED | Member requests for treasury gold after PvP death |

**Enums:** `GuildRank` (None, Member, Officer, Leader)

**Dependencies:** PvP system (live), combat gold rewards (live), danger zone (live)

**Implementation phases:** MVP ships tax + treasury + transfer. Then regear, buffs, territory, wars, seasons, and lore — each phase gated by validating the previous one. See the design doc for the full phased plan.

---

### Item Durability & Repair

The primary item sink. Weapons, armor, and accessories lose durability each combat. At zero, they become unusable until repaired. Repair costs burn gold permanently.

**Design doc:** [`docs/DURABILITY_SYSTEM.md`](DURABILITY_SYSTEM.md)

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `ItemDurability` | UNUSED | Max and current durability per item instance |

**Dependencies:** Combat system (live), equipment system (live), shop system (live)

**Notes:** Table is defined and codegen is complete. Needs: migration script for existing items, new `DurabilitySystem` contract (EncounterSystem is at 24KB limit — durability logic must be a separate system with a single external call), repair function in ShopSystem, client durability bars.

---

### Power Source Abilities

Transforms the power source choice (Divine/Weave/Physical) from flavor text into mechanical identity. 27 unique combinations (3 power sources x 9 advanced classes), each with a passive ability (level 5) and an active ability (level 10).

**Design doc:** [`docs/future/POWER_SOURCE_ABILITIES.md`](future/POWER_SOURCE_ABILITIES.md)

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `AbilityDefinition` | UNUSED | Ability metadata: name, cooldown, mana cost, level requirement, effects |
| `CharacterAbility` | UNUSED | Per-character ability state: level, last used timestamp |

**Dependencies:** Implicit class system (live), power source enum (live), combat system (live)

**Notes:** Phase 1 ships the 9 natural combinations with generic fallbacks for off-meta. Phase 2 expands all 18 off-meta combinations across 3 content updates. Requires combat system hooks for passive triggers (on-hit, on-damage, on-crit, on-spell, on-turn-start, on-kill).

---

### Inventory, Crafting & Consumables

Three interconnected systems: carry limits that force meaningful decisions, deterministic crafting that gives every drop long-term value, and tactical consumables used in and out of combat.

**Design doc:** [`docs/future/INVENTORY_CRAFTING_CONSUMABLES.md`](future/INVENTORY_CRAFTING_CONSUMABLES.md)

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `CraftingRecipe` | UNUSED | Recipe definitions: inputs, output, gold cost |
| `ActiveBoost` | UNUSED | Temporary stat buffs from consumables, shrines, etc. |
| `Cooldown` | UNUSED | Generic cooldown tracking for any entity + action |

**Dependencies:** Items system (live), shops (live), NPC system (live)

**Notes:** Inventory capacity tracking and `PendingDrop` escrow are described in the design doc but don't have dedicated tables yet (will need `InventoryCapacity` and `PendingDrop` added or handled via existing tables). Crafting phases: inventory limits first, then basic crafting, then equipment upgrades + salvage, then advanced consumables.

---

## Tier 2: Year 1

Design exists at varying levels of detail. Tables are defined. High priority after Tier 1 ships.

---

### Bounties & Daily Quests

Repeatable PvE objectives that give players a reason to log in every day. Kill X monsters, earn gold and XP rewards.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Bounty` | UNUSED | Bounty definition: target mob, required kills, rewards |
| `BountyProgress` | UNUSED | Per-character progress toward each bounty |
| `DailyReset` | UNUSED | Tracks daily reset timestamp per character |

**Dependencies:** Combat system (live), mob system (live)

---

### Quests

Structured multi-objective quests with prerequisites, rewards, and progress tracking. Supports kill, collect, and visit objectives.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Quest` | UNUSED | Quest definition: prereqs, rewards, repeatability |
| `QuestProgress` | UNUSED | Per-character quest status and timestamps |
| `QuestObjective` | UNUSED | Individual objectives within a quest |
| `QuestObjectiveProgress` | UNUSED | Per-character objective completion tracking |

**Enums:** `QuestStatus` (None, Available, Active, Completed, Failed)

**Dependencies:** Mob system (live), items system (live), map system (live)

---

### PvP Ratings & Seasons

ELO/MMR rating system for PvP with seasonal resets. Historical ratings archived per season.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `PvpRating` | UNUSED | Per-character ELO rating, wins, losses, current season |
| `PvpSeason` | UNUSED | Global season config: start/end timestamps |
| `PvpRatingHistory` | UNUSED | Archived final ratings at end of each season |

**Dependencies:** PvP system (live)

---

### Titles

Unlockable titles displayed on character profiles. Earned through achievements, zone completions, PvP milestones, etc.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `TitleDefinition` | UNUSED | Title metadata |
| `TitleUnlocked` | UNUSED | Which titles a character has earned |
| `ActiveTitle` | UNUSED | Currently displayed title per character |

**Dependencies:** None (standalone system, feeds off other systems for unlock triggers)

---

### Factions & Reputation

Named factions with per-character reputation scores. Reputation can go negative (hostile).

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Faction` | UNUSED | Faction definitions |
| `PlayerReputation` | UNUSED | Per-character per-faction reputation score |

**Dependencies:** NPC system (live), shop system (live — reputation could gate shop access)

---

### Player Lifetime Stats & Leaderboards

Aggregate lifetime statistics per character for rankings and achievement tracking.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `PlayerLifetimeStats` | UNUSED | Total kills, deaths, PvP stats, gold earned/spent |

**Dependencies:** Combat system (live), PvP system (live), gold system (live)

---

### Social Links

Friend, rival, and block relationships between characters.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `SocialLink` | UNUSED | Directional relationship between two characters |

**Enums:** `SocialLinkType` (None, Friend, Rival, Blocked)

**Dependencies:** Character system (live)

---

### Direct Player Trading

Face-to-face item and gold trading between two characters.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `TradeSession` | UNUSED | Trade state: initiator, target, status |
| `TradeOffer` | UNUSED | Per-slot offers within a trade (items + gold) |

**Enums:** `TradeStatus` (None, Pending, Accepted, Cancelled, Expired)

**Dependencies:** Items system (live), gold system (live)

---

### Mail System

Asynchronous item and gold delivery between characters.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Mail` | UNUSED | Message with optional gold/item attachment |

**Dependencies:** Items system (live), gold system (live)

---

### Death Penalty

Configurable gold loss on death. Tunable via admin.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `DeathPenaltyConfig` | UNUSED | Global config: gold loss percent, enabled flag |

**Dependencies:** Combat system (live), gold system (live)

---

### Enchantments

Modifiers applied to item instances that add or modify effects.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `EnchantmentDefinition` | UNUSED | Enchantment metadata and linked effects |
| `ItemEnchantment` | UNUSED | Which enchantment is on which item, at what tier |

**Dependencies:** Items system (live), effects system (live)

---

### Bank Storage

Persistent item storage beyond equipped/carried inventory.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `BankSlot` | UNUSED | Per-character per-item stored amounts |

**Dependencies:** Items system (live). Becomes critical when inventory limits ship.

---

## Tier 3: Year 2

Design is partial. Tables exist as scaffolding. Medium priority — dependent on earlier systems proving out.

---

### Talents

Skill tree or point-buy system for character specialization beyond class.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `TalentPoints` | UNUSED | Available and total earned points per character |
| `TalentChoice` | UNUSED | Per-character per-talent investment level |

**Dependencies:** Class system (live), level system (live)

---

### Parties

Formal group system for cooperative play. Leader-based with size limits.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Party` | UNUSED | Party metadata: leader, max size |
| `PartyMember` | UNUSED | Per-character party membership |

**Dependencies:** Character system (live). Becomes meaningful with group combat or world bosses.

---

### World Bosses / Raids

Server-wide boss encounters with contribution-based rewards.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `WorldBoss` | UNUSED | Boss instance: mob reference, HP, position, rewards |
| `WorldBossContribution` | UNUSED | Per-character damage contribution for reward splits |

**Dependencies:** Mob system (live), combat system (live), parties (Tier 3)

---

### World Events & Map Events

Global events (double XP, invasions, seasonal competitions) and per-tile events (treasure chests, wandering merchants, ambushes).

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `WorldEvent` | UNUSED | Global event definition and schedule |
| `EventParticipation` | UNUSED | Per-character participation and scoring |
| `MapEvent` | UNUSED | Tile-specific events with rewards and expiry |
| `MapEventParticipation` | UNUSED | Per-character interaction with map events |

**Dependencies:** Map system (live), combat system (live)

---

### Achievements

Unlockable milestones with point values. The "completionist" layer.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `AchievementDefinition` | UNUSED | Achievement metadata and point value |
| `AchievementUnlocked` | UNUSED | Per-character unlock timestamps |

**Dependencies:** Flexible — hooks into many systems as triggers

---

### Player Bounties

Trustless assassination contracts. Place gold in escrow, target a player, whoever kills them claims the bounty.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `PlayerBounty` | UNUSED | Bounty target, escrowed gold, claim status |

**Dependencies:** PvP system (live), gold escrow (live)

---

### Player Contracts

Player-created quests with escrowed gold. "Bring me 10 Rat Teeth and I'll pay you 50 gold."

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `PlayerContract` | UNUSED | Contract metadata, escrowed reward, expiry |
| `ContractRequirement` | UNUSED | Individual requirements within a contract |

**Dependencies:** Items system (live), gold escrow (live)

---

### Arena / Structured PvP

Queued matchmaking (1v1, 2v2, 3v3) with rating integration, equalized gear options, and seasonal rewards.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `ArenaQueue` | UNUSED | Per-character queue state and rating snapshot |
| `ArenaMatch` | UNUSED | Match metadata: type, timestamps, winner, season |
| `ArenaMatchParticipant` | UNUSED | Per-participant stats and rating changes |
| `ArenaSeasonReward` | UNUSED | Tier-based seasonal rewards |

**Dependencies:** PvP system (live), PvP ratings (Tier 2), parties (Tier 3)

---

### Rune Sockets

Composable item modification. Runes are separate tokens that socket into equipment slots.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `RuneDefinition` | UNUSED | Rune metadata, rarity, and effects |
| `ItemSocket` | UNUSED | Per-item per-slot rune assignment |

**Dependencies:** Items system (live), effects system (live), enchantments (Tier 2)

---

### Item Sets

Named collections of items that grant bonuses when multiple pieces are equipped (2-piece, 4-piece, etc.).

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `ItemSetDefinition` | UNUSED | Set name and member item IDs |
| `ItemSetBonus` | UNUSED | Bonus per piece threshold |
| `ItemSetMembership` | UNUSED | Reverse lookup: item to set |

**Dependencies:** Equipment system (live), effects system (live)

---

### Item Provenance & History

Permanent record of who crafted an item and every significant event in its lifetime (traded, dropped, looted, enchanted).

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `ItemProvenance` | UNUSED | Crafter, forge date, creation method |
| `ItemEvent` | UNUSED | Full event chain per item |

**Dependencies:** Items system (live), crafting (Tier 1), marketplace (live)

**Notes:** Aligns directly with the manifesto: "Everything here is permanent." Items accumulate story over time.

---

### Two-Sided Marketplace (Buy Orders)

Players post buy orders ("I want X of item Y at Z gold each") with escrowed gold. Sellers can fill them.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `BuyOrder` | UNUSED | Buy order with escrowed gold, quantity, fill tracking |

**Dependencies:** Marketplace system (live), gold escrow (live)

---

### Bestiary & Collection Log

Track every monster killed, item found, and location discovered. Knowledge ranks grant small combat bonuses.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `BestiaryEntry` | UNUSED | Per-character per-mob kill count and knowledge rank |
| `DiscoveryLog` | UNUSED | Per-character discovery timestamps |
| `CollectionProgress` | UNUSED | Category-level completion tracking |

**Dependencies:** Combat system (live), map system (live), items system (live)

---

### Wagered Duels

Trustless PvP stakes. Both players escrow gold and/or items. Winner takes all.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Wager` | UNUSED | Duel terms, escrowed stakes, resolution |

**Dependencies:** PvP system (live), gold escrow (live)

---

### Gravesites & Inscriptions

Permanent markers on the map. Gravesites record where characters died and who killed them. Inscriptions let players leave messages.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Gravesite` | UNUSED | Death location, killer, timestamp, PvP flag |
| `Inscription` | UNUSED | Player-authored messages on map tiles |

**Dependencies:** Map system (live), combat system (live)

**Notes:** Pure manifesto feature. The world remembers every death.

---

## Tier 4: Year 3+

Tables exist as forward-looking scaffolding. Design is TBD. These represent the long-term vision.

---

### Pets / Companions

Collectible creatures that accompany characters. Levelable with XP.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Pet` | UNUSED | Pet identity, type, level, XP, name |
| `PetEquipped` | UNUSED | Which pet a character has active |

**Dependencies:** Character system (live). Full design TBD.

---

### Life Skills & Gathering

Non-combat progression: mining, herbalism, etc. Resource nodes on the map. Ties into crafting.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `LifeSkillDefinition` | UNUSED | Skill metadata and max level |
| `CharacterLifeSkill` | UNUSED | Per-character skill level and XP |
| `ResourceNode` | UNUSED | Harvestable nodes on the map |
| `CraftingSkillRequirement` | UNUSED | Links recipes to skill level gates |

**Dependencies:** Crafting (Tier 1), map system (live)

---

### Player Housing

Claimable plots on the map with furniture that can grant gameplay bonuses.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `HousingPlot` | UNUSED | Plot location, owner, tier, maintenance costs |
| `HousingFurniture` | UNUSED | Per-slot furniture with optional bonuses |

**Dependencies:** Map system (live), gold sinks (multiple systems)

---

### Mounts

Rideable creatures with speed bonuses, levels, XP, and a breeding lineage system.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `MountDefinition` | UNUSED | Mount type metadata and speed bonus |
| `CharacterMount` | UNUSED | Individual mount instances |
| `MountEquipped` | UNUSED | Which mount a character is riding |
| `MountLineage` | UNUSED | Breeding: parent mounts, generation |

**Dependencies:** Character system (live), map system (live). Full design TBD.

---

### Transmog / Appearance

Cosmetic override system. Unlock appearances, apply them over real gear, dye equipment.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `AppearanceUnlocked` | UNUSED | Per-character appearance unlocks |
| `TransmogSlot` | UNUSED | Per-slot cosmetic override |
| `DyeColor` | UNUSED | Per-slot per-channel color customization |

**Dependencies:** Equipment system (live). Art pipeline needed.

---

### Mentoring

Formal mentor-apprentice relationships with tracked outcomes.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Mentorship` | UNUSED | Mentor-apprentice pair, start/end, level tracking |
| `MentorStats` | UNUSED | Per-character mentoring history and rank |

**Dependencies:** Character system (live), level system (live)

---

### Insurance

Item insurance policies. Pay a premium, get a payout if the item is lost.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `InsurancePolicy` | UNUSED | Per-item policy with premium, payout, expiry |
| `InsuranceConfig` | UNUSED | Global rates and limits |

**Dependencies:** Items system (live), gold system (live), PvP item loss (not yet live)

---

### Workers / Offline Progression

Hireable NPCs that perform tasks while you're offline: gather resources, craft items, sell goods.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Worker` | UNUSED | Worker identity, type, tier, level |
| `WorkerAssignment` | UNUSED | Active task, timing, results |
| `WorkerCapacity` | UNUSED | Per-character worker slots |

**Dependencies:** Crafting (Tier 1), life skills (Tier 4), gathering (Tier 4)

---

### Blueprints / Recipe Discovery

Tradeable recipe scrolls with limited uses. Originals have infinite uses; copies are consumable.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `BlueprintDefinition` | UNUSED | Blueprint-to-recipe mapping, original vs copy |
| `CharacterBlueprint` | UNUSED | Per-character blueprint ownership and uses remaining |

**Dependencies:** Crafting (Tier 1)

---

### Courier / Hauling Contracts

Transport items between map tiles. Hauler puts up collateral. Failure means the collateral goes to the contract creator.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `CourierContract` | UNUSED | Route, items, reward, collateral, completion state |

**Dependencies:** Map system (live), items system (live), gold escrow (live)

---

### Crafting Specialization

Characters specialize in crafting disciplines for bonus yield and material cost reduction.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `CraftingSpecialization` | UNUSED | Per-character per-specialization level, XP, bonuses |
| `CraftingSpecConfig` | UNUSED | Global config: max specializations, XP rates |

**Dependencies:** Crafting (Tier 1)

---

### Player Vendor Stalls

Persistent shops on the map. Sell items while offline. Daily gold maintenance cost.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `PlayerVendor` | UNUSED | Vendor identity, location, maintenance |
| `VendorListing` | UNUSED | Per-slot item listings with prices |
| `VendorSale` | UNUSED | Sale history (offchain table) |

**Dependencies:** Items system (live), marketplace (live), map system (live)

---

### Oaths / Blood Pacts

Sworn commitments between players. Breaking an oath has permanent, visible consequences.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Oath` | UNUSED | Two-party pact with type, breach tracking |

**Dependencies:** Character system (live), PvP system (live)

---

### Time-Locked Vaults

Lock items or gold until a specific timestamp. Provable scarcity.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `TimeVault` | UNUSED | Vault contents, unlock timestamp, state |

**Dependencies:** Items system (live), gold system (live)

---

### Character Wills / Inheritance

Trustless asset transfer after prolonged inactivity.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `CharacterWill` | UNUSED | Beneficiary, inactivity threshold, execution state |

**Dependencies:** Character system (live), items system (live)

---

### Character Legacy

Permanent record when a character dies or is retired. Total lifetime stats frozen in amber.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `CharacterLegacy` | UNUSED | Final stats snapshot at character death/retirement |

**Dependencies:** Character system (live), player lifetime stats (Tier 2)

---

### Karma / Alignment

Moral alignment system based on player actions. Outlaws lose town protections; heroes gain benefits.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Karma` | UNUSED | Score, PK history, alignment tier |
| `KarmaThreshold` | UNUSED | Tier definitions with gameplay consequences |

**Dependencies:** PvP system (live), shop system (live), NPC system (live)

---

### Stronghold / Personal Base

Individual player bases with upgradeable facilities, worker slots, crafting stations, and research trees.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `Stronghold` | UNUSED | Per-character base level, capacity |
| `StrongholdResearch` | UNUSED | Per-character research progress |
| `ResearchDefinition` | UNUSED | Research tree definitions |

**Dependencies:** Workers (Tier 4), crafting (Tier 1), gold sinks (multiple)

---

### Season Pass / Battle Pass

Tiered progression track with XP-gated rewards across a season. Includes per-season challenges.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `SeasonPass` | UNUSED | Season metadata and schedule |
| `SeasonPassTier` | UNUSED | Per-tier XP thresholds and rewards |
| `SeasonPassProgress` | UNUSED | Per-character progress and claimed tiers |
| `SeasonChallenge` | UNUSED | Per-season challenge definitions |
| `SeasonChallengeProgress` | UNUSED | Per-character challenge completion |

**Dependencies:** Multiple systems for challenge triggers

---

### Price History & Alerts

Offchain tracking of marketplace price averages and player-set price alerts.

**MUD tables:**
| Table | Status | Purpose |
|-------|--------|---------|
| `PriceHistory` | UNUSED | Per-item price averages and volume (offchain) |
| `PriceAlert` | UNUSED | Per-character price triggers (offchain) |

**Dependencies:** Marketplace system (live)

---

## Currently USED Tables (Live Systems)

For reference, the tables that are actively read/written by deployed system contracts:

| Category | Tables |
|----------|--------|
| **Core** | `Paused`, `Admin`, `RandomNumbers`, `Counters`, `UltimateDominionConfig`, `SessionConfig` |
| **Characters** | `Characters`, `CharacterOwner`, `Stats`, `ClassMultipliers`, `SessionTimer`, `Name`, `NameExists`, `StatRollCount`, `CharacterFirstActions` |
| **Items & Equipment** | `Items`, `StatRestrictions`, `WeaponStats`, `WeaponScaling`, `ArmorStats`, `AccessoryStats`, `SpellStats`, `ConsumableStats`, `StarterItems`, `ArmorStarterItems`, `StarterItemPool`, `StarterConsumables`, `AdvancedClassItems`, `CharacterEquipment` |
| **Combat** | `CombatEncounter`, `WorldEncounter`, `EncounterEntity`, `WorldStatusEffects`, `Effects`, `PhysicalDamageStats`, `MagicDamageStats`, `StatusEffectStats`, `StatusEffectTargeting`, `StatusEffectValidity`, `AdventureEscrow` |
| **Map** | `MapConfig`, `Spawned`, `Position`, `EntitiesAtPosition` |
| **Mobs** | `Mobs`, `MobStats`, `MobsByLevel`, `Levels` |
| **Marketplace** | `Orders`, `Considerations`, `Offers`, `ListingCooldown` |
| **Shops** | `Shops` |
| **Fragments** | `FragmentProgress`, `FragmentMetadata` |
| **Zones** | `ZoneCompletions`, `CharacterZoneCompletion`, `ZoneConfig` |
| **Delegation** | `AllowedGameSystems` |
| **Gas Station** | `GasStationConfig`, `GasStationCooldown`, `GasStationSwapConfig` |
| **Offchain** | `ActionOutcome`, `CombatOutcome`, `DamageOverTimeApplied`, `RngLogs`, `MarketplaceSale`, `ShopSale` |

---

## Contributing to Future Features

The table schema is already defined. If you want to build one of the unused systems:

1. **The tables are ready.** Every table listed as UNUSED in this document is defined in `mud.config.ts` with its full schema — keys, value types, and relationships. MUD codegen produces the Solidity libraries automatically. You do not need to modify the config to start writing system code.

2. **Start with the design doc.** If a design doc exists (Tier 1 features), read it thoroughly before writing code. The design docs contain architectural decisions, anti-patterns to avoid, balance considerations, and phased implementation plans. They are the source of truth.

3. **Write a new System contract.** MUD systems are stateless logic contracts that read and write tables through the World. Your system should live in `packages/contracts/src/systems/` and follow the existing patterns. Key rules:
   - Check the 24KB contract size limit. Large systems need to be split.
   - Use `delegatecall` patterns consistent with MUD v2.
   - Reference `AccessControl` patterns in existing admin systems.
   - Write Forge tests before deploying.

4. **Respect the dependency chain.** Features in higher tiers often depend on features in lower tiers. Check the "Dependencies" section for each feature before starting work.

5. **Test on beta first.** Beta world address: `0xeB023E9B5A0C452B202306eDa50255EfaF555426`. Deploy and validate there before touching production. See `docs/architecture/` for deployment guides.

6. **Keep the manifesto in mind.** Every system should make the world more permanent, more player-driven, and more worth coming back to in a year. If a feature doesn't pass that test, it doesn't ship.

---

*Last updated: March 9, 2026*
