# RPG Combat System Research: World of Warcraft

## Overview
This document examines the PvE combat mechanics of World of Warcraft (WoW) to provide comparative analysis for Ultimate Dominion's combat system. Understanding how established RPGs implement their combat systems can provide valuable insights for refining our own approach.

## Basic Combat Mechanics

### The Hit Table
WoW uses what's called a "Hit Table" or "Attack Table" to determine the outcome of attacks. This system compiles all possible outcomes into a table to determine which effect will occur during an attack:

- Miss: Attack fails to connect with the target
- Dodge: Target actively avoids the attack
- Parry: Target deflects the attack with a weapon or shield
- Block: Target reduces the damage with a shield
- Critical Hit: Attack deals increased damage (typically double)
- Crushing Blow: Higher-level enemies can deal extra damage
- Normal Hit: Standard damage is dealt

The game uses a hierarchical system where certain outcomes take precedence over others. Players can "push off" certain negative effects through stat optimization.

### Damage Calculation

#### Physical Damage Formula
Physical attacks in WoW follow this calculation process:

1. A random number within the weapon's damage range is selected
2. Attack power contribution is added: (Attack Power / 14) × Weapon Speed
3. Additional bonuses from talents, enchants, and buffs are applied
4. Damage is reduced by the target's armor mitigation

Example:
```
A hunter with 700 attack power using a bow (damage range 100-150, 3.0 speed):
- Base damage roll: 120
- AP contribution: (700/14) × 3.0 = 150
- Additional bonuses: +30 (scope and ammunition) 
- Talent bonus: +5% to all ranged attacks
- Total pre-mitigation: (120 + 150 + 30) × 1.05 = 315
- Target has 20% armor mitigation: 315 × 0.8 = 252 damage dealt
```

#### Spell Damage Formula
Magical attacks use a different formula:

1. A number is chosen from the spell's damage range
2. The caster's spell damage is multiplied by the spell's coefficient
3. These values are added together with any other modifiers
4. The target's resistances reduce the final damage

Example:
```
A mage casts Frost Bolt (damage range 174-190) with +70 spell damage:
- Base damage roll: 183
- Spell damage contribution: 70 × 0.8143 (coefficient) = 57
- Talent bonus: +6% to all frost spells
- Total damage: (183 + 57) × 1.06 = 254
```

### Armor and Damage Reduction

Armor provides percentage-based reduction to physical damage. The reduction formula changes based on enemy level:

For enemies levels 1-59:
```
Damage Reduction % = (Armor / ([85 × Enemy_Level] + Armor + 400)) × 100
```

For enemies levels 60+:
```
Damage Reduction % = (Armor / ([467.5 × Enemy_Level] + Armor - 22167.5)) × 100
```

For level 80 vs. raid bosses (level 83):
```
Damage Reduction % = (Armor / (Armor + 16635)) × 100
```

Important notes:
- The maximum damage reduction from armor is capped at 75%
- Diminishing returns become increasingly severe as you approach the armor cap

## Character Progression and Stat System

### Primary Statistics
WoW features several primary attributes that increase a character's power:
- Strength: Increases attack power for certain classes
- Agility: Increases attack power and critical strike chance for certain classes
- Intellect: Increases spell power and mana pool
- Stamina: Increases health points
- Spirit: Affects mana/health regeneration

### Secondary Statistics
Secondary stats have diminishing returns implemented via brackets:
- Critical Strike: Chance to deal double damage
- Haste: Increases attack and casting speed
- Mastery: Class-specific bonuses (varies by specialization)
- Versatility: Increases damage dealt and reduces damage taken

The diminishing returns system for secondary stats works in brackets:
- 0-30%: No penalty
- 30-39%: 10% penalty to rating
- 39-47%: 20% penalty to rating
- 47-54%: 30% penalty to rating
- And so on with increasing penalties

This system prevents extreme stat stacking and encourages more balanced builds.

