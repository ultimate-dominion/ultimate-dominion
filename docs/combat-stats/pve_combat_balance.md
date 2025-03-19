# PvE Combat Balance Context Document

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

## Current State Analysis

The current combat system diverges from these goals in several ways:

### Mob Encounter Sustainability

**Current**:
- Due to high attacker advantage (ATTACK_MODIFIER = 1.2), mobs deal disproportionate damage
- Critical hit frequency (5%) combined with high multiplier (2×) creates damage spikes
- Linear stat scaling means level differences heavily impact outcomes
- Players likely need to heal after fewer mob encounters than desired

**Target**:
- A balanced player at level X should defeat 3-5 level X mobs before needing healing
- Same player should defeat 2-3 level X+1 mobs before needing healing
- Same player should defeat 1-2 level X+2 mobs before needing healing

### Critical Hit System

**Current**:
- ~5% critical hit chance regardless of stats
- Always uses maximum weapon damage then applies 2× multiplier
- No defense against critical hits
- Creates high damage variance and potential "one-shot" scenarios

**Target**:
- Base critical hit chance of ~5% (1/20)
- More moderate damage multiplier to maintain excitement without creating frustration
- Potential for minor stat-based scaling of critical chance
- Some form of critical hit mitigation for defensive builds

### Mob Damage Output

**Current**:
- Mobs receive the same ATTACK_MODIFIER (1.2×) as players
- No adjustments for "trash" vs "elite" mob types
- Damage output likely too high for sustained hunting

**Target**:
- Regular "trash" mobs should deal moderate damage allowing for multiple encounters
- Elite or special mobs can deal higher damage as a challenge
- Mob damage should be balanced against average player HP at the corresponding level

### Player Recovery

**Current**:
- Limited in-combat healing options
- Likely requires frequent returns to rest/heal areas
- Disruptive to gameplay flow

**Target**:
- Balance mob damage to allow multiple encounters without healing
- Consider mild passive recovery or consumable effectiveness
- Make healing a strategic resource rather than a constant necessity

## Proposed PvE-Specific Changes

### 1. PvE-Specific Constants

```solidity
// Current combat constants
uint256 constant DEFENSE_MODIFIER = 1 ether;
uint256 constant ATTACK_MODIFIER = 1.2 ether;
uint256 constant CRIT_MULTIPLIER = 2;

// Proposed PvE-specific constants
uint256 constant PVE_PLAYER_ATTACK_MODIFIER = 1.2 ether;   // Maintain player damage
uint256 constant PVE_MOB_ATTACK_MODIFIER = 1.0 ether;      // Reduce mob damage
uint256 constant PVE_PLAYER_DEFENSE_MODIFIER = 1.1 ether;  // Improve player defense
uint256 constant PVE_MOB_DEFENSE_MODIFIER = 1.0 ether;     // Standard mob defense
uint256 constant PVE_CRIT_MULTIPLIER = 1.75;               // Reduce spike damage
```

Implementing entity-type specific modifiers would require function changes:

```solidity
// Pseudocode for applying entity-specific modifiers
function _calculatePhysicalDamage(
    bytes32 attackerEntityId,
    bytes32 defenderEntityId,
    /* other params */
) internal view returns (int256 damage) {
    // ... existing code ...
    
    uint256 attackModifier;
    uint256 defenseModifier;
    
    // Check if attacker is player or mob
    if (isPlayer(attackerEntityId)) {
        attackModifier = PVE_PLAYER_ATTACK_MODIFIER;
    } else {
        attackModifier = PVE_MOB_ATTACK_MODIFIER;
    }
    
    // Check if defender is player or mob
    if (isPlayer(defenderEntityId)) {
        defenseModifier = PVE_PLAYER_DEFENSE_MODIFIER;
    } else {
        defenseModifier = PVE_MOB_DEFENSE_MODIFIER;
    }
    
    // Apply appropriate modifiers
    // ... rest of damage calculation ...
}
```

