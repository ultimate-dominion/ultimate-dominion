# Access Control Model

Developer reference for the MUD access control model in Ultimate Dominion.

---

## Namespace Model

All game systems are registered under the `UD` namespace (`bytes14 "UD"`). Token contracts live in separate namespaces, each with their own access control boundaries:

| Namespace | Constant | Type | Purpose |
|-----------|----------|------|---------|
| `UD` | `WORLD_NAMESPACE` | Game systems | All gameplay logic |
| `Gold` | `GOLD_NAMESPACE` | ERC20 puppet | In-game currency |
| `Characters` | `CHARACTERS_NAMESPACE` | ERC721 puppet | Player character NFTs |
| `Items` | `ITEMS_NAMESPACE` | ERC1155 puppet | Equipment, consumables |
| `Badges` | `BADGES_NAMESPACE` | ERC1155 puppet | Achievement badges (soulbound) |
| `Fragments` | `FRAGMENTS_NAMESPACE` | ERC721 puppet | Collectible lore NFTs |

Constants are defined in `packages/contracts/constants.sol`.

### Why Namespaces Matter

Systems in the same namespace share table write access automatically. Systems in different namespaces do NOT --- they need explicit `grantAccess` calls. Since all game systems are in `UD` but token tables are in `Gold`, `Items`, etc., every system that touches tokens needs cross-namespace grants.

Because UD systems are non-root (namespaced), they execute via `call` (not `delegatecall`). This means:
- `address(this)` = the system's own contract address, not the World
- Table writes go through `StoreSwitch` which routes to `IStore(world).setRecord(...)` externally
- The World checks `AccessControl.requireAccess(tableId, msg.sender)` where `msg.sender` = system contract address

---

## Admin Table Pattern

### How It Works

The `Admin` table is a simple `address -> bool` mapping defined in `mud.config.ts`. Admin checks use:

```solidity
if (!Admin.get(_msgSender())) revert NotAdmin();
```

The `NotAdmin` error is defined in `packages/contracts/src/Errors.sol`.

### Who Gets Admin

Set in `PostDeploy.s.sol` `_seedGameData()`:

| Address | How | Why |
|---------|-----|-----|
| Deployer EOA | `Admin.set(deployer, true)` | Primary admin |
| AdminSystem contract | `Admin.set(adminSystemAddress, true)` | Passes `_requireAccessOrAdmin` checks |
| ItemsSystem contract | `Admin.set(itemsSystemAddress, true)` | Item management from other systems |
| ItemCreationSystem contract | `Admin.set(itemCreationSystemAddress, true)` | Post-deploy item creation |
| MobSystem contract | `Admin.set(mobSystemAddress, true)` | Post-deploy mob creation |

Admin can be granted/revoked at runtime via `AdminSystem.setAdmin(address, bool)` (admin-only).

### Helper Functions (utils.sol)

| Function | Logic |
|----------|-------|
| `_requireAccessOrAdmin(addr, sender)` | Allow if `Admin.get(sender)` is true, else check MUD namespace access |
| `_requireSystemOrAdmin(sender)` | Allow if sender is a registered MUD system (via `SystemRegistry`) OR admin. Reverts with `NotAuthorizedCaller()` |

---

## System Categories

### Admin-Only Systems

These systems check `Admin.get(_msgSender())` on every entry point and revert with `NotAdmin` if the caller is not an admin. They are NOT whitelisted for game delegation.

| System | File |
|--------|------|
| AdminSystem | `AdminSystem.sol` |
| AdminShopSystem | `AdminShopSystem.sol` |
| AdminContentSystem | `AdminContentSystem.sol` |
| AdminTuningSystem | `AdminTuningSystem.sol` |
| AdminEntitySystem | `AdminEntitySystem.sol` |
| PauseSystem | `PauseSystem.sol` |
| ItemCreationSystem (ItemCreationSys) | `ItemCreationSystem.sol` |
| FragmentSystem (admin functions only) | `FragmentSystem.sol` --- `adminSetFragmentMetadata` checks `Admin.getIsAdmin()` |

### Internal-Only Systems (System-to-System)

These systems use `_requireSystemOrAdmin(_msgSender())` to restrict access to registered MUD systems (inter-system calls) or admins. Players cannot call them directly.

| System | File |
|--------|------|
| CombatSystem | `CombatSystem.sol` --- `resolveAttack()` |
| LootManagerSystem | `LootManagerSystem.sol` --- all public functions |
| PvpRewardSystem | `PvpRewardSystem.sol` --- `distributePvpRewards()` |
| PveRewardSystem | `PveRewardSystem.sol` --- `distributePveRewards()` |

