# Advanced Class Abilities System

## Overview

When a player reaches level 10 and selects an advanced class, they unlock a set of unique abilities that define their class identity and playstyle. These abilities offer strategic options beyond basic attacks and existing spells, creating distinctive gameplay experiences for each class.

## System Design

### Ability Types

Each advanced class will have four ability types:

1. **Primary Ability** - Core identity skill with moderate cooldown
2. **Secondary Ability** - Utility or support skill with longer cooldown
3. **Passive Ability** - Always-active effect that alters gameplay
4. **Ultimate Ability** - Powerful, game-changing ability with very long cooldown

### Ability Components

```solidity
enum AbilityType {
    Primary,
    Secondary,
    Passive,
    Ultimate
}

struct ClassAbility {
    string name;
    string description;
    uint256 cooldown;          // In seconds
    uint256 resourceCost;      // Mana, stamina, or focus points
    AbilityType abilityType;
    PowerSource powerSource;   
    bytes32[] effectIds;       // Effects this ability applies
    uint256 range;             // Range in game units
    uint256 areaOfEffect;      // Area in game units (0 for single target)
    uint256 damageBase;        // Base damage (if applicable)
    uint256 healingBase;       // Base healing (if applicable)
    bool requiresTarget;       // If true, must target an entity
    bytes32[] abilityTags;     // For interactions with other systems
}
```

### Ability Execution Flow

1. Player initiates ability use
2. System checks cooldown, resource cost, and requirements
3. If all checks pass, apply immediate effects
4. Apply any ongoing effects
5. Start cooldown timer

## Divine Power Source Abilities

### Paladin

| Ability | Type | Cooldown | Description |
|---------|------|----------|-------------|
| **Divine Smite** | Primary | 15s | Channel divine energy into your weapon, dealing 150% weapon damage plus additional radiant damage. Damage bonus increases against undead and demonic enemies. |
| **Lay on Hands** | Secondary | 45s | Heal yourself or an ally for 30% of their maximum health. |
| **Aura of Protection** | Passive | - | Allied characters within 10 units gain +10% armor. |
| **Divine Intervention** | Ultimate | 300s | Become immune to all damage for 8 seconds and heal to full health. |

### Cleric

| Ability | Type | Cooldown | Description |
|---------|------|----------|-------------|
| **Divine Bolt** | Primary | 10s | Fire a bolt of divine energy dealing moderate damage. Has a chance to temporarily blind the target. |
| **Mass Healing** | Secondary | 60s | Heal all allies within 15 units for 25% of their maximum health. |
| **Blessed Presence** | Passive | - | Allies within 10 units regenerate 1% of maximum health every 5 seconds. |
| **Resurrection** | Ultimate | 600s | Revive a fallen ally with 50% health and grant them temporary invulnerability. |

### Monk

| Ability | Type | Cooldown | Description |
|---------|------|----------|-------------|
| **Flurry of Blows** | Primary | 12s | Strike multiple times in rapid succession, dealing 25% more damage with each hit. |
| **Meditative Focus** | Secondary | 40s | Enter a state of focus, increasing all stats by 10% for 20 seconds. |
| **Flowing Motion** | Passive | - | 10% chance to dodge incoming attacks. |
| **Transcendence** | Ultimate | 240s | Drastically increase agility and movement speed for 15 seconds, becoming immune to movement impairments. |

## Weave Power Source Abilities

### Wizard

| Ability | Type | Cooldown | Description |
|---------|------|----------|-------------|
| **Arcane Barrage** | Primary | 8s | Fire multiple magic missiles that home in on targets, dealing guaranteed damage. |
| **Prismatic Barrier** | Secondary | 30s | Create a magical shield that absorbs damage and reflects a portion back to attackers. |
| **Arcane Insight** | Passive | - | Increased spell critical chance and enemy weaknesses are revealed. |
| **Time Distortion** | Ultimate | 360s | Slow time for all except the caster for 10 seconds, effectively increasing casting and movement speed. |

### Warlock

| Ability | Type | Cooldown | Description |
|---------|------|----------|-------------|
| **Eldritch Blast** | Primary | 12s | Channel a beam of chaotic energy dealing high damage that increases the longer it's channeled. |
| **Soul Drain** | Secondary | 35s | Drain life from the target, dealing damage and healing the caster. |
| **Dark Pact** | Passive | - | Skills cost health instead of mana but deal 15% more damage. |
| **Demonic Transformation** | Ultimate | 420s | Transform into a demonic form with enhanced abilities and damage for 20 seconds. |

### Sorcerer

