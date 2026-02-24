# Sustainable Stat Progression Model for Ultimate Dominion

## Overview

This document outlines a revised approach to stat progression in Ultimate Dominion, designed for long-term game health and balance. The goal is to create a more measured progression curve that:

1. Maintains meaningful character advancement
2. Prevents stat inflation over the game's lifespan
3. Balances combat without requiring constant rebalancing
4. Supports the game as a potentially infinite MMORPG experience

## Core Principles

### 1. Lower Base Values, Higher Impact

The current system starts characters with relatively high base values (16-20 HP, stats in the 3-10 range). This creates a steep power curve as players level up, leading to balance challenges.

**Proposed Change**: Start with lower base values and ensure each stat point provides meaningful impact.

### 2. Linear, Predictable Advancement

Stat gains should follow a linear, predictable pattern that can be sustained over years of play without creating extreme disparities between new and veteran players.

### 3. Equipment Complements, Doesn't Dominate

Equipment should enhance a character's effectiveness without becoming the sole source of power. This allows for meaningful progression through both levels and gear.

### 4. Balanced Combat Triangle

Maintain the STR > AGI > INT > STR combat triangle, but ensure each attribute remains valuable across all classes and levels.

## World Progression Structure

Ultimate Dominion is structured around 6 distinct maps, each supporting 10 levels of character progression:

1. **Dark Cave** (Levels 1-10): The tutorial zone where players learn game mechanics and begin their adventure
2. **Windy Peaks** (Levels 11-20): A mountainous region with stronger enemies and new challenges
3. **Mystic Grove** (Levels 21-30): A magical forest filled with nature spirits and magical creatures
4. **Dragon's Spine** (Levels 31-40): Advanced progression zone
5. **Shadowlands** (Levels 41-50): Pre-endgame content
6. **Eternal Realm** (Levels 51-60): Initial endgame content

Each map introduces new monsters, equipment, and narrative elements, creating a sense of progression as players advance through the world.

## Specific Changes

### Base Stats Revision

**Current System:**
- Starting HP: 16-20 (class dependent)
- Starting Primary Stats: 3-10 range before class bonuses
- Total starting stats: 19 points + 2 class bonus (21 total)

**Proposed System:**
- Starting HP: 10 for all classes
- Starting Primary Stats: 1-5 range before class bonuses
- Total starting stats: 9 points + 2 class bonus (11 total)

These lower starting values provide more room for meaningful progression and make each stat point feel more impactful.

### HP Progression

**Current System:**
- +3 HP per level for all classes
- Additional +3 HP per 3 levels for certain classes

**Proposed System:**
- +1 HP per level for all classes
- +1 additional HP per 3 levels for warriors/tanky classes
- Equipment bonuses provide 1-3 HP at most

This creates a more gradual HP curve that scales appropriately with damage output.

### Stat Point Allocation

**Current System:**
- 2 ability points per level (ABILITY_POINTS_PER_LEVEL = 2)
- Bonus point for class primary stat at specific levels

**Proposed System:**
- 1 ability point per level
- Bonus point for class primary stat every 5 levels (level 5, 10, 15, etc.)

This halves the rate of stat acquisition, creating a more sustainable progression curve.

### Level Cap Considerations

**Current System:**
- MAX_LEVEL = 10 (primarily for testing)

**Proposed System:**
- Expand MAX_LEVEL to 60, aligned with the 6-map structure
- Each map contains 10 levels of progression
- Level time investment scales progressively:
  - Levels 1-10: 30-60 minutes per level
  - Levels 11-30: 1-2 hours per level
  - Levels 31-50: 2-4 hours per level
  - Levels 51-60: 4-8 hours per level

### Equipment Stat Bonuses by Zone

**Proposed Equipment Scaling by Zone:**
- **Dark Cave** (Levels 1-10):
  - Common: +0 to stats
  - Uncommon: +1 to one stat
  - Rare: +1 to two stats

