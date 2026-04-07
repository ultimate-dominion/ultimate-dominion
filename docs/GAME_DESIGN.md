# Ultimate Dominion — Game Design Document

The canonical reference for all game mechanics. If something conflicts with this document, this document wins.

---

## Table of Contents

1. [Core Design Principles](#core-design-principles)
2. [Character Creation](#character-creation)
3. [Leveling & Progression](#leveling--progression)
4. [Advanced Classes](#advanced-classes)
5. [Combat System](#combat-system)
6. [Items & Equipment](#items--equipment)
7. [Economy](#economy)
8. [Map & Zones](#map--zones)
9. [PvP](#pvp)
10. [Lore Fragments](#lore-fragments)
11. [Badge System](#badge-system)
12. [Class Abilities](#class-abilities)

---

## Core Design Principles

1. **Items = Power**: ~60% of character power comes from equipment
2. **Leveling = Access**: Levels unlock content, item tiers, and provide modest stat gains
3. **Classes = Identity**: Classes provide % damage multipliers that scale with gear
4. **Player Choice**: Any advanced class can be selected regardless of build — no locked paths

---

## Character Creation

Character creation uses an **implicit class system**. Players make thematic choices that shape their starting stats, then select an advanced class at Level 10. There is no upfront "pick a class" screen.

### Step 1: Choose Race

| Race | STR | AGI | INT | HP | Flavor |
|------|-----|-----|-----|----|--------|
| Human | +1 | +1 | +1 | — | Balanced, versatile |
| Dwarf | +2 | -1 | — | +1 | Sturdy, strong |
| Elf | -1 | +2 | +1 | -1 | Agile, magical |

### Step 2: Choose Power Source

Thematic choice affecting flavor and providing a **Level 5 milestone bonus**. Does **NOT** restrict class selection.

| Power Source | Theme | Typical Playstyle | Level 5 Bonus |
|-------------|-------|-------------------|---------------|
| Divine | Holy/Nature magic | Healing, buffs, smiting | +2 HP (auto) |
| Weave | Arcane magic | Raw damage, control | +1 INT (auto) |
| Physical | Martial prowess | Weapons, tactics | +1 ability point (player allocates) |

### Step 3: Choose Starting Armor

| Armor | STR | AGI | INT | HP | Playstyle |
|-------|-----|-----|-----|----|-----------|
| Cloth | -1 | +1 | +2 | — | Caster-focused |
| Leather | +1 | +2 | — | — | Agility-focused |
| Plate | +2 | -1 | — | +1 | Strength-focused |

### Step 4: Roll Stats

Base stats are randomly generated then race/armor modifiers applied.

- **Stat pool**: 19 total points distributed across STR, AGI, INT
- **Range per stat**: 3–10
- **Base HP**: 18 (before race/armor modifiers)
- **Resulting starting HP**: ~15–20 depending on race/armor choices

**Example**: A Dwarf in Plate rolls STR 7, AGI 5, INT 7. After modifiers: STR 11 (+2 race, +2 plate), AGI 3 (-1 plate), INT 7, HP 20 (+1 race, +1 plate).

---

## Leveling & Progression

### Zone-Based Progression

Content is organized into zones of 10 levels each. The current level cap in code is 100, but the design intent is **10 levels per zone with new zones added over time**.

| Zone | Levels | Status |
|------|--------|--------|
| Dark Cave | 1–10 | `[IMPLEMENTED]` — testnet launch content |
| Zone 2 | 1–10 | `[PLANNED]` — mainnet launch |
| Zone 3 | 1–10 | `[PLANNED]` — mainnet launch |
| Future zones | 10 each | `[PLANNED]` — post-launch expansions |

### Stat Points Per Level

Stat gains diminish as you level, encouraging reliance on items.

| Level Range | Stat Points | Rate |
|-------------|-------------|------|
| 1–10 | +2 per level | Every level |
| 11–50 | +1 every 2 levels | Even levels only |
| 51–100 | +1 every 5 levels | Levels divisible by 5 |

**Total stat points (Level 1 → 100):** ~50 points

### HP Per Level

| Level Range | HP Gain |
|-------------|---------|
| 1–10 | +2 per level |
| 11–50 | +1 per level |
| 51–100 | +1 every 2 levels (even levels) |

**Total HP from leveling (Level 1 → 100):** ~65 HP

### XP Requirements

Shaped curve: fast to chat (L3), steep grind to class select (L10). ~29 gameplay hours to L10.

| Level | XP Required | Notes |
|-------|-------------|-------|
| 1 | 500 | |
| 2 | 2,000 | |
| 3 | 5,500 | Badge unlock (Adventurer / chat) |
| 4 | 25,000 | |
| 5 | 85,000 | Power source bonus |
| 6 | 200,000 | |
| 7 | 450,000 | |
| 8 | 900,000 | |
| 9 | 1,600,000 | |
| 10 | 2,500,000 | Advanced class selection |
| 11+ | prev + (level × 150,000) | Mid-game scaling |
| 51+ | prev + (level × 450,000) | Late-game scaling |

### Level Unlocks

- **Level 3**: Adventurer badge (unlocks chat)
- **Level 10**: Advanced class selection + class-specific starter gear
- **Higher levels**: Item tier requirements, new zone access

---

## Advanced Classes

### Selection

At **Level 10**, players choose one of 9 advanced classes. **Any class can be selected regardless of race, power source, or stats.** This allows creative builds and player expression.

### Class Bonuses

Each class provides flat stat bonuses (one-time) and percentage multipliers (scales with gear). Multipliers stored as basis points (1000 = 100%).

| Class | Flat Bonuses | Phys Dmg | Spell Dmg | Healing | Crit Dmg | Max HP |
|-------|-------------|----------|-----------|---------|----------|--------|
| **Warrior** | +3 STR, +10 HP | 110% | 100% | 100% | 100% | 100% |
| **Paladin** | +2 STR, +15 HP | 105% | 100% | 105% | 100% | 100% |
| **Ranger** | +3 AGI | 110% | 100% | 100% | 100% | 100% |
| **Rogue** | +2 AGI, +1 INT | 100% | 100% | 100% | 115% | 100% |
| **Druid** | +2 AGI, +2 STR | 105% | 105% | 100% | 100% | 105% |
| **Warlock** | +2 AGI, +2 INT | 100% | 120% | 100% | 100% | 100% |
| **Wizard** | +3 INT | 100% | 125% | 100% | 100% | 100% |
| **Cleric** | +2 INT, +10 HP | 100% | 100% | 110% | 100% | 100% |
| **Sorcerer** | +2 STR, +2 INT | 100% | 115% | 100% | 100% | 105% |

### How Multipliers Work

```
finalDamage = (baseDamage + itemDamage) × classMultiplier
```

A Warrior with 50 STR and a +100 damage weapon:
- Base calculation: 50 + 100 = 150 damage
- With 110% physical: 150 × 1.10 = **165 damage**

Better items = bigger multiplier benefit. Classes stay relevant at all levels.

### Class-Power Source Combinations

While any class can be chosen, thematic combinations exist:

| Power Source | Natural Fits |
|-------------|-------------|
| Divine | Paladin, Cleric, Druid |
| Weave | Wizard, Warlock, Sorcerer |
| Physical | Warrior, Ranger, Rogue |

These are flavor guidelines, not restrictions.

---

## Combat System

### Overview

Turn-based combat with a max of **15 turns** per encounter. Both PvE and PvP use the same core system.

### Hit Probability

- **Base**: 90%
- Modified by attacker/defender stat comparison
- **Min**: 5%, **Max**: 98%
- Dampeners prevent extreme swings (attacker dampener: 95, defender dampener: 30)

### Damage Calculation

```
weaponDamage = random(minDamage, maxDamage)
statBonus = primaryStat / 20
rawDamage = (weaponDamage + statBonus) × attackModifier
defense = armorValue × 1.0 (defense modifier)
damage = (rawDamage - defense) × classMultiplier × triangleBonus
```

**Attack modifiers**: STR weapons use 1.2× (120%), AGI weapons use 0.9× (90%).

On critical hit: damage × 2

### Combat Triangle

STR beats AGI beats INT beats STR.

- **Bonus**: +4% damage per stat point difference when you have advantage
- **Cap**: 40% maximum bonus
- Based on each entity's dominant stat (highest of STR/AGI/INT)
- Only the advantaged side gets a bonus; no penalty for disadvantage

### AGI Combat Mechanics

AGI-focused builds gain several combat advantages to compensate for lower base damage:

| Mechanic | Formula | Cap |
|----------|---------|-----|
| **Evasion dodge** | (defenderAGI - attackerAGI) / 3 = dodge % | 25% |
| **Double strike** | (attackerAGI - defenderAGI) × 2 = chance % | 25% |
| **AGI crit bonus** | AGI / 4 = bonus crit % | — |

- **Evasion**: When defender AGI > attacker AGI, chance to completely dodge physical attacks
- **Double strike**: AGI weapon users deal +50% bonus damage on proc (AGI weapons only)
- **AGI crit bonus**: Additional crit chance based on attacker's AGI stat

### Magic Resistance

Defender's INT provides passive magic damage reduction:

```
resist = defenderINT / 5
damage = magicDamage - resist (min 1)
```

### Status Effects

| Effect | Description |
|--------|-------------|
| ToHitModifier | Alters hit probability |
| DoT | Damage over time each turn |
| HitPointMod | Direct HP modification |
| ArmorMod | Temporarily changes armor value |
| WeaponMod | Temporarily changes weapon damage |
| Stun | Skip turn |

### Flee Mechanics

- Attacker can flee on **turn 1**
- Defender can flee on **turn 2**
- **PvE flee**: 5% gold penalty from escrow (burned, min 20 escrow). Smoke Cloak negates.
- **PvP flee**: 10% gold penalty from escrow (5% burned + 5% to opponent, min 10 escrow). Smoke Cloak negates.
- **PvE death**: 5% of escrow burned (permanent sink, min 20 escrow)
- **PvP death**: 50% of loser escrow removed — 10% burned, 40% to winners

---

## Items & Equipment

### Item Types

| Type | Description | Key Stats |
|------|-------------|-----------|
| Weapon | Physical/magic damage dealers | minDamage, maxDamage, stat bonuses, effects |
| Armor | Defensive equipment | armorModifier, stat bonuses, armor type |
| Accessory | Mixed utility | stat bonuses, armor, effects |
| Consumable | One-time use items | damage, effects |
| Spell | Magic damage items | minDamage, maxDamage, effects |
| QuestItem | Special/story items | Varies |

### Equipment Slots

Characters can equip multiple items per category:

- Weapons (multiple slots)
- Armor (multiple slots)
- Accessories (multiple slots)
- Consumables (multiple slots)
- Spells (multiple slots)

### Item Stats

All items can provide: STR bonus, AGI bonus, INT bonus, HP bonus, armor value, and special effects. Items have minimum stat requirements (STR/AGI/INT) and minimum level requirements.

### Rarity Tiers

Items have rarity tiers that determine drop frequency and power level:

| Rarity | Drop Frequency | Power Level |
|--------|---------------|-------------|
| Common | Frequent | Low |
| Uncommon | Moderate | Moderate |
| Rare | Infrequent | Good |
| Very Rare | Scarce | High |
| Legendary | Extremely rare | Very high |
| Unique | One-of-a-kind | Exceptional |

*Note: Drop rates need tuning during game testing. See ECONOMICS.md for rate targets.*

### Starter Equipment

New characters receive starter gear based on their race and armor type selection. At Level 10, characters receive additional class-specific equipment.

### Power Distribution (at Level 50)

| Source | % of Total Power |
|--------|-----------------|
| Base stats + race/armor | ~15% |
| Leveling | ~20% |
| Class bonuses | ~5% |
| **Items** | **~60%** |

---

## Economy

See [ECONOMICS.md](./ECONOMICS.md) for detailed economy design.

**Key points:**
- **Gold**: ERC20 token, primary currency
- **Marketplace**: Player-to-player trading with fee (2.5–3%, under review)
- **Shops**: NPC buy/sell with markup/markdown, 12-hour restock cycle
- **Gold generation**: From mob kills, BASE_GOLD_DROP = 3, scales with mob level
- **Gold sinks**: Marketplace fees, shop purchases, guild creation/upkeep, more planned post-launch
- **Guilds**: See [GUILDS.md](./GUILDS.md) for full guild system design (tax, treasury, territory, wars, seasons)

---

## Map & Zones

### Map Structure

- **Grid-based**: 2D tile map, configurable dimensions
- **Movement**: 1 tile per action (Manhattan distance), 1-second cooldown
- **Home spawn**: Position (0, 0)

### Zone Layout

| Area | Coordinates | Content |
|------|------------|---------|
| Safe zone | x < 5 and y < 5 | PvE only, lower-level mobs |
| Danger zone | x ≥ 5 or y ≥ 5 | PvP enabled, higher-level mobs |
| Shop (Tal) | (9, 9) | NPC shop |
| Fragment center | (5, 5) | Lore trigger location |

### Mob Spawning

- **Near home** (distance < 5 tiles): Level 1–5 mobs
- **Far from home** (distance ≥ 5 tiles): Level 6–10 mobs
- **Spawn count**: 0–3 mobs per tile (random)
- Distance calculated using Chebyshev distance from (0, 0)

---

## PvP

### Rules

- **Location**: Only in danger zone (x ≥ 5 or y ≥ 5)
- **Cooldown**: 30 seconds between PvP engagements
- **Escrow**: Portion of player's gold held during combat
- **PvP flee penalty**: 10% of escrow gold (5% burned + 5% to opponent, min 10 escrow). Smoke Cloak negates.
- **PvE flee penalty**: 5% of escrow gold (burned, min 20 escrow). Smoke Cloak negates.
- **PvP death penalty**: 50% of loser escrow — 10% burned, 40% to winners
- **PvE death penalty**: 5% of escrow burned
- **Group PvP**: Supports multiple attackers vs multiple defenders

### Flow

```
Player A initiates PvP against Player B (both in danger zone)
    ↓
Both players' gold placed in escrow
    ↓
Turn-based combat (same system as PvE)
    ↓
├── Player A wins → Gets Player B's escrow gold + XP
├── Player B wins → Gets Player A's escrow gold + XP
├── Player A flees (turn 1) → Loses 10% escrow (5% burned, 5% to Player B)
└── Player B flees (turn 2) → Loses 10% escrow (5% burned, 5% to Player A)
```

---

## Lore Fragments

8 collectible narrative NFTs ("Fragments") that tell the story of Noctum's death and the gods' deicide.

| # | Fragment | Trigger | Status |
|---|----------|---------|--------|
| 1 | The Awakening | First spawn | `[IMPLEMENTED]` |
| 2 | The Quartermaster | Visit shop at (9,9) | `[IMPLEMENTED]` |
| 3 | The Restless | First monster kill | `[IMPLEMENTED]` |
| 4 | Souls That Linger | Kill Crystal Elemental (mob #4) | `[IMPLEMENTED]` |
| 5 | The Marrow | Reach center tile (5,5) | `[IMPLEMENTED]` |
| 6 | Death of Death God | Kill Lich Acolyte (mob #7) | `[IMPLEMENTED]` |
| 7 | Betrayer's Truth | Kill Shadow Stalker (mob #9) | `[IMPLEMENTED]` |
| 8 | Blood Price | First PvP kill | `[IMPLEMENTED]` |

Each fragment mints as an ERC721 NFT with unique token ID per character.

See [LORE_NFT_FRAGMENTS.md](./LORE_NFT_FRAGMENTS.md) for full narrative content.

---

## Badge System

Soulbound badges (ERC721) awarded for milestones.

| Badge | ID | Requirement | Purpose |
|-------|----|-------------|---------|
| Adventurer | 1 | Reach Level 3 | Unlocks chat access |
| Founder | 50 | Play during launch window | Permanent recognition |
| Zone Conqueror | 100+zoneId | Top 10 to max level in a zone | Competitive recognition |
| Peaks Pioneer | 150+zoneId | First entry into a zone | Exploration recognition |
| Lore Keeper | 200+zoneId | Collect all zone fragments | Lore recognition |

Badges are minted to the character owner's address with unique token IDs per character.

See [BADGE_SYSTEM.md](./BADGE_SYSTEM.md) for full badge details.

---

## Class Abilities

`[PLANNED]` — Post-Level 10 feature, not yet designed.

Players will earn class-specific abilities after Level 10. The ability system design is pending — it will build on the power source and advanced class choices to give each class a distinct gameplay identity.

This section will be expanded once the ability system is designed.

---

*Last updated: March 2026*
