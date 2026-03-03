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

**Why <100% is acceptable during launch**: New players entering the economy create gold demand (they need gold to buy items, join guilds, repair gear). During growth, moderate inflation rewards early players and ensures new players can earn gold at a reasonable rate. Target higher sink coverage only at steady state when growth slows.

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

### Marketplace Fee Revenue in USD (at Different Gold Prices)

Revenue depends on gold's market price once tradeable on a DEX:

| DAU | Annual Fee (gold) | At $0.001/gold | At $0.01/gold | At $0.10/gold |
|-----|-------------------|----------------|---------------|---------------|
| 50 | ~82K | $82/yr | $820/yr | $8,200/yr |
| 150 | ~246K | $246/yr | $2,460/yr | $24,600/yr |
| 500 | ~821K | $821/yr | $8,210/yr | $82,100/yr |
| 1,500 | ~2.5M | $2,500/yr | $25,000/yr | $250,000/yr |
| 5,000 | ~8.2M | $8,200/yr | $82,000/yr | $820,000/yr |

**Reality check**: Axie at 50K DAU generates ~$4M/year in fee revenue with a 4.25% fee. That implies marketplace volume of ~$94M/year, or ~$5.15/DAU/day. At $0.01/gold, our moderate estimate of 150 gold/DAU/day = $1.50/DAU/day — conservative but realistic for a browser RPG without Axie's speculative NFT economy.

### Revenue Milestones

| Milestone | Required | Notes |
|-----------|----------|-------|
| Cover infrastructure ($200/mo) | ~500 DAU at $0.01/gold | Vercel + Railway + RPC costs |
| Cover infrastructure + time ($2K/mo) | ~1,500 DAU at $0.01/gold | Part-time sustainable |
| Meaningful revenue ($10K/mo) | ~5,000 DAU at $0.01/gold | Or 1,500 DAU at $0.05/gold |
| Full-time sustainable ($50K/yr) | ~1,500 DAU at $0.05/gold | Or 5,000 DAU at $0.01/gold |

---

## Founder & Team Allocation

### Industry Context

On-chain games typically allocate 15-25% of token supply to the founding team, with vesting schedules of 3-4 years and a 1-year cliff. Notable approaches:

- **Standard model**: Fixed supply token, 18-25% team allocation, 4-year vest
- **Fair launch model**: 0% team allocation, all tokens from gameplay (Big Time)
- **Fee capture model**: No token allocation, team earns from marketplace/protocol fees

### Dual Value Streams

The founder captures value through two independent mechanisms:

1. **Pre-launch gold allocation** — Fixed amount minted before the economy goes live. Percentage of total supply decreases over time as more gold enters through gameplay.
2. **Ongoing marketplace fee revenue** — 3% of all trading volume, scaling naturally with the economy. No additional token creation required.

### Combined Founder Value Projection

Modeling total founder value (allocation + cumulative marketplace fee revenue) after Year 1:

**At moderate growth (500 DAU year-end) with 5M gold pre-launch allocation:**

| Component | Gold | At $0.01/gold | At $0.05/gold | At $0.10/gold |
|-----------|------|---------------|---------------|---------------|
| Pre-launch allocation | 5M | $50,000 | $250,000 | $500,000 |
| Year 1 marketplace fee revenue | ~821K | $8,210 | $41,050 | $82,100 |
| **Total Year 1** | **5.82M** | **$58,210** | **$291,050** | **$582,100** |
| Allocation as % of Year 1 supply | ~15% | — | — | — |

**At strong growth (1,500 DAU year-end) with 5M gold pre-launch allocation:**

| Component | Gold | At $0.01/gold | At $0.05/gold | At $0.10/gold |
|-----------|------|---------------|---------------|---------------|
| Pre-launch allocation | 5M | $50,000 | $250,000 | $500,000 |
| Year 1 marketplace fee revenue | ~2.5M | $25,000 | $125,000 | $250,000 |
| **Total Year 1** | **7.5M** | **$75,000** | **$375,000** | **$750,000** |
| Allocation as % of Year 1 supply | ~5% | — | — | — |

**At breakout growth (5,000 DAU year-end) with 5M gold pre-launch allocation:**

| Component | Gold | At $0.01/gold | At $0.05/gold | At $0.10/gold |
|-----------|------|---------------|---------------|---------------|
| Pre-launch allocation | 5M | $50,000 | $250,000 | $500,000 |
| Year 1 marketplace fee revenue | ~8.2M | $82,000 | $410,000 | $820,000 |
| **Total Year 1** | **13.2M** | **$132,000** | **$660,000** | **$1,320,000** |
| Allocation as % of Year 1 supply | ~1% | — | — | — |

