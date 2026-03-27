# Lore NFT Fragments: "Fragments"

This document details the collectible lore NFTs that reveal the story setup in the Dark Cave (Zone 1).

**Implementation status**: FragmentSystem.sol is `[IMPLEMENTED]`. Minted as ERC721 NFTs. Token ID = `(fragmentType × 1,000,000) + characterTokenId`.

### Trigger Summary (from code)

| # | Fragment | Trigger | Mob ID |
|---|----------|---------|--------|
| 1 | The Awakening | First spawn | — |
| 2 | The Quartermaster | Visit shop at (9,9) | — |
| 3 | The Restless | First monster kill | — |
| 4 | Souls That Linger | Kill Dark Wisp | 13 |
| 5 | The Marrow | Reach tile (5,5) | — |
| 6 | Death of Death God | Kill Lich Acolyte | 25 |
| 7 | Betrayer's Truth | Kill Void Whisper | 22 |
| 8 | Blood Price | First PvP kill | — |

---

## Overview

Players collect **8 lore fragments** through gameplay actions. Each fragment reveals part of the core narrative: the gods are dead, murdered, and the Dark Cave is the Marrow left by Noctum's death.

### Progression

```
Fragments 1-3: "Something is wrong here"
       |
       v
Fragments 4-5: "Death doesn't work / This is a Marrow"
       |
       v
Fragments 6-7: "Gods were murdered / Noctum died first"
       |
       v
Fragment 8: "You're becoming part of this place"
```

---

## Fragment Details

### Fragment I: "The Awakening"
**Trigger:** First login / spawn at starting position

> *Your eyes open to darkness.*
>
> *Cold stone beneath you. The taste of copper in your mouth. Your body aches in ways that speak of violence you cannot remember.*
>
> *Who are you?*
>
> *The question echoes in the hollow place where your memories should be. You reach for your name, your past, your purpose—and find only shadow. Only the certainty that you were not always here. That something was taken from you.*
>
> *The cave breathes around you. Somewhere in the dark, something moves.*
>
> *You were thrown away. Left to die.*
>
> *But you haven't. Not yet.*

**Purpose:** Establishes amnesia, vulnerability, and the sense that the player was discarded.

---

### Fragment II: "The Quartermaster"
**Trigger:** First conversation with Tal

> *He's young—younger than his eyes suggest. Wild brown hair, calloused hands that still move like a baker's apprentice, not a survivor. He smiles too easily for this place.*
>
> *"You're new," he says. Not a question. "I can tell. You've still got that look—like you're waiting to wake up." A nervous laugh. "I had it too. Six months ago."*
>
> *He gestures at the meager supplies around him. "I'm Tal. I keep things organized. Count the rations. Track who's still breathing." The smile flickers. "The list gets shorter. But hey—you found me, which means you're smarter than most. Or luckier. Down here, I'm not sure there's a difference."*
>
> *He leans closer, voice dropping.*
>
> *"The ones who don't make it? They don't leave. Not really. You'll understand soon enough."*

**Purpose:** Introduces Tal, hints at the undead problem, establishes that survival is rare.

---

### Fragment III: "The Restless"
**Trigger:** Kill first Cave Rat or Rock Beetle

> *It dies.*
>
> *But something is wrong. The creature's eyes—there was no animal cunning in them. No hunger, no fear. Only a hollow compulsion, as if something else moved its limbs. Pulled its strings.*
>
> *You've killed animals before. You must have. The motion felt familiar, even if you can't remember learning it.*
>
> *This was different.*
>
> *This creature didn't want to attack you. It HAD to. Something in this place—in the walls, in the air, in the wrongness that presses against your skin—drove it forward. Forced it to fight. To die.*
>
> *And as the body stills, you swear you see something rise from it. A wisp of light. A fragment of...*
>
> *No. It's gone.*
>
> *Just your imagination.*

**Purpose:** First hint that creatures are compelled/possessed, souls are involved.

---

### Fragment IV: "Souls That Linger"
**Trigger:** Kill a Dark Wisp (Level 3)

