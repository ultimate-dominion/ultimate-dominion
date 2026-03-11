# Balance Patch: On-Chain -> Sim V3 Target
# Generated 2026-03-11
# Source: prod-baseline.json (on-chain) vs overrides.ts (sim V3)

Everything below must be deployed on-chain to match the sim.

## 1. LEVELING

| Constant | On-Chain | Target |
|----------|----------|--------|
| statPointsPerLevel | 2 | 1 |
| hpPerLevel | 2 | 2 (no change) |
| baseHp | 18 | 18 (no change) |
| Impact | — | L10 characters lose 9 stat points |

## 2. COMBAT CONSTANTS

| Constant | On-Chain | Target | Change |
|----------|----------|--------|--------|
| attackModifier | 1.2 | 1.2 |  |
| agiAttackModifier | 0.9 | 1 | CHANGED |
| critMultiplier | 2 | 2 |  |
| critBaseChance | 4% | 5% | CHANGED |
| evasionCap | 25% | 35% | CHANGED |
| doubleStrikeCap | 25% | 40% | CHANGED |
| combatTrianglePerStat | 2% | 2% |  |
| combatTriangleMax | 20% | 12% | CHANGED |
| combatTriangleFlatBonus | 20% | 0% (REMOVE) | CHANGED |
| magicResistPerInt | 2% | 3% | CHANGED |
| magicResistCap | 40% | 40% |  |
| blockChancePerStr | 1.5% | 2% | CHANGED |
| blockChanceCap | 30% | 30% |  |
| blockReductionPhys | 50% | 50% |  |
| blockReductionMagic | 50% | 0% (block does NOT reduce magic) | CHANGED |
| spellDodge.threshold | 10 | NOT IN SIM (evaluate) | CHANGED |
| spellDodge.pctPerAgi | 2% | NOT IN SIM (evaluate) | CHANGED |
| spellDodge.cap | 20% | NOT IN SIM (evaluate) | CHANGED |
| hitProbability.startProb | 90 | NOT IN SIM (evaluate) | CHANGED |
| hitProbability.attackerDampener | 95 | NOT IN SIM (evaluate) | CHANGED |
| hitProbability.defenderDampener | 30 | NOT IN SIM (evaluate) | CHANGED |

## 3. WEAPONS

### 3a. Modified Weapons (on-chain -> V3)

**Broken Sword** [26] (R0) — NO CHANGE

**Worn Shortbow** [27] (R0) — NO CHANGE

**Cracked Wand** [28] (R0) — NO CHANGE

**Iron Axe** [29] (R1) — NO CHANGE

**Hunting Bow** [30] (chain R1):
- hpMod: 0 -> 2

**Apprentice Staff** [31] (R1) — NO CHANGE

**Light Mace** [32] (chain R1):
- RENAME: "Steel Mace" -> "Light Mace"
- hpMod: 5 -> 3
- strReq: 9 -> 8
- agiReq: 0 -> 3

**Shortbow** [33] (chain R1):
- RENAME: "Recurve Bow" -> "Shortbow"
- hpMod: 0 -> 3
- strReq: 0 -> 4

**Channeling Rod** [34] (chain R1):
- hpMod: 2 -> 3
- strReq: 0 -> 3
- intReq: 10 -> 9

**Notched Blade** [35] (chain R1):
- RENAME: "Etched Blade" -> "Notched Blade"
- strReq: 5 -> 4
- intReq: 5 -> 4

**Notched Cleaver** [41] (chain R2):
- RENAME: "Brute's Cleaver" -> "Notched Cleaver"
- hpMod: 3 -> 2
- agiReq: 0 -> 3

**Sporecap Wand** [40] (R2) — NO CHANGE

**Crystal Shard** [42] (chain R2):
- RENAME: "Crystal Blade" -> "Crystal Shard"
- minDmg: 6 -> 4
- maxDmg: 9 -> 6
- strReq: 5 -> 6
- intReq: 5 -> 6

