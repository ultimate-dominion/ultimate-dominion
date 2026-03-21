# Smoke Test Framework

On-chain integration tests that run against a live deployed World (beta or production). Uses vitest + viem to send real transactions and verify game systems work end-to-end.

## Prerequisites

1. **`.env.testnet`** in `packages/contracts/` with:
   ```
   RPC_URL=https://...        # Base RPC (Alchemy recommended)
   PRIVATE_KEY=0x...          # Deployer private key (needs admin access + ETH for gas)
   WORLD_ADDRESS=0x...        # Target World contract address
   ```

2. **Deployer wallet balance**: Varies by suite.
   - `smoke` / `pvp`: ~0.05 ETH (funds 2 test wallets + admin txs)
   - `scale`: ~0.1 ETH (funds 1 wallet with 0.05 ETH + hundreds of admin txs)
   - `balance`: ~0.5 ETH (funds 9 wallets at 0.05 ETH each + admin txs)

3. **Admin access**: The deployer private key must have namespace owner or admin access on the World. Admin functions (`adminSetStats`, `adminDropGold`, `adminClearEncounterState`, `adminMoveEntity`, `adminDropItem`) are used extensively for test setup and recovery.

## Running

```bash
cd packages/contracts

# Core smoke test — character creation, combat, shop, marketplace, spells, death
pnpm test:smoke

# Scale test — 100 + 200 combat stress test with drop rate analysis
pnpm test:smoke:scale

# PvP test — 2-player encounter creation and resolution
pnpm test:smoke:pvp

# Balance test — 9 characters (3 races x 3 power sources) farming in parallel + PvP
pnpm test:smoke:balance

# All suites sequentially
pnpm test:smoke:all
```

## Architecture

```
smoke-test/
├── setup.ts          # Clients, ABI, enums, sendTx, wallet generation, utilities
├── helpers.ts        # Character creation, navigation, farming, admin shortcuts
├── assertions.ts     # On-chain state assertions (position, level, HP, gold, items)
├── discovery.ts      # Scans chain for starter items, shop entity, token addresses
├── smoke.test.ts     # 10-phase sequential test covering all core systems
├── scale.test.ts     # 100-combat and 200-combat stress tests
├── pvp.test.ts       # 2-player PvP encounter test
└── balance.test.ts   # 9-character concurrent balance analysis
```

### setup.ts — Foundation

- **Environment**: Reads `RPC_URL`, `PRIVATE_KEY`, `WORLD_ADDRESS` from env vars.
- **Clients**: `publicClient` (reads), `deployerWallet` (admin txs).
- **worldAbi**: 49 functions covering all game systems. Verified against deployed Solidity interfaces — all struct encodings (StatsData, Order, Action) match.
- **Enums**: Race, PowerSource, ArmorType, Classes, AdvancedClass, ItemType, EncounterType, OrderStatus, TokenType — all match `common.sol`.
- **sendTx(wallet, functionName, args, value?)**: Sends a transaction with manual nonce tracking. Retries up to 3 times on nonce-related errors with automatic nonce refresh. Waits for receipt and throws on revert.
- **simulateAndSend\<T\>(wallet, functionName, args, value?)**: Simulates the call first to capture the return value, then sends. Use this when you need the contract's return value (e.g., `createOrder` returns `orderHash`, `createEncounter` returns `encounterId`). Returns `{ txHash, result }`.
- **createTestWallet(seed, fundAmount?)**: Derives a deterministic wallet from `keccak256("smoke_test_" + seed)`. Funds from deployer if balance is below 25% of `fundAmount` (default 0.01 ETH). Deterministic seeds mean the same wallet is reused across runs — this is intentional for test resumption.
- **AsyncQueue / deployerQueue**: Serializes async calls through a single execution chain. Used by the balance test to prevent deployer nonce collisions when 9 characters run in parallel and all need admin operations.

### helpers.ts — Game Actions