**Key insight**: At strong+ growth, marketplace fee revenue exceeds the pre-launch allocation within Year 1. The allocation matters most in low-growth scenarios; in high-growth scenarios, the fee revenue dominates.

### Allocation Modeling

If target is ~20% of circulating supply after Year 1:

| Growth Scenario | Circulating Year 1 (planned sinks) | 20% Allocation |
|----------------|-----------------------------------|----------------|
| Slow | ~2.6M | ~520K |
| Steady | ~8.3M | ~1.7M |
| Moderate | ~26.6M | ~5.3M |
| Strong | ~89M | ~17.8M |

### Recommended Approach

A **fixed pre-launch distribution** in the range of **3-10M gold**, representing:
- ~20% at moderate growth
- ~6% at strong growth
- ~1% at breakout growth

This naturally dilutes as the economy grows, while marketplace fee revenue grows proportionally. The two mechanisms balance each other: the allocation provides value in early/low-growth scenarios, the fee revenue provides value in high-growth scenarios.

### Lockup & Transparency

Any pre-launch distribution should include:
- Public announcement of the allocation and rationale
- Defined lockup period (industry standard: 1-year cliff, 3-4 year linear vest)
- On-chain vesting contract for transparency
- Clear separation from gameplay-earned gold

---

## DEX Market Model

Gold will be tradeable on a Uniswap V3 GOLD/ETH pool on Base. This section models the natural gold market — excluding speculation — and how the DEX interacts with the gold-only in-game marketplace.

### GasStation: Current Implementation vs Vision

The current `GasStationSystem.sol` **burns gold from total supply** and sends ETH from a pre-funded treasury at a fixed exchange rate. This is not the intended design.

**Intended design:**

| Phase | Gas Coverage | Mechanism |
|-------|-------------|-----------|
| Levels 1-3 | Thirdweb paymaster (free) | Embedded wallet sponsorship — zero friction onboarding |
| Level 3+ (all wallets) | Gold → ETH auto-swap via DEX | Player's gold is sold on the GOLD/ETH pool; ETH received covers gas |

**Critical distinction:** In the intended model, gold is **not burned** — it's **sold on the DEX** to whoever is buying. The gold re-enters circulation through the DEX buyer. This makes the gas mechanism a **redistribution + sell pressure source**, not a permanent sink.

The GasStation has been redesigned:
- **MetaMask wallets**: `buyGas()` swaps gold on-chain via Uniswap V3 SwapRouter02 (`exactInputSingle` GOLD→WETH, then unwrap WETH→ETH to player)
- **Embedded wallets**: Self-hosted relayer calls `chargeGasGold()` to charge gold from players, then runs an off-chain cron script (`swap-gold.ts`) to sell accumulated gold on the DEX for ETH to self-fund
- **Fallback**: When `GasStationSwapConfig.swapRouter == address(0)`, falls back to the original burn+treasury pattern

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

Gold needed per player depends on the gold/USD price:

| Gold Price | Gold Needed/Player/Day | At 100 DAU | At 500 DAU | At 1,500 DAU |
|-----------|----------------------|-----------|-----------|-------------|
| $0.001 | 180 gold | 18,000 gold ($18) | 90,000 gold ($90) | 270,000 gold ($270) |
| $0.005 | 36 gold | 3,600 gold ($18) | 18,000 gold ($90) | 54,000 gold ($270) |
| $0.01 | 18 gold | 1,800 gold ($18) | 9,000 gold ($90) | 27,000 gold ($270) |
| $0.05 | 3.6 gold | 360 gold ($18) | 1,800 gold ($90) | 5,400 gold ($270) |
| $0.10 | 1.8 gold | 180 gold ($18) | 900 gold ($90) | 2,700 gold ($270) |

**Key insight: Gas sell pressure is constant in USD terms** (~$0.18/player/day), regardless of gold price. At higher gold prices, fewer gold tokens are sold. This is naturally stabilizing — if gold price rises, less gold hits the DEX; if it falls, more gold hits but each unit is worth less.

**Gas sell pressure as % of player income:**

