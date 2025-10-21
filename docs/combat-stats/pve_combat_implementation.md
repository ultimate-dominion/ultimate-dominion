# PvE Combat Implementation Guide

## Overview

This document provides specific implementation instructions for balancing the PvE combat system in Ultimate Dominion. It is based on the analysis found in `pve_combat_analysis.md` and `pve_combat_balance.md` and focuses on actionable steps to achieve the desired combat balance.

**This document serves as the definitive source of truth for all future combat balance implementation work.**

## Core Design Principles

### 1. Universal Multi-Stat Scaling
All items and abilities scale with multiple stats to prevent single-stat dominance while maintaining specialization benefits.

### 2. Small Stat Bonuses
Hit chance and critical hit chance receive minimal stat bonuses to prevent AGI dominance while allowing stat investment to matter.

### 3. Item-Based Build Solutions
Items fill major gaps in specialized builds, making any build viable with appropriate equipment choices.

### 4. Combat Triangle Implementation
STR > AGI > INT > STR rock-paper-scissors system with proper stat-specific advantages.

### 5. HP Baseline
All characters start with 10 HP at level 1, scaling to 25-35 HP at level 10.

## Systematic Testing Strategy

### Critical Testing Protocol

**EVERY change must be validated with a full deployment cycle before proceeding to the next change.**

#### Phase 1: Pre-Change Validation
1. **Baseline Verification**
   - Ensure all services are running cleanly (Anvil, API, Client)
   - Verify PostDeploy script runs successfully with current codebase
   - Confirm manual delegation works via `cast send`
   - Test basic character creation flow

2. **Change Isolation**
   - Make ONE small, atomic change
   - Document exactly what was changed
   - Commit the change with descriptive message

#### Phase 2: Full Deployment Test
1. **Clean Environment**
   ```bash
   # Kill all processes
   pkill -f "anvil\|pnpm dev\|node.*local.ts"
   
   # Start fresh
   cd packages/contracts && anvil
   # In new terminal: deploy contracts
   # In new terminal: run PostDeploy script
   # In new terminal: start API
   # In new terminal: start Client
   ```

2. **Validation Checklist**
   - [ ] Anvil running on port 8545
   - [ ] World contract deployed successfully
   - [ ] PostDeploy script runs without errors
   - [ ] API responding on port 3001
   - [ ] Client loading on port 3000
   - [ ] Manual delegation works via `cast send`
   - [ ] Character creation flow works end-to-end

3. **Failure Protocol**
   - If ANY step fails, immediately revert the change
   - Document the failure reason
   - Investigate root cause before attempting next change
   - Do not proceed until current change is fully working

#### Phase 3: Incremental Progression
1. **Change Size Guidelines**
   - **Micro changes**: Single enum value, small constant adjustment
   - **Small changes**: Single function modification, one struct field
   - **Medium changes**: Multiple related functions, new struct
   - **Large changes**: New system, major refactoring

2. **Testing Frequency**
   - **Micro/Small**: Test after each change
   - **Medium**: Test after each logical group
   - **Large**: Test after each major component

#### Phase 4: Documentation
1. **Change Log**
   - Record each successful change
   - Note any issues encountered
   - Document workarounds or solutions

2. **Rollback Plan**
   - Maintain clean git commits for each working state
   - Tag stable checkpoints
   - Keep detailed notes on what each change accomplishes

### Common Failure Points

1. **PostDeploy Script Failures**
   - "number expected" errors → JSON parsing issues
   - "Stack too deep" errors → Too many local variables
   - "address(this)" errors → Foundry version compatibility

2. **Deployment Issues**
   - Port conflicts → Kill all processes, restart cleanly
   - Contract size limits → Split large contracts
   - Missing dependencies → Check imports and remappings

3. **Client Connection Issues**
   - MetaMask connection failures → Check chain ID configuration
   - Delegation errors → Verify StandardDelegationsModule installation
   - API 404 errors → Confirm API is running on correct port

### Emergency Procedures

1. **Complete Reset**
   ```bash
   git stash
   git checkout dev
   git pull origin dev
   # Start fresh deployment cycle
   ```

2. **Partial Rollback**
   ```bash
   git log --oneline -10  # Find last working commit
   git reset --hard <commit-hash>
   # Test deployment
   ```

3. **Debug Mode**
   - Add extensive logging to PostDeploy script
   - Use `cast call` to test individual functions
   - Check Anvil logs for detailed error information

### Step-by-Step Testing Workflow

#### Example: Adding AttackType Enum

1. **Pre-Change Validation**
   ```bash
   # Verify current state works
   cd packages/contracts
   pnpm mud tablegen
   pnpm foundry:deploy
   forge script script/PostDeploy.s.sol --rpc-url http://localhost:8545 --broadcast
   ```

2. **Make Small Change**
   ```solidity
   // In mud.config.ts, add:
   enums: {
     AttackType: ["PHYSICAL", "MAGICAL", "RANGED"],
     // ... existing enums
   }
   ```

3. **Full Deployment Test**
   ```bash
   # Kill all processes
   pkill -f "anvil\|pnpm dev\|node.*local.ts"
   
   # Start Anvil
   cd packages/contracts && anvil
   
   # In new terminal: Deploy
   cd packages/contracts
   pnpm mud tablegen  # Regenerate codegen
   pnpm foundry:deploy
   
   # In new terminal: Run PostDeploy
   forge script script/PostDeploy.s.sol --rpc-url http://localhost:8545 --broadcast
   
   # In new terminal: Start API
   cd packages/api && pnpm dev
   
   # In new terminal: Start Client
   cd packages/client && pnpm dev
   ```

4. **Validation**
   - Check all services are running
   - Test manual delegation: `cast send 0x... "registerDelegation(...)" ...`
   - Test character creation in browser
   - If ANY step fails, revert and investigate

5. **Success Criteria**
   - All services running without errors
   - PostDeploy script completes successfully
   - Manual delegation works
   - Client loads and connects properly
   - Character creation flow works

#### Example: Modifying Damage Calculation

