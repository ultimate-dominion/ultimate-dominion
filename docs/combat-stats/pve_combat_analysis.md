# PvE Combat Balance Analysis

## Core Design Goals

For Ultimate Dominion's PvE combat, we aim to create a system that:

1. **Follows Standard MMORPG Pacing**
   - Players should be able to defeat 3-5 mobs of equal level before needing to heal
   - Players should be able to defeat 2-3 mobs one level higher before needing to heal
   - Players should be able to defeat 1-2 mobs two levels higher before needing to heal

2. **Creates Appropriate Challenge Scaling**
   - Combat difficulty should increase predictably with mob level
   - Higher-level mobs should be challenging but not insurmountable
   - Lower-level mobs should pose minimal threat to higher-level players

3. **Maintains Strategic Depth**
   - Critical hits should be rare (approximately 5% or 1/20 hits) with base stats
   - Equipment and character builds should meaningfully impact combat effectiveness
   - Combat should involve tactical decisions beyond simply attacking

## Current System Analysis

The current combat system has several components that interact to determine outcomes:

### Stat System

Characters and mobs have the following primary stats:
- **Strength (STR)**: Increases physical damage
- **Agility (AGI)**: Improves hit chance and critical hit chance
- **Intelligence (INT)**: Increases magical damage
- **Health Points (HP)**: Determines how much damage can be taken
- **Armor**: Reduces incoming physical damage

### Combat Mechanics

1. **Hit Calculation**:
   - Base hit chance is determined by attacker's agility
   - Defender's agility provides a chance to dodge
   - Level differences provide additional modifiers

2. **Damage Calculation**:
   - Base damage is determined by weapon/attack stats
   - Strength or intelligence provides a multiplier to damage
   - Critical hits multiply damage (currently by 2.0)
   - Armor reduces incoming damage by a percentage

3. **Critical Hit System**:
   - Base critical chance is flat (approximately 5%)
   - Agility increases critical chance
   - No diminishing returns on critical chance currently implemented

### Issues Identified

1. **Damage Scaling**:
   - Damage increases linearly with stats, leading to overpowered high-level characters
   - Critical hits are too powerful at high levels, creating spiky damage patterns
   - Armor effectiveness doesn't scale properly with level

2. **Level Difference Impact**:
   - Level advantages/disadvantages have too little impact on combat results
   - Higher-level monsters don't feel appropriately threatening
   - Lower-level monsters remain too challenging for high-level players

3. **Combat Pacing**:
   - Players are taking more damage than intended in PvE encounters
   - Recovery between fights is inconsistent across level ranges
   - Combat length varies too much between different character builds

## Player Stat Progression Analysis

This section provides a detailed analysis of how character stats progress from levels 1 to 10, showing the baseline for our combat balance adjustments.

### Level 1 Character (Starting Stats)

**Base Stats:**
- HP: 10
- Strength: 10-15 (depending on class)
- Agility: 8-12 (depending on class)
- Intelligence: 8-15 (depending on class)
- Armor: 0-5 (depending on starting equipment)

**Combat Effectiveness:**
- Average Damage Per Hit: 1-2
- Hit Chance: 70-80%
- Critical Hit Chance: 5-7%
- Survival Time vs. Equal Level Mob: 5-10 hits

### Level 5 Character (Mid-Tier)

**Base Stats:**
- HP: 15-20
- Strength: 20-30 (depending on class and build)
- Agility: 15-25 (depending on class and build)
- Intelligence: 15-30 (depending on class and build)
- Armor: 10-20 (depending on equipment)

**Combat Effectiveness:**
- Average Damage Per Hit: 2-3
- Hit Chance: 80-85%
- Critical Hit Chance: 8-12%
- Survival Time vs. Equal Level Mob: 5-10 hits

### Level 10 Character (Current Cap)

**Base Stats:**
- HP: 25-35
- Strength: 35-50 (depending on class and build)
- Agility: 30-45 (depending on class and build)
- Intelligence: 30-50 (depending on class and build)
- Armor: 25-40 (depending on equipment)

**Combat Effectiveness:**
- Average Damage Per Hit: 3-5
- Hit Chance: 85-90%
- Critical Hit Chance: 12-20%
- Survival Time vs. Equal Level Mob: 5-12 hits

## Mob Scaling Analysis

### Level 1 Mob

**Base Stats:**
- HP: 8-12
- Strength: 8-12
- Agility: 7-10
- Intelligence: 5-10
- Armor: 0-3

**Combat Effectiveness:**
- Average Damage Per Hit: 1-2
- Hit Chance: 65-75%
- Critical Hit Chance: 5%
- Time to Defeat Equal Level Player: 5-10 hits

### Level 5 Mob