### 2. Mob Damage Output Adjustments

To achieve the goal of multiple mob encounters before healing:

```solidity
// Pseudocode for mob damage scaling based on mob type
function getMobDamageMultiplier(bytes32 mobEntityId) internal view returns (uint256) {
    uint8 mobType = MobType.get(mobEntityId);
    
    if (mobType == MOB_TYPE_NORMAL) {
        return NORMAL_MOB_DAMAGE_MULTIPLIER; // e.g., 0.85 ether
    } else if (mobType == MOB_TYPE_ELITE) {
        return ELITE_MOB_DAMAGE_MULTIPLIER;  // e.g., 1.1 ether
    } else if (mobType == MOB_TYPE_BOSS) {
        return BOSS_DAMAGE_MULTIPLIER;       // e.g., 1.3 ether
    }
    
    return WAD; // Default 1.0
}
```

### 3. Critical Hit Refinements for PvE

```solidity
// Current critical hit implementation
crit = ((int256(attackRoll % 100) - critChanceBonus) + 1) < 5;

// Proposed PvE critical implementation
function _calculateCritical(
    bytes32 attackerEntityId,
    bytes32 defenderEntityId,
    uint256 attackRoll,
    int256 critChanceBonus
) internal view returns (bool crit) {
    int256 baseCritChance = 5; // 5% base (1/20)
    
    // Small bonus based on agility, capped
    int256 agilityBonus = 0;
    if (isPlayer(attackerEntityId)) {
        int256 agility = Stats.getAgility(attackerEntityId);
        agilityBonus = Math.min(MAX_AGILITY_CRIT_BONUS, agility / AGILITY_CRIT_DIVISOR);
    }
    
    int256 finalCritChance = baseCritChance + agilityBonus + critChanceBonus;
    finalCritChance = Math.min(MAX_CRIT_CHANCE, finalCritChance); // Cap at reasonable maximum
    
    crit = ((int256(attackRoll % 100)) + 1) <= finalCritChance;
}
```

### 4. Progressive Stat Scaling for Level Differences

To make level differences matter without creating impossible encounters:

```solidity
// Current approach (simplified)
int256 attackMultiplier = int256(ATTACK_MODIFIER) * (attackerStats.strength - defenderStats.strength);

// Proposed approach with level-aware scaling
function _calculateLevelAwareStatImpact(
    bytes32 attackerEntityId,
    bytes32 defenderEntityId,
    int256 attackerStat,
    int256 defenderStat
) internal view returns (int256 statMultiplier) {
    // Get levels
    uint256 attackerLevel = getEntityLevel(attackerEntityId);
    uint256 defenderLevel = getEntityLevel(defenderEntityId);
    
    // Calculate raw stat difference
    int256 statDifference = attackerStat - defenderStat;
    
    // Apply level-based dampening for mobs
    if (!isPlayer(attackerEntityId) && isPlayer(defenderEntityId)) {
        // Mob attacking player - reduce impact of stat difference if mob is higher level
        if (defenderLevel < attackerLevel) {
            uint256 levelDiff = attackerLevel - defenderLevel;
            statDifference = statDifference * int256(WAD - (levelDiff * LEVEL_DAMPENER)) / int256(WAD);
        }
    }
    
    // Apply normal scaling with caps
    if (statDifference > 0) {
        statDifference = Math.min(statDifference, MAX_POSITIVE_STAT_DIFF);
    } else {
        statDifference = Math.max(statDifference, MAX_NEGATIVE_STAT_DIFF);
    }
    
    return statDifference;
}
```

### 5. Player Survival Enhancements

To ensure players can survive multiple mob encounters:

```solidity
// Consider adding these features
uint256 constant COMBAT_HEALTH_REGEN_DELAY = 10; // Seconds
uint256 constant OUT_OF_COMBAT_REGEN_RATE = 5;   // % of max HP per tick
uint256 constant IN_COMBAT_REGEN_RATE = 1;       // % of max HP per tick

// Health regeneration function
function _updateHealthRegeneration(bytes32 entityId) internal {
    if (!isPlayer(entityId)) return; // Only applies to players
    
    uint256 lastCombatTime = getLastCombatTime(entityId);
    uint256 currentTime = block.timestamp;
    
    StatsData memory stats = Stats.get(entityId);
    
    // Determine regeneration rate
    uint256 regenRate;
    if (currentTime - lastCombatTime > COMBAT_HEALTH_REGEN_DELAY) {
        regenRate = OUT_OF_COMBAT_REGEN_RATE;
    } else {
        regenRate = IN_COMBAT_REGEN_RATE;
    }
    
    // Calculate and apply regeneration
    int256 regenAmount = (stats.maxHp * int256(regenRate)) / 100;
    stats.currentHp = Math.min(stats.maxHp, stats.currentHp + regenAmount);
    
    // Update stats
    Stats.set(entityId, stats);
}
```

## Stat Progression and Mob Scaling Analysis

### Player Stat Progression

In Ultimate Dominion, as players progress from level 1 to 10, their power increases through:

1. **Ability Points**: From the constants, players receive `ABILITY_POINTS_PER_LEVEL = 2` points per level. By level 10, players have gained approximately 18-20 additional ability points to distribute (considering starting points).

2. **Specialization vs. Balance**: Players can choose to:
   - **Specialize**: Put most/all points into a single stat (reaching ~+20 in one stat by level 10)
   - **Dual-focus**: Split points between two stats (~+10 in two stats)
   - **Balance**: Distribute points evenly (~+6-7 in all three stats)

3. **Item Scaling**: Equipment provides substantial stat bonuses that multiply a player's effectiveness:
   - Low-level items: +1-3 to relevant stats
   - Mid-level items: +3-5 to relevant stats
   - High-level items: +5-10 to relevant stats
   - By level 10 with appropriate gear, a specialized player might have +25-30 in their primary stat

### Combat Impact of Stat Specialization

#### Strength Specialization
- **Level 1**: Minor advantage in physical damage (~10-15% more than balanced build)
- **Level 5**: Significant advantage (~30-40% more physical damage)
- **Level 10**: Massive advantage (~60-80% more physical damage)
- **Effect on Combat**: Can overwhelm same-level mobs quickly but remains vulnerable

#### Agility Specialization
- **Level 1**: Slight advantage in hit/evasion (~5-8% better than balanced)
- **Level 5**: Moderate advantage (~15-20% better hit/evasion)
- **Level 10**: Substantial advantage (~30-40% better hit/evasion)
- **Effect on Combat**: More consistent hits, better avoidance, moderate damage

#### Intelligence Specialization
- **Level 1**: Minor advantage in magical damage/effects (~10-15% more than balanced)
- **Level 5**: Significant advantage (~30-40% more magical damage)
- **Level 10**: Massive advantage (~60-80% more magical damage/healing)
- **Effect on Combat**: Strong magical damage or healing, but potentially fragile

### Current Mob Scaling Issues

With the current linear stat impact system, the combat balance shifts dramatically through levels:

1. **Early Game (Levels 1-3)**:
   - Even with specialization, player advantages are modest
   - Mobs are appropriately challenging
   - The 3-5 mob kill goal is potentially achievable

2. **Mid Game (Levels 4-7)**:
   - Specialized players begin to significantly outperform balanced builds
   - Stat advantages create large combat swings
   - Mobs become either too easy (for specialized builds) or remain challenging (for balanced builds)

3. **Late Game (Levels 8-10)**:
   - Specialized players with appropriate gear can potentially one-shot same-level mobs
   - The gap between specialized and balanced builds becomes extreme
   - Mobs cannot be properly balanced to challenge specialists without overwhelming balanced characters

### Recommended Mob Scaling Approach

