# Gold Supply & Distribution Plan

Planning document for gold token supply modeling, founder allocation, protocol revenue, and long-term economic balance.

---

## Overview

Gold is an infinite-supply ERC20 on Base. Unlike fixed-supply tokens, gold is minted dynamically through gameplay (monster kills) and removed through sinks (item repairs, guild costs, flee penalties, death penalties). Total supply is a function of player activity, and any pre-launch allocation must be modeled against projected supply growth.

The marketplace fee (3% of all trades) is **protocol revenue** — it funds ongoing development and operations. It is intentionally not a sink.

This document models gold supply, sink balance, protocol revenue, and founder allocation across growth scenarios.

---

## Gold Generation Model

### Per-Kill Formula

```
goldDrop = (random % (BASE_GOLD_DROP * mobLevel)) + 0.05
```

- `BASE_GOLD_DROP` = 5 gold
- Elite monsters: 1.5x multiplier
- Anti-farming: no gold if player is 5+ levels above mob

### Average Gold Per Kill by Mob Level

| Mob Level | Gold Range | Average Per Kill |
|-----------|------------|-----------------|
| 1 | 0.05–5 | ~2.5 |
| 3 | 0.05–15 | ~7.5 |
| 5 | 0.05–25 | ~12.5 |
| 7 | 0.05–35 | ~17.5 |
| 10 | 0.05–50 | ~25.0 |

### Player Activity Assumptions

Based on browser RPG benchmarks and early playtesting:

| Metric | Conservative | Moderate | Optimistic |
|--------|-------------|----------|------------|
| Kills per hour | 15 | 20 | 25 |
| Hours per day per player | 1 | 2 | 3 |
| Average mob level (month 1) | 3 | 5 | 5 |
| Average mob level (month 6) | 5 | 7 | 8 |
| Average mob level (year 1) | 7 | 8 | 9 |

---

## Gross Gold Creation Projections (Before Sinks)

### Daily Gold Created Per Player

| Player Activity | Avg Mob Level | Gold/Kill | Kills/Day | Gold/Day |
|----------------|---------------|-----------|-----------|----------|
| Casual | 3 | 7.5 | 15 | 112 |
| Average | 5 | 12.5 | 40 | 500 |
| Dedicated | 7 | 17.5 | 60 | 1,050 |
| Hardcore | 10 | 25.0 | 75 | 1,875 |

Using "Average" (500 gold/player/day) as the baseline:

### Annual Gross Supply by Growth Scenario

Assumes linear DAU growth from launch count to year-end count, with average player earning 500 gold/day initially, growing to 700 gold/day as average level increases.

| Scenario | Launch DAU | Month 6 DAU | Year 1 DAU | Year 1 Gross Supply |
|----------|-----------|-------------|------------|-------------------|
| Slow | 10 | 25 | 50 | ~4.5M gold |
| Steady | 25 | 75 | 150 | ~14M gold |
| Moderate | 50 | 200 | 500 | ~45M gold |
| Strong | 100 | 500 | 1,500 | ~150M gold |
| Breakout | 250 | 2,000 | 5,000 | ~500M gold |

---

## Gold Sinks — Detailed Analysis

### Sink Classification

1. **Permanent burns** — Gold destroyed from total supply. True sinks.
2. **Protocol revenue** — Gold transferred to fee recipient wallet. Removed from player economy but not from total supply. This is company revenue, not a sink.
3. **Redistributions** — Gold moves between players. Total supply unchanged.

### Current Implementation

| Mechanism | Type | Rate | Removes from supply? |
|-----------|------|------|---------------------|
| PvE flee penalty | Permanent burn | 5% of escrow | Yes |
| GasStation (MetaMask) | DEX sell pressure | Gold sold on Uniswap V3 GOLD/WETH pool for ETH | No — gold re-enters circulation via DEX buyers |
| GasStation (embedded) | Relayer charge | Relayer charges gold from player, sells on DEX off-chain | No — gold re-enters circulation via DEX buyers |
| GasStation (fallback) | Permanent burn | Gold burned, ETH from treasury at fixed rate (when DEX not configured) | Yes — legacy fallback only |
| **Marketplace fee** | **Protocol revenue** | **3% of trade volume → fee recipient** | **No — intentional revenue** |
| Shop buy/sell spread | Redistribution | 20% markup buy / 50% markdown sell | No |
| PvP loss | Redistribution | 50% of loser escrow → winners | No |
| PvP flee penalty | Redistribution | 25% of escrow → opponents | No |

