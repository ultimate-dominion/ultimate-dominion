# Ultimate Dominion: Economics & Launch Strategy

This document captures design thinking around game economics, launch strategy, human verification, and viral growth mechanics.

---

## Table of Contents

1. [Economic Model](#economic-model)
2. [Launch Strategy](#launch-strategy)
3. [Human Verification](#human-verification)
4. [Founder System](#founder-system)
5. [Viral Growth & Social Proof](#viral-growth--social-proof)
6. [Shareable UI Patterns](#shareable-ui-patterns)

---

## Economic Model

### Philosophy

- **Infinite gold supply** with sinks designed to outstrip creation over time
- **Gold is the medium of exchange**, rare items are the actual value
- **Marketplace is the core economic engine** - 2.5% fee on trades
- **DEX liquidity** provided initially, creating real-world value for gold

### Gold Generation

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

### Gold Sinks (Required for Deflationary Pressure)

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

### Item Drop Rates (Recommended)

Current rates flood the market. Suggested adjustments:

| Rarity | Current | Recommended | Expected Supply (10k players, 1 month) |
|--------|---------|-------------|----------------------------------------|
| Common | 25% | 10% | Millions |
| Uncommon | 20% | 5% | ~240,000 |
| Rare | 15% | 0.5% | ~60,000 |
| Very Rare | 10% | 0.05% | ~6,000 |
| Legendary | 5% | 0.005% | ~600 |
| Unique | N/A | 1 total ever | 1 |

### Item Sinks (Critical for Rarity)

Items must leave circulation:

- **Durability** - Items break after X uses
- **PvP drops** - Die in PvP, lose equipped items
- **Upgrading** - Sacrifice 3 rares to make 1 epic
- **Rerolling** - Destroy item to reroll stats
- **Salvage** - Destroy for crafting materials

Without destruction, "rare" items flood the market over time.

### DEX Integration

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

### Marketplace Revenue Model

| Daily Trading Volume | 2.5% Fee Revenue |
|---------------------|------------------|
| 10,000 gold | 250 gold |
| 100,000 gold | 2,500 gold |
| 1,000,000 gold | 25,000 gold |

Real USD revenue depends on gold price on DEX.

---

## Launch Strategy

### Phased Approach

| Phase | Duration | Players | Focus |
|-------|----------|---------|-------|
| **Phase 0: Pre-launch** | Week -4 to 0 | 0 | Deploy token, seed DEX liquidity, build hype |
| **Phase 1: Soft launch** | Week 1-2 | 20 cap | Invite-only, test economy, low drop rates |
| **Phase 2: Expand** | Week 3-4 | 50 cap | Open waitlist, monitor sell pressure |
| **Phase 3: Public launch** | Week 5+ | 100+ cap | Full open, marketplace active |
| **Phase 4: Growth** | Month 2+ | Uncapped | Monitor, adjust rates and sinks |

### Player Cap System

Limit concurrent players to control gold creation and test economics:

```
Player tries to join
    ↓
Check active player count
    ↓
├── Under cap? → Enter game
└── At cap? → Enter queue, position #X
```

**Benefits:**
- Controlled gold creation rate
- Testable economics at small scale
- Creates artificial scarcity/FOMO
- Prevents server overload

**Queue creates:**
- Anticipation and demand
- Social proof ("500 people waiting")
- Speculation (people buy gold while waiting)

### Scaling the Cap

| Week | Player Cap | Expected Daily Gold | Notes |
|------|------------|---------------------|-------|
| 1-2 | 20 | ~8,000 | Tiny, close monitoring |
| 3-4 | 50 | ~20,000 | Still manageable |
| 5-6 | 100 | ~40,000 | Real economy emerging |
| 7-8 | 250 | ~100,000 | Marketplace velocity up |
| 9+ | 500+ | ~200,000+ | Remove cap or keep soft limit |

**Increase cap when:**
- Sinks are absorbing creation
- Marketplace is active
- No major exploits found
- Gold price is stable on DEX

### Initial Liquidity

Seed DEX pool yourself:

| Budget | Gold in Pool | Approx Market Cap |
|--------|--------------|-------------------|
| $10k | 500,000 gold | ~$5k |
| $25k | 1,250,000 gold | ~$12.5k |
| $50k | 2,500,000 gold | ~$25k |

Start small-medium. Some volatility attracts speculators, but not so wild it looks like a scam.

---

## Human Verification

### Two Verification Points

1. **Queue entry** - Prove you're human to get in line
2. **Periodic check** - Prove you're still human while playing

### Queue Entry Verification

Layered approach:

```
To enter queue:
├── CAPTCHA (baseline)
└── AND one of:
    ├── Worldcoin verified
    ├── Gitcoin Passport score > X
    ├── Wallet age > 30 days + holds > 0.01 ETH
    └── Holds [Game NFT]
```

| Method | Sybil Resistance | UX | Notes |
|--------|------------------|-----|-------|
| CAPTCHA | Low-Medium | Annoying | Bots can solve cheaply |
| Worldcoin | Very High | Decent | Orb = 1 human, 1 account |
| Gitcoin Passport | High | Decent | Score based on web3 activity |
| Wallet age + balance | Medium | Seamless | Old wallet + stake required |

### Periodic In-Game Verification

Prevent players from running bots after entering:

**Game-themed challenges (recommended):**
```
Every 30-60 minutes (randomized):
    ↓
"Quick check! What did you just fight?"
[Giant Rat] [Kobold] [Slime] [Orc]
    ↓
├── Correct within 2 min → Continue
└── Wrong/timeout → Kicked, back of queue
```

**Why game-themed:**
- Less immersion-breaking than standard CAPTCHA
- Feels like part of game
- Can gamify it: "+10 XP for correct answer"

**Trust decay system:**
| Trust Level | Check Frequency |
|-------------|-----------------|
| New | Every 20 min |
| Verified | Every 45 min |
| Trusted | Every 90 min |
| Veteran | Every 3 hours |

Trust builds by passing checks, drops if failed.

### Anti-Gaming Measures

| Exploit | Prevention |
|---------|------------|
| Self-referral (alts) | Different IP/device fingerprint or Worldcoin |
| Mass bot referrals | Level requirement, verification checks |
| Slot squatting | Session timeout kicks idle players |
| Alt accounts | Wallet age/stake requirements |

---

## Founder System

### Philosophy

Reward early players with permanent benefits. They took the risk, built the community, deserve recognition.

### Qualification

**Founder status requires:**
- Played during first 60 days (soft launch period)
- Reached Level 10 OR played 20+ hours
- Passed at least 10 verification checks

**After window closes:** No one else can ever become a Founder.

### Founder Benefits

| Benefit | Description |
|---------|-------------|
| **Express queue** | Skip the line (near-instant access) |
| **Reduced checks** | Verify every 3 hours instead of 30 min |
| **Founder badge** | Visible next to name |
| **Exclusive title** | "Founding Adventurer" |
| **Unique cosmetic** | Cape, aura, or pet |
| **Founders-only chat** | Private channel |
| **Input on decisions** | Polls, feedback priority |

### Simple Two-Tier System

| Tier | Who | Queue Access |
|------|-----|--------------|
| **Founders** | First 60 days + Level 10+ | Express (instant) |
| **Everyone else** | All verified players | Normal queue |

No complex scoring. Early = priority. Forever.

### Fairness Argument

> "Players who took the risk when the game was unproven deserve priority. Late players get a more polished game and still get in - they just wait a bit longer."

This is standard practice (Kickstarter backers, beta testers, early investors).

---

## Viral Growth & Social Proof

### Philosophy

No explicit referral codes or "recruit your friends" prompts. Instead: **make cool things happen and make them easy to share.**

The game markets itself through players showing off.

### Shareable Moments

| Moment | Emotion | Share Impulse |
|--------|---------|---------------|
| Legendary drop | Excitement | "LOOK WHAT I GOT" |
| Level milestone | Pride | "Finally hit 50" |
| PvP victory | Dominance | "Get rekt" |
| Big sale | Validation | "Made $200 today" |
| Rare achievement | Status | "First to kill X" |
| Character creation | Identity | "Meet my character" |
| Leaderboard rank | Competition | "I'm top 10" |

### Key Design Principles

1. **Auto-generate beautiful images** - Don't make players screenshot
2. **One-tap sharing** - Pre-filled tweet + image + game link
3. **Include social proof** - "Only 0.3% have this", "Top 3% of players"
4. **Show real value** - "$47.50 USD" next to gold amounts
5. **Include branding** - Every shared image has game logo/link

### Passive Virality Features

| Feature | How It Spreads |
|---------|----------------|
| Public profiles | Linkable, Google-indexable |
| Leaderboards | Players share rankings |
| Activity feed | "X just found a Legendary" |
| Kill feed | PvP drama visible to all |
| Marketplace history | Big sales create FOMO |
| World firsts | Permanent fame |

### In-Game Social Proof (The Flex Economy)

| Feature | Effect |
|---------|--------|
| Titles | "Dragonslayer" above name |
| Badges | Achievement icons visible |
| Cosmetics | Rare skins others see |
| Mount/Pet | "How'd you get that?" |
| Leaderboard frames | Top 10 get special border |

---

## Shareable UI Patterns

### 1. Drop Card

When rare+ item drops:

```
┌─────────────────────────────────┐
│  ⚔️ LEGENDARY DROP              │
│                                 │
│  [Item image]                   │
│                                 │
│  BLADE OF THE VOID              │
│  +45 STR | +20 AGI              │
│  Drop Rate: 0.01%               │
│                                 │
│  Found by: CryptoKnight.eth     │
│  Zone: Shadow Caverns           │
│                                 │
│  [Share to X]  [Copy Image]     │
└─────────────────────────────────┘
```

### 2. Level Up Card

```
┌─────────────────────────────────┐
│  🎉 LEVEL 50                    │
│                                 │
│  [Character portrait]           │
│                                 │
│  CryptoKnight.eth               │
│  Warrior | 142 hours played     │
│                                 │
│  STR: 89  AGI: 45               │
│  INT: 23  HP: 340               │
│                                 │
│  Top 3% of all players          │
│                                 │
│  [Share]  [View Character]      │
└─────────────────────────────────┘
```

### 3. PvP Victory Card

```
┌─────────────────────────────────┐
│  ⚔️ VICTORY                     │
│                                 │
│  [Your char]  VS  [Their char]  │
│                                 │
│  CryptoKnight    DeathDealer    │
│  Lvl 34          Lvl 37         │
│                                 │
│  +250 Gold | +150 XP            │
│  Win Streak: 7 🔥               │
│                                 │
│  [Share Victory]  [Rematch]     │
└─────────────────────────────────┘
```

### 4. Sale Receipt

```
┌─────────────────────────────────┐
│  💰 SOLD                        │
│                                 │
│  [Item image]                   │
│  Shadowsteel Armor              │
│                                 │
│  Sold for: 5,000 GOLD           │
│  ≈ $47.50 USD                   │
│                                 │
│  Buyer: 0xabc...def             │
│                                 │
│  [Share]  [View Market]         │
└─────────────────────────────────┘
```

**The USD equivalent is key** - shows real money being made.

### 5. Achievement Card

```
┌─────────────────────────────────┐
│  🏆 ACHIEVEMENT UNLOCKED        │
│                                 │
│  [Achievement icon]             │
│                                 │
│  DRAGON SLAYER                  │
│  "Defeat the Elder Dragon"      │
│                                 │
│  Only 0.3% of players have this │
│                                 │
│  [Share]  [View All]            │
└─────────────────────────────────┘
```

### 6. Character/Profile Card

```
┌─────────────────────────────────┐
│  [Full character art]           │
│                                 │
│  CRYPTOKNIGHT                   │
│  Level 50 Warrior | Founder     │
│                                 │
│  ⚔️ 89 STR   🏃 45 AGI          │
│  🧠 23 INT   ❤️ 340 HP          │
│                                 │
│  💀 1,247 Kills | 👑 #47 Rank   │
│  💰 12,400 Gold earned          │
│                                 │
│  [Share Card]  [View Full]      │
└─────────────────────────────────┘
```

### Technical Implementation

**Image Generation:**
```
Player triggers share
    ↓
Client sends data to API
    ↓
API generates image (Canvas/Sharp/Puppeteer)
    ↓
Returns image URL
    ↓
Player shares image + link
```

**Open Graph Tags:**
```html
<meta property="og:title" content="CryptoKnight | Level 50 Warrior" />
<meta property="og:image" content="https://game.com/cards/0x123.png" />
<meta property="og:description" content="Top 3% player | 1,247 kills" />
```

**Example Tweet Output:**
```
🗡️ Just dropped a BLADE OF THE VOID in @UltimateDominion

+45 STR | +20 AGI
Drop rate: 0.01%

[Auto-generated card image]

Play free: ultimatedominion.com
```

### The Share Flow

```
Cool thing happens
    ↓
Card auto-appears (don't make them find it)
    ↓
One tap: "Share to X"
    ↓
Pre-written tweet + image + game link
    ↓
Posted

Total friction: 1 tap + confirm
```

### Metrics to Track

| Metric | What It Tells You |
|--------|-------------------|
| Share button clicks | Interest in sharing |
| Shares completed | Actual viral actions |
| Clicks from shared links | Viral reach |
| Sign-ups from shares | Conversion |
| Which moments shared most | What to emphasize |

---

## Summary: The Virtuous Cycle

```
Controlled launch (player cap)
        ↓
Scarce gold + rare items
        ↓
Active marketplace
        ↓
Real value (DEX price)
        ↓
Shareable moments
        ↓
Organic viral growth
        ↓
More players want in
        ↓
Queue builds demand
        ↓
Founders evangelize
        ↓
Sustainable economy
```

---

## Open Questions

- [ ] Final drop rate numbers after testing
- [ ] Exact sink rates to balance creation
- [ ] Founder window duration (30 days? 60 days?)
- [ ] Initial DEX liquidity amount
- [ ] Verification provider choice (Worldcoin vs Gitcoin vs other)
- [ ] Player cap scaling schedule

---

*Last updated: January 2026*