> *It doesn't bleed. It doesn't fall.*
>
> *The wisp simply... unravels. Light bleeding into shadow, shadow into nothing. And in that final moment of dissolution, you hear it. A voice. Human. Terrified.*
>
> *"—can't find the way out I've been walking for so long please someone help me I don't remember my name I don't remember—"*
>
> *Then silence.*
>
> *These aren't monsters.*
>
> *They're people. Or they were. Souls that should have passed on, now trapped in this place. Twisted into something unrecognizable. Unable to die. Unable to move on.*
>
> *The cave doesn't let go of its dead.*
>
> *You think of your own missing memories. Your own lost name.*
>
> *How long until you become one of them?*

**Purpose:** Major revelation - monsters are trapped souls. Raises personal stakes.

---

### Fragment V: "The Marrow"
**Trigger:** Reach tile (5,5) - center of cave

> *The air changes.*
>
> *You feel it before you see it—a pressure behind your eyes, a wrongness in your bones. Reality here is thin. Frayed. Like cloth worn through by something massive pressing against it from the other side.*
>
> *The walls pulse. Not stone—something else. Something that remembers being alive.*
>
> *You understand now. This cave isn't natural. It's a scar. A marrow of the world itself, left by something's death. Something vast. Something that should not have been able to die.*
>
> *The old prayers call such places cursed. The scholars call them impossible.*
>
> *The survivors just call it what it is:*
>
> *The Marrow.*
>
> *And you are standing in its heart.*

**Purpose:** Names the phenomenon, establishes divine-scale death, creates sense of being inside something dead.

---

### Fragment VI: "Death of the Death God"
**Trigger:** Kill a Lich Acolyte (Level 7)

> *The acolyte falls, robes crumbling to dust, and the whispers finally become clear.*
>
> *It was praying. Even as it attacked you. Even as it died. Praying to something that no longer answers.*
>
> *"Noctum, Lord of Endings, guide me home. Noctum, Keeper of the Final Door, let me pass. Noctum, Noctum, NOCTUM—"*
>
> *You know that name now. You don't know how, but you do.*
>
> *Noctum. God of Death. Lord of peaceful endings and the passage between worlds.*
>
> *He was the first to fall.*
>
> *Not to age. Not to entropy. Gods don't die like that. He was MURDERED. Struck down in this very place, and his death broke the cycle he maintained. Now nothing in his domain can truly end. The dead don't pass on. Souls don't find rest.*
>
> *The god of death is dead.*
>
> *And death itself is broken.*

**Purpose:** Core revelation - names Noctum, explains why death doesn't work, confirms deicide.

---

### Fragment VII: "The Betrayer's Truth"
**Trigger:** Kill a Void Whisper (Level 6)

> *As the void whisper dissolves, images flood your mind. Not memories—something older. Echoes pressed into reality itself.*
>
> *You see them. Seven figures, vast beyond comprehension. Gods.*
>
> *One burns with golden light—Auros, whose gaze pierced all lies.*
>
> *And you see what he saw.*
>
> *A truth. Hidden at the heart of everything. Something so dangerous that the other six turned on him the moment he spoke it aloud. They killed him for it. The god of truth, silenced forever for telling the truth.*
>
> *But before he fell, he struck first. Noctum—the most dangerous of them in his own way—died by Auros's hand.*
>
> *A god who kills a god. A truth worth dying to hide.*
>
> *The vision fades. But the question remains:*
>
> *What did Auros see?*

**Purpose:** Reveals Auros killed Noctum, but was then killed by the others. Plants the central mystery.

---

### Fragment VIII: "Blood Price"
**Trigger:** First PvP kill

> *They fall.*
>
> *A real person. Not a monster. Not a tormented soul. Someone like you—thrown into this pit, fighting to survive, dreaming of escape.*
>
> *You killed them.*
>
> *In another place, this would mean something. Guards would come. Justice would follow. Here, in Noctum's Marrow, there is no justice. No law. Only survival.*
>
> *You wait for guilt. For horror. For the weight of what you've done.*
>
> *Instead, you feel the cave's attention shift toward you. Approving. Hungry.*
>
> *This place was made by murder. Divine murder. And now you've added to its collection. Paid its toll in the only currency it accepts.*
>
> *The victim will return. Death is broken here. But you've learned something about yourself:*
>
> *When survival demands it, you're capable of anything.*
>
> *The cave already knew. Now you do too.*

**Purpose:** Darkest fragment - makes the player complicit, connects their violence to the gods' violence.

---

## Summary Table