To maintain the desired 3-5 mob sustainability target throughout all levels:

#### 1. Percentage-Based Stat Scaling
Instead of direct stat differences creating linear advantages, implement percentage-based scaling:

```solidity
// Example of percentage-based scaling
function calculateStatImpact(int256 attackerStat, int256 defenderStat) internal pure returns (int256) {
    // Calculate percentage advantage (each +10 provides ~10% advantage)
    int256 statDifference = attackerStat - defenderStat;
    int256 percentageAdvantage = (statDifference * 100) / 100; // 1% per point difference
    
    // Apply diminishing returns
    if (percentageAdvantage > 0) {
        // Positive advantage gets diminishing returns
        percentageAdvantage = 100 * (1 - (1 / (1 + percentageAdvantage/100)));
    } else {
        // Negative advantage (disadvantage) also gets diminishing returns
        percentageAdvantage = -100 * (1 - (1 / (1 + Math.abs(percentageAdvantage)/100)));
    }
    
    return percentageAdvantage;
}
```

#### 2. Mob Stat Formulas
Mobs should be designed with appropriate stats for their level using a formula that:

```solidity
// Example formula for mob stats by level
function calculateMobStats(uint256 mobLevel, uint8 mobType) internal pure returns (StatsData memory) {
    StatsData memory stats;
    
    // Base stats increase with level
    int256 baseStatValue = 5 + (mobLevel * 2); // +2 per level
    
    // Different mob types have different stat distributions
    if (mobType == MOB_TYPE_FIGHTER) {
        stats.strength = baseStatValue + 2;
        stats.agility = baseStatValue;
        stats.intelligence = baseStatValue - 2;
    } else if (mobType == MOB_TYPE_ROGUE) {
        stats.strength = baseStatValue - 1;
        stats.agility = baseStatValue + 3;
        stats.intelligence = baseStatValue - 1;
    } else if (mobType == MOB_TYPE_MAGE) {
        stats.strength = baseStatValue - 2;
        stats.agility = baseStatValue - 1;
        stats.intelligence = baseStatValue + 3;
    } else {
        // Balanced mob
        stats.strength = baseStatValue;
        stats.agility = baseStatValue;
        stats.intelligence = baseStatValue;
    }
    
    // HP scales with level and mob type
    stats.maxHp = 50 + (mobLevel * 10); // +10 HP per level
    if (mobType == MOB_TYPE_ELITE) {
        stats.maxHp = stats.maxHp * 15 / 10; // Elite mobs have 50% more HP
    }
    
    stats.currentHp = stats.maxHp;
    
    // Armor increases with level
    stats.armor = 0 + mobLevel; // +1 armor per level
    
    return stats;
}
```

#### 3. Item Power Consideration
When balancing mobs, account for expected player gear at each level:

```solidity
// Expected average player stat with gear by level
function getExpectedPlayerStat(uint256 playerLevel) internal pure returns (int256) {
    // Starting stat + points from leveling + expected gear bonus
    int256 startingStat = 5;
    int256 levelingBonus = playerLevel * 1; // Assume 1 point per level in primary stat
    int256 gearBonus = (playerLevel * 5) / 10; // +0.5 per level from gear
    
    return startingStat + levelingBonus + gearBonus;
}
```

#### 4. Level-Based Difficulty Curve
Implement a proper difficulty curve for same-level, +1 level, and +2 level mobs:

- **Same Level Mobs**: Should have ~80% of a balanced player's stats
- **+1 Level Mobs**: Should have ~95% of a balanced player's stats
- **+2 Level Mobs**: Should have ~110% of a balanced player's stats

This naturally creates the desired challenge progression without making higher-level mobs impossible.

### Progressive Balancing Through the Level Range

#### Early Game (Levels 1-3):
- Mobs should have stats slightly below players
- Critical hits should be rare but impactful
- Equipment differences are minimal
- Focus on learning game mechanics

