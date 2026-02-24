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
| ATTACK_MODIFIER | 1.2 ether (120%) | Applied to attacker's raw damage |
| DEFENSE_MODIFIER | 1.0 ether (100%) | Applied to defender's armor |
| PROFICIENCY_DENOMINATOR | 20 | Stats / 20 for proficiency bonus |

### Physical Damage

1. Base: random(minDamage, maxDamage) — crit uses maxDamage
2. × ATTACK_MODIFIER (1.2)
3. + stat bonus: `(attackerSTR × 1.2) - (defenderSTR × 1.0)`
4. - armor reduction: `(armor - penetration) × DEFENSE_MODIFIER`
5. × CRIT_MULTIPLIER if crit (2×)
6. × combat triangle bonus

### Magic Damage

1. Base: random(minDamage, maxDamage) — crit uses maxDamage
2. × ATTACK_MODIFIER (1.2)
3. + stat bonus: `(attackerINT × 1.2) - (defenderINT × 1.0)`
4. Healing capped at maxHP
5. × CRIT_MULTIPLIER if crit
6. × combat triangle bonus

### Class Multipliers (Basis Points, 1000 = 100%)

| Class | Phys | Spell | Heal | Crit | HP |
|-------|------|-------|------|------|----|
| Warrior | 1100 | 1000 | 1000 | 1000 | 1000 |
| Paladin | 1050 | 1000 | 1050 | 1000 | 1000 |
| Ranger | 1100 | 1000 | 1000 | 1000 | 1000 |
| Rogue | 1000 | 1000 | 1000 | 1150 | 1000 |
| Druid | 1050 | 1050 | 1000 | 1000 | 1050 |
| Warlock | 1000 | 1100 | 1000 | 1000 | 1000 |
| Wizard | 1000 | 1150 | 1000 | 1000 | 1000 |
| Cleric | 1000 | 1000 | 1100 | 1000 | 1000 |
| Sorcerer | 1000 | 1080 | 1000 | 1000 | 1050 |

---

## Combat Triangle

STR beats AGI beats INT beats STR.

- Bonus: **5% per stat point difference** (COMBAT_TRIANGLE_BONUS_PER_STAT = WAD / 20)
- Only the advantaged side gets a bonus; no penalty for disadvantage
- Based on each entity's dominant stat (highest of STR/AGI/INT)
- Applied as damage multiplier: `damage × (1.0 + bonus)`

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
- **Cannot flee PvE** — `fleePvp()` reverts with "cannot flee from pve"
- **Mob spawning** (based on Chebyshev distance from 0,0):
  - Distance < 5: Level 1–5 mobs
  - Distance >= 5: Level 6–10 mobs
  - 0–5 mobs per tile (random)
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
| ATTACK_MODIFIER | 1.2 ether |
| DEFENSE_MODIFIER | 1.0 ether |
| CRIT_MULTIPLIER | 2 |
| PROFICIENCY_DENOMINATOR | 20 |
| COMBAT_TRIANGLE_BONUS_PER_STAT | WAD / 20 (5%) |
| PVP_TIMER | 30 seconds |
| PVP_GOLD_DENOMINATOR | 2 |
| BASE_GOLD_DROP | 5 ether |
| MAX_PARTY_SIZE | 10 |
| MAX_MONSTERS | 20 |

---

*Last updated: February 2026*