| # | Fragment | Trigger | Key Revelation |
|---|----------|---------|----------------|
| 1 | The Awakening | First spawn | You have amnesia, were discarded |
| 2 | The Quartermaster | Talk to Tal | Others have died here, you're not alone |
| 3 | The Restless | First monster kill | Creatures are compelled, not willing |
| 4 | Souls That Linger | Kill Dark Wisp | Monsters are trapped human souls |
| 5 | The Marrow | Reach center (5,5) | This place is a divine death-scar |
| 6 | Death of the Death God | Kill Lich Acolyte | Noctum (death god) was murdered, death is broken |
| 7 | The Betrayer's Truth | Kill Void Whisper | Auros killed Noctum, then was killed for a secret truth |
| 8 | Blood Price | First PvP kill | You're capable of the same violence that made this place |

---

## UI/UX Design

### Core Concept: Impressions

When a trigger condition is met, an **Impression** appears on the player's current tile. These are fragments of memory pressed into reality by the Marrow, waiting to be absorbed. The Impression appears as a glowing, ethereal wisp that pulses with soft light.

### Interaction Flow

```
1. Player is on tile (e.g., 5,5)
2. Trigger happens (reach tile, kill monster, talk to NPC)
3. Impression appears on THAT SAME TILE (player is already there)
4. Player clicks Impression → Modal opens
5. Player claims → NFT minted, modal closes
6. Impression disappears permanently (never shows again for this player)
```

### Tile Placement Per Trigger

| Trigger | Impression Appears On | When |
|---------|-----------------|------|
| First spawn | Tile (0,0) - spawn point | Immediately on first game load |
| Talk to Tal | Tile (9,9) - Tal's tile | After closing shop UI |
| First monster kill | Tile where monster died | After combat resolves |
| Kill Dark Wisp | Tile where Dark Wisp died | After combat resolves |
| Reach (5,5) | Tile (5,5) | When player steps onto tile |
| Kill Lich Acolyte | Tile where Lich Acolyte died | After combat resolves |
| Kill Void Whisper | Tile where Void Whisper died | After combat resolves |
| First PvP kill | Tile where enemy player died | After PvP resolves |

### Visual on the Board

```
BEFORE TRIGGER:                    AFTER TRIGGER:
┌─────────────────┐                ┌─────────────────┐
│                 │                │                 │
│       P         │   Kill rat     │      P ✦        │
│                 │   ─────────►   │                 │
│    (5,5)        │                │    (5,5)        │
└─────────────────┘                └─────────────────┘

Player and Impression both on same tile - Impression is clickable
```

### Board Interaction

When Impression appears on player's tile:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   [ Game Board ]                                            │
│                                                             │
│        Player standing on tile                              │
│        Impression visible on same tile                      │
│                                                             │
│   ┌─────────────────────────────────────┐                   │
│   │  ✦ Impression      [Click to view]  │  ← Clickable      │
│   └─────────────────────────────────────┘    overlay/button │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Claim Modal

When player clicks the Impression:

```
┌─────────────────────────────────────────────────────────────┐
│                                                        [X]  │
│                                                             │
│                    ╔═══════════════════╗                    │
│                    ║   [ARTWORK]       ║                    │
│                    ╚═══════════════════╝                    │
│                                                             │
│              ─── Fragment V of VIII ───                     │
│                   « THE MARROW »                            │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  The air changes.                                     │  │
│  │                                                       │  │
│  │  You feel it before you see it—a pressure behind      │  │
│  │  your eyes, a wrongness in your bones...              │  │
│  │                                              scroll ▼ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│              ┌─────────────────────────┐                    │
│              │   ✦ CLAIM FRAGMENT ✦    │                    │
│              └─────────────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

After claim → Modal closes, Impression gone forever.

---

### Character Page: Fragment Collection

Add a "Fragments" section to the character page:

```
┌─────────────────────────────────────────────────────────────┐
│  CHARACTER                                                  │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  [Avatar]    CRYPTOKNIGHT                                   │
│              Level 7 Warrior                                │
│              STR: 24  AGI: 18  INT: 12                      │
│                                                             │
│─────────────────────────────────────────────────────────────│
│  EQUIPMENT                                                  │
│  ┌────────┐ ┌────────┐ ┌────────┐                          │
│  │ Weapon │ │ Armor  │ │ Access │                          │
│  └────────┘ └────────┘ └────────┘                          │
│                                                             │
│─────────────────────────────────────────────────────────────│
│  FRAGMENTS                                      5/8        │
│                                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│  │ ✦I  │ │ ✦II │ │✦III │ │ ✦IV │ │ ✦V  │ │ ?VI │ │?VII │ │?VIII│
│  │     │ │     │ │     │ │     │ │     │ │     │ │     │ │     │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘
│   ✓       ✓       ✓       ✓       ✓       ○       ○       ○    │
│                                                             │
│  ✦ = Claimed (click to re-read)    ? = Undiscovered        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Re-reading a Claimed Fragment