**Webspinner Bow** [44] (chain R2):
- maxDmg: 4 -> 5
- hpMod: 0 -> 4
- strReq: 0 -> 5

**Warhammer** [36] (chain R2):
- hpMod: 8 -> 5
- strReq: 13 -> 11
- agiReq: 0 -> 4

**Longbow** [37] (chain R2):
- maxDmg: 6 -> 7
- hpMod: 0 -> 5
- strReq: 0 -> 4
- agiReq: 15 -> 13

**Mage Staff** [38] (chain R2):
- strReq: 0 -> 4
- intReq: 11 -> 9

**Dire Rat Fang** [39] (chain R3):
- RENAME: "Rat King's Fang" -> "Dire Rat Fang"

**Gnarled Cudgel** [43] (chain R3):
- RENAME: "Troll's Bonebreaker" -> "Gnarled Cudgel"
- hpMod: 5 -> 3
- strReq: 12 -> 10
- agiReq: 0 -> 4

**Bone Staff** [45] (chain R3):
- hpMod: 3 -> 5
- strReq: 0 -> 4
- intReq: 13 -> 11

**Stone Maul** [46] (chain R3):
- RENAME: "Giant's Club" -> "Stone Maul"
- maxDmg: 7 -> 6
- strMod: 4 -> 3
- hpMod: 8 -> 5
- strReq: 15 -> 13
- agiReq: 0 -> 5

**Darkwood Bow** [47] (chain R4):
- hpMod: 3 -> 6
- strReq: 0 -> 4
- agiReq: 18 -> 14
- RARITY: R4 -> R3

**Smoldering Rod** [48] (chain R4):
- maxDmg: 8 -> 7
- hpMod: 5 -> 6
- strReq: 0 -> 5
- intReq: 16 -> 13
- RARITY: R4 -> R3

### 3b. New Weapons

**Trollhide Cleaver** (R4) — NEW
- DMG: 6-9
- Mods: STR=3 AGI=3 INT=0 HP=5
- Reqs: STR=16 AGI=13 INT=0
- Price: 350g

**Phasefang** (R4) — NEW
- DMG: 5-10
- Mods: STR=0 AGI=4 INT=3 HP=5
- Reqs: STR=0 AGI=16 INT=11
- Price: 350g

**Drakescale Staff** (R4) — NEW
- DMG: 5-8
- Mods: STR=2 AGI=0 INT=3 HP=5
- Reqs: STR=16 AGI=0 INT=11
- Price: 350g

## 4. ARMOR

### 4a. Modified Armor

**Tattered Cloth** [10] (R0) — NO CHANGE

**Worn Leather Vest** [11] (R0) — NO CHANGE

**Rusty Chainmail** [12] (R0) — NO CHANGE

**Padded Armor** [13] (R1) — NO CHANGE

**Leather Jerkin** [14] (R1) — NO CHANGE

**Apprentice Robes** [15] (R1) — NO CHANGE

**Studded Leather** [16] (chain R1):
- price: 35g -> 40g

**Scout Armor** [17] (chain R1):
- price: 35g -> 40g

**Acolyte Vestments** [18] (chain R1):
- price: 35g -> 40g

**Etched Chainmail** [19] (chain R2):
- RENAME: "Chainmail Shirt" -> "Etched Chainmail"
- intReq: 0 -> 7
- price: 80g -> 100g

**Ranger Leathers** [20] (chain R2):
- intReq: 0 -> 8
- price: 80g -> 100g

**Mage Robes** [21] (chain R2):
- agiReq: 0 -> 10
- price: 80g -> 100g

**Spider Silk Wraps** [22] (chain R2):
- intReq: 0 -> 8

**Carved Stone Plate** [23] (chain R3):
- RENAME: "Cracked Stone Plate" -> "Carved Stone Plate"
- ARM: 8 -> 10
- hpMod: 8 -> 10
- intReq: 0 -> 9

