# Simplified Range vs. Melee Combat System

## Design Philosophy

Rather than implementing a complex positional combat system, Ultimate Dominion abstracts range considerations to focus on class abilities, weapon types, and the combat triangle. This design decision prioritizes accessibility, gameplay flow, and development efficiency.

## Core Assumptions

1. **All combatants are within effective range** - The turn-based combat system abstracts positioning, with the assumption that everyone can reach everyone else within a single turn.

2. **Weapon types determine effects, not range** - Instead of explicit range limitations, each weapon type has distinctive advantages and gameplay styles.

3. **Balance through statistical tradeoffs** - Different combat styles are balanced through damage values, resource costs, and special effects rather than through positional advantage.

## Weapon Type Characteristics

### Melee Weapons
- Higher base damage (10-15% bonus)
- Better chance to apply control effects (stun, slow)
- Higher armor penetration
- Class synergy with Warriors, Paladins, Monks

```solidity
// Example melee weapon bonus implementation
function applyMeleeWeaponBonus(uint256 baseDamage) internal pure returns (uint256) {
    return baseDamage * 115 / 100; // 15% damage bonus
}
```

### Ranged Weapons
- Higher critical hit chance and multiplier
- More consistent damage (less variance)
- Ability to target multiple enemies in some cases
- Class synergy with Rangers, Rogues

```solidity
// Example ranged weapon critical implementation
function calculateRangedCritical(uint256 damage, uint256 critChance) internal view returns (uint256) {
    uint256 roll = RngSystem.rollDice(100);
    if (roll <= critChance + 10) { // +10% crit chance for ranged
        return damage * 150 / 100; // 50% critical damage bonus
    }
    return damage;
}
```

### Magical Attacks
- Area of effect capabilities
- Status effects and debuffs
- Resource (mana) cost limitations
- Class synergy with Wizards, Warlocks, Sorcerers

```solidity
// Example spell area effect implementation
function calculateSpellAreaDamage(uint256 baseDamage, bytes32[] memory targets) internal pure returns (uint256) {
    // Damage reduction based on number of targets
    uint256 multiplier = 100 - ((targets.length - 1) * 15); // 15% reduction per additional target
    multiplier = multiplier < 50 ? 50 : multiplier; // Minimum 50% damage
    
    return baseDamage * multiplier / 100;
}
```

## Class-Specific Implementation

### Melee-Focused Classes

**Warriors**
- Bonus melee damage scaling with strength
- Defensive abilities that reduce incoming damage
- Taunt mechanics to draw enemy attention

**Paladins**
- Divine damage bonus on melee attacks
- Healing abilities tied to successful attacks
- Auras that buff nearby allies

**Monks**
- Quick, multi-hit attacks
- Dodge mechanics to avoid damage
- Mobility abilities for combat flexibility

### Ranged-Focused Classes

**Rangers**
- Enhanced critical hit mechanics
- Special ammunition types for different effects
- Animal companion for battlefield control

**Rogues**
- Stealth mechanics for combat advantage
- Poison effects on ranged attacks
- Evasion to avoid counterattacks

### Magic-Focused Classes

**Wizards**
- Powerful area spells with setup time
- Counterspell mechanics
- Intelligence-based damage scaling

**Warlocks**
- Damage-over-time effects
- Life drain mechanics
- Demonic pact abilities

**Sorcerers**
- Elemental damage specialization
- Spell enhancement abilities
- Resource (mana) manipulation

## Special Ability Design Patterns

To ensure all combat styles remain viable, we'll use these ability design patterns:

### For Melee Classes
- **Dash Abilities**: Descriptive abilities that imply closing distance quickly
- **Defensive Stances**: Higher damage reduction to offset being "in the fray"
- **Counter-Attacks**: Abilities that trigger when targeted

