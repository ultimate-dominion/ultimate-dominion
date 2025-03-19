# Character Progression Analysis: Implicit Class System

This document analyzes Ultimate Dominion's proposed implicit class system, which allows players to discover their class through early game choices rather than upfront selection.

## Foundational Character Elements

### Power Sources
| Source    | Primary Focus | Secondary Benefit | Natural Synergy |
|-----------|---------------|-------------------|-----------------|
| Divine    | Support/Healing | Defensive capabilities | Higher HP, balanced STR/INT |
| The Weave | Magical power | Utility/Control | Higher INT, lower STR |
| Physical  | Raw combat ability | Durability | Higher STR, lower INT |

### Race Influences
| Race Type | STR Bias | AGI Bias | INT Bias | HP Bias | Special Consideration |
|-----------|----------|----------|----------|---------|------------------------|
| Robust (Dwarf-like) | +2 | -1 | 0 | +1 | Resistance to specific damage types |
| Nimble (Elf-like) | -1 | +2 | +1 | -1 | Enhanced initiative or evasion |
| Scholarly (Gnome-like) | -1 | 0 | +2 | 0 | Bonus to specific knowledge checks |
| Balanced (Human-like) | +1 | +1 | +1 | 0 | Versatility bonus |

### Starting Armor Impact
| Armor Type | Initial Stat Gain | Combat Style Encouragement | Movement Impact |
|------------|-------------------|---------------------------|-----------------|
| Cloth | INT +2, AGI +1, STR -1 | Favors magical attacks, control | No movement penalty |
| Leather | AGI +2, STR +1, INT 0 | Favors mobility, precision | Minor movement penalty |
| Plate | STR +2, HP +1, AGI -1 | Favors direct combat, endurance | Moderate movement penalty |

## Combat Mechanics Integration

### The Combat Triangle
| Attribute | Strong Against | Weak Against | Combat Role |
|-----------|---------------|--------------|-------------|
| STR | AGI-based | INT-based | Front-line combat, breaking defenses |
| AGI | INT-based | STR-based | Precision strikes, evasion |
| INT | STR-based | AGI-based | Control effects, area damage |

### Combat Advantage Formula
```
Advantage Modifier = (1 + (Attacker's Dominant Stat - Defender's Dominant Stat) * 0.05)
```
Applied when the attacker's dominant attribute has advantage over the defender's.

## Level 10 Class Crystallization

### Potential Class Paths
| Pre-10 Focus | Power Source | Advanced Class | Playstyle Flexibility |
|--------------|--------------|----------------|----------------------|
| High STR + Divine | Divine | Paladin | Tank, healer, or divine warrior |
| High STR + Weave | Weave | Sorcerer | Battle mage, elemental warrior, or caster |
| High STR + Physical | Physical | Warrior | Knight, barbarian, or duelist |
| High AGI + Divine | Divine | Monk | Mobile striker, support, or medic |
| High AGI + Weave | Weave | Warlock | Eldritch archer, shadow mage, or spellthief |
| High AGI + Physical | Physical | Ranger | Archer, dual-wielder, or scout |
| High INT + Divine | Divine | Cleric | Healer, divine caster, or ritualist |
| High INT + Weave | Weave | Wizard | Spell specialist, archmage, or scholar |
| High INT + Physical | Physical | Rogue | Assassin, tactician, or saboteur |

The key insight of this system is that it encourages organic character development. Players don't select "Wizard" at level 1; instead they choose the Weave as their power source, focus on intelligence during leveling, and then earn the Wizard class title at level 10. This creates a stronger connection to the character's development journey.

Players will further customize their character identity through their biography, gameplay choices, and preferred equipment. For example, a Sorcerer who invests heavily in strength might describe themselves as a "Battle Mage" in their character bio, while a Ranger who emphasizes stealth might call themselves a "Scout" in the game world.

### Post-10 Progression Impact
- **Synergy Bonuses**: When class aligns with previous choices, larger stat bonuses
- **Specialization Abilities**: Unique combat options based on the crystallized class
- **Equipment Specialization**: New armor/weapon options unlocked

## Implementation Considerations

1. **Early Game Balance**: Ensure different attribute combinations remain viable pre-level 10
2. **Transparency**: Clear indicators of how choices affect future options
3. **Retroactive Fit**: Ensure class selection at level 10 feels like a natural evolution
4. **Respec Options**: Consider if players can adjust early choices after class selection

## Battle System Impact

1. **Early Game Combat Dynamics**: Without explicit classes early on, combat will be more fluid and less role-defined. Players' effectiveness will be determined by their stat distribution rather than pre-defined class abilities. This creates a more organic early game experience where players discover their preferred playstyle through actual gameplay.

2. **Stat-Based Combat Triangle**: Implementing the STR > AGI > INT > STR relationship creates a clear combat triangle similar to RuneScape's, but based on attributes rather than explicit combat styles. This will significantly change combat calculations and encounter design.

3. **Equipment-Based Progression**: By tying starting armor to stat gains, you're creating a path dependency that will influence combat efficiency throughout the early game. This means equipment choices become more meaningful than just defensive values.

4. **Mid-Game Evolution**: The level 10 class selection represents a major power spike and specialization moment. The battle system will need to account for this transition, potentially requiring different monster scaling before and after this threshold.

5. **Combat Calculations**: With the rock-paper-scissors system, you'll need explicit formulas for how these advantages manifest (damage bonuses, hit chance modifications, etc.).

This system creates a more organic character development path that rewards experimentation while still providing structure at higher levels. The combat triangle ensures strategic depth throughout, with the rock-paper-scissors relationship creating natural counterplay opportunities.