### Zone and Level Scaling

WoW implements zone scaling where enemies and rewards scale with player level within specific ranges. This system was introduced in the Legion expansion and later expanded across the entire game.

Key features:
- Mobs adapt their difficulty to the player's level within zone-specific ranges
- Quest rewards scale to provide appropriate gear for the player's level
- Some endgame content like raids and heroic dungeons are excluded from scaling

This system allows players more freedom in choosing where to level while maintaining appropriate challenge.

## Boss and Elite Enemy Mechanics

Bosses and elite enemies in WoW typically have:
- Significantly higher health pools
- Special abilities and attack patterns
- Damage resistance or immunity phases
- Area of effect (AoE) attacks
- Enrage timers that increase difficulty after a certain duration

These mechanics create more engaging and challenging encounters beyond standard combat.

## Concluding Observations

World of Warcraft's combat system is characterized by:

1. **Mathematical Precision**: Detailed formulas govern all combat interactions
2. **Diminishing Returns**: Systems that prevent extreme stat optimization
3. **Class Specialization**: Different classes have unique combat mechanics
4. **Scaling Systems**: Adaptable difficulty that grows with player power
5. **Visual Feedback**: Clear combat animations and damage numbers

These elements combine to create a combat system that is both accessible to new players and deep enough for veterans to master through advanced optimization.

*This research will be expanded with comparisons to other RPGs in subsequent documents.*

---

# Dungeons & Dragons (5th Edition) Combat System

## Core Combat Mechanics

### Turn-Based Structure

D&D combat is strictly turn-based, following this sequence:
1. **Determine surprise**: DM decides if any combatants are caught unaware
2. **Roll initiative**: Each participant rolls a d20 + Dexterity modifier to determine turn order
3. **Take turns**: Each combatant acts on their initiative count
4. **Repeat**: Continue until combat concludes

During a turn, characters can:
- Take one action (Attack, Cast a Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search)
- Move up to their movement speed (typically 30 feet)
- Take one bonus action (if available from class features, spells, etc.)
- Take one reaction per round (such as opportunity attacks)

### The Attack Roll System

The core mechanic for resolving attacks is:
1. Roll a d20
2. Add relevant modifiers (ability modifier + proficiency bonus if proficient)
3. Compare to target's Armor Class (AC)
4. If the total equals or exceeds the target's AC, the attack hits

Special outcomes:
- Natural 20: Critical hit (typically doubles damage dice)
- Natural 1: Automatic miss

### Damage Calculation

Damage in D&D is determined by:
1. Roll the weapon or spell's damage dice
2. Add relevant modifiers (usually Strength for melee, Dexterity for ranged)
3. Apply any special effects, critical hit bonuses, or resistances/vulnerabilities

Example:
```
A longsword attack with a character having 16 Strength (+3 modifier):
- Base damage: 1d8 (1-8 damage)
- Strength modifier: +3
- Total damage on hit: 1d8+3 (4-11 damage)
- On a critical hit: 2d8+3 (5-19 damage)
```

## Character Progression System

### Ability Scores

D&D characters have six core ability scores that influence combat effectiveness:
- **Strength**: Physical power, melee attack and damage
- **Dexterity**: Agility, ranged attack, AC, initiative
- **Constitution**: Endurance, hit points per level
- **Intelligence**: Knowledge, wizard spellcasting
- **Wisdom**: Perception, cleric/druid spellcasting
- **Charisma**: Personality, sorcerer/bard/warlock spellcasting

Scores typically range from 8-20 for player characters, with higher values yielding better modifiers:
- Score 10-11: +0 modifier (average)
- Each +2 points increases modifier by +1
- Each -2 points decreases modifier by -1

### Hit Points and AC

Character durability is primarily determined by:
- **Hit Points (HP)**: Determined by class, Constitution modifier, and level
- **Armor Class (AC)**: Determined by armor worn, Dexterity modifier, and other bonuses

