# Combat Balance

Tuning notes, known issues, and proposed changes. See [COMBAT_SYSTEM.md](./COMBAT_SYSTEM.md) for implementation details.

---

## Known Issues

### 1. Attacker Advantage (ATTACK_MODIFIER = 1.2)

ALL attackers (players AND mobs) get 20% inherent damage bonus. Mobs hitting players benefit from this too, causing players to take more damage than intended.

**Proposed fix**: Reduce to 1.1 (10%) or 1.0 (neutral). Highest-impact single change for PvE balance.

### 2. Critical Hit Spikes

- 5% chance × 2× multiplier = occasional large damage swings
- Crits use maxDamage AND multiply by 2×, compounding the spike
- No defensive mechanism to reduce crit chance or crit damage taken

**Proposed fix**: Reduce CRIT_MULTIPLIER to 1.5–1.75.

### 3. Armor Scaling

- Flat reduction only — weapon damage growth outpaces armor at higher levels
- No percentage-based mitigation cap
- Armor penetration can completely negate defensive investment

### 4. Combat Triangle Uncapped

- 5% per stat point with no ceiling
- 20-point stat difference = 100% damage bonus (potentially excessive)

**Proposed fix**: Cap at 30–50% maximum bonus.

### 5. PvE Flee Not Implemented

Players cannot flee PvE encounters. Must fight all 15 turns or die.

**Proposed fix**: Allow flee on turn 1 (attacker) / turn 2 (defender) with no gold penalty.

---

## Balance Targets

| Scenario | Survival Target |
|----------|----------------|
| Equal-level mobs | Player defeats 3–5 before needing heal |
| +1 level mobs | Player defeats 2–3 before needing heal |
| +2 level mobs | Player defeats 1–2 before needing heal |

---

## Stat Progression Reference

### Base Stats
- Stat pool: 19 points (each stat 3–10)
- Base HP: **18** (before race/armor modifiers)
- Starting HP after modifiers: ~15–20

### HP Over Levels

| Level | HP from Leveling | Total (base 18) |
|-------|-----------------|-----------------|
| 10 | +20 | 38 |
| 50 | +60 | 78 |
| 100 | +85 | 103 |

### Stat Points Over Levels

| Level | Cumulative |
|-------|-----------|
| 10 | 10 |
| 50 | 30 |
| 100 | 40 |

---

## Implementation Priority

If pursuing balance changes, recommended order:

1. ATTACK_MODIFIER reduction (highest impact, simplest)
2. CRIT_MULTIPLIER reduction (reduces variance)
3. PvE flee implementation (quality of life)
4. Combat triangle cap (prevents runaway bonuses)
5. Separate PvE/PvP modifiers (independent tuning)
6. Armor scaling rework (longer-term)

---

## Future Features `[PLANNED]`

- Range vs melee combat distinction
- Class abilities post-Level 10
- Expanded status effects (poison, root, silence)
- Multi-stat weapon scaling
- Health regeneration out of combat

---

*Last updated: February 2026*