**Stalker's Cloak** [24] (chain R3):
- ARM: 5 -> 7
- intReq: 0 -> 10

**Scorched Scale Vest** [25] (chain R3):
- intReq: 0 -> 9
- price: 300g -> 250g

### 4b. New Armor

**Drake's Cowl** (R3) — NEW
- ARM: 6 Type: undefined
- Mods: STR=0 AGI=0 INT=5 HP=0
- Reqs: STR=0 AGI=12 INT=14
- Price: 200g

## 5. MONSTERS

**Dire Rat** (L1) [chain: cave_rat]:
- RENAME: "cave_rat" -> "Dire Rat"
- STR: 4 -> 3
- AGI: 7 -> 6
- INT: 3 -> 2
- HP: 12 -> 10
- XP: 2 -> 225

**Fungal Shaman** (L2) [chain: fungal_shaman]:
- STR: 4 -> 3
- AGI: 5 -> 4
- INT: 9 -> 8
- HP: 14 -> 12
- XP: 4 -> 400

**Cavern Brute** (L3) [chain: cavern_brute]:
- STR: 11 -> 9
- AGI: 5 -> 4
- INT: 4 -> 3
- HP: 22 -> 18
- XP: 6 -> 550

**Crystal Elemental** (L4) [chain: crystal_elemental]:
- STR: 5 -> 4
- AGI: 6 -> 5
- INT: 12 -> 10
- HP: 20 -> 16
- XP: 8 -> 800

**Ironhide Troll** (L5) [chain: cave_troll]:
- RENAME: "cave_troll" -> "Ironhide Troll"
- STR: 14 -> 11
- AGI: 8 -> 6
- INT: 6 -> 5
- HP: 32 -> 26
- ARM: 3 -> 2
- XP: 10 -> 1000

**Phase Spider** (L6) [chain: phase_spider]:
- STR: 10 -> 8
- AGI: 15 -> 12
- INT: 7 -> 5
- HP: 28 -> 22
- XP: 13 -> 1325

**Bonecaster** (L7) [chain: lich_acolyte]:
- RENAME: "lich_acolyte" -> "Bonecaster"
- STR: 8 -> 6
- AGI: 9 -> 7
- INT: 17 -> 13
- HP: 32 -> 26
- XP: 20 -> 2000

**Rock Golem** (L8) [chain: stone_giant]:
- RENAME: "stone_giant" -> "Rock Golem"
- STR: 18 -> 14
- AGI: 10 -> 8
- INT: 9 -> 7
- HP: 48 -> 38
- ARM: 4 -> 3
- XP: 25 -> 2500

**Pale Stalker** (L9) [chain: shadow_stalker]:
- RENAME: "shadow_stalker" -> "Pale Stalker"
- STR: 14 -> 10
- AGI: 20 -> 15
- INT: 10 -> 7
- HP: 42 -> 34
- XP: 33 -> 3250

**Dusk Drake** (L10) [chain: shadow_dragon]:
- RENAME: "shadow_dragon" -> "Dusk Drake"
- STR: 18 -> 13
- AGI: 18 -> 13
- INT: 20 -> 15
- HP: 70 -> 52
- ARM: 3 -> 2
- XP: 65 -> 6500

**Basilisk** (L10) — NEW
- STR=20 AGI=12 INT=10 HP=100 ARM=4 XP=10000

## 6. CLASS SPELLS

Spell model changes from flat damage to stat-scaling damage.

**Battle Cry** [1] (Warrior):
- On-chain: DMG=0-0 (flat, no scaling)
- Target: baseDMG=4-8 + 0.4/STR scaling
- Type: damage_buff
- Effects: +15% STR, +3 ARM
- Duration: 6 rounds

**Divine Shield** [2] (Paladin):
- On-chain: DMG=0-0 (flat, no scaling)
- Target: baseDMG=3-7 + 0.35/STR scaling
- Type: damage_buff
- Effects: +12% STR, +5 ARM
- Duration: 6 rounds

