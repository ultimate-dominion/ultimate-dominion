# Ultimate Dominion - Game Design Document

## Overview

Ultimate Dominion is an on-chain RPG where **items are the primary source of power**. Leveling provides meaningful progression, but players must acquire good gear to tackle higher-level content.

---

## Core Design Principles

1. **Items = Power**: ~60% of character power comes from equipment
2. **Leveling = Access**: Levels unlock content, item tiers, and provide modest stat gains
3. **Classes = Identity**: Classes provide % damage multipliers that scale with gear
4. **Player Choice**: Players can choose any advanced class regardless of build

---

## Character Creation

### Step 1: Choose Race

Races provide small starting stat adjustments.

| Race | STR | AGI | INT | HP | Flavor |
|------|-----|-----|-----|----|--------|
| Human | +1 | +1 | +1 | — | Balanced, versatile |
| Dwarf | +2 | -1 | — | +1 | Sturdy, strong |
| Elf | -1 | +2 | +1 | -1 | Agile, magical |

### Step 2: Choose Power Source

Power source is thematic and affects available abilities/spells.

| Power Source | Theme | Typical Playstyle |
|--------------|-------|-------------------|
| Divine | Holy/Nature magic | Healing, buffs, smiting |
| Weave | Arcane magic | Raw damage, control |
| Physical | Martial prowess | Weapons, tactics |

**Note:** Power source does NOT restrict advanced class selection.

### Step 3: Choose Starting Armor

Starting armor provides early stat adjustments.

| Armor | STR | AGI | INT | HP | Playstyle |
|-------|-----|-----|-----|----|-----------|
| Cloth | -1 | +1 | +2 | — | Caster-focused |
| Leather | +1 | +2 | — | — | Agility-focused |
| Plate | +2 | -1 | — | +1 | Strength-focused |

### Step 4: Roll Stats & Enter Game

Base stats are generated, then race/armor modifiers are applied.

**Base Stats:** STR 10, AGI 10, INT 10, HP 50

---

## Leveling System

### Stat Points Per Level

Stat point gains **diminish** as you level, encouraging reliance on items.

| Level Range | Stat Points | Rate |
|-------------|-------------|------|
| 1-10 | +1 per level | Every level |
| 11-50 | +1 every 2 levels | Slowing down |
| 51-100 | +1 every 5 levels | Items essential |

**Total stat points (Level 1 → 100):** ~40 points

### HP Per Level

HP gains are modest; armor and vitality items provide bulk of survivability.

| Level Range | HP Per Level |
|-------------|--------------|
| 1-10 | +2 |
| 11-50 | +1 |
| 51-100 | +1 every 2 levels |

**Total HP from leveling (Level 1 → 100):** ~65 HP

### Level Unlocks

Levels primarily unlock:
- Higher-tier item equipping (level requirements)
- New areas and dungeons
- Boss encounters
- Advanced class selection (Level 10)

---

## Advanced Classes

### Selection

At **Level 10**, players choose their advanced class.

**Any class can be selected regardless of race, power source, or stats.** This allows for creative builds and player expression.

### Class List & Bonuses

Each class provides:
1. **Flat stat bonuses** (one-time addition)
2. **% damage/healing multipliers** (scales with gear)

| Class | Flat Bonus | % Multiplier | Role |
|-------|------------|--------------|------|
| **Warrior** | +3 STR, +10 HP | +10% physical damage | Melee DPS/Tank |
| **Paladin** | +2 STR, +15 HP | +5% damage, +5% healing received | Tank/Support |
| **Ranger** | +3 AGI | +10% ranged damage | Ranged DPS |
| **Rogue** | +2 AGI, +1 INT | +15% critical damage | Burst DPS |
| **Druid** | +2 AGI, +2 STR | +5% all damage, +5% max HP | Hybrid |
| **Warlock** | +2 AGI, +2 INT | +10% damage over time | Sustained DPS |
| **Wizard** | +3 INT | +15% spell damage | Burst Caster |
| **Cleric** | +2 INT, +10 HP | +10% healing done | Healer |
| **Sorcerer** | +2 STR, +2 INT | +8% spell damage, +5% max HP | Battle Mage |