1. **Pre-Change**: Follow validation steps above
2. **Change**: Modify single function in CombatSystem.sol
3. **Test**: Full deployment cycle
4. **Validate**: All systems working
5. **Commit**: Only if everything works

### Change Categories and Testing Requirements

| Change Type | Example | Test Required | Rollback Risk |
|-------------|---------|---------------|---------------|
| **Micro** | Enum value, constant | Full deployment | Low |
| **Small** | Single function, struct field | Full deployment | Low |
| **Medium** | Multiple functions, new struct | Full deployment + manual testing | Medium |
| **Large** | New system, major refactor | Full deployment + extensive testing | High |

### Quality Gates

**Before proceeding to next change:**
1. ✅ All services running cleanly
2. ✅ PostDeploy script successful
3. ✅ Manual delegation working
4. ✅ Client loading without errors
5. ✅ Basic game flow functional
6. ✅ Change committed with clear message

**If any gate fails:**
- Stop immediately
- Revert the change
- Investigate root cause
- Fix the issue before proceeding

## Implementation Specifications

### Universal Multi-Stat Scaling System

#### Physical Weapons (Swords, Axes, Clubs)
```solidity
function calculatePhysicalDamage(StatsData memory stats, uint256 weaponId) internal pure returns (int256) {
    WeaponData memory weapon = getWeaponData(weaponId);
    
    int256 primaryDamage = stats.strength * weapon.strengthMultiplier;     // Primary: 2.0
    int256 secondaryBonus = stats.agility * weapon.agilityMultiplier;      // Secondary: 0.5
    int256 tertiaryBonus = stats.intelligence * weapon.intelligenceMultiplier; // Tertiary: 0.3
    
    return primaryDamage + secondaryBonus + tertiaryBonus;
}
```

#### Magical Weapons (Staves, Wands, Orbs)
```solidity
function calculateMagicalDamage(StatsData memory stats, uint256 spellId) internal pure returns (int256) {
    SpellData memory spell = getSpellData(spellId);
    
    int256 primaryDamage = stats.intelligence * spell.intelligenceMultiplier; // Primary: 2.0
    int256 secondaryBonus = stats.strength * spell.strengthMultiplier;        // Secondary: 0.4
    int256 tertiaryBonus = stats.agility * spell.agilityMultiplier;          // Tertiary: 0.6
    
    return primaryDamage + secondaryBonus + tertiaryBonus;
}
```

#### Ranged Weapons (Bows, Crossbows, Throwing)
```solidity
function calculateRangedDamage(StatsData memory stats, uint256 weaponId) internal pure returns (int256) {
    WeaponData memory weapon = getWeaponData(weaponId);
    
    int256 primaryDamage = stats.agility * weapon.agilityMultiplier;        // Primary: 2.0
    int256 secondaryBonus = stats.strength * weapon.strengthMultiplier;     // Secondary: 0.6
    int256 tertiaryBonus = stats.intelligence * weapon.intelligenceMultiplier; // Tertiary: 0.4
    
    return primaryDamage + secondaryBonus + tertiaryBonus;
}
```

### Small Stat Bonuses System

#### Hit Chance Calculation
```solidity
enum AttackType {
    PHYSICAL,  // Swords, axes, clubs
    MAGICAL,   // Spells, staves
    RANGED     // Bows, crossbows, throwing weapons
}

function calculateHitChance(StatsData memory stats, AttackType attackType) internal pure returns (int256) {
    int256 baseChance = 85; // 85% base hit chance
    
    if (attackType == AttackType.PHYSICAL) {
        return baseChance + (stats.strength / 50); // +1% per 50 STR
    } else if (attackType == AttackType.MAGICAL) {
        return baseChance + (stats.intelligence / 50); // +1% per 50 INT
    } else if (attackType == AttackType.RANGED) {
        return baseChance + (stats.agility / 50); // +1% per 50 AGI
    }
    
    return baseChance;
}
```

#### Critical Hit Calculation
```solidity
function calculateCritChance(StatsData memory stats, AttackType attackType) internal pure returns (int256) {
    int256 baseCrit = 5; // 5% base crit chance
    
    if (attackType == AttackType.PHYSICAL) {
        return baseCrit + (stats.strength / 100); // +1% per 100 STR
    } else if (attackType == AttackType.MAGICAL) {
        return baseCrit + (stats.intelligence / 100); // +1% per 100 INT
    } else if (attackType == AttackType.RANGED) {
        return baseCrit + (stats.agility / 100); // +1% per 100 AGI
    }
    
    return baseCrit;
}
```

### Item-Based Build Solutions

#### Item Bonus Structure
```solidity
struct ItemBonuses {
    uint256 hitChanceBonus;    // +5% to +15%
    uint256 critChanceBonus;   // +3% to +10%
    uint256 damageBonus;       // +1 to +5
    uint256 statRequirements; // Required stats to use
    AttackType attackType;     // Which attack type this item affects
}
```

#### Final Hit Chance Calculation
```solidity
function calculateFinalHitChance(StatsData memory stats, AttackType attackType, ItemBonuses memory item) internal pure returns (int256) {
    int256 baseChance = calculateHitChance(stats, attackType);
    int256 totalChance = baseChance + int256(item.hitChanceBonus);
    return totalChance > 98 ? 98 : totalChance; // Cap at 98%
}
```

#### Item Rarity Bonuses
```solidity
// Hit Chance Items by Rarity
uint256 constant COMMON_HIT_CHANCE_BONUS = 5;    // +5% hit chance
uint256 constant UNCOMMON_HIT_CHANCE_BONUS = 8;  // +8% hit chance
uint256 constant RARE_HIT_CHANCE_BONUS = 12;     // +12% hit chance
uint256 constant LEGENDARY_HIT_CHANCE_BONUS = 15; // +15% hit chance

// Critical Hit Items by Rarity
uint256 constant COMMON_CRIT_CHANCE_BONUS = 3;    // +3% crit chance
uint256 constant UNCOMMON_CRIT_CHANCE_BONUS = 5;  // +5% crit chance
uint256 constant RARE_CRIT_CHANCE_BONUS = 8;      // +8% crit chance
uint256 constant LEGENDARY_CRIT_CHANCE_BONUS = 10; // +10% crit chance
```