| Gold Price | Gold for Gas/Day | Player Income (500 gold/day) | Gas as % of Income |
|-----------|-----------------|-------|-------------------|
| $0.001 | 180 gold | 500 gold | **36%** — punishing |
| $0.005 | 36 gold | 500 gold | **7.2%** — noticeable |
| $0.01 | 18 gold | 500 gold | **3.6%** — comfortable |
| $0.05 | 3.6 gold | 500 gold | **0.7%** — negligible |
| $0.10 | 1.8 gold | 500 gold | **0.4%** — negligible |

This suggests a natural floor: if gold price drops below ~$0.001, gas costs consume most of player income, making the game unplayable and driving players away (reducing sell pressure). Above ~$0.005, gas is a minor cost.

### Natural Buy Pressure Sources

Excluding speculation, gold demand comes from players who need gold and don't have enough from gameplay:

| Source | Mechanism | Daily Volume (500 DAU) | Notes |
|--------|-----------|----------------------|-------|
| New player gold acquisition | Buy gold on DEX to purchase starter items on marketplace | ~5,000–20,000 gold | 10-20 new players × 500-1,000 gold each |
| Repair-constrained players | Players who spend more on repairs than they earn need to buy gold | ~5,000–15,000 gold | Especially late-game players with expensive gear |
| Guild treasury contributions | Guild leaders may buy gold to fund treasury | ~2,000–10,000 gold | Especially competitive guilds |
| Marketplace-driven demand | Player wants a specific item, buys gold to afford it | ~5,000–25,000 gold | Driven by item scarcity and marketplace listings |
| **Total natural buy pressure** | | **~17,000–70,000 gold/day** | |

At $0.01/gold, that's **$170–$700/day** in natural buy-side volume at 500 DAU.

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

### DEX Volume Synthesis

Combining gas sell pressure and marketplace-driven flows at **500 DAU, $0.01/gold**:

**SELL SIDE (gold → ETH on DEX):**

| Source | Gold/Day | USD/Day |
|--------|---------|---------|
| Gas auto-swaps | 9,000 | $90 |
| Player cashouts (earn-to-play) | ~5,000 | $50 |
| Marketplace sellers cashing out | ~15,000 | $150 |
| **Total daily sell** | **~29,000** | **~$290** |

**BUY SIDE (ETH → gold on DEX):**

| Source | Gold/Day | USD/Day |
|--------|---------|---------|
| New players buying gold | ~10,000 | $100 |
| Marketplace buyers acquiring gold | ~30,000 | $300 |
| Repair/guild demand (gold-poor players) | ~8,000 | $80 |
| **Total daily buy** | **~48,000** | **~$480** |

**Net daily flow: ~$190/day BUY pressure** (during growth phase at 500 DAU)

This buy-side surplus exists because:
1. The game is growing (new players entering)
2. Sinks destroy gold, creating deficit for some players who need to buy
3. Item scarcity makes marketplace demand inelastic

At steady state (no new players), buy pressure reduces and approaches equilibrium with sell pressure. If the player base shrinks, sell pressure dominates and gold price declines — which is appropriate since it reflects declining demand.

### Starting DEX Liquidity

**Uniswap V3 concentrated liquidity** is dramatically more capital-efficient than V2:

| V3 Range Width | Capital Efficiency vs V2 |
|---------------|-------------------------|
| ±50% | ~3.4x |
| ±20% | ~8.5x |
| ±10% | ~17x |
| ±5% | ~34x |

**Recommended starting position:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Pool | GOLD/WETH on Uniswap V3 (Base) |  |
| Initial price | $0.01/gold (10,000 gold per $100 ETH) | Conservative starting price — can appreciate with growth |
| Liquidity provided | $2,000–$5,000 total ($1,000-$2,500 ETH + equivalent gold) | Concentrated in ±20% range |
| Effective depth | ~$17,000–$42,500 V2-equivalent | Sufficient for $100+ swaps at <1% slippage |
| Fee tier | 1% (10,000 bps) | Low volume, high volatility — standard for new tokens on V3 |

**Slippage analysis for gas auto-swaps** (at $3,000 starting liquidity, ±20% range):

