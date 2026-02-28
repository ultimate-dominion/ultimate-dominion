# Inventory, Crafting & Consumable Systems

> Future feature design document. Not for current implementation.
> Covers three interconnected systems that should ship together.

## Context

Items represent ~60% of character power at level 50. They are the primary progression system. Currently, players can carry unlimited unique items with no constraint beyond 5 equipment slots (1 armor + 4 action). This creates no inventory pressure, no sell decisions, and no economy beyond "buy potions, sell nothing."

Three systems need to ship together because they depend on each other:
- **Inventory limits** create the pressure to sell or discard
- **Crafting** gives "trash" items hidden long-term value, making inventory decisions strategic
- **Consumable fixes** ensure the items players carry actually work

## Part 1: Inventory System

### Design Goals

- Force meaningful "what do I keep?" decisions
- Drive gold circulation through shops (sell trash for gold)
- Reward players who speculate on future crafting value
- Feel like a natural part of the world, not a spreadsheet

### Carry Limit

**Unit: unique item stacks.** A stack of 50 Rat Teeth takes 1 slot. A stack of 1 Runesword takes 1 slot. This penalizes item variety, not quantity — which is the right pressure for a game with vendor trash and crafting materials.

**Default cap: 15 stacks.**

Typical inventory at level 5 with no upgrades:
- 1 armor (equipped, still counts)
- 2-3 weapons (1 equipped + spares)
- 3 health potions (Minor, Health, Greater)
- 2-3 buff consumables (Stew, Berries, Tea)
- 4-6 trash types accumulated from farming

That's 12-16 items — right at the edge. The player has to decide what trash to keep and what to dump. Good drops force hard choices.

**Equipped items count toward the cap.** Your loadout is part of your pack. This prevents the "equip everything to bypass the cap" exploit and keeps the math simple.

### Bag Upgrades

Tal Carden (the quartermaster NPC in the safe zone) already has a lore-defined skill: **"Efficient Packing — 150 gold, +2 inventory slots."** This is the expansion mechanic.

| Tier | Slots | Cost | Source |
|------|-------|------|--------|
| Default | 15 | Free | Starting |
| Efficient Packing I | 17 | 150 gold | Tal Carden |
| Efficient Packing II | 19 | 400 gold | Tal Carden |
| Efficient Packing III | 21 | 800 gold | Tal Carden |
| Traveler's Pack | 24 | Rare drop or quest | Zone 2+ |
| Adventurer's Pack | 28 | Epic drop or quest | Zone 3+ |

Gold costs are significant gold sinks at each level range. The rare/epic packs from later zones give long-term progression goals beyond gear.

### Overflow on Monster Drop

When a monster dies and drops loot but the player's inventory is full:

**The drop goes to a pending claim.** The player sees "Runesword dropped! Your pack is full." and gets two choices:
1. **Swap** — pick an item from inventory to discard, receive the drop
2. **Leave** — the drop is lost

On-chain this is a two-step flow:
1. `PveRewardSystem` writes the pending drop to a `PendingDrop` table (characterId -> itemId, amount, expiry)
2. Player calls `claimDrop(characterId, discardItemId)` or `abandonDrop(characterId)`
3. If unclaimed after N blocks (~5 min), the drop expires automatically

The key UX moment: you kill a Cavern Brute and a Crystal Blade drops, but your pack is full of Cracked Bones. Do you toss the bones (losing future crafting materials) or leave the blade? That's a real decision.

**Auto-sell shortcut:** If the dropped item is vendor trash (no effects, rarity 0), skip the pending flow and auto-convert to gold at the shop markdown rate. Trash shouldn't trigger the full modal for 1-2 gold. The player sees "Found 1 gold" instead.

Wait — this conflicts with crafting value of trash. Better approach: **auto-discard the lowest-value item of the same type** if both the dropped item and the cheapest inventory item are vendor trash. If neither is trash, show the swap modal.

Actually, simplest: **always show the swap modal when full.** Let the player decide. The modal is fast — it's a list of what you're carrying with a "discard" button next to each. One click. The small friction of managing your pack IS the gameplay.

### Contract Changes

New MUD table:
```
InventoryCapacity: {
  key: [characterId: bytes32],
  value: {
    maxSlots: uint16,        // default 15, increases with bag upgrades
  }
}

PendingDrop: {
  key: [characterId: bytes32],
  value: {
    itemId: uint256,
    amount: uint256,
    expiryBlock: uint256,    // auto-expire after ~5 minutes
  }
}
```

Modified systems:
- `PveRewardSystem.dropItem` — check inventory count before minting, write to PendingDrop if full
- `LootManagerSystem` — add `claimDrop` and `abandonDrop` functions
- `EquipmentSystem` — add Tal's bag upgrade purchase function
- Need a view function: `getInventoryCount(characterId)` — count distinct itemIds with balance > 0 for that character's owner

