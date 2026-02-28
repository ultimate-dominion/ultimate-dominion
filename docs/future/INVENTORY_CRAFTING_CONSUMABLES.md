# Inventory, Crafting & Consumable Systems

> Future feature design document. Not for current implementation.
> Covers three interconnected systems that should ship together.

## Vision

Items are the primary progression system — representing ~60% of character power at endgame. These three systems transform items from simple stat sticks into an interconnected economy where every drop matters, every slot counts, and every discard is a bet on the future.

- **Inventory limits** create pressure: you can't keep everything
- **Crafting** gives "junk" hidden long-term value: today's Rat Tooth is tomorrow's crafting material
- **Consumables** become tactical choices: pre-buff before a boss, carry healing into combat, throw a smoke bomb mid-fight

The result: a player kills a Cave Spider, a Cracked Bone drops, their pack is full. Do they toss the Bent Nails (3 of 5 needed for Iron Scrap), leave the bone, or sell the spare Health Potion they can craft back later? That's a real decision — and it happens naturally, every session.

---

## Part 1: Inventory System

### Design Goals

- Force meaningful "what do I keep?" decisions
- Drive gold circulation through shops
- Reward players who speculate on future crafting value
- Feel like a natural part of the world, not a spreadsheet

### Carry Limit

**Unit: unique item stacks.** A stack of 50 Rat Teeth takes 1 slot. A stack of 1 Runesword takes 1 slot. This penalizes item variety, not quantity — the right pressure for a game with vendor trash and crafting materials.

**Default cap: 15 stacks.**

Typical inventory at level 5:
- 1 armor (equipped, still counts toward cap)
- 2-3 weapons (1 equipped + spares)
- 3 health potions (Minor, Health, Greater)
- 2-3 buff consumables (Stew, Berries, Tea)
- 4-6 material types from farming

That's 12-16 items — right at the edge. Good drops force hard choices.

**Equipped items count toward the cap.** Your loadout is part of your pack. Simple math, no exploits.

### Bag Upgrades

Tal Carden (the quartermaster) has a lore-defined skill: **"Efficient Packing — +2 inventory slots."** This is the expansion mechanic.

| Tier | Slots | Cost | Source |
|------|-------|------|--------|
| Default | 15 | Free | Starting |
| Efficient Packing I | 17 | 150 gold | Tal Carden |
| Efficient Packing II | 19 | 400 gold | Tal Carden |
| Efficient Packing III | 21 | 800 gold | Tal Carden |
| Traveler's Pack | 24 | Rare drop or quest | Zone 2+ |
| Adventurer's Pack | 28 | Epic drop or quest | Zone 3+ |

Gold costs are significant sinks at each level range. Later zone packs give long-term goals beyond gear.

### Overflow on Monster Drop

When a monster drops loot but the player's inventory is full:

**The drop goes to a pending claim.** The player sees "Crystal Blade dropped! Your pack is full." and gets two choices:
1. **Swap** — pick an inventory item to discard, receive the drop
2. **Leave** — the drop is lost

On-chain: a two-step flow via a `PendingDrop` table. If unclaimed after ~5 minutes, the drop expires. The swap modal shows your full inventory with discard buttons — one click to resolve.

The key moment: "A Runesword dropped but my pack is full of Cracked Bones I'm hoarding for crafting. Do I toss the bones or leave the sword?" That's emergent strategy.

### Contract Design

```
InventoryCapacity: {
  key: [characterId: bytes32],
  value: { maxSlots: uint16 }  // default 15
}

PendingDrop: {
  key: [characterId: bytes32],
  value: {
    itemId: uint256,
    amount: uint256,
    expiryBlock: uint256
  }
}
```

- Drop logic checks inventory count before minting; writes to PendingDrop if full
- `claimDrop(characterId, discardItemId)` and `abandonDrop(characterId)` resolve overflow
- Bag upgrades via Tal's skill system

### Client

