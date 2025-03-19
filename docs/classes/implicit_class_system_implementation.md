# Implicit Class System: Smart Contract Implementation Plan

This document outlines the necessary changes to Ultimate Dominion's smart contracts to implement the proposed implicit class system, where players do not select a class upfront but instead discover their class through early-game choices, with formalization at level 10.

## Affected Smart Contracts

The following smart contracts will require modifications:

1. `CharacterSystem.sol`
2. `RngSystem.sol`
3. `CombatSystem.sol`
4. `EquipmentSystem.sol`
5. `Common.sol` (enums and structures)

## 1. Common.sol Modifications

### 1.1 Enum Changes

```solidity
// Replace current Classes enum
enum PowerSource {
    None,
    Divine,
    Weave,
    Physical
}

// Keep for level 10+ class selection
enum AdvancedClass {
    None,
    // STR + Divine
    Paladin,
    // STR + Weave
    Sorcerer,
    // STR + Physical
    Warrior,
    // AGI + Divine
    Monk,
    // AGI + Weave
    Warlock,
    // AGI + Physical
    Ranger,
    // INT + Divine
    Cleric,
    // INT + Weave
    Wizard,
    // INT + Physical
    Rogue
}

// Add new enum for armor types
enum ArmorType {
    None,
    Cloth,
    Leather,
    Plate
}

// Add new enum for races
enum Race {
    None,
    Robust, // Dwarf-like
    Nimble, // Elf-like
    Scholarly, // Gnome-like
    Balanced // Human-like
}
```

### 1.2 Struct Changes

```solidity
// Modify StatsData struct to include:
struct StatsData {
    // Existing fields
    int256 maxHp;
    int256 currentHp;
    int256 strength;
    int256 agility;
    int256 intelligence;
    uint256 experience;
    uint8 level;
    Classes class; // Keep for backward compatibility
    
    // New fields
    PowerSource powerSource;
    ArmorType startingArmor;
    Race race;
    AdvancedClass advancedClass;
    bool hasSelectedAdvancedClass;
}
```

## 2. CharacterSystem.sol Modifications

### 2.1 Character Creation Flow Changes