- **createCharacter(wallet, config)**: Full 7-step creation flow: mint → chooseRace → choosePowerSource → chooseStartingArmor → rollBaseStats → enterGame → spawn. Returns `{ characterId, name, stats }`.
- **getOrCreateCharacter(wallet, config)**: Idempotent wrapper. Checks if the wallet already owns a character (via `getCharacterIdFromOwnerAddress`). If so, reads and returns it. If not, calls `createCharacter`. This is what makes tests safe to re-run — the contract enforces one character per address (`MaxCharacters()` revert), so calling `createCharacter` twice for the same wallet would fail.
- **navigateTo(wallet, charId, targetX, targetY)**: Walks a Manhattan path using `autoAdventure`. Handles `InEncounter` (admin clears state) and `AutoAdventureCooldownActive` (waits 2s and retries). Respects the 5.5s cooldown between adventures.
- **farmToLevel(wallet, charId, targetLevel)**: Zigzags between adjacent tiles calling `autoAdventure` until the target level is reached. Handles death (respawn), low HP (rest at 0,0), encounter locks, and cooldown errors.
- **Admin shortcuts**: `adminBoostToLevel`, `adminHeal`, `adminDropGold`, `adminDropItem` — use the deployer wallet to manipulate character state for test setup.
- **getGoldBalance(playerAddress, goldTokenAddress)**: Reads ERC20 balance from the Gold puppet token.

### discovery.ts — Chain Scanning

Runs once per suite in `beforeAll`. Scans the deployed world to find:
- **Starter items**: Iterates item IDs 1..200, calls `isStarterItem` + `getItemType` to find starter weapons and armors.
- **Shop entity**: Checks position (9,9) for an entity where `isShop` returns true.
- **Token addresses**: `getGoldToken()` and `getItemsContract()` — needed for ERC20/ERC1155 operations.

### assertions.ts — Verification

Vitest `expect()` wrappers for on-chain state:
- `assertCharacterValid`, `assertPosition`, `assertLevel`, `assertLevelAtLeast`
- `assertStatsNonZero`, `assertHpInRange`
- `assertGoldAtLeast`, `assertGoldEquals`
- `assertItemBalance`, `assertEquipped`
- `assertXpIncreased`, `assertAdvancedClass`
- `getStats`, `getGold` — read helpers for inline comparisons.

## Test Suites

### smoke.test.ts — Core Systems (10 phases)

Sequential test covering the full player lifecycle. Each phase builds on the previous.

| Phase | What it tests | Key assertions |
|-------|--------------|----------------|
| 1. Character Creation | `getOrCreateCharacter` (idempotent) | Character valid, stats non-zero |
| 2. Movement & Combat | `autoAdventure` movement + combat trigger | Position updated, XP/HP changes |
| 3. Leveling | Admin boost to level 2 | Level >= 2, stats increased |
| 4. Equipment | Equip/unequip starter weapon | `isEquipped` toggled correctly |
| 5. Shop | Buy/sell at (9,9) shop | Gold decreased on buy, increased on sell |
| 6. Marketplace | Create order + fulfill from player 2 | Order status transitions Active → Fulfilled |
| 7. Advanced Class | Boost to L10, select Warrior | `advancedClass` set, `hasSelectedAdvancedClass` true |
| 8. Spells | `hasSpellConfig` for battle_cry | True for real spell, false for fake |
| 9. Death & Recovery | Set HP to 1, combat, rest at (0,0) | HP restored after rest |
| 10. Cleanup | Clear encounter state, print summary | No revert |

**Timeout**: ~5 minutes. **Wallets**: 2 (player1 + player2).

### scale.test.ts — Combat Volume

Two tests that hammer the combat system:

1. **100 combats at level 5** (15 min timeout): Runs `autoAdventure` in a loop, tracking wins/losses/deaths/XP. Reports win rate and average XP per fight. Asserts win rate > 30% (at level 5 with starter gear).

2. **200 combats — drop rate analysis** (30 min timeout): Same loop but also snapshots item balances before/after to count drops. Reports unique items dropped and per-item breakdown. Asserts at least 1 item drop in 200 combats.

**Wallet funding**: 0.05 ETH (enough for ~150 transactions on Base).

### pvp.test.ts — Player vs Player

Creates 2 characters (Human/Physical vs Dwarf/Physical), boosts to level 5, moves both to (6,6), creates a PvP encounter. Uses `simulateAndSend` to get the actual `encounterId`. Checks HP changes and whether either player died.