- Pack counter ("13/15") in stats panel or near consumables
- Full-pack modal on drop overflow
- Tal's shop: bag upgrades alongside existing skills

---

## Part 2: Crafting System

### Design Goals

- Give every drop long-term value (vendor trash becomes crafting material)
- Create item sinks to prevent inflation (sacrifice items to make better ones)
- Drive meaningful farm loops ("I need 10 more Cracked Bones for this recipe")
- Integrate with lore NPCs (Bram the smith, Lira the alchemist)
- Reward knowledge and planning, not just grinding

### Crafting Model: Deterministic Recipes

Recipes are fixed formulas: specific input items + gold = specific output item. No randomness in what you get. Recipes must be **discovered** before they can be used.

**Why deterministic:**
- "I need 3 more Dull Crystals for my Channeling Rod upgrade" is a goal
- Random crafting is a slot machine — antithetical to the manifesto
- Players can plan, trade, and strategize around known recipes

### Recipe Discovery

Sources:
- **NPC teaching** — Bram and Lira sell basic recipes for gold
- **Monster drops** — rare recipe scrolls from specific monsters
- **Zone progression** — entering a new zone unlocks its base recipes
- **Milestones** — craft N items to unlock advanced recipes

Known recipes are stored on-chain per character.

### Recipe Tiers

**Tier 1: Material Refinement** (Lira the Alchemist)

Combine monster drops into crafting materials. This is where "trash" gets its value.

| Recipe | Inputs | Output | Gold |
|--------|--------|--------|------|
| Powdered Bone | 5 Cracked Bone | 1 Powdered Bone | 10 |
| Woven Hide | 5 Tattered Hide | 1 Woven Hide | 10 |
| Moss Extract | 5 Cave Moss | 1 Moss Extract | 15 |
| Crystal Dust | 3 Dull Crystal | 1 Crystal Dust | 20 |
| Iron Scrap | 3 Bent Nail | 1 Iron Scrap | 10 |
| Venom Sac | 5 Rat Tooth | 1 Venom Sac | 15 |

The 3-5:1 conversion rate means drops are worth keeping but you need volume. Refined materials become inputs for higher tiers.

**Tier 2: Consumable Crafting** (Lira the Alchemist)

Craft potions and buffs from refined materials. ~30-40% cheaper than shops, but requires farming.

| Recipe | Inputs | Output | Gold |
|--------|--------|--------|------|
| Minor Health Potion | 1 Moss Extract, 1 Venom Sac | 2 Minor Health Potion | 5 |
| Fortifying Stew | 1 Powdered Bone, 1 Woven Hide | 2 Fortifying Stew | 8 |
| Quickening Berries | 1 Moss Extract, 1 Crystal Dust | 2 Quickening Berries | 8 |
| Focusing Tea | 1 Crystal Dust, 1 Moss Extract | 2 Focusing Tea | 8 |
| Antidote | 2 Moss Extract, 1 Venom Sac | 1 Antidote | 15 |
| Smoke Bomb | 1 Crystal Dust, 1 Venom Sac, 1 Iron Scrap | 1 Smoke Bomb | 20 |

Self-sufficiency through crafting is a progression milestone: "I don't need to buy potions anymore, I make my own."

**Tier 3: Equipment Upgrade** (Bram the Smith)

Sacrifice lower-tier gear + materials + gold to forge higher-tier equipment.

| Pattern | Inputs | Output |
|---------|--------|--------|
| Common -> Uncommon | 2 Common (same type) + 3 Iron Scrap + 100 gold | 1 Uncommon |
| Uncommon -> Rare | 2 Uncommon (same type) + 5 Crystal Dust + 300 gold | 1 Rare |
| Rare -> Epic | 3 Rare (any type) + 10 mixed materials + 800 gold | 1 Epic |

12+ Common weapons to eventually produce 1 Epic. This is the primary item sink — combined with the carry limit, players must choose between hoarding upgrade materials and carrying useful gear.

**Tier 4: Unique Crafting** (Both NPCs, rare recipes)

