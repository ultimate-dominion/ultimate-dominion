# Ultimate Dominion — Economics

Comprehensive developer reference for the game economy — gold generation, sinks, marketplace, shops, item economy, drop rates, DEX integration, anti-speculation protections, and economic levers.

> **See also:** [Gold Supply & Distribution Plan](GOLD_SUPPLY_PLAN.md) for supply modeling, founder allocation, and long-term projections.

---

## Philosophy

- **Infinite gold supply** with sinks designed to outstrip creation over time
- **Gold is the medium of exchange**, rare items are the actual value store — Gold appreciates slowly, items appreciate fast
- **Marketplace is the core economic engine** — fee on all trades
- **DEX liquidity** enables gold to be traded externally
- **Price strategy**: Keep Gold cheap during growth to maximize marketplace velocity. Let price appreciate naturally as sinks, player demand, and reduced sell pressure tighten supply. Revenue comes from volume, not price.
- **The game is insulated from its own token price** — gameplay is Gold-denominated. A player who never touches the DEX doesn't know or care what Gold is worth in ETH.

---

## Gold Token

Gold is an **ERC20 token** on Base. It is the sole currency for all in-game transactions: shops, marketplace, PvP escrow, and rewards.

---

## Gold Generation

Gold drops from monster kills. Drop amounts scale with mob level via the formula: `goldDrop = (random % (BASE_GOLD_DROP * mobLevel)) + 0.05`. Elite monsters get a 1.5x multiplier.

| Mob Level | Gold Range | Average |
|-----------|------------|---------|
| 1 | 0.05–3 | ~1.5 gold |
| 3 | 0.05–9 | ~4.5 gold |
| 5 | 0.05–15 | ~7.5 gold |
| 7 | 0.05–21 | ~10.5 gold |
| 10 | 0.05–30 | ~15.0 gold |

**Current implementation**: `BASE_GOLD_DROP = 3` (on-chain constant). Scales with mob level.

**Anti-farming**: If player is 5+ levels above mob, no gold drops. `[PLANNED]` — prevents high-level farming of easy content.

### Player Activity Assumptions

Based on browser RPG benchmarks and early playtesting:

| Metric | Conservative | Moderate | Optimistic |
|--------|-------------|----------|------------|
| Kills per hour | 15 | 20 | 25 |
| Hours per day per player | 1 | 2 | 3 |
| Average mob level (month 1) | 3 | 5 | 5 |
| Average mob level (month 6) | 5 | 7 | 8 |
| Average mob level (year 1) | 7 | 8 | 9 |

### Daily Gold Created Per Player

| Player Activity | Avg Mob Level | Gold/Kill | Kills/Day | Gold/Day |
|----------------|---------------|-----------|-----------|----------|
| Casual | 3 | 4.5 | 15 | 68 |
| Average | 5 | 7.5 | 40 | 300 |
| Dedicated | 7 | 10.5 | 60 | 630 |
| Hardcore | 10 | 15.0 | 75 | 1,125 |

### Gold Creation at Scale

Assuming 20 kills/hour, 2 hours/day average per player, avg mob level 5 (~7.5 gold/kill):

| Players | Avg Level | Daily Gold Created |
|---------|-----------|-------------------|
| 10 | 5 | ~3,000 gold |
| 50 | 5 | ~15,000 gold |
| 100 | 5 | ~30,000 gold |

---

## Gold Sinks

### Sink Classification

1. **Permanent burns** — Gold destroyed from total supply. True sinks.
2. **Protocol revenue** — Gold transferred to fee recipient wallet. Removed from player economy but not from total supply. This is company revenue, not a sink.
3. **Redistributions** — Gold moves between players. Total supply unchanged.

### Implemented