Clicking a claimed fragment on the character page:

```
┌─────────────────────────────────────────────────────────────┐
│                                                        [X]  │
│                                                             │
│                    ╔═══════════════════╗                    │
│                    ║   [ARTWORK]       ║                    │
│                    ╚═══════════════════╝                    │
│                                                             │
│              ─── Fragment I of VIII ───                     │
│                  « THE AWAKENING »                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Your eyes open to darkness...                        │  │
│  │                                              scroll ▼ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│              ┌─────────────────────────┐                    │
│              │    ✓ CLAIMED            │  ← No action,      │
│              └─────────────────────────┘    just display    │
│                                                             │
│    Claimed on: Jan 30, 2026                                 │
│    Token ID: #4521                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Hovering an Undiscovered Fragment

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────┐                                                    │
│  │?VII │  ──►  ┌────────────────────────────────────────┐   │
│  │     │       │ "The void remembers what others        │   │
│  └─────┘       │  forget..."                            │   │
│                │                                        │   │
│                │ Hint: Defeat a Void Whisper            │   │
│                └────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Fragment Hints (for undiscovered)

| Fragment | Hint Text |
|----------|-----------|
| I - The Awakening | "Where did you first open your eyes?" |
| II - The Quartermaster | "Seek the one who counts the living..." |
| III - The Restless | "Even the smallest creature holds a secret..." |
| IV - Souls That Linger | "Seek the souls that glow with unnatural light..." |
| V - The Marrow | "The heart of the cave holds secrets..." |
| VI - Death of the Death God | "Those who served death in life still pray..." |
| VII - The Betrayer's Truth | "The void remembers what others forget..." |
| VIII - Blood Price | "Some knowledge comes only through blood..." |

### State Summary

| State | On Board | On Character Page |
|-------|----------|-------------------|
| **Not triggered yet** | Nothing shown | `?` with hint on hover |
| **Triggered, not claimed** | Impression visible on tile | `?` (still undiscovered until claimed) |
| **Claimed** | Impression never appears again | `✦` clickable to re-read |

---

## Future Zones

The other three core survivors will be introduced in subsequent zones:

| Zone | Level Range | Survivor NPC | Role |
|------|-------------|--------------|------|
| Dark Cave | 1-10 | Tal (The Quartermaster) | Shop/Supplies |
| Zone 2 (TBD) | 11-20 | Vel (The Blade) | Combat Training |
| Zone 3 (TBD) | 21-30 | Edric (The Mender) | Healing/Faith |
| Zone 4 (TBD) | 31-40 | Senna (The Broker) | Intelligence/Secrets |

Each zone will have its own set of lore fragments revealing more about the dead gods and the central mystery.

---

---

# Zone 2: Windy Peaks — Fragment Chains (IX-XVI)

## Overview

Zone 2 upgrades from Z1's simple triggers to **multi-step chained quests**. Each fragment requires 2-4 sequential actions using varied verbs (kill, explore, talk, find, survive, examine). Players pursue truth through action rather than stumbling into it.

**8 fragments** organized into **3 narrative chains**:

```
PEAKS CHAIN ──── Fragment IX: "The Ascent" (arrival, 1 step)
    │
    └──────────── Fragment XVI: "The Wind's Memory" (capstone, 3 steps, requires 4+ Z2 frags)

VEL CHAIN ────── Fragment X: "Vel's Warning" (2 steps)
    │                 │
    │            Fragment XI: "The Orders" (2 steps)
    │                 │
    │            Fragment XII: "What She Left Behind" (3 steps)

EDRIC CHAIN ──── Fragment XIII: "The Shrine" (3 steps)
    │                 │
    │            Fragment XIV: "The Heretic's Question" (2 steps)
    │                 │
    │            Fragment XV: "Bones of Faith" (3 steps)
