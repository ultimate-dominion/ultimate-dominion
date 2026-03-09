# Gold Supply & Distribution Plan

Business planning document for gold token supply modeling, founder allocation, protocol revenue projections, and long-term financial strategy.

> **See also:** [Economics](ECONOMICS.md) for the game economy reference — generation rates, sinks, marketplace, DEX integration.

---

## Overview

Gold is an infinite-supply ERC20 on Base. Unlike fixed-supply tokens, gold is minted dynamically through gameplay (monster kills) and removed through sinks (item repairs, guild costs, flee penalties, death penalties). Total supply is a function of player activity, and any pre-launch allocation must be modeled against projected supply growth.

The marketplace fee (3% of all trades) is **protocol revenue** — it funds ongoing development and operations. It is intentionally not a sink.

This document models gold supply, sink balance, protocol revenue, and founder allocation across growth scenarios.

---

## Gross Gold Creation Projections (Before Sinks)

Gold generation formula, per-kill table, and player activity assumptions are in [ECONOMICS.md — Gold Generation](./ECONOMICS.md). Baseline: average player earns ~300 gold/day (level 5, 40 kills/day).

### Annual Gross Supply by Growth Scenario

Assumes linear DAU growth from launch count to year-end count, with average player earning 300 gold/day initially, growing to 420 gold/day as average level increases.

| Scenario | Launch DAU | Month 6 DAU | Year 1 DAU | Year 1 Gross Supply |
|----------|-----------|-------------|------------|-------------------|
| Slow | 10 | 25 | 50 | ~2.7M gold |
| Steady | 25 | 75 | 150 | ~8.4M gold |
| Moderate | 50 | 200 | 500 | ~27M gold |
| Strong | 100 | 500 | 1,500 | ~90M gold |
| Breakout | 250 | 2,000 | 5,000 | ~300M gold |

---

## Sink Coverage Analysis

Full sink mechanism details, rates, and implementation roadmap are in [ECONOMICS.md — Gold Sinks](./ECONOMICS.md). This section models aggregate sink coverage against the faucet.

### Per-Player Daily Sink Budget

Modeling total daily gold removed per average player (300 gold/day income, level 5):

#### Current Implemented Burns (Excluding Marketplace Fee)

| Sink | Gold/Day | % of Income | Type |
|------|----------|-------------|------|
| PvE flee (1 flee/day) | ~10 | 3% | Permanent burn |
| PvP flee (0.5 flees/day) | ~5 | 2% | Permanent burn (5% burn portion) |
| PvE death (2 deaths/day) | ~20 | 7% | Permanent burn |
| PvP death (0.5 deaths/day) | ~10 | 3% | Permanent burn (10% burn portion) |
| **Total current burns** | **~45** | **~15%** | |

#### With Planned Sinks Added

| Sink | Gold/Day | % of Income | Type |
|------|----------|-------------|------|
| Current burns (above) | ~45 | 15% | Permanent burn |
| Item repair | ~36 | 12% | Permanent burn |
| Guild upkeep share | ~19 | 6% | Permanent burn |
| **Total with planned sinks** | **~100** | **~33%** | |

Additionally:
- ~10 gold/day (~3%) sold on DEX for gas (not burned — re-enters circulation; see DEX Market Model)
- ~30 gold/day (~10%) redistributed through shop spreads and PvP winnings
- ~9 gold/day (~3%) goes to protocol revenue via marketplace fees

### Coverage Targets

The target is **sinks removing 90-100% of faucet output** for long-term stability at steady state. During growth, lower coverage is acceptable because new players create gold demand.

- **Current implemented sinks**: ~15% permanent burn rate (flee + death penalties). Inflationary but functional.
- **With item degradation**: ~27% permanent burn rate. Manageable during growth.
- **With all planned sinks**: ~33% permanent burn rate. Healthy during growth phase.

**Why <100% is acceptable during launch**: New players entering the economy create gold demand (they need gold to buy items, join guilds, repair gear). During growth, moderate inflation ensures new players can earn gold at a reasonable rate. Target higher sink coverage only at steady state when growth slows.

**Throttle mechanisms**: Multiple admin-configurable levers exist to adjust sink rates if inflation becomes a problem (see [ECONOMICS.md — Economic Levers](./ECONOMICS.md)).

---

## Net Supply Projections

### With Current Implemented Sinks (~15% permanent burn)

