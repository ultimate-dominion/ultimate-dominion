# Ultimate Dominion: Economics

Reference document for game economy tuning — gold generation, sinks, drop rates, DEX integration, and marketplace revenue.

---

## Philosophy

- **Infinite gold supply** with sinks designed to outstrip creation over time
- **Gold is the medium of exchange**, rare items are the actual value
- **Marketplace is the core economic engine** - 2.5% fee on trades
- **DEX liquidity** provided initially, creating real-world value for gold

---

## Gold Generation

Gold drops from monster kills based on mob level:

| Mob Level | Gold Range | Average |
|-----------|------------|---------|
| 1 | 0.05 - 5 | ~2.5 gold |
| 2 | 0.05 - 10 | ~5 gold |
| 5 | 0.05 - 25 | ~12.5 gold |
| 10 | 0.05 - 50 | ~25 gold |

**Key constraint:** If player is 5+ levels above mob, no gold drops (prevents high-level farming of easy content).

### Gold Creation at Scale

Assuming 20 kills/hour, 2 hours/day average per player:

| Players | Avg Level | Daily Gold Created |
|---------|-----------|-------------------|
| 100 | 5 | 50,000 gold |
| 1,000 | 5 | 500,000 gold |
| 10,000 | 5 | 5,000,000 gold |

---

## Gold Sinks (Required for Deflationary Pressure)

| Sink | Type | Notes |
|------|------|-------|
| Marketplace fee | 2.5% per trade | Primary revenue source |
| Item repairs | 5-10% of item value | Ongoing drain |
| Respec | Flat fee (100-1000 gold) | Occasional |
| Cosmetics | Various | Pure sink, no resale |
| Guild creation | 5,000+ gold | One-time |
| Death penalty | 10% of carried gold | PvE and PvP |
| Crafting/Upgrading | Consumes gold + items | Removes both |

**Key insight:** The 2.5% marketplace fee is a compounding sink. Every time an item changes hands, 2.5% disappears. A legendary that trades 10 times removes 25% of its value in gold from circulation.

---

## Item Drop Rates (Recommended)

Current rates flood the market. Suggested adjustments:

| Rarity | Current | Recommended | Expected Supply (10k players, 1 month) |
|--------|---------|-------------|----------------------------------------|
| Common | 25% | 10% | Millions |
| Uncommon | 20% | 5% | ~240,000 |
| Rare | 15% | 0.5% | ~60,000 |
| Very Rare | 10% | 0.05% | ~6,000 |
| Legendary | 5% | 0.005% | ~600 |
| Unique | N/A | 1 total ever | 1 |

## Item Sinks (Critical for Rarity)

Items must leave circulation:

- **Durability** - Items break after X uses
- **PvP drops** - Die in PvP, lose equipped items
- **Upgrading** - Sacrifice 3 rares to make 1 epic
- **Rerolling** - Destroy item to reroll stats
- **Salvage** - Destroy for crafting materials

Without destruction, "rare" items flood the market over time.

---

## DEX Integration

Gold tradeable on decentralized exchange:

```
Players EARN gold (selling pressure)
     ↓
DEX Price
     ↑
Buyers SPEND gold (buying pressure)
```

**Demand drivers:**
1. **Utility** - Need gold to buy items on marketplace
2. **Speculation** - Betting on player growth
3. **Yield** - Staking/LP rewards (if implemented)

**Target:** Slight deflation - rewards players, keeps buyers coming.

### Initial Liquidity

Seed DEX pool yourself:

| Budget | Gold in Pool | Approx Market Cap |
|--------|--------------|-------------------|
| $10k | 500,000 gold | ~$5k |
| $25k | 1,250,000 gold | ~$12.5k |
| $50k | 2,500,000 gold | ~$25k |

Start small-medium. Some volatility attracts speculators, but not so wild it looks like a scam.

---

## Marketplace Revenue Model

| Daily Trading Volume | 2.5% Fee Revenue |
|---------------------|------------------|
| 10,000 gold | 250 gold |
| 100,000 gold | 2,500 gold |
| 1,000,000 gold | 25,000 gold |

Real USD revenue depends on gold price on DEX.

---

## Open Questions

- [ ] Final drop rate numbers after testing
- [ ] Exact sink rates to balance creation
- [ ] Initial DEX liquidity amount

---

*Last updated: February 2026*
