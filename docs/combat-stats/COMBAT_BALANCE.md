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

### 4. ~~Combat Triangle Uncapped~~ `[RESOLVED]`

- ~~5% per stat point with no ceiling~~
- **Fixed**: Changed to 4% per stat point with 40% cap (commit `014d0ae6`)

### 5. ~~PvE Flee Not Implemented~~ `[RESOLVED]`

- ~~Players cannot flee PvE encounters. Must fight all 15 turns or die.~~
- **Fixed**: PvE flee implemented with 5% escrow gold penalty (burned). Attacker flees turn 1, defender turn 2.

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
| 10 | 20 |
| 50 | 40 |
| 100 | 50 |

---

## Implementation Priority

Remaining balance changes, recommended order:

1. ATTACK_MODIFIER reduction (highest impact, simplest — currently 1.2, consider 1.0–1.1)
2. CRIT_MULTIPLIER reduction (reduces variance — currently 2×, consider 1.5–1.75)
3. ~~PvE flee implementation~~ `[DONE]` — 5% gold penalty
4. ~~Combat triangle cap~~ `[DONE]` — 40% cap at 4% per stat
5. Separate PvE/PvP modifiers (independent tuning)
6. Armor scaling rework (longer-term)

### Completed Balance Changes (March 2026)

- **Weapon damage reduction**: All player weapons significantly reduced (weapons are now "stat vehicles" with modest base damage; power comes from stats flowing through the formula). Example: Giant's Club 18-28 → 5-9, Warhammer 15-25 → 4-7.
- **HP normalization**: All weapon archetypes now provide HP bonuses. AGI/INT weapons were previously disadvantaged.
- **Monster HP increase**: Levels 6-10 monsters received HP increases (e.g., Shadow Dragon 48 → 65, Stone Giant 40 → 52).
- **AGI weapon scaling**: Bows now scale with AGI instead of STR (via WeaponScaling table).
- **AGI combat mechanics**: Evasion dodge (25% cap), double strike (+50% damage, 25% cap), AGI crit bonus (+AGI/4%).
- **Magic resistance**: Defender INT/5 subtracted from incoming spell damage.
- **Caster class multiplier buffs**: Warlock 110→120%, Wizard 115→125%, Sorcerer 108→115%.
- **Combat triangle retuning**: 5% → 4% per stat, added 40% cap.

---

## Future Features `[PLANNED]`

- Range vs melee combat distinction
- Class abilities post-Level 10
- Expanded status effects (poison, root, silence)
- Multi-stat weapon scaling
- Health regeneration out of combat

---

*Last updated: March 2026*