Special recipes producing unique named items with lore provenance. Require materials from multiple zones and significant investment. Design per-zone as content expands.

### Salvage

Any non-material item can be salvaged at Bram's forge:
- **Common**: 1 random refined material
- **Uncommon**: 1-2 refined materials
- **Rare**: 2-3 refined materials + small gold refund
- **Epic+**: 3-5 refined materials + moderate gold refund

Gives unwanted gear a floor value. Another item sink.

### Contract Design

```
Recipes: {
  key: [recipeId: bytes32],
  value: {
    outputItemId: uint256,
    outputAmount: uint256,
    inputItemIds: uint256[],
    inputAmounts: uint256[],
    goldCost: uint256,
    npcId: bytes32,
    requiredLevel: uint16,
  }
}

KnownRecipes: {
  key: [characterId: bytes32],
  value: { recipeIds: bytes32[] }
}
```

Refined materials are regular ERC1155 items in the existing Items table — no special handling.

`CraftingSystem.sol`:
- `craft(characterId, recipeId)` — validate inputs, burn items, mint output, deduct gold
- `learnRecipe(characterId, recipeId)` — from NPC interaction or loot drop
- `salvage(characterId, itemId)` — destroy item, mint materials

### Client

- Crafting UI at Bram's and Lira's NPC locations
- Recipe book (known recipes with grayed-out undiscovered ones showing "???")
- Material counts visible when viewing a recipe
- Salvage confirmation modal

---

## Part 3: Consumable System

### Vision

Consumables are tactical tools, not just health restores. Before a tough fight, you eat Fortifying Stew for +5 STR. Mid-combat, you throw a Smoke Bomb to blind the enemy. When poisoned, you drink an Antidote. After the fight, you chug a Health Potion.

Each type has different rules about when it can be used:

| Category | World Use | Combat Use | Requires Equip | Example |
|----------|-----------|------------|----------------|---------|
| Health Potions | Yes | Yes (any time) | Only for combat | Minor Health Potion |
| Stat Buffs | Yes (pre-combat) | No | No | Fortifying Stew, Quickening Berries |
| Offensive | No | Yes (costs turn) | Yes (action slot) | Smoke Bomb |
| Curative | Yes | Yes | No | Antidote |

### Buff Consumables (World Use)

Stat buffs (+5 STR/AGI/INT) are used from inventory on the world map. No equipping required — you eat the stew, the buff applies, the item is consumed. Simple.