### balance.test.ts — 9-Character Concurrent Analysis

The main balance testing tool. Runs 9 characters with different builds simultaneously.

**Build matrix**:

| # | Race | Power Source | Armor |
|---|------|-------------|-------|
| 0 | Human | Divine | Cloth |
| 1 | Human | Weave | Cloth |
| 2 | Human | Physical | Plate |
| 3 | Elf | Divine | Cloth |
| 4 | Elf | Weave | Cloth |
| 5 | Elf | Physical | Leather |
| 6 | Dwarf | Divine | Cloth |
| 7 | Dwarf | Weave | Cloth |
| 8 | Dwarf | Physical | Plate |

**Test 1: Parallel Farming** (15 min timeout)
- All 9 characters farm 50 combats concurrently via `Promise.all`
- Starts staggered by 500ms to avoid block congestion
- Each character runs its own independent adventure loop with its own wallet/nonce
- Admin calls (heal, encounter clear) are serialized through `deployerQueue` to prevent deployer nonce collisions
- Per-character error isolation: one failing character doesn't crash the suite
- Reports per-build win%, aggregated by race, aggregated by power source
- Flags builds with < 20% or > 85% win rate as balance warnings

**Test 2: PvP Round-Robin** (10 min timeout)
- 9 representative matchups:
  - 6 intra-race (each adjacent pair within the same race)
  - 3 cross-race (same power source, different race)
- Each matchup: move to (6,6), heal, create encounter, read HP changes, determine winner
- Reports matchup results and per-build PvP win tally

**Test 3: Final Summary**
- Reads level, HP, and gold balance for all 9 characters.

## Design Decisions

### Deterministic wallets
Test wallets are derived from fixed seeds (`balance_0`, `smoke_player1`, etc.). This means the same wallet address is generated on every run. Combined with `getOrCreateCharacter`, this makes tests resumable — a second run reuses existing characters instead of failing on `MaxCharacters()`.

### Nonce management
`sendTx` tracks nonces per wallet in a `Map<Address, WalletState>`. Each wallet's nonce is initialized from the chain on first use, then incremented locally after each successful send. On nonce errors, it re-fetches from chain and retries.

For the balance test, the deployer wallet is shared across 9 parallel character loops (for admin operations). The `deployerQueue` serializes these calls to prevent nonce races.

### Cooldown handling
The game has two cooldowns:
- `MOVE_COOLDOWN = 0` (in constants.sol — disabled, enforced client-side)
- `AUTO_ADVENTURE_COOLDOWN = 5` seconds (in AutoAdventureSystem.sol)

Tests sleep 5.5s between adventures. If timing jitter causes a cooldown violation, the `AutoAdventureCooldownActive` error is caught and retried after 2s.

### Error recovery
- **InEncounter**: Admin clears the character's encounter state so the test can continue. This may orphan the opponent's encounter state in PvP — acceptable in test context.
- **AutoAdventureCooldownActive**: Wait 2s and retry.
- **Transaction revert**: Bubbles up as test failure (except in marketplace/PvP tests where try/catch logs and skips).

### simulateAndSend
Some contract functions return values that are needed by subsequent calls (e.g., `createOrder` returns `orderHash`). Since `sendTx` returns the transaction hash, not the return value, `simulateAndSend` first runs a read-only simulation to capture the return value, then sends the actual transaction. The simulation and send use the same parameters, so the return value is reliable as long as no state changes between the two calls (safe in test context where we control the only active wallets).

## Extending

To add a new test:
1. Create `your-test.test.ts` in this directory
2. Import from `setup.ts` (clients, ABI, enums), `helpers.ts` (character actions), `assertions.ts` (verifications), `discovery.ts` (chain state)
3. Use `getOrCreateCharacter` for idempotent character setup
4. Use `simulateAndSend` when you need contract return values
5. Add a `pnpm test:smoke:yourtest` script to package.json

To add a new World function:
1. Add the ABI string to `worldAbi` in `setup.ts`
2. Verify the signature matches the Solidity interface in `src/codegen/world/`