| Ability | Type | Cooldown | Description |
|---------|------|----------|-------------|
| **Wild Magic Surge** | Primary | 14s | Cast an unpredictable but powerful spell with randomized effects. |
| **Elemental Shift** | Secondary | 25s | Change your damage type to exploit enemy weaknesses. |
| **Mana Flow** | Passive | - | Spells have a chance to cost no mana and reduced cooldown. |
| **Arcane Mastery** | Ultimate | 300s | For 15 seconds, all spells are empowered with secondary effects and reduced casting time. |

## Physical Power Source Abilities

### Warrior

| Ability | Type | Cooldown | Description |
|---------|------|----------|-------------|
| **Whirlwind Strike** | Primary | 18s | Deal weapon damage to all surrounding enemies, with a chance to stun. |
| **Battle Shout** | Secondary | 40s | Increase damage for all nearby allies by 15% for 30 seconds. |
| **Weapon Mastery** | Passive | - | Increased critical hit chance and damage with all weapons. |
| **Unstoppable Rage** | Ultimate | 300s | Enter a rage state, increasing damage dealt by 30% and reducing damage taken by 30% for 20 seconds. |

### Ranger

| Ability | Type | Cooldown | Description |
|---------|------|----------|-------------|
| **Precise Shot** | Primary | 20s | Guaranteed critical hit that ignores 50% of target's armor. |
| **Multi-Shot** | Secondary | 30s | Fire arrows at up to 3 targets simultaneously. |
| **Beast Affinity** | Passive | - | Combat animals occasionally join you in battle, attacking your enemies. |
| **Rapid Fire** | Ultimate | 240s | For 12 seconds, attack speed is doubled and movement does not interrupt attacks. |

### Rogue

| Ability | Type | Cooldown | Description |
|---------|------|----------|-------------|
| **Backstab** | Primary | 15s | Deal massive damage when attacking from behind or from stealth. |
| **Smoke Bomb** | Secondary | 45s | Create a cloud of smoke, entering stealth and confusing nearby enemies. |
| **Shadow Step** | Passive | - | Chance to teleport behind the target when taking damage. |
| **Master Assassin** | Ultimate | 360s | Enter enhanced stealth mode where you can attack without breaking stealth for 10 seconds. |

## Ability Progression System

As players advance beyond level 10 with their chosen advanced class, they can upgrade and specialize their abilities through class quests:

### Level 15 Upgrade
- Complete a class-specific quest to enhance your primary ability
- Example: Paladin's Divine Smite could be upgraded to "Greater Divine Smite" with increased damage and reduced cooldown

### Level 20 Upgrade
- Unlock a new utility ability through a challenging class quest
- Example: Wizard could unlock "Teleport" allowing instant relocation to a marked location

### Level 25 Upgrade
- Enhance secondary and passive abilities through specialized training
- Example: Rogue's Smoke Bomb could be upgraded to "Toxic Smoke" which also poisons enemies

### Level 30 Mastery
- Ultimate ability reaches its final form through a legendary class quest
- Example: Warrior's Unstoppable Rage becomes "Avatar of War" with additional combat effects

## Technical Implementation

### Smart Contract Additions

```solidity
// Add to Character table
mapping(bytes32 => mapping(bytes32 => uint256)) public abilityCooldowns;
mapping(bytes32 => bytes32[]) public unlockedAbilities;
mapping(bytes32 => bytes32) public activeUltimate;

// New table: ClassAbilities
mapping(bytes32 => ClassAbility) public classAbilities;
mapping(AdvancedClass => bytes32[]) public classAbilityList;

// Function to use an ability
function useAbility(bytes32 characterId, bytes32 abilityId, bytes32 targetId) external {
    // Check cooldown
    require(block.timestamp >= abilityCooldowns[characterId][abilityId], "Ability on cooldown");
    
    // Get ability details
    ClassAbility memory ability = classAbilities[abilityId];
    
    // Check resource cost
    // Apply ability effects
    // Start cooldown
    abilityCooldowns[characterId][abilityId] = block.timestamp + ability.cooldown;
}
```

### Client-Side Considerations

- Ability UI with cooldown indicators
- Visual effects for each ability
- Sound design that matches ability themes
- Combat log entries for ability usage
- Tooltips showing detailed ability information

## Balance Considerations

- Abilities should complement but not replace the core combat system
- Each class should have comparable power levels but distinct playstyles
- PvP balance may require different cooldowns than PvE
- Some abilities may need to be nerfed in group settings

## Next Steps

1. Finalize ability designs with specific numbers
2. Create visual mockups for ability UI
3. Design ability upgrade quest chains
4. Implement base ability system in contracts
5. Add client-side UI and effects
