# Combat System

Implementation reference — all values from the actual codebase (`constants.sol`, `CombatMath.sol`, `CombatSystem.sol`, `PvPSystem.sol`, `MapSpawnSystem.sol`).

---

## Overview

- Turn-based combat, max **15 turns** per encounter
- PvE and PvP use the same core combat engine
- Actions submitted per turn; each targets one entity with one equipped item
- Effects on items execute sequentially (PhysicalDamage, MagicDamage, or StatusEffect)

---

## Hit Probability

Calculated in `CombatMath.calculateToHit()`.

| Constant | Value | Purpose |
|----------|-------|---------|
| STARTING_HIT_PROBABILITY | 90 | Base hit chance (%) |
| ATTACKER_HIT_DAMPENER | 95 | Dampener when attacker stat > defender |
| DEFENDER_HIT_DAMPENER | 30 | Dampener when defender stat >= attacker |
| Min hit chance | 5% | Floor |
| Max hit chance | 98% | Ceiling |

- Physical attacks: AGI vs AGI
- Magic attacks: INT vs INT
- Status effects: uses the resistance stat specified by the effect (STR, AGI, INT, or None=auto-hit)

---

## Critical Hits

| Constant | Value |
|----------|-------|
| CRIT_MULTIPLIER | 2 |
| Base crit chance | ~5% |

- Only checked when attack lands
- On crit: weapon uses `maxDamage` instead of random roll, then × 2
- `critChanceBonus` from items can increase beyond 5%

---

## Damage Calculation

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| ATTACK_MODIFIER | 1.2 ether (120%) | Applied to STR weapon damage |
| AGI_ATTACK_MODIFIER | 0.9 ether (90%) | Applied to AGI weapon damage |
| DEFENSE_MODIFIER | 1.0 ether (100%) | Applied to defender's armor |
| PROFICIENCY_DENOMINATOR | 20 | Stats / 20 for proficiency bonus |

### Physical Damage

1. Base: random(minDamage, maxDamage) — crit uses maxDamage
2. × scaling modifier (STR weapons: 1.2, AGI weapons: 0.9)
3. + stat bonus: `(attackerPrimary × scalingMod) - (defenderPrimary × 1.0)`
   - STR weapons use STR as primary stat
   - AGI weapons use AGI as primary stat (set via WeaponScaling table)
4. - armor reduction: `(armor - penetration) × DEFENSE_MODIFIER`
5. × CRIT_MULTIPLIER if crit (2×)
6. × class physical damage multiplier
7. × combat triangle bonus
8. Evasion dodge check (defender AGI vs attacker AGI — can negate all damage)
9. Double strike check (AGI weapons only — +50% bonus damage on proc)

### Magic Damage

1. Base: random(minDamage, maxDamage) — crit uses maxDamage
2. × ATTACK_MODIFIER (1.2)
3. + stat bonus: `(attackerINT × 1.2) - (defenderINT × 1.0)`
4. - magic resistance: `defenderINT / 5` (min 1 damage)
5. Healing capped at maxHP
6. × CRIT_MULTIPLIER if crit
7. × class spell damage multiplier
8. × combat triangle bonus

### Class Multipliers (Basis Points, 1000 = 100%)

| Class | Phys | Spell | Heal | Crit | HP |
|-------|------|-------|------|------|----|
| Warrior | 1100 | 1000 | 1000 | 1000 | 1000 |
| Paladin | 1050 | 1000 | 1050 | 1000 | 1000 |
| Ranger | 1100 | 1000 | 1000 | 1000 | 1000 |
| Rogue | 1000 | 1000 | 1000 | 1150 | 1000 |
| Druid | 1050 | 1050 | 1000 | 1000 | 1050 |
| Warlock | 1000 | 1200 | 1000 | 1000 | 1000 |
| Wizard | 1000 | 1250 | 1000 | 1000 | 1000 |
| Cleric | 1000 | 1000 | 1100 | 1000 | 1000 |
| Sorcerer | 1000 | 1150 | 1000 | 1000 | 1050 |

---

## Combat Triangle

STR beats AGI beats INT beats STR.

