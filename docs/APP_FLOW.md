# Ultimate Dominion — Application Flow

The actual current user experience as implemented in the client.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Welcome Screen](#welcome-screen)
3. [Character Creation](#character-creation)
4. [Game Board](#game-board)
5. [Combat](#combat)
6. [Shop](#shop)
7. [Marketplace](#marketplace)
8. [Character Page](#character-page)
9. [Leaderboard](#leaderboard)
10. [Lore Fragments](#lore-fragments)
11. [Route Map](#route-map)
12. [Context Reference](#context-reference)

---

## Authentication

Dual-path authentication via `AuthContext.tsx`.

### Path A: Privy Embedded Wallet (Primary)

For non-crypto users. "Sign in with Google" button.

```
Click "Play" → SignInModal → "Sign in with Google"
    → Privy OAuth (Google) → MPC wallet created on-device
    → Privy walletClient (EOA, signs directly)
    → authMethod = 'embedded', isAuthenticated = true
    → Navigate to game (no delegation needed)
```

The Privy embedded wallet uses MPC on-device signing — the wallet IS a standard EOA that signs transactions directly. No bundler, no enclave, no meta-transactions.

### Path B: RainbowKit External Wallet

For crypto-native users. Shown only if `window.ethereum` detected.

```
Click "Play" → SignInModal → "Sign in with Wallet"
    → RainbowKit ConnectButton (MetaMask popup)
    → authMethod = 'external', isAuthenticated = true
    → ConnectWalletModal: "Set Up Game Account"
    → DelegationButton → setupDelegation()
    → Burner wallet created, delegation synced via MUD
    → Navigate to game
```

External users get a burner session key so they don't approve every action.

### Provider Hierarchy

```
Web3Provider (wagmi + RainbowKit)
  → PrivyProvider (Privy + auth state)
    → AuthProvider (auth method resolution)
      → MUDProvider (world contract, burner, RECS)
        → App (routes, game contexts)
```

---

## Welcome Screen

**Route**: `/`

- Narrative intro text
- MUD sync progress bar (blockchain state loading)
- "Play" button → opens auth modal or navigates to game if already authenticated

---

## Character Creation

**Route**: `/character-creation`

Two-panel layout. Left panel: mint character (name, avatar, bio). Right panel: 4-step implicit class wizard.

### Step 1: Choose Race

| Race | STR | AGI | INT | HP |
|------|-----|-----|-----|----|
| Human | +1 | +1 | +1 | — |
| Dwarf | +2 | -1 | — | +1 |
| Elf | -1 | +2 | +1 | -1 |

### Step 2: Choose Power Source

Divine / Weave / Physical — thematic only, does not restrict class.

### Step 3: Roll Stats

- 19 total points across STR, AGI, INT (range 3–10 each)
- Base HP: 18 (before modifiers)
- Unlimited re-rolls
- Shows dominant stat and note: "At Level 10, you can choose any advanced class!"

### Step 4: Choose Starter Equipment

- Select one weapon + one armor from StarterItemPool
- Items with unmet stat requirements are greyed out
- "Wake Up to the Dark Cave" → `enterGame()` → navigate to `/game-board`

---

## Game Board

**Route**: `/game-board`

Main gameplay screen. 4-panel grid on desktop (stats, tile details, actions, map).

```
+----------+---------------------+----------+
| Stats    | Tile Details        | Map      |
| Panel    | (mobs, players,     | Panel    |
|          |  shops, fragments)  | (10x10)  |
|          +---------------------+          |
|          | Actions Panel       |          |
|          | (attack, flee,      |          |
|          |  use items)         |          |
+----------+---------------------+----------+
```

- **Movement**: Arrow keys or directional buttons, 1 tile/action, blocked during battle
- **Spawning**: "Spawn" button places character on map at (0,0)
- **Tile 0,0**: Adventure Escrow — deposit/withdraw gold
- **Safety zone**: x < 5 or y < 5 (PvE only)
- **Danger zone**: x >= 5 and y >= 5 (PvP enabled)

---

## Combat

Triggered from Tile Details when a mob or player is on the same tile.

- Select equipped weapon/spell → "Attack" → `endTurn()`
- 30-second turn timer
- Status effects displayed per combatant
- Consumables usable during combat
- **PvP flee**: Available turns 1–2 (10% escrow penalty — 5% burned, 5% to opponent. Smoke Cloak negates.)
- **PvE flee**: Available turns 1–2 (5% escrow burned. Smoke Cloak negates.)
- Battle Outcome Modal: win/loss, XP, gold, items

---

## Shop

**Route**: `/shops/:shopId`

Split-screen: player inventory (left) vs shopkeeper inventory (right).

- Buy: pay gold (with markup), receive items
- Sell: trade items (with markdown), receive gold
- Requires ERC20/ERC1155 allowance approval
- "Exit Shop" button returns to game board

---

## Marketplace

**Routes**: `/marketplace`, `/marketplace/items/:itemId`

### List View

- Search + filter (item type, sort by level/price/offer)
- Tabs: "For Sale", "$GOLD Offers", "My Listings"
- Paginated (10 per page)

### Item Detail View

- Item stats and requirements (left)
- Create buy offer or sell listing (right)
- Accept/cancel orders
- Cannot sell equipped items

---

## Character Page

**Route**: `/characters/:id`

- Gold balance (external + escrow)
- XP/Level progress bar + "Level Up" button
- Advanced class selection at Level 10
- Avatar, name, bio, class, badges (Adventurer badge at Level 3)
- Items inventory (tabs: Armor, Weapons & Spells, Consumables)
- Fragment collection grid
- Viewable by any authenticated player

---

## Leaderboard

**Route**: `/leaderboard`

- All characters listed with avatar, name, class, level, stats, gold
- Search, class filter, sort (stats/level/gold)
- Top 3 highlighted
- Click row → navigate to character page

---

## Lore Fragments

8 collectible narrative NFTs discovered through gameplay.

1. **Discovery**: Moving to trigger tiles shows a "fragment echo" visual overlay
2. **Claim**: Claim button mints ERC721 NFT on-chain
3. **Collection**: Fragment grid on character page — Roman numeral tiles, claimed fragments marked, narratives readable

---

## Route Map

| Route | Auth | Delegation | Locked Character |
|-------|:----:|:----------:|:----------------:|
| `/` | No | No | No |
| `/character-creation` | Yes | Yes | No (redirects if yes) |
| `/game-board` | Yes | Yes | Yes |
| `/characters/:id` | Yes | No | No |
| `/leaderboard` | Yes | No | No |
| `/marketplace` | Yes | Yes | Yes |
| `/marketplace/items/*` | Yes | Yes | Yes |
| `/shops/:shopId` | Yes | Yes | Yes + active encounter |

---

## Context Reference

| Context | Purpose |
|---------|---------|
| AuthContext | Dual-path auth state, Privy OAuth, wallet clients |
| MUDContext | Blockchain sync, burner wallet, delegation, system calls |
| CharacterContext | Current character data, inventory, equipment |
| BattleContext | Active combat, attack outcomes, turn management |
| MapContext | World map, entity positions, spawn state |
| MovementContext | Arrow key / button movement, blocking |
| FragmentContext | Lore fragment discovery, claiming, tracking |
| ItemsContext | Item templates from MUD tables |
| MonstersContext | Monster templates from MUD tables |
| OrdersContext | Marketplace orders, prices |
| ChatContext | Chat box state, input focus |
| AllowanceContext | ERC20/ERC1155 allowances |

---

*Last updated: March 9, 2026*