- **Windy Peaks** (Levels 11-20):
  - Common: +1 to one stat
  - Uncommon: +1 to two stats
  - Rare: +2 to one stat, +1 to another

- **Mystic Grove** (Levels 21-30):
  - Common: +1 to two stats
  - Uncommon: +2 to one stat, +1 to another
  - Rare: +2 to two stats

- **Dragon's Spine** (Levels 31-40):
  - Common: +2 to one stat, +1 to another
  - Uncommon: +2 to two stats
  - Rare: +3 to one stat, +2 to another

- **Shadowlands** (Levels 41-50):
  - Common: +2 to two stats
  - Uncommon: +3 to one stat, +2 to another
  - Rare: +3 to two stats, +1 to another

- **Eternal Realm** (Levels 51-60):
  - Common: +3 to one stat, +2 to another
  - Uncommon: +3 to two stats, +1 to another
  - Rare: +4 to one stat, +3 to another
  - Legendary: +5 to one stat, +3 to two others (rare drops)

This creates a more gradual equipment progression curve that complements character development without overshadowing it.

## Expected Stat Progression

With this system, a level 60 character focused on a primary stat could expect:
- Base stats from leveling: ~60 points
- Bonus points from class features: ~12 points
- Equipment bonuses: ~15 points
- Total in primary stat: ~87 points

This is significantly lower than the hundreds of points that would result from the original system's exponential growth, but still provides a clear sense of progression.

## Implementation Impact

### Smart Contract Changes

#### 1. Constants.sol

```solidity
// Current
int256 constant BASE_HP_GAIN = 1;
int256 constant ABILITY_POINTS_PER_LEVEL = 2;
uint256 constant MAX_LEVEL = 10;

// Proposed
int256 constant BASE_HP_GAIN = 1;
int256 constant ABILITY_POINTS_PER_LEVEL = 1;
int256 constant BONUS_STAT_LEVEL_INTERVAL = 5;
uint256 constant MAX_LEVEL = 60;
```

#### 2. RngSystem.sol

```solidity
// Current method for stat generation
stats.strength = int256(Math.absolute(int256(int64(chunks[0]))) % 8 + 3); // Range [3, 10]
stats.agility = int256(Math.absolute(int256(int64(chunks[1]))) % 8 + 3); // Range [3, 10]
stats.intelligence = int256(19 - stats.strength - stats.agility);

// Class-based HP adjustments
if (characterClass == Classes.Warrior) {
    stats.maxHp = int256(20);
} else if (characterClass == Classes.Rogue) {
    stats.maxHp = int256(18);
} else {
    stats.maxHp = int256(16);
}

// Proposed method
stats.strength = int256(Math.absolute(int256(int64(chunks[0]))) % 5 + 1); // Range [1, 5]
stats.agility = int256(Math.absolute(int256(int64(chunks[1]))) % 5 + 1); // Range [1, 5]
stats.intelligence = int256(9 - stats.strength - stats.agility);

// Standardized starting HP
stats.maxHp = int256(10);
```

#### 3. CharacterSystem.sol

```solidity
// Current levelCharacter function (partial)
stats.maxHp += 3;
if (uint8(stats.class) == 0 && stats.level % 3 == 0) {
    stats.maxHp += 3;
}

// Proposed levelCharacter function (partial)
stats.maxHp += BASE_HP_GAIN;
if (stats.class == Classes.Warrior && stats.level % 3 == 0) {
    stats.maxHp += BASE_HP_GAIN;
}

// Current ability point allocation validation
require(
    (strChange + agiChange + intChange) == ABILITY_POINTS_PER_LEVEL, 
    "CHARACTER SYSTEM: INVALID STAT CHANGE"
);

// Bonus point for class stat every BONUS_POINT_LEVEL (currently 1)
if (availableLevel % BONUS_POINT_LEVEL == 0) {
    Classes characterClass = getClass(characterId);
    if (characterClass == Classes.Warrior) {
        ++desiredStats.strength;
    } else if (characterClass == Classes.Rogue) {
        ++desiredStats.agility;
    } else if (characterClass == Classes.Mage) {
        ++desiredStats.intelligence;
    }
}

// Proposed ability point validation
require(
    (strChange + agiChange + intChange) == ABILITY_POINTS_PER_LEVEL, 
    "CHARACTER SYSTEM: INVALID STAT CHANGE"
);

// Bonus point for class stat every BONUS_STAT_LEVEL_INTERVAL (proposed as 5)
if (availableLevel % BONUS_STAT_LEVEL_INTERVAL == 0) {
    Classes characterClass = getClass(characterId);
    if (characterClass == Classes.Warrior) {
        ++desiredStats.strength;
    } else if (characterClass == Classes.Rogue) {
        ++desiredStats.agility;
    } else if (characterClass == Classes.Mage) {
        ++desiredStats.intelligence;
    }
}
```

