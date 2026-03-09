# Ultimate Dominion — System Architecture

## MUD World Architecture

Ultimate Dominion is built on MUD v2 (Lattice). A single **World** contract acts as the entry point and data store. Game logic lives in **System** contracts registered with the World.

### Execution Model

All systems are **namespaced** (non-root) under the `UD` namespace:

- Namespaced systems are called via `call` (NOT `delegatecall`)
- `address(this)` inside a system = **system contract address**, not the World address
- The World routes function calls to systems via registered function selectors, all prefixed with `UD__`

### Key Gotchas

1. **address(this) Key Orphaning**: System upgrades via `mud deploy` create a NEW contract address. Data keyed by `address(this)` is orphaned at the old address. Fix: use `_world()` as key or existence checks instead of counters.

2. **prohibitDirectCallback**: `World.call()` and `World.callFrom()` revert if `msg.sender == address(this)`. Systems cannot call back into `World.call()`.

3. **Puppet callFrom**: ERC721/ERC1155 puppets use `callFrom` which has access control issues in system context. Fix: write directly to MUD tables using table libraries. `StoreSwitch` detects context and uses `StoreCore` directly.

4. **Deploy Nonce Errors**: `mud deploy` with nonce errors can silently skip transactions. Always verify function selectors after deploy.

---

## System Inventory

Modularization is **COMPLETE** — all systems are within EIP-170 limits.

### Character Systems

| System | Purpose |
|--------|---------|
| CharacterSystem | Top-level character coordinator |
| CharacterCore | Character CRUD, minting, entry |
| StatSystem | Stat generation, modification, bonuses |
| LevelSystem | Level progression, XP, badge minting |
| ImplicitClassSystem | Race/power source/armor selection, advanced class at Level 10 |

### Combat Systems

| System | Purpose |
|--------|---------|
| CombatSystem | Core combat coordinator, damage resolution |
| PhysicalCombat | Weapon-based attacks, hit/crit calculations |
| MagicCombat | Spell-based attacks, resistances |
| StatusEffects | Buff/debuff application and tracking |
| EffectsSystem | Effect processing and stat modifications |
| EffectDataSystem | Effect template data (admin only) |
| EncounterSystem | Encounter lifecycle, turn management |
| PvESystem | Player vs Environment logic |
| PvPSystem | Player vs Player logic (zone restricted, escrow, flee) |
| PvpRewardSystem | PvP reward distribution |
| PveRewardSystem | PvE reward distribution |

### Equipment Systems

| System | Purpose |
|--------|---------|
| EquipmentSystem | Equipment coordinator |
| EquipmentCore | Core validation, slot management |
| WeaponSystem | Weapon stats, equip/unequip |
| ArmorSystem | Armor stats, type modifiers |
| AccessorySystem | Accessory management |
| ConsumableSystem | Consumable usage and effects |

### World/Map Systems

| System | Purpose |
|--------|---------|
| MapSystem | Movement (1 tile/action, 1s cooldown), spawn/despawn |
| MapSpawnSystem | Mob spawning based on distance from home |
| WorldActionSystem | World-level actions, board management |
| MobSystem | Monster definitions, stats |
| ShopSystem | NPC buy/sell, markup/markdown, 12h restock |
| AdminShopSystem | Admin shop configuration |

### Economy Systems

| System | Purpose |
|--------|---------|
| MarketplaceSystem | Player-to-player trading, orders, fee collection |
| LootManagerSystem | Loot tables, drop distribution, item escrow |

### Social Systems

| System | Purpose |
|--------|---------|
| FragmentSystem | Lore fragment NFT triggers and minting |
| Badge minting | Via LevelSystem — ERC1155 badges at milestones |

### Admin/Infrastructure

| System | Purpose |
|--------|---------|
| AdminSystem | Admin utilities (teleport, stats editing, debug) |
| PauseSystem | Emergency pause/unpause all user-facing systems |
| PauseLib | Pause check library used by all systems |
| ItemCreationSystem | Post-deployment item creation (admin only) |
| ItemsSystem | Item data management |
| UltimateDominionConfigSystem | Global config (token addresses, fees) |
| UtilsSystem | Utility functions |
| RngSystem | Random number generation |