### For Ranged Classes
- **Evasion Abilities**: Ways to avoid damage rather than absorb it
- **Setup Mechanics**: Higher damage that requires preparation
- **Resource Management**: Limited ammunition or energy

### For Magical Classes
- **Channeled Spells**: Higher damage that requires concentration
- **Conjuration**: Summon allies to interact with enemies
- **Utility**: Non-damage options for tactical advantage

## Implementation Examples

### Damage Calculation with Weapon Type

```solidity
function calculateDamage(
    bytes32 attackerId, 
    bytes32 targetId, 
    uint256 weaponId
) public view returns (uint256 damage) {
    // Base damage from weapon
    damage = WeaponStats.getDamage(weaponId);
    
    // Apply weapon type modifiers
    ItemType itemType = Items.getItemType(weaponId);
    if (itemType == ItemType.Weapon) {
        bool isRanged = WeaponStats.isRanged(weaponId);
        
        if (isRanged) {
            // Apply ranged weapon bonuses (crit)
            damage = calculateRangedCritical(
                damage, 
                WeaponStats.getCritChance(weaponId)
            );
        } else {
            // Apply melee weapon bonuses (raw damage)
            damage = applyMeleeWeaponBonus(damage);
        }
    }
    
    // Apply combat triangle (STR > AGI > INT > STR)
    damage = applyCombatTriangleModifier(damage, attackerId, targetId);
    
    // Apply class-specific bonuses
    damage = applyClassBonuses(damage, attackerId, weaponId);
    
    return damage;
}
```

### Class Synergy with Weapon Types

```solidity
function applyClassBonuses(
    uint256 damage, 
    bytes32 attackerId, 
    uint256 weaponId
) internal view returns (uint256) {
    AdvancedClass attackerClass = Characters.getAdvancedClass(attackerId);
    bool isRanged = WeaponStats.isRanged(weaponId);
    
    // Melee classes get bonus with melee weapons
    if (!isRanged && (
        attackerClass == AdvancedClass.Warrior ||
        attackerClass == AdvancedClass.Paladin ||
        attackerClass == AdvancedClass.Monk
    )) {
        return damage * 110 / 100; // 10% bonus
    }
    
    // Ranged classes get bonus with ranged weapons
    if (isRanged && (
        attackerClass == AdvancedClass.Ranger ||
        attackerClass == AdvancedClass.Rogue
    )) {
        return damage * 110 / 100; // 10% bonus
    }
    
    // Magic users get bonus with appropriate spells
    if (Items.getItemType(weaponId) == ItemType.Spell && (
        attackerClass == AdvancedClass.Wizard ||
        attackerClass == AdvancedClass.Warlock ||
        attackerClass == AdvancedClass.Sorcerer ||
        attackerClass == AdvancedClass.Cleric
    )) {
        return damage * 110 / 100; // 10% bonus
    }
    
    return damage;
}
```

## Balance Levers

To maintain balance between combat styles, we can adjust these parameters:

1. **Base Damage Modifiers** - Tune the inherent damage bonus for melee vs. ranged
2. **Critical Hit Profiles** - Adjust frequency and impact of criticals by weapon type
3. **Resource Costs** - Manage ammunition, energy, or mana consumption
4. **Defensive Profiles** - Give melee classes better defenses to offset exposure
5. **Class Synergy Bonuses** - Tune how much bonus a class gets with its preferred weapon type

## UI Considerations

Without positional mechanics, the UI can focus on:
- Clear indicators of weapon type
- Class synergy with equipped items
- Damage type and effectiveness
- Ability ranges and areas of effect described narratively

## Conclusion

By abstracting away explicit positioning, we create a streamlined combat system that maintains the flavor of different combat styles without the complexity of position tracking. This approach allows us to focus development effort on distinctive class abilities, the combat triangle system, and engaging item mechanics.

The system remains balanced through careful tuning of damage values, defenses, and special abilities rather than through positional advantage, creating an accessible yet tactically interesting combat experience.
