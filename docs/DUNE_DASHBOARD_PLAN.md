# Dune Dashboard Plan

Public dashboard for Ultimate Dominion. All data from Base Mainnet onchain events.

## Data Sources

| Source | Address | Events |
|--------|---------|--------|
| World contract | `0x99d0...64b0` | Store_SetRecord, Store_SpliceStaticData, custom game events |
| Gold ERC20 | `0x0F04...1e16A` | Transfer, Approval |
| Character ERC721 | `0x0829...2e30` | Transfer (mints) |
| Items ERC1155 | `0xc17f...b531` | TransferSingle, TransferBatch |
| Gold/WETH Pool | `0xE096...2526` | Swap, Mint, Burn (Uniswap V3) |

Key table IDs for Store event filtering:
- SessionTimer: `0x7462554400000000000000000000000053657373696f6e54696d657200000000`
- Stats: `0x7462554400000000000000000000000053746174730000000000000000000000`
- CombatOutcome (offchain): decode from `ot:UD:CombatOutcome`
- ShopSale (offchain): decode from `ot:UD:ShopSale`
- ActionOutcome (offchain): decode from `ot:UD:ActionOutcome`

Submit the World ABI (`packages/contracts/out/IStoreEvents.sol/IStoreEvents.json`) to Dune for event decoding.

---

## Dashboard Sections

### 1. Player Growth (top of dashboard, hero metrics)

| Panel | Type | Query Logic |
|-------|------|-------------|
| **Total Players** (counter) | Big number | Count distinct character ERC721 Transfer from 0x0 |
| **Daily New Players** | Bar chart | Character ERC721 mints grouped by day |
| **Cumulative Players** | Area chart | Running total of mints over time |
| **DAU** | Line chart | Count distinct characterIds in SessionTimer Store_SpliceStaticData per day |
| **DAU/MAU Ratio** | Line chart | Stickiness metric — DAU ÷ 30-day unique players |
| **Player Level Distribution** | Horizontal bar | Latest Stats table values, group by level |

### 2. Retention (the story you want to tell)

| Panel | Type | Query Logic |
|-------|------|-------------|
| **D1 / D7 / D14 Retention** | Line chart | Cohort analysis — for each day's new players, what % had SessionTimer events on day+N |
| **Retention Heatmap** | Heatmap (cohort × day) | Classic retention triangle — rows = cohort date, columns = days since first play, cells = % active |
| **Returning vs New DAU** | Stacked bar | Split DAU into first-time vs returning players per day |
| **Sessions Per Player** | Histogram | Distribution of distinct active days per player |
| **Avg Session Depth** | Line chart | Average SessionTimer events per player per day (proxy for session length) |

### 3. Progression

| Panel | Type | Query Logic |
|-------|------|-------------|
| **Progression Funnel** | Funnel chart | % of all players reaching L1, L2, L3, L5, L7, L10 |
| **Advanced Class Distribution** | Pie/donut | Count of each advancedClass value from Stats table |
| **Race & Power Source Split** | Pie/donut | Build diversity — what are players choosing? |
| **Level-Ups Per Day** | Bar chart | CharacterLeveledUp events grouped by day |
| **Zone Completions** | Counter + list | From ZoneCompletions table — who's beating zones |
| **Fragment Discovery Rate** | Line chart | FragmentTriggered events per day |

### 4. Combat

| Panel | Type | Query Logic |
|-------|------|-------------|
| **Daily Encounters** | Bar chart | CombatEncounter Store events per day |
| **Combat Outcomes** | Stacked bar | CombatOutcome: wins vs losses vs flees per day |
| **XP Generated Per Day** | Area chart | Sum of expDropped from CombatOutcome events |
| **Gold Generated Per Day** | Area chart | Sum of goldDropped from CombatOutcome events (inflation metric) |
| **PvP Encounters** | Counter + timeline | Filter CombatEncounter for player-vs-player fights |
| **Crit Rate Over Time** | Line chart | From ActionOutcome — % of hits that are crits (game balance signal) |
| **Most Killed Monsters** | Leaderboard table | Group CombatOutcome by monster entityId |

### 5. Economy