| Sink | Mechanism | Type | Removes from supply? |
|------|-----------|------|---------------------|
| Marketplace fee | 3% per trade → fee recipient | Protocol revenue | No — intentional revenue |
| Shop buy/sell spread | 20% markup buy / 50% markdown sell | Redistribution | No |
| PvE flee penalty | 5% of escrow burned (min 20 escrow). Smoke Cloak negates. | Permanent burn | Yes |
| PvP flee penalty | 10% of escrow (5% burned + 5% to opponent, min 10 escrow). Smoke Cloak negates. | Permanent burn + redistribution | 5% yes, 5% no |
| PvE death penalty | 5% of escrow burned (min 20 escrow) | Permanent burn | Yes |
| PvP death penalty | 50% of loser escrow (10% burned + 40% to winners) | Permanent burn + redistribution | 10% yes, 40% no |
| GasStation (MetaMask) | Gold sold on Uniswap V3 GOLD/WETH pool for ETH | DEX sell pressure | No — gold re-enters circulation via DEX buyers |
| GasStation (embedded) | Relayer charges gold from player, sells on DEX off-chain | Relayer charge | No — gold re-enters circulation via DEX buyers |
| GasStation (fallback) | Gold burned, ETH from treasury at fixed rate (when DEX not configured) | Permanent burn | Yes — legacy fallback only |

**Current burn rate is moderate.** Four mechanisms permanently remove gold: PvE flee (5%), PvP flee (5% burn portion), PvE death (5%), and PvP death (10% burn portion). The PvP death penalty is the most impactful — losers forfeit 50% of escrow, with 10% burned and 40% redistributed to winners. The GasStation swaps gold on the Uniswap V3 GOLD/WETH pool instead of burning — gold re-enters circulation via DEX buyers (see DEX Integration section).

**Key insight**: The marketplace fee is a compounding sink. Every time an item changes hands, a percentage disappears. A legendary that trades 10 times removes significant gold from circulation.

### Planned Sinks `[PLANNED]`

#### Tier 1: Permanent Burns (Gold Destroyed)

##### Item Degradation & Repair

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

##### Flee Penalty Tuning

Current flee penalties are implemented. Possible future tuning:

| Current | Proposed | Rationale |
|---------|----------|-----------|
| 5% PvE flee | 10% PvE flee | Dragon Quest standard; meaningful risk for fleeing |

##### Guild Creation

One-time cost, permanently burned.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Guild creation fee | 2,000 gold | ~4 days of average player income; meaningful commitment |
| Guild name change | 1,000 gold | Discourage frivolous changes |

#### Tier 2: Recurring Burns (Guild System)

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

#### Tier 3: Aspirational Sinks (Voluntary)

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

### Sink Implementation Roadmap

Priority order based on economic impact and implementation complexity:

| Priority | Sink | Impact | Complexity | Notes |
|----------|------|--------|------------|-------|
| 1 | Item degradation + repair | Very High | Medium | New table (Durability), UI for repair, NPC interaction |
| ~~2~~ | ~~Death penalty (escrow burn)~~ | ~~Medium~~ | ~~Low~~ | **Done** — PvE 5% burn, PvP 10% burn + 40% to winners |
| 3 | Increase PvE flee penalty to 10% | Low | Low | Change constant |
| 4 | Guild creation burn | Medium | High | Part of guild system implementation |
| 5 | Guild upkeep burn | High | High | Requires territory system |
| 6 | Cosmetic/aspirational sinks | Medium | Medium | Title system, name changes |
| 7 | Stat respec fee | Low | Low | Simple gold check before respec |
| 8 | Gold offerings (shrine sacrifice) | Medium | Low | Temporary drop rate boost, permanent burn |
| 9 | XP boost purchase | Low | Low | Temporary XP multiplier, permanent burn |

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

Real USD revenue depends on gold price on DEX. See [GOLD_SUPPLY_PLAN.md — Protocol Revenue](./GOLD_SUPPLY_PLAN.md) for full USD projections.

### Industry Comparables — Marketplace Fees

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

## Shops `[IMPLEMENTED]`

NPC shops with buy/sell mechanics:

- **Buy price**: Base item price × shop markup multiplier
- **Sell price**: Base item price × shop markdown multiplier (always less than buy price)
- **Restock**: Every 12 hours, shop restocks to max inventory and max gold
- **Stock limits**: Shops have finite inventory that depletes as players buy

---

## Item Economy

### Items as the True Value Store

Gold is inflationary — it appreciates slowly as the game grows. Items are the opposite: fixed drop rates + degradation sinks make them genuinely scarce over time. **The smart speculator buys items, not Gold.** This is by design.

Projected appreciation over 2 years (steady growth to 2,000 DAU):

