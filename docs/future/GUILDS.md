# Ultimate Dominion — Guild System Design

Reference document for guild mechanics, economics, governance, territory, and lore integration.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Lore Context](#lore-context)
3. [Guild Basics](#guild-basics)
4. [The Guild Tax](#the-guild-tax)
5. [The Guild Treasury](#the-guild-treasury)
6. [Guild Ranks & Governance](#guild-ranks--governance)
7. [Guild Buffs](#guild-buffs)
8. [Guild Contracts](#guild-contracts)
9. [The Regear Fund](#the-regear-fund)
10. [Territory](#territory)
11. [Guild Wars](#guild-wars)
12. [Seasonal Competition](#seasonal-competition)
13. [Lore Integration](#lore-integration)
14. [Anti-Abuse & Edge Cases](#anti-abuse--edge-cases)
15. [On-Chain Architecture](#on-chain-architecture)
16. [What NOT to Build](#what-not-to-build)
17. [Implementation Phases](#implementation-phases)
18. [Open Questions](#open-questions)

---

## Design Philosophy

Guilds exist to answer a single question: **Why should players depend on each other?**

UD is a game with real stakes. Gold has value. Items can be lost. Death hurts. In that kind of world, the natural instinct is to play solo and trust no one. Guilds must make the opposite choice — trusting other players, pooling resources, sharing risk — clearly and mechanically superior to going alone. Not through artificial restrictions on solo play, but through genuine advantages that emerge from cooperation.

### The Golden Loop

Every successful guild system in gaming history (EVE Online, Albion Online, New World) shares one reinforcing cycle:

```
Members earn → Guild taxes a portion → Treasury funds shared benefits → Benefits help members earn more → repeat
```

Games without this loop (WoW, Destiny 2, FFXIV) have guilds that feel like chat rooms. UD's guilds must have this loop from day one.

### Design Principles

1. **Guilds are player-authored institutions.** The system provides structure; players provide meaning. No NPC guild quests. No scripted guild storylines. Every war, territory claim, and treasury decision is a player choice recorded permanently on-chain.

2. **The tax funds the safety net.** The core value proposition: "Pay 10% of your gold drops and in return, if you die in the outer realms and lose everything, the guild helps you recover." This is insurance — the oldest form of collective economics.

3. **Small and tight, not big and loose.** Optimal guild size is 15–50 members (per Dunbar research on group cohesion in games). No mega-alliances. No 500-person zergs. If you want more players, you need to be a better guild, not a bigger one.

4. **Permanence matters.** Guild history — territory held, wars fought, members who served — is on-chain forever. A guild that held tile (7,8) for six months has a provable legacy. This aligns with the manifesto: "Everything here is permanent."

5. **No guild-exclusive power.** Guilds provide convenience, recovery, and efficiency — never items or abilities unavailable to solo players. A solo player who is skilled and careful can do everything a guild member can. The guild makes it easier, faster, and more fun. Never mandatory.

### Reference: Why This Matters

- Academic research confirms guild membership is the **strongest predictor of long-term retention** in multiplayer games (Hwang & Han, SSRN 2023)
- Kongregate's GDC data shows **20x higher revenue** from guilded vs non-guilded players
- Project Horseshoe 2018 (Dunbar's Number): guilds above 50 members require formal sub-groups or cohesion collapses; the sweet spot for gaming guilds is **25–50 members**
- The "barrier-to-exit" effect: players stay in games not because the game is perfect, but because leaving means losing their guild community

---

## Lore Context

### In-World Name: Orders

Guilds are called **Orders** in the game world. The term reflects the setting — survivors banding together in the aftermath of the gods' death, forming structures to impose meaning on chaos. Some Orders echo the old religions. Others reject them entirely. All of them exist because the alternative is dying alone in the dark.

### Connection to Factions

Orders are **independent of factions** (Covenant / Unbound). An Order can have members from both factions, or align entirely with one. This is a player decision, not a system restriction. However, Orders that align strongly with a faction may gain narrative recognition in the Living Chronicle.

### The Wound Compels Cooperation

The Dark Cave — the Wound of Noctum — is hostile to individuals. Monsters spawn from corrupted divine essence. The deeper you go, the worse it gets. Lore-wise, survivors who band together last longer. The Orders are the in-world expression of this truth: alone, you are food. Together, you might survive long enough to matter.

---

## Guild Basics

### Creation

| Parameter | Value | Notes |
|-----------|-------|-------|
| Creation cost | 1,000 gold | From the founder's wallet. Acts as a gold sink. |
| Minimum members | 1 (founder) | No minimum to create. 3 members required to unlock treasury features. |
| Maximum members | 50 | Hard cap. See [Anti-Abuse](#anti-abuse--edge-cases) for rationale. |
| Name length | 3–24 characters | Alphanumeric + spaces. Unique per world. |
| Tag length | 2–5 characters | Displayed next to member names on the map. Unique per world. |
| Minimum level to create | 20 | Requires completing Windy Peaks (Zone 2). Ensures founders understand the game deeply before leading others. |
| Minimum level to join | 3 | Matches the Adventurer badge unlock (chat access). |

### Joining and Leaving

- **Open guilds**: Anyone meeting level requirements can join freely.
- **Closed guilds**: Requires an invite from an Officer or the Leader.
- **Leave penalty**: 3-day cooldown before joining another guild. Prevents buff-hopping and spy rotation.
- **Kick**: Leader or Officers can remove members. Kicked members have a 7-day cooldown before they can rejoin *that specific guild*.
- **One guild per character**: No multi-guild membership. You commit to one Order.

### Guild Dissolution

If a guild drops to 0 members (all leave or are kicked), it is dissolved:
- Treasury gold is burned (gold sink).
- Territory claims are released.
- Guild name and tag become available again after 30 days.
- The guild's history remains in the Living Chronicle permanently.

---

## The Guild Tax

### How It Works

The guild leader sets a **tax rate** between 0% and 50%. When a guild member earns gold from any automated source, the system splits the payout before it reaches the player:

```
playerReceives = goldEarned × (1 - taxRate)
treasuryReceives = goldEarned × taxRate
```

### What Gets Taxed

| Source | Taxed? | Notes |
|--------|--------|-------|
| PvE gold drops (monster kills) | Yes | Primary tax revenue source |
| PvP escrow winnings | Yes | Winner's earnings are taxed |
| Marketplace sale proceeds | No | Already subject to marketplace fee — double-taxing would be punitive |
| Shop sell proceeds | No | Small amounts, not worth the complexity |
| Direct player-to-player gold transfers | No | Would create perverse incentives to avoid the system |

### Tax Rate Guidelines

The leader can change the tax rate once per 24 hours. This cooldown prevents manipulation (e.g., setting 50% right before a big PvP payout, then lowering it).

| Rate | Typical Use Case |
|------|-----------------|
| 0% | Recruitment incentive ("join us, no tax!") — unsustainable long-term |
| 5–10% | Casual guilds, light treasury needs |
| 10–20% | Active guilds funding regear + buffs. **Recommended default.** |
| 20–30% | Territory-holding guilds with high upkeep |
| 30–50% | Wartime emergency rate or treasury rebuilding after a crisis |

### Why Automatic Tax (Not Voluntary Donations)

Every MMO that tried voluntary-only guild funding (WoW, GW2, FFXIV) ended up with empty treasuries and "donate pls" fatigue. The automatic tax:

- Creates predictable, sustainable income
- Eliminates social pressure and resentment around donations
- Scales naturally with guild activity
- Members never "lose" existing gold — they earn slightly less per kill
- Is transparent: every member can see the rate and the treasury balance

---

## The Guild Treasury

### Balance and Visibility

The treasury balance is visible to all guild members. Full transaction history (deposits from tax, withdrawals, buff costs, regear payouts) is visible to all members. On-chain transparency means the leader literally cannot hide spending.

### Spending Categories

| Category | Who Can Spend | Notes |
|----------|--------------|-------|
| Buff activation | Leader, Officers | See [Guild Buffs](#guild-buffs) |
| Regear payouts | Leader only | See [Regear Fund](#the-regear-fund) |
| Territory claiming | Leader only | See [Territory](#territory) |
| Territory upkeep | Automatic (weekly) | Deducted automatically |
| War declaration | Leader only | See [Guild Wars](#guild-wars) |

### Treasury Cap

The treasury has a maximum balance of **50,000 gold**. This prevents hoarding and encourages spending on members. Excess tax revenue above the cap is burned (gold sink). Guilds are incentivized to actively invest in their members rather than sitting on a pile.

---

## Guild Ranks & Governance

### Ranks

| Rank | Count | Permissions |
|------|-------|-------------|
| **Leader** | 1 | All permissions. Set tax rate. Withdraw treasury. Declare war. Claim territory. Promote/demote. Kick. Disband guild. |
| **Officer** | Up to 5 | Invite/kick members. Activate buffs. Approve regear requests. |
| **Member** | Up to 44 | Earn, pay tax, benefit from buffs, request regear, view treasury. |

### Leadership Succession

If the Leader has not logged in for **14 days**:

1. Leadership automatically transfers to the longest-tenured Officer who has logged in within the last 7 days.
2. If no Officers qualify, the longest-tenured Member who has logged in within the last 7 days is promoted.
3. If no one qualifies (entire guild inactive for 7+ days), the guild enters "dormant" state — territory upkeep is paused, buffs deactivate, but the guild is not dissolved. The first member to log in becomes Leader.

**Rationale**: 14 days is long enough to cover vacations but short enough to prevent dead guilds from blocking territory. FFXIV uses 35 days, which is too long. EVE has no automatic succession, which causes orphaned corps.

### No Democracy

There are no voting systems. No governance tokens. No proposals. The leader leads. If they make bad decisions, members leave and form a new guild. This is deliberate:

- DAO governance is too slow for real-time game decisions (Dark Forest proved this)
- On-chain treasury transparency already prevents theft — everyone can see every transaction
- Natural selection works: bad leaders lose members, good leaders attract them
- The game should feel like a medieval order, not a corporate board meeting

---

## Guild Buffs

### How They Work

The Leader or Officers spend treasury gold to activate buffs. Each buff lasts **24 hours**. A guild can have **2 buffs active simultaneously** (matching FFXIV's FC Action system, which is well-balanced).

### Available Buffs

| Buff | Cost | Effect | Notes |
|------|------|--------|-------|
| **Battle Insight** | 100 gold | +10% XP from all combat | Best for leveling phases |
| **Prospector's Luck** | 150 gold | +10% gold from PvE kills | Pays for itself if guild is active |
| **Ironhide** | 200 gold | +5 max HP for all members | Defensive, good for outer realms |
| **Keen Edge** | 200 gold | +5% physical and spell damage | Offensive, good for pushing content |
| **Scout's Instinct** | 100 gold | Extended scout range (see 2 tiles ahead on compass) | Utility for exploration and PvP avoidance |

### Design Notes

- Buff values are intentionally modest. A +10% XP buff is nice, not game-breaking. Solo players are not significantly disadvantaged.
- Costs are calibrated so that a 10-person guild with 15% tax rate, where each member earns ~50 gold/day, generates ~75 gold/day in treasury. Running 2 buffs (200-350 gold/day) requires 15-25 active members to sustain. This naturally links guild size to buff uptime.
- Buffs are *not* the primary reason to join a guild. The regear fund is.

---

## Guild Contracts

### What They Are

Weekly cooperative objectives that give the guild a shared goal. Contracts reset every 7 days. The guild leader selects **1 contract** from a pool of 3 randomly generated options.

### Contract Examples

| Contract | Objective | Reward |
|----------|-----------|--------|
| **Extermination** | Guild members collectively kill 200 monsters | 500 gold to treasury |
| **Deep Patrol** | 5 different members visit tile (7,7) or deeper | 300 gold to treasury + Scout's Instinct buff (free, 48h) |
| **Blood Tax** | Win 10 PvP battles as a guild | 750 gold to treasury |
| **The Grind** | Guild members collectively earn 5,000 XP | 400 gold to treasury + Battle Insight buff (free, 48h) |
| **Market Movers** | Guild members complete 20 marketplace trades | 500 gold to treasury |
| **Recruitment Drive** | Have 3 new members join who reach level 3 | 600 gold to treasury |

### Why Contracts Matter

Contracts solve the #1 problem of guild longevity: **"What do we do together this week?"** Without shared goals, guilds devolve into passive chat rooms. Contracts create a recurring reason to coordinate — not because the system forces it, but because the rewards make it worthwhile.

Progress toward the contract is visible to all members. Individual contributions are tracked. This creates healthy internal accountability without punitive mechanics.

---

## The Regear Fund

### The Core Value Proposition

This is **the reason guilds exist** in UD. The pitch to every player:

> "You're heading into the outer realms. If you die, you lose your escrow gold. Maybe your gear (when PvP drops are implemented). That's the risk. But as a guild member, you pay 15% tax on your gold drops — and in return, if you get wiped, the guild treasury helps you buy replacement gear and get back on your feet."

This is insurance. The oldest and most compelling form of economic cooperation.

### How It Works

1. A guild member dies in PvP and loses significant gold/items.
2. The member submits a **regear request** (on-chain transaction specifying what they lost).
3. An Officer or the Leader **approves** the request.
4. Treasury gold is transferred to the member (capped per request, see below).
5. The member uses the gold to re-equip at the marketplace or shops.

### Limits

| Parameter | Value | Notes |
|-----------|-------|-------|
| Max payout per request | 500 gold or 10% of treasury (whichever is lower) | Prevents treasury drain from a single big loss |
| Cooldown per member | 72 hours between approved requests | Prevents farming the treasury through intentional deaths |
| Approval required | Yes (Leader or Officer) | Prevents abuse; adds social accountability |
| Minimum treasury balance | Treasury cannot go below 100 gold from regear payouts | Emergency reserve |

### Why This Is the Killer Feature

In Albion Online, the "regear program" (called SRP — Ship Replacement Program in EVE) is the #1 reason players join guilds. The dynamic:

- Without regear: players avoid risk → less PvP → less gold generation → less fun
- With regear: players take risks → more PvP → more gold → more tax → larger treasury → more regear capacity

The regear fund turns the guild treasury into a **risk subsidy**. It doesn't remove consequences (you still die, you still lose time), but it softens the blow enough that players engage with the danger zone instead of avoiding it.

---

## Territory

### Overview

Guilds can **claim tiles** in the danger zone (x ≥ 5, y ≥ 5) — the 25-tile PvP-enabled area of the map. Claimed tiles display the guild's banner and tag, visible to all players.

### Claiming

| Parameter | Value | Notes |
|-----------|-------|-------|
| Claim cost | 500 gold from treasury | Per tile |
| Claim requirement | A guild member must be physically on the tile | Prevents remote claiming |
| Max tiles per guild | 3 | Prevents monopolization of the danger zone |
| Weekly upkeep | 100 gold per tile | Deducted automatically from treasury |

### Benefits of Held Territory

| Benefit | Effect |
|---------|--------|
| **Home turf bonus** | Guild members on their own tiles deal +5% damage in PvP |
| **Gold bonus** | +15% gold from PvE kills on guild-held tiles (for guild members) |
| **Banner visibility** | The guild tag and banner show on the map for all players — reputation and intimidation |
| **Respawn proximity** | `[FUTURE]` Guild members who die on a guild-held tile respawn on the nearest guild tile instead of (0,0) |

### Contesting Territory

Any guild can contest a held tile:

1. **Presence requirement**: The contesting guild must have more members on the tile than the defending guild for **5 consecutive minutes** during the daily **siege window** (a 2-hour window, time set by the server/world config).
2. **Contested state**: When presence is established, the tile enters "contested" state for 24 hours. During this time, PvP between the two guilds on that tile has no cooldown.
3. **Resolution**: After 24 hours, the tile belongs to whichever guild had the most cumulative member-minutes on the tile during the contested period. Ties favor the defender.

### Why This Works for UD

- The 10x10 grid with only 25 danger-zone tiles creates genuine scarcity without artificial housing lotteries (FFXIV's #1 problem)
- 3-tile cap per guild means a 50-person guild can hold at most 12% of the danger zone — no monopolies
- Siege windows create scheduled conflict (like Albion's primetime system) so defenders aren't caught at 3 AM
- Territory provides tangible economic benefit (+15% gold) that justifies the upkeep cost and defense effort

---

## Guild Wars

### Declaration

A guild leader can declare war on another guild by spending **500 gold** from the treasury. The target guild is notified. Wars are **not consensual** — the target does not need to accept. (You don't get to choose when someone attacks you. This is UD.)

### War Rules

| Parameter | Value |
|-----------|-------|
| Duration | 7 days |
| PvP cooldown between warring guilds | Removed (normally 30 seconds) |
| PvP location restriction | Removed — warring guilds can fight in the **safe zone** too |
| Escrow multiplier | 1.5x (higher stakes) |
| XP bonus for war kills | +25% |
| War cost | 500 gold (declaring guild only) |

### War Resolution

At the end of 7 days, the war ends automatically. The guild with more PvP kills wins. The losing guild pays **10% of their current treasury balance** to the winning guild (transferred on-chain).

If the kill counts are tied, the war is a draw. No treasury transfer. Both guilds can declare a new war immediately if they want a rematch.

### War Records

Every war is recorded permanently:

```
WAR: The Iron Vanguard vs. The Pale Court
Duration: 7 days (Feb 15 – Feb 22, Era 1)
Kills: Iron Vanguard 23, Pale Court 17
Victor: The Iron Vanguard
Treasury claimed: 340 gold
```

This feeds directly into the Living Chronicle.

---

## Seasonal Competition

### Seasons

Guild seasons run for **12 weeks** (matching Albion's proven cadence). At the end of each season, guilds are ranked and rewarded. Seasons do **not** reset guild progress — the guild persists, only the seasonal leaderboard resets.

### Scoring

| Activity | Points |
|----------|--------|
| PvE monster kills (guild-wide) | 1 point per kill |
| PvP wins (guild-wide) | 10 points per win |
| Territory held at season end | 500 points per tile |
| Guild wars won | 200 points per war |
| Guild contracts completed | 50 points per contract |

### Rewards

| Rank | Reward |
|------|--------|
| **1st place** | Exclusive seasonal guild banner cosmetic + "Dominant Order" badge for all members (soulbound, permanent) + 5,000 gold treasury bonus |
| **2nd–3rd place** | Seasonal badge + 2,500 gold treasury bonus |
| **4th–10th place** | Seasonal badge + 1,000 gold treasury bonus |
| **All participating guilds** (100+ points) | "Season [N] Veteran" badge for all members |

### Why Seasons Work

- **Recurring stakes**: Every 12 weeks, the slate is wiped for seasonal ranking. This creates urgency without destroying permanent guild identity.
- **Badges are permanent**: Even though the leaderboard resets, the badges you earned stay forever. A guild with "Season 1 Dominant Order" badges on its members has permanent proof of their early dominance.
- **Gold injection**: Season rewards put gold into treasuries, jumpstarting the golden loop for the next season.
- **Content without content**: Seasons create "things to do" without requiring new zones, items, or systems. It's a meta-game layer that runs on top of existing mechanics.

---

## Lore Integration

### The Living Chronicle

Guild actions are recorded in the Living Chronicle alongside individual player deeds:

```
THE FOUNDING OF THE IRON VANGUARD
Founded by [Leader Name], Day 14 of the Awakening
First Order to claim territory in the Outer Realms

---

THE SIEGE OF TILE (8,7)
The Pale Court contested The Iron Vanguard's hold
3 days of battle. 47 kills exchanged.
The Iron Vanguard held. The Pale Court retreated.
```

### Guild Lore Fragments

New lore fragments are unlockable through guild activities:

| Fragment | Trigger | Content |
|----------|---------|---------|
| **The Pact** | Form a guild | "In the dark, the survivors learned what the gods never could — that strength is not solitary. The first pacts were sealed not in temples but in blood and trust." |
| **The Banner** | Claim first territory | "They drove a banner into corrupted soil and declared: this ground is ours. The Wound did not care. But the other survivors noticed." |
| **The Tax Collector** | Accumulate 10,000 gold in treasury (lifetime) | "Gold flows upward in every civilization. The question is always the same: does it flow back down?" |
| **Brother's Keeper** | Approve 10 regear requests | "They buried their dead and re-armed the living. This is the oldest economy — loss shared is loss halved." |

### Guild Names in World Events

When world events occur (new zone openings, era transitions, boss kills), the top guilds' names are inscribed into the event record. This creates a permanent connection between player organizations and the evolving story.

### Connection to Factions

Orders that strongly align with a faction (>80% of members from one faction) receive a faction title:

- **Covenant-aligned**: "Covenant Order of [Name]"
- **Unbound-aligned**: "Unbound Order of [Name]"
- **Mixed**: No prefix — just the guild name

This title appears in the Living Chronicle and on territory banners. It connects player-created guilds to the existing narrative tension (faith vs. self-reliance) without forcing anyone into a faction.

---

## Anti-Abuse & Edge Cases

### Preventing Mega-Alliances

| Mechanism | Details |
|-----------|---------|
| Hard cap: 50 members per guild | Non-negotiable. No "alliance" system. |
| No formal alliance mechanic | Guilds that want to cooperate can do so socially, but the system provides no mechanical alliance benefits (no shared territory bonuses, no allied war declarations). |
| Territory cap: 3 tiles per guild | Even the strongest guild controls at most 12% of the danger zone. |

**Rationale**: Albion Online's single biggest design failure is unlimited alliances. Mega-coalitions of 1,000+ players monopolize territory through Non-Aggression Pacts. By never building the alliance mechanic, UD avoids this entirely. Organic cooperation still happens — guilds can choose not to attack each other — but they get no system rewards for it.

### Preventing Treasury Theft

| Mechanism | Details |
|-----------|---------|
| On-chain transparency | Every treasury transaction is visible to all members. No hidden withdrawals. |
| No direct withdrawal to personal wallet | Leader can only spend treasury on defined categories (buffs, regear, territory, war). There is no "withdraw to self" function. |
| Regear cap | Max 500 gold or 10% of treasury per regear request. Leader cannot drain treasury through fake regear. |

**Rationale**: New World and WoW both suffer from governor/GM theft. UD makes it architecturally impossible — the treasury System contract only supports defined spending categories.

### Preventing Tax Manipulation

| Mechanism | Details |
|-----------|---------|
| 24-hour cooldown on rate changes | Leader cannot spike the rate before a big payout |
| Rate visible to all members | No surprises |
| 50% maximum | Even the highest rate leaves members with half their earnings |

### Preventing Guild-Hopping Exploits

| Mechanism | Details |
|-----------|---------|
| 3-day cooldown after leaving | Cannot immediately join a new guild for buffs |
| 7-day cooldown after being kicked from a specific guild | Cannot rejoin the same guild quickly (prevents collusion) |
| Seasonal eligibility: must be in guild for 75% of season | Prevents joining a top guild in week 11 for rewards (Albion uses this same rule) |

### Inactive Guild Handling

| Scenario | Response |
|----------|----------|
| Leader inactive 14 days | Auto-succession to longest-tenured active Officer |
| All members inactive 7+ days | Guild enters "dormant" state (upkeep paused, territory released, buffs off) |
| All members leave | Guild dissolved, treasury burned, name released after 30 days |
| Single member remains | Guild persists but cannot activate buffs or hold territory (minimum 3 active members for treasury features) |

---

## On-Chain Architecture

### MUD Tables

```
Guild
  key: [guildId: bytes32]
  values:
    name: string
    tag: string
    leader: bytes32          // characterId
    taxRate: uint16          // basis points (0–5000 = 0–50%)
    treasuryGold: uint256
    memberCount: uint32
    isOpen: bool
    createdAt: uint256
    lifetimeGoldEarned: uint256  // for lore fragment triggers

GuildMembership
  key: [characterId: bytes32]
  values:
    guildId: bytes32
    role: uint8              // 0=none, 1=member, 2=officer, 3=leader
    joinedAt: uint256
    lastActive: uint256
    seasonJoinedAt: uint256  // for seasonal eligibility check

GuildTerritory
  key: [x: uint32, y: uint32]
  values:
    guildId: bytes32
    claimedAt: uint256
    contested: bool
    contestingGuildId: bytes32
    contestStartedAt: uint256

GuildWar
  key: [warId: bytes32]
  values:
    guild1: bytes32
    guild2: bytes32
    startTime: uint256
    endTime: uint256
    kills1: uint32
    kills2: uint32
    resolved: bool

GuildBuff
  key: [guildId: bytes32, buffType: uint8]
  values:
    activatedAt: uint256
    expiresAt: uint256

GuildContract
  key: [guildId: bytes32, weekId: uint256]
  values:
    contractType: uint8
    target: uint256
    progress: uint256
    completed: bool
    rewardClaimed: bool

GuildSeason
  key: [seasonId: uint32, guildId: bytes32]
  values:
    points: uint256
    pveKills: uint256
    pvpWins: uint256
    tilesHeldAtEnd: uint32
    warsWon: uint32
    contractsCompleted: uint32
```

### New Systems

| System | Responsibility |
|--------|---------------|
| `GuildSystem` | Create, join, leave, kick, promote, demote, set tax rate, disband, leadership succession |
| `GuildTreasurySystem` | Activate buffs, approve regear, pay territory upkeep, pay war costs |
| `GuildTerritorySystem` | Claim tile, contest tile, resolve siege, release territory |
| `GuildWarSystem` | Declare war, track kills, resolve war, transfer treasury on loss |
| `GuildContractSystem` | Generate weekly contracts, track progress, claim rewards |
| `GuildSeasonSystem` | Track seasonal points, resolve season, distribute rewards |

### Integration Points (Existing Systems)

| Existing System | Change |
|----------------|--------|
| `CombatSystem` (PvE reward) | After gold drop calculation, check `GuildMembership`. If member, split gold: `(1 - taxRate)` to player, `taxRate` to `Guild.treasuryGold`. |
| `CombatSystem` (PvP reward) | Same tax split on escrow winnings. If war active between guilds, apply 1.5x escrow multiplier and +25% XP. Remove PvP cooldown for warring guilds. |
| `CombatSystem` (PvP damage) | If on guild-held territory, apply +5% damage bonus for defending guild members. |
| `SpawnSystem` | Check `GuildBuff` for active HP buff. Apply max HP modifier. |
| `MovementSystem` | Check `GuildTerritory` on each move. Update tile presence for siege calculation. |

### Gas Considerations

The tax split adds 1 SLOAD (read GuildMembership) + 1 SLOAD (read Guild.taxRate) + 1 SSTORE (update Guild.treasuryGold) to every combat reward transaction. At ~2,100 gas per SLOAD and ~5,000 gas per SSTORE, this adds ~9,200 gas — negligible on Base L2 where gas is fractions of a cent.

---

## What NOT to Build

Lessons from every failed guild system in gaming history:

| Anti-Pattern | Why It Fails | UD's Approach |
|-------------|-------------|---------------|
| **Passive income from headcount** (WoW Cash Flow) | Incentivizes spam-recruiting strangers, not community building. WoW removed it. | Tax is on member *activity*, not member *count*. Inactive members generate zero revenue. |
| **Voluntary-only funding** (WoW, GW2, FFXIV) | Treasury is always empty. "Donate pls" creates resentment. | Automatic tax. No donation mechanic needed. |
| **Seasonal progress reset** (Destiny 2) | Destroys sense of persistent investment. Players feel like they're on a treadmill. | Seasonal *leaderboard* resets. Guild itself, treasury, territory, and badges persist forever. |
| **Housing/space scarcity** (FFXIV lottery) | Gates core features behind luck. Creates haves vs have-nots. | Any guild with 500 gold can claim a tile. 25 tiles for the whole danger zone — scarce enough to fight over, abundant enough that active guilds can hold something. |
| **Unlimited alliances** (Albion) | Mega-coalitions monopolize content. Smaller groups can never compete. | No alliance mechanic. Period. |
| **DAO governance** (Dark Forest) | Too slow for real-time game decisions. Voter fatigue kills participation. | Autocratic leadership with on-chain transparency and automatic succession. Fast decisions, no theft. |
| **Guild-exclusive power items** | Violates "money never gives insurmountable advantage." Solo players feel locked out. | Buffs are modest (+5–10%). No exclusive items or abilities. |
| **Upkeep as mandatory chore** (RuneScape citadels) | Weekly resource-gathering feels like homework. Players log in from obligation, not desire. | Upkeep is gold-based and automatic. No "go gather resources for the citadel" busywork. Active play naturally generates tax revenue that covers upkeep. |

---

## Implementation

### Context: Guilds Ship With Windy Peaks

Guilds gate behind **Level 20** — the cap of Zone 2 (Windy Peaks). This is deliberate. By the time a player can create a guild, they've:

- Survived the Dark Cave (Zone 1, levels 1–10)
- Progressed through Windy Peaks (Zone 2, levels 11–20)
- Spent real time in the danger zone, lost gold in PvP, felt the sting of dying alone
- Built enough game knowledge to understand what a guild *means*

Guilds arriving in Zone 2 also gives them narrative weight: the Dark Cave is where you wake up alone. Windy Peaks is where you start building something with others. The Orders form because the world demands it.

### MVP: The Minimum Golden Loop

The golden loop has two halves: **earn side** (tax flows into treasury) and **spend side** (treasury flows back to members). You need both halves to test anything meaningful. A treasury that only fills up with no way to spend is just a number on a screen.

**The absolute minimum to test the golden loop:**

#### Contracts (4 total)

| # | What | Details |
|---|------|---------|
| 1 | `Guild` table | guildId, name, tag, leader, taxRate, treasuryGold, memberCount, isOpen, createdAt |
| 2 | `GuildMembership` table | characterId → guildId, role, joinedAt |
| 3 | `GuildSystem` | Create (1,000 gold, level 20), join, leave, kick, promote, set tax rate |
| 4 | Tax intercept in `CombatSystem` | On gold drop: check membership → split by taxRate → player gets (1-rate), treasury gets rate |

That's the **earn side**. Four contract pieces. The tax intercept is ~15 lines of Solidity in the existing CombatSystem reward logic.

For the **spend side**, the simplest possible mechanism:

| # | What | Details |
|---|------|---------|
| 5 | `GuildTreasurySystem` | Leader can transfer gold from treasury to any member. Capped at 500 gold or 10% of treasury per transfer. 72-hour cooldown per recipient. |

That's it. One spending function. Not the full regear request/approve flow — just "leader sends treasury gold to a member." The social layer (deciding who gets gold and why) happens in chat, not in code. This is enough to close the loop:

```
Member kills monsters → 15% goes to treasury → Member dies in PvP →
Leader sends 200 gold from treasury → Member re-equips → repeat
```

#### Client (3 pieces)

| # | What | Details |
|---|------|---------|
| 1 | Guild creation UI | Form in character page or new `/guilds` route. Name, tag, open/closed, tax rate. |
| 2 | Guild info display | Guild tag next to character name on map tiles. Treasury balance + member list visible to members (Stats drawer or dedicated panel). |
| 3 | Treasury transfer UI | Leader sees "Send Gold" button next to each member in the member list. Amount input, capped per the contract limits. |

No guild chat (use existing chat — members can see each other's tags). No guild page. No buffs UI. No territory UI. Bare minimum.

#### Total Scope

- **2 new MUD tables** (Guild, GuildMembership)
- **2 new Systems** (GuildSystem, GuildTreasurySystem)
- **~15 lines** modified in CombatSystem (tax intercept)
- **3 client components** (creation form, guild info display, treasury transfer)
- **0 new dependencies**

### What You're Testing

With just the MVP deployed on beta (Windy Peaks, Base Mainnet beta world), you're validating:

| Question | How You Measure It | Signal |
|----------|-------------------|--------|
| **Do players form guilds?** | Count of guilds created in first 2 weeks | >3 guilds with 3+ members = healthy |
| **Is the tax rate acceptable?** | What rates leaders set + whether members leave over tax | Most guilds settling at 10–20% = well-calibrated |
| **Does the treasury accumulate?** | Treasury balances over time | Treasuries growing = earn side works |
| **Does the leader redistribute?** | Count of treasury transfers | Leaders sending gold to members who lost PvP = spend side works |
| **Does guild identity emerge?** | Chat behavior, tag usage, PvP patterns | Players saying "us vs them" in chat, targeting/avoiding guild members = identity forming |
| **Do guilds increase PvP engagement?** | PvP frequency for guilded vs non-guilded players | Guilded players enter danger zone more often = regear safety net is working |

If these signals are positive, the golden loop is validated and you build the next layer. If not, you adjust tax rates, transfer caps, or creation cost before investing in buffs/territory/wars.

### What You're NOT Testing Yet

Explicitly deferred to later phases. Do not scope-creep into these during MVP:

- Guild buffs (need more treasury volume data first)
- Territory (needs map/zone infrastructure that may change with Zone 3)
- Wars (needs enough guilds to have rivalries — minimum 4-5 active guilds)
- Seasons (needs wars + territory to score meaningfully)
- Contracts (needs buff system as rewards)
- Auto-succession (can be manual admin fix for beta — formalize later)
- Lore fragments (nice-to-have, zero gameplay impact)

### Phase Roadmap (Post-MVP)

Each phase ships only after the previous phase's signals are validated.

| Phase | Ships When | Adds | Tests |
|-------|-----------|------|-------|
| **MVP** | Windy Peaks launch | Tax + Treasury + Transfer | Golden loop core |
| **Phase 2: Regear** | 2-4 weeks post-launch, if treasury transfers are happening | Formal regear request/approve flow, Officer rank, regear caps | Does structured insurance increase risk-taking? |
| **Phase 3: Buffs** | When 5+ active guilds exist | 5 guild buffs, 2 active at once | Do buffs create meaningful treasury spending decisions? |
| **Phase 4: Territory** | When danger zone PvP is active and guild rivalries exist | Tile claiming, upkeep, gold/damage bonuses | Does territory create scheduled conflict and guild-level goals? |
| **Phase 5: Wars** | When territory disputes happen organically | War declarations, kill tracking, treasury stakes | Do formal wars increase engagement or just formalize existing behavior? |
| **Phase 6: Seasons** | When wars + territory are stable | 12-week seasons, scoring, badges | Does seasonal competition create recurring urgency? |
| **Phase 7: Lore** | Anytime after Phase 2 | Lore fragments, Living Chronicle entries, faction titles | Does lore recognition matter to players? (Low-effort, high-sentiment) |

### Migration Safety

Guild tables are **new tables with new keys** — no existing data is affected. The only modification to an existing system is the tax intercept in CombatSystem, which is additive (new code path that only fires if the player has a guildId). If guildId is zero (not in a guild), the existing logic runs unchanged.

**Rollback plan**: If guilds need to be disabled, set a global `guildsEnabled` flag in UltimateDominionConfig. The tax intercept checks this flag — if false, skip the split. Guild tables remain but stop accruing. No data migration needed in either direction.

---

## Open Questions

- [ ] Should guilds be able to set a **minimum level requirement** above 3 for membership?
- [ ] Should territory claiming work differently when **multiple zones** exist? (One guild can hold tiles in Dark Cave AND Zone 2?)
- [ ] Should there be a **guild stash** (shared item storage in addition to gold treasury)? If so, what prevents the leader from taking everything?
- [ ] What happens to guild territory when **new zones are added**? Do danger zone boundaries expand?
- [ ] Should PvP item drops (when implemented) go to the **killer's guild treasury** or to the killer personally?
- [ ] Should there be **guild-specific monsters** or bosses that only spawn on guild-held territory?
- [ ] How does guild chat work with the existing chat system? Separate channel? Tab? Different color?
- [ ] Should the **siege window** time be fixed globally or configurable per world?
- [ ] Should there be a **guild creation cooldown** per player (e.g., can only create one guild per 30 days) to prevent guild-churn griefing?
- [ ] Exact values for all gold costs, caps, and cooldowns need playtesting. The numbers in this doc are starting points.

---

*Last updated: March 9, 2026*