| Panel | Type | Query Logic |
|-------|------|-------------|
| **Gold Total Supply** | Line chart | Gold ERC20 Transfer events — track cumulative mints minus burns |
| **Gold Velocity** | Line chart | Total Gold transferred ÷ supply per day (how actively is Gold circulating) |
| **Gold Distribution (Gini)** | Line chart | Inequality metric — are a few players hoarding or is it spread? |
| **Top Gold Holders** | Table | Current Gold balances, top 20 |
| **Shop Revenue Per Day** | Bar chart | ShopSale offchain events — sum of `price` field per day |
| **Shop Buy vs Sell** | Stacked bar | ShopSale grouped by `buying` boolean |
| **P2P Marketplace Volume** | Bar chart | MarketplaceSale events — daily trade volume in Gold |
| **Item Price Trends** | Line chart (multi-series) | MarketplaceSale price per itemId over time |
| **Uniswap Pool TVL** | Line chart | Gold/WETH pool liquidity from Uniswap V3 Mint/Burn events |
| **Gold Price (vs ETH)** | Line chart | Swap events from the Gold/WETH pool — derived price per swap |
| **Uniswap Volume** | Bar chart | Daily swap volume through the pool |

### 6. Items & Loot

| Panel | Type | Query Logic |
|-------|------|-------------|
| **Items in Circulation** | Counter | Total ERC1155 supply across all item types |
| **Loot Drops Per Day** | Bar chart | Items ERC1155 TransferSingle from 0x0 (mints) per day |
| **Drop Distribution by Rarity** | Pie chart | Group item mints by rarity tier (needs item metadata mapping) |
| **Most Common Drops** | Table | Item mint counts ranked |
| **Equipment Changes Per Day** | Line chart | ArmorEquipped + AccessoryEquipped events — player engagement signal |

### 7. Infrastructure (smaller section, bottom)

| Panel | Type | Query Logic |
|-------|------|-------------|
| **Relayer Transactions/Day** | Bar chart | Transactions from relayer EOAs to World contract |
| **Gas Spent Per Day** | Area chart | Total gas used by relayer transactions |
| **Avg Gas Per Action** | Line chart | Gas efficiency over time |
| **Unique Relayer EOAs Active** | Stacked area | Which of the 5 relayer wallets are sending txs |

---

## Implementation Priority

**Phase 1 — Ship first (the metrics people care about):**
1. Total Players + Daily New Players + Cumulative (character mints — simple ERC721 query)
2. Gold Price chart (Uniswap swap events — the DeFi crowd loves this)
3. DAU line chart (SessionTimer events — already proven from the retention analysis)
4. Gold Total Supply (ERC20 transfers)
5. Level Distribution (current snapshot, or level-up events)

**Phase 2 — Retention story (your differentiator):**
6. Retention heatmap (cohort analysis from SessionTimer data)
7. Returning vs New DAU (stacked bar)
8. Progression funnel
9. Combat encounters per day + Gold/XP generation

**Phase 3 — Full economy:**
10. Shop + Marketplace volume
11. Gold velocity + Gini
12. Item drop distribution
13. Uniswap pool TVL + volume

**Phase 4 — Deep gameplay:**
14. Build diversity (class/race/power source)
15. Combat crit rates + balance metrics
16. Fragment discovery rate
17. Infrastructure / gas metrics

---

## Setup Steps

1. Submit World ABI to Dune for decoded event logs
2. Submit Gold ERC20 + Character ERC721 ABIs
3. Create a Dune team/workspace for "Ultimate Dominion"
4. Build Phase 1 queries using decoded events
5. Assemble into a public dashboard with the UD brand

## Notes

- Dune indexes Base mainnet natively — no custom setup needed
- MUD Store events need the tableId filter approach (topic[1] matching)
- Offchain tables (CombatOutcome, ShopSale, ActionOutcome) emit Store events but aren't in onchain storage — Dune can still index the events
- Gold/WETH Uniswap pool is already indexed by Dune's Uniswap V3 decoded tables (`uniswap_v3_base.trades`)
- Character mints won't show as standard ERC721 in Dune unless the puppet ABI is submitted — the Transfer events come from the puppet address, not the World