| Scenario | Gross Year 1 | Permanent Burns | Net Year 1 | Circulating* |
|----------|-------------|-----------------|------------|-------------|
| Slow (50 DAU) | ~2.7M | ~405K | ~2.3M | ~1.8M |
| Steady (150 DAU) | ~8.4M | ~1.3M | ~7.1M | ~5.7M |
| Moderate (500 DAU) | ~27M | ~4.1M | ~22.9M | ~18.3M |
| Strong (1,500 DAU) | ~90M | ~13.5M | ~76.5M | ~61.2M |

*Circulating = Net supply minus gold locked in escrow, guild treasuries, and shop reserves (~20% estimated lockup)

### With All Planned Sinks (~33% permanent burn)

| Scenario | Gross Year 1 | Permanent Burns | Net Year 1 | Circulating* |
|----------|-------------|-----------------|------------|-------------|
| Slow (50 DAU) | ~2.7M | ~891K | ~1.8M | ~1.4M |
| Steady (150 DAU) | ~8.4M | ~2.8M | ~5.6M | ~4.5M |
| Moderate (500 DAU) | ~27M | ~8.9M | ~18.1M | ~14.5M |
| Strong (1,500 DAU) | ~90M | ~29.7M | ~60.3M | ~48.2M |

---

## Protocol Revenue — Marketplace Fee

The 3% marketplace fee is the primary revenue stream for the project. It flows to a configurable `feeRecipient` wallet on every marketplace trade. For the mechanism and fee formula, see [ECONOMICS.md — Marketplace](./ECONOMICS.md).

### Industry Revenue Comparables

| Game | Fee | DAU | Annual Revenue | Revenue/DAU/Year |
|------|-----|-----|---------------|-----------------|
| Axie Infinity (2024) | 4.25% | ~50K | ~$4M | ~$80 |
| Axie Infinity (peak 2021) | 4.25% | ~1.8M | ~$500M+ | ~$278 |
| Pixels (2024) | Various | ~300K | ~$20M (all sources) | ~$67 |
| Big Time (cumulative) | 5% | Varies | ~$22.5M (from $450M volume) | — |

**Key metrics from research:**

| Metric | Conservative | Moderate | Optimistic |
|--------|-------------|----------|------------|
| Marketplace volume/DAU/day (in gold) | 50 gold | 150 gold | 300 gold |
| Marketplace participation rate | 15% | 30% | 50% |
| Power trader concentration | Top 5% do 50%+ of volume | — | — |

Note: Volume per DAU is in gold terms. USD value depends on gold's DEX price.

### Marketplace Fee Revenue Projections (in Gold)

At 3% fee rate:

| DAU | Daily Volume (moderate) | Daily Fee Revenue | Monthly Revenue | Annual Revenue |
|-----|------------------------|-------------------|-----------------|---------------|
| 50 | 7,500 gold | 225 gold | 6,750 gold | ~82K gold |
| 150 | 22,500 gold | 675 gold | 20,250 gold | ~246K gold |
| 500 | 75,000 gold | 2,250 gold | 67,500 gold | ~821K gold |
| 1,500 | 225,000 gold | 6,750 gold | 202,500 gold | ~2.5M gold |
| 5,000 | 750,000 gold | 22,500 gold | 675,000 gold | ~8.2M gold |

---

## Founder & Team Allocation

### Founder Gold Allocation

A **fixed pre-launch distribution** of gold, minted before the economy goes live. Because gold has infinite supply, this allocation represents a decreasing percentage of total supply as the game grows:

| Growth Scenario | Year 1 Circulating Supply | 5M Allocation as % | 10M Allocation as % |
|----------------|--------------------------|-------------------|-------------------|
| Slow (50 DAU) | ~1.8M | ~74% | ~85% |
| Steady (150 DAU) | ~5.7M | ~47% | ~64% |
| Moderate (500 DAU) | ~18.3M | ~21% | ~35% |
| Strong (1,500 DAU) | ~61.2M | ~8% | ~14% |
| Breakout (5,000 DAU) | ~180M+ | ~3% | ~5% |

**Recommended range**: 3-10M gold. This naturally dilutes as the economy grows — in high-growth scenarios, the allocation becomes a small fraction of circulating supply.

### Lockup & Transparency

Any pre-launch distribution should include:
- Public announcement of the allocation and rationale
- Defined lockup period (industry standard: 1-year cliff, 3-4 year linear vest)
- On-chain vesting contract for transparency
- Clear separation from gameplay-earned gold

---

## Company Revenue Model (USD)

### Revenue Streams

The company earns Gold from two sources, which is converted to ETH/USD via the DEX:

**1. Marketplace fees (3%)** — passive, scales with trading volume.