| Asset | Launch | Year 1 | Year 2 | Total Appreciation |
|-------|--------|--------|--------|--------------------|
| Gold ($/gold) | $0.002 | $0.005 | $0.008 | ~4x |
| Legendary item (gold price) | 5,000 gold | 50,000 gold | 200,000 gold | 40x in Gold |
| Legendary item ($ price) | $10 | $250 | $1,600 | ~160x in USD |
| Unique item ($ price) | $100 | $2,500 | $16,000 | ~160x in USD |

This is the **inverse of typical crypto game economics** — instead of launching at high price and dumping, value builds over time. Early players are rewarded for playing, not for speculating.

### Why This Works

- **Gold supply is infinite** — you can't corner an inflationary currency
- **Item supply is finite** — drop rates are fixed, degradation destroys items
- **Marketplace is Gold-denominated** — item prices in Gold are independent of Gold's ETH price
- **Every item trade generates fees** — speculative item trading is revenue-positive for the protocol

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

Current beta rates are elevated for testing (dropChance=75 for many items). Production rates will be significantly lower, which:
- Increases item rarity → increases marketplace trading volume → increases fee revenue
- Increases gold demand (need more gold to buy rare items)
- Makes item repair more meaningful (losing a rare item to neglected durability hurts)

### Item Sinks `[PLANNED]`

Items must leave circulation to maintain rarity:

- **Durability** — Items break after X uses
- **PvP drops** — Die in PvP, lose equipped items
- **Upgrading** — Sacrifice 3 rares to make 1 epic
- **Rerolling** — Destroy item to reroll stats
- **Salvage** — Destroy for crafting materials

Without item destruction, "rare" items flood the market over time.

---

## DEX Integration `[IMPLEMENTED]`

Gold is tradeable on a Uniswap V3 GOLD/WETH pool on Base (1% fee tier).

```
Players EARN gold (selling pressure)
     ↓
DEX Price
     ↑
Buyers SPEND gold (buying pressure)
```

**How it works:**
- **GasStation (MetaMask)**: `buyGas()` swaps player gold → WETH → ETH on-chain via Uniswap V3 to cover gas costs
- **GasStation (embedded wallet)**: Self-hosted relayer charges gold from players, sells on DEX off-chain to self-fund
- Gold is **traded, not burned** — it re-enters circulation through DEX buyers
- Fallback: when DEX pool is not configured, falls back to burn+treasury pattern

**Target:** Sink rates calibrated to approach equilibrium with creation rates at steady state.

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

### Gold Acquisition Paths

Gold can be acquired through two paths:

1. **Gameplay earning**: Killing monsters, completing quests, selling items to other players on the marketplace.
2. **DEX purchase**: Trading ETH for gold on the Uniswap V3 pool.

Players buy gold on the DEX when they need more gold than they can earn through gameplay alone. Primary reasons include: purchasing items on the marketplace, covering repair costs for expensive gear, funding guild treasuries, and acquiring gold faster than grinding allows.

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
| Fee tier | 1% (10000 bps) | Maximizes LP returns at low volume; matches DEFAULT_POOL_FEE constant |

**Why start low ($0.002 vs. $0.01):**
- Low Gold price = high marketplace velocity (players trade freely, items feel cheap in dollar terms)
- Gradual appreciation rewards early players and creates a healthy growth narrative
- Inverse of typical crypto game pattern (high launch → dump). UD pattern: low launch → organic growth.
- Relayer becomes self-sustaining above ~$0.003/gold

**Who provides liquidity?** The protocol seeds the initial pool. LP fees (1% of all swap volume) accrue to the liquidity provider. Patron of the Realm deepens the pool over time.

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

### LP Fee Revenue

Liquidity providers earn the 1% fee on all swap volume on the GOLD/WETH pool. LP fee revenue scales proportionally with DEX volume, which in turn scales with player count and marketplace activity.

---

## Patron of the Realm — Community Liquidity `[PLANNED]`

A system for players to deepen the GOLD/ETH trading pool by contributing liquidity through an in-game interface, without needing to understand Uniswap or DeFi mechanics.

### How It Works