### Player-Facing Systems

All other systems are callable by any user. These are whitelisted in `AllowedGameSystems` for game delegation (see PostDeploy `_configureGameDelegation`).

---

## PauseLib Integration

`PauseLib.requireNotPaused()` reads the `Paused` singleton table and reverts with `GamePaused()` if true. It is checked at the entry point of every player-facing system.

### Systems That Check requireNotPaused

| System | Functions |
|--------|-----------|
| CharacterCore | `createCharacter` |
| CharacterEnterSystem | `enterGame` |
| StatSystem | `allocateStats`, `rerollStats` |
| LevelSystem | `levelUp` |
| ImplicitClassSystem | `selectRace`, `selectPowerSource`, `selectArmorType`, `selectAdvancedClass` |
| MapSystem | `move`, `spawn` |
| MapRemovalSystem | `despawn` |
| WorldActionSystem | `enterBoard`, `explore`, `exitToRest` |
| EncounterSystem | `startEncounter`, `endEncounter` |
| EquipmentSystem | `equip`, `unequip` |
| ShopSystem | `buy`, `sell`, `buyItems`, `sellItems`, `restock` |
| MarketplaceSystem | `createOrder`, `fillOrder`, `cancelOrder` |
| GasStationSystem | `buyGas` |
| FragmentSystem | `triggerFragment`, `claimFragment` |
| PvPSystem | `fleePvp` |
| LootManagerSystem | `openChest`, `claimLoot` |

### Systems That Do NOT Check Pause

- All admin systems (AdminSystem, PauseSystem, etc.) --- admins must operate during pause
- Internal-only systems (CombatSystem, PvpRewardSystem, PveRewardSystem) --- called by other systems that already checked pause
- RngSystem --- root system, pure utility

---

## Cross-Namespace Access Grants

When a UD system writes to a table in another namespace (Gold, Items, etc.), it needs explicit access. After every `mud deploy`, system contract addresses change, so grants must be re-applied.

### EnsureAccess.s.sol

`script/EnsureAccess.s.sol` is the authoritative grant script. It deploys a temporary **root system** that runs via `delegatecall` in the World's context, bypassing all access checks. It is idempotent and auto-chained into `deploy:testnet` and `deploy:mainnet`.

### Grant Map

#### Gold Namespace

| System | Tables | Reason |
|--------|--------|--------|
| CharEnterSys | `Gold:Balances` | Starter gold on `enterGame` |
| LootManagerSystem | `Gold:Balances`, `Gold:TotalSupply` | Gold rewards from combat |
| PveRewardSystem | `Gold:Balances`, `Gold:TotalSupply` | PvE combat gold |
| ShopSystem | `Gold:Balances`, `Gold:TotalSupply` | Buy/sell transactions |
| GasStationSystem | `Gold:Balances`, `Gold:TotalSupply` | Gold-to-ETH swaps |
| MarketplaceSystem | `Gold` namespace, `Gold:Balances` | Player-to-player gold transfers |
| World address | `Gold` namespace, `Gold:Balances`, `Gold:ERC20System` | Delegatecall context |

#### Items Namespace

| System | Tables | Reason |
|--------|--------|--------|
| CharEnterSys | `Items:Owners` | Starter items on `enterGame` |
| LootManagerSystem | `Items:Owners`, `Items:TotalSupply` | Loot drops from combat |
| ItemsSystem | `Items` namespace, `Items:ERC1155System` | Item data management |
| ItemCreationSystem | `Items` namespace | Post-deploy item creation |
| AdminSystem | `Items` namespace | Admin item operations |
| ShopSystem | `Items:Owners` | Selling items back to shops |
| MarketplaceSystem | `Items` namespace, `Items:ERC1155System`, `Items:Owners` | Item trading |
| World address | `Items` namespace, `Items:Owners`, `Items:ERC1155System` | Delegatecall context |

#### Characters Namespace

| System | Tables | Reason |
|--------|--------|--------|
| CharacterCore | `Characters:ERC721System`, `Characters` namespace (owner) | Character minting, CRUD |
| World address | `Characters:ERC721System`, `Characters` namespace | Delegatecall context |

CharacterCore receives **namespace ownership** (not just access) because it needs to write Characters, CharacterOwner, NameExists, Counters, and ERC721 tables.

#### Badges Namespace