**Current true burn rate is very low.** Only PvE flee (5% of escrow) permanently removes gold. The GasStation now swaps gold on the Uniswap V3 GOLD/WETH pool instead of burning — gold re-enters circulation via DEX buyers (see DEX Market Model section). A burn+treasury fallback exists when the DEX pool is not yet configured. The planned sinks below are essential for long-term economic stability.

### Industry Context — Marketplace Fees

| Game | Fee | Revenue or Sink? |
|------|-----|-----------------|
| Guild Wars 2 | 15% | Sink (gold destroyed) |
| EVE Online | 4-10% | Sink (ISK destroyed) |
| Albion Online | 6.5-10.5% | Sink (silver destroyed) |
| World of Warcraft | 5% | Sink (gold destroyed) |
| RuneScape (OSRS) | 2% | Sink (GP destroyed, funds item deletion) |
| Axie Infinity | 4.25% | Revenue (to protocol treasury) |
| Big Time / Open Loot | 5% | Revenue (to protocol) |
| **Ultimate Dominion** | **3%** | **Revenue (to fee recipient)** |

Most traditional MMOs burn their marketplace fees as sinks. Most on-chain games capture them as revenue. UD follows the on-chain game model — the marketplace fee funds the project, and other mechanics handle sink duties.

---

## Planned Sink System

### Tier 1: Permanent Burns (Gold Destroyed)

These sinks permanently reduce total supply. They are the foundation of economic stability.

#### Item Degradation & Repair

Items lose durability through combat use and must be repaired with gold. Repair costs scale with item value, ensuring the sink remains meaningful as the economy grows.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Durability loss per combat | 2-5% | Gear lasts 20-50 fights before needing repair |
| Repair cost | 8% of item base price | Per full repair (0% → 100% durability) |
| Broken threshold | 0% durability | Item unusable until repaired |
| Repair location | NPC blacksmiths (shops) | Requires returning to safe area |

**Per-player daily projection** (average player, 40 combats/day):

| Scenario | Equipped Item Value | Repairs/Day | Gold Burned/Day | % of Income |
|----------|-------------------|-------------|-----------------|-------------|
| Early game (level 3) | ~200 gold total | ~1 full repair | ~16 gold | ~3% |
| Mid game (level 5) | ~500 gold total | ~1.5 repairs | ~60 gold | ~12% |
| Late game (level 8+) | ~1,500 gold total | ~2 repairs | ~240 gold | ~34% |

#### Flee Penalty (Already Implemented — PvE)

Currently 5% of escrow burned on PvE flee. Consider increasing:

| Current | Proposed | Rationale |
|---------|----------|-----------|
| 5% PvE flee | 10% PvE flee | Dragon Quest standard; meaningful risk for fleeing |
| 25% PvP flee (redistributed) | 10% burned + 15% to winner | Split between sink and redistribution |

#### Death Penalty

Gold lost on combat death (PvE and PvP). Not currently implemented.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| PvE death | 5% of escrow burned | Moderate penalty — death should sting |
| PvP death | 10% of escrow burned (+ 40% to winner) | Higher risk for PvP, winner still rewarded |

**Per-player daily projection** (assuming 2-3 deaths/day for average player):

| Deaths/Day | Avg Escrow | Gold Burned | % of Income |
|------------|-----------|-------------|-------------|
| 2 (PvE) | 300 gold | 30 gold | ~6% |
| 3 (mixed) | 400 gold | 50 gold | ~10% |

#### Guild Creation

One-time cost, permanently burned.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Guild creation fee | 2,000 gold | ~4 days of average player income; meaningful commitment |
| Guild name change | 1,000 gold | Discourage frivolous changes |

### Tier 2: Recurring Burns (Guild System)

#### Guild Treasury & Upkeep

Guilds maintain territories and activate buffs using treasury gold. Upkeep costs are permanently burned.

| Mechanism | Cost | Frequency | Burn? |
|-----------|------|-----------|-------|
| Territory claim | 500 gold/tile | One-time | Yes |
| Territory upkeep | 100 gold/tile/week | Recurring | Yes |
| Guild buff activation | 100-200 gold per buff | 24-hour duration | Yes |
| War declaration | 500 gold | Per war | Yes |
| Guild dissolution | 50% of treasury | On disband | Yes — novel mechanic |

