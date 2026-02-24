# Item System Implementation for Class-Based Gameplay

## Overview

The item system in Ultimate Dominion needs to support our implicit class system, combat triangle mechanics, and power source alignment. This document outlines the necessary changes to integrate these systems cohesively.

## Item Categories and Types

### Weapons

#### Weapon Types by Power Source

**Divine Weapons:**
- Holy Maces and Warhammers (STR + Divine)
- Blessed Staves (INT + Divine)
- Sacred Fist Weapons (AGI + Divine)

**Weave Weapons:**
- Arcane Staves and Wands (INT + Weave)
- Eldritch Blades (STR + Weave)
- Runic Daggers (AGI + Weave)

**Physical Weapons:**
- Swords, Axes, and Hammers (STR + Physical)
- Bows and Crossbows (AGI + Physical) 
- Daggers and Throwing Weapons (INT + Physical)

#### Weapon Stats Structure

```solidity
struct WeaponStatsData {
    uint256 minLevel;        // Minimum level to equip
    uint256 damage;          // Base damage
    uint256 critChance;      // Critical hit chance (0-100)
    uint256 critMultiplier;  // Critical hit multiplier (e.g., 150 = 1.5x)
    uint256 attackSpeed;     // Attacks per minute
    bytes32[] effects;       // Special effects this weapon can trigger
    PowerSource powerSource; // Divine, Weave, or Physical
    bool twoHanded;          // If true, cannot equip shield/offhand
    
    // Class system integration
    StatFocus primaryFocus;  // STR, AGI, or INT focus
    AdvancedClass bestClass; // Class that gets maximum benefit
}
```

### Armor

#### Armor Types

**Light Armor:**
- Cloth Robes (INT-focused)
- Leather Armor (AGI-focused)
- Enchanted Garments (various focus)

**Medium Armor:**
- Scale and Chain (balanced stats)
- Reinforced Leather (AGI/STR mix)
- Blessed Vestments (INT/STR mix)

**Heavy Armor:**
- Plate Mail (STR-focused)
- Runic Plate (INT/STR mix)
- Reinforced Plate (STR/AGI mix)

#### Armor Stats Structure

```solidity
struct ArmorStatsData {
    uint256 minLevel;        // Minimum level to equip
    uint256 armorValue;      // Direct damage reduction
    uint256 magicResist;     // Magic damage reduction
    ArmorType armorType;     // Light, Medium, or Heavy
    bytes32[] effects;       // Special effects this armor can trigger
    PowerSource powerSource; // Divine, Weave, or Physical
    
    // Class system integration
    StatFocus primaryFocus;  // STR, AGI, or INT focus
    AdvancedClass bestClass; // Class that gets maximum benefit
}
```

### Spells

#### Spell Types by Power Source

**Divine Spells:**
- Healing
- Protection
- Smiting

**Weave Spells:**
- Elemental
- Illusion
- Conjuration

**Physical Techniques:**
- Combat Maneuvers
- Poisons
- Traps

#### Spell Stats Structure

```solidity
struct SpellStatsData {
    uint256 minLevel;        // Minimum level to equip
    uint256 manaCost;        // Mana required to cast
    uint256 cooldown;        // Cooldown in seconds
    uint256 basePower;       // Base effect power
    bytes32[] effects;       // Effects the spell applies
    PowerSource powerSource; // Divine, Weave, or Physical
    
    // Class system integration
    StatFocus primaryFocus;  // STR, AGI, or INT focus
    AdvancedClass bestClass; // Class that gets maximum benefit
}
```

### Consumables

#### Consumable Types

**Potions:**
- Health, Mana, Stamina
- Stat Boosters
- Resistance Elixirs

**Food:**
- Stat Buffs
- Regeneration Effects
- Special Abilities

**Scrolls:**
- Temporary Spell Access
- Teleportation
- Emergency Effects

#### Consumable Stats Structure

```solidity
struct ConsumableStatsData {
    uint256 minLevel;        // Minimum level to use
    uint256 duration;        // Effect duration in seconds
    uint256 cooldown;        // Cooldown between uses
    uint256 charges;         // Number of uses before consumed
    bytes32[] effects;       // Effects the consumable applies
    PowerSource powerSource; // Divine, Weave, or Physical
    
    // Class system integration
    AdvancedClass bestClass; // Class that gets maximum benefit
}
```