```solidity
// Replace rollStats function with more granular choices
function choosePowerSource(bytes32 characterId, PowerSource powerSource)
    public
    onlyOwner(characterId)
{
    require(!Characters.getLocked(characterId), "CHARACTERS: character already in game world");
    require(powerSource != PowerSource.None, "CHARACTERS: invalid power source");
    
    StatsData memory stats = Stats.get(characterId);
    stats.powerSource = powerSource;
    Stats.set(characterId, stats);
    
    // Emit event for power source selection
    emit PowerSourceSelected(characterId, powerSource);
}

function chooseRace(bytes32 characterId, Race race)
    public
    onlyOwner(characterId)
{
    require(!Characters.getLocked(characterId), "CHARACTERS: character already in game world");
    require(race != Race.None, "CHARACTERS: invalid race");
    
    StatsData memory stats = Stats.get(characterId);
    stats.race = race;
    
    // Apply race-based stat modifiers
    if (race == Race.Robust) {
        stats.strength += 2;
        stats.agility -= 1;
        stats.maxHp += 1;
    } else if (race == Race.Nimble) {
        stats.agility += 2;
        stats.intelligence += 1;
        stats.strength -= 1;
        stats.maxHp -= 1;
    } else if (race == Race.Scholarly) {
        stats.intelligence += 2;
        stats.strength -= 1;
    } else if (race == Race.Balanced) {
        stats.strength += 1;
        stats.agility += 1;
        stats.intelligence += 1;
    }
    
    Stats.set(characterId, stats);
    
    // Emit event for race selection
    emit RaceSelected(characterId, race);
}

function chooseStartingArmor(bytes32 characterId, ArmorType armorType)
    public
    onlyOwner(characterId)
{
    require(!Characters.getLocked(characterId), "CHARACTERS: character already in game world");
    require(armorType != ArmorType.None, "CHARACTERS: invalid armor type");
    
    StatsData memory stats = Stats.get(characterId);
    stats.startingArmor = armorType;
    
    // Apply armor-based stat modifiers
    if (armorType == ArmorType.Cloth) {
        stats.intelligence += 2;
        stats.agility += 1;
        stats.strength -= 1;
    } else if (armorType == ArmorType.Leather) {
        stats.agility += 2;
        stats.strength += 1;
    } else if (armorType == ArmorType.Plate) {
        stats.strength += 2;
        stats.maxHp += 1;
        stats.agility -= 1;
    }
    
    Stats.set(characterId, stats);
    
    // Emit event for armor selection
    emit ArmorSelected(characterId, armorType);
}

// Modify this to work with randomized base stats instead of class-specific stats
function rollBaseStats(bytes32 userRandomNumber, bytes32 characterId)
    public
    payable
    onlyOwner(characterId)
{
    require(!Characters.getLocked(characterId), "CHARACTERS: character already in game world");
    RngRequestType requestType = RngRequestType.CharacterStats;
    
    // Use systemSwitch to call rng system with new parameter structure
    SystemSwitch.call(abi.encodeCall(IRngSystem.getRng, (userRandomNumber, requestType, abi.encode(characterId))));
}

// Add function for selecting advanced class at level 10
function selectAdvancedClass(bytes32 characterId, AdvancedClass advancedClass)
    public
    onlyOwner(characterId)
{
    StatsData memory stats = Stats.get(characterId);
    
    // Check if character is level 10 or higher
    require(stats.level >= 10, "CHARACTER SYSTEM: Must be level 10 to select advanced class");
    require(!stats.hasSelectedAdvancedClass, "CHARACTER SYSTEM: Advanced class already selected");
    require(advancedClass != AdvancedClass.None, "CHARACTER SYSTEM: Invalid advanced class");
    
    // Validate class selection based on character's highest stat and power source
    require(_isValidAdvancedClass(stats, advancedClass), "CHARACTER SYSTEM: Invalid class for character build");
    
    // Apply class-specific bonuses
    _applyAdvancedClassBonuses(characterId, stats, advancedClass);
    
    // Mark as having selected advanced class
    stats.advancedClass = advancedClass;
    stats.hasSelectedAdvancedClass = true;
    Stats.set(characterId, stats);
    
    // Emit event for advanced class selection
    emit AdvancedClassSelected(characterId, advancedClass);
}

// Helper function to validate advanced class selection
function _isValidAdvancedClass(StatsData memory stats, AdvancedClass advancedClass) internal pure returns (bool) {
    // Determine dominant stat
    bool strDominant = stats.strength >= stats.agility && stats.strength >= stats.intelligence;
    bool agiDominant = stats.agility > stats.strength && stats.agility >= stats.intelligence;
    bool intDominant = stats.intelligence > stats.strength && stats.intelligence > stats.agility;
    
    if (strDominant) {
        if (stats.powerSource == PowerSource.Divine && advancedClass == AdvancedClass.Paladin) return true;
        if (stats.powerSource == PowerSource.Weave && advancedClass == AdvancedClass.Sorcerer) return true;
        if (stats.powerSource == PowerSource.Physical && advancedClass == AdvancedClass.Warrior) return true;
    } else if (agiDominant) {
        if (stats.powerSource == PowerSource.Divine && advancedClass == AdvancedClass.Monk) return true;
        if (stats.powerSource == PowerSource.Weave && advancedClass == AdvancedClass.Warlock) return true;
        if (stats.powerSource == PowerSource.Physical && advancedClass == AdvancedClass.Ranger) return true;
    } else if (intDominant) {
        if (stats.powerSource == PowerSource.Divine && advancedClass == AdvancedClass.Cleric) return true;
        if (stats.powerSource == PowerSource.Weave && advancedClass == AdvancedClass.Wizard) return true;
        if (stats.powerSource == PowerSource.Physical && advancedClass == AdvancedClass.Rogue) return true;
    }
    
    return false;
}

// Apply bonuses when selecting advanced class
function _applyAdvancedClassBonuses(bytes32 characterId, StatsData memory stats, AdvancedClass advancedClass) internal {
    // Base bonus for all advanced classes
    int256 statBonus = 2;
    
    // Apply class-specific bonuses
    if (advancedClass == AdvancedClass.Paladin) {
        stats.strength += statBonus;
        stats.maxHp += 5;
    } else if (advancedClass == AdvancedClass.Sorcerer) {
        stats.strength += 1;
        stats.intelligence += 1;
        stats.maxHp += 3;
    } else if (advancedClass == AdvancedClass.Warrior) {
        stats.strength += statBonus;
        stats.maxHp += 7;
    } else if (advancedClass == AdvancedClass.Monk) {
        stats.agility += 1;
        stats.maxHp += 3;
        stats.strength += 1;
    } else if (advancedClass == AdvancedClass.Warlock) {
        stats.agility += 1;
        stats.intelligence += 1;
        stats.maxHp += 2;
    } else if (advancedClass == AdvancedClass.Ranger) {
        stats.agility += statBonus;
        stats.maxHp += 3;
    } else if (advancedClass == AdvancedClass.Cleric) {
        stats.intelligence += 1;
        stats.maxHp += 5;
        stats.strength += 1;
    } else if (advancedClass == AdvancedClass.Wizard) {
        stats.intelligence += statBonus;
        stats.maxHp += 2;
    } else if (advancedClass == AdvancedClass.Rogue) {
        stats.intelligence += 1;
        stats.strength += 1;
        stats.maxHp += 4;
    }
    
    Stats.set(characterId, stats);
    
    // Issue class-specific items if needed
    IWorld(_world()).UD__issueAdvancedClassItems(characterId, advancedClass);
}

## Client and API Implementation

To fully implement the implicit class system, we need to make significant changes to both the client UI and API interactions. This section outlines the changes required beyond the smart contract modifications.

### Client-Side Changes

#### Type Definitions Updates

```typescript
// Add new enums in packages/client/src/utils/types.ts
export enum PowerSource {
  Divine,
  Weave,
  Physical
}