**Base Stats:**
- HP: 12-18
- Strength: 18-25
- Agility: 14-20
- Intelligence: 12-22
- Armor: 5-15

**Combat Effectiveness:**
- Average Damage Per Hit: 2-3
- Hit Chance: 75-80%
- Critical Hit Chance: 7-10%
- Time to Defeat Equal Level Player: 5-9 hits

### Level 10 Mob

**Base Stats:**
- HP: 20-30
- Strength: 30-45
- Agility: 25-40
- Intelligence: 25-45
- Armor: 15-30

**Combat Effectiveness:**
- Average Damage Per Hit: 3-5
- Hit Chance: 80-85%
- Critical Hit Chance: 10-15%
- Time to Defeat Equal Level Player: 5-12 hits

## Recommended Balance Adjustments

Based on the analysis of the current system, here are the key balance adjustments needed:

1. **Universal Multi-Stat Scaling**
   - All items and abilities scale with multiple stats (primary + secondary bonuses)
   - Prevent single-stat dominance while maintaining specialization benefits
   - Create meaningful choices between specialized and balanced builds

2. **Small Stat Bonuses for Hit/Crit Chance**
   - Hit chance: +1% per 50 points in relevant stat (STR for physical, INT for magical, AGI for ranged)
   - Crit chance: +1% per 100 points in relevant stat
   - Prevent AGI dominance while allowing stat investment to matter

3. **Item-Based Build Solutions**
   - Hit chance items: +5% to +15% hit chance bonuses
   - Crit chance items: +3% to +10% crit chance bonuses
   - Allow any build to be viable with appropriate equipment choices

4. **Combat Triangle Implementation**
   - STR > AGI: Physical damage and armor penetration advantages
   - AGI > INT: Speed, evasion, and precision advantages
   - INT > STR: Magical damage that bypasses physical armor

5. **Diminishing Returns**
   - Implement stat scaling caps to prevent extreme advantages
   - Ensure balanced builds remain competitive at higher levels
   - Create tactical depth beyond pure stat stacking

These adjustments should create a more balanced and enjoyable PvE combat experience that supports diverse build strategies while adhering to our core design goals.

## Build Diversity and Item Solutions

### Universal Multi-Stat Scaling

All items and abilities will scale with multiple stats to prevent single-stat dominance:

**Physical Weapons (Swords, Axes):**
- Primary: STR × 2.0 (main damage)
- Secondary: AGI × 0.5 (accuracy bonus)
- Tertiary: INT × 0.3 (technique bonus)

**Magical Weapons (Staves, Wands):**
- Primary: INT × 2.0 (magical power)
- Secondary: STR × 0.4 (force behind spell)
- Tertiary: AGI × 0.6 (casting speed/accuracy)

**Ranged Weapons (Bows, Crossbows):**
- Primary: AGI × 2.0 (accuracy and draw strength)
- Secondary: STR × 0.6 (draw strength)
- Tertiary: INT × 0.4 (aiming technique)

### Small Stat Bonuses

Hit and critical hit chances receive minimal stat bonuses to prevent AGI dominance:

**Hit Chance Bonuses:**
- Physical attacks: +1% per 50 STR
- Magical attacks: +1% per 50 INT
- Ranged attacks: +1% per 50 AGI

**Critical Hit Bonuses:**
- Physical attacks: +1% per 100 STR
- Magical attacks: +1% per 100 INT
- Ranged attacks: +1% per 100 AGI

### Item-Based Build Solutions

Items fill major gaps in specialized builds, making any build viable:

**Hit Chance Items:**
- Common: +5% hit chance
- Uncommon: +8% hit chance
- Rare: +12% hit chance
- Legendary: +15% hit chance

**Critical Hit Items:**
- Common: +3% crit chance
- Uncommon: +5% crit chance
- Rare: +8% crit chance
- Legendary: +10% crit chance

### Build Examples

**Slow Heavy HP Mage (High INT, Low AGI):**
- Base hit chance: 85% + (INT/50) = ~86%
- With hit chance items: +33% = 98% (capped)
- Base crit chance: 5% + (INT/100) = ~5.5%
- With crit chance items: +23% = ~28.5%

**Pure STR Warrior (High STR, Low AGI):**
- Base hit chance: 85% + (STR/50) = ~86%
- With hit chance items: +33% = 98% (capped)
- Base crit chance: 5% + (STR/100) = ~5.5%
- With crit chance items: +23% = ~28.5%

**Balanced Build (Moderate All Stats):**
- Can use any weapon type effectively
- Moderate hit/crit chance from stats
- Flexible item choices for specialization
- Versatile against different opponent types

This approach ensures that any build can be viable with appropriate equipment choices while maintaining meaningful stat investment and build diversity.
