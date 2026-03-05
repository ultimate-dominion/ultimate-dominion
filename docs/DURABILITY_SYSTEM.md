# Item Durability System

Design document for the item durability and repair system — a core gold sink and item destruction mechanic.

---

## Purpose

Durability serves two economic functions:
1. **Gold sink**: Repair costs permanently remove gold from circulation
2. **Item sink**: Items that aren't repaired are destroyed, maintaining long-term scarcity

Without item destruction, "rare" items flood the market over time. Durability is the primary mechanism that makes the items-as-value-store thesis work (see `ECONOMICS.md`).

---

## Table Schema

```
ItemDurability {
  key: [itemId]
  maxDurability: uint256    -- maximum durability for this item type
  currentDurability: uint256 -- current durability (0 = broken)
}
```

**Status**: Table defined in `mud.config.ts`, codegen complete. Not yet populated or enforced.

---

## Which Items Have Durability

| Item Type | Has Durability | Rationale |
|-----------|---------------|-----------|
| Weapon | Yes | Core equipment, used every combat round |
| Armor | Yes | Core equipment, takes hits every round |
| Accessory | Yes | Equipped gear, passive wear |
| Spell | No | Spells are knowledge, not physical objects |
| Consumable | No | Already destroyed on use |
| Quest Item | No | Needed for progression, shouldn't break |

---

## Durability Values

Durability should scale with item rarity — rarer items last longer, giving players more time before needing repair.

| Rarity | Max Durability | Approx. Combats Before Broken |
|--------|---------------|-------------------------------|
| Common | 50 | ~50 |
| Uncommon | 75 | ~75 |
| Rare | 100 | ~100 |
| Very Rare | 150 | ~150 |
| Legendary | 200 | ~200 |
| Unique | 300 | ~300 |

*These values assume 1 durability lost per combat. Actual loss rate TBD during testing.*

---

## Durability Loss

### When Durability Decreases
- **Weapon**: -1 durability per combat encounter (PvE or PvP), regardless of outcome
- **Armor**: -1 durability per combat encounter
- **Accessory**: -1 durability per combat encounter (if equipped)

### When Durability Does NOT Decrease
- Fleeing before combat starts (no attacks exchanged)
- Using consumables
- Casting spells
- Walking, shopping, trading

### At Durability = 0 (Broken)
- Item remains in inventory but **cannot be equipped**
- If currently equipped when it breaks, it is **automatically unequipped** at end of combat
- Stat bonuses from broken items do not apply
- Broken items can still be traded on the marketplace (buyers see durability)
- Broken items can be repaired at a shop

**Design choice**: Items are NOT destroyed at 0 durability — they become unusable until repaired. Permanent destruction only happens if the player chooses to salvage/disenchant (future system) or loses it in PvP.

---

## Repair System

### Where
- Any NPC shop that sells equipment
- Future: dedicated Blacksmith NPC with better rates

### Cost Formula
```
repairCost = (item.price * durabilityLost * REPAIR_COST_PERCENT) / (maxDurability * 100)
```

Where `REPAIR_COST_PERCENT` is a tunable constant (recommended: **10–20%** of item value for full repair).

Example: A rare sword worth 500 gold, max durability 100, currently at 30:
- Durability lost: 70
- At 15% rate: `(500 * 70 * 15) / (100 * 100)` = **52.5 gold** to fully repair

### Repair Behavior
- Player can repair to full — no partial repair needed
- Gold is **permanently burned** (not sent to shop)
- Repair restores `currentDurability` to `maxDurability`

### Repair as Gold Sink — Projections

Assuming 20 concurrent players, avg level 9, 40 kills/hour:

| Scenario | Daily Repair Gold Burned |
|----------|------------------------|
| Conservative (players repair at 20%) | ~15,000 gold |
| Moderate (players repair at 40%) | ~25,000 gold |
| Aggressive (players let items break often) | ~35,000 gold |