export enum Race {
  Human,
  Elf,
  Dwarf,
  Orc
}

export enum ArmorType {
  Light,
  Medium,
  Heavy
}

export enum AdvancedClass {
  // Divine-based
  Paladin,
  Cleric,
  Monk,
  
  // Weave-based
  Wizard,
  Warlock,
  Sorcerer,
  
  // Physical-based
  Warrior,
  Ranger,
  Rogue
}

// Update CharacterData type
export type CharacterData = {
  // Existing fields
  baseStats: EntityStats;
  escrowGoldBalance: bigint;
  externalGoldBalance: bigint;
  id: Entity;
  inBattle: boolean;
  isSpawned: boolean;
  locked: boolean;
  owner: string;
  position: { x: number; y: number };
  pvpCooldownTimer: bigint;
  tokenId: string;
  worldEncounter?: WorldEncounter;
  worldStatusEffects: WorldStatusEffect[];
  
  // New fields
  powerSource: PowerSource;
  race: Race;
  startingArmor: ArmorType;
  advancedClass?: AdvancedClass; // Optional because only unlocked at level 10
};

// Update EntityStats
export type EntityStats = {
  agility: bigint;
  currentHp: bigint;
  // entityClass: StatsClasses; - Deprecated
  powerSource: PowerSource;
  race: Race;
  startingArmor: ArmorType;
  advancedClass?: AdvancedClass;
  experience: bigint;
  intelligence: bigint;
  level: bigint;
  maxHp: bigint;
  strength: bigint;
};
```

#### Character Creation UI Changes

The character creation flow needs a complete redesign with three distinct steps:

1. **Race Selection**
   - Display race options with visual representations
   - Show race-specific stat bonuses
   - Provide lore for each race

2. **Power Source Selection**
   - Divine, Weave, Physical options with descriptions
   - Visual representation of each power source
   - Clear indication of how power source influences gameplay

3. **Starting Armor Selection**
   - Light, Medium, Heavy options
   - Visual representation of character with selected armor
   - Description of stat impacts for each armor type

Additional UI changes needed:
- Remove the direct class selection (Warrior/Mage/Rogue)
- Add help tooltips explaining the implicit class system
- Visualize the character's potential development path

#### Character Display Updates

The character display page needs updates to:
- Show race, power source, and armor type information
- For level 10+ characters, display their advanced class
- For characters below level 10, show potential advanced class options
- Add advanced class selection UI for characters reaching level 10
- Provide a bio field where players can describe their character's unique style and role
- Show suggested playstyle variations based on their advanced class (e.g., a Sorcerer could be described as a "Battle Mage" if they have high strength, or a "Spellslinger" if they have high agility)
- Allow players to customize the visual appearance of their character to match their envisioned role

#### Combat UI Updates

- Update combat screens to visualize the combat triangle (STR > AGI > INT > STR)
- Add visual indicators for stat-based advantages
- Display combat advantage calculations during battles

#### New UI Components

Create new UI components:
1. **RaceSelector**: Display and select race options
2. **PowerSourceSelector**: Display and select power source options
3. **ArmorSelector**: Display and select armor options
4. **AdvancedClassSelector**: For level 10 characters to choose their class
5. **CombatAdvantageIndicator**: Visual representation of combat advantages

### API Changes

#### Metadata Handling

Update the metadata handling in `packages/api/api/uploadMetadata.ts`:
```typescript
// Add fields for race, power source, and armor type
const metadata = {
  name,
  description,
  image,
  // New fields
  race: getRaceName(character.race),
  powerSource: getPowerSourceName(character.powerSource),
  startingArmor: getArmorTypeName(character.startingArmor),
  advancedClass: character.advancedClass ? getAdvancedClassName(character.advancedClass) : undefined,
  // Other fields
  attributes: [
    // Include race, power source, and armor type as attributes
    {
      trait_type: "Race",
      value: getRaceName(character.race)
    },
    {
      trait_type: "Power Source",
      value: getPowerSourceName(character.powerSource)
    },
    {
      trait_type: "Starting Armor",
      value: getArmorTypeName(character.startingArmor)
    },
    // Add advanced class if selected
    ...(character.advancedClass ? [{
      trait_type: "Advanced Class",
      value: getAdvancedClassName(character.advancedClass)
    }] : []),
    // Existing attributes
    {
      trait_type: "Strength",
      value: Number(character.strength)
    },
    // Other stats...
  ]
};
```

#### Advanced Class Selection Endpoint

Create a new API endpoint for selecting an advanced class:
```typescript
// In appropriate API file
app.post('/api/select-advanced-class', async (req, res) => {
  try {
    const { characterId, advancedClass } = req.body;
    
    // Validate the character is level 10 or higher
    // Validate the advanced class is compatible with character's build
    
    // Forward to smart contract call
    
    res.status(200).json({ 
      success: true, 
      message: "Advanced class selected successfully" 
    });
  } catch (error) {
    console.error("Error selecting advanced class:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to select advanced class" 
    });
  }
});
```

### Integration with Smart Contracts

Update the MUD context to include new smart contract function calls:

```typescript
// In MUD context
const {
  systemCalls: {
    // Existing calls
    mintCharacter,
    rollStats,
    // New calls for implicit class system
    selectRace,
    selectPowerSource,
    selectStartingArmor,
    selectAdvancedClass,
  },
} = useMUD();
```

### Client Implementation Phases

1. **Phase 1: Data Structure Updates**
   - Update type definitions
   - Create utility functions for new data types
   - Modify state management to accommodate new character properties

2. **Phase 2: Character Creation Flow**
   - Create new UI components for race, power source, and armor selection
   - Redesign character creation workflow with three distinct steps
   - Update interactions with smart contracts

3. **Phase 3: Character Display**
   - Update character profile page to show new properties
   - Implement the level 10 advanced class selection UI
   - Update character stat calculations

4. **Phase 4: Combat System Integration**
   - Implement combat triangle UI indicators
   - Update damage calculation displays
   - Add tooltips explaining advantage/disadvantage mechanics

5. **Phase 5: Testing and Refinement**
   - Test character creation flow
   - Verify advanced class selection at level 10
   - Test combat advantages and calculations
   - Optimize UI for different device sizes

### Backward Compatibility

Since the game is not launched yet, backward compatibility is not required. However, we should ensure the implementation is robust and well-documented for future developers.

## 3. RngSystem.sol Modifications

### 3.1 Stat Generation Changes

```solidity
// Modify _storeStats to work with the new implicit class system
function _storeStats(uint256 randomNumber, bytes32 characterId) internal {
    uint64[] memory chunks = randomNumber.get4Chunks();
    
    StatsData memory stats = Stats.get(characterId);
    
    // Generate base stats within range [3, 10]
    stats.strength = int256(Math.absolute(int256(int64(chunks[0]))) % 8 + 3);
    stats.agility = int256(Math.absolute(int256(int64(chunks[1]))) % 8 + 3);
    
    // Calculate intelligence to ensure total is 19
    stats.intelligence = int256(19 - stats.strength - stats.agility);
    
    // Ensure intelligence is within range [3, 10]
    if (stats.intelligence < 3) {
        int256 deficit = int256(3 - stats.intelligence);
        stats.intelligence = int256(3);
        
        if (stats.strength > stats.agility) {
            stats.strength -= deficit;
        } else {
            stats.agility -= deficit;
        }
    } else if (stats.intelligence > 10) {
        int256 excess = int256(stats.intelligence - 10);
        stats.intelligence = int256(10);
        
        if (stats.strength < stats.agility) {
            stats.strength += int256(excess);
        } else {
            stats.agility += int256(excess);
        }
    }
    
    // Set base HP (without class modifiers initially)
    stats.maxHp = int256(18);
    
    // Store base stats (Race, PowerSource, and ArmorType selections will be applied later)
    Stats.set(characterId, stats);
}
```

## 4. CombatSystem.sol Modifications

### 4.1 Combat Triangle Implementation

```solidity
// Add new method to calculate advantage based on the rock-paper-scissors system
function _calculateAttributeAdvantage(
    StatsData memory attackerStats,
    StatsData memory defenderStats
) internal pure returns (uint256 advantageModifier) {
    // Determine attacker's dominant attribute
    int256 attackerDominant;
    string memory attackerAttribute;
    
    if (attackerStats.strength >= attackerStats.agility && attackerStats.strength >= attackerStats.intelligence) {
        attackerDominant = attackerStats.strength;
        attackerAttribute = "STR";
    } else if (attackerStats.agility > attackerStats.strength && attackerStats.agility >= attackerStats.intelligence) {
        attackerDominant = attackerStats.agility;
        attackerAttribute = "AGI";
    } else {
        attackerDominant = attackerStats.intelligence;
        attackerAttribute = "INT";
    }
    
    // Determine defender's dominant attribute
    int256 defenderDominant;
    string memory defenderAttribute;
    
    if (defenderStats.strength >= defenderStats.agility && defenderStats.strength >= defenderStats.intelligence) {
        defenderDominant = defenderStats.strength;
        defenderAttribute = "STR";
    } else if (defenderStats.agility > defenderStats.strength && defenderStats.agility >= defenderStats.intelligence) {
        defenderDominant = defenderStats.agility;
        defenderAttribute = "AGI";
    } else {
        defenderDominant = defenderStats.intelligence;
        defenderAttribute = "INT";
    }
    
    // Apply combat triangle: STR > AGI, AGI > INT, INT > STR
    bool hasAdvantage = false;
    
    if (attackerAttribute == "STR" && defenderAttribute == "AGI") {
        hasAdvantage = true;
    } else if (attackerAttribute == "AGI" && defenderAttribute == "INT") {
        hasAdvantage = true;
    } else if (attackerAttribute == "INT" && defenderAttribute == "STR") {
        hasAdvantage = true;
    }
    
    if (hasAdvantage) {
        // Apply advantage formula: 1 + (AttackerDominantStat - DefenderDominantStat) * 0.05
        // Implemented as integer math with WAD fixed point
        int256 statDifference = attackerDominant - defenderDominant;
        if (statDifference < 0) statDifference = 0; // Floor at 0 to prevent penalties
        
        uint256 advantageBonus = uint256(statDifference) * WAD / 20; // Equivalent to * 0.05 in fixed point
        return WAD + advantageBonus;
    }
    
    return WAD; // No advantage (1.0 multiplier)
}

