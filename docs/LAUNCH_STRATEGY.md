# Ultimate Dominion — Launch Strategy

Operational playbook for the first 3 months — phased rollout, player cap, invite system, queue, founder system, human verification, viral growth, and shareable UI.

> **Status Key**: `[IMPLEMENTED]` = in code, `[PLANNED]` = designed but not built

---

## Table of Contents

1. [Phased Approach](#phased-approach)
2. [Player Cap System](#player-cap-system)
3. [Invite System](#invite-system)
4. [Human Verification](#human-verification)
5. [Founder System](#founder-system)
6. [Viral Growth & Social Proof](#viral-growth--social-proof)
7. [Shareable UI Patterns](#shareable-ui-patterns)
8. [The Virtuous Cycle](#the-virtuous-cycle)

---

## Phased Approach

| Phase | Duration | Players | Focus |
|-------|----------|---------|-------|
| **Phase 0: Pre-launch** | Week -4 to 0 | 0 | Deploy token, seed DEX liquidity, build hype |
| **Phase 1: Observation** | Week 1–2 | 10 cap | Pure observation, test economy, founders only |
| **Phase 2: Early economy** | Week 3–4 | 20 cap | Marketplace starts forming, invite system live |
| **Phase 3: Expand** | Week 5–8 | 50 cap | Real economy emerging, queue growing |
| **Phase 4: Public launch** | Month 2+ | 100+ cap | Scale based on economic indicators, not time |
| **Phase 5: Growth** | Month 3+ | 250+ | Remove cap or keep soft limit |

---

## Player Cap System `[PLANNED]`

Limit concurrent players to control gold creation and test economics.

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

| Phase | Player Cap | Expected Daily Gold | Notes |
|-------|------------|---------------------|-------|
| 1 | 10 | ~4,000 | Pure observation, know every player |
| 2 | 20 | ~8,000 | Marketplace forming, invite system live |
| 3 | 50 | ~20,000 | Real economy, queue is growing |
| 4 | 100 | ~40,000 | Scale on economic indicators |
| 5 | 250+ | ~100,000+ | Remove cap or keep soft limit |

**Increase cap when:**
- Sinks are absorbing creation
- Marketplace is active
- No major exploits found
- Gold price is stable on DEX

---

## Invite System `[PLANNED]`

### Core Mechanic

Invites skip the **queue**, not the **cap**. If 10/10 slots are full, an invite code moves you from position #47 to position #3 — you still wait for a slot to open. This preserves economic controls while making invites feel valuable.

```
Player A is in the game, reaches Level 3
    → Receives 1 invite code
    → Sends code to Friend B
    → Friend B joins queue with code → jumps to near-front
    → Friend B reaches Level 5 (activation threshold)
    → Player A gets: 100 gold + 1 bonus invite code
    → Friend B got: queue priority + 50 gold starting bonus
```

### Code Generation (Scarcity-Driven)

Codes are earned through gameplay, not given at signup:

| Milestone | Codes Earned |
|-----------|-------------|
| Reach Level 3 | 1 code |
| Reach Level 10 | 1 code |
| Reach Level 20 | 1 code |
| Each successful activation (invitee hits Level 5) | 1 bonus code |

A dedicated player who invites real players generates ~5–6 codes over weeks. A casual player gets 1–2. Nobody gets unlimited.

### Activation Threshold

The invitee must reach **Level 5** before the referrer gets credit:
- Level 5 requires real engagement — combat, maybe a shop visit, real time invested
- Fast enough that the referrer gets feedback within a day or two
- Slow enough that alts require actual effort

### Rewards

**Referrer rewards:**

| Activations | Reward |
|-------------|--------|
| 1 | 100 gold + "Recruiter" title |
| 3 | 100 gold + "Herald" title |
| 5 | 100 gold + exclusive cosmetic + "Kingmaker" title |

**Invitee rewards:**
- Queue priority (near-front, not absolute front)
- 50 gold starting bonus (enough for a health potion, not enough to distort economy)

Titles are the real reward. In a 10–20 person world, being "Kingmaker" is visible status that costs nothing economically.

### Queue Experience

The queue should not be a dead screen. It should create FOMO and drive invite sharing:

```
┌─────────────────────────────────────────────────┐
│  QUEUE POSITION: #12 of 47                      │
│                                                 │
│  Estimated wait: ~45 minutes                    │
│  Players in-game right now: 10/10               │
│                                                 │
│  ── Live Feed ──────────────────────────────── │
│  → PlayerX just found a Rare Shadowblade        │
│  → PlayerY defeated PlayerZ in PvP              │
│  → A Legendary item was listed for 5,000 gold   │
│                                                 │
│  You have 2 invite codes remaining.             │
│  Share a code to move up the queue.             │
│                                                 │
│  [Copy Invite Link]  [Share to X]               │
└─────────────────────────────────────────────────┘
```

**Key design decisions:**
- Live feed shows what's happening in-game (creates urgency to get in)
- Invite codes displayed right when frustration is highest (maximizes conversion)
- Queue position + player count visible (social proof)
- Sharing pre-fills a tweet/post with the invite link

### Queue-Skip Mechanics

When invitee B uses player A's code:
- B joins queue at position #3 (near front, not absolute front)
- If A is still in queue, A moves up 5 positions
- If A is in-game and later disconnects, A gets priority re-entry

Both sides benefit from every invite.

### Abuse Scenarios

At 10–20 players, abuse doesn't scale. The cap itself is the anti-abuse mechanism.

| Scenario | Impact | Response |
|----------|--------|----------|
| Player makes 3 email alts for codes | Each alt needs Level 3 (~3+ hours each). At 10 players, you notice. | Let it slide. They're playing 3x. |
| Player sells invite codes on Twitter | Buyer still waits for cap slot. Seller gets credit only if buyer hits Level 5. | This is marketing. Encourage it. |
| Player invites bots | Bots need Level 5 for activation. At 10–20 players, bot behavior is visible. | Manual ban if needed. You're watching everything. |
| Two players trade invites to boost | Each gets 1 bonus code and 100 gold. Total impact: 200 gold. | Irrelevant at any scale. |
| Someone builds an invite farming ring | Needs 5+ real accounts all reaching Level 5. That's half the server at 10-player cap. | Physically impossible to do quietly. |

**Key insight:** By the time you're at 100+ players and abuse could actually matter, you'll have data on patterns to watch for and can tighten the system.

### Technical Implementation

Invite codes and queue are **off-chain** (API server). Rewards are **on-chain** (game assets).

- **Invite codes**: Generated and tracked by API server
- **Queue position**: Managed server-side (Redis or in-memory at this scale)
- **Activation tracking**: API watches for invitee's character reaching Level 5 on-chain, then credits referrer
- **Rewards**: Gold bonus and titles settle on-chain as in-game assets

This keeps gas costs zero for the social/queue layer while actual game rewards are on-chain.

### Growth Projection

```
DAY 1: 10 player cap, no queue yet
  Players trickle in from r/MUD, Farcaster, MUD directories

WEEK 1-2: Word spreads, queue forms
  10 in-game, 15 in queue
  Players at Level 3+ start getting invite codes
  Queue screen shows live feed + invite CTA

WEEK 3-4: Queue grows, invites accelerate
  10-20 in-game, 40 in queue
  Invite codes become socially valuable
  "I have an Ultimate Dominion invite code" posts appear
  Increase cap to 20 based on economic health

MONTH 2: Controlled growth
  20-50 in-game, 100+ in queue
  Founders (first 60 days) get express queue
  Invite system generating 5-10 new signups per day organically
  Scale cap based on economic indicators
```

---

## Human Verification `[PLANNED]`

### Two Verification Points

1. **Queue entry** — Prove you're human to get in line
2. **Periodic check** — Prove you're still human while playing

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
| Slot squatting | Session timeout kicks idle players (10 min) `[IMPLEMENTED]` |
| Alt accounts | Wallet age/stake requirements |

---

## Founder System `[PARTIALLY IMPLEMENTED]`

### What's Built

- **Founder badge** (Badge #50): ERC1155 soulbound token `[IMPLEMENTED]`
- **Mint window**: Configurable time window set at deployment `[IMPLEMENTED]`

### What's Planned `[PLANNED]`

| Benefit | Description | Status |
|---------|-------------|--------|
| **Founder badge** | Visible next to name | `[IMPLEMENTED]` |
| **Express queue** | Skip the line (near-instant access) | `[PLANNED]` |
| **Reduced checks** | Verify every 3 hours instead of 30 min | `[PLANNED]` |
| **Exclusive title** | "Founding Adventurer" | `[PLANNED]` |
| **Unique cosmetic** | Cape, aura, or pet | `[PLANNED]` |
| **Founders-only chat** | Private channel | `[PLANNED]` |
| **Input on decisions** | Polls, feedback priority | `[PLANNED]` |

### Qualification

**Founder status requires:**
- Played during first 60 days (soft launch period)
- Reached Level 10 OR played 20+ hours
- Passed at least 10 verification checks

**After window closes:** No one else can ever become a Founder.

### Simple Two-Tier System

| Tier | Who | Queue Access |
|------|-----|--------------|
| **Founders** | First 60 days + Level 10+ | Express (instant) |
| **Everyone else** | All verified players | Normal queue |

No complex scoring. Early = priority. Forever.

---

## Viral Growth & Social Proof `[PLANNED]`

### Philosophy

No explicit "recruit your friends" prompts beyond the invite system. Instead: **make cool things happen and make them easy to share.**

### Shareable Moments

| Moment | Emotion | Share Impulse |
|--------|---------|---------------|
| Legendary drop | Excitement | "LOOK WHAT I GOT" |
| Level milestone | Pride | "Finally hit Level 10" |
| PvP victory | Dominance | "Get rekt" |
| Big sale | Validation | "Made $200 today" |
| Rare achievement | Status | "First to kill X" |
| Character creation | Identity | "Meet my character" |
| Leaderboard rank | Competition | "I'm top 10" |

### Key Design Principles

1. **Auto-generate beautiful images** — Don't make players screenshot
2. **One-tap sharing** — Pre-filled tweet + image + game link
3. **Include social proof** — "Only 0.3% have this", "Top 3% of players"
4. **Show real value** — "$47.50 USD" next to gold amounts
5. **Include branding** — Every shared image has game logo/link

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

## Shareable UI Patterns `[PLANNED]`

### 1. Drop Card

```
┌─────────────────────────────────┐
│  LEGENDARY DROP                 │
│                                 │
│  [Item image]                   │
│                                 │
│  BLADE OF THE VOID              │
│  +45 STR | +20 AGI              │
│  Drop Rate: 0.01%               │
│                                 │
│  Found by: CryptoKnight.eth     │
│  Zone: Dark Cave                │
│                                 │
│  [Share to X]  [Copy Image]     │
└─────────────────────────────────┘
```

### 2. Level Up Card

```
┌─────────────────────────────────┐
│  LEVEL 10                       │
│                                 │
│  [Character portrait]           │
│                                 │
│  CryptoKnight.eth               │
│  Warrior | 12 hours played      │
│                                 │
│  STR: 18  AGI: 12               │
│  INT: 8   HP: 38                │
│                                 │
│  Top 3% of all players          │
│                                 │
│  [Share]  [View Character]      │
└─────────────────────────────────┘
```

### 3. PvP Victory Card

```
┌─────────────────────────────────┐
│  VICTORY                        │
│                                 │
│  [Your char]  VS  [Their char]  │
│                                 │
│  CryptoKnight    DeathDealer    │
│  Lvl 8           Lvl 9         │
│                                 │
│  +250 Gold | +150 XP            │
│  Win Streak: 3                  │
│                                 │
│  [Share Victory]  [Rematch]     │
└─────────────────────────────────┘
```

### 4. Sale Receipt

```
┌─────────────────────────────────┐
│  SOLD                           │
│                                 │
│  [Item image]                   │
│  Shadowsteel Armor              │
│                                 │
│  Sold for: 5,000 GOLD           │
│  ~ $47.50 USD                   │
│                                 │
│  Buyer: 0xabc...def             │
│                                 │
│  [Share]  [View Market]         │
└─────────────────────────────────┘
```

### 5. Achievement Card

```
┌─────────────────────────────────┐
│  ACHIEVEMENT UNLOCKED           │
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

### 6. Character Card

```
┌─────────────────────────────────┐
│  [Full character art]           │
│                                 │
│  CRYPTOKNIGHT                   │
│  Level 10 Warrior | Founder     │
│                                 │
│  18 STR   12 AGI                │
│  8 INT    38 HP                 │
│                                 │
│  247 Kills | #7 Rank            │
│  2,400 Gold earned              │
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
<meta property="og:title" content="CryptoKnight | Level 10 Warrior" />
<meta property="og:image" content="https://ultimatedominion.com/cards/0x123.png" />
<meta property="og:description" content="Top 3% player | 247 kills" />
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

## The Virtuous Cycle

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

- [ ] Founder window duration (30 days? 60 days?)
- [ ] Verification provider choice (Worldcoin vs Gitcoin vs other)
- [ ] Player cap scaling schedule
- [ ] Queue/invite technical implementation details

---

*Last updated: February 2026*
