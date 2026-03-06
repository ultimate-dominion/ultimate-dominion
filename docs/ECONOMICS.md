# Ultimate Dominion — Economics

Reference document for game economy tuning — gold generation, sinks, drop rates, DEX integration, and marketplace revenue.

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
| PvE flee penalty | 5% of escrow burned | Permanent burn — currently the only true burn sink |

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
| Gold offerings | 100–500 gold (scales with level) | Sacrifice at shrine for +10% drop rate boost (1 hour). Permanent burn. |
| XP boost | 50–200 gold (scales with level) | 1.5x XP multiplier for 1 hour. Permanent burn. |

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

## Open Questions

- [ ] Final marketplace fee: 2.5% vs 3%
- [ ] Gold drop scaling formula (per mob level)
- [ ] Final item drop rates after testing
- [ ] Exact sink rates to balance creation
- [x] ~~Initial DEX liquidity amount~~ — Resolved: 0.5 ETH + ~240K Gold at $0.002/gold, 0.3% fee tier, ±50% range. Deepened over time via Patron system.
- [ ] Anti-farming level gap threshold
- [ ] Marketplace cooldown implementation (24-48h relist delay)
- [ ] Progressive marketplace fees for rapid relists (3% → 5% → 10%)
- [ ] Item permanent destruction mechanic (critical for items-as-value-store thesis)
- [ ] Gold offering design (amounts, durations, shrine mechanics)
- [ ] XP boost design (multiplier, duration, scaling)

---

*Last updated: March 3, 2026 — Added items-as-value-store thesis, anti-speculation protections, price strategy.*