| Swap Size | USD Value at $0.01/gold | Estimated Slippage |
|-----------|------------------------|-------------------|
| 20 gold (single gas refuel) | $0.20 | <0.01% |
| 200 gold (day's gas supply) | $2.00 | <0.05% |
| 5,000 gold (marketplace purchase) | $50.00 | ~0.3% |
| 50,000 gold (large cashout) | $500.00 | ~3-5% |

Daily gas sell pressure of ~$90 across 500 players means individual swaps are tiny ($0.20-$2.00 each) — slippage is effectively zero even with minimal starting liquidity.

**Who provides liquidity?** The protocol seeds the initial pool. LP fees (1% of all swap volume) accrue to the protocol as a third revenue stream alongside marketplace fees and the founder allocation.

### LP Fee Revenue Estimate

| DAU | Daily DEX Volume (USD) | Annual LP Fees (1%) |
|-----|----------------------|-------------------|
| 100 | ~$60 | ~$220 |
| 500 | ~$770 | ~$2,800 |
| 1,500 | ~$2,300 | ~$8,400 |
| 5,000 | ~$7,700 | ~$28,000 |

LP fees are modest but cover the cost of providing liquidity and grow proportionally with the game.

### Gold Price as Game Health Signal

Because gold's DEX price is driven by natural supply/demand rather than speculation (by design), the price becomes a transparent indicator of game health:

| Game State | DEX Dynamic | Gold Price Trend |
|-----------|------------|-----------------|
| Growing (new players > churn) | Buy pressure > sell pressure | Appreciates |
| Stable (new ≈ churn) | Buy ≈ sell | Stable |
| Declining (churn > new) | Sell pressure > buy pressure | Depreciates |

This is a feature, not a bug. The gold price honestly reflects the state of the economy. No artificial pegs, no buybacks, no manipulation — the price is what it is.

### Price Range Scenarios (Year 1)

| Growth Scenario | Expected Price Range | Basis |
|----------------|---------------------|-------|
| Slow (50 DAU) | $0.001–$0.005 | Minimal buy pressure, gas costs dominate |
| Steady (150 DAU) | $0.003–$0.01 | Moderate marketplace activity |
| Moderate (500 DAU) | $0.005–$0.03 | Healthy marketplace, strong gold demand |
| Strong (1,500 DAU) | $0.01–$0.10 | Deep marketplace, item scarcity drives demand |
| Breakout (5,000 DAU) | $0.05–$0.50+ | Speculation would likely enter at this scale |

These are rough ranges based on natural supply/demand dynamics. Actual prices depend on player behavior, sink effectiveness, and marketplace liquidity.

### Self-Correcting Mechanisms

The gold economy has several natural stabilizers:

1. **Gas cost floor**: If gold price drops too low, gas becomes unaffordable (36% of income at $0.001). Players leave → less sell pressure → price stabilizes.
2. **Repair demand floor**: Players MUST repair items to keep playing. If gold is cheap, repair costs are trivial and more gold stays in the economy. If gold is expensive, repair costs drive players to the DEX to buy gold.
3. **Marketplace arbitrage**: If gold is cheap on DEX, players buy gold to buy underpriced items on marketplace. If gold is expensive, players grind rather than buying.
4. **Admin levers**: Base gold drop rate, repair costs, marketplace fee, and drop rates can all be adjusted to tune supply/demand (see Economic Levers section).

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
- [ ] Confirm initial DEX liquidity amount ($2,000-$5,000 range) and initial gold price ($0.01 target)
- [ ] How to communicate allocation to players (transparency post, docs update)
- [ ] Death penalty: implement as escrow burn or wallet burn
- [ ] Fee recipient: single wallet, multisig, or DAO treasury
- [x] **GasStation redesign**: Rewritten to swap via Uniswap V3 on-chain + relayer off-chain path. Fallback to burn+treasury when pool not configured.
- [ ] Uniswap V3 pool deployment: Run `DeployGoldPool.s.sol` to create and seed GOLD/WETH pool (1% fee tier, initial price ~$0.01/gold)
- [x] Gas batching UX: Auto-swap triggers when ETH balance < 0.0001 ETH, rate-limited to once per 60s client-side

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

---

## Next Steps

1. ~~**Redesign GasStation**~~ — Done. `buyGas()` now swaps via Uniswap V3 when configured, with burn+treasury fallback. Relayer `chargeGasGold()` added for embedded wallets.
2. **Deploy Uniswap V3 GOLD/ETH pool** — Run `DeployGoldPool.s.sol` to seed with initial liquidity. Configure `GasStationSwapConfig` with pool addresses.
3. Implement item degradation system — highest-impact permanent sink, creates compounding demand
4. Add death penalty (5% PvE, 10% PvP escrow burn)
5. Increase PvE flee penalty to 10%
6. Run economic simulation with beta data (actual kills/day, trading volume, flee rate)
7. Finalize pre-launch distribution amount based on target growth scenario
8. Implement on-chain vesting contract if applicable
9. Design guild economic system (creation, upkeep, dissolution)
10. Prepare public-facing tokenomics announcement

---

*Last updated: March 2026*