### Combat Triangle Implementation

#### STR > AGI (Warrior > Rogue)
- STR builds have higher HP and armor penetration
- Physical damage overwhelms AGI's evasion
- STR builds can interrupt AGI builds' actions

#### AGI > INT (Rogue > Mage)
- AGI builds have speed and precision advantages
- Ranged attacks overwhelm INT builds' magical defenses
- AGI builds can interrupt INT builds' spell casting

#### INT > STR (Mage > Warrior)
- INT builds use magical damage that bypasses physical armor
- Magical attacks exploit STR builds' magical weakness
- INT builds can apply status effects that STR builds struggle with

### HP Scaling System

#### Character HP Progression
```solidity
function calculateCharacterHP(uint256 level, Classes characterClass) internal pure returns (int256) {
    int256 baseHP = 10; // Level 1 baseline
    int256 levelHP = int256(level) * 1; // +1 HP per level
    
    // Class-specific HP bonuses
    if (characterClass == Classes.Warrior && level % 3 == 0) {
        levelHP += 1; // Warriors get +1 HP every 3 levels
    }
    
    return baseHP + levelHP;
}
```

#### Mob HP Progression
```solidity
function calculateMobHP(uint256 mobLevel, uint8 mobType) internal pure returns (int256) {
    int256 baseHP = 8 + int256(mobLevel) * 2; // +2 HP per level
    
    if (mobType == MOB_TYPE_ELITE) {
        baseHP = baseHP * 15 / 10; // Elite mobs have 50% more HP
    } else if (mobType == MOB_TYPE_BOSS) {
        baseHP = baseHP * 20 / 10; // Boss mobs have 100% more HP
    }
    
    return baseHP;
}
```

## Files Requiring Modification

### Core Combat Mechanics

1. **CombatSystem.sol**
   - **Location**: `/packages/contracts/src/systems/CombatSystem.sol`
   - **Changes Needed**:
     - Implement universal multi-stat scaling in damage calculations
     - Add AttackType enum and stat-specific hit/crit chance calculations
     - Update `_calculateToHit()` to use stat-specific bonuses
     - Modify `_calculateCrit()` to use stat-specific bonuses
     - Add item bonus integration to final calculations

2. **Constants.sol**
   - **Location**: `/packages/contracts/constants.sol`
   - **Changes Needed**:
     - Add AttackType enum definition
     - Add item bonus constants (hit chance, crit chance)
     - Add stat scaling multipliers for different weapon types
     - Add HP scaling constants
     - Remove old linear scaling constants

### Item and Equipment Systems

3. **ItemsSystem.sol**
   - **Location**: `/packages/contracts/src/systems/ItemsSystem.sol`
   - **Changes Needed**:
     - Implement universal multi-stat scaling for all items
     - Add ItemBonuses struct and calculations
     - Update weapon damage calculations to use multi-stat scaling
     - Add item rarity-based bonus calculations

4. **EquipmentSystem.sol**
   - **Location**: `/packages/contracts/src/systems/EquipmentSystem.sol`
   - **Changes Needed**:
     - Update equipment bonus calculations to use multi-stat scaling
     - Add item bonus integration to stat calculations
     - Ensure equipment complements rather than dominates character stats

### Character and Mob Systems

5. **CharacterSystem.sol**
   - **Location**: `/packages/contracts/src/systems/CharacterSystem.sol`
   - **Changes Needed**:
     - Update HP calculation to use 10 HP baseline
     - Implement new HP scaling formula
     - Ensure stat progression supports multi-stat scaling

6. **MobSystem.sol**
   - **Location**: `/packages/contracts/src/systems/MobSystem.sol`
   - **Changes Needed**:
     - Implement new HP scaling formula for mobs
     - Add mob type variations (normal, elite, boss)
     - Update mob stat generation to support multi-stat scaling

7. **monsters.json**
   - **Location**: `/packages/contracts/monsters.json`
   - **Changes Needed**:
     - Update all HP values to new scaling (8-30 HP range)
     - Add mob type designations
     - Adjust damage values to match new HP scaling
     - Ensure stat distributions support multi-stat scaling

### Data Structures

8. **Structs.sol**
   - **Location**: `/packages/contracts/src/interfaces/Structs.sol`
   - **Changes Needed**:
     - Add AttackType enum
     - Add ItemBonuses struct
     - Add mob type designations to MonsterStats
     - Update weapon/spell data structures for multi-stat scaling

## Implementation Dependencies

### Stat Calculation Flow
1. Character base stats defined in `CharacterSystem.sol`
2. Equipment bonuses added in `EquipmentSystem.sol` using multi-stat scaling
3. Item bonuses applied in `ItemsSystem.sol`
4. Status effects applied in `EffectsSystem.sol`
5. Final combat calculations in `CombatSystem.sol` using AttackType-specific formulas

### Implementation Priority Order
1. **Phase 1**: Update constants and data structures
2. **Phase 2**: Implement universal multi-stat scaling in damage calculations
3. **Phase 3**: Add stat-specific hit/crit chance calculations
4. **Phase 4**: Implement item-based build solutions
5. **Phase 5**: Update HP scaling system
6. **Phase 6**: Test and balance across all levels

## Detailed Phase Implementation Guide

### Phase 1: Update Constants and Data Structures

#### 1.1 Update Constants.sol

**File**: `/packages/contracts/src/constants.sol`