### Client Changes

- Inventory count display somewhere persistent (e.g., "Pack: 13/15" near the consumable panel or in the stats panel)
- Full-pack modal when a drop triggers overflow
- Tal Carden shop: "Efficient Packing" as a purchasable upgrade alongside existing skills

---

## Part 2: Crafting System

### Design Goals

- Give vendor trash long-term value (Rat Tooth + Cave Moss + 50 gold = Minor Antidote)
- Create item sinks to prevent inflation (sacrifice items to make better ones)
- Drive meaningful farm loops (need 10 Cracked Bones for this recipe)
- Integrate with existing NPCs (Bram the smith, Lira the alchemist)
- Reward knowledge and planning, not just grinding

### Crafting Model: Recipes

Recipes are fixed formulas: specific input items + gold = specific output item. No randomness in what you get (the item is deterministic), but recipes must be **discovered** before they can be used.

**Why fixed recipes, not random crafting:**
- Deterministic outcomes let players plan and strategize
- "I need 3 more Dull Crystals for my Channeling Rod upgrade" is a goal. Random crafting is a slot machine.
- Aligns with manifesto: "stories are earned, not skipped"

### Recipe Discovery

Recipes are learned from NPCs, found as loot, or unlocked by reaching crafting milestones. A character's known recipes are stored on-chain.

Discovery sources:
- **NPC teaching** — Bram and Lira sell basic recipes for gold
- **Monster drops** — rare recipe scrolls drop from specific monsters
- **Zone progression** — entering a new zone unlocks its base recipes
- **Achievements** — craft N items to unlock advanced recipes

### Recipe Categories

**Tier 1: Material Refinement** (Lira the Alchemist)
Combine vendor trash into crafting materials. This is where trash gets its value.

| Recipe | Inputs | Output | Gold |
|--------|--------|--------|------|
| Powdered Bone | 5 Cracked Bone | 1 Powdered Bone | 10 |
| Woven Hide | 5 Tattered Hide | 1 Woven Hide | 10 |
| Moss Extract | 5 Cave Moss | 1 Moss Extract | 15 |
| Crystal Dust | 3 Dull Crystal | 1 Crystal Dust | 20 |
| Iron Scrap | 3 Bent Nail | 1 Iron Scrap | 10 |
| Venom Sac | 5 Rat Tooth | 1 Venom Sac | 15 |

These refined materials become inputs for Tier 2 and Tier 3 recipes. The conversion rate (5:1) means vendor trash is worth keeping but you need volume.

**Tier 2: Consumable Crafting** (Lira the Alchemist)
Craft potions and buff items from refined materials. Cheaper than buying from shops.

| Recipe | Inputs | Output | Gold |
|--------|--------|--------|------|
| Minor Health Potion | 1 Moss Extract, 1 Venom Sac | 2 Minor Health Potion | 5 |
| Fortifying Stew | 1 Powdered Bone, 1 Woven Hide | 2 Fortifying Stew | 8 |
| Quickening Berries | 1 Moss Extract, 1 Crystal Dust | 2 Quickening Berries | 8 |
| Focusing Tea | 1 Crystal Dust, 1 Moss Extract | 2 Focusing Tea | 8 |
| Antidote | 2 Moss Extract, 1 Venom Sac | 1 Antidote | 15 |

Crafting consumables is ~30-40% cheaper than buying them from the shop, but requires farming materials. This gives a progression feel to self-sufficiency.

**Tier 3: Equipment Upgrade** (Bram the Smith)
Sacrifice lower-tier gear + materials + gold to create higher-tier gear.

| Pattern | Inputs | Output |
|---------|--------|--------|
| Common -> Uncommon | 2 Common weapons (same type) + 3 Iron Scrap + 100 gold | 1 Uncommon weapon |
| Uncommon -> Rare | 2 Uncommon weapons (same type) + 5 Crystal Dust + 300 gold | 1 Rare weapon |
| Rare -> Epic | 3 Rare weapons (any type) + 10 mixed refined materials + 800 gold | 1 Epic weapon |

This is the primary item sink. It takes 12+ Common weapons to eventually produce 1 Epic. Combined with the carry limit, players must choose between hoarding upgrade materials and carrying useful gear.

**Tier 4: Unique Crafting** (Both NPCs, rare recipes)
Special recipes that produce unique named items with lore. These require materials from multiple zones and significant investment.

Design these per-zone as content is added. Dark Cave might have 2-3 unique craftable items that require rare drops + refined trash + substantial gold.

### Salvage

Any non-trash item can be salvaged at Bram's forge for a fraction of its crafting materials:
- **Common**: 1 random refined material
- **Uncommon**: 1-2 refined materials
- **Rare**: 2-3 refined materials + small gold refund
- **Epic+**: 3-5 refined materials + moderate gold refund

