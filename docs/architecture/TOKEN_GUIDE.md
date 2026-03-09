# Token Guide

Developer reference for all token standards in Ultimate Dominion.

---

## Overview

All tokens are deployed as MUD ERC puppet modules registered under dedicated namespaces. Puppet addresses are stored in the `UltimateDominionConfig` singleton table and resolved at runtime — there are no hardcoded token addresses in system contracts.

| Token | Standard | Namespace Constant | Puppet Registration | Transferable |
|-------|----------|-------------------|---------------------|-------------|
| Gold | ERC20 | `GOLD_NAMESPACE` (`"Gold"`) | `registerERC20` | Yes |
| Characters | ERC721 | `CHARACTERS_NAMESPACE` (`"Characters"`) | `registerERC721` | No (NoTransferHook) |
| Items | ERC1155 | `ITEMS_NAMESPACE` (`"Items"`) | `registerERC1155` (custom, `@erc1155/`) | Yes |
| Badges | ERC721 | `BADGES_NAMESPACE` (`"Badges"`) | `registerERC721` | No (NoTransferHook, soulbound) |
| Fragments | ERC721 | `FRAGMENTS_NAMESPACE` (`"Fragments"`) | `registerERC721` | Yes |

All namespace constants are defined in `packages/contracts/constants.sol`.

---

## Deployment (PostDeploy.s.sol)

Each token is deployed idempotently — `PostDeploy` checks `UltimateDominionConfig.get*()` before deploying. The sequence is:

1. **Install PuppetModule** — `world.installModule(new PuppetModule(), ...)` (shared infrastructure for all puppets)
2. **Register each token** — calls `registerERC20` / `registerERC721` / `registerERC1155` with the token's namespace
3. **Store puppet address** — `UltimateDominionConfig.set*(address(token))`
4. **Grant access** — namespace access, table access, and ERC system access granted to World, specific systems, and puppet addresses
5. **Register hooks** — `NoTransferHook` registered via `registerSystemHook` on Characters and Badges ERC721Systems

### Token Metadata

| Token | Name | Symbol | Base URI |
|-------|------|--------|----------|
| Gold | `"Gold"` | `"🜚"` | N/A (ERC20) |
| Characters | `"UDCharacters"` | `"UDC"` | `"ipfs://"` |
| Items | N/A (ERC1155) | N/A | `"ipfs://"` |
| Badges | `"Ultimate Dominion Badges"` | `"UDB"` | `"ipfs://"` |
| Fragments | `"Fragments of the Fallen"` | `"FRAGMENT"` | `"ipfs://"` |

---

## The callFrom Gotcha

MUD v2's `prohibitDirectCallback` prevents `World.call()` / `World.callFrom()` when `msg.sender == address(this)`. Because UD systems are namespaced (executed via `call`, not `delegatecall`), calling puppet methods like `mint()` or `transferFrom()` triggers a callback into the World, which can hit this restriction.

**Solution**: All systems bypass the puppet interface entirely and write directly to MUD's underlying storage tables using `StoreSwitch` (which auto-detects context and routes to `StoreCore`).

```solidity
// Gold (ERC20): write to Balances and TotalSupply tables
import { _balancesTableId, _totalSupplyTableId } from "@latticexyz/world-modules/.../erc20-puppet/utils.sol";
ERC20Balances.set(_balancesTableId(GOLD_NAMESPACE), recipient, newBalance);
ERC20TotalSupply.set(_totalSupplyTableId(GOLD_NAMESPACE), newSupply);

// Items (ERC1155): write to Owners and TotalSupply tables
import { _ownersTableId, _totalSupplyTableId } from "@erc1155/utils.sol";
Owners.setBalance(_ownersTableId(ITEMS_NAMESPACE), owner, itemId, newBalance);

// Characters (ERC721): write to Owners, Balances, TokenURI tables
import { Owners, Balances, TokenURI } from "@latticexyz/world-modules/.../erc721-puppet/tables/...";
ERC721Owners.set(ownersTableId, tokenId, newOwner);

// Badges & Fragments (ERC721): same pattern, different namespace
Owners.set(_ownersTableId(BADGES_NAMESPACE), badgeId, owner);
Balances.set(_balancesTableId(BADGES_NAMESPACE), owner, newBalance);
```

The one exception is `LevelSystem._mintAdventurerBadge()` and `_mintZoneConquerorBadge()`, which call `IERC721Mintable(badgeToken).mint()` via the puppet interface. This works because those systems have explicit `grantAccess` on the `Badges:ERC721System` resource.

---

## Token Details

### Gold (ERC20)

**Config field**: `UltimateDominionConfig.goldToken`
**Model**: Mint-on-demand. No pre-minted supply. Gold is created when earned and burned when spent.

**Mint/burn operations** (all via direct table writes in `LootManagerSystem`):
- `_mintGoldDirect(address, amount)` — updates `Balances` + `TotalSupply`
- `_burnGoldDirect(address, amount)` — decrements `Balances` + `TotalSupply`

**Systems that write Gold tables**:
| System | Operation |
|--------|-----------|
| LootManagerSystem | Mint (combat/quest rewards), burn (escrow deposits) |
| GasStationSystem | Burn (gold-for-gas swaps), charge (relayer gas charges) |
| ShopSystem | Transfer between player and shop (balance manipulation) |
| MarketplaceSystem | Transfer between buyer and seller |
| CharacterEnterSystem | Escrow withdrawal on world entry |

**Access**: World + LootManagerSystem + GasStationSystem + CharacterCore all granted access to `Gold:Balances` and `Gold:TotalSupply` tables.

---

### Characters (ERC721)

**Config field**: `UltimateDominionConfig.characterToken`
**Soulbound**: Yes (`NoTransferHook` blocks `transferFrom`)