```

### Trigger Summary

| # | Fragment | Chain | Steps | Trigger Sequence |
|---|----------|-------|-------|------------------|
| IX | The Ascent | Peaks | 1 | TileVisit (zone spawn) |
| X | Vel's Warning | Vel | 2 | NpcInteract (Vel) → CombatKill (Covenant Scout) |
| XI | The Orders | Vel | 2 | CombatKill (Covenant Tracker) → NpcInteract (Vel) |
| XII | What She Left Behind | Vel | 3 | TileVisit (camp) → NpcInteract (camp journal) → NpcInteract (Vel) |
| XIII | The Shrine | Edric | 3 | TileVisit (shrine) → CombatKill (Fraying Guardian) → NpcInteract (shrine inscriptions) |
| XIV | The Heretic's Question | Edric | 2 | NpcInteract (Edric) → NpcInteract (Edric at shrine) |
| XV | Bones of Faith | Edric | 3 | TileVisit (ossuary) → CombatKill (Ossuary Guardian) → NpcInteract (Edric) |
| XVI | The Wind's Memory | Peaks | 3 | TileVisit (summit) → CombatKill (Gale Fury) → NpcInteract (summit stone) |

### Quest Items

| Item | Drops From | Fragment | Step | Type |
|------|-----------|----------|------|------|
| Sealed Letter | Covenant Tracker kill | XI | 0 | QuestItem (permanent memento) |
| Last Sermon | Ossuary Guardian kill | XV | 1 | QuestItem (permanent memento) |

---

## PEAKS CHAIN

### Fragment IX: "The Ascent"
**Chain steps:** 1 (simple trigger — bridge from Z1's system)
**Trigger:** TileVisit — arrive at Windy Peaks spawn point (auto-completes on zone entry)

> *Light.*
>
> *It hits you like a fist. After weeks — months? — in Noctum's Marrow, your eyes have forgotten what light is. You stagger, blinded, hands up against something you once took for granted.*
>
> *Then the wind.*
>
> *It screams across the ridge, tearing at your clothes, your hair, the parts of you that were starting to feel safe. The cave was a prison. This is a precipice.*
>
> *You force your eyes open.*
>
> *The sky stretches forever — but it's wrong. At the edges, colors bleed into each other like wet paint, and the horizon shimmers in a way that makes your stomach lurch. The Fraying. You can see it from here. The world's edges are coming undone.*
>
> *Below you, the peaks descend in jagged steps — ancient stairs carved for something larger than humans. Ruins cling to the cliff faces like barnacles, their windows dark, their doors long gone. Someone built here, once. Someone who isn't here anymore.*
>
> *The wind shifts. For a moment, just a moment, it sounds like a name.*
>
> *Yours?*
>
> *No. Someone else's. Someone who stood here before you.*

**Purpose:** Transition from Z1's claustrophobia to Z2's exposure. Establishes the Fraying as visible, the ruins as ancient, and the wind as almost alive. Celebration moment for surviving the Dark Cave.

---

### Fragment XVI: "The Wind's Memory"
**Prerequisite:** 4+ other Z2 fragments claimed
**Chain steps:** 3

1. **TileVisit:** Reach the Summit tile (highest point on the map)
2. **CombatKill:** Survive the Gale Fury (environmental combat mob, level 18)
3. **NpcInteract:** Examine the Summit Stone (world object)

> *The stone is ancient. Older than the ruins. Older than the stairs.*
>
> *Names. Thousands of them, carved in hands steady and shaking, in scripts you recognize and scripts that died with their speakers. This was a pilgrimage site. People climbed here to leave their mark before descending into the Marrow below. Willingly.*
>
> *Your eyes scan the stone. So many names. So many who came before.*
>
> *Then you see it.*
>
> *Near the bottom. Fresh, compared to the others. The carving is confident, precise — someone who knew how to hold a chisel. And the handwriting...*
>
> *It's yours.*
>
> *You don't remember carving it. You don't remember climbing here. You don't remember choosing to descend into Noctum's grave. But your hand made this mark. You came here on purpose.*
>
> *You weren't thrown away.*
>
> *You walked in.*
>
> *Why?*

**Purpose:** Capstone revelation for Z2. Completely reframes the player's origin story. Fragment I said "you were thrown away." Fragment XVI says: no, you chose this. The mystery deepens — why would anyone voluntarily enter a dead god's Marrow?

---

## VEL CHAIN

### Fragment X: "Vel's Warning"
**Prerequisite:** Fragment IX claimed
**Chain steps:** 2

1. **NpcInteract:** Talk to Vel (at her ridge position)
2. **CombatKill:** Kill a Covenant Scout (level 13, spawns near Vel's position)

> *Vel doesn't look at the body.*
>
> *"He's the first. He won't be the last." She cleans her blade on the dead man's cloak with the practiced efficiency of someone who's done it a thousand times. "The Inquisition doesn't send one. They send one to confirm, then they send the rest."*
>
> *She finally looks at you. Really looks. For the first time, you see something behind the ice.*
>
> *Fear.*
>
> *Not of the Covenant. Not of fighting. Something older.*
>
> *"I served them. For twelve years. I was their Third Blade — you don't know what that means and you don't want to. When I left, I didn't just desert. I took something. Proof of what they did. What they're still doing."*
>
> *She looks back at the paths below.*
>
> *"They're not here for justice. They're here to make sure the proof dies with me."*

**Purpose:** Vel's ice cracks. The Covenant is real, organized, and present. Establishes the chain's stakes: Vel has evidence of Covenant atrocities.

---

### Fragment XI: "The Orders"
**Prerequisite:** Fragment X claimed
**Chain steps:** 2

1. **CombatKill:** Kill a Covenant Tracker (level 15, drops **Sealed Letter** quest item)
2. **NpcInteract:** Bring the Sealed Letter to Vel

> *She breaks the seal without hesitation. Her eyes move across the words. Her face doesn't change — but her hands do. The left one tightens on the letter. The right one drops to her sword.*
>
> *"Seraph Morrow," she says. Her real name, spoken like a curse. "Covenant Inquisition, Third Blade, Auros Division. Wanted for: desertion, theft of sealed records, murder of Inquisitor Dalhan..."*
>
> *She pauses.*
>
> *"...and the unauthorized release of classified intelligence regarding the Cleansing of Thornfield."*
>
> *She looks up. Her eyes are dry. Her voice is not.*
>
> *"Thornfield was a village. Three hundred people. The Covenant said they were harboring heretics — people who claimed the gods were dead. The Inquisition sent us to 'cleanse' the heresy." She folds the letter, precisely, along the creases. "There were no heretics. There were farmers. And children. And I followed orders."*
>
> *"The proof I took? It's the kill roster. Every name. Every age. Every 'heretic' we murdered. The youngest was four."*
>
> *She puts the letter in her belt.*
>
> *"Terminate with prejudice. Signed by Commander Lias Coryn." A ghost of something crosses her face. "He taught me to fight. He was the closest thing I had to a father."*

**Purpose:** The gut punch. Vel's real name, her real crime (she stole evidence of a massacre), and the personal betrayal (her mentor signed her death warrant).

---

### Fragment XII: "What She Left Behind"
**Prerequisite:** Fragment XI claimed
**Chain steps:** 3

1. **TileVisit:** Reach the abandoned Covenant camp tile
2. **NpcInteract:** Examine the camp journal (world object)
3. **NpcInteract:** Talk to Vel (at her new position)

> *The journal belonged to one of her squad. Someone who stayed. The entries are clinical — supply counts, patrol routes, target descriptions. But near the end, the handwriting changes. Smaller. Shakier.*
>
> *"Seraph was the best of us. She made it look easy. I watched her walk away and I envied her. I still had the stomach for it. I wish I didn't."*
>
> *You bring the journal to Vel. She reads the entry. Then reads it again.*
>
> *For a long time, she says nothing. The wind fills the silence.*
>
> *"I thought about going back. Not to the Covenant — to Thornfield. To stand in the ashes and... I don't know. Apologize to ghosts." Her jaw tightens. "But ghosts don't need apologies. The living do."*
>
> *She hands the journal back to you.*
>
> *"Keep it. Someone should remember what they did. If the proof dies with me, keep the journal. Tell people what happened at Thornfield. Tell them it was real."*
>
> *She turns toward the wind.*
>
> *"I can't undo it. But I can make sure it doesn't end quietly."*

**Purpose:** Vel moves from running to standing. The journal humanizes her former squad. The Covenant's evil is institutional, not cartoon.

---

## EDRIC CHAIN

### Fragment XIII: "The Shrine"
**Prerequisite:** Fragment IX claimed
**Chain steps:** 3

1. **TileVisit:** Discover the ruined shrine tile
2. **CombatKill:** Kill the Fraying-touched Guardian (level 16)
3. **NpcInteract:** Examine the shrine inscriptions (world object)

> *The shrine is to Korrath. God of war. His symbol — a sword through a shield — is carved above the entrance, cracked but legible.*
>
> *But the prayers carved into the walls aren't what you expected.*
>
> *"Korrath, Lord of Duty, grant us the wisdom to put down our swords."*
>
> *"Korrath, Keeper of Sacrifice, let this be the last war."*
>
> *"Korrath, we are tired. Let it end."*
>
> *The god of war's worshippers prayed for peace. Not victory. Not glory. Peace.*
>
> *On the altar, scratched in frantic letters, a final message: "He heard us. He put down his sword. And they killed him for it."*
>
> *Korrath didn't fall in battle. He chose to stop fighting. And the other gods couldn't allow that.*
>
> *A god of war who chose peace.*
>
> *They murdered him for it.*

**Purpose:** Reframes a god's death. Korrath is tragic — he tried to change and was killed for it. Complicates the "gods were murdered" narrative from Z1.

---

### Fragment XIV: "The Heretic's Question"
**Prerequisite:** Fragment XIII claimed
**Chain steps:** 2

1. **NpcInteract:** Talk to Edric (he agrees to go to the shrine)
2. **NpcInteract:** Meet Edric at the shrine (he appears there, prayer triggers)

> *Edric kneels at the altar. You expect the usual — the rote Covenant prayers, the formulaic devotions. Instead, he's quiet for a long time.*
>
> *Then:*
>
> *"I don't know who I'm talking to. I used to. I used to know exactly who heard me and I used to believe they cared. Now I know they're dead and I should stop."*
>
> *His voice is steady. His hands are not.*
>
> *"But I can't. Because something answered. Sometimes. In the Marrow, when I prayed over the dying, their pain eased. Not always. But sometimes. If the gods are corpses, what eased their pain? If nothing hears prayer, why did it work?"*
>
> *He presses his forehead to the stone.*
>
> *"Please. I'm not asking for a miracle. I'm asking for honesty. Is anyone there?"*
>
> *Silence.*
>
> *Then — the shrine warms. Not visibly, not dramatically. No golden light. No voice from heaven. Just... warmth. Like a hand on a shoulder. Like being remembered.*
>
> *Edric's eyes open. He doesn't smile. He doesn't cry.*
>
> *"That's not an answer," he whispers.*
>
> *"But it's not nothing."*

**Purpose:** The emotional core of Z2. Something happened. Was it divine? Residual god-energy? The Fraying? The game never says.

---

### Fragment XV: "Bones of Faith"
**Prerequisite:** Fragment XIV claimed
**Chain steps:** 3

1. **TileVisit:** Discover the Ossuary tile
2. **CombatKill:** Kill the Ossuary Guardian (level 17, drops **Last Sermon** quest item)
3. **NpcInteract:** Bring the Last Sermon to Edric

> *Edric reads the tablet slowly. His lips move. His eyes widen.*
>
> *"Brother Aldain. He was the last keeper of this shrine. He wrote this knowing no one might ever read it."*
>
> *He translates aloud:*
>
> *"The gods are dying. I have seen the proof. Korrath fell here, in this place, and his Marrow spreads through the stone beneath our feet. I should despair. Every teaching says I should. The foundations of my faith are corpses."*
>
> *Edric pauses. Swallows.*
>
> *"But I have seen something the teachings did not prepare me for. The gods can die. They did die. And yet — the world continues. Broken, yes. Fraying, yes. But continuing. If divinity is not eternal, then divinity is not what we were told. And if mortals outlive gods..."*
>
> *His voice cracks.*
>
> *"...then perhaps we were always the miracle."*
>
> *He sets the tablet down carefully. His hands have stopped shaking.*
>
> *"I'm going to stop praying to corpses," he says. And then, with the ghost of a smile: "I'm going to start praying to us."*

**Purpose:** Edric's crisis resolves into something new. Sets up his Z3 arc: founding a new spiritual movement. Connection to Vel: Brother Aldain references the Covenant suppressing god-death truth — the same suppression that led to Thornfield.

---

## What Changed From Z1

| | Z1 (Dark Cave) | Z2 (Windy Peaks) |
|---|---|---|
| **Triggers** | Single action | Multi-step chains (2-4 steps) |
| **Verbs** | Kill, reach, spawn, PvP | Kill, explore, talk, escort, find, survive, examine |
| **NPC involvement** | Tal (1 fragment) | Vel (3 fragments), Edric (3 fragments) |
| **Narrative** | Standalone revelations | Interlocking character arcs |
| **Player agency** | Stumble into truth | Pursue truth through action |
| **Quest items** | None | Sealed Letter, Last Sermon (permanent mementos) |
| **Cross-chain connection** | None | Vel and Edric chains share thematic revelation |

---

## Z2 UI/UX: Chain Progress

### On the Game Board

The **FragmentChainProgress** panel (StatsPanel, left side) shows chain completion:

```
┌─────────────────────────────────────────────────┐
│  FRAGMENTS IX-XVI                    3/8        │
│                                                  │
│  THE PEAKS                                       │
│  IX  The Ascent          ● ✓                     │
│  XVI The Wind's Memory   ○ ○ ○  🔒 (4+ frags)  │
│                                                  │
│  VEL'S SHADOW                                    │
│  X   Vel's Warning       ● ● ✓                  │
│  XI  The Orders          ◉ ○     ← current      │
│  XII What She Left Behind ○ ○ ○                  │
│                                                  │
│  EDRIC'S TRIAL                                   │
│  XIII The Shrine         ○ ○ ○                   │
│  XIV  The Heretic's Q.   ○ ○                     │
│  XV   Bones of Faith     ○ ○ ○                   │
│                                                  │
│  Current objective:                              │
│  "Kill a Covenant Tracker"                       │
└─────────────────────────────────────────────────┘
```

### Quest Items in Inventory

New section on Character page after Consumables:

```
┌─────────────────────────────────────────────────┐
│  QUEST ITEMS                                     │
│                                                  │
│  ┌──────────────────────────────────┐            │
│  │ 📜 Sealed Letter                │            │
│  │ Rarity: Uncommon                │            │
│  │ "Terminate with prejudice.      │            │
│  │  Signed: Commander Lias Coryn"  │            │
│  └──────────────────────────────────┘            │
│                                                  │
│  ┌──────────────────────────────────┐            │
│  │ 📜 Last Sermon                  │            │
│  │ Rarity: Uncommon                │            │
│  │ "If mortals outlive gods, then  │            │
│  │  perhaps we were always the     │            │
│  │  miracle."                      │            │
│  └──────────────────────────────────┘            │
└─────────────────────────────────────────────────┘
```

### Fragment Hints (for undiscovered Z2)

| Fragment | Hint Text |
|----------|-----------|
| IX - The Ascent | "The light awaits beyond the Marrow..." |
| X - Vel's Warning | "The Blade watches from the ridgeline..." |
| XI - The Orders | "Covenant hunters carry sealed orders..." |
| XII - What She Left Behind | "An abandoned camp holds a soldier's confession..." |
| XIII - The Shrine | "A god of war's shrine stands in the peaks..." |
| XIV - The Heretic's Question | "The Mender seeks answers at the altar..." |
| XV - Bones of Faith | "The dead kept their faith longer than the living..." |
| XVI - The Wind's Memory | "The summit remembers everyone who climbed..." |

---

## Technical Implementation

### Smart Contract Architecture

**Fragment chain system** (`FragmentChainSystem.sol`):
- `tryAdvanceChain(characterId, fragmentType, triggerType, triggerData)` — validates and advances chain steps
- `setChainStep(fragmentType, stepIndex, triggerType, triggerData, narrative)` — admin config
- `initializeCharacterChain(characterId, fragmentType, totalSteps)` — called on zone entry
- Trigger types: `TileVisit(0)`, `CombatKill(1)`, `NpcInteract(2)`

**Tables:**
- `FragmentChainProgress` (characterId + fragmentType) → currentStep, totalSteps, completed
- `FragmentChainStep` (fragmentType + stepIndex) → triggerType, triggerData, narrative
- `FragmentChainStepReward` (fragmentType + stepIndex) → rewardItemId (quest item drops)

**Token ID generation:** Same as Z1: `tokenId = fragmentType * 1_000_000 + characterTokenId`

**Zone entry:** `ZoneTransitionSystem.transitionZone()` initializes all 8 Z2 chains and auto-completes Fragment IX.

**Fragment XVI prerequisite:** `tryAdvanceChain()` checks if 4+ of fragments IX-XV are claimed before allowing advancement.

---

*Last updated: March 27, 2026*
