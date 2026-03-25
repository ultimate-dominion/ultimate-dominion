# Balance Sim Rules

**Read this before every balance session. These rules govern all sim work.**

---

## 0. The Core Question

**"Can every build play the game and have fun?"**

Balance doesn't mean equal. It means every archetype has a viable path through the content — they can progress, they can gear up, they unlock meaningful power spikes at certain levels or gear tiers, and no build hits a brick wall with no way forward.

Before any balance change ships, the FULL sim must run:
1. **All 27 archetypes**, L1-20 PvE journey (not just representative builds)
2. **Win rates at every level** — no build below 30% at any level with best available gear
3. **Gear progression** — every build has at least one equippable weapon and armor at every rarity tier they can access
4. **Combat with the actual gear variant being deployed** (V3, V4, etc. — not a different version)

Isolated audits (equip cost, stat comparison, single-archetype tests) are diagnostic tools, not proof of balance. They inform changes. The full sim validates them.

## 1. Build Accessibility Spectrum

Pure builds (warrior, rogue, wizard) = **cheap, easy to gear, always competitive**.
Hybrid builds = **harder to acquire, rarer drops, more expensive, but rewarding if invested in**.

- Pure weapons: higher drop rates (R1-R2 common), available in shops
- Hybrid weapons: lower drop rates (R3+), marketplace-driven
- Pure vs hybrid win rate gap: hybrids should be ≤5% better, not dominant
- A well-geared pure build should ALWAYS be competitive in PvP and PvE

## 2. Interconnected Economy

Every sim must model the full resource loop — never test fights in isolation:

1. **Win rate** → farm efficiency
2. **HP carryover** → pots needed per session
3. **Gold income** (kills + drops) → must cover consumable + durability costs
4. **Drop rates** → marketplace supply + personal progression speed
5. **Equipment durability** (Z2+) → ongoing gold drain proportional to level
6. **Marketplace demand** → scarce drops (R3/R4/hybrids) create buy pressure

Use `--zone-run` flag to validate the full loop.

### Economy Health Checks
- Net gold per zone: should be non-negative OR require reasonable marketplace trading
- XP curve: 50-200 fights per level (not thousands)
- Endurance: ≥3 consecutive fights before needing to rest at all level ranges
- Consumable costs: must be affordable from gold earned at that level

## 3. Equipment Durability (Z2+)

Each fight costs durability proportional to level. Repairs cost gold.
This is a gold sink that grows with level and keeps the marketplace economy healthy.

## 4. Drop Rates & Marketplace

- Common/Uncommon drops: flooded supply → NPC vendor value only
- Rare drops: healthy supply → some marketplace activity
- Epic drops: scarce → primary marketplace driver
- Legendary drops: very scarce → aspirational, high marketplace value
- Hybrid weapons: always scarce → marketplace-exclusive for most players

## 5. Zone Transition

When entering a new zone, players carry gear from the previous zone.
The first mob of the new zone should be:
- **Challenging but winnable** with previous-zone R3-R4 gear (60-80% win rate)
- **Comfortable** after getting zone-entry R1 gear (85%+ win rate)
- **Trivial** should not happen — it means the zone scales too slowly

## 6. Sim Flags Reference

```
--summary       Path/level averages only
--v4            Use V4 weapon/armor/spell variant (deploy target)
--pvp           L20 PvP cross-archetype (4-slot loadouts, per-opponent selection)
--pots          L20 boss with consumable loadouts
--spell2        Enable second spells (best of spell1/spell2)
--zone-run      Integrated zone run: transition, endurance, XP, gold, drops
--equip-audit   Off-path stat cost per archetype/rarity (equip gates + imbalance)
--arch=ID       Filter to specific archetype (e.g., WAR-S)
--level=N       Filter to specific level
--rounds=N      Override max combat rounds
```