### How % Multipliers Work

**Formula (Option A - Final Damage):**
```
finalDamage = (baseDamage + itemDamage) × classMultiplier
```

**Example:**
- Warrior with 50 STR and +100 damage weapon
- Base calculation: 50 + 100 = 150 damage
- With +10% physical: 150 × 1.10 = **165 damage**

**Why this matters:**
- Better items = bigger multiplier benefit
- Classes feel impactful at all levels
- Rewards both leveling AND gear acquisition

---

## Power Distribution

### By Source (at Level 50)

| Source | Stat Contribution | HP Contribution | % of Total Power |
|--------|-------------------|-----------------|------------------|
| Base | 10 | 50 | ~10% |
| Race/Armor | 3-5 | 0-2 | ~5% |
| Leveling | ~25 | ~50 | ~20% |
| Class (flat) | 3-5 | 0-15 | ~5% |
| **Items** | 40-80 | 100-200 | **~60%** |

### Gear Dependency by Level

```
Level 1-10:   Leveling feels impactful, basic gear sufficient
Level 11-30:  Good gear provides noticeable advantage
Level 31-50:  Great gear required for challenging content
Level 51+:    Best gear essential for progression
```

---

## Items

### Item Power Budget

Items are the primary source of character power.

| Slot | Typical Stat Range | HP Range |
|------|-------------------|----------|
| Weapon | +10 to +100 primary stat | — |
| Armor | +5 to +50 stats | +20 to +200 HP |
| Accessory | +3 to +30 any stat | +10 to +100 HP |

### Item Tiers

| Tier | Level Req | Power Level | Drop Source |
|------|-----------|-------------|-------------|
| Common | 1+ | Low | Everywhere |
| Uncommon | 10+ | Moderate | Dungeons |
| Rare | 25+ | Good | Bosses |
| Epic | 50+ | High | Raids |
| Legendary | 75+ | Very High | World Bosses |

### Set Bonuses

Equipping multiple items from a set provides additional bonuses:
- 2-piece: Minor bonus (+5% stat or effect)
- 4-piece: Major bonus (+15% or unique effect)

---

## Combat

### Damage Formula

```
rawDamage = (primaryStat × statMultiplier) + weaponDamage + bonusDamage
finalDamage = rawDamage × classMultiplier × (1 + critBonus if crit)
```

### Combat Triangle

Stats have advantages against each other:
- **STR > AGI**: +5% damage per point difference
- **AGI > INT**: +5% damage per point difference
- **INT > STR**: +5% damage per point difference

This encourages diverse builds and tactical choices.

---

## Progression Summary

### Early Game (Level 1-10)
- Learn mechanics
- Choose race, power source, armor
- Roll stats
- Select advanced class at level 10
- Basic gear from quests/shops

### Mid Game (Level 11-50)
- Stat gains slow down
- Farm dungeons for better gear
- Class % bonuses become more valuable
- Build specialization matters

### Late Game (Level 51-100+)
- Minimal stat gains from leveling
- Chase epic/legendary items
- Class multipliers + best gear = peak power
- Raid content requires optimized builds

---

## Design Rationale

### Why Items > Levels?

1. **Engagement**: Players always have something to chase (better loot)
2. **Economy**: Items have trade value, creating player markets
3. **Catch-up**: New players can gear up without grinding 100 levels
4. **Variety**: Many valid builds based on item combinations

### Why Free Class Choice?

1. **Player Expression**: Be any class regardless of starting choices
2. **Experimentation**: Try "off-meta" builds
3. **Replayability**: Same race can play different classes
4. **No Regret**: Early choices don't lock you out

### Why % Multipliers?

1. **Scaling**: Stay relevant at all levels
2. **Item Synergy**: Better gear = bigger class benefit
3. **Identity**: Classes feel distinct in combat
4. **Balance**: Easy to tune without reworking systems

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-20 | Initial implicit class system design |