HP Formula:
```
At 1st level: Class base HP + Constitution modifier
Each level after: Roll class hit die (or take average) + Constitution modifier
```

AC Formula (varies by armor type):
```
Light Armor: Base armor value + Dexterity modifier
Medium Armor: Base armor value + Dexterity modifier (max +2)
Heavy Armor: Fixed value based on armor
Unarmored: 10 + Dexterity modifier
```

### Level Progression

Characters improve through gaining levels (typically 1-20):
- Each level grants class features
- Proficiency bonus increases at levels 5, 9, 13, and 17
- Ability Score Improvements at specific levels (usually 4, 8, 12, 16, 19)
- Spell slots and spell levels increase for spellcasters

## Special Combat Features

### Advantage and Disadvantage

Rather than using numerical modifiers for situational benefits or penalties, D&D 5e uses a system called advantage and disadvantage:
- **Advantage**: Roll two d20s and take the higher result
- **Disadvantage**: Roll two d20s and take the lower result

This system simplifies modifiers and creates approximately a +5/-5 effect on average.

### Saving Throws

When characters need to resist spells or other effects:
1. Roll d20 + relevant ability modifier + proficiency bonus (if proficient)
2. Compare to difficulty class (DC) of the effect
3. Success often means reduced or no effect

### Death and Dying

D&D has a distinct system for handling incapacitated characters:
- At 0 HP, a character falls unconscious and begins making death saving throws
- Each turn, roll a d20 (no modifiers):
  - 10 or higher: Success
  - 9 or lower: Failure
  - Natural 20: Regain 1 HP
  - Natural 1: Two failures
- Three successes: Become stable (no longer dying)
- Three failures: Death

## Monster Design Philosophy

D&D monsters are designed with these principles:
- **Challenge Rating (CR)**: Indicates appropriate level for a party of four
- **Varied abilities**: Special attacks, resistances, immunities
- **Action Economy**: Legendary actions for major foes to offset party advantage
- **Thematic abilities**: Powers that match the monster's lore and concept

## Concluding Observations

Dungeons & Dragons 5th Edition's combat system is characterized by:

1. **Bounded Accuracy**: Limited numerical scaling keeps lower-level threats relevant
2. **Predictable Math**: The d20 system creates fairly consistent probabilities
3. **Action Economy**: The number of actions a side can take heavily influences combat outcomes
4. **Resource Management**: Managing spell slots, hit points, and special abilities
5. **Tactical Movement**: Positioning, range, and area effects matter significantly

The D&D system prioritizes accessibility and narrative flexibility over strict simulation, with rules that support both tactical play and quick resolution of combat scenarios.

---

# RuneScape Combat System

## Core Combat Mechanics

### Real-Time Combat with Abilities

RuneScape (specifically looking at both Old School RuneScape and RuneScape 3) features a real-time combat system with these key characteristics:

1. **Auto-attacks**: Basic attacks performed automatically at regular intervals
2. **Abilities/Special Attacks**: Player-triggered special moves with cooldowns (primarily in RS3)
3. **Combat Triangle**: Rock-paper-scissors relationship between melee, ranged, and magic
4. **Tick System**: All combat actions occur on a 0.6-second tick cycle

### The Combat Triangle

RuneScape's combat is built around a triangular relationship between three combat styles:
- **Melee**: Strong against Ranged, weak against Magic
- **Ranged**: Strong against Magic, weak against Melee
- **Magic**: Strong against Melee, weak against Ranged

Each style has specific armor and weapons that provide bonuses in that style while typically imposing penalties when used with other styles.

### Attack and Defense Mechanics

RuneScape uses a hit chance system where:

1. **Attack Roll** = Effective skill level × (Equipment bonus + 64)
2. **Defense Roll** = Target's defense level × (Target's defensive bonus + 64)