**2. Relayer Gold charges** — active, scales with embedded wallet player count. Assuming 50% of players use embedded wallets (Google auth), average 60 tx/day, 1 Gold charge per tx.

### Combined Revenue by DAU and Gold Price

| DAU | Marketplace Fee (gold/mo) | Relayer Charges (gold/mo) | Total Gold/Month | @$0.002 | @$0.005 | @$0.01 |
|-----|--------------------------|--------------------------|------------------|---------|---------|--------|
| 50 | 6,750 | 45,000 | 51,750 | $104/mo | $259/mo | $518/mo |
| 150 | 20,250 | 135,000 | 155,250 | $311/mo | $776/mo | $1,553/mo |
| 500 | 67,500 | 450,000 | 517,500 | $1,035/mo | $2,588/mo | $5,175/mo |
| 1,500 | 202,500 | 1,350,000 | 1,552,500 | $3,105/mo | $7,763/mo | $15,525/mo |

**Relayer charges dominate early revenue** (~87%). Marketplace fees only matter at scale.

**Honest assessment:** At 50-150 DAU, revenue covers infrastructure ($100-200/mo) and little else. Real revenue requires 500+ DAU. This is a game-first project, not a token-first project.

### Relayer Self-Sustainability

The relayer spends ETH (gas) and earns Gold (charges). Gold price determines whether it's self-sustaining:

| Gold Price | Gold Value Per Tx | Gas Cost Per Tx (Base) | Per-Tx P&L |
|---|---|---|---|
| $0.001 | $0.001 | ~$0.003 | **-$0.002 (losing money)** |
| $0.002 | $0.002 | ~$0.003 | **-$0.001 (losing money)** |
| $0.003 | $0.003 | ~$0.003 | ~breakeven |
| $0.005 | $0.005 | ~$0.003 | +$0.002 (sustainable) |

**Natural price floor:** Below ~$0.003/gold, the relayer can't self-fund. It stops selling Gold on the DEX (removing sell pressure), which helps price recover. This creates a self-correcting feedback loop.

**Levers:** If Gold stays below $0.003, increase `goldPerGasCharge` to 2+ Gold per tx. Or accept relayer subsidy during early growth when player counts are low and gas costs are minimal.

---

## DEX Market Model

Gold is tradeable on a Uniswap V3 GOLD/ETH pool on Base. For pool parameters, GasStation implementation, and starting liquidity details, see [ECONOMICS.md — DEX Integration](./ECONOMICS.md). This section models market dynamics, price strategy, and founder reserve operations.

### Daily Gas Sell Pressure (Gold Sold on DEX for Gas)

Gas costs on Base L2 are fixed in fiat terms (~$0.18/player/day at 60 transactions). The gold cost of gas varies inversely with gold's market price — more gold is needed when the price is low, less when it is high. This creates a self-correcting dynamic in the gas mechanism: at lower gold prices, gas consumes a larger share of player income (reducing the attractiveness of playing), while at higher prices gas becomes a negligible cost.

### Estimated Marketplace Contribution to DEX Volume

| DAU | Daily Marketplace Volume (gold) | % of Sellers Who Cash Out | Gold Hitting DEX (sell) | New Buyers via DEX (buy) |
|-----|-------------------------------|--------------------------|----------------------|------------------------|
| 100 | ~7,500 | 20% | 1,500 | 3,000 |
| 500 | ~75,000 | 20% | 15,000 | 30,000 |
| 1,500 | ~225,000 | 20% | 45,000 | 90,000 |

Assumption: more gold enters from DEX buyers than leaves from sellers, because many sellers reinvest gold in-game (repairs, next purchase). The marketplace creates a net gold demand on the DEX.

### DEX Volume Sources

DEX volume comes from several categories of activity:

- **Gas auto-swaps**: MetaMask players selling gold for ETH to cover transaction gas costs. Volume scales with player count and transaction frequency.
- **Marketplace-adjacent buying**: Players who need gold to purchase items on the marketplace buy gold on the DEX with ETH.
- **Player cashouts**: Players who earn more gold than they need sell excess gold on the DEX for ETH.
- **Speculative trading**: Crypto-native users trading gold based on their assessment of the game's trajectory.
- **LP rebalancing**: Arbitrageurs keeping the DEX price aligned with gold's fair value.

Actual DEX volume will depend on player behavior, marketplace activity, and item economy dynamics. At steady state, buy and sell pressure tend toward equilibrium. During growth periods, new player demand creates additional buy-side activity; during contraction, the reverse occurs.

### Slippage Analysis