**Add new constants**:
```solidity
// Attack Types
enum AttackType {
    PHYSICAL,  // Swords, axes, clubs
    MAGICAL,   // Spells, staves
    RANGED     // Bows, crossbows, throwing weapons
}

// Universal Multi-Stat Scaling Multipliers
uint256 constant PHYSICAL_STR_MULTIPLIER = 2.0 ether;     // Primary scaling for physical weapons
uint256 constant PHYSICAL_AGI_MULTIPLIER = 0.5 ether;     // Secondary scaling for physical weapons
uint256 constant PHYSICAL_INT_MULTIPLIER = 0.3 ether;     // Tertiary scaling for physical weapons

uint256 constant MAGICAL_INT_MULTIPLIER = 2.0 ether;      // Primary scaling for magical weapons
uint256 constant MAGICAL_STR_MULTIPLIER = 0.4 ether;      // Secondary scaling for magical weapons
uint256 constant MAGICAL_AGI_MULTIPLIER = 0.6 ether;      // Tertiary scaling for magical weapons

uint256 constant RANGED_AGI_MULTIPLIER = 2.0 ether;       // Primary scaling for ranged weapons
uint256 constant RANGED_STR_MULTIPLIER = 0.6 ether;       // Secondary scaling for ranged weapons
uint256 constant RANGED_INT_MULTIPLIER = 0.4 ether;       // Tertiary scaling for ranged weapons

// Small Stat Bonuses
uint256 constant HIT_CHANCE_BASE = 85;                     // 85% base hit chance
uint256 constant CRIT_CHANCE_BASE = 5;                     // 5% base crit chance
uint256 constant HIT_CHANCE_STAT_DIVISOR = 50;             // +1% per 50 stat points
uint256 constant CRIT_CHANCE_STAT_DIVISOR = 100;           // +1% per 100 stat points

// Item Bonuses by Rarity
uint256 constant COMMON_HIT_CHANCE_BONUS = 5;              // +5% hit chance
uint256 constant UNCOMMON_HIT_CHANCE_BONUS = 8;            // +8% hit chance
uint256 constant RARE_HIT_CHANCE_BONUS = 12;               // +12% hit chance
uint256 constant LEGENDARY_HIT_CHANCE_BONUS = 15;          // +15% hit chance

uint256 constant COMMON_CRIT_CHANCE_BONUS = 3;            // +3% crit chance
uint256 constant UNCOMMON_CRIT_CHANCE_BONUS = 5;          // +5% crit chance
uint256 constant RARE_CRIT_CHANCE_BONUS = 8;               // +8% crit chance
uint256 constant LEGENDARY_CRIT_CHANCE_BONUS = 10;        // +10% crit chance

// HP Scaling
int256 constant BASE_HP_LEVEL_1 = 10;                       // Starting HP at level 1
int256 constant HP_PER_LEVEL = 1;                          // +1 HP per level
int256 constant WARRIOR_HP_BONUS_INTERVAL = 3;             // Warriors get bonus HP every 3 levels
int256 constant WARRIOR_HP_BONUS_AMOUNT = 1;               // +1 HP bonus for warriors

// Mob HP Scaling
int256 constant MOB_BASE_HP = 8;                           // Base HP for level 1 mobs
int256 constant MOB_HP_PER_LEVEL = 2;                     // +2 HP per mob level
uint256 constant MOB_TYPE_NORMAL = 0;                     // Normal mob type
uint256 constant MOB_TYPE_ELITE = 1;                      // Elite mob type
uint256 constant MOB_TYPE_BOSS = 2;                       // Boss mob type
uint256 constant ELITE_HP_MULTIPLIER = 15;                 // Elite mobs have 50% more HP (15/10)
uint256 constant BOSS_HP_MULTIPLIER = 20;                  // Boss mobs have 100% more HP (20/10)
```

**Remove old constants**:
```solidity
// REMOVE THESE OLD CONSTANTS:
// uint256 constant ATTACK_MODIFIER = 1.2 ether;
// uint256 constant DEFENSE_MODIFIER = 1.0 ether;
// uint256 constant CRIT_MULTIPLIER = 2;
// int256 constant STARTING_HIT_PROBABILITY = 90;
// uint256 constant DEFENDER_HIT_DAMPENER = 30;
// uint256 constant ATTACKER_HIT_DAMPENER = 95;
```

#### 1.2 Update Structs.sol

**File**: `/packages/contracts/src/interfaces/Structs.sol`

**Add new structs**:
```solidity
// Item bonus structure for build solutions
struct ItemBonuses {
    uint256 hitChanceBonus;    // +5% to +15%
    uint256 critChanceBonus;   // +3% to +10%
    uint256 damageBonus;       // +1 to +5
    uint256 statRequirements; // Required stats to use
    AttackType attackType;     // Which attack type this item affects
}

// Enhanced weapon data structure
struct WeaponData {
    uint256 strengthMultiplier;     // Primary scaling for physical weapons
    uint256 agilityMultiplier;      // Secondary scaling
    uint256 intelligenceMultiplier; // Tertiary scaling
    AttackType attackType;          // Physical, Magical, or Ranged
    ItemBonuses bonuses;           // Item bonuses
}

// Enhanced spell data structure
struct SpellData {
    uint256 intelligenceMultiplier; // Primary scaling for magical weapons
    uint256 strengthMultiplier;     // Secondary scaling
    uint256 agilityMultiplier;      // Tertiary scaling
    AttackType attackType;          // Always Magical
    ItemBonuses bonuses;           // Item bonuses
}

// Enhanced monster stats with type designation
struct MonsterStats {
    int256 strength;
    int256 agility;
    int256 intelligence;
    int256 maxHp;
    int256 currentHp;
    int256 armor;
    uint8 mobType;                 // Normal, Elite, or Boss
    AttackType preferredAttackType; // Preferred attack type for this mob
}
```

#### 1.3 Update mud.config.ts

**File**: `/packages/contracts/mud.config.ts`

**Add new tables**:
```typescript
// Add to tables section
ItemBonuses: {
  schema: {
    hitChanceBonus: "uint256",
    critChanceBonus: "uint256", 
    damageBonus: "uint256",
    statRequirements: "uint256",
    attackType: "uint8"
  }
},

WeaponData: {
  schema: {
    strengthMultiplier: "uint256",
    agilityMultiplier: "uint256",
    intelligenceMultiplier: "uint256", 
    attackType: "uint8",
    bonuses: "bytes32" // Reference to ItemBonuses
  }
},

SpellData: {
  schema: {
    intelligenceMultiplier: "uint256",
    strengthMultiplier: "uint256",
    agilityMultiplier: "uint256",
    attackType: "uint8", 
    bonuses: "bytes32" // Reference to ItemBonuses
  }
}
```