If Attack Roll > Defense Roll:
```
Hit Chance = 1 - (Defense Roll + 2) / (2 × (Attack Roll + 1))
```

If Attack Roll ≤ Defense Roll:
```
Hit Chance = Attack Roll / (2 × (Defense Roll + 1))
```

### Damage Calculation

For melee attacks, the damage formula is:
```
Max Hit = [Effective Strength Level × (Equipment Strength Bonus + 64) + 320] / 640
Average Damage = Hit Chance × (Max Hit/2)
DPS = Average Damage / Weapon Speed
```

Similar formulas exist for ranged and magic, with specific skill levels and equipment bonuses substituted accordingly.

## Character Progression System

### Skills and Combat Level

RuneScape character progression centers around these elements:
- **Combat Skills**: Attack, Strength, Defense, Ranged, Magic, Prayer, Hitpoints (Constitution in RS3), Summoning (RS3)
- **Combat Level**: A weighted formula combining the above skills to produce a single level (1-126/138)
- **Equipment Tiers**: Most equipment is tiered by level requirement (1-99)

### Skill Formulas

Each combat skill provides specific benefits:
- **Attack**: Increases accuracy with melee weapons
- **Strength**: Increases max hit with melee weapons
- **Defense**: Increases armor effectiveness for all styles
- **Ranged**: Increases accuracy and damage with ranged weapons
- **Magic**: Increases accuracy and damage with magical spells
- **Prayer**: Provides access to combat-enhancing prayers

The skill bonus calculation for accuracy is:
```
Skill Bonus = (Level × 31250 + 4 × Level + 40)
```

### Equipment System

Equipment quality is determined by:
- **Tier**: Level requirement to equip (generally 1-99)
- **Attack Bonuses**: Added to accuracy calculations
- **Defense Bonuses**: Added to defense calculations 
- **Strength Bonuses**: Added to damage calculations
- **Special Effects**: Unique bonuses from special or high-tier equipment

## Special Combat Features

### Prayer System

Prayers provide temporary buffs that drain prayer points:
- **Protection Prayers**: Reduce incoming damage by specific combat types
- **Offensive Prayers**: Boost accuracy and damage
- **Defensive Prayers**: Boost defense and damage reduction
- **Special Prayers**: Provide unique effects (like damage reflection)

### Special Attacks and Abilities

- **Special Attacks** (OSRS): Weapon-specific powerful moves that consume special attack energy
- **Abilities** (RS3): Categorized as basic, threshold, and ultimate abilities with cooldowns and adrenaline requirements

### Status Effects and Conditions

RuneScape includes various temporary effects that impact combat:
- **Poison/Venom**: Deals periodic damage
- **Stuns/Binds**: Restrict movement or ability usage
- **Stat Drains**: Temporarily reduce skill levels
- **Prayers/Curses**: Enhance combat statistics

## Monster Design Philosophy

RuneScape monsters follow these design principles:
- **Combat Level**: Indicates approximate difficulty
- **Aggressive/Non-aggressive**: Determines if monster initiates combat
- **Attack Styles**: Many monsters use one or more of the three combat styles
- **Special Attacks**: Some monsters have unique abilities
- **Drops**: Reward system tied to combat difficulty
- **Slayer Requirements**: Some monsters require a specific Slayer level to damage

## Concluding Observations

RuneScape's combat system is characterized by:

1. **Mathematical Precision**: Clear formulas that dictate outcomes
2. **Accessibility**: Low barrier to entry with simple auto-attacks
3. **Depth through Equipment**: Strategic depth comes from gear choice rather than moment-to-moment decisions
4. **Rock-Paper-Scissors Balance**: The combat triangle creates inherent counter-play
5. **Tick Manipulation**: Advanced players can optimize actions around the 0.6-second tick system

The system provides a foundation for both casual and competitive play, with differing approaches in Old School RuneScape (simpler, more equipment-focused) and RuneScape 3 (more complex with abilities and action bars).