**Hunter's Mark** [4] (Ranger):
- On-chain: DMG=0-0 (flat, no scaling)
- Target: baseDMG=3-7 + 0.35/AGI scaling
- Type: damage_debuff
- Effects: -15% AGI, -2 ARM on target
- Duration: 6 rounds

**Shadowstep** [5] (Rogue):
- On-chain: DMG=0-0 (flat, no scaling)
- Target: baseDMG=4-8 + 0.4/AGI scaling
- Type: damage_buff
- Effects: +25% AGI
- Duration: 4 rounds

**Entangle** [6] (Druid):
- On-chain: DMG=0-0 (flat, no scaling)
- Target: baseDMG=3-6 + 0.3/INT scaling
- Type: damage_debuff
- Effects: -15% AGI, -10% STR on target
- Duration: 6 rounds

**Soul Drain** [7] (Warlock):
- On-chain: DMG=8-14 (flat, no scaling)
- Target: baseDMG=4-8 + 0.4/INT scaling
- Type: damage_debuff
- Effects: -12% STR, -12% INT on target
- Duration: 5 rounds

**Arcane Blast** [8] (Wizard):
- On-chain: DMG=12-20 (flat, no scaling)
- Target: baseDMG=5-10 + 0.5/INT scaling
- Type: magic_damage
- Effects: none

**Arcane Surge** [3] (Sorcerer):
- On-chain: DMG=10-16 (flat, no scaling)
- Target: baseDMG=4-8 + 0.4/INT scaling
- Type: magic_damage
- Effects: none

**Blessing** [9] (Cleric):
- On-chain: DMG=4-7 (flat, no scaling)
- Target: baseDMG=0-0 + none scaling
- Type: self_buff
- Effects: +12% INT, +5 ARM, +10% maxHP
- Duration: 6 rounds

## 7. CONSUMABLES

On-chain consumables (checking if sim proposes changes):

No consumable changes found in overrides.ts. Consumables use on-chain values as-is.
If the sim models consumables differently, those changes are hardcoded in the sim engine, not in the data layer.

- [56] Minor Health Potion R1 DMG=-15/-15 price=10g
- [57] Health Potion R1 DMG=-35/-35 price=25g
- [58] Greater Health Potion R1 DMG=-75/-75 price=60g
- [59] Fortifying Stew R1 DMG=0/0 price=20g
- [60] Quickening Berries R1 DMG=0/0 price=20g
- [61] Focusing Tea R1 DMG=0/0 price=20g
- [62] Bloodrage Tonic R1 DMG=0/0 price=25g
- [63] Stoneskin Salve R1 DMG=0/0 price=25g
- [64] Trollblood Ale R1 DMG=0/0 price=25g
- [65] Venom Vial R1 DMG=0/0 price=35g
- [66] Spore Cloud R1 DMG=0/0 price=35g
- [67] Sapping Poison R1 DMG=0/0 price=35g
- [68] Rat Tooth R0 DMG=0/0 price=1g
- [69] Cave Moss R0 DMG=0/0 price=1g
- [70] Cracked Bone R0 DMG=0/0 price=2g
- [71] Dull Crystal R0 DMG=0/0 price=3g
- [72] Tattered Hide R0 DMG=0/0 price=2g
- [73] Bent Nail R0 DMG=0/0 price=1g
- [74] Flashpowder R2 DMG=0/0 price=50g
- [75] Antidote R1 DMG=0/0 price=15g

## 8. WEAPON EFFECTS (V3 Epics + Monster Specials)

New effects for V3 epic weapons (not on chain):

**Phasefang:**
- Poison DoT: 3 dmg/tick, 2 max stacks, 8 turns, 2 turn cooldown
- Blind: -8 AGI, 8 turns, 3 turn cooldown

**Trollhide Cleaver:**
- Weaken: -8 STR, 8 turns, 3 turn cooldown

**Drakescale Staff:**
- Stupify: -8 INT, 8 turns, 3 turn cooldown