**Phase 1 Guardrails**:
- ✅ All new constants added without breaking existing code
- ✅ New structs defined but not yet used
- ✅ New tables added to mud.config.ts
- ✅ Old constants commented out but not removed yet
- ✅ Compilation successful with no errors

---

### Phase 2: Implement Universal Multi-Stat Scaling

#### 2.1 Update CombatSystem.sol

**File**: `/packages/contracts/src/systems/CombatSystem.sol`

**Add new functions**:
```solidity
// Universal multi-stat damage calculation
function calculateUniversalDamage(
    StatsData memory attackerStats,
    uint256 itemId,
    AttackType attackType
) internal view returns (int256) {
    if (attackType == AttackType.PHYSICAL) {
        return calculatePhysicalDamage(attackerStats, itemId);
    } else if (attackType == AttackType.MAGICAL) {
        return calculateMagicalDamage(attackerStats, itemId);
    } else if (attackType == AttackType.RANGED) {
        return calculateRangedDamage(attackerStats, itemId);
    }
    return 0;
}

function calculatePhysicalDamage(StatsData memory stats, uint256 weaponId) internal view returns (int256) {
    WeaponData memory weapon = WeaponData.get(weaponId);
    
    int256 primaryDamage = stats.strength * int256(weapon.strengthMultiplier) / int256(WAD);
    int256 secondaryBonus = stats.agility * int256(weapon.agilityMultiplier) / int256(WAD);
    int256 tertiaryBonus = stats.intelligence * int256(weapon.intelligenceMultiplier) / int256(WAD);
    
    return primaryDamage + secondaryBonus + tertiaryBonus;
}

function calculateMagicalDamage(StatsData memory stats, uint256 spellId) internal view returns (int256) {
    SpellData memory spell = SpellData.get(spellId);
    
    int256 primaryDamage = stats.intelligence * int256(spell.intelligenceMultiplier) / int256(WAD);
    int256 secondaryBonus = stats.strength * int256(spell.strengthMultiplier) / int256(WAD);
    int256 tertiaryBonus = stats.agility * int256(spell.agilityMultiplier) / int256(WAD);
    
    return primaryDamage + secondaryBonus + tertiaryBonus;
}

function calculateRangedDamage(StatsData memory stats, uint256 weaponId) internal view returns (int256) {
    WeaponData memory weapon = WeaponData.get(weaponId);
    
    int256 primaryDamage = stats.agility * int256(weapon.agilityMultiplier) / int256(WAD);
    int256 secondaryBonus = stats.strength * int256(weapon.strengthMultiplier) / int256(WAD);
    int256 tertiaryBonus = stats.intelligence * int256(weapon.intelligenceMultiplier) / int256(WAD);
    
    return primaryDamage + secondaryBonus + tertiaryBonus;
}
```

**Update existing damage calculation**:
```solidity
// Replace existing _calculateWeaponDamage function
function _calculateWeaponDamage(
    bytes32 attackerEntityId,
    bytes32 defenderEntityId,
    uint256 itemId,
    uint256 attackRoll,
    bool crit
) internal view returns (int256 damage) {
    StatsData memory attackerStats = Stats.get(attackerEntityId);
    WeaponData memory weapon = WeaponData.get(itemId);
    
    // Use universal multi-stat scaling
    damage = calculateUniversalDamage(attackerStats, itemId, weapon.attackType);
    
    // Apply critical hit multiplier
    if (crit) {
        damage = damage * int256(CRIT_MULTIPLIER) / int256(WAD);
    }
    
    // Apply armor reduction
    StatsData memory defenderStats = Stats.get(defenderEntityId);
    if (defenderStats.armor > 0) {
        damage = damage - defenderStats.armor;
        if (damage < 0) damage = 0;
    }
}
```

#### 2.2 Update ItemsSystem.sol

**File**: `/packages/contracts/src/systems/ItemsSystem.sol`

**Add weapon data initialization**:
```solidity
// Initialize weapon data with multi-stat scaling
function initializeWeaponData(uint256 weaponId, AttackType attackType) internal {
    WeaponData memory weaponData;
    weaponData.attackType = attackType;
    
    if (attackType == AttackType.PHYSICAL) {
        weaponData.strengthMultiplier = PHYSICAL_STR_MULTIPLIER;
        weaponData.agilityMultiplier = PHYSICAL_AGI_MULTIPLIER;
        weaponData.intelligenceMultiplier = PHYSICAL_INT_MULTIPLIER;
    } else if (attackType == AttackType.MAGICAL) {
        weaponData.strengthMultiplier = MAGICAL_STR_MULTIPLIER;
        weaponData.agilityMultiplier = MAGICAL_AGI_MULTIPLIER;
        weaponData.intelligenceMultiplier = MAGICAL_INT_MULTIPLIER;
    } else if (attackType == AttackType.RANGED) {
        weaponData.strengthMultiplier = RANGED_STR_MULTIPLIER;
        weaponData.agilityMultiplier = RANGED_AGI_MULTIPLIER;
        weaponData.intelligenceMultiplier = RANGED_INT_MULTIPLIER;
    }
    
    WeaponData.set(weaponId, weaponData);
}
```

**Phase 2 Guardrails**:
- ✅ Universal multi-stat scaling functions implemented
- ✅ Existing damage calculation updated to use new system
- ✅ Weapon data initialization added
- ✅ All weapon types (physical, magical, ranged) supported
- ✅ Compilation successful with no errors
- ✅ Basic damage calculation working with new system

---

### Phase 3: Add Stat-Specific Hit/Crit Chance Calculations

#### 3.1 Update CombatSystem.sol

**File**: `/packages/contracts/src/systems/CombatSystem.sol`