| System | Tables | Reason |
|--------|--------|--------|
| LevelSystem | `Badges:ERC721System`, `Badges:Owners`, `Badges:Balances` | Badge minting at level milestones |
| AdminSystem | `Badges:ERC721System`, `Badges:Owners`, `Badges:Balances` | Admin badge grants |
| StatSystem | `Badges:ERC721System`, `Badges:Owners`, `Badges:Balances` | Adventurer badge at level 3 |
| World address | `Badges` namespace, `Badges:ERC721System` | Delegatecall context |

#### Fragments Namespace

| System | Tables | Reason |
|--------|--------|--------|
| FragmentSystem | `Fragments:ERC721System`, `Fragments:Owners`, `Fragments:Balances` | Fragment minting on claim |
| World address | `Fragments` namespace, `Fragments:ERC721System` | Delegatecall context |

---

## World_AccessDenied Error

**Selector**: `0xd787b737`

```solidity
error World_AccessDenied(bytes14 namespace, address caller);
```

### What Causes It

The World contract reverts with `World_AccessDenied` when a system tries to write to a table in a namespace it does not have access to. The most common scenario:

1. `mud deploy` upgrades a system to a **new contract address**
2. The old address had `grantAccess` --- the new address does not
3. The system tries to write to a cross-namespace table (e.g., `Gold:Balances`)
4. The World checks `ResourceAccess.get(tableId, systemAddress)` --- returns `false`
5. Reverts with `World_AccessDenied`

### How to Diagnose

1. Decode the revert data: the error includes the namespace and the caller address
2. Look up the system at that address: `cast call <world> "getSystem(bytes32)(address)" <resourceId>`
3. Check if the system has access: `cast call <world> "getResourceAccess(bytes32,address)(bool)" <tableId> <systemAddress>`

### How to Fix

Run the EnsureAccess script:

```bash
source .env.testnet && forge script script/EnsureAccess.s.sol \
  --sig "run(address)" $WORLD_ADDRESS \
  --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY
```

This is auto-chained into `deploy:testnet` and `deploy:mainnet`, but can also be run standalone after a failed deploy or manual system registration.

---

## Adding a New System Safely

### Checklist

1. **Write the system contract** in `packages/contracts/src/systems/`.

2. **Add to `mud.config.ts`** under `systems` with the correct name (max 16 chars for the resource name).

3. **Add access control checks**:
   - Player-facing: add `PauseLib.requireNotPaused()` at every entry point
   - Admin-only: add `if (!Admin.get(_msgSender())) revert NotAdmin();`
   - Internal-only: add `_requireSystemOrAdmin(_msgSender());`

4. **Identify cross-namespace tables** the system writes to. For each table:
   - Add a `ResourceAccess.set(tableId, systemAddress, true)` line in `EnsureAccess.s.sol` `ensureAll()`
   - Add a corresponding `grantAccess` in `PostDeploy.s.sol` (for fresh deploys)

5. **Add to Admin table** if the system needs to pass `_requireAccessOrAdmin` or `_requireSystemOrAdmin` checks from other systems: `Admin.set(systemAddress, true)` in PostDeploy.

6. **Add to game delegation whitelist** if player-facing: add an `AllowedGameSystems.setAllowed(...)` line in PostDeploy `_configureGameDelegation()`.

7. **Deploy**:
   ```bash
   pnpm deploy:testnet   # runs mud deploy + EnsureAccess automatically
   ```

8. **Verify selectors** after deploy. MUD can silently skip registrations on nonce errors:
   ```bash
   cast call $WORLD_ADDRESS "UD__yourFunction(args)" --rpc-url $RPC_URL
   ```

9. **Verify access grants**:
   ```bash
   # Check that the system can write to the cross-namespace table
   cast call $WORLD_ADDRESS \
     "getResourceAccess(bytes32,address)(bool)" \
     <tableResourceId> <systemAddress> \
     --rpc-url $RPC_URL
   ```

### Common Pitfalls

- **Forgetting EnsureAccess.s.sol**: If you add grants only in PostDeploy, they are lost on the next `mud deploy` if PostDeploy reverts for any reason. Always add grants to both PostDeploy (fresh deploy) and EnsureAccess (re-runnable fix).
- **Namespace ownership transfer**: NEVER transfer namespace ownership to a system contract. System addresses change on every upgrade, orphaning the ownership. Keep the deployer as owner, grant access via `grantAccess`.
- **16-char name limit**: MUD resource names are `bytes16`. System names longer than 16 chars are truncated. E.g., `LootManagerSystem` becomes `LootManagerSyste` in the resource ID.
- **PostDeploy is atomic**: If ANY line in PostDeploy reverts, ALL grants in that function are lost. EnsureAccess.s.sol exists as a safety net for exactly this reason.

---

*Last updated: March 9, 2026*
