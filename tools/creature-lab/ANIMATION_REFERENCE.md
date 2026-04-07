# Meshy Animation Reference — Creature Lab

## Core Principles

1. **Baked-in weapons need full-arm motion.** Meshy models weapons as mesh geometry, not separate hand-bone objects. "Realistic" weapon action_ids (219, 237, 128) use subtle wrist motion — invisible at ASCII scale. Use unarmed/combo/skill IDs with big full-body arcs instead.

2. **Match weapon to animation, not vice versa.** If the best animation is a sword swing but the creature holds a spear, change the weapon prompt. Players see the motion, not the label.

3. **Arm-fused weapons animate best.** Describe weapons as "fused to forearm" or "extending from wrist" in the mesh prompt so Meshy models them as arm geometry. This guarantees the weapon follows arm bone motion.

4. **Full-arc motion > static poses.** Avoid animations where arms stay raised (A-pose bleed-through). Good animations start near neutral, sweep through a dramatic arc, and return. Casting/spell variants (125-131) are mostly static arms-up — don't use them.

5. **Bone motion analysis is a rough filter.** Use it to narrow candidates, but always do visual review. High arm score doesn't guarantee the weapon geometry visually moves.

6. **100 (Rightward_Spin) is the universal hit_react.** The stumble/spin reads as knockback better than 178 (Hit_Reaction) which is a subtle flinch.

## Final Creature Animations (Dark Cave)

| Creature | Attack | Attack Name | Hit | Hit Name | Final GLB |
|----------|--------|-------------|-----|----------|-----------|
| Dire Rat | default | (quadruped) | default | (quadruped) | dire-rat-animated.glb |
| Kobold | **19** | Skill_03 | **100** | Rightward_Spin | kobold-final.glb |
| Goblin | **99** | Reaping_Swing | **100** | Rightward_Spin | goblin-final.glb |
| Skeleton | **19** | Skill_03 | **100** | Rightward_Spin | skeleton-final.glb |
| Goblin Shaman | **19** | Skill_03 | **100** | Rightward_Spin | goblin-shaman-final.glb |
| Bugbear | **99** | Reaping_Swing | **100** | Rightward_Spin | bugbear-final.glb |

### Attack Assignment Logic
- **19 (Skill_03)** → swords, staffs, casters, light weapons. Theatrical full-arc gesture. Best for creatures where the attack should read as precise or magical.
- **99 (Reaping_Swing)** → cleavers, axes, maces, heavy weapons. Widest lateral sweep. Best for creatures where the attack should read as powerful/brutal.

### Standard Clips (All Creatures)
| Clip | ID | Name |
|------|----|------|
| idle | 0 | Idle |
| walk | 30 | Casual_Walk |
| death | 187 | Knock_Down |
| hit_react | **100** | Rightward_Spin |

## Attack Candidates — Full Test Results

### Tier 1: Visually Confirmed Good
| ID | Name | Style | Best For |
|----|------|-------|----------|
| **19** | Skill_03 | Theatrical gesture, clear full arc | Sword, staff, casting, general |
| **99** | Reaping_Swing | Widest lateral sweep, full arm extension | Cleaver, axe, mace, heavy melee |
| **91** | Double_Blade_Spin | Full rotation, arms extended | Sword, dual-wield (backup option) |

### Tier 2: Situational
| ID | Name | Notes |
|----|------|-------|
| 90 | Counterstrike | Good parry-then-strike, decent arm motion |
| 127 | Charged_Ground_Slam | Low arm motion (10.4) despite name — disappointing |

### Tier 3: Don't Use
| ID | Name | Problem |
|----|------|---------|
| 125-131 | Spell cast variants | Static arms-up poses, A-pose bleed-through |
| 219 | Right_Hand_Sword_Slash | Wrist-centric, invisible at ASCII |
| 237 | Charged_Axe_Chop | Same |
| 128 | Heavy_Hammer_Swing | Same |
| 240 | Thrust_Slash | Forward but too subtle |
| 241 | Weapon_Combo_2 | High data score, weapon doesn't visually move |
| 242 | Charged_Slash | Low motion overall |

## Creature Weapon Decisions

| Creature | Mesh Prompt Weapon | Attack Style | Notes |
|----------|-------------------|--------------|-------|
| Skeleton | rusty iron longsword | Sword swing (19) | Prompt says longsword, reads as sword |
| Kobold | bone spear | Skill gesture (19) | Spear reads ok with 19's arc |
| Goblin | blade fused to forearm | Wide sweep (99) | Arm-fused weapon = guaranteed motion |
| Goblin Shaman | skull staff | Spell cast gesture (19) | 19 reads as casting, staff follows |
| Bugbear | spiked morningstar | Heavy sweep (99) | Big creature + big sweep = impact |
| Dire Rat | claws/bite | Quadruped defaults | Separate pipeline, mesh was redone |

## Testing Process

1. Rig once (5 credits)
2. `node creature-forge.mjs --test-attacks <slug> --ids 19,91,99,100` (3 credits each)
3. Review in review.html — all clips show with labels, scrollable
4. Pick best attack by VISUAL review
5. Build final GLB: merge idle + walk + best_attack + death + best_hit
6. If weapon doesn't move → regenerate mesh with "weapon fused to forearm" prompt
7. Copy final to `public/models/creatures/<slug>-animated.glb` for game