**Add stat-specific hit/crit functions**:
```solidity
// Stat-specific hit chance calculation
function calculateHitChance(StatsData memory stats, AttackType attackType) internal pure returns (int256) {
    int256 baseChance = HIT_CHANCE_BASE;
    
    if (attackType == AttackType.PHYSICAL) {
        return baseChance + (stats.strength / int256(HIT_CHANCE_STAT_DIVISOR));
    } else if (attackType == AttackType.MAGICAL) {
        return baseChance + (stats.intelligence / int256(HIT_CHANCE_STAT_DIVISOR));
    } else if (attackType == AttackType.RANGED) {
        return baseChance + (stats.agility / int256(HIT_CHANCE_STAT_DIVISOR));
    }
    
    return baseChance;
}

// Stat-specific critical hit calculation
function calculateCritChance(StatsData memory stats, AttackType attackType) internal pure returns (int256) {
    int256 baseCrit = CRIT_CHANCE_BASE;
    
    if (attackType == AttackType.PHYSICAL) {
        return baseCrit + (stats.strength / int256(CRIT_CHANCE_STAT_DIVISOR));
    } else if (attackType == AttackType.MAGICAL) {
        return baseCrit + (stats.intelligence / int256(CRIT_CHANCE_STAT_DIVISOR));
    } else if (attackType == AttackType.RANGED) {
        return baseCrit + (stats.agility / int256(CRIT_CHANCE_STAT_DIVISOR));
    }
    
    return baseCrit;
}
```

**Update existing hit calculation**:
```solidity
// Replace existing _calculateToHit function
function _calculateToHit(
    uint256 attackRoll,
    int256 attackModifierBonus,
    int256 critChanceBonus,
    int256 attackerStat,
    int256 defenderStat,
    AttackType attackType
) internal view returns (bool attackLands, bool crit) {
    StatsData memory attackerStats = Stats.get(attackerEntityId);
    
    // Use stat-specific hit chance
    int256 hitChance = calculateHitChance(attackerStats, attackType);
    
    // Apply level difference modifier (simplified)
    int256 levelModifier = (attackerStat - defenderStat) / 10;
    hitChance = hitChance + levelModifier;
    
    // Cap hit chance
    if (hitChance > 98) hitChance = 98;
    if (hitChance < 15) hitChance = 15; // Minimum 15% hit chance
    
    attackLands = (attackRoll % 100) + 1 <= uint256(hitChance);
    
    if (attackLands) {
        // Use stat-specific crit chance
        int256 critChance = calculateCritChance(attackerStats, attackType);
        crit = (attackRoll % 100) + 1 <= uint256(critChance);
    }
}
```

**Phase 3 Guardrails**:
- ✅ Stat-specific hit chance calculation implemented
- ✅ Stat-specific crit chance calculation implemented
- ✅ Existing hit calculation updated to use new system
- ✅ Hit chance capped between 15% and 98%
- ✅ All attack types supported
- ✅ Compilation successful with no errors
- ✅ Hit/crit calculations working with new system

---

### Phase 4: Implement Item-Based Build Solutions

#### 4.1 Update ItemsSystem.sol

**File**: `/packages/contracts/src/systems/ItemsSystem.sol`

**Add item bonus functions**:
```solidity
// Initialize item bonuses based on rarity
function initializeItemBonuses(uint256 itemId, uint8 rarity, AttackType attackType) internal {
    ItemBonuses memory bonuses;
    bonuses.attackType = attackType;
    
    // Set bonuses based on rarity
    if (rarity == 0) { // Common
        bonuses.hitChanceBonus = COMMON_HIT_CHANCE_BONUS;
        bonuses.critChanceBonus = COMMON_CRIT_CHANCE_BONUS;
    } else if (rarity == 1) { // Uncommon
        bonuses.hitChanceBonus = UNCOMMON_HIT_CHANCE_BONUS;
        bonuses.critChanceBonus = UNCOMMON_CRIT_CHANCE_BONUS;
    } else if (rarity == 2) { // Rare
        bonuses.hitChanceBonus = RARE_HIT_CHANCE_BONUS;
        bonuses.critChanceBonus = RARE_CRIT_CHANCE_BONUS;
    } else if (rarity == 3) { // Legendary
        bonuses.hitChanceBonus = LEGENDARY_HIT_CHANCE_BONUS;
        bonuses.critChanceBonus = LEGENDARY_CRIT_CHANCE_BONUS;
    }
    
    ItemBonuses.set(itemId, bonuses);
}

// Get item bonuses for a specific item
function getItemBonuses(uint256 itemId) internal view returns (ItemBonuses memory) {
    return ItemBonuses.get(itemId);
}
```

#### 4.2 Update CombatSystem.sol

**File**: `/packages/contracts/src/systems/CombatSystem.sol`

**Add final hit/crit calculation with item bonuses**:
```solidity
// Final hit chance calculation including item bonuses
function calculateFinalHitChance(
    StatsData memory stats, 
    AttackType attackType, 
    ItemBonuses memory itemBonuses
) internal pure returns (int256) {
    int256 baseChance = calculateHitChance(stats, attackType);
    int256 totalChance = baseChance + int256(itemBonuses.hitChanceBonus);
    return totalChance > 98 ? 98 : totalChance;
}

// Final crit chance calculation including item bonuses
function calculateFinalCritChance(
    StatsData memory stats, 
    AttackType attackType, 
    ItemBonuses memory itemBonuses
) internal pure returns (int256) {
    int256 baseCrit = calculateCritChance(stats, attackType);
    return baseCrit + int256(itemBonuses.critChanceBonus);
}
```

**Update combat functions to use item bonuses**:
```solidity
// Update _calculateToHit to include item bonuses
function _calculateToHitWithItems(
    uint256 attackRoll,
    bytes32 attackerEntityId,
    uint256 itemId,
    AttackType attackType
) internal view returns (bool attackLands, bool crit) {
    StatsData memory attackerStats = Stats.get(attackerEntityId);
    ItemBonuses memory itemBonuses = ItemBonuses.get(itemId);
    
    // Calculate final hit chance with item bonuses
    int256 finalHitChance = calculateFinalHitChance(attackerStats, attackType, itemBonuses);
    
    attackLands = (attackRoll % 100) + 1 <= uint256(finalHitChance);
    
    if (attackLands) {
        // Calculate final crit chance with item bonuses
        int256 finalCritChance = calculateFinalCritChance(attackerStats, attackType, itemBonuses);
        crit = (attackRoll % 100) + 1 <= uint256(finalCritChance);
    }
}
```

