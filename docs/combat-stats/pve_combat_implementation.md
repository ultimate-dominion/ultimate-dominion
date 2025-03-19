# PvE Combat Implementation Guide

## Overview

This document provides specific implementation instructions for balancing the PvE combat system in Ultimate Dominion. It is based on the analysis found in `pve_combat_analysis.md` and focuses on actionable steps to achieve the desired combat balance.

## Files Requiring Modification

### Core Combat Mechanics

1. **CombatSystem.sol**
   - **Location**: `/packages/contracts/src/systems/CombatSystem.sol`
   - **Changes Needed**:
     - Adjust hit probability calculation in `_calculateHit()` function to scale better with level differences
     - Modify critical hit mechanics in `_calculateCrit()` to maintain 5% base chance but scale with agility
     - Update damage calculation in `_calculateDamage()` to incorporate diminishing returns on stat advantages
     - Consider adding "glancing blow" mechanics for fights against higher-level opponents

2. **Constants.sol**
   - **Location**: `/packages/contracts/src/constants.sol`
   - **Changes Needed**:
     - Decrease `ATTACK_MODIFIER` from 1.0 to 0.85-0.9 to reduce overall damage
     - Adjust `CRIT_MULTIPLIER` from 2.0 to 1.75 to make critical hits impactful but not overwhelming
     - Add a `LEVEL_ADVANTAGE_MODIFIER` constant (0.25 per level) to scale combat effectiveness with level
     - Add an `ARMOR_EFFECTIVENESS` constant (0.1) to make armor more meaningful at higher levels

### Mob Scaling and Stats

3. **MobSystem.sol**
   - **Location**: `/packages/contracts/src/systems/MobSystem.sol`
   - **Changes Needed**:
     - Implement more sophisticated mob stats generation in `createMob()` that scales appropriately with level
     - Add mob type variations (normal, elite, boss) with different stat modifiers
     - Add armor values to mobs that increase with level

4. **monsters.json**
   - **Location**: `/packages/contracts/src/data/monsters.json`
   - **Changes Needed**:
     - Reduce base damage values by approximately 15-20%
     - Add armor values to all mob types
     - Adjust HP scaling to ensure proper combat pacing at all levels
     - Create more varied stat distributions between different mob types

### Character Systems

5. **CharacterSystem.sol**
   - **Location**: `/packages/contracts/src/systems/CharacterSystem.sol`
   - **Changes Needed**:
     - Review and adjust the level-up function to ensure balanced stat progression
     - Consider implementing diminishing returns on stats above certain thresholds
     - Add recovery mechanics that scale appropriately with level

6. **PostDeploy.s.sol**
   - **Location**: `/packages/contracts/script/PostDeploy.s.sol`
   - **Changes Needed**:
     - Update mob creation logic in `_createMonsters()` to implement new balance parameters
     - Potentially adjust experience point values in `setLevels()` function

### Status Effects and Buffs

7. **EffectsSystem.sol**
   - **Location**: `/packages/contracts/src/systems/EffectsSystem.sol`
   - **Changes Needed**:
     - Review `calculateAllStatusEffects()` to ensure status effect stacking is properly balanced
     - Evaluate how world effects interact with combat bonuses in `applyWorldEffects()`
     - Consider capping the maximum effect of stacked buffs/debuffs to prevent extreme stats
     - Ensure combat-relevant status effects are properly scaled by level

8. **PvESystem.sol**
   - **Location**: `/packages/contracts/src/systems/PvESystem.sol`
   - **Changes Needed**:
     - Evaluate `_executeMobActionTurn()` to ensure mob AI properly uses abilities based on difficulty
     - Consider implementing different mob behavior patterns based on level and type
     - Add cooldowns for powerful mob abilities at higher levels

### Equipment and Item Effects

9. **ItemsSystem.sol**
   - **Location**: `/packages/contracts/src/systems/ItemsSystem.sol`
   - **Changes Needed**:
     - Review item stat progression across levels to ensure appropriate power scaling
     - Balance weapon and armor stats to align with desired combat pacing
     - Add tier-appropriate effects for higher-level items

10. **Structs.sol**
    - **Location**: `/packages/contracts/src/interfaces/Structs.sol`
    - **Changes Needed**:
      - Consider adding additional fields to `MonsterStats` to support more advanced mob behaviors
      - Potentially add mob type designations (trash, elite, boss) to the data structure
      - Ensure `AdjustedCombatStats` properly addresses all stat scaling needs

## Implementation Dependencies

The implementation of these changes requires careful attention to the following dependencies:

1. **Stat Calculation Flow**:
   - Character base stats are defined in `CharacterSystem.sol`
   - Equipment bonuses are added in `EquipmentSystem.calculateEquipmentBonuses()`
   - Status effects are applied in `EffectsSystem.calculateAllStatusEffects()`
   - Final combat calculations occur in `CombatSystem.sol`

2. **Stat Scaling Priority**:
   1. Modify the base constants in `constants.sol` first
   2. Update the mob stats in `monsters.json`
   3. Adjust the stat scaling and damage calculation in `CombatSystem.sol`
   4. Fine-tune the equipment and effect bonuses

3. **Testing Considerations**:
   - Create test scenarios for different player levels (1, 5, 10)
   - Test specialized vs. balanced character builds
   - Validate mob difficulty across the level spectrum
   - Ensure critical hits remain exciting but not frustrating

## Implementation Priorities

1. **First Wave Changes (Immediate Impact)**
   - Adjust combat constants in `constants.sol`
   - Reduce mob damage values in `monsters.json`
   - Modify critical hit calculation in `CombatSystem.sol`

2. **Second Wave Changes (Systemic Improvements)**
   - Implement diminishing returns on stat advantages
   - Add level difference modifiers to hit probability
   - Enhance mob type variation and stats in `MobSystem.sol`

3. **Third Wave Changes (Fine-Tuning)**
   - Balance equipment bonuses
   - Tune status effect interactions and stacking
   - Tune combat feedback and recovery mechanisms

This implementation plan ensures a systematic approach to balancing PvE combat, focusing first on the most impactful changes before moving to more nuanced adjustments.