- Buff directly modifies character stats for a duration (e.g., 600 seconds)
- Active buffs persist into combat (they're already on the Stats table)
- Buffs expire by wall-clock time, even during combat
- Max 1 stack per effect (can't double-eat Fortifying Stew)

**Active buff display:** A buff strip showing icons + countdown timers so the player knows when effects expire.

### Health Potions (World + Combat)

Health potions restore HP instantly. Usable anywhere.

- **World:** use from inventory, no equip required
- **Combat:** must be equipped in an action slot (meaningful tradeoff — carrying a potion means one fewer weapon)
- Healing caps at max HP (no overhealing)

The equip requirement for combat potions is intentional design: "Do I fill all 4 slots with weapons for max damage, or sacrifice a slot for emergency healing?" That's a real tactical choice.

### Combat Consumables (Offensive)

Items like Smoke Bomb that affect enemies during combat. These take an action slot and cost a combat turn to use.

- Must be equipped (takes 1 of 4 action slots)
- Using one costs your turn (like an attack)
- Applies turn-based status effects (e.g., Blind: -8 AGI for 8 turns)
- Opens design space for: caltrops, throwing knives, blinding powder, etc.

### Curative Consumables

Antidotes and similar items that clear debuffs. Usable both in and out of combat without equipping.

- Clears specific status effect types (e.g., Antidote clears poison)
- No equip requirement — panic button you always have access to
- Consumes the item on use

### Contract Design

Three distinct use functions:
- `useWorldConsumable(characterId, itemId)` — buffs and healing out of combat. Applies effects directly, no equip check for buffs.
- `useCombatHealingConsumable(characterId, itemId)` — healing potions during combat. Requires equipped.
- `useCombatOffensiveConsumable(characterId, targetId, itemId)` — offensive items during combat. Requires equipped, costs a turn.
- `useCurativeConsumable(characterId, itemId)` — clears debuffs. Works in or out of combat, no equip check.

### Client

- Quick-use icon grid for consumables (current design — compact tiles with emoji, quantity badge, click to use)
- Active buff strip with countdown timers
- In-combat: equipped consumables appear as action buttons alongside weapons
- Tooltip shows effect, duration, and use restrictions

---

## NPC Integration

All three systems tie to existing lore NPCs from the Lore Bible:

**Tal Carden (Quartermaster)** — Safe zone
- Bag upgrades (Efficient Packing I/II/III)
- Trade skills (Appraisal, Bartering, Haggling)
- General goods shop

**Lira Venn (Alchemist)** — Safe zone
- Consumable crafting (Tier 1-2 recipes)
- Potion recipes and reagent sales
- *"Everything is chemistry. Love, hate, courage, fear — just chemicals."*

**Bram Ironhand (Smith)** — Safe zone
- Equipment crafting and upgrades (Tier 3-4 recipes)
- Salvage forge
- *"A blade's only as good as the arm swinging it."*

---

## Economic Impact

### Gold Sinks
- Bag upgrades: 1,350 gold total per character (150 + 400 + 800)
- Crafting costs: 5-800 gold per recipe
- Recipe purchases from NPCs

### Item Sinks
- Crafting consumes inputs (5 trash -> 1 material, 2 weapons -> 1 upgrade)
- Salvage destroys items for materials
- Inventory cap forces selling (items exit circulation, gold enters)
- 12+ Common weapons to forge 1 Epic = strong deflationary pressure

### Gold Faucets
- None added. Crafting consumes gold, it doesn't create it.

### Inflation Control
- Every crafted item destroys multiple lower items
- Monster drop materials gain floor value (crafting worth > vendor price)
- Inventory pressure drives constant shop transactions

---

## Implementation Phases

Ship incrementally. Each phase builds on the last.

### Phase 1: Inventory Limit
- `InventoryCapacity` table and cap enforcement in drop logic
- `PendingDrop` escrow for overflow
- Tal's bag upgrades
- Client: pack counter, full-pack modal

### Phase 2: Basic Crafting
- `Recipes` and `KnownRecipes` tables
- `CraftingSystem` with craft + learnRecipe
- Refined materials as new items (Tier 1)
- Consumable recipes at Lira (Tier 2)
- Client: crafting UI, recipe book

### Phase 3: Equipment Crafting & Salvage
- Equipment upgrade recipes at Bram (Tier 3)
- Salvage system
- Unique craftable items (Tier 4)
- Recipe discovery from monster drops

### Phase 4: Advanced Consumables
- Combat offensive consumable pipeline (Smoke Bomb, etc.)
- Curative consumable pipeline (Antidote)
- Combat consumable crafting recipes
- Active buff duration display

---

## Open Questions

1. **Stack quantity limits?** Should there be a max stack size (e.g., 99 per stack)? Probably fine unlimited — the carry limit on unique stacks is sufficient.

2. **Recipe tradability?** Character-bound feels right — knowledge, not an item. But recipe scrolls (the discovery items) could be tradeable.

3. **Crafting failures?** Deterministic for all tiers. Failing and losing a Rare weapon feels bad, not tense. Save RNG for drops, not crafting.

4. **Crafting XP?** No. Crafting is a means to better items, not a leveling path. Spam-crafting trash for XP would be degenerate.

5. **Multi-zone materials?** Tier 4 recipes should require materials from multiple zones. Creates cross-zone trading demand and marketplace activity. Design when Zone 2 is ready.

6. **Guild crafting?** Guild halls could have upgraded stations that reduce costs or unlock exclusive recipes. Tie into guild design when ready.
