# Power Source Abilities — Combinatorial Identity System

> Future feature design document. Not for current implementation.
> This system layers on TOP of the existing class ability system (Lore Bible, levels 15–30).

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [How It Works](#how-it-works)
3. [Relationship to Existing Systems](#relationship-to-existing-systems)
4. [The 27 Combinations](#the-27-combinations)
5. [Natural Combinations (9)](#natural-combinations-9)
6. [Off-Meta Combinations (18)](#off-meta-combinations-18)
7. [Acquisition & Progression](#acquisition--progression)
8. [Lore Integration](#lore-integration)
9. [Balance Framework](#balance-framework)
10. [UI & Player Experience](#ui--player-experience)
11. [On-Chain Architecture](#on-chain-architecture)
12. [Implementation Phases](#implementation-phases)
13. [Open Questions](#open-questions)

---

## Design Philosophy

Power source is chosen at character creation — before a player knows what class they'll become. It's the earliest declaration of identity: *where does your power come from?*

Right now it's flavor text. It should be the foundation of what makes your character yours.

### The Pikel Principle

In R.A. Salvatore's novels, Pikel Bouldershoulder is a dwarven druid who believes his powers come from the gods. He's absurd. He's beloved. He works because the system lets him exist — a weird combination that shouldn't work but does, and it defines who he is.

**The goal: no two characters should feel alike.** A Divine Warrior and a Weave Warrior should play differently. A Physical Wizard and a Weave Wizard should solve problems in different ways. The 27 power source × class combinations create 27 distinct character fantasies, each with its own name, passive, and active ability.

### Design Principles

1. **Identity, not power.** Power source abilities complement your class — they don't overshadow it. A Wizard's fireball is a Wizard's fireball. Power source changes *how* you play the Wizard, not *whether* you're a Wizard.
2. **Every combination is valid.** Natural fits are easiest to design, but off-meta combinations must feel intentional, not like leftovers. A Physical Wizard should feel like a specific fantasy ("Spellblade"), not a mistake.
3. **Chosen once, permanent.** Power source is set at creation and cannot be changed. This is a permanent commitment — consistent with the manifesto's emphasis on meaningful choices and consequences.
4. **The weird ones are the best ones.** Off-meta combos are what create stories. The Divine Rogue who hears whispers from a dead god. The Physical Sorcerer who channels raw elemental force through their fists. These are the builds people remember.

---

## How It Works

### Per Character

Each character has:
- **Race** (chosen at creation) — stat modifiers
- **Power Source** (chosen at creation) — identity layer, determines passive + active
- **Advanced Class** (chosen at level 10) — defines role, multipliers, and class abilities (levels 15–30)
- **Power Source Passive** (unlocked at level 5) — always-on combat modifier based on power source × class
- **Power Source Active** (unlocked at level 10) — once-per-encounter ability based on power source × class

### The Grid

|  | Divine | Weave | Physical |
|--|--------|-------|----------|
| **Warrior** | Crusader | Spellbreaker | Warlord |
| **Paladin** | Templar | Arcane Guardian | Vanguard |
| **Ranger** | Warden | Arcanist Archer | Sharpshooter |
| **Rogue** | Shadow Priest | Nightblade | Assassin |
| **Druid** | Nature's Chosen | Stormcaller | Beastmaster |
| **Warlock** | Heretic | Void Channeler | Blood Mage |
| **Wizard** | Oracle | Archmage | Spellblade |
| **Cleric** | High Priest | Mystic | Battle Medic |
| **Sorcerer** | Conduit | Evoker | Elementalist |

Every cell in this grid has a unique fantasy name, a passive ability, and an active ability.

---

## Relationship to Existing Systems

### What Already Exists

| System | Level | Source | Scope |
|--------|-------|--------|-------|
| Race bonuses | 1 | Character creation | Flat stat mods |
| Power source | 1 | Character creation | Currently flavor only |
| Class multipliers | 10 | ImplicitClassSystem | % damage/healing/HP scaling |
| Class flat bonuses | 10 | ImplicitClassSystem | One-time stat boosts |
| Class abilities | 15–30 | Lore Bible (AbilitySystem) | 4 abilities per class via mentor quests |

### What This Adds

| System | Level | Source | Scope |
|--------|-------|--------|-------|
| **Power source passive** | **5** | PowerSourceAbilitySystem | Always-on combat modifier |
| **Power source active** | **10** | PowerSourceAbilitySystem | Once-per-encounter ability |

### Interaction Rules

- Power source abilities are **additive** with class multipliers, not multiplicative. A Crusader (Divine Warrior) gets the Warrior's 110% physical damage multiplier AND the Divine passive (bonus healing received). They don't stack multiplicatively.
- Power source actives operate on a **separate cooldown** from class abilities. A level 20 Crusader can use both Shield Wall (class ability) and their Divine active in the same encounter.
- Power source passives **do not overlap** with class multiplier categories. Class multipliers handle % damage/healing scaling. Power source passives handle new mechanics (lifesteal, spell echo, penetration, etc.).

---

## Natural Combinations (9)

These are the thematically expected pairings. They're designed first, in full detail, and serve as the baseline for balance.

---

### Physical × Warrior — **Warlord**

*"Strategy wins battles. Strength wins wars."*

The ultimate martial commander. No magic, no tricks — just relentless physical supremacy.

**Passive — Relentless Assault:** After landing a hit, gain a stacking +3% physical damage buff (max 5 stacks, 15%). Resets if you miss or get hit for >20% max HP.

**Active — Rallying Strike:** Your next attack deals 150% damage. If it kills the target, heal 15% max HP. Once per encounter.

---

### Physical × Ranger — **Sharpshooter**

*"One shot. One kill. Anything else is wasted effort."*

The patient sniper who turns every fight into a geometry problem.

**Passive — Steady Aim:** If you don't take damage for 2 consecutive turns, your next attack has +15% crit chance and ignores 30% of target's armor.

**Active — Killshot:** Fire a shot that deals 200% weapon damage and cannot miss. If it crits, the target bleeds for 50% of the hit over 3 turns. Once per encounter.

---

### Physical × Rogue — **Assassin**

*"Everyone has a weakness. I just find it faster."*

The classic killer. Maximum burst from the shadows.

**Passive — Exploit Weakness:** Your critical hits deal an additional 20% bonus damage (stacks with class crit multiplier).

**Active — Deathblow:** If the target is below 30% HP, deal 300% weapon damage. If above 30%, deal 150%. Once per encounter.

---

### Divine × Paladin — **Templar**

*"My faith is my fortress. My sword is my sermon."*

The archetypal holy warrior. Excels in long fights through sustained self-healing.

**Passive — Blessed Resilience:** Heal 3% of max HP at the start of each turn in combat. Does not stack with other regeneration effects (takes highest).

**Active — Judgment:** Smite the target with holy fire, dealing 175% spell damage and reducing their physical damage by 15% for 3 turns. Once per encounter.

---

### Divine × Cleric — **High Priest**

*"When I pray, something still answers."*

The most potent healer in the game. Turns faith into measurable survival.

**Passive — Faith Shield:** When your HP drops below 25%, automatically gain a shield equal to 10% of your max HP. Triggers once per encounter.

**Active — Benediction:** Heal yourself for 30% of max HP and cleanse one negative status effect. Once per encounter.

---

### Divine × Druid — **Nature's Chosen**

*"The earth remembers the gods. I listen to its memories."*

Bridges nature and divinity — the Pikel archetype. Sustained hybrid who outlasts.

**Passive — Living Earth:** Healing effects on you (from any source, including self-heals) are 20% more effective.

**Active — Bloom:** Restore 20% max HP and gain +10% damage for 3 turns. Once per encounter.

---

### Weave × Wizard — **Archmage**

*"I have studied the fabric of reality. It has flaws."*

Pure arcane supremacy. The highest sustained magical damage output.

**Passive — Spell Echo:** Your spell attacks have a 15% chance to hit twice (second hit deals 50% damage).

**Active — Arcane Surge:** Your next spell attack deals 250% damage and ignores magic resistance. Once per encounter.

---

### Weave × Warlock — **Void Channeler**

*"The void gives freely. The interest rate is your sanity."*

Dark magic amplified through arcane theory. Damage-over-time specialist.

**Passive — Siphon:** When you deal damage, heal for 8% of damage dealt. Only applies to direct spell damage, not DoTs.

**Active — Void Rift:** Deal 150% spell damage and apply a DoT that deals 30% of the hit over 4 turns. Once per encounter.

---

### Weave × Sorcerer — **Evoker**

*"The elements don't need to be asked. They need to be aimed."*

Raw elemental channeling through arcane mastery. Burst mage with combo potential.

**Passive — Elemental Attunement:** After casting a spell, your next physical attack deals bonus magic damage equal to 25% of your INT.

**Active — Overcharge:** Your next spell attack gains +30% damage and has guaranteed crit. Once per encounter.

---

## Off-Meta Combinations (18)

Off-meta combinations are designed to be **competitive but different** — not weaker versions of natural fits. Each represents a deliberate playstyle choice.

### Design Rule for Off-Meta

Off-meta passives blend the power source's theme with the class's mechanics:
- **Divine** off-meta: healing, damage reduction, self-sustain, debuff cleansing
- **Weave** off-meta: spell damage mixed into physical, mana efficiency, arcane utility
- **Physical** off-meta: penetration, stamina, self-sufficiency, raw stat amplification

---

### Divine × Warrior — **Crusader**

*"My blade is an extension of my prayer."*

A Warrior sustained by divine resilience rather than raw offense.

**Passive — Holy Endurance:** Receive 10% less damage from all sources while above 50% HP.

**Active — Consecrated Strike:** Your next melee attack deals 175% damage and heals you for 20% of damage dealt. Once per encounter.

---

### Divine × Ranger — **Warden**

*"The wild does not need taming. It needs a shepherd."*

A Ranger guided by divine purpose — protector of the natural order.

**Passive — Guiding Light:** Your ranged attacks against targets below 50% HP deal 10% bonus damage.

**Active — Sacred Arrow:** Fire a blessed arrow that deals 200% damage. If the target has a negative status effect, remove it and deal 50% bonus damage instead. Once per encounter.

---

### Divine × Rogue — **Shadow Priest**

*"The gods may be dead, but they still whisper. I listen."*

The Rogue who hears voices — and they're useful. Debuff-focused assassin.

**Passive — Whispered Warnings:** 10% chance to dodge any incoming attack (separate from AGI evasion, stacks additively).

**Active — Silence:** Strike the target for 125% damage and prevent them from using spell attacks for 2 turns. Once per encounter.

---

### Divine × Warlock — **Heretic**

*"I found the gods' secrets in the places they told us not to look."*

Forbidden intersection of faith and dark power. The ultimate self-sustaining damage dealer.

**Passive — Profane Vitality:** When you take damage, 5% of damage taken is converted to a heal applied on your next turn.

**Active — Dark Baptism:** Deal 150% spell damage and heal for 25% of damage dealt. If the target dies, the heal is doubled. Once per encounter.

---

### Divine × Wizard — **Oracle**

*"The future is written. I just have better handwriting."*

An INT caster bolstered by divine foresight. The defensive Wizard.

**Passive — Prescience:** At the start of combat, gain a shield equal to 8% of your max HP. Refreshes if it fully absorbs an attack without breaking.

**Active — Prophecy:** Predict the enemy's next move — gain guaranteed dodge against the next incoming attack, then counter with 175% spell damage. Once per encounter.

---

### Divine × Sorcerer — **Conduit**

*"The elements flow through me, blessed by something older than the Weave."*

A Sorcerer whose raw talent is amplified by divine channeling.

**Passive — Hallowed Elements:** Your spell damage ignores 10% of the target's magic resistance.

**Active — Divine Cascade:** Deal 200% spell damage. 50% chance to stun the target for 1 turn. Once per encounter.

---

### Weave × Warrior — **Spellbreaker**

*"I studied magic so I could destroy it."*

The anti-mage. A Warrior who learned arcane theory to dismantle casters.

**Passive — Arcane Resistance:** Take 15% less damage from spell attacks.

**Active — Dispelling Strike:** Deal 150% physical damage. If the target has any buffs, remove one and deal 50% bonus damage. Once per encounter.

---

### Weave × Paladin — **Arcane Guardian**

*"My shield is forged from light and logic."*

A Paladin whose protection comes from arcane barriers, not prayer.

**Passive — Mana Shield:** When you would take damage that exceeds 15% of your max HP in a single hit, reduce that hit by 15%.

**Active — Arcane Barrier:** Gain a shield equal to 20% of your max HP for 3 turns. While the shield holds, your attacks deal 10% bonus damage. Once per encounter.

---

### Weave × Ranger — **Arcanist Archer**

*"Every arrow I loose carries a spell. Efficiency."*

A Ranger who infuses projectiles with arcane energy — hybrid physical/magical damage.

**Passive — Enchanted Arrows:** Your physical ranged attacks deal an additional 15% of their damage as magic damage (uses INT scaling).

**Active — Arcane Volley:** Fire 3 enchanted arrows at the target, each dealing 75% weapon damage + 50% spell damage. Once per encounter.

---

### Weave × Rogue — **Nightblade**

*"Shadows aren't dark. They're just light, misdirected."*

The Rogue who augments stealth with illusion magic. Master of deception.

**Passive — Illusory Strikes:** Your critical hits confuse the target, reducing their hit chance by 5% for 2 turns.

**Active — Phantom Assault:** Strike the target for 175% damage. 50% chance to attack twice (roll separately). Once per encounter.

---

### Weave × Druid — **Stormcaller**

*"Nature is raw power. The Weave just helps me aim."*

A Druid who foregoes shapeshifting for elemental devastation.

**Passive — Storm's Favor:** Your spell attacks have +5% crit chance.

**Active — Tempest:** Deal 175% spell damage to the target and 75% spell damage to adjacent enemies (if multi-target combat exists). In single-target, deal 200% spell damage. Once per encounter.

---

### Weave × Cleric — **Mystic**

*"Faith is just unstructured magic. I've structured mine."*

The Cleric who understands healing as an arcane science, not a divine gift.

**Passive — Efficient Channeling:** Your healing spells heal for 10% more and your offensive spells cost less (if resource system exists; otherwise, deal 5% more damage).

**Active — Arcane Mend:** Heal for 25% of max HP. Your next attack deals bonus damage equal to 50% of the amount healed. Once per encounter.

---

### Physical × Paladin — **Vanguard**

*"I don't need a god. I need good steel and the will to stand."*

A Paladin whose protection comes from discipline and superior martial skill, not prayer.

**Passive — Iron Discipline:** Negative status effects on you have their duration reduced by 1 turn (minimum 1).

**Active — Shield Charge:** Rush the target, dealing 150% physical damage and reducing their damage by 10% for 3 turns. Once per encounter.

---

### Physical × Druid — **Beastmaster**

*"I don't become the beast. The beast becomes me."*

A Druid who channels primal ferocity through physical prowess. Less spellcasting, more claws.

**Passive — Feral Instinct:** Your physical attacks have +5% hit chance.

**Active — Savage Pounce:** Deal 200% physical damage. If this attack crits, gain +10% damage for the rest of the encounter. Once per encounter.

---

### Physical × Warlock — **Blood Mage**

*"Magic costs mana? That's for amateurs. I use something cheaper."*

A Warlock who fuels dark magic with physical endurance and life force.

**Passive — Blood Price:** Your spell attacks deal 10% more damage, but you take 3% of your max HP as self-damage per spell cast.

**Active — Blood Sacrifice:** Spend 15% of your current HP to deal 225% spell damage. If this kills the target, refund the HP. Once per encounter.

---

### Physical × Wizard — **Spellblade**

*"The pen is mightier than the sword. But a sword that writes in fire? Mightier still."*

The melee-Wizard hybrid. Closes distance and hits with magically-enhanced weapons.

**Passive — Arcane Infusion:** Your physical attacks deal an additional 10% of your INT as bonus magic damage.

**Active — Spellstrike:** Make a melee attack that deals 150% physical damage + 100% spell damage. Once per encounter.

---

### Physical × Cleric — **Battle Medic**

*"Healing is nice. Not needing healing is nicer."*

A Cleric who keeps the party alive by killing threats before they become problems.

**Passive — Triage:** When you kill an enemy, heal for 5% of your max HP.

**Active — Combat Heal:** Heal yourself for 20% of max HP and make a weapon attack at 125% damage in the same action. Once per encounter.

---

### Physical × Sorcerer — **Elementalist**

*"Fire doesn't care about spell theory. It just needs fuel. I am the fuel."*

A Sorcerer who channels elements through physical force rather than study.

**Passive — Elemental Fists:** Your physical attacks have a 15% chance to trigger bonus elemental damage equal to 20% of the hit.

**Active — Eruption:** Slam the ground (or target) for 200% hybrid damage (50% physical, 50% spell). Once per encounter.

---

## Acquisition & Progression

### When Abilities Unlock

| Level | Unlock | Details |
|-------|--------|---------|
| 1 | Power source chosen | Character creation — permanent |
| 5 | **Passive unlocks** | Automatic — no quest, no cost. It's part of who you are. |
| 10 | **Active unlocks** | Tied to class selection. When you pick your advanced class, the combination is locked in and the active becomes available. |
| 15–30 | Class abilities | Separate system (Lore Bible). Mentor quests, gold costs. |

### Why Level 5 for the Passive

- It gives power source immediate mechanical identity before class selection
- Players feel the benefit of their creation choice early
- By level 5 they understand combat enough to notice the passive working
- Creates a "first power spike" moment that reinforces investment in the character

### Why No Quest for Power Source Abilities

Class abilities (15–30) require mentor quests and gold. Power source abilities should feel different — they're **innate**. You didn't learn this from a mentor. It's how your character's power naturally manifests. The passive just appears. The active clicks into place when you choose your class.

This distinction matters narratively: class abilities are *trained*, power source abilities are *intrinsic*.

---

## Lore Integration

### The Three Sources of Power

In Noctum's Wound, where the gods are dead and magic is broken, three currents of power still flow:

**Divine** — The residue of dead gods. Faith echoes. Prayers still catch on something, even if no one's listening. Divine characters tap into the leftover channels of godly power — faith as infrastructure, long after its builders died.

*Lore hook: The Covenant (Edric's former faction) claims Divine power is proof the gods live. Cynics say it's like water running through abandoned aqueducts — the builders are dead, but gravity still works. Players with Divine power source get unique dialogue options with Edric about the nature of faith.*

**Weave** — The fabric of magic itself. Not divine, not physical — the raw substrate that gods once used to build reality. Lira studies it. Wizards channel it. The Weave is dangerous because it was never meant for mortal hands.

*Lore hook: Velith, the Weaver (dead god of fate/time), wove reality itself. Her corpse still beats once per day. Weave characters sense the threads more acutely — unique dialogue with Lira about what the Weave actually is, and whether touching it is safe.*

**Physical** — No magic. No prayer. Just the body, the weapon, the will. Physical characters reject external power sources entirely. Their power comes from within — discipline, training, and the refusal to depend on anything they can't see.

*Lore hook: Vel (former Inquisition soldier) embodies this. She doesn't trust magic. She trusts what she can hit. Physical characters get unique dialogue with Vel about self-reliance and what it means to survive without divine or arcane crutches.*

### Combination Lore

Each of the 27 combinations has its own narrative identity. Off-meta combinations are especially rich:

- **Shadow Priest (Divine Rogue):** Hears whispers from dead gods in the shadows. Not chosen by faith — haunted by it.
- **Heretic (Divine Warlock):** Found divine secrets in forbidden places. Uses prayer as a vector for dark magic.
- **Spellbreaker (Weave Warrior):** Studied magic to destroy it. Hates what they had to learn.
- **Blood Mage (Physical Warlock):** Discovered you don't need the Weave to cast — you just need to bleed enough.
- **Beastmaster (Physical Druid):** No nature magic — just understanding of beasts, earned through surviving among them.
- **Battle Medic (Physical Cleric):** Believes the best way to save people is to end the fight faster.

---

## Balance Framework

### Power Budget

Each combination gets roughly the same total combat impact:

| Component | Budget |
|-----------|--------|
| Passive | ~5–8% average DPS/sustain increase |
| Active | ~150–200% of a normal attack in value (burst + utility) |

Naturals and off-metas should average within **2% effective combat rating** of each other. The difference is HOW the power is distributed, not HOW MUCH.

### Balancing Passives

- **Flat bonuses** (e.g., +10% damage when X) are easier to balance than **conditional** ones (e.g., "if above 50% HP")
- Conditional bonuses can be numerically stronger because they have downtime
- Self-damage passives (Blood Mage) must be compensated with higher upside
- Healing passives must not make any combination immortal — cap effective HP regen

### Balancing Actives

- Once per encounter = high impact, no sustained abuse
- Actives should never be strictly better than class abilities — they occupy different niches
- "If it kills" conditionals create excitement without power creep (they reward good timing, not raw stats)

### Testing Matrix

Before shipping, every combination should be tested against:
1. Average PvE monster at-level
2. Elite PvE monster at-level
3. Mirror match (same class, different power source)
4. Counter-class PvP (e.g., Warrior vs Wizard with all 3 power source variants)

---

## UI & Player Experience

### Character Creation (Updated)

Power source descriptions should sell the fantasy, not promise mechanics:

```
Divine:
  "Something answers when you call. Not a god — the gods are dead.
   But the channels they carved still carry power. Faith persists,
   even when no one is listening."

Weave:
  "The fabric of reality has threads. Most people can't see them.
   You can. Pull the right thread and fire blooms. Pull the wrong
   one and reality unravels. Lira would tell you to be careful.
   You probably won't."

Physical:
  "No magic. No prayers. Just you — your body, your weapon, your
   will. In a world of dead gods and broken magic, there's something
   honest about relying on what you can see and hit."
```

### Level 5 — Passive Reveal

When the passive unlocks, show a moment:

```
┌─────────────────────────────────────────┐
│  Your power source stirs...             │
│                                         │
│  ⚔️  WARLORD                            │
│  Physical × Warrior                     │
│                                         │
│  "Strategy wins battles.                │
│   Strength wins wars."                  │
│                                         │
│  Passive: Relentless Assault            │
│  After landing a hit, gain stacking     │
│  +3% physical damage (max 5 stacks).    │
│                                         │
│  This is who you are becoming.          │
└─────────────────────────────────────────┘
```

### Level 10 — Active Unlock

When the player selects their advanced class and the active unlocks:

```
┌─────────────────────────────────────────┐
│  Your path is set.                      │
│                                         │
│  ⚔️  WARLORD                            │
│  Physical × Warrior                     │
│                                         │
│  Active: Rallying Strike                │
│  Your next attack deals 150% damage.    │
│  If it kills, heal 15% max HP.          │
│  Once per encounter.                    │
│                                         │
│  [USE IN COMBAT]                        │
└─────────────────────────────────────────┘
```

### Combat UI

The active ability needs a clear, accessible button during combat — separate from the attack/defend/item/flee options. Suggest a dedicated slot above or below the action bar.

### Character Sheet

Add a "Power Source" section showing:
- Combination name and flavor quote
- Passive description and current state (e.g., "Relentless Assault: 3/5 stacks")
- Active description and availability (ready / used this encounter)

---

## On-Chain Architecture

### New Tables

```
PowerSourceAbility {
  key: [characterId],
  schema: {
    characterId: bytes32,
    passive: uint8,         // enum PowerSourcePassive (1-27)
    active: uint8,          // enum PowerSourceActive (1-27)
    activeUsedThisEncounter: bool,
  }
}

PowerSourcePassiveState {
  key: [characterId],
  schema: {
    characterId: bytes32,
    stacks: uint8,          // for stacking passives (Relentless Assault, etc.)
    triggered: bool,        // for one-time passives (Faith Shield, etc.)
    bonusDamage: int256,    // accumulated bonus for next attack
  }
}
```

### New System

`PowerSourceAbilitySystem.sol`:
- `initializeAbilities(bytes32 characterId)` — called at level 5, sets passive based on power source
- `finalizeAbilities(bytes32 characterId)` — called at class selection (level 10), sets active based on power source × class
- `useActive(bytes32 characterId, bytes32 encounterId)` — validates cooldown, applies effect, marks used
- `applyPassive(bytes32 characterId, ...)` — called from CombatSystem hooks at appropriate points

### CombatSystem Hooks

The passive needs hooks in CombatSystem at these points:
- **On attack land:** Relentless Assault stacks, Triage heal, Elemental Fists proc
- **On damage taken:** Holy Endurance reduction, Profane Vitality conversion, Faith Shield trigger
- **On crit:** Exploit Weakness bonus, Illusory Strikes debuff
- **On spell cast:** Spell Echo proc, Elemental Attunement buff, Blood Price self-damage
- **On turn start:** Blessed Resilience regen, Steady Aim check
- **On kill:** Triage heal, Blood Sacrifice refund

The active is simpler — it's a dedicated action the player chooses during their turn, processed like an item use.

### Gas Considerations

- Passive hooks add reads per combat turn. Keep to 1 SLOAD per hook (read PowerSourceAbility once, cache the passive enum, branch)
- Active abilities are user-initiated — gas is expected
- State resets (stacks, triggered, activeUsed) happen at encounter start — batch into encounter initialization

---

## Implementation Phases

### Phase 1: Foundation (Ship with Class Abilities)

- Add `PowerSourceAbility` and `PowerSourcePassiveState` tables
- Implement `PowerSourceAbilitySystem` with `initializeAbilities` and `finalizeAbilities`
- Wire level 5 trigger (passive unlock) and class selection trigger (active unlock)
- Implement the **9 natural combinations** in full (passives + actives)
- Off-meta combinations get a **fallback passive** based on power source:
  - Divine fallback: +3% HP regen per turn
  - Weave fallback: +5% spell damage
  - Physical fallback: +5% physical damage
- Off-meta actives: generic power-source-themed ability
  - Divine: Heal 15% HP once per encounter
  - Weave: Next spell deals 150% damage
  - Physical: Next attack deals 150% damage
- UI: Passive reveal at level 5, active unlock at level 10, combat button

### Phase 2: Off-Meta Expansion (Content Updates)

- Design and implement 6 off-meta combinations per update (3 updates total)
- Priority order:
  1. High-contrast combos: Spellblade, Shadow Priest, Blood Mage, Spellbreaker, Heretic, Beastmaster
  2. Hybrid support: Arcane Guardian, Battle Medic, Mystic, Conduit, Warden, Arcanist Archer
  3. Specialist combos: Nightblade, Stormcaller, Elementalist, Vanguard, Evoker, Oracle
- Each update includes unique names, lore text, and per-combination balance testing
- Announce as "your power source deepens" — feels like character growth, not a patch

### Phase 3: Prestige & Specialization (Far Future)

- At level 30+, offer a **specialization choice** within your combination
- Example: Warlord can specialize in "Siege Commander" (more burst) or "Ironclad General" (more sustain)
- This creates 54+ build paths from the original 27
- Only design this after seeing how players actually use the system

---

## Open Questions

1. **Active ability in PvP:** Should power source actives be usable in PvP? They're balanced for PvE. PvP may need separate tuning or restrictions.

2. **Respec:** The manifesto says choices are permanent. Should there be an extremely expensive, one-time power source respec (10,000+ gold)? Or is "reroll a new character" the only path?

3. **Visual identity:** Should each combination have a unique visual effect in combat? (e.g., Crusader attacks glow golden, Nightblade attacks shimmer with illusion). High impact but significant art investment.

4. **Multi-target:** Several actives reference "adjacent enemies." Current combat is 1v1 turn-based. These abilities need redesigning if multi-target combat isn't planned, or should be designed as future-proof for group encounters.

5. **Passive stacking with items:** If items eventually grant similar effects (lifesteal, spell echo, etc.), do power source passives stack? Cap? Replace? Need a universal "effect category" system.

6. **Fallback pacing:** Phase 1 ships with generic fallbacks for off-meta. How long can this hold before off-meta players feel shortchanged? The answer determines Phase 2 timeline.

7. **Mentor dialogue:** Should each combination get unique mentor dialogue at class selection? ("A Physical Wizard? Lira would be fascinated. Vel would approve.") This is low-cost, high-immersion.

---

## What NOT to Build

- **Power source switching.** Permanent choice. Period.
- **Power source stat bonuses.** Stats come from race, gear, and class. Power source is about abilities, not numbers.
- **Power source restrictions on class.** Any power source can pick any class. The weird combos are features.
- **Power source tiers.** No "Divine is better than Physical." Different, never better.
- **Passive toggling.** Passives are always on. No optimization metagame around when to enable your identity.

---

## Summary

Power Source Abilities transform a flavor choice into the mechanical foundation of character identity. 27 combinations, each with a unique name, passive, and active ability. Natural fits are strong and intuitive. Off-meta combinations are equally viable and create the stories players remember.

The system respects the manifesto: choices are permanent, every build is valid, and no two characters need to be alike. A Divine Rogue who hears whispers from dead gods. A Physical Wizard who hits things with a spell-infused sword. A Weave Warlock who tears holes in reality for power.

Every character is someone's Pikel.

---

*Last updated: March 9, 2026*