1. Player visits an in-game location (Royal Treasury, Merchant Guild Hall, or similar)
2. Deposits ETH — one action, no DeFi knowledge required
3. Protocol pairs the ETH with an equivalent amount of gold and adds both to the Uniswap V3 pool
4. Player receives the "Patron of the Realm" title and tier-based perks
5. Player can withdraw their ETH at any time (subject to market conditions)

From the player's perspective, they're "investing in the realm's treasury." The Uniswap mechanics are entirely invisible.

### Patron Tiers

Tier status is active **only while the deposit remains**. Withdrawing removes the title and perks.

| Tier | Deposit | Title | Perks |
|------|---------|-------|-------|
| Bronze | 0.01 ETH | Patron | Bronze nameplate, Patron chat channel |
| Silver | 0.05 ETH | Benefactor | Silver nameplate, 5% shop discount |
| Gold | 0.1 ETH | Lord/Lady Benefactor | Gold nameplate, 10% shop discount, patron-only cosmetic |
| Diamond | 0.5+ ETH | Grand Patron of the Realm | Unique nameplate, NPC named after them, all lower perks |

**Design constraints:**
- Perks are **social status and convenience only** — never combat power. A Patron should not win fights because they are a Patron.
- The Diamond-tier "NPC named after you" is a permanent addition to the world, even if the player later withdraws. This aligns with the game's emphasis on permanence.

### Why It Matters

At early player counts, pure LP fee yield won't compete with DeFi opportunities. Patron of the Realm solves this by offering something DeFi can't: **in-game identity and status**. Players provide liquidity not for APY, but because they want the title next to their name.

Deeper liquidity benefits everyone:
- Lower slippage on gold trades
- Better gas auto-swap UX for all players
- More confidence in gold as a tradeable asset
- Patrons are aligned with the game's success — their position appreciates as the player base grows

### Fee Tier Strategy

The pool launches at the **1% fee tier** (the highest standard Uniswap V3 tier). This maximizes LP returns per swap during the low-volume early period. As volume grows and gold price stabilizes, the pool can migrate to lower fee tiers (0.30%, then 0.05%) for better trader UX.

### Risks

- **Impermanent loss**: If gold price moves significantly, Patrons may get back less ETH than deposited. The UI must clearly communicate this risk.
- **Protocol mints gold for pairing**: This increases gold supply, but is justified by the deeper pool generating more economic activity.
- **Withdrawal cascades**: A large Patron withdrawing thins the pool. Mitigation: optional time-lock bonuses (e.g., "Steadfast Patron" title for 6+ months continuous deposit).

---

## Anti-Speculation Protections

Speculation is inevitable in an open economy with tradeable assets. The goal is not to prevent it, but to make speculation expensive and gameplay more rewarding. Speculators should be a steady revenue source, not a destructive force.

### Risk: How Speculators Ruin Games

1. Speculators buy up everything scarce — Gold, rare items, marketplace listings
2. Prices spike beyond what real players can afford
3. New players feel priced out, leave
4. Real players who can't compete with speculator wallets leave
5. Speculators are left holding assets in a dead game

### Existing Protections

| Protection | Mechanism | Status |
|---|---|---|
| Infinite Gold supply | Can't corner an inflationary currency | `[IMPLEMENTED]` |
| Level-gating | Gas charging requires level 3+, limits instant speculation | `[IMPLEMENTED]` |
| Gold-denominated marketplace | Item prices in Gold, not ETH — insulated from token FOMO | `[IMPLEMENTED]` |
| Player caps (launch) | Phased rollout limits early speculation | `[PLANNED]` |
| Anti-farming level gap | No Gold from mobs 5+ levels below player | `[PLANNED]` |

### Planned Protections `[PLANNED]`

| Protection | Mechanism | Rationale |
|---|---|---|
| **Item degradation** | Items lose durability, cost Gold to repair | Holding inventory has a carrying cost — idle speculation is expensive |
| **Marketplace cooldown** | 24-48h before a purchased item can be relisted | Kills rapid flipping. Real players buying gear to use don't notice. |
| **Progressive marketplace fees** | 3% first sale → 5% second sale within 7 days → 10% third sale | Rapid flipping becomes unprofitable. Long-term holds unaffected. Manifesto-compatible — pricing the service, not restricting ownership. |
| **Soulbound progression** | Best content gated behind non-tradeable achievements | Money can't buy everything. Real players always have an edge. |
| **Daily Gold earn caps** | Activity-based earning (quests, streaks) vs pure kills/hour | Bot grinding 24/7 hits a cap. Real players get 90% of the same Gold in 2 hours. |