**Per-guild weekly cost** (active guild with 5 tiles and 2 buffs/day):

| Component | Weekly Cost |
|-----------|------------|
| Territory upkeep (5 tiles) | 500 gold |
| Buffs (2/day × 150 avg × 7) | 2,100 gold |
| Total | ~2,600 gold/week |
| Per member (20-person guild) | ~130 gold/week (~19 gold/day) |

### Tier 3: Aspirational Sinks (Voluntary)

Optional gold sinks that target players with excess gold. Critical for removing gold from the top of the wealth distribution without penalizing average players.

| Sink | Cost | Notes |
|------|------|-------|
| Cosmetic titles | 500-5,000 gold | "The Wealthy", "Dragon Slayer", etc. |
| Name change | 500 gold | Vanity feature |
| Stat respec | 200-1,000 gold (scales with level) | Percentage-based prevents triviality |
| Premium crafting | Variable | Upgrade item rarity tier |
| Housing/land (future) | 5,000-50,000 gold | Long-term aspirational goal |
| Gold offerings | 100-500 gold (scales with level) | Sacrifice gold at shrine for +10% drop rate boost (1 hour). Permanent burn. |
| XP boost | 50-200 gold (scales with level) | 1.5x XP multiplier for 1 hour. Permanent burn. |

---

## Per-Player Daily Sink Budget

Modeling total daily gold removed per average player (500 gold/day income, level 5):

### With Planned Sinks (Excluding Marketplace Fee)

| Sink | Gold/Day | % of Income | Type |
|------|----------|-------------|------|
| Item repair | ~60 | 12% | Permanent burn |
| Death penalty (2 deaths) | ~30 | 6% | Permanent burn |
| PvE flee (1 flee/day) | ~15 | 3% | Permanent burn |
| Guild upkeep share | ~19 | 4% | Permanent burn |
| **Total permanent burns** | **~124** | **~25%** | |

Additionally:
- ~18 gold/day (~3.6%) sold on DEX for gas (not burned — re-enters circulation; see DEX Market Model)
- ~50 gold/day (~10%) redistributed through shop spreads
- ~15 gold/day (~3%) goes to protocol revenue via marketplace fees

### Sink Coverage Analysis

The target is **sinks removing 90-100% of faucet output** for long-term stability at steady state. During growth, lower coverage is acceptable because new players create gold demand.

- **Current sinks only**: ~3% permanent burn rate (PvE flee only). **Severely inflationary.**
- **With planned sinks**: ~25% permanent burn rate. Inflationary but manageable during growth.
- **With all tiers**: ~33% permanent burn rate. Healthy during growth phase.

**Why <100% is acceptable during launch**: New players entering the economy create gold demand (they need gold to buy items, join guilds, repair gear). During growth, moderate inflation ensures new players can earn gold at a reasonable rate. Target higher sink coverage only at steady state when growth slows.

**Throttle mechanisms**: Multiple admin-configurable levers exist to adjust sink rates if inflation becomes a problem (see Economic Levers section).

---

## Net Supply Projections

### With Planned Sinks (~25% permanent burn)

| Scenario | Gross Year 1 | Permanent Burns | Net Year 1 | Circulating* |
|----------|-------------|-----------------|------------|-------------|
| Slow (50 DAU) | ~4.5M | ~1.1M | ~3.4M | ~2.7M |
| Steady (150 DAU) | ~14M | ~3.5M | ~10.5M | ~8.4M |
| Moderate (500 DAU) | ~45M | ~11.3M | ~33.7M | ~27M |
| Strong (1,500 DAU) | ~150M | ~37.5M | ~112.5M | ~90M |

*Circulating = Net supply minus gold locked in escrow, guild treasuries, and shop reserves (~20% estimated lockup)

### With Full Sink Suite (~33% permanent burn)

| Scenario | Gross Year 1 | Permanent Burns | Net Year 1 | Circulating* |
|----------|-------------|-----------------|------------|-------------|
| Slow (50 DAU) | ~4.5M | ~1.5M | ~3.0M | ~2.4M |
| Steady (150 DAU) | ~14M | ~4.6M | ~9.4M | ~7.5M |
| Moderate (500 DAU) | ~45M | ~14.9M | ~30.1M | ~24.1M |
| Strong (1,500 DAU) | ~150M | ~49.5M | ~100.5M | ~80.4M |

