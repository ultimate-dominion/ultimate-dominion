# Ultimate Dominion — Economics

Reference document for game economy tuning — gold generation, sinks, drop rates, DEX integration, and marketplace revenue.

---

## Philosophy

- **Infinite gold supply** with sinks designed to outstrip creation over time
- **Gold is the medium of exchange**, rare items are the actual value store
- **Marketplace is the core economic engine** — fee on all trades
- **DEX liquidity** creates real-world value for gold

---

## Gold Token

Gold is an **ERC20 token** on Base. It is the sole currency for all in-game transactions: shops, marketplace, PvP escrow, and rewards.

---

## Gold Generation

Gold drops from monster kills. Drop amounts should scale with mob level — exact formula needs tuning during game testing.

**Design targets** (subject to balancing):

| Mob Level | Gold Range | Average |
|-----------|------------|---------|
| 1 | 0.05–5 | ~2.5 gold |
| 2 | 0.05–10 | ~5 gold |
| 5 | 0.05–25 | ~12.5 gold |
| 10 | 0.05–50 | ~25 gold |

**Current implementation**: Base gold drop of 5 per kill (flat). Scaling with mob level is the intended design but needs implementation and testing.

**Anti-farming**: If player is 5+ levels above mob, no gold drops. `[PLANNED]` — prevents high-level farming of easy content.

### Gold Creation at Scale

Assuming 20 kills/hour, 2 hours/day average per player:

| Players | Avg Level | Daily Gold Created |
|---------|-----------|-------------------|
| 10 | 5 | ~5,000 gold |
| 50 | 5 | ~25,000 gold |
| 100 | 5 | ~50,000 gold |

*These projections need validation once mob-level scaling is implemented.*

---

## Gold Sinks

### Implemented

| Sink | Mechanism | Notes |
|------|-----------|-------|
| Marketplace fee | 2.5–3% per trade (under review) | Primary revenue source |
| Shop purchases | Buy items from NPC shops | Shops have markup on buy price |

### Planned `[PLANNED]`

| Sink | Type | Notes |
|------|------|-------|
| Item repairs | 5–10% of item value | Ongoing drain |
| Respec | Flat fee (100–1,000 gold) | Occasional |
| Cosmetics | Various | Pure sink, no resale |
| Guild creation | 1,000 gold | One-time. See [GUILDS.md](./GUILDS.md) |
| Guild territory upkeep | 100 gold/tile/week | Recurring sink for holding territory |
| Guild buffs | 100–200 gold each, 24h | Recurring sink for active guilds |
| Guild war declaration | 500 gold | Per war |
| Guild territory claiming | 500 gold/tile | One-time per tile |
| Guild dissolution | Treasury burned | Prevents gold recycling |
| Death penalty | 10% of carried gold | PvE and PvP |
| Crafting/Upgrading | Consumes gold + items | Removes both |

**Key insight**: The marketplace fee is a compounding sink. Every time an item changes hands, a percentage disappears. A legendary that trades 10 times removes significant gold from circulation.

---

## Marketplace

### How It Works `[IMPLEMENTED]`

Player-to-player trading via on-chain order book:

1. Seller creates order: offers items, sets gold price
2. Items held in escrow by LootManager contract
3. Buyer fulfills order: pays gold
4. Fee deducted from seller's gold, sent to fee recipient
5. Items and remaining gold transferred atomically

**Supported tokens**: ERC20 (Gold) ↔ ERC1155 (Items)

### Fee

**Current code**: 300 basis points (3%) — stored in UltimateDominionConfig, configurable.

**Under review**: Considering 2.5% vs 3%. Final decision pending economic testing.

```
feeAmount = (goldAmount × feePercent) / 10,000
sellerReceives = goldAmount - feeAmount
```

### Revenue Projections

| Daily Trading Volume | 3% Fee Revenue | 2.5% Fee Revenue |
|---------------------|----------------|------------------|
| 10,000 gold | 300 gold | 250 gold |
| 100,000 gold | 3,000 gold | 2,500 gold |
| 1,000,000 gold | 30,000 gold | 25,000 gold |

Real USD revenue depends on gold price on DEX.

---

## Shops `[IMPLEMENTED]`

NPC shops with buy/sell mechanics:

- **Buy price**: Base item price × shop markup multiplier
- **Sell price**: Base item price × shop markdown multiplier (always less than buy price)
- **Restock**: Every 12 hours, shop restocks to max inventory and max gold
- **Stock limits**: Shops have finite inventory that depletes as players buy

---

## Item Economy

### Drop Rates

Items have individual drop chance percentages. Recommended rate targets for a healthy economy:

| Rarity | Target Drop Rate | Expected Supply (100 players, 1 month) |
|--------|-----------------|----------------------------------------|
| Common | ~10% | Abundant |
| Uncommon | ~5% | ~24,000 |
| Rare | ~0.5% | ~6,000 |
| Very Rare | ~0.05% | ~600 |
| Legendary | ~0.005% | ~60 |
| Unique | 1 total ever | 1 |

*Exact rates need tuning during game testing.*

### Item Sinks `[PLANNED]`

Items must leave circulation to maintain rarity:

- **Durability** — Items break after X uses
- **PvP drops** — Die in PvP, lose equipped items
- **Upgrading** — Sacrifice 3 rares to make 1 epic
- **Rerolling** — Destroy item to reroll stats
- **Salvage** — Destroy for crafting materials

Without item destruction, "rare" items flood the market over time.

---

## DEX Integration `[PLANNED — Launch Requirement]`

Gold will be tradeable on a decentralized exchange, creating real-world value:

```
Players EARN gold (selling pressure)
     ↓
DEX Price
     ↑
Buyers SPEND gold (buying pressure)
```

**Demand drivers:**
1. **Utility** — Need gold to buy items on marketplace
2. **Speculation** — Betting on player growth
3. **Yield** — Staking/LP rewards (if implemented)

**Target:** Slight deflation — rewards players, keeps buyers coming.

### Initial Liquidity

Seed DEX pool at launch:

| Budget | Gold in Pool | Approx Market Cap |
|--------|--------------|-------------------|
| $10k | 500,000 gold | ~$5k |
| $25k | 1,250,000 gold | ~$12.5k |
| $50k | 2,500,000 gold | ~$25k |

Start small-medium. Some volatility attracts speculators, but not so wild it looks like a scam.

---

## Open Questions

- [ ] Final marketplace fee: 2.5% vs 3%
- [ ] Gold drop scaling formula (per mob level)
- [ ] Final item drop rates after testing
- [ ] Exact sink rates to balance creation
- [ ] Initial DEX liquidity amount
- [ ] Anti-farming level gap threshold

---

*Last updated: February 2026*