- Bonus: **4% per stat point difference** (COMBAT_TRIANGLE_BONUS_PER_STAT = WAD / 25)
- **Cap**: 40% maximum bonus (COMBAT_TRIANGLE_MAX_BONUS = WAD × 40 / 100)
- Only the advantaged side gets a bonus; no penalty for disadvantage
- Based on each entity's dominant stat (highest of STR/AGI/INT)
- Applied as damage multiplier: `damage × (1.0 + bonus)`

---

## AGI Combat Mechanics

AGI-focused builds gain combat advantages to compensate for the lower attack modifier (0.9 vs 1.2):

| Mechanic | Formula | Cap | Notes |
|----------|---------|-----|-------|
| **Evasion dodge** | (defenderAGI - attackerAGI) / 3 | 25% | Physical attacks only |
| **Double strike** | (attackerAGI - defenderAGI) × 2 | 25% | AGI weapons only, +50% damage |
| **AGI crit bonus** | AGI / 4 | — | Additive to base 5% crit |

- **Evasion**: Only triggers when defender AGI > attacker AGI. Sets damage to 0 and hit to false.
- **Double strike**: Only triggers for AGI-scaling weapons when attacker AGI > defender AGI. Adds 50% of final damage.
- **AGI crit bonus**: Flat addition to crit chance for all weapon types based on attacker's AGI.

## Magic Resistance

Defender's INT provides passive magic damage reduction:

```
resist = defenderINT / 5
damage = magicDamage - resist (min 1 damage guaranteed)
```

Applied after base magic damage calculation, before class multipliers.

---

## Status Effects

| Effect | Description |
|--------|-------------|
| ToHitModifier | Alters hit probability |
| DoT | Damage over time each turn |
| HitPointMod | Direct HP modification |
| ArmorMod | Temporarily changes armor |
| WeaponMod | Temporarily changes weapon damage |
| Stun | Skip turn |

---

## PvE Combat

- **15 turn limit**
- **Flee**: Attacker turn 1, defender turn 2. **5% escrow gold penalty** (burned).
- **Mob spawning** (based on Chebyshev distance from 0,0):
  - Distance < 5: Level 1–5 mobs
  - Distance >= 5: Level 6–10 mobs
  - 0–3 mobs per tile (random, `rng % 4`)
- **Rewards**: Gold (BASE_GOLD_DROP = 5), XP, item drops via LootManager

---

## PvP Combat

- **Zone**: x >= 5 OR y >= 5 (danger zone)
- **Cooldown**: 30 seconds between PvP engagements (PVP_TIMER)
- **Escrow**: Player gold held during combat
- **Flee**: Attacker can flee turn 1, defender turn 2
  - Penalty: **25% of escrow gold** (minimum 4 gold to trigger)
  - Gold split among opposing team
- **Rewards**: Loser's escrow gold ÷ PVP_GOLD_DENOMINATOR (2) to winners
- **Group**: Supports multiple attackers vs multiple defenders

---

## Turn Timer

- 30 seconds per turn
- If a side doesn't act in time, the other side can force-advance

---

## Key Constants Summary

| Constant | Value |
|----------|-------|
| DEFAULT_MAX_TURNS | 15 |
| STARTING_HIT_PROBABILITY | 90 |
| ATTACK_MODIFIER | 1.2 ether (STR weapons) |
| AGI_ATTACK_MODIFIER | 0.9 ether (AGI weapons) |
| DEFENSE_MODIFIER | 1.0 ether |
| CRIT_MULTIPLIER | 2 |
| PROFICIENCY_DENOMINATOR | 20 |
| COMBAT_TRIANGLE_BONUS_PER_STAT | WAD / 25 (4%) |
| COMBAT_TRIANGLE_MAX_BONUS | WAD × 40 / 100 (40%) |
| EVASION_CAP | 25% |
| DOUBLE_STRIKE_CAP | 25% |
| PVP_TIMER | 30 seconds |
| PVP_GOLD_DENOMINATOR | 2 |
| BASE_GOLD_DROP | 5 ether |
| MAX_PARTY_SIZE | 10 |
| MAX_MONSTERS | 20 |

---

*Last updated: March 2026*