---

## Protocol Revenue — Marketplace Fee

The 3% marketplace fee is the primary revenue stream for the project. It flows to a configurable `feeRecipient` wallet on every marketplace trade.

### Industry Comparables

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

| Growth Scenario | Year 1 Circulating Supply | 5M Allocation as % |
|----------------|--------------------------|-------------------|
| Slow (50 DAU) | ~2.7M | ~65% |
| Steady (150 DAU) | ~8.4M | ~37% |
| Moderate (500 DAU) | ~27M | ~16% |
| Strong (1,500 DAU) | ~90M | ~5% |
| Breakout (5,000 DAU) | ~300M+ | ~1% |

**Recommended range**: 3-10M gold. This naturally dilutes as the economy grows — in high-growth scenarios, the allocation becomes a small fraction of circulating supply.

### Company Operational Revenue

The 3% marketplace fee is the primary operational revenue stream. It flows to a configurable `feeRecipient` wallet on every marketplace trade. This is separate from the founder gold allocation — it is ongoing revenue from economic activity, not a pre-mint.

**Marketplace fee revenue at different DAU levels (in gold):**

| DAU | Daily Marketplace Volume | Daily Fee Revenue | Annual Revenue |
|-----|------------------------|-------------------|---------------|
| 50 | 7,500 gold | 225 gold | ~82K gold |
| 150 | 22,500 gold | 675 gold | ~246K gold |
| 500 | 75,000 gold | 2,250 gold | ~821K gold |
| 1,500 | 225,000 gold | 6,750 gold | ~2.5M gold |
| 5,000 | 750,000 gold | 22,500 gold | ~8.2M gold |

### Lockup & Transparency

Any pre-launch distribution should include:
- Public announcement of the allocation and rationale
- Defined lockup period (industry standard: 1-year cliff, 3-4 year linear vest)
- On-chain vesting contract for transparency
- Clear separation from gameplay-earned gold

---

## DEX Market Model

Gold is tradeable on a Uniswap V3 GOLD/ETH pool on Base. This section models the natural gold market, company revenue in USD terms, pool dynamics under stress, and how the DEX interacts with the gold-only in-game marketplace.

### GasStation Design

| Phase | Gas Coverage | Mechanism |
|-------|-------------|-----------|
| Levels 1-3 | Relayer-sponsored (free) | Embedded wallet sponsorship — zero friction onboarding |
| Level 3+ (embedded) | Relayer charges Gold | `batchChargeGasGoldWithCounts()` — fault-tolerant, per-player tx counts, partial charges |
| Level 3+ (MetaMask) | Gold → ETH auto-swap via DEX | `buyGas()` swaps on-chain via Uniswap V3 |

**Critical distinction:** Gold is **not burned** — it's **sold on the DEX** to whoever is buying. The gold re-enters circulation through the DEX buyer. This makes the gas mechanism a **redistribution + sell pressure source**, not a permanent sink.

Implementation:
- **Embedded wallets**: Self-hosted relayer batches Gold charges every 5 min via `batchChargeGasGoldWithCounts()`, sells accumulated Gold on DEX every hour via `swapGoldForEth()`
- **MetaMask wallets**: `buyGas()` swaps Gold on-chain via Uniswap V3 SwapRouter02 (`exactInputSingle` GOLD→WETH, then unwrap WETH→ETH to player)
- **Fallback**: When `GasStationSwapConfig.swapRouter == address(0)`, falls back to burn+treasury pattern

### Gas Costs on Base L2

Post-Dencun (EIP-4844), Base L2 gas costs are extremely low:

| Transaction Type | Typical Gas Cost (ETH) | USD Equivalent |
|-----------------|----------------------|----------------|
| Simple transfer | ~$0.0001 | Negligible |
| MUD system call (combat, shop) | ~$0.001–$0.005 | ~$0.003 avg |
| Complex multi-table write | ~$0.005–$0.01 | ~$0.007 avg |
| Uniswap V3 swap | ~$0.003–$0.01 | ~$0.005 avg |

**Average per-transaction gas cost: ~$0.003**

### Player Transaction Volume

