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

Max durability scales with rarity — rarer items last longer per repair cycle.

| Rarity | Max Durability | Combats Before Broken | Full Repair Cost |
|--------|---------------|-----------------------|-----------------|
| R0 (Worn) | 20 | 20 | 1g |
| R1 (Common) | 30 | 30 | 7.5g |
| R2 (Uncommon) | 40 | 40 | 30g |
| R3 (Rare) | 50 | 50 | 75g |
| R4 (Epic) | 60 | 60 | 150g |

Durability loss: **1 per combat** (`DURABILITY_LOSS_PER_COMBAT = 1`).
Repair cost: **flat per-rarity rate per durability point** (not % of item price).

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
- Any NPC shop that sells equipment — both **Tal** (Z1 Dark Cave, `9,9`) and **Tal Carden** (Z2 Windy Peaks, `9,9`). The `RepairShopPanel` is mounted unconditionally on `/shops/:shopId`.
- Future: dedicated Blacksmith NPC with better rates.
- **Current state**: `RepairShopPanel.tsx` skips items with `maxDurability === 0`. Z1 items have not had durability initialized on-chain yet, so the panel at Z1 Tal is currently inert for Z1 gear. When Z1 durability is activated, the same UI lights up automatically.

### Cost Formula
```
repairCost = pointsToRepair * REPAIR_COST_PER_POINT[rarity]
```

Flat per-rarity cost per durability point (defined in `constants.sol`):

| Rarity | Cost Per Point | Full Repair Cost |
|--------|---------------|-----------------|
| R0 | 0.05g | 1g |
| R1 | 0.25g | 7.5g |
| R2 | 0.75g | 30g |
| R3 | 1.5g | 75g |
| R4 | 2.5g | 150g |

### Repair Behavior
- Player can repair to full — no partial repair needed
- Gold is **permanently burned** (not sent to shop)
- Repair restores `currentDurability` to `maxDurability`

### Repair as Gold Sink — Projections (from chain data analysis, March 2026)

**Z1 players** (40 fights/day, BASE_GOLD_DROP=2, income=202g/day):

| Gear | Daily Repair | % of Income |
|------|-------------|-------------|
| R1 weapon + R1 armor | 20g | 10% |
| R2 weapon + R2 armor | 60g | 30% |

**Z2 players** (80 fights/day, income=1,204g/day):

| Gear | Daily Repair | % of Income |
|------|-------------|-------------|
| R2 weapon + R2 armor | 120g | 10% |
| R3 weapon + R3 armor | 240g | 20% |
| R4 weapon + R4 armor | 400g | 25% |

**At 200 DAU**: repair sink burns ~16,500g/day = 20% of total gold minting. Combined with death penalties, consumables, and marketplace fees: **38% total burn rate**.

---

## Implementation Status

### Contracts — DONE
- [x] `ItemDurability` + `CharacterItemDurability` tables in `mud.config.ts`
- [x] `DurabilitySystem.sol` — degrade, repair, equip check, initialize, admin set
- [x] `EncounterResolveSystem.sol` calls `degradeEquippedItems()` (gas-guarded, line 76-78)
- [x] `EquipmentSystem.sol` checks `canEquipDurability()` (broken items can't be equipped)
- [x] Access grants in `EnsureAccess.s.sol`
- [x] Migration script: `DeployDurabilityData.s.sol`

### Client — DONE
- [x] `DurabilityBar.tsx` — green/yellow/red progress bar on items
- [x] `RepairShopPanel.tsx` — full repair UI with cost calculation
- [x] `createSystemCalls.ts` — `repairItem()` system call
- [x] i18n strings in en/ko/ja/zh

### Activation — PENDING
- [ ] Run `DeployDurabilityData.s.sol` for all item IDs (Z1 + Z2) on beta
- [ ] Run `DeployDurabilityData.s.sol` for all item IDs on production
- [ ] Verify on beta: fight → durability loss → repair at shop → gold burned

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

- [x] ~~Repair cost model~~ — Resolved: flat per-rarity cost per point (not % of item price)
- [ ] Should durability loss scale with mob level? (harder fights = more wear)
- [ ] Should PvP have higher durability loss than PvE? (more risk = more sink)
- [ ] Blacksmith NPC with repair discount as a future content addition?
- [ ] Durability potions/buffs that slow degradation? (creates another consumable sink)
- [ ] Auto-repair toggle as QoL feature

---

*Last updated: March 30, 2026 — Full system implemented. Constants rebalanced based on chain data (20 days production). BASE_GOLD_DROP reduced 3→2. Z2 item prices raised ~3x. Durability active on all items (Z1+Z2).*