**Phase 4 Guardrails**:
- ✅ Item bonus initialization functions implemented
- ✅ Final hit/crit calculation with item bonuses implemented
- ✅ Combat functions updated to use item bonuses
- ✅ All rarity levels supported (Common, Uncommon, Rare, Legendary)
- ✅ Compilation successful with no errors
- ✅ Item bonuses working in combat calculations

---

### Phase 5: Update HP Scaling System

#### 5.1 Update CharacterSystem.sol

**File**: `/packages/contracts/src/systems/CharacterSystem.sol`

**Update HP calculation**:
```solidity
// New HP calculation function
function calculateCharacterHP(uint256 level, Classes characterClass) internal pure returns (int256) {
    int256 baseHP = BASE_HP_LEVEL_1; // 10 HP at level 1
    int256 levelHP = int256(level) * HP_PER_LEVEL; // +1 HP per level
    
    // Warriors get bonus HP every 3 levels
    if (characterClass == Classes.Warrior && level % WARRIOR_HP_BONUS_INTERVAL == 0) {
        levelHP += WARRIOR_HP_BONUS_AMOUNT;
    }
    
    return baseHP + levelHP;
}

// Update levelCharacter function
function levelCharacter(bytes32 characterId) internal {
    StatsData memory stats = Stats.get(characterId);
    
    // Update HP using new calculation
    stats.maxHp = calculateCharacterHP(stats.level, stats.class);
    stats.currentHp = stats.maxHp; // Full heal on level up
    
    Stats.set(characterId, stats);
}
```

#### 5.2 Update MobSystem.sol

**File**: `/packages/contracts/src/systems/MobSystem.sol`

**Update mob HP calculation**:
```solidity
// New mob HP calculation function
function calculateMobHP(uint256 mobLevel, uint8 mobType) internal pure returns (int256) {
    int256 baseHP = MOB_BASE_HP + int256(mobLevel) * MOB_HP_PER_LEVEL;
    
    if (mobType == MOB_TYPE_ELITE) {
        baseHP = baseHP * int256(ELITE_HP_MULTIPLIER) / 10;
    } else if (mobType == MOB_TYPE_BOSS) {
        baseHP = baseHP * int256(BOSS_HP_MULTIPLIER) / 10;
    }
    
    return baseHP;
}

// Update createMob function
function createMob(bytes32 mobId, uint256 level, uint8 mobType) internal {
    MonsterStats memory mobStats;
    
    // Set stats based on level
    mobStats.strength = int256(5 + level * 2);
    mobStats.agility = int256(5 + level * 2);
    mobStats.intelligence = int256(5 + level * 2);
    
    // Set HP using new calculation
    mobStats.maxHp = calculateMobHP(level, mobType);
    mobStats.currentHp = mobStats.maxHp;
    
    // Set armor
    mobStats.armor = int256(level);
    
    // Set mob type and preferred attack
    mobStats.mobType = mobType;
    mobStats.preferredAttackType = AttackType.PHYSICAL; // Default to physical
    
    MonsterStats.set(mobId, mobStats);
}
```

#### 5.3 Update monsters.json

**File**: `/packages/contracts/monsters.json`

**Update all HP values**:
```json
{
  "giant_rat": {
    "level": 1,
    "hp": 10,
    "damage": "1-2",
    "mobType": 0,
    "preferredAttackType": 0
  },
  "dire_wolf": {
    "level": 5,
    "hp": 18,
    "damage": "2-3", 
    "mobType": 0,
    "preferredAttackType": 0
  },
  "shadow_dragon": {
    "level": 10,
    "hp": 28,
    "damage": "3-5",
    "mobType": 2,
    "preferredAttackType": 1
  }
}
```

**Phase 5 Guardrails**:
- ✅ Character HP calculation updated to 10 HP baseline
- ✅ Mob HP calculation updated to new scaling
- ✅ monsters.json updated with new HP values
- ✅ All mob types (normal, elite, boss) supported
- ✅ Compilation successful with no errors
- ✅ HP scaling working correctly in game

---

### Phase 6: Test and Balance Across All Levels

#### 6.1 Create Test Scenarios

**File**: `/packages/contracts/test/CombatBalance.t.sol`

**Add comprehensive test suite**:
```solidity
contract CombatBalanceTest is Test {
    function testBuildDiversity() public {
        // Test Slow Heavy HP Mage
        StatsData memory mageStats;
        mageStats.strength = 15;
        mageStats.agility = 15;
        mageStats.intelligence = 50;
        mageStats.maxHp = 25;
        
        // Test hit chance with items
        ItemBonuses memory mageItems;
        mageItems.hitChanceBonus = 33; // Total from multiple items
        mageItems.critChanceBonus = 23;
        
        int256 mageHitChance = calculateFinalHitChance(mageStats, AttackType.MAGICAL, mageItems);
        assertEq(mageHitChance, 98); // Should be capped at 98%
        
        // Test Pure STR Warrior
        StatsData memory warriorStats;
        warriorStats.strength = 50;
        warriorStats.agility = 15;
        warriorStats.intelligence = 15;
        warriorStats.maxHp = 25;
        
        ItemBonuses memory warriorItems;
        warriorItems.hitChanceBonus = 33;
        warriorItems.critChanceBonus = 23;
        
        int256 warriorHitChance = calculateFinalHitChance(warriorStats, AttackType.PHYSICAL, warriorItems);
        assertEq(warriorHitChance, 98); // Should be capped at 98%
    }
    
    function testCombatTriangle() public {
        // Test STR > AGI
        StatsData memory strStats;
        strStats.strength = 50;
        strStats.agility = 15;
        
        StatsData memory agiStats;
        agiStats.strength = 15;
        agiStats.agility = 50;
        
        int256 strDamage = calculatePhysicalDamage(strStats, 1);
        int256 agiDamage = calculateRangedDamage(agiStats, 1);
        
        // STR should have advantage in physical combat
        assertGt(strDamage, agiDamage);
    }
    
    function testHPScaling() public {
        // Test level 1 character
        int256 level1HP = calculateCharacterHP(1, Classes.Warrior);
        assertEq(level1HP, 10);
        
        // Test level 10 character
        int256 level10HP = calculateCharacterHP(10, Classes.Warrior);
        assertEq(level10HP, 25); // 10 + 10*1 + 3 warrior bonuses
        
        // Test mob HP scaling
        int256 level1MobHP = calculateMobHP(1, MOB_TYPE_NORMAL);
        assertEq(level1MobHP, 10); // 8 + 1*2
        
        int256 level10MobHP = calculateMobHP(10, MOB_TYPE_NORMAL);
        assertEq(level10MobHP, 28); // 8 + 10*2
    }
}
```