| Player Type | Transactions/Day | Daily Gas Cost (ETH) | Daily Gas Cost (USD) |
|------------|-----------------|---------------------|---------------------|
| Casual (levels 3-5) | 30 | ~$0.09 | ~$0.09 |
| Average (levels 5-7) | 60 | ~$0.18 | ~$0.18 |
| Dedicated (levels 7+) | 100 | ~$0.30 | ~$0.30 |
| Hardcore | 150 | ~$0.45 | ~$0.45 |

Using 60 tx/day ($0.18/day) as the average baseline.

**Practical note:** Each auto-swap itself costs gas (~$0.005). So players won't swap per-transaction — they'll batch, swapping enough gold for ~50-100 transactions at once. This means ~1-2 DEX swaps per player per day, not 60.

### Daily Gas Sell Pressure (Gold Sold on DEX for Gas)

Gas costs on Base L2 are fixed in fiat terms (~$0.18/player/day at 60 transactions). The gold cost of gas varies inversely with gold's market price — more gold is needed when the price is low, less when it is high. This creates a self-correcting dynamic in the gas mechanism: at lower gold prices, gas consumes a larger share of player income (reducing the attractiveness of playing), while at higher prices gas becomes a negligible cost.

### Gold Acquisition Paths

Gold can be acquired through two paths:

1. **Gameplay earning**: Killing monsters, completing quests, selling items to other players on the marketplace.
2. **DEX purchase**: Trading ETH for gold on the Uniswap V3 pool.

Players buy gold on the DEX when they need more gold than they can earn through gameplay alone. Primary reasons include: purchasing items on the marketplace, covering repair costs for expensive gear, funding guild treasuries, and acquiring gold faster than grinding allows.

### Marketplace ↔ DEX Interaction

The marketplace is **gold-only** — all item trading happens in gold. This creates a fundamental link between the DEX and the in-game economy:

```
NEW PLAYER → buys gold on DEX → buys items on marketplace → gold goes to seller
                                                                    ↓
SELLER → uses gold for repairs/guilds (SINK) ← or → sells gold on DEX (SELL PRESSURE)
```

**The marketplace is a gold recycling mechanism.** It doesn't create or destroy gold (except the 3% fee to protocol). It moves gold from buyers to sellers. The net effect on the DEX depends on whether sellers hold gold or sell it.

**Marketplace volume drives DEX volume:**
- Higher marketplace activity → more players need gold → more DEX buying
- More item scarcity → higher marketplace prices → more gold needed → more DEX buying
- Item degradation → constant gold demand for repairs → constant DEX buying

**Estimated marketplace contribution to DEX volume:**

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

### Starting DEX Liquidity

**Uniswap V3 concentrated liquidity** is dramatically more capital-efficient than V2:

| V3 Range Width | Capital Efficiency vs V2 |
|---------------|-------------------------|
| ±50% | ~3.4x |
| ±20% | ~8.5x |
| ±10% | ~17x |
| ±5% | ~34x |

**Production pool:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Pool | GOLD/WETH on Uniswap V3 (Base) | |
| Initial seed | 0.5 ETH + ~240K Gold | Conservative start; deepened by Patron system over time |
| Initial price | ~$0.002/gold (1,250,000 gold per ETH at $2,500 ETH) | Deliberately low — let price appreciate with growth |
| Range | ±50% ($0.001–$0.003/gold) | Wide range for thin pool — prevents single buy exhausting liquidity |
| Effective depth | ~$4,250 V2-equivalent (at ±50%) | Sufficient for gas refuel swaps (<$2 each) |
| Fee tier | 0.3% (3000 bps) | Matches beta pool; balances LP revenue and trader costs |

**Why start low ($0.002 vs. $0.01):**
- Low Gold price = high marketplace velocity (players trade freely, items feel cheap in dollar terms)
- Gradual appreciation rewards early players and creates a healthy growth narrative
- Inverse of typical crypto game pattern (high launch → dump). UD pattern: low launch → organic growth.
- Relayer becomes self-sustaining above ~$0.003/gold (see Relayer Sustainability below)

**Slippage analysis** (at 0.5 ETH seed, ±50% range):

