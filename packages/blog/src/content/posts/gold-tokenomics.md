---
title: "How Gold Works"
description: "A transparent breakdown of Gold — Ultimate Dominion's in-game currency. Where it comes from, where it goes, and how the economy stays balanced."
date: 2026-03-20
tags: ["announcement", "economy"]
draft: false
featured: true
---

Gold is the currency of Ultimate Dominion. Every trade, every duel, every shop purchase runs on it. This post explains exactly how it works — no spin, no hype, just how the system is built.

## Supply

Gold is an ERC20 token on Base with no maximum supply. New Gold enters the game when players kill monsters. The amount scales with monster level, so higher-level content produces more Gold.

There is no token sale and no investor allocation.

**Initial mints:**

- **20,000,000 Gold** — Minted to the team treasury for operations and future development
- **500,000 Gold** — Minted to seed the Uniswap V3 GOLD/WETH liquidity pool

Everything else in circulation was earned by players through gameplay.

## Where Gold Gets Spent

Gold leaves circulation through several permanent sinks:

- **PvP death penalty** — When you lose a PvP duel, 10% of your staked gold is burned permanently. The rest goes to the winner.
- **PvE death penalty** — Die to a monster and 5% of your adventure escrow is burned.
- **Fleeing combat** — Running from a PvP fight costs you 10% of your escrow, half burned and half to your opponent. Fleeing PvE burns 5%.
- **Marketplace fees** — 3% of every trade on the player marketplace
- **Equipment breaking** — Coming soon. Gear will degrade and eventually break, removing items and the Gold invested in them from the economy.
- **Respecs** — Rebuilding your character will cost Gold

These sinks are permanent. Burned Gold is gone from the total supply forever.

## The Gas Station

Players never pay gas fees in ETH. Instead, the game charges a small amount of Gold per action and automatically swaps it for ETH through the Uniswap V3 GOLD/WETH pool. This is the Gas Station system.

Here's what happens under the hood:

1. You take an action (move, attack, trade)
2. The relayer deducts a small Gold fee from your balance
3. That Gold is sold into the Uniswap pool for WETH
4. The WETH is unwrapped to ETH and used to cover your Base transaction fee

This means the Gold isn't burned — it re-enters circulation via the DEX. Anyone buying Gold on Uniswap is absorbing the supply that players spend on gas.

## How the Economy Balances

Gold flows in a loop:

**In**: Monster kills mint new Gold → players earn it through gameplay

**Out**: PvP burns, PvE death penalties, marketplace fees, equipment breaking, respecs → Gold is permanently removed

**Recirculated**: Gas Station sells Gold into Uniswap → buyers purchase Gold to use in-game (buying items from other players, entering PvP)

The balance comes from player activity on both sides. More players means more Gold minted, but also more Gold burned through combat, trading, and gas. The Uniswap pool acts as the bridge — players who want to skip the grind can buy Gold, and the gas system creates constant sell pressure that keeps the pool active.

## Token Details

- **Name**: Gold
- **Symbol**: 🜚
- **Decimals**: 18
- **Chain**: Base (Chain ID 8453)
- **Contract**: [0x0F046E538926760A737761b555fe1074b6B1e16A](https://basescan.org/token/0x0F046E538926760A737761b555fe1074b6B1e16A)
- **Uniswap Pool**: [GOLD/WETH (1% fee)](https://app.uniswap.org/explore/pools/base/0xE09639634Ba44B86c59dA7703aA9796f88082526)

No vesting. No unlock schedule. No token sale. The team holds a treasury allocation and everything else is gameplay.