---

## Access Control

### Admin System
- `Admin` table: `address → bool` mapping
- Admin-only functions check `Admin.get(msg.sender)` or `Admin.get(_msgSender())`
- Deployer set as admin during PostDeploy

### Pause System `[IMPLEMENTED]`
- `PauseSystem` + `PauseLib` = emergency circuit-breaker
- All user-facing entry points check `PauseLib.requireNotPaused()`
- Admin-only pause/unpause

### Namespace Permissions
- All systems under `UD` namespace
- MUD namespace access control governs table write permissions
- Systems in same namespace share table write access

---

## Token Architecture

All tokens deployed as MUD ERC puppet modules. Addresses stored in `UltimateDominionConfig`.

| Token | Standard | Purpose |
|-------|----------|---------|
| Gold | ERC20 | In-game currency (shops, marketplace, escrow) |
| Characters | ERC721 | Player character NFTs |
| Items | ERC1155 | Equipment, consumables (stackable) |
| Badges | ERC1155 | Achievement badges (soulbound) |
| Fragments | ERC721 | Collectible lore narrative NFTs |

### Token Access from Systems

Because systems use `call` (not `delegatecall`), puppet `callFrom` has access control issues. Solution — write directly to MUD tables:

```solidity
import { _ownersTableId, _balancesTableId } from "@latticexyz/world-modules/.../utils.sol";
import { Owners } from ".../erc721-puppet/tables/Owners.sol";
import { Balances } from ".../tokens/tables/Balances.sol";

// StoreSwitch detects context and uses StoreCore directly
Owners.set(_ownersTableId(CHARACTERS_NAMESPACE), tokenId, newOwner);
```

---

## Key Tables

Defined in `mud.config.ts`, auto-generate Solidity libraries.

### Character Data
- `Characters` — Metadata (name, locked state, original/base stats)
- `Stats` — STR, AGI, INT, maxHP, currentHP, XP, level, race, powerSource, armorType, advancedClass
- `ClassMultipliers` — Physical/spell/healing/crit/maxHP multipliers per class (basis points)

### Items & Equipment
- `Items` — Item definitions (type, dropChance, price, stats)
- `WeaponStats`, `ArmorStats`, `ConsumableStats`, `AccessoryStats`, `SpellStats` — Type-specific stats
- `CharacterEquipment` — Equipped items per character (weapons[], armor[], spells[], consumables[], accessories[])

### World & Position
- `Position` — Entity (x, y) coordinates
- `MapConfig` — Map dimensions (height, width)
- `Spawned` — Whether entity is on the map

### Combat
- `CombatEncounter` — Encounter data (attackers[], defenders[], turn, type, timing)
- `EncounterEntity` — Per-entity combat state (encounterId, died, pvpTimer, statusEffects[])
- `ActionOutcome` (offchain) — Per-action results (damage, hit/miss/crit)
- `CombatOutcome` (offchain) — Encounter resolution (XP, gold, items)

### Economy
- `Shops` — NPC shop state (stock[], gold, markup, markdown, restockTimestamp)
- `Orders`, `Offers`, `Considerations` — Marketplace order data
- `MarketplaceSale` (offchain) — Transaction history
- `AdventureEscrow` — Gold held per character

### Social
- `FragmentProgress` — Per-character fragment trigger/claim state
- `FragmentMetadata` — Fragment names, narratives, hints

### Config
- `UltimateDominionConfig` — Token addresses, fee percent, global settings
- `Admin` — Admin address registry
- `Paused` — Global pause flag

---

## Data Flow

```
User Action (click/keypress)
    ↓
React Client (MUD RECS state)
    ↓
viem / wagmi (transaction construction)
    ↓
World Contract (function selector routing)
    ↓
Namespaced System (game logic via call)
    ↓
MUD Tables (on-chain state update)
    ↓
MUD Store Sync (state propagated to client)
    ↓
RECS Components (reactive UI update)
```

---

*Last updated: March 9, 2026*