| Swap Size | USD Value at $0.002/gold | Estimated Slippage |
|-----------|------------------------|-------------------|
| 20 gold (single gas refuel) | $0.04 | <0.01% |
| 200 gold (day's gas supply) | $0.40 | <0.01% |
| 5,000 gold (marketplace purchase) | $10 | ~0.2% |
| 50,000 gold (large cashout) | $100 | ~2-4% |

Daily gas sell pressure across all players is tiny at early DAU — individual swaps are effectively zero slippage.

**Pool buy-out scenario:** With ±50% range, buying ALL Gold from the pool costs ~0.236 ETH ($590) and moves price from $0.002 to $0.003 (1.5x). This is manageable — see Founder Reserve as Market Maker below.

**Who provides liquidity?** The protocol seeds the initial pool. LP fees (0.3% of all swap volume) accrue to the liquidity provider. Patron of the Realm deepens the pool over time.

### LP Fee Revenue

Liquidity providers earn 1% of all swap volume on the GOLD/WETH pool. LP fee revenue scales proportionally with DEX volume, which in turn scales with player count and marketplace activity.

### LP Incentive System — Patron of the Realm `[PLANNED]`

Players can deepen the GOLD/ETH pool by depositing ETH through an in-game interface. The protocol pairs the ETH with minted gold and adds both to the Uniswap V3 pool. Players receive tiered in-game titles and perks (social status and convenience, never combat power) that persist only while their deposit remains active.

**Tiers**: Bronze (0.01 ETH) → Silver (0.05 ETH) → Gold (0.1 ETH) → Diamond (0.5+ ETH). Diamond-tier Patrons get an NPC permanently named after them.

This solves the cold-start liquidity problem: early LP fee yield alone can't attract capital, but in-game identity and status can. Players provide liquidity because they want the title, not the APY.

The pool launches at the 1% fee tier (highest standard V3 tier) to maximize LP returns during low-volume early period, with a migration path to lower tiers as volume grows.

See [ECONOMICS.md — Patron of the Realm](./ECONOMICS.md) for the full design.

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

## Item Economy Interaction

Gold supply doesn't exist in isolation — it interacts with the item economy:

### Items as Value Store

Per the game's design philosophy, **rare items are the actual value store**, not gold. Gold is the medium of exchange. This means:

- Rare item drops create demand for gold (players need gold to buy items on marketplace)
- Item scarcity drives marketplace trading volume (which drives fee revenue)
- Item sinks (repairs, crafting, PvP drops) remove items AND gold simultaneously

### Item Degradation as Dual Economic Driver

Item repair creates a virtuous economic cycle:

```
Combat → Items degrade → Player needs gold for repairs (SINK)
                       → Player needs gold to replace broken items (DEMAND)
                       → Drives marketplace trading (REVENUE)
                       → Items that trade also degrade for new owner
                       → Cycle continues
```

This creates **compounding economic activity** — every item repair drives marketplace volume which drives fee revenue, while also burning gold from the supply. One mechanic drives both sink and revenue.

### Drop Rate Impact

Current beta rates are elevated for testing (dropChance=75 for many items). Production rates will be significantly lower, which:
- Increases item rarity → increases marketplace trading volume → increases fee revenue
- Increases gold demand (need more gold to buy rare items)
- Makes item repair more meaningful (losing a rare item to neglected durability hurts)

---

## Economic Levers (Admin-Configurable)

These parameters can be adjusted on-chain without redeployment:

| Lever | Current Value | Range | Effect |
|-------|--------------|-------|--------|
| Marketplace fee % | 3% (300 bps) | 1-10% | Revenue rate + indirect inflation control |
| Base gold drop | 5 gold | 1-20 | Controls faucet rate |
| Drop multiplier | 1x (per zone) | 0.1-5x | Zone-specific tuning |
| Shop markup | 20% | 10-50% | Shop spread |
| Shop markdown | 50% | 30-70% | Shop spread |
| GasStation swap threshold | TBD (min gold to trigger auto-swap) | Variable | Controls gas refuel frequency and DEX impact |
| Flee penalty (PvE) | 5% | 1-20% | Risk/reward tuning |

**Key principle**: Start with moderate sink rates and increase if inflation appears. It's easier to strengthen sinks than to reverse deflation. The marketplace fee percentage also serves as an indirect inflation lever — higher fees reduce the gold players receive from trades, which slows circulation velocity.

---

## Open Questions

- [ ] Final pre-launch distribution amount
- [ ] Vesting schedule and lockup terms
- [ ] Whether to implement on-chain vesting contract or manual lockup
- [ ] Item durability implementation details (UI, repair NPCs, degradation curve)
- [ ] Guild system implementation timeline
- [ ] Marketplace fee: keep at 3% or adjust
- [x] ~~Confirm initial DEX liquidity amount and initial gold price~~ — Resolved: 0.5 ETH + ~240K Gold at $0.002/gold on 0.3% fee tier. Deepened over time via Patron system.
- [ ] How to communicate allocation to players (transparency post, docs update)
- [ ] Death penalty: implement as escrow burn or wallet burn
- [ ] Fee recipient: single wallet, multisig, or DAO treasury
- [x] **GasStation redesign**: Rewritten to swap via Uniswap V3 on-chain + relayer off-chain path. Fallback to burn+treasury when pool not configured.
- [x] Uniswap V3 pool deployment (beta): 0.3% fee tier pool at `0x4338173e5557Eed1638c03c28f3502AD9Bb03e0f`. Production pool pending.
- [x] Gas batching UX: Auto-swap triggers when ETH balance < 0.0001 ETH, rate-limited to once per 60s client-side
- [x] ~~Relayer batch charging~~ — `batchChargeGasGoldWithCounts()` implemented with fault tolerance, partial charges, per-player tx counts. Relayer `gasCharge.ts` module with 5-min flush + 1-hour swap scheduler.
- [ ] LP incentive system design — Patron of the Realm (single-sided ETH deposit, protocol pairs with gold) vs standard LP farming
- [ ] Anti-speculation: marketplace cooldown (24-48h relist delay) implementation
- [ ] Anti-speculation: progressive marketplace fees (3% → 5% → 10% for rapid relists)
- [ ] Autonomous buyback mechanism — use marketplace fee revenue to buy gold on DEX?

---

## Sink Implementation Roadmap

Priority order based on economic impact and implementation complexity:

| Priority | Sink | Impact | Complexity | Notes |
|----------|------|--------|------------|-------|
| 1 | Item degradation + repair | Very High | Medium | New table (Durability), UI for repair, NPC interaction |
| 2 | Death penalty (escrow burn) | Medium | Low | Add burn to PvE/PvP loss handlers |
| 3 | Increase PvE flee penalty to 10% | Low | Low | Change constant |
| 4 | Guild creation burn | Medium | High | Part of guild system implementation |
| 5 | Guild upkeep burn | High | High | Requires territory system |
| 6 | Cosmetic/aspirational sinks | Medium | Medium | Title system, name changes |
| 7 | Stat respec fee | Low | Low | Simple gold check before respec |
| 8 | Gold offerings (shrine sacrifice) | Medium | Low | Temporary drop rate boost, permanent burn |
| 9 | XP boost purchase | Low | Low | Temporary XP multiplier, permanent burn |

---

## Next Steps

1. ~~**Redesign GasStation**~~ — Done. `buyGas()` now swaps via Uniswap V3 when configured, with burn+treasury fallback. Relayer `chargeGasGold()` added for embedded wallets.
2. ~~**Deploy Uniswap V3 GOLD/ETH pool**~~ — Done on beta. Pool: `0x4338173e5557Eed1638c03c28f3502AD9Bb03e0f` (0.3% fee tier). Production pool pending — see deploy-guide.md launch checklist.
3. Implement item degradation system — highest-impact permanent sink, creates compounding demand
4. Add death penalty (5% PvE, 10% PvP escrow burn)
5. Increase PvE flee penalty to 10%
6. Run economic simulation with beta data (actual kills/day, trading volume, flee rate)
7. Finalize pre-launch distribution amount based on target growth scenario
8. Implement on-chain vesting contract if applicable
9. Design guild economic system (creation, upkeep, dissolution)
10. Prepare public-facing tokenomics announcement
11. Production pool seeding (0.5 ETH + ~240K Gold, ±50% range, 0.3% fee tier)
12. Patron of the Realm LP incentive system design + implementation
13. Gold offerings shrine system (permanent burn sink)
14. Autonomous buyback mechanism evaluation (marketplace fees → gold purchase on DEX)
15. Anti-speculation: marketplace cooldown implementation (24-48h relist delay)
16. Anti-speculation: progressive marketplace fees for rapid relists
17. Item permanent destruction mechanic (failed repair, crafting sacrifice, or PvP full-loot) — critical for items-as-value-store thesis

---

*Last updated: March 3, 2026 — Added company revenue model (USD), pool dynamics, whale scenarios, price strategy, relayer sustainability, speculation dynamics, anti-speculation protections.*