This gives unwanted gear a floor value and provides another source of crafting materials. It's also an item sink.

### Contract Changes

New MUD tables:
```
Recipes: {
  key: [recipeId: bytes32],
  value: {
    outputItemId: uint256,
    outputAmount: uint256,
    inputItemIds: uint256[],    // dynamic array
    inputAmounts: uint256[],    // dynamic array
    goldCost: uint256,
    npcId: bytes32,             // which NPC offers this recipe
    requiredLevel: uint16,
  }
}

KnownRecipes: {
  key: [characterId: bytes32],
  value: {
    recipeIds: bytes32[],       // learned recipes
  }
}

RefinedMaterials: {
  // These are just new items in the Items table — no special table needed.
  // Powdered Bone, Woven Hide, etc. are regular ERC1155 items.
}
```

New system: `CraftingSystem.sol`
- `craft(characterId, recipeId)` — validate inputs, burn input items, mint output, deduct gold
- `learnRecipe(characterId, recipeId)` — called by NPC interaction or loot drop
- `salvage(characterId, itemId)` — destroy item, mint random materials

The existing `ItemCreationSystem` in the codebase appears to be an empty placeholder — this would replace it.

### Client Changes

- Crafting UI at Bram's and Lira's NPC locations
- Recipe book (known recipes, with grayed-out undiscovered ones showing "???")
- Material counts visible when viewing a recipe
- Salvage confirmation modal

---

## Part 3: Consumable Pipeline Fixes

### Current Problems

These are bugs that should be fixed before or alongside crafting, since crafting produces consumables.

#### 1. Buff consumables require equipping to use

**Problem:** Fortifying Stew, Quickening Berries, and Focusing Tea must be equipped (taking an action slot) before consuming. The item is destroyed on use, so the slot is freed — but the equip-consume-reequip dance is pure friction.

**Root cause:** `useWorldConsumableItem` routes buff consumables through `CombatSystem.executeAction`, which checks `isEquipped(attackerId, itemId)` on line 151.

**Fix:** Add a direct buff application path in `WorldActionSystem` that bypasses `executeAction` for consumables with `validTime > 0` and `maxDamage == 0`. Read the effect from `StatusEffectStats`, apply the stat modification to the `Stats` table, and push the applied effect to `WorldStatusEffects` — same result as today, but without the equip check.

```solidity
// New path in useWorldConsumableItem for buff consumables:
if (consumableStats.maxDamage == 0 && consumableStats.minDamage == 0) {
    // Buff consumable — apply status effects directly
    for (uint256 i; i < consumableStats.effects.length; i++) {
        IWorld(_world()).UD__applyStatusEffect(receivingEntity, consumableStats.effects[i]);
    }
}
```

Client change: Remove equip requirement in `ItemConsumeModal` for buff consumables. The "Consume" button works directly from inventory.

#### 2. Smoke Bomb is non-functional

**Problem:** The blind effect has `validTurns: 8, validTime: 0` (combat-only). But `useWorldConsumableItem` requires NOT being in combat, and `useCombatConsumableItem` only allows healing items.

**Fix (short-term):** Remove Smoke Bomb from shop inventory until combat consumables are properly supported. Don't sell something that doesn't work.

**Fix (long-term):** Add `useCombatOffensiveConsumable(characterId, targetId, itemId)` to `WorldActionSystem`:
- Requires active encounter
- Applies turn-based status effects to the target
- Consumes the item
- Only allows items with `validTurns > 0` effects

This opens up the design space for future combat consumables: blinding powder, caltrops, throwing knives, etc.

#### 3. Antidote does nothing

**Problem:** Has the "basic magic heal" effect with 0/0 damage. Routes through magic damage calculation and does nothing.

**Fix:** Antidote should clear poison status effects. Add a new effect type `ClearStatusEffect` that, when applied, removes active instances of a specified debuff type. The Antidote's effect would target `poison` effects specifically.

This requires:
- New effect type in the `EffectType` enum
- Handler in `EffectsSystem` that iterates active combat/world effects and removes matching debuffs
- Update Antidote's effect reference to point to the new clear-poison effect

Until implemented, remove Antidote from shop inventory (same as Smoke Bomb).

#### 4. No buff duration display

**Problem:** After consuming a buff, there's no countdown. Player doesn't know when their +5 STR expires.

**Fix:** Add an "Active Buffs" strip to the StatsPanel (desktop) or below HP bar (mobile). Each active buff shows:
- The consumable emoji/icon
- A countdown timer (mm:ss remaining)
- Tooltip with effect details

Data is already available: `character.worldStatusEffects` contains `timestampEnd` for each active effect. The client just needs to render it.

#### 5. Slot counting mismatch

**Problem:** Client counts `weapons + spells + consumables` toward the 4-slot limit. Contract only counts `weapons + consumables`. Client is stricter.

