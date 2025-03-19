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
- HP: 100
- Strength: 10-15 (depending on class)
- Agility: 8-12 (depending on class)
- Intelligence: 8-15 (depending on class)
- Armor: 0-5 (depending on starting equipment)

**Combat Effectiveness:**
- Average Damage Per Hit: 10-15
- Hit Chance: 70-80%
- Critical Hit Chance: 5-7%
- Survival Time vs. Equal Level Mob: 4-5 hits

### Level 5 Character (Mid-Tier)

**Base Stats:**
- HP: 150-175
- Strength: 20-30 (depending on class and build)
- Agility: 15-25 (depending on class and build)
- Intelligence: 15-30 (depending on class and build)
- Armor: 10-20 (depending on equipment)

**Combat Effectiveness:**
- Average Damage Per Hit: 20-30
- Hit Chance: 80-85%
- Critical Hit Chance: 8-12%
- Survival Time vs. Equal Level Mob: 5-7 hits

### Level 10 Character (Current Cap)

**Base Stats:**
- HP: 225-275
- Strength: 35-50 (depending on class and build)
- Agility: 30-45 (depending on class and build)
- Intelligence: 30-50 (depending on class and build)
- Armor: 25-40 (depending on equipment)

**Combat Effectiveness:**
- Average Damage Per Hit: 35-55
- Hit Chance: 85-90%
- Critical Hit Chance: 12-20%
- Survival Time vs. Equal Level Mob: 6-8 hits

## Mob Scaling Analysis

### Level 1 Mob

**Base Stats:**
- HP: 75-100
- Strength: 8-12
- Agility: 7-10
- Intelligence: 5-10
- Armor: 0-3

**Combat Effectiveness:**
- Average Damage Per Hit: 8-12
- Hit Chance: 65-75%
- Critical Hit Chance: 5%
- Time to Defeat Equal Level Player: 6-8 hits

### Level 5 Mob

**Base Stats:**
- HP: 125-150
- Strength: 18-25
- Agility: 14-20
- Intelligence: 12-22
- Armor: 5-15

**Combat Effectiveness:**
- Average Damage Per Hit: 16-25
- Hit Chance: 75-80%
- Critical Hit Chance: 7-10%
- Time to Defeat Equal Level Player: 7-9 hits

### Level 10 Mob

**Base Stats:**
- HP: 200-250
- Strength: 30-45
- Agility: 25-40
- Intelligence: 25-45
- Armor: 15-30

**Combat Effectiveness:**
- Average Damage Per Hit: 28-45
- Hit Chance: 80-85%
- Critical Hit Chance: 10-15%
- Time to Defeat Equal Level Player: 8-10 hits

## Recommended Balance Adjustments

Based on the analysis of the current system, here are the key balance adjustments needed:

1. **Damage Calculation**
   - Implement diminishing returns on stat-based damage bonuses
   - Reduce the critical hit multiplier from 2.0 to 1.75
   - Increase the effectiveness of armor at higher levels

2. **Hit Probability**
   - Increase the impact of level differences on hit chances
   - Improve the scaling of agility's effect on hit chance
   - Add a small baseline hit chance so low-agility characters aren't completely ineffective

3. **Stat Scaling**
   - Reduce overall mob damage output by 15-20%
   - Increase mob HP slightly to extend combat length
   - Adjust stat gains per level to ensure proper scaling
   - Implement more meaningful armor values on mobs

4. **Combat Mechanics**
   - Consider adding "glancing blows" for hits against higher-level opponents
   - Implement recovery mechanics that scale appropriately with level
   - Add mob type variations (normal, elite, boss) with different stat distributions

These adjustments should create a more balanced and enjoyable PvE combat experience that adheres to our core design goals.
