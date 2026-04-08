# Bone Naming Conventions

Standard bone names for all UD creature types. Use `creature-edit.mjs rename-bones` to normalize.

## Biped (humanoids)

```
root > hips > spine > spine_1 > chest > neck > head
                                 chest > shoulder_L > arm_upper_L > arm_lower_L > hand_L
                                 chest > shoulder_R > arm_upper_R > arm_lower_R > hand_R
                                 hips > leg_upper_L > leg_lower_L > foot_L
                                 hips > leg_upper_R > leg_lower_R > foot_R
```

## Quadruped (beasts)

```
root > hips > spine > chest > neck > head
                       chest > leg_front_L > foot_front_L
                       chest > leg_front_R > foot_front_R
                       hips > leg_back_L > foot_back_L
                       hips > leg_back_R > foot_back_R
                       hips > tail_01 > tail_02 > tail_03
```

## Equipment Sockets

Empty nodes parented to bones for item attachment. Added via `creature-edit.mjs add-sockets`.

| Socket | Parent Bone | Purpose |
|--------|-------------|---------|
| `hand_R.socket` | hand_R | Primary weapon |
| `hand_L.socket` | hand_L | Offhand / shield |
| `chest.socket` | chest | Torso armor |
| `head.socket` | head | Helm |
| `back.socket` | chest | Cape / backpack |

## Source Naming (pre-rename)

Meshy/Mixamo rigs use names like `mixamorig:RightHand`, `LeftUpLeg`, `Spine2`, `Spine02`.
UniRig may produce different names. Always run `creature-edit.mjs rename-bones` after rigging.