**Fix:** Align them. Either add spells to the contract count, or remove spells from the client count. Since spells aren't currently implemented as a separate item type (they're weapon-type items), this is likely a client-side bug — remove spells from the `totalEquippedSlots` calculation in `ItemConsumeModal`.

---

## Implementation Phases

These systems are interconnected but can ship incrementally:

### Phase 0: Consumable Fixes (no new features, just bug fixes)
- Fix buff consumable equip requirement
- Disable Smoke Bomb and Antidote in shops
- Add buff duration display
- Fix slot counting mismatch
- **Scope:** 2 contract changes, 3 client changes

### Phase 1: Inventory Limit
- Add `InventoryCapacity` table and cap enforcement
- Add `PendingDrop` escrow for overflow
- Tal's "Efficient Packing" bag upgrades
- Client: pack counter, full-pack modal
- **Depends on:** Nothing. Ships standalone.

### Phase 2: Basic Crafting (Tier 1-2)
- Add `Recipes` and `KnownRecipes` tables
- `CraftingSystem` with craft + learnRecipe
- Refined materials as new items
- Consumable recipes at Lira
- Client: crafting UI, recipe book
- **Depends on:** Phase 1 (inventory limit makes materials meaningful)

### Phase 3: Equipment Crafting & Salvage (Tier 3-4)
- Equipment upgrade recipes at Bram
- Salvage system
- Unique craftable items
- Recipe discovery from monster drops
- **Depends on:** Phase 2 (needs refined material pipeline)

### Phase 4: Combat Consumables
- `useCombatOffensiveConsumable` function
- Fix Smoke Bomb, add new combat consumables
- Fix Antidote with ClearStatusEffect
- Combat consumable crafting recipes
- **Depends on:** Phase 0 (consumable pipeline fixes)

---

## NPC Integration

All three systems tie to existing lore NPCs:

**Tal Carden (Quartermaster)** — Safe zone, position (0,0)
- Sells bag upgrades (Efficient Packing I/II/III)
- Teaches basic trade skills (future: Appraisal, Bartering)
- General goods shop (existing)

**Lira Venn (Alchemist)** — Safe zone, position TBD
- Consumable crafting station
- Teaches potion recipes
- Sells reagents and base materials
- Personality: "Everything is chemistry."

**Bram Ironhand (Smith)** — Safe zone, position TBD
- Equipment crafting and upgrade station
- Salvage forge
- Teaches equipment recipes
- Personality: "A blade's only as good as the arm swinging it."

These NPCs are already defined in the Lore Bible with full characterization, dialogue style, and skill trees. They just need game mechanics attached.

---

## Economic Impact

### New Gold Sinks
- Bag upgrades: 150 + 400 + 800 = 1,350 gold per character
- Crafting costs: 5-800 gold per recipe
- Salvage has no gold cost but destroys items (indirect sink via lost item value)

### New Gold Faucets
- None. Crafting consumes gold, it doesn't create it.

### Item Sinks
- Crafting consumes input items (5 trash -> 1 material, 2 weapons -> 1 upgrade)
- Salvage destroys items for materials
- Inventory cap forces selling (gold enters from shop, items exit circulation)

### Inflation Control
- Every crafted item requires destroying multiple lower items
- 12+ Common weapons to make 1 Epic = strong deflationary pressure
- Trash items gain floor value (crafting material worth), preventing pure gold inflation from monster kills

This addresses the economics doc's planned sinks: "Crafting/Upgrading — Consumes gold + items" and "Salvage — Destroy for crafting materials."

---

## Open Questions

1. **Stack quantity limits?** Should there be a max stack size (e.g., 99 Rat Teeth per stack)? Currently unlimited. Probably fine — the carry limit on unique stacks is sufficient pressure.

2. **Recipe tradability?** Can players sell learned recipes to each other? Or are they character-bound? Character-bound feels right — it's knowledge, not an item.

3. **Crafting failures?** The design above is deterministic (craft always succeeds). Should there be a fail chance that consumes materials? Probably not for Tier 1-2. Maybe for Tier 3-4 to create tension. But failing and losing a Rare weapon feels bad. Leaning toward deterministic for all tiers.

4. **Crafting XP?** Should crafting grant character XP? Probably not — it would incentivize spam-crafting trash. Crafting is a means to better items, not a leveling path.

5. **Multi-zone materials?** Tier 4 recipes should require materials from multiple zones (e.g., Dark Cave bones + Windy Peaks feathers). This creates cross-zone trading demand and makes the marketplace more interesting. Design these when Zone 2 is ready.

6. **Guild crafting stations?** The guild design doc mentions shared resources. Guild halls could have upgraded crafting stations that reduce gold costs or unlock exclusive recipes. Tie into Phase 3+.