### Manifesto Tension

> "Permanent, provable ownership" (can't restrict transfers) vs. "Fair economics" (money shouldn't dominate)

Resolution: **Don't restrict what players do with assets. Design systems where speculation is less profitable and gameplay is more rewarded.** Item degradation, marketplace cooldowns, and progressive fees make speculation expensive without violating ownership rights.

---

## Economic Levers (Admin-Configurable)

These parameters can be adjusted on-chain without redeployment:

| Lever | Current Value | Range | Effect |
|-------|--------------|-------|--------|
| Marketplace fee % | 3% (300 bps) | 1-10% | Revenue rate + indirect inflation control |
| Base gold drop | 3 gold | 1-20 | Controls faucet rate |
| Drop multiplier | 1x (per zone) | 0.1-5x | Zone-specific tuning |
| Shop markup | 20% | 10-50% | Shop spread |
| Shop markdown | 50% | 30-70% | Shop spread |
| GasStation swap threshold | TBD (min gold to trigger auto-swap) | Variable | Controls gas refuel frequency and DEX impact |
| Flee penalty (PvE) | 5% | 1-20% | Risk/reward tuning |

**Key principle**: Start with moderate sink rates and increase if inflation appears. It's easier to strengthen sinks than to reverse deflation. The marketplace fee percentage also serves as an indirect inflation lever — higher fees reduce the gold players receive from trades, which slows circulation velocity.

---

## Open Questions

- [ ] Final marketplace fee: 2.5% vs 3%
- [ ] Gold drop scaling formula (per mob level)
- [ ] Final item drop rates after testing
- [ ] Exact sink rates to balance creation
- [x] ~~Initial DEX liquidity amount~~ — Resolved: 0.5 ETH + ~240K Gold at $0.002/gold, 1% fee tier (10000 bps), ±50% range. Deepened over time via Patron system.
- [ ] Anti-farming level gap threshold
- [ ] Marketplace cooldown implementation (24-48h relist delay)
- [ ] Progressive marketplace fees for rapid relists (3% → 5% → 10%)
- [ ] Item permanent destruction mechanic (critical for items-as-value-store thesis)
- [ ] Gold offering design (amounts, durations, shrine mechanics)
- [ ] XP boost design (multiplier, duration, scaling)
- [ ] Item durability implementation details (UI, repair NPCs, degradation curve)
- [ ] Guild system implementation timeline
- [ ] How to communicate allocation to players (transparency post, docs update)
- [ ] Fee recipient: single wallet, multisig, or DAO treasury
- [x] **GasStation redesign**: Rewritten to swap via Uniswap V3 on-chain + relayer off-chain path. Fallback to burn+treasury when pool not configured.
- [x] Uniswap V3 pool deployment (beta): 1% fee tier pool at `0x4338173e5557Eed1638c03c28f3502AD9Bb03e0f`. Production pool pending.
- [x] Gas UX tuning: relayer primary path refills burner wallets below `0.00005 ETH` up to `0.00015 ETH`; embedded visible-Gold auto-swap fallback triggers only below `0.00002 ETH`
- [x] ~~Relayer batch charging~~ — replaced by immediate hidden-reserve charging via `fundAndCharge()` after each successful top-up, with Gold -> ETH swap recovery on the relayer side
- [x] ~~Death penalty~~ — Implemented: PvE 5% escrow burn, PvP 50% loss (10% burn + 40% to winners)
- [ ] LP incentive system design — Patron of the Realm (single-sided ETH deposit, protocol pairs with gold) vs standard LP farming
- [ ] Anti-speculation: marketplace cooldown (24-48h relist delay) implementation
- [ ] Anti-speculation: progressive marketplace fees (3% → 5% → 10% for rapid relists)
- [ ] Autonomous buyback mechanism — use marketplace fee revenue to buy gold on DEX?
- [ ] Item permanent destruction mechanic (failed repair, crafting sacrifice, or PvP full-loot) — critical for items-as-value-store thesis

---

*Last updated: March 9, 2026*