// Modify existing _calculatePhysicalEffect to incorporate the combat triangle
function _calculatePhysicalEffect(
    bytes32 effectId,
    bytes32 attackerId,
    bytes32 defenderId,
    bytes32 itemId,
    uint256 randomNumber
) internal view returns (uint256 damage, bool hit, bool crit) {
    // Get attacker and defender stats
    StatsData memory attackerStats = Stats.get(attackerId);
    StatsData memory defenderStats = Stats.get(defenderId);
    
    // Get attribute advantage modifier
    uint256 attributeAdvantageModifier = _calculateAttributeAdvantage(attackerStats, defenderStats);
    
    // Rest of the existing function...
    // (incorporate attributeAdvantageModifier into damage calculation)
    damage = damage * attributeAdvantageModifier / WAD;
    
    return (damage, hit, crit);
}

// Similarly modify _calculateMagicEffect to incorporate the combat triangle
```

## 5. ItemsSystem.sol Modifications

### 5.1 Starter Items for Implicit Class System

```solidity
// Add function to issue starter items based on armor type
function issueImplicitClassStarterItems(bytes32 characterId, ArmorType armorType) public {
    _requireAccess(address(this), _msgSender());
    
    uint256[] memory itemIds;
    uint256[] memory amounts;
    
    if (armorType == ArmorType.Cloth) {
        // Cloth armor starter items (mage-like)
        itemIds = new uint256[](3);
        amounts = new uint256[](3);
        
        itemIds[0] = CLOTH_ROBE_ITEM_ID;
        itemIds[1] = NOVICE_WAND_ITEM_ID;
        itemIds[2] = MINOR_MANA_POTION_ITEM_ID;
        
        amounts[0] = 1;
        amounts[1] = 1;
        amounts[2] = 3;
    } else if (armorType == ArmorType.Leather) {
        // Leather armor starter items (rogue-like)
        itemIds = new uint256[](3);
        amounts = new uint256[](3);
        
        itemIds[0] = LEATHER_VEST_ITEM_ID;
        itemIds[1] = TRAINING_DAGGER_ITEM_ID;
        itemIds[2] = MINOR_HEALTH_POTION_ITEM_ID;
        
        amounts[0] = 1;
        amounts[1] = 1;
        amounts[2] = 3;
    } else if (armorType == ArmorType.Plate) {
        // Plate armor starter items (warrior-like)
        itemIds = new uint256[](3);
        amounts = new uint256[](3);
        
        itemIds[0] = PLATE_CHEST_ITEM_ID;
        itemIds[1] = RUSTY_AXE_ITEM_ID;
        itemIds[2] = MINOR_HEALTH_POTION_ITEM_ID;
        
        amounts[0] = 1;
        amounts[1] = 1;
        amounts[2] = 3;
    }
    
    for (uint256 i = 0; i < itemIds.length; i++) {
        _mintItemTo(characterId, itemIds[i], amounts[i]);
    }
}