## Combat Balance Impact

### Zone-Based Monster Scaling

Monsters should be balanced according to the revised stat progression across zones:

#### Dark Cave (Levels 1-10)
- HP: 8-15
- Damage: 1-3 per hit
- Primary Stat: 1-8
- XP to advance: 100-1,000 per level

#### Windy Peaks (Levels 11-20)
- HP: 15-25
- Damage: 2-5 per hit
- Primary Stat: 8-18
- XP to advance: 1,000-5,000 per level

#### Mystic Grove (Levels 21-30)
- HP: 25-35
- Damage: 4-8 per hit
- Primary Stat: 18-28
- XP to advance: 5,000-20,000 per level

#### Dragon's Spine (Levels 31-40)
- HP: 35-45
- Damage: 7-12 per hit
- Primary Stat: 28-38
- XP to advance: 20,000-50,000 per level

#### Shadowlands (Levels 41-50)
- HP: 45-55
- Damage: 10-16 per hit
- Primary Stat: 38-48
- XP to advance: 50,000-100,000 per level

#### Eternal Realm (Levels 51-60)
- HP: 55-70
- Damage: 14-20 per hit
- Primary Stat: 48-60
- XP to advance: 100,000-250,000 per level

### Damage Calculation

With the new stat ranges and 60-level structure, damage formulas should be adjusted to maintain appropriate combat pacing across all zones:

1. **Weapon Damage by Zone**:
   - Dark Cave weapons: 1-3 damage
   - Windy Peaks weapons: 2-5 damage
   - Mystic Grove weapons: 4-7 damage
   - Dragon's Spine weapons: 6-10 damage
   - Shadowlands weapons: 8-13 damage
   - Eternal Realm weapons: 12-18 damage

2. **Critical Hits**: Keep at ~5% chance but reduce multiplier
   - Current: 2× multiplier
   - Proposed: 1.5× multiplier

## Long-term Considerations

1. **Expansion Planning**: The system is designed to accommodate eventual expansion beyond level 60 with additional maps.

2. **Stat Caps**: Consider implementing soft or hard caps on stats to prevent extreme specialization:
   - Primary stat soft cap: Level × 1.5
   - Hard cap: Level × 2

3. **Alternative Progression**: As characters approach level cap, introduce alternative progression systems:
   - Mastery systems
   - Horizontal progression (new abilities rather than stat increases)
   - Specialized equipment with unique effects rather than pure stat increases

4. **Estimated Gameplay Time**:
   - Casual players (5-10 hours/week): 150-200 hours total (3-4 months)
   - Core players (15-25 hours/week): 80-120 hours total (4-6 weeks)
   - Hardcore players (30+ hours/week): 50-70 hours total (2-3 weeks)

## Conclusion

This revised stat progression model creates a sustainable, measured growth path across Ultimate Dominion's 6-map structure. By starting with lower base values and implementing a more gradual progression curve, we ensure that the game remains balanced and enjoyable throughout its lifecycle, from the Dark Cave to the final endgame content.

The map-by-map structure allows for phased development and provides natural breakpoints for content expansion, while the slower stat progression ensures that each new map and level range feels meaningful and appropriately challenging.