#### 6.2 Balance Validation

**Create balance validation script**:
```solidity
// Balance validation functions
function validateBuildBalance() internal view {
    // Ensure all builds can achieve 98% hit chance with items
    // Ensure all builds can achieve 28% crit chance with items
    // Ensure damage differences are reasonable (not more than 2x)
    // Ensure HP scaling is appropriate for combat length
}

function validateCombatTriangle() internal view {
    // Ensure STR > AGI in physical combat
    // Ensure AGI > INT in ranged combat  
    // Ensure INT > STR in magical combat
    // Ensure balanced builds are competitive
}
```

**Phase 6 Guardrails**:
- ✅ Comprehensive test suite created
- ✅ Build diversity tests passing
- ✅ Combat triangle tests passing
- ✅ HP scaling tests passing
- ✅ Balance validation functions working
- ✅ All tests passing with no errors
- ✅ System ready for production

## Implementation Checklist

### Phase 1: Constants and Data Structures
- [ ] Add AttackType enum to constants.sol
- [ ] Add multi-stat scaling multipliers to constants.sol
- [ ] Add item bonus constants to constants.sol
- [ ] Add HP scaling constants to constants.sol
- [ ] Add ItemBonuses struct to Structs.sol
- [ ] Add WeaponData and SpellData structs to Structs.sol
- [ ] Add new tables to mud.config.ts
- [ ] Comment out old constants (don't remove yet)
- [ ] Verify compilation successful

### Phase 2: Universal Multi-Stat Scaling
- [ ] Add calculateUniversalDamage function to CombatSystem.sol
- [ ] Add calculatePhysicalDamage function
- [ ] Add calculateMagicalDamage function
- [ ] Add calculateRangedDamage function
- [ ] Update _calculateWeaponDamage to use new system
- [ ] Add initializeWeaponData function to ItemsSystem.sol
- [ ] Verify damage calculations working correctly

### Phase 3: Stat-Specific Hit/Crit Chance
- [ ] Add calculateHitChance function to CombatSystem.sol
- [ ] Add calculateCritChance function to CombatSystem.sol
- [ ] Update _calculateToHit to use new system
- [ ] Add hit chance caps (15% minimum, 98% maximum)
- [ ] Verify hit/crit calculations working correctly

### Phase 4: Item-Based Build Solutions
- [ ] Add initializeItemBonuses function to ItemsSystem.sol
- [ ] Add calculateFinalHitChance function to CombatSystem.sol
- [ ] Add calculateFinalCritChance function to CombatSystem.sol
- [ ] Update combat functions to use item bonuses
- [ ] Verify item bonuses working in combat

### Phase 5: HP Scaling System
- [ ] Add calculateCharacterHP function to CharacterSystem.sol
- [ ] Update levelCharacter function to use new HP calculation
- [ ] Add calculateMobHP function to MobSystem.sol
- [ ] Update createMob function to use new HP calculation
- [ ] Update monsters.json with new HP values
- [ ] Verify HP scaling working correctly

### Phase 6: Testing and Balance
- [ ] Create comprehensive test suite
- [ ] Test build diversity scenarios
- [ ] Test combat triangle mechanics
- [ ] Test HP scaling across levels
- [ ] Validate balance metrics
- [ ] All tests passing
- [ ] System ready for production

This detailed implementation guide provides clear guardrails for each phase, ensuring minimal changes while maintaining progress toward the balanced combat system.

## Testing Requirements

### Build Diversity Testing
- Test Slow Heavy HP Mage (High INT, Low AGI) with hit chance items
- Test Pure STR Warrior (High STR, Low AGI) with hit chance items
- Test Pure AGI Rogue (High AGI, Low STR/INT) with hit chance items
- Test Balanced Build (Moderate All Stats) with flexible item choices

### Combat Triangle Testing
- Verify STR > AGI advantages (physical damage, armor penetration)
- Verify AGI > INT advantages (speed, precision, interruption)
- Verify INT > STR advantages (magical damage, status effects)

### Level Scaling Testing
- Test combat balance at levels 1, 5, and 10
- Verify HP scaling creates appropriate combat length
- Ensure item bonuses make builds viable at all levels

### Item Integration Testing
- Test hit chance items with different builds
- Test crit chance items with different builds
- Verify item bonuses don't create overpowered combinations

## Expected Outcomes

### Build Viability
- **Slow Heavy HP Mage**: 86% base hit chance + 33% items = 98% hit chance
- **Pure STR Warrior**: 86% base hit chance + 33% items = 98% hit chance
- **Pure AGI Rogue**: 86% base hit chance + 33% items = 98% hit chance
- **Balanced Build**: Flexible item choices for specialization

### Combat Balance
- 3-5 equal-level mob kills before healing
- 2-3 +1 level mob kills before healing
- 1-2 +2 level mob kills before healing
- Meaningful tactical choices beyond stat stacking

### Long-term Sustainability
- System supports expansion to level 60
- Items can be adjusted independently for balance
- Multiple viable build strategies
- Rock-paper-scissors triangle maintains relevance

This implementation guide ensures that Ultimate Dominion's combat system will be balanced, diverse, and sustainable for long-term gameplay while maintaining the tactical depth that makes combat engaging.