At 0.5 ETH seed, ±50% range:

| Swap Size | USD Value at $0.002/gold | Estimated Slippage |
|-----------|------------------------|-------------------|
| 20 gold (single gas refuel) | $0.04 | <0.01% |
| 200 gold (day's gas supply) | $0.40 | <0.01% |
| 5,000 gold (marketplace purchase) | $10 | ~0.2% |
| 50,000 gold (large cashout) | $100 | ~2-4% |

Daily gas sell pressure across all players is tiny at early DAU — individual swaps are effectively zero slippage.

**Pool buy-out scenario:** With ±50% range, buying ALL Gold from the pool costs ~0.236 ETH ($590) and moves price from $0.002 to $0.003 (1.5x). This is manageable — see Founder Reserve as Market Maker below.

---

## Price Strategy

### Core Principle

**Keep Gold cheap during growth. Revenue comes from volume, not price.**

Low Gold price ($0.002-0.005):
- Marketplace velocity is high — players trade freely, items feel affordable
- New players onboard cheaply (low barrier to entry)
- Game feels like a game, not a financial market
- Aligns with manifesto: "invisible technology", "earning is secondary to fun"

High Gold price ($0.01+):
- Marketplace slows — every purchase feels consequential in dollar terms
- Players think about dollar values instead of playing
- Farmers emerge to exploit the price, warping the experience
- Creates fragile dependency on price staying high

### Phased Approach

| Phase | Target Gold Price | Mechanism |
|---|---|---|
| Soft launch (50 DAU) | $0.002 | Seed pool at low price. Absorb any pumps via founder reserve. |
| Growth (150 DAU) | $0.003-0.004 | Reduce sell pressure gradually. Relayer becomes self-sustaining. |
| Establishment (500 DAU) | $0.005-0.008 | Organic supply/demand drives price. Patron system deepens pool. |
| Mature (1,500+ DAU) | Market-determined | Founder reserve <5% of supply. Market self-regulates. |

### Why This Is Different From Other Crypto Games

Typical crypto game: **High price launch → inflation → dump → death spiral.**

UD model: **Low price launch → game grows → organic appreciation → early players rewarded.**

The Gold price becomes a trailing indicator of game health, not a leading speculative asset. Players buy Gold to play, not to invest. When the game does well, Gold appreciates naturally. This is durable because it doesn't depend on speculation to sustain itself.

---

## Speculation Dynamics

### Natural Market Participants

Once the pool is liquid, these actors emerge organically:

**Buy side (ETH → Gold):**
- New players buying Gold to start or buy marketplace items
- Speculators betting on game growth
- Item flippers who need Gold to buy underpriced listings
- Bots buying dips after sell-offs

**Sell side (Gold → ETH):**
- Players cashing out earnings
- Relayer swapping charged Gold
- Founder/company selling reserve into demand
- Gold farmers (if price is high enough)

**Neutral (both sides):**
- Arbitrage bots keeping price efficient (dampen volatility — helps stability)
- LP providers earning fees (Patron system)
- Market-making bots providing tight spreads (deepen pool for free)

**Net effect of natural participants:** They make the market efficient, which favors the entity with the most supply (the founder). More participants = less need for manual intervention.

### Items vs. Gold as Speculative Targets

The smart speculator buys items, not Gold. See [ECONOMICS.md — Items as the True Value Store](./ECONOMICS.md).

**Every speculative item trade generates:**
1. ETH → Gold on DEX (buy pressure)
2. Gold → Item on marketplace (3% fee to protocol)
3. Item appreciates, sold for more Gold (3% fee again)
4. Gold → ETH on DEX (sell pressure)

**Two marketplace fees + two DEX trades per speculative cycle.** Item speculation is revenue-positive for the protocol.

### Anti-Speculation Protections

See [ECONOMICS.md — Anti-Speculation Protections](./ECONOMICS.md) for the full design. Key measures: item degradation (carrying cost for speculators), marketplace cooldowns (kill rapid flipping), progressive fees (make flipping unprofitable), soulbound progression (money can't buy everything).

---

## Founder Reserve as Market Maker

### Role of the Founder Allocation

At early DAU (50-150), company revenue Gold (~$100-300/month) is **too small to meaningfully affect the DEX price**. The founder's pre-minted Gold reserve (recommended 5-10M) is the actual market-making tool.

| Founder Reserve | Value @$0.002 | Value @$0.005 | Equiv. Months of 500-DAU Revenue |
|---|---|---|---|
| 3M gold | $6,000 | $15,000 | 6 months |
| 5M gold | $10,000 | $25,000 | 10 months |
| 10M gold | $20,000 | $50,000 | 19 months |

### Whale Buy-Out Cycle

With a 0.5 ETH pool (±50% range, ~240K Gold):

1. **Whale buys all Gold** → pays ~0.236 ETH ($590), price: $0.002 → $0.003
2. **You sell Gold from reserve** → receive ~0.236 ETH, price resets to ~$0.002
3. **Net:** You collected 0.236 ETH, whale holds 240K Gold at above-market cost basis (~18% underwater)

With 5M reserve, you can sustain ~20 full cycles. But the whale loses money each cycle — they'd stop long before you run out. And as the LP, you also earn the 0.3% swap fees on both sides.

**Key advantage:** You're not fighting the whale alone. Other natural participants also respond:
- Players holding Gold see the spike and cash out → sell pressure
- Bots detect the spike and sell → sell pressure
- Arbitrageurs normalize the price → sell pressure

The more players in the economy, the less you need to intervene. The founder reserve is a ~1 year runway for market-making; after that, organic supply/demand should dominate.

### Long-Term Monetization of Founder Reserve

The cycle over months (not individual trades):

| Phase | DAU | Founder Role | Gold Sold | ETH Collected |
|---|---|---|---|---|
| Month 1-3 | 50 | Sole market maker, sell into pumps | ~200K | ~0.16 ETH ($400) |
| Month 3-6 | 150 | Reduce selling, let price drift up | ~500K | ~1.0 ETH ($2,500) |
| Month 6-12 | 500 | Organic demand rising, sell gradually | ~1M | ~2.4 ETH ($6,000) |
| Year 2+ | 1,500 | Insurance only, market self-regulates | As needed | — |

**Year 1 total (steady growth to 500 DAU):** ~1.7M Gold sold, ~3.6 ETH (~$9,000) collected. Founder reserve: ~3.3M remaining.

---

## Patron of the Realm — LP Incentive `[PLANNED]`

Players can deepen the GOLD/ETH pool by depositing ETH through an in-game interface. The protocol pairs the ETH with minted gold and adds both to the Uniswap V3 pool. Players receive tiered in-game titles and perks (social status and convenience, never combat power) that persist only while their deposit remains active. Tiers: Bronze (0.01 ETH) → Silver (0.05 ETH) → Gold (0.1 ETH) → Diamond (0.5+ ETH).

See [ECONOMICS.md — Patron of the Realm](./ECONOMICS.md) for the full design, tier table, and risks.

---

## Next Steps

1. ~~**Redesign GasStation**~~ — Done. `buyGas()` now swaps via Uniswap V3 when configured, with burn+treasury fallback. Relayer `chargeGasGold()` added for embedded wallets.
2. ~~**Deploy Uniswap V3 GOLD/ETH pool**~~ — Done on beta. Pool: `0x4338173e5557Eed1638c03c28f3502AD9Bb03e0f` (1% fee tier). Production pool pending — see deploy-guide.md launch checklist.
3. Implement item degradation system — highest-impact permanent sink, creates compounding demand
4. ~~Add death penalty~~ — Done (PvE 5% burn, PvP 10% burn + 40% redistribution)
5. Increase PvE flee penalty to 10% (optional tuning)
6. Run economic simulation with beta data (actual kills/day, trading volume, flee rate)
7. Finalize pre-launch distribution amount based on target growth scenario
8. Implement on-chain vesting contract if applicable
9. Design guild economic system (creation, upkeep, dissolution)
10. Prepare public-facing tokenomics announcement
11. Production pool seeding (0.5 ETH + ~240K Gold, ±50% range, 1% fee tier)
12. Patron of the Realm LP incentive system design + implementation
13. Gold offerings shrine system (permanent burn sink)
14. Autonomous buyback mechanism evaluation (marketplace fees → gold purchase on DEX)
15. Anti-speculation: marketplace cooldown implementation (24-48h relist delay)
16. Anti-speculation: progressive marketplace fees for rapid relists
17. Item permanent destruction mechanic (failed repair, crafting sacrifice, or PvP full-loot) — critical for items-as-value-store thesis

---

## Open Questions

- [ ] Final pre-launch distribution amount
- [ ] Vesting schedule and lockup terms
- [ ] Whether to implement on-chain vesting contract or manual lockup
- [ ] Marketplace fee: keep at 3% or adjust
- [ ] Autonomous buyback mechanism — use marketplace fee revenue to buy gold on DEX?

---

*Last updated: March 9, 2026*