**Minting** (`CharacterCore.mintCharacter()`):
- Counter at `Counters[CHARACTER_TOKEN_COUNTER_KEY]` (stable `address(2)` key, survives system upgrades)
- Token ID = counter value (sequential, starting at 1)
- Character ID = `(uint256(ownerAddress) << 96) | tokenId` (encodes owner + token in one `bytes32`)
- Writes directly to `Characters:Owners`, `Characters:Balances`, `Characters:TokenURI` tables

**Namespace ownership**: Transferred to `CharacterCore` contract address. This means system upgrades require re-granting.

---

### Items (ERC1155)

**Config field**: `UltimateDominionConfig.items`
**Module**: Custom fork at `lib/ERC1155-puppet` (`@erc1155/`), not the standard MUD ERC1155 module.

**Token IDs**: Sequential item IDs assigned during zone content loading. Item definitions stored in the `Items` table.

**Key tables**:
- `Items:Owners` — maps `(address, itemId) -> balance`
- `Items:TotalSupply` — maps `itemId -> totalSupply`

**Systems that write Items tables**:
| System | Operation |
|--------|-----------|
| LootManagerSystem | Mint (drops), burn (consumables), transfer (advanced class items) |
| ItemCreationSystem | Mint (admin item creation) |
| ShopSystem | Transfer between player and shop |
| MarketplaceSystem | Transfer between players |
| CharacterCore | Read balances for character validation |

---

### Badges (ERC721 used as ERC1155-like)

**Config field**: `UltimateDominionConfig.badgeToken`
**Soulbound**: Yes (`NoTransferHook` blocks `transferFrom`)

Despite using the ERC721 puppet, badges behave like ERC1155 through a composite token ID scheme that encodes both badge type and character.

**Token ID scheme**: `BADGE_TYPE_CONSTANT * 1_000_000 + characterTokenId`

| Badge | Constant | Example Token ID (char #42) |
|-------|----------|---------------------------|
| Adventurer (level 3) | `BADGE_ADVENTURER = 1` | `1_000_042` |
| Founder (time-limited) | `BADGE_FOUNDER = 50` | `50_000_042` |
| Zone Conqueror | `BADGE_ZONE_CONQUEROR_BASE = 100` + zoneId | `101_000_042` (Dark Cave) |
| Zone Fragment (8/8 complete) | `BADGE_ZONE_FRAGMENT_BASE = 200` + zoneId | `201_000_042` (Dark Cave) |

**Systems that write Badge tables**:
| System | Method | Writes Via |
|--------|--------|-----------|
| LevelSystem | `_mintAdventurerBadge`, `_tryMintFounderBadge`, `_mintZoneConquerorBadge` | Puppet `mint()` call |
| FragmentSystem | `_checkZoneFragmentBadge` | Direct table writes (`Owners.set`, `Balances.set`) |
| AdminSystem | Admin badge minting | Puppet or direct |

**Founder badge**: Only minted if `block.timestamp < UltimateDominionConfig.founderWindowEnd()` (set to deploy time + 7 days).

---

### Fragments (ERC721)

**Config field**: `UltimateDominionConfig.fragmentToken`
**Name**: "Fragments of the Fallen"
**Transferable**: Yes (no NoTransferHook)

Lore NFTs triggered by in-game actions (combat kills, tile discovery). 8 fragment types per zone.

**Token ID scheme**: `fragmentType * 1_000_000 + characterTokenId`

Example: Fragment type 3, character #42 = token ID `3_000_042`.

**Minting** (`FragmentSystem.claimFragment()`):
- Validates fragment was triggered but not yet claimed
- Writes directly to `Fragments:Owners` and `Fragments:Balances` tables
- Updates `FragmentProgress` table (claimed flag, timestamp, token ID)
- Awards `FRAGMENT_XP_REWARD` (100 XP) on claim
- After claiming all 8, auto-mints zone fragment badge

**Systems that write Fragment tables**:
| System | Operation |
|--------|-----------|
| FragmentSystem | Mint (claim), trigger state tracking |

**Namespace ownership**: Kept with deployer (NOT transferred to system) to survive system upgrades. Access granted to `FragmentSystem` via `grantAccess` on every deploy since system addresses change on upgrade.

---

## Production Addresses

Token puppet addresses are **not hardcoded** — they are stored in the `UltimateDominionConfig` table within each World instance and resolved at runtime:

```
UltimateDominionConfig.getGoldToken()
UltimateDominionConfig.getCharacterToken()
UltimateDominionConfig.getItems()
UltimateDominionConfig.getBadgeToken()
UltimateDominionConfig.getFragmentToken()
```

Production World: `0x705607De7F5dE1e95346Eb8d9Ccc7D69C225C4D7`
Beta World: `0xD2051EB4F5001d46c11F928BD6578Bd5f7e028A3`

Query token addresses by calling `UD__getCharacterToken()`, `UD__getGoldToken()`, or `UD__getItemsContract()` on the World.

---

## Access Grant Checklist (PostDeploy)

When adding a new system that writes to token tables, you must:

1. Add `grantAccess` calls in `PostDeploy.s.sol` for the specific tables the system needs
2. Grant access to the system's **contract address** (not the World), since namespaced systems run via `call`
3. Re-run grants on every deploy — system upgrades create new contract addresses, orphaning old grants
4. Use `WorldResourceIdLib.encode(RESOURCE_TABLE, NAMESPACE, "TableName")` to build table resource IDs

Example:
```solidity
ResourceId tableId = WorldResourceIdLib.encode(RESOURCE_TABLE, ITEMS_NAMESPACE, "Owners");
world.grantAccess(tableId, newSystemAddress);
```

---

*Last updated: March 9, 2026*