// Add function to issue advanced class items at level 10
function issueAdvancedClassItems(bytes32 characterId, AdvancedClass advancedClass) public {
    _requireAccess(address(this), _msgSender());
    
    uint256[] memory itemIds;
    uint256[] memory amounts;
    
    // Issue class-specific items based on advanced class
    if (advancedClass == AdvancedClass.Paladin) {
        // Paladin-specific items
        itemIds = new uint256[](2);
        amounts = new uint256[](2);
        
        itemIds[0] = PALADIN_HAMMER_ITEM_ID;
        itemIds[1] = HOLY_SYMBOL_ITEM_ID;
        
        amounts[0] = 1;
        amounts[1] = 1;
    } else if (advancedClass == AdvancedClass.Sorcerer) {
        // Sorcerer items
        // ...
    }
    // Continue for other advanced classes
    
    for (uint256 i = 0; i < itemIds.length; i++) {
        _mintItemTo(characterId, itemIds[i], amounts[i]);
    }
}
```

## 6. Migration Considerations

### 6.1 Backward Compatibility

To maintain backward compatibility with existing characters:

```solidity
// Add a function to migrate existing characters to the new system
function migrateCharacterToImplicitSystem(bytes32 characterId) public onlyOwner(characterId) {
    StatsData memory stats = Stats.get(characterId);
    
    // Skip if already migrated
    if (stats.powerSource != PowerSource.None) {
        return;
    }
    
    // Map existing class to appropriate power source and starting armor
    if (stats.class == Classes.Warrior) {
        stats.powerSource = PowerSource.Physical;
        stats.startingArmor = ArmorType.Plate;
        stats.race = Race.Robust; // Default to Robust for Warriors
        
        // If level 10+, set advanced class
        if (stats.level >= 10) {
            stats.advancedClass = AdvancedClass.Warrior;
            stats.hasSelectedAdvancedClass = true;
        }
    } else if (stats.class == Classes.Rogue) {
        stats.powerSource = PowerSource.Physical;
        stats.startingArmor = ArmorType.Leather;
        stats.race = Race.Nimble; // Default to Nimble for Rogues
        
        // If level 10+, set advanced class
        if (stats.level >= 10) {
            stats.advancedClass = AdvancedClass.Rogue;
            stats.hasSelectedAdvancedClass = true;
        }
    } else if (stats.class == Classes.Mage) {
        stats.powerSource = PowerSource.Weave;
        stats.startingArmor = ArmorType.Cloth;
        stats.race = Race.Scholarly; // Default to Scholarly for Mages
        
        // If level 10+, set advanced class
        if (stats.level >= 10) {
            stats.advancedClass = AdvancedClass.Wizard;
            stats.hasSelectedAdvancedClass = true;
        }
    }
    
    Stats.set(characterId, stats);
    
    // Update encoded stats in character data
    CharactersData memory charData = Characters.get(characterId);
    charData.baseStats = abi.encode(stats);
    Characters.set(characterId, charData);
    
    emit CharacterMigrated(characterId);
}
```

## 7. Testing Requirements

1. Unit tests for each new function and modifier
2. Integration tests for character creation flow
3. Combat triangle testing with various stat combinations
4. Migration testing for existing characters
5. Advanced class selection validation tests

## 8. Deployment Strategy

1. Deploy schema changes first
2. Deploy updated contracts
3. Run migration scripts for existing characters
4. Update frontend to support new character creation flow
5. Communicate changes to players

## 9. Gas Optimization Considerations

The new system introduces additional state changes during character creation, which will increase gas costs. Consider:

1. Batching operations where possible
2. Optimizing storage layouts
3. Using events for non-critical data that doesn't need to be stored on-chain

## 10. Security Considerations

1. Ensure proper access controls for all new functions
2. Validate all inputs to prevent exploitation of stat calculations
3. Implement circuit breakers for migration process
4. Thoroughly audit the combat advantage calculations

This comprehensive implementation plan outlines all necessary contract changes to support the new implicit class system, maintaining backward compatibility while enabling the more organic character development path described in the analysis document.