#### Mid Game (Levels 4-7):
- Introduce more mob variety with specialized stats
- Begin to implement diminishing returns on stat differences
- Account for significant equipment bonuses
- Create meaningful choices between specialized and balanced builds

#### Late Game (Levels 8-10):
- Mobs gain moderate resistances to prevent one-shot kills
- Apply strong diminishing returns on extreme stat differences
- Balance around expected gear progression
- Ensure specialized builds remain effective without becoming overpowered

### Example: Level 10 Player vs. Level 10 Mob

#### Specialized Player (Strength Focus)
- **Base Strength**: ~25-30 (including gear)
- **Other Stats**: ~10-15
- **Equipment**: Significant bonuses to primary stat and damage

#### Level 10 Balanced Mob
- **All Stats**: ~25 (lower than player's specialized stat, higher than secondary stats)
- **HP**: ~150 (enough to survive 3-4 hits from specialized player)
- **Armor**: ~10 (provides meaningful but not excessive protection)

#### Combat Outcome
- Player should defeat mob in 3-4 hits
- Mob should defeat player in 5-6 hits
- Critical hits occur ~1 in 20 attacks, reducing time-to-kill by ~20%
- Player should defeat 3-5 such mobs before needing to heal

This balance ensures that specialized players feel powerful against same-level mobs while still facing appropriate challenge, and can adjust to harder mobs with reasonable success.

## Implementation Priority for PvE Balance

1. **Critical Hit Adjustment**
   - Ensure critical hits remain at ~5% chance (1/20)
   - Reduce CRIT_MULTIPLIER from 2.0 to 1.75
   - Implement small agility-based scaling if desired

2. **Mob Damage Reduction**
   - Create separate attack modifiers for mobs vs players
   - Reduce PVE_MOB_ATTACK_MODIFIER to 1.0 (from 1.2)
   - Consider mob-type specific damage multipliers

3. **Level-Based Scaling**
   - Implement level-aware stat impact calculations
   - Reduce impact of high-level mobs on lower-level players
   - Maintain challenge without creating impossible encounters

4. **Player Survivability**
   - Consider mild health regeneration mechanics
   - Balance mob damage output against player HP at corresponding levels
   - Ensure consumables provide appropriate healing relative to mob damage

5. **Extended Combat Testing**
   - Validate changes against player progression
   - Test mob encounters at varying level differences
   - Ensure 3-5 equal-level mob kills is achievable before healing

## Expected Outcomes

With these PvE-focused changes, we anticipate:

1. **Improved Combat Flow**
   - Players can hunt multiple mobs before returning to towns
   - More efficient leveling and exploration
   - Less downtime between combat encounters

2. **Appropriate Challenge Scaling**
   - Higher-level mobs remain challenging but not impossible
   - Players feel progression as they level up and gear up
   - Level differences matter without creating frustration

3. **More Strategic Combat**
   - Critical hits remain exciting but don't dominate outcomes
   - Players can make meaningful tactical choices
   - Different character builds remain viable for PvE content

4. **Better New Player Experience**
   - Early-game combat feels more manageable
   - Clearer progression path through content
   - Less frustration from unexpected one-shot deaths

These changes focus specifically on improving the PvE experience before addressing PvP balance, which may require different approaches and considerations.

## Player Stat Progression and Mob Scaling Analysis

The analysis of player and mob stat progression from level 1 to 10 reveals the following:

### Player Stats
- Players start at level 1 with base stats (typically around 5-10 points per attribute)
- Each level grants 2 ability points (ABILITY_POINTS_PER_LEVEL = 2)
- Players can specialize heavily in a single stat or balance their growth
- By level 10, players specializing in a single stat can reach ~30 points in that attribute
- Warriors can get bonus strength, while mages get bonus intelligence at certain levels

### Mob Stats
- Level 1 mobs (e.g., Giant Rat): STR=8, AGI=6, INT=3, HP=20
- Level 5 mobs (e.g., Dire Wolf): STR=18, AGI=9, INT=10, HP=32
- Level 10 mobs (e.g., Shadow Dragon): STR=30, AGI=32, INT=36, HP=45

This progression creates the following issues:
- Mob stats scale linearly while player stat specialization creates wider gaps
- At higher levels, specialized players gain significant advantage against mobs
- Lack of armor values on mobs makes them too vulnerable to physical damage
- Encounters likely become too easy for specialized high-level players

## Implementation Files Analysis

Below is a comprehensive analysis of all files that need to be modified to implement balanced PvE combat:

### Core Combat System Files

1. **CombatSystem.sol**
   - **Location**: `/packages/contracts/src/systems/CombatSystem.sol`
   - **Changes Needed**:
     - Modify `_calculateToHit()` function to balance hit probability
     - Adjust critical hit chance calculation to better scale with level difference
     - Revise `_calculateWeaponDamage()` and `_calculateMagicDamage()` to implement diminishing returns
     - Update `_addStatBonus()` to prevent extreme damage scaling

2. **Constants.sol**
   - **Location**: `/packages/contracts/constants.sol`
   - **Changes Needed**:
     - Reduce `ATTACK_MODIFIER` from 1.2 ether to a more balanced value (e.g., 1.1 ether)
     - Adjust `CRIT_MULTIPLIER` down from 2 to a more moderate value (e.g., 1.5)
     - Recalibrate `DEFENDER_HIT_DAMPENER` and `ATTACKER_HIT_DAMPENER` for better scaling
     - Consider reducing `STARTING_HIT_PROBABILITY` from 90 to create more challenging combat

### Mob Generation and Stats

3. **MobSystem.sol**
   - **Location**: `/packages/contracts/src/systems/MobSystem.sol`
   - **Changes Needed**:
     - Implement a more sophisticated mob stats generation system
     - Add mob type modifiers (trash, elite, boss) to influence damage and health

4. **monsters.json**
   - **Location**: `/packages/contracts/monsters.json`
   - **Changes Needed**:
     - Rebalance mob stats across all levels
     - Add armor values to higher-level mobs
     - Differentiate mob stat distributions by class/type
     - Create a more gradual progression curve

### Character Progression

5. **CharacterSystem.sol**
   - **Location**: `/packages/contracts/src/systems/CharacterSystem.sol`
   - **Changes Needed**:
     - Consider adjusting the `levelCharacter()` function to implement diminishing returns on stat growth
     - Update `_setStats()` to ensure balanced progression

6. **PostDeploy.s.sol**
   - **Location**: `/packages/contracts/script/PostDeploy.s.sol`
   - **Changes Needed**:
     - Update mob creation logic in `_createMonsters()` to implement new balance parameters
     - Potentially adjust experience point values in `setLevels()` function

### Expanded Implementation Files Analysis

After additional review of the codebase, here are the additional files and components that require modification to achieve balanced PvE combat:

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

### Implementation Priorities

1. **First Wave Changes (Immediate Impact)**
   - Adjust core combat constants (ATTACK_MODIFIER, CRIT_MULTIPLIER)
   - Update critical hit calculation in CombatSystem.sol
   - Add armor values to higher-level mobs in monsters.json

2. **Second Wave Changes (Systemic Improvements)**
   - Implement stat scaling with diminishing returns
   - Add mob type modifiers
   - Revise damage calculation formulas

3. **Third Wave Changes (Fine-tuning)**
   - Adjust hit probability calculations
   - Balance class-specific bonuses
   - Tune combat feedback and recovery mechanisms

This comprehensive approach ensures that the PvE combat balance improvements are implemented systematically, with careful attention to interdependencies between different components of the game system.

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

This expanded analysis provides a more comprehensive view of all systems that must be modified to implement balanced PvE combat, accounting for the complex interplay between character stats, equipment bonuses, status effects, and combat calculations.