Monster effects (proposed):

**Dire Rat:**
- Poison DoT: 3 dmg/tick, 2 max stacks, 8 turns, 2 turn cooldown

**Basilisk:**
- Petrifying Gaze: 6-10 magic damage, 2 turn cooldown
- Venom DoT: 5 dmg/tick, 1 max stack, 6 turns, 3 turn cooldown

## SUMMARY

| Category | Changed | Unchanged | New |
|----------|---------|-----------|-----|
| Weapons | 17 | 6 | 3 |
| Armor | 10 | 6 | 1 |
| Monsters | 10 (ALL) | 0 | 1 (Basilisk) |
| Spells | 9 (ALL) | 0 | 0 |
| Combat Constants | 8 | 6 | 3 need evaluation |
| Leveling | 1 (stat points 2->1) | — | — |
| Consumables | 0 | all | 0 |
| Weapon Effects | — | — | 5 new |

---

# BALANCE PATCH — EXACT VALUES
# On-Chain -> V3 Target
# 2026-03-11

## WEAPONS — EXACT BEFORE/AFTER

ID  | Name                  | Field    | On-Chain | Target   | Delta
----|----------------------|----------|----------|----------|------
30  | Hunting Bow           | hpMod    | 0        | 2        | 0->2
32   | Light Mace            | name     | Steel Mace | Light Mace | RENAME
32  | Light Mace            | hpMod    | 5        | 3        | 5->3
32  | Light Mace            | strReq   | 9        | 8        | 9->8
32  | Light Mace            | agiReq   | 0        | 3        | 0->3
33   | Shortbow              | name     | Recurve Bow | Shortbow | RENAME
33  | Shortbow              | hpMod    | 0        | 3        | 0->3
33  | Shortbow              | strReq   | 0        | 4        | 0->4
34  | Channeling Rod        | hpMod    | 2        | 3        | 2->3
34  | Channeling Rod        | strReq   | 0        | 3        | 0->3
34  | Channeling Rod        | intReq   | 10       | 9        | 10->9
35   | Notched Blade         | name     | Etched Blade | Notched Blade | RENAME
35  | Notched Blade         | strReq   | 5        | 4        | 5->4
35  | Notched Blade         | intReq   | 5        | 4        | 5->4
41   | Notched Cleaver       | name     | Brute's Cleaver | Notched Cleaver | RENAME
41  | Notched Cleaver       | hpMod    | 3        | 2        | 3->2
41  | Notched Cleaver       | agiReq   | 0        | 3        | 0->3
42   | Crystal Shard         | name     | Crystal Blade | Crystal Shard | RENAME
42  | Crystal Shard         | minDmg   | 6        | 4        | 6->4
42  | Crystal Shard         | maxDmg   | 9        | 6        | 9->6
42  | Crystal Shard         | strReq   | 5        | 6        | 5->6
42  | Crystal Shard         | intReq   | 5        | 6        | 5->6
44  | Webspinner Bow        | maxDmg   | 4        | 5        | 4->5
44  | Webspinner Bow        | hpMod    | 0        | 4        | 0->4
44  | Webspinner Bow        | strReq   | 0        | 5        | 0->5
36  | Warhammer             | hpMod    | 8        | 5        | 8->5
36  | Warhammer             | strReq   | 13       | 11       | 13->11
36  | Warhammer             | agiReq   | 0        | 4        | 0->4
37  | Longbow               | maxDmg   | 6        | 7        | 6->7
37  | Longbow               | hpMod    | 0        | 5        | 0->5
37  | Longbow               | strReq   | 0        | 4        | 0->4
37  | Longbow               | agiReq   | 15       | 13       | 15->13
38  | Mage Staff            | strReq   | 0        | 4        | 0->4
38  | Mage Staff            | intReq   | 11       | 9        | 11->9
39   | Dire Rat Fang         | name     | Rat King's Fang | Dire Rat Fang | RENAME
43   | Gnarled Cudgel        | name     | Troll's Bonebreaker | Gnarled Cudgel | RENAME
43  | Gnarled Cudgel        | hpMod    | 5        | 3        | 5->3
43  | Gnarled Cudgel        | strReq   | 12       | 10       | 12->10
43  | Gnarled Cudgel        | agiReq   | 0        | 4        | 0->4
45  | Bone Staff            | hpMod    | 3        | 5        | 3->5
45  | Bone Staff            | strReq   | 0        | 4        | 0->4
45  | Bone Staff            | intReq   | 13       | 11       | 13->11
46   | Stone Maul            | name     | Giant's Club | Stone Maul | RENAME
46  | Stone Maul            | maxDmg   | 7        | 6        | 7->6
46  | Stone Maul            | strMod   | 4        | 3        | 4->3
46  | Stone Maul            | hpMod    | 8        | 5        | 8->5
46  | Stone Maul            | strReq   | 15       | 13       | 15->13
46  | Stone Maul            | agiReq   | 0        | 5        | 0->5
47  | Darkwood Bow          | hpMod    | 3        | 6        | 3->6
47  | Darkwood Bow          | strReq   | 0        | 4        | 0->4
47  | Darkwood Bow          | agiReq   | 18       | 14       | 18->14
47  | Darkwood Bow          | rarity   | 4        | 3        | 4->3
48  | Smoldering Rod        | maxDmg   | 8        | 7        | 8->7
48  | Smoldering Rod        | hpMod    | 5        | 6        | 5->6
48  | Smoldering Rod        | strReq   | 0        | 5        | 0->5
48  | Smoldering Rod        | intReq   | 16       | 13       | 16->13
48  | Smoldering Rod        | rarity   | 4        | 3        | 4->3
NEW | Trollhide Cleaver     | minDmg   | -        | 6        | NEW
NEW | Trollhide Cleaver     | maxDmg   | -        | 9        | NEW
NEW | Trollhide Cleaver     | strMod   | -        | 3        | NEW
NEW | Trollhide Cleaver     | agiMod   | -        | 3        | NEW
NEW | Trollhide Cleaver     | intMod   | -        | 0        | NEW
NEW | Trollhide Cleaver     | hpMod    | -        | 5        | NEW
NEW | Trollhide Cleaver     | strReq   | -        | 16       | NEW
NEW | Trollhide Cleaver     | agiReq   | -        | 13       | NEW
NEW | Trollhide Cleaver     | intReq   | -        | 0        | NEW
NEW | Trollhide Cleaver     | rarity   | -        | 4        | NEW
NEW | Trollhide Cleaver     | price    | -        | 350g     | NEW
NEW | Phasefang             | minDmg   | -        | 5        | NEW
NEW | Phasefang             | maxDmg   | -        | 10       | NEW
NEW | Phasefang             | strMod   | -        | 0        | NEW
NEW | Phasefang             | agiMod   | -        | 4        | NEW
NEW | Phasefang             | intMod   | -        | 3        | NEW
NEW | Phasefang             | hpMod    | -        | 5        | NEW
NEW | Phasefang             | strReq   | -        | 0        | NEW
NEW | Phasefang             | agiReq   | -        | 16       | NEW
NEW | Phasefang             | intReq   | -        | 11       | NEW
NEW | Phasefang             | rarity   | -        | 4        | NEW
NEW | Phasefang             | price    | -        | 350g     | NEW
NEW | Drakescale Staff      | minDmg   | -        | 5        | NEW
NEW | Drakescale Staff      | maxDmg   | -        | 8        | NEW
NEW | Drakescale Staff      | strMod   | -        | 2        | NEW
NEW | Drakescale Staff      | agiMod   | -        | 0        | NEW
NEW | Drakescale Staff      | intMod   | -        | 3        | NEW
NEW | Drakescale Staff      | hpMod    | -        | 5        | NEW
NEW | Drakescale Staff      | strReq   | -        | 16       | NEW
NEW | Drakescale Staff      | agiReq   | -        | 0        | NEW
NEW | Drakescale Staff      | intReq   | -        | 11       | NEW
NEW | Drakescale Staff      | rarity   | -        | 4        | NEW
NEW | Drakescale Staff      | price    | -        | 350g     | NEW

