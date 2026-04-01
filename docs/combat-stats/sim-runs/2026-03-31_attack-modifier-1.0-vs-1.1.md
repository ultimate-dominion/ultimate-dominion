# Sim Run: ATTACK_MODIFIER 1.0 vs 1.1

**Date:** 2026-03-31
**Change:** ATTACK_MODIFIER reduced from 1.2 to 1.0 (previous session). Evaluating 1.0 vs 1.1.
**Sim:** `CombatBalance.t.sol` (forge sanity check, 9 classes x default weapons)
**Full sim (balance-layer3-weapons.ts):** NOT RUN — pending decision on modifier value

---

## Results at ATTACK_MODIFIER = 1.0, AGI_ATTACK_MODIFIER = 1.0

### DPT Table (vs neutral 12/12/12, 2 armor, 40 HP, x100 scale)

| Class | Weapon | DPT | % of Best |
|-------|--------|-----|-----------|
| Wizard | Smoldering Rod [M] | 1078 | 100% |
| Rogue | Darkwood Bow [P] | 1019 | 94% |
| Warrior | Giants Club [P] | 980 | 90% |
| Ranger | Darkwood Bow [P] | 927 | 85% |
| Warlock | Smoldering Rod [M] | 882 | 81% |
| Paladin | Warhammer [P] | 679 | 62% |
| Sorcerer | Crystal Blade [P] | 625 | 57% |
| Druid | Darkwood Bow [P] | 614 | 56% |
| Cleric | Bone Staff [M] | 490 | 45% |

### Test Results: 9 passed, 4 failed

| Test | Result | Goal Violated |
|------|--------|---------------|
| NoBuild_DoesZeroDamage | PASS | - |
| NoOneShot_Boss | PASS | - |
| AllClasses_CanSolo_CaveRat | PASS | - |
| CombatTriangle_Advantage | PASS | - |
| Hybrid_Builds_Viable | PASS | - |
| INT_DPS_Parity | **FAIL** | Goal 5: Cleric 490 < 50% of best phys 980 |
| CrossWeapon_Minimum_Viability | **FAIL** | Goal 4: 8 off-meta combos deal 0 dmg |
| PvP_TTK_Bounds | **FAIL** | Goal 3: Warrior/Paladin mirrors stalemate (TTK >= 60) |
| PvP_EveryClassHasAChance | **FAIL** | Goal 3: Paladin deals 0 dmg to Warrior |

### Failure Analysis

1. **Cleric DPT parity (Goal 5):** Cleric at exactly 490 = 980/2, fails strict `>` check. Borderline — support class at 45% of best is arguably fine.
2. **Off-meta 0-damage (Goal 4):** Warlock/Wizard/Cleric with Warhammer/Longbow, Ranger with Etched Blade, Sorcerer with Longbow. These are unrealistic combos (INT caster using STR weapon). Not a real balance problem.
3. **Tank stalemates (Goal 3):** Warrior vs Warrior, Paladin vs Warrior, Paladin vs Paladin. At 1.0, not enough damage through 5 armor. Real game has 15-turn limit so this resolves as a draw, but the sim flags it.
4. **Paladin 0 to Warrior (Goal 3):** Paladin STR 21 vs Warrior STR 24 + 5 armor. Low-end damage zeroed by armor.

### Core Issue at 1.0

AGI is strictly optimal. Rogue gets evasion + double strike + crit bonus with zero damage tradeoff vs STR. At equal modifiers (1.0/1.0), those utility mechanics are pure upside. **Violates Goal 5** — paths don't feel mechanically distinct when there's no damage vs utility tradeoff.

---

## Results at ATTACK_MODIFIER = 1.1, AGI_ATTACK_MODIFIER = 1.0

### DPT Table

| Class | Weapon | DPT | % of Best |
|-------|--------|-----|-----------|
| Warrior | Giants Club [P] | 1176 | 100% |
| Wizard | Smoldering Rod [M] | 1176 | 100% |
| Rogue | Darkwood Bow [P] | 1019 | 86% |
| Ranger | Darkwood Bow [P] | 927 | 78% |
| Sorcerer | Crystal Blade [P] | 893 | 75% |
| Warlock | Smoldering Rod [M] | 882 | 75% |
| Paladin | Warhammer [P] | 776 | 65% |
| Druid | Darkwood Bow [P] | 614 | 52% |
| Cleric | Bone Staff [M] | 588 | 50% |

### Test Results: 9 passed, 4 failed (same 4)

Failures shift but don't resolve:
- Cleric: 588 = 1176/2, still fails strict `>` (off by 1)
- Off-meta 0-damage: unchanged (AGI weapons unaffected)
- Paladin stalemates: still marginal (TTK=62 vs cap 60)
- Paladin 0 to Warrior: still fails (STR gap + armor)

---

## Decision

**Pending.** Neither value resolves the 4 test failures without also fixing test assertions. The real question is whether the test thresholds match the design goals or whether they're too strict.

### What 1.1 gets right vs 1.0
- STR gets 10% damage over AGI, creating the intended damage-vs-utility tradeoff (Goal 5)
- Magic also gets 10% boost, improving INT caster viability
- More damage through armor helps tank stalemates marginally

### What still needs fixing regardless of 1.0 or 1.1
- Cleric parity threshold: `>` vs `>=` or lower to 45%
- Off-meta cross-weapon test: floor at 1 before armor, or exclude unrealistic combos
- PvP stalemate bound: raise from 60 to 75 (Paladin mirrors are slow by design)
- Paladin vs Warrior: either buff Paladin base STR or accept sim artifact (variance fixes it in real combat)

### Next step
Run the full sim (`balance-layer3-weapons.ts`) at 1.1 before deploying. The forge test is a sanity check, not proof.
