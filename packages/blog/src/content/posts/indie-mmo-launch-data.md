---
title: "We Launched an Indie MMO and Tracked Every Player Action Onchain — Here's What Happened"
description: "Real data from the first 14 days of Ultimate Dominion: 92 players, 41,333 onchain actions, 58% reached level 3, and one player performed 8,143 actions. A transparent look at what worked and what didn't."
date: 2026-03-24
tags: ["data", "indie", "launch", "retention"]
draft: false
---

Ultimate Dominion launched on March 10, 2026. Because every action in the game is recorded onchain, we have complete, verifiable data on what happened next. No estimates, no sampling — every monster killed, every item looted, every gold piece earned is a permanent record on Base.

Here's what 14 days of real player data looks like for an indie MMO built by one person.

## How Many Players Signed Up?

In the first 14 days, **92 real players** created characters (excluding 20 dev/test accounts). Of those, **90 (98%) took at least one action** in the game. Two players created characters and never moved.

Peak daily active users hit **35 on March 20**, driven by a Reddit post that brought in 27 new players in a single day. Average daily active users across the period was **9.6**.

## How Far Did Players Get?

This is the progression funnel — the percentage of all 92 players who reached each level milestone:

| Level | Players | % of Total |
|-------|---------|------------|
| Created a character | 92 | 100% |
| Took any action | 90 | 98% |
| Reached Level 2 | 66 | 72% |
| Reached Level 3 | 53 | 58% |
| Reached Level 5 | 31 | 34% |
| Reached Level 7 | 11 | 12% |
| Reached Level 10 (max) | 6 | 7% |

**58% of players reached level 3**, which takes roughly 15-20 minutes of gameplay. That means most people who tried the game actually played it — they didn't bounce off the landing page or quit after one fight.

The biggest drop-off was **Level 1 to Level 2**, where 26% of players stalled. This is the "I don't understand what to do" churn point that led us to redesign the onboarding experience mid-launch.

## Did Players Come Back?

**23% of players returned on at least two different days.** Among players who reached level 3 or higher, the return rate jumped to **38%**.

| Days Active | Players | % |
|-------------|---------|---|
| 1 day only | 69 | 77% |
| 2 days | 12 | 13% |
| 3 days | 2 | 2% |
| 4 days | 2 | 2% |
| 5 or more days | 5 | 6% |

For context, typical D1 retention for web3 games is 10-25%. Indie MMOs see 15-30%. Polished MMOs with years of development hit 40-60%. At 23% with zero social features, no push notifications, no email re-engagement, and no daily login rewards, the core gameplay loop is doing the heavy lifting.

## What Does Deep Engagement Look Like?

Five players crossed the "power user" threshold of 5+ active days. One of them — Tony — performed **8,143 onchain actions** in 6 days. That's not someone killing time. That's someone hooked on the game.

| Player | Level | Days Active | Actions |
|--------|-------|-------------|---------|
| Tony | 10 | 6 | 8,143 |
| King | 10 | 8 | 4,443 |
| mokn | 10 | 12 | 4,276 |
| Masterpiece | 10 | 6 | 2,886 |
| The Scrivener | 5 | 5 | 357 |

The total across all players: **41,333 onchain actions** in 14 days. Every one of those is a verifiable transaction on Base — not a server log that could be fabricated, but a permanent blockchain record.

## Did the Onboarding Redesign Work?

On March 18-19, we shipped a major onboarding overhaul: a progressive UI that reveals controls gradually, a safety zone where new players can't be attacked, WASD navigation hints, monster level filtering, and milestone celebrations for leveling up.

We compared 24 players from before the redesign against 66 players from after:

| Metric | Before (n=24) | After (n=66) | Change |
|--------|--------------|-------------|--------|
| Reached Level 2+ | 62% | 77% | **+15 percentage points** |
| Reached Level 3+ | 58% | 59% | No change |
| Bounced at Level 1 | 38% | 23% | **-15 percentage points** |

The onboarding solved the immediate problem — **L1 churn dropped from 38% to 23%**. More players are getting past the initial confusion and into the core loop. But it didn't move the L3+ needle, which tells us the mid-game needs more work.

## How Does This Compare to Industry Benchmarks?

| Metric | Ultimate Dominion | Web3 Games (typical) | Indie MMOs | Polished MMOs |
|--------|------------------|---------------------|------------|---------------|
| D1 retention | 16-25% | 10-25% | 15-30% | 40-60% |
| D7 retention | ~10% | 5-15% | 8-15% | 25-35% |
| Past tutorial (L2+) | 72% | <50% | 50-70% | 80%+ |
| Power user depth | Exceptional | Low-medium | Medium | High |

The standout metric is power user engagement. Players who stay are *deeply* engaged — the kind of engagement you typically only see in games with years of content and established communities.

## What's Next?

The data tells us three things clearly:

1. **The core loop works.** 58% reaching L3 with no hand-holding means the combat and progression feel good enough to keep playing.
2. **The reason to come back is missing.** 23% return is solid for early-stage, but it's carried entirely by gameplay. There are no social hooks — no guilds, no group content, no events. Adding those should move the return rate significantly.
3. **The mid-game needs depth.** Players who hit L3 need a reason to push to L5 and beyond. Zone 2 content is in development and will extend the progression curve.

Everything in this analysis is verifiable onchain. The world contract is `0x99d01939F58B965E6E84a1D167E710Abdf5764b0` on Base. Every number in this post can be independently confirmed by querying the blockchain.

---

*Ultimate Dominion is a free multiplayer text-based RPG (MUD) playable in any browser. No downloads required. [Play now at ultimatedominion.com](https://ultimatedominion.com).*