## ARMOR — EXACT BEFORE/AFTER

ID  | Name                  | Field    | On-Chain | Target   | Delta
----|----------------------|----------|----------|----------|------
16  | Studded Leather       | price    | 35g      | 40g      | 35g->40g
17  | Scout Armor           | price    | 35g      | 40g      | 35g->40g
18  | Acolyte Vestments     | price    | 35g      | 40g      | 35g->40g
19   | Etched Chainmail      | name     | Chainmail Shirt | Etched Chainmail | RENAME
19  | Etched Chainmail      | intReq   | 0        | 7        | 0->7
19  | Etched Chainmail      | price    | 80g      | 100g     | 80g->100g
20  | Ranger Leathers       | intReq   | 0        | 8        | 0->8
20  | Ranger Leathers       | price    | 80g      | 100g     | 80g->100g
21  | Mage Robes            | agiReq   | 0        | 10       | 0->10
21  | Mage Robes            | price    | 80g      | 100g     | 80g->100g
22  | Spider Silk Wraps     | intReq   | 0        | 8        | 0->8
23   | Carved Stone Plate    | name     | Cracked Stone Plate | Carved Stone Plate | RENAME
23  | Carved Stone Plate    | ARM      | 8        | 10       | 8->10
23  | Carved Stone Plate    | hpMod    | 8        | 10       | 8->10
23  | Carved Stone Plate    | intReq   | 0        | 9        | 0->9
24  | Stalker's Cloak       | ARM      | 5        | 7        | 5->7
24  | Stalker's Cloak       | intReq   | 0        | 10       | 0->10
NEW | Drake's Cowl          | ARM      | -        | 6        | NEW
NEW | Drake's Cowl          | strMod   | -        | 0        | NEW
NEW | Drake's Cowl          | agiMod   | -        | 0        | NEW
NEW | Drake's Cowl          | intMod   | -        | 5        | NEW
NEW | Drake's Cowl          | hpMod    | -        | 0        | NEW
NEW | Drake's Cowl          | strReq   | -        | 0        | NEW
NEW | Drake's Cowl          | agiReq   | -        | 12       | NEW
NEW | Drake's Cowl          | intReq   | -        | 14       | NEW
NEW | Drake's Cowl          | rarity   | -        | 3        | NEW
NEW | Drake's Cowl          | price    | -        | 200g     | NEW
25  | Scorched Scale Vest   | intReq   | 0        | 9        | 0->9
25  | Scorched Scale Vest   | price    | 300g     | 250g     | 300g->250g