This represents **6–15%** of daily gold generation (~240K/day), making it a meaningful but not punishing sink.

---

## Implementation Plan

### Phase 1: Table + Data (Can deploy now)
- [x] Add `ItemDurability` table to `mud.config.ts`
- [x] Run `tablegen`
- [ ] Deploy table to beta via `mud deploy --worldAddress`
- [ ] Write migration script: set `maxDurability` and `currentDurability` for all existing weapons, armor, and accessories based on rarity
- [ ] Update `ItemCreationSystem.createItem()` to set durability on new items

### Phase 2: Durability Loss (Combat integration)
- [ ] Create `DurabilitySystem` (new system — **do NOT add to EncounterSystem**, it's at 24KB limit)
- [ ] `DurabilitySystem.deductDurability(characterId)`: reduces durability by 1 for all equipped weapon/armor/accessories
- [ ] Call `DurabilitySystem.deductDurability()` from `EncounterSystem` after combat resolves (single external call, minimal bytecode impact)
- [ ] Handle auto-unequip when item breaks mid-combat
- [ ] Grant `DurabilitySystem` access to Items namespace

### Phase 3: Repair System
- [ ] Add `repairItem(uint256 itemId)` to `ShopSystem` or create dedicated `RepairSystem`
- [ ] Implement repair cost formula with tunable `REPAIR_COST_PERCENT` constant
- [ ] Gold is burned (not transferred to shop)
- [ ] Client UI: repair button in inventory, durability bar on items

### Phase 4: Client UI
- [ ] Durability bar on item tooltips and inventory cards
- [ ] Color coding: green (>50%), yellow (25–50%), red (<25%), gray (broken)
- [ ] "Repair" button in shop interface
- [ ] Warning when equipping low-durability items
- [ ] Combat log message when an item breaks

---

## Contract Size Considerations

**EncounterSystem is at the 24KB contract size limit** (24,080 bytes, 496 byte margin). Durability logic MUST live in a separate `DurabilitySystem` contract. The integration point is a single external call:

```solidity
// In EncounterSystem, after combat resolves:
IDurabilitySystem(worldAddress).deductDurability(characterId);
```

This adds minimal bytecode to EncounterSystem (~50 bytes for the external call).

---

## Existing Items Migration

When durability launches, all existing items need initial values:

```solidity
// Migration script (Forge)
for each itemId with itemType in [Weapon, Armor, Accessory]:
    uint256 maxDur = getDurabilityForRarity(Items.getRarity(itemId));
    ItemDurability.set(itemId, maxDur, maxDur); // start at full durability
```

This is fair to existing players — their items start at full durability, same as newly dropped items. No "legacy indestructible" items.

---

## Marketplace Integration

- Durability is visible on marketplace listings
- Buyers can see `currentDurability / maxDurability` before purchasing
- Low-durability items should sell for less (market-driven, not enforced by contract)
- No contract changes needed — marketplace already trades item IDs, durability is just metadata

---

## Anti-Exploitation

| Risk | Mitigation |
|------|-----------|
| Players unequip before combat to avoid durability loss | Not possible — combat happens atomically, equipment is checked at combat start |
| Players never repair, just buy new items | Fine — buying new items from shops is also a gold sink |
| Repair cost too high, players quit | Tunable constant, start conservative (10%), increase if gold inflates |
| Bots farm with disposable gear | Disposable gear still costs gold, durability loss is unavoidable |

---

## Open Questions

- [ ] Exact `REPAIR_COST_PERCENT` — start at 10% or 15%?
- [ ] Should durability loss scale with mob level? (harder fights = more wear)
- [ ] Should PvP have higher durability loss than PvE? (more risk = more sink)
- [ ] Blacksmith NPC with repair discount as a future content addition?
- [ ] Durability potions/buffs that slow degradation? (creates another consumable sink)

---

*Last updated: March 5, 2026 — Initial design. Table schema deployed, implementation pending.*