## Stat Restriction Enhancements

The current system uses the StatRestrictionsData struct to define minimum stat requirements. We'll extend this to incorporate power source requirements:

```solidity
struct StatRestrictionsData {
    uint256 minStrength;
    uint256 minAgility;
    uint256 minIntelligence;
    
    // New fields
    PowerSource[] compatiblePowerSources;
    AdvancedClass[] compatibleClasses;
    uint256 powerSourceBonus; // Extra effect when power source matches
    uint256 classBonus;       // Extra effect when class matches
}
```

## Implementation Changes

### 1. ItemsSystem.sol Updates

Add the new fields to the item creation function:

```solidity
function createItem(
    ItemType itemType,
    uint256 supply,
    uint256 dropChance,
    uint256 price,
    bytes memory stats,
    string memory itemMetadataURI,
    PowerSource powerSource,
    AdvancedClass bestClass
) public returns (uint256) {
    // Existing creation logic
    
    // Set additional fields
    if (itemType == ItemType.Weapon) {
        WeaponStatsData memory weaponStats;
        StatRestrictionsData memory statRestrictions;
        (weaponStats, statRestrictions) = abi.decode(stats, (WeaponStatsData, StatRestrictionsData));
        
        weaponStats.powerSource = powerSource;
        weaponStats.bestClass = bestClass;
        
        WeaponStats.set(itemId, weaponStats);
        StatRestrictions.set(itemId, statRestrictions);
    }
    // Similar updates for other item types
    
    return itemId;
}
```

### 2. EquipmentSystem.sol Updates

Update the checkRequirements function to consider power source and class:

```solidity
function checkRequirements(bytes32 characterId, uint256 itemId) public view returns (bool canUse) {
    ItemsData memory itemData = Items.get(itemId);
    CharactersData memory charData = Characters.get(characterId);
    StatsData memory character = abi.decode(Characters.getBaseStats(characterId), (StatsData));
    StatRestrictionsData memory statRestrictions = StatRestrictions.get(itemId);
    
    // Check basic requirements
    bool hasStats = true;
    if (statRestrictions.minAgility > character.agility) hasStats = false;
    if (statRestrictions.minStrength > character.strength) hasStats = false;
    if (statRestrictions.minIntelligence > character.intelligence) hasStats = false;
    
    // Check power source compatibility
    bool correctPowerSource = false;
    for (uint i = 0; i < statRestrictions.compatiblePowerSources.length; i++) {
        if (statRestrictions.compatiblePowerSources[i] == charData.powerSource) {
            correctPowerSource = true;
            break;
        }
    }
    
    // If character has an advanced class, check class compatibility
    bool correctClass = true;
    if (character.level >= 10 && statRestrictions.compatibleClasses.length > 0) {
        correctClass = false;
        for (uint i = 0; i < statRestrictions.compatibleClasses.length; i++) {
            if (statRestrictions.compatibleClasses[i] == charData.advancedClass) {
                correctClass = true;
                break;
            }
        }
    }
    
    // Item-specific level check
    bool isLevel = false;
    if (itemData.itemType == ItemType.Weapon) {
        isLevel = character.level >= WeaponStats.getMinLevel(itemId);
    } else if (itemData.itemType == ItemType.Armor) {
        isLevel = character.level >= ArmorStats.getMinLevel(itemId);
    } // Similar checks for other types
    
    canUse = hasStats && correctPowerSource && correctClass && isLevel;
    
    return canUse;
}
```

### 3. Combat Advantages for Class-Appropriate Items

Enhance the combat calculation to account for class bonuses:

```solidity
function calculateCombatBonus(bytes32 characterId, uint256 itemId) public view returns (uint256 bonus) {
    CharactersData memory charData = Characters.get(characterId);
    ItemsData memory itemData = Items.get(itemId);
    
    // Base bonus is zero
    bonus = 0;
    
    // Power source match bonus
    if (itemData.itemType == ItemType.Weapon) {
        WeaponStatsData memory weaponStats = WeaponStats.get(itemId);
        
        if (weaponStats.powerSource == charData.powerSource) {
            bonus += StatRestrictions.getPowerSourceBonus(itemId);
        }
        
        // Class match bonus (for level 10+ characters)
        if (charData.level >= 10 && weaponStats.bestClass == charData.advancedClass) {
            bonus += StatRestrictions.getClassBonus(itemId);
        }
    }
    // Similar logic for other item types
    
    return bonus;
}
```

## Starter Equipment Sets

Define standard starter equipment for new characters based on their initial choices:

```solidity
function issueStarterEquipment(
    bytes32 characterId, 
    PowerSource powerSource, 
    ArmorType armorType
) public {
    // Divine + Light Armor Starter Set
    if (powerSource == PowerSource.Divine && armorType == ArmorType.Light) {
        _issueItem(characterId, DIVINE_LIGHT_WEAPON);
        _issueItem(characterId, DIVINE_LIGHT_ARMOR);
        _issueItem(characterId, DIVINE_STARTER_SPELL);
    }
    // Divine + Medium Armor Starter Set
    else if (powerSource == PowerSource.Divine && armorType == ArmorType.Medium) {
        _issueItem(characterId, DIVINE_MEDIUM_WEAPON);
        _issueItem(characterId, DIVINE_MEDIUM_ARMOR);
        _issueItem(characterId, DIVINE_STARTER_SPELL);
    }
    // Continue for all combinations...
}
```

## Advanced Class Equipment

Special equipment issued when a player selects their advanced class at level 10:

```solidity
function issueAdvancedClassEquipment(bytes32 characterId, AdvancedClass advancedClass) public {
    require(Characters.getLevel(characterId) >= 10, "Character not high enough level");
    
    if (advancedClass == AdvancedClass.Paladin) {
        _issueItem(characterId, PALADIN_WEAPON);
        _issueItem(characterId, PALADIN_ARMOR);
        _issueItem(characterId, PALADIN_SPECIAL);
    }
    else if (advancedClass == AdvancedClass.Cleric) {
        _issueItem(characterId, CLERIC_WEAPON);
        _issueItem(characterId, CLERIC_ARMOR);
        _issueItem(characterId, CLERIC_SPECIAL);
    }
    // Continue for all advanced classes...
}
```

## Item Set Bonuses

Implement equipment set bonuses to encourage thematic equipment choices:

```solidity
struct ItemSet {
    uint256[] items;         // Items in this set
    uint256 requiredCount;   // Number needed for partial bonus
    uint256 fullSetCount;    // Number needed for full bonus
    bytes32[] partialEffects; // Effects when partial set equipped
    bytes32[] fullEffects;    // Effects when full set equipped
    AdvancedClass relatedClass; // Class this set is designed for
}

function checkForSetBonuses(bytes32 characterId) public {
    // Get all equipped items
    uint256[] memory equippedItems = getAllEquippedItems(characterId);
    
    // Check each known set
    for (uint i = 0; i < itemSets.length; i++) {
        ItemSet memory set = itemSets[i];
        uint256 matchCount = 0;
        
        // Count matches with this set
        for (uint j = 0; j < equippedItems.length; j++) {
            for (uint k = 0; k < set.items.length; k++) {
                if (equippedItems[j] == set.items[k]) {
                    matchCount++;
                    break;
                }
            }
        }
        
        // Apply appropriate set bonuses
        if (matchCount >= set.fullSetCount) {
            applyEffects(characterId, set.fullEffects);
        }
        else if (matchCount >= set.requiredCount) {
            applyEffects(characterId, set.partialEffects);
        }
    }
}
```

## UI Considerations

The UI should clearly communicate:

1. Which items are suitable for the player's power source
2. Which items are optimal for their advanced class
3. Set bonuses and their requirements
4. Combat advantages from properly matching items
5. Any item restrictions the player doesn't meet (with explanations)

## Next Steps

1. Design specific starter equipment sets for each power source + armor type combination
2. Create advanced class specific equipment with unique visuals and effects
3. Design item sets with progressive bonuses
4. Implement the enhanced item requirements checking
5. Update item metadata to reflect power source and class affiliations