## MONSTERS — EXACT BEFORE/AFTER

Lv | Name                  | Field | On-Chain | Target | Delta
---|----------------------|-------|----------|--------|------
1  | Dire Rat              | name  | cave_rat | Dire Rat | RENAME
1  | Dire Rat              | STR   | 4        | 3      | 4->3
1  | Dire Rat              | AGI   | 7        | 6      | 7->6
1  | Dire Rat              | INT   | 3        | 2      | 3->2
1  | Dire Rat              | HP    | 12       | 10     | 12->10
1  | Dire Rat              | XP    | 2        | 225    | 2->225
2  | Fungal Shaman         | STR   | 4        | 3      | 4->3
2  | Fungal Shaman         | AGI   | 5        | 4      | 5->4
2  | Fungal Shaman         | INT   | 9        | 8      | 9->8
2  | Fungal Shaman         | HP    | 14       | 12     | 14->12
2  | Fungal Shaman         | XP    | 4        | 400    | 4->400
3  | Cavern Brute          | STR   | 11       | 9      | 11->9
3  | Cavern Brute          | AGI   | 5        | 4      | 5->4
3  | Cavern Brute          | INT   | 4        | 3      | 4->3
3  | Cavern Brute          | HP    | 22       | 18     | 22->18
3  | Cavern Brute          | XP    | 6        | 550    | 6->550
4  | Crystal Elemental     | STR   | 5        | 4      | 5->4
4  | Crystal Elemental     | AGI   | 6        | 5      | 6->5
4  | Crystal Elemental     | INT   | 12       | 10     | 12->10
4  | Crystal Elemental     | HP    | 20       | 16     | 20->16
4  | Crystal Elemental     | XP    | 8        | 800    | 8->800
5  | Ironhide Troll        | name  | cave_troll | Ironhide Troll | RENAME
5  | Ironhide Troll        | STR   | 14       | 11     | 14->11
5  | Ironhide Troll        | AGI   | 8        | 6      | 8->6
5  | Ironhide Troll        | INT   | 6        | 5      | 6->5
5  | Ironhide Troll        | HP    | 32       | 26     | 32->26
5  | Ironhide Troll        | ARM   | 3        | 2      | 3->2
5  | Ironhide Troll        | XP    | 10       | 1000   | 10->1000
6  | Phase Spider          | STR   | 10       | 8      | 10->8
6  | Phase Spider          | AGI   | 15       | 12     | 15->12
6  | Phase Spider          | INT   | 7        | 5      | 7->5
6  | Phase Spider          | HP    | 28       | 22     | 28->22
6  | Phase Spider          | XP    | 13       | 1325   | 13->1325
7  | Bonecaster            | name  | lich_acolyte | Bonecaster | RENAME
7  | Bonecaster            | STR   | 8        | 6      | 8->6
7  | Bonecaster            | AGI   | 9        | 7      | 9->7
7  | Bonecaster            | INT   | 17       | 13     | 17->13
7  | Bonecaster            | HP    | 32       | 26     | 32->26
7  | Bonecaster            | XP    | 20       | 2000   | 20->2000
8  | Rock Golem            | name  | stone_giant | Rock Golem | RENAME
8  | Rock Golem            | STR   | 18       | 14     | 18->14
8  | Rock Golem            | AGI   | 10       | 8      | 10->8
8  | Rock Golem            | INT   | 9        | 7      | 9->7
8  | Rock Golem            | HP    | 48       | 38     | 48->38
8  | Rock Golem            | ARM   | 4        | 3      | 4->3
8  | Rock Golem            | XP    | 25       | 2500   | 25->2500
9  | Pale Stalker          | name  | shadow_stalker | Pale Stalker | RENAME
9  | Pale Stalker          | STR   | 14       | 10     | 14->10
9  | Pale Stalker          | AGI   | 20       | 15     | 20->15
9  | Pale Stalker          | INT   | 10       | 7      | 10->7
9  | Pale Stalker          | HP    | 42       | 34     | 42->34
9  | Pale Stalker          | XP    | 33       | 3250   | 33->3250
10 | Dusk Drake            | name  | shadow_dragon | Dusk Drake | RENAME
10 | Dusk Drake            | STR   | 18       | 13     | 18->13
10 | Dusk Drake            | AGI   | 18       | 13     | 18->13
10 | Dusk Drake            | INT   | 20       | 15     | 20->15
10 | Dusk Drake            | HP    | 70       | 52     | 70->52
10 | Dusk Drake            | ARM   | 3        | 2      | 3->2
10 | Dusk Drake            | XP    | 65       | 6500   | 65->6500
10 | Basilisk              | STR   | -        | 20     | NEW
10 | Basilisk              | AGI   | -        | 12     | NEW
10 | Basilisk              | INT   | -        | 10     | NEW
10 | Basilisk              | HP    | -        | 100    | NEW
10 | Basilisk              | ARM   | -        | 4      | NEW
10 | Basilisk              | XP    | -        | 10000  | NEW
