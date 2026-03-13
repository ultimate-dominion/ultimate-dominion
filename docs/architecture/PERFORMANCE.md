# Performance Architecture — How the Game Feels Instant

How Ultimate Dominion achieves webapp-like speed on a fully on-chain game.

---

## Overview

The game runs on Base L2 with ~2-second block times and 200ms Flashblock preconfirmations. Four systems work together to hide blockchain latency:

1. **Local signing** — Privy embedded wallet signs on-device; burner wallets sign from localStorage. No external signing services in the hot path.
2. **Self-hosted Base node** — eliminates third-party RPC latency
3. **Receipt log decoding** — instant store updates from TX receipts (~0ms)
4. **Tuned timing constants** — move debounce, gas limits, and retry logic aligned to Flashblock cadence

The result: players move, fight, and level up with no perceptible delay. No loading spinners, no "confirming transaction" screens, no blockchain UX.

---

## Infrastructure: Self-Hosted Base Node

### Setup
- **Primary RPC**: `https://rpc.ultimatedominion.com/public`
- **WebSocket**: `wss://rpc.ultimatedominion.com/ws-public`
- **Fallback**: Alchemy with Flashblocks (`https://base-mainnet.g.alchemy.com/v2/...`)

### Why Self-Hosted
Third-party RPCs (Alchemy, Infura) add 50-200ms per call. With multiple calls per action (simulate, send, receipt), this compounds. The self-hosted node eliminates this overhead and gives us full control over rate limits.

### Failover Strategy
Configured via viem's `fallback()` transport:
- **Health check**: Relayer pings every 15 seconds
- **Failover trigger**: 2 consecutive failures switches to Alchemy
- **Recovery**: Checks primary every 60s while on fallback
- **Client**: `createViemClientConfig.ts` builds the transport chain

---

## Flashblocks (200ms Preconfirmations)

Base supports Flashblocks — 200ms preconfirmations within a 2-second block. This means:
- TX receipts are available ~200ms after submission (vs 2s without Flashblocks)
- `waitForTransactionReceipt` with `pollingInterval: 150` catches receipts within one poll cycle
- The game can process the receipt and update the store before the player notices any delay

### How We Use Them
- **Client polling**: `pollingInterval: 150` in `waitForTransactionReceipt` (both burner and embedded wallet paths)
- **Indexer sync**: `pollingInterval: 250` in the MUD `syncToPostgres` config
- **Alchemy fallback**: Configured with Flashblocks enabled for 200ms preconfirmations

### Key Insight
Flashblocks make the TX receipt available fast, but the UI only updates fast if we decode the receipt locally. Without receipt log decoding, we'd still wait 0.5-3 seconds for the indexer to process the block and return delta data. Receipt decoding + Flashblocks = ~200ms total latency.

---

## Data Sync Pipeline

See [CLIENT_SYNC.md](CLIENT_SYNC.md) for the full architecture. Summary:

| Layer | Latency | What it covers |
|-------|---------|---------------|
| Receipt log decoding | ~0ms after receipt | 185 UD-namespace tables (position, combat, stats, etc.) |
| Splice resolution (RPC) | ~100-300ms | Partial field updates (SpliceStaticData/SpliceDynamicData) |
| Indexer delta (background) | ~0.5-3s | 36 non-UD tables (gold, items, fragments, badges) |
| WebSocket (continuous) | ~0.5-3s | All tables — idempotent catch-all |

**Critical rule**: Receipt log decoding MUST stay as the primary path. See the postmortem in CLIENT_SYNC.md for what happens when it's removed.

---

## Timing Constants

### Move System
| Constant | Value | Location | Why |
|----------|-------|----------|-----|
| `MOVE_COOLDOWN` (on-chain) | `0` | `constants.sol:79` | No on-chain cooldown — all enforcement is client-side |
| `MIN_MOVE_GAP_MS` | `200` | `createSystemCalls.ts` | Client debounce between consecutive moves |
| `MOVE_GAS_LIMIT` | `8,000,000` | `createSystemCalls.ts` | Covers worst-case `spawnOnTileEnter` on dense tiles |
| `ON_CHAIN_RETRY_DELAY_MS` | `500` | `createSystemCalls.ts` | Delay between on-chain revert retries |
| `MAX_ON_CHAIN_RETRIES` | `2` | `createSystemCalls.ts` | Max retries after on-chain revert |

### Data Sync
| Constant | Value | Location | Why |
|----------|-------|----------|-----|
| `pollingInterval` (receipt) | `150ms` | `setupNetwork.ts`, `MUDContext.tsx` | Catches Flashblock receipts within one cycle |
| `DELTA_POLL_INTERVAL` | `500ms` | `applyReceiptToStore.ts` | Background delta fetch retry interval |
| `DELTA_MAX_ATTEMPTS` | `4` | `applyReceiptToStore.ts` | Max delta retries (~2s total window) |
| `pollingInterval` (indexer) | `250ms` | `startSync.ts` | Indexer chain polling for new blocks |

### Other
| Constant | Value | Location | Why |
|----------|-------|----------|-----|
| Spawn confirmation timeout | `15,000ms` | `MapContext.tsx` | Max wait for spawn TX confirmation |
| Chat poll interval | `5,000ms` | `ChatContext.tsx` | Chat message polling |
| WS heartbeat | `25,000ms` | `wsClient.ts` | WebSocket keep-alive ping |
| Stale tab threshold | `5 min` | `GameStoreProvider.tsx` | Re-hydrate from snapshot if tab was hidden |
| Relayer gas flush | `5 min` | `relayer/config.ts` | Batch gas charge settlements |
| RPC health check | `15s` | `relayer/config.ts` | Detect primary RPC failure |

---

## Problems Solved

### MoveTooFast on Flashblocks
**Problem**: `eth_call` simulation could return `MoveTooFast` because `block.timestamp == SessionTimer` — the L2 state propagated faster than block headers, causing the simulation to see the same timestamp as the previous move.

**Solution**: Skip simulation when `MoveTooFast` is detected (safe because `MOVE_COOLDOWN = 0` on-chain, meaning the error only comes from stale RPC timestamps). Use `MIN_MOVE_GAP_MS = 200` as the primary debounce. Commits: `394664db`, `33da2373`.

### Stale Position on First Move
**Problem**: After page load, the store's position could be stale (from snapshot). First move would simulate against the wrong coordinates and get `InvalidMove`.

**Solution**: On `InvalidMove`, read the on-chain position via `UD__getEntityPosition`, update the store, recompute the target, and retry. Commit: `41a47b58`.

### Move Simulation Latency
**Problem**: Gas estimation added a round-trip to the RPC for every move, adding 100-200ms of unnecessary latency.

**Solution**: Skip gas estimation for moves. Use hardcoded `MOVE_GAS_LIMIT = 8M` which covers worst-case tile spawns. Commit: `fb96170d`.

### Indexer Lag Breaking UI
**Problem**: When `applyReceiptToStore` relied solely on the indexer delta endpoint, any indexer lag (even 1-2 seconds) meant encounters wouldn't show, combat outcomes were invisible, and kills required page refresh.

**Solution**: Hybrid approach — decode receipt logs locally for instant UD-namespace updates, use delta as background supplement for non-UD tables. Commits: `52d879a5` (broke it), `4c091ab3` (fixed it). See [CLIENT_SYNC.md](CLIENT_SYNC.md) for the full postmortem.

### NotSpawned After Idle Timeout
**Problem**: If a character was despawned by idle timeout while the player was away, the store still showed `spawned: true`. Moving would send 3 reverting TXs (wasting gas) before failing.

**Solution**: After a move revert, re-simulate to diagnose. If `NotSpawned`, set `Spawned: false` in the store so the UI shows the spawn button. Commit: `176da887`.

---

## Local Signing — No External Services

A major speed unlock: both wallet paths sign transactions locally. No round-trips to external signing services.

### Privy Embedded Wallet (Google/Email Players)
- Privy creates an MPC wallet on-device during signup
- Signing happens locally via multi-party computation — the private key is never assembled in one place, but signing is still instant from the player's perspective
- No popups, no approval screens for gameplay actions
- TX serialization via promise queue prevents nonce collisions on concurrent actions (e.g., auto-approval + character creation firing simultaneously)
- **Signing latency: <50ms**

### MetaMask + Burner Delegation (Crypto-Native Players)
- Player signs ONE delegation TX with MetaMask (registers a burner wallet as their delegate via `GameDelegationControl`)
- Deposits 0.0005 ETH to the burner (enough for hundreds of Base TXs)
- From then on, all gameplay TXs are signed by the burner wallet — private key in localStorage, viem signs locally
- No MetaMask popups during gameplay
- `callFrom` extension wraps each call with the delegator address; the World contract verifies delegation on-chain
- **Signing latency: <10ms** (raw private key, no MPC)

### What This Replaces
Previous architectures routed signing through external services (remote key management, hosted signers). Each sign operation added 200-500ms of network latency. With local signing, this step is effectively free.

### Security Boundaries
- **Privy**: MPC wallet — no single-point key exposure. Recoverable via OAuth provider.
- **Burner**: `GameDelegationControl` whitelists only gameplay systems. A compromised burner can fight and move but cannot drain gold, transfer items, or call admin functions. Player can revoke delegation at any time from wallet settings.

---

## The Speed Stack — Deep Dive

Every step from button tap to UI update, with real latency numbers.

### Step-by-step: Player Taps "Move Right"

```
Step 1: Client-side validation                         ~0ms
  ├─ MIN_MOVE_GAP_MS check (200ms since last move?)
  ├─ Check store for active encounter (prevent doomed TX)
  ├─ Read position from Zustand store
  └─ Compute target coordinates

Step 2: Transaction signing                            <50ms
  ├─ Privy: MPC signs on-device (no network call)
  └─ Burner: viem signs with localStorage private key

Step 3: Broadcast to Base node                         ~10-30ms
  ├─ Self-hosted RPC at rpc.ultimatedominion.com
  ├─ No third-party rate limits or queuing
  └─ Fallback to Alchemy if primary is down

Step 4: Propagation + inclusion                        ~200-400ms ← longest step
  ├─ TX enters Base sequencer mempool
  ├─ Sequencer includes TX in next Flashblock (~200ms)
  ├─ Block propagates to our Base node
  └─ Receipt becomes available

Step 5: Receipt polling                                ~0-150ms
  ├─ waitForTransactionReceipt polls at 150ms intervals
  └─ Catches the Flashblock receipt within 1 poll cycle

Step 6: Receipt log decoding                           ~0ms (synchronous)
  ├─ applyReceiptToStore parses Store_SetRecord events
  ├─ logToRecord decodes encoded data using table schemas
  ├─ Zustand store.setRow() for each changed table
  └─ Position, CombatEncounter, Stats, etc. all updated

Step 7: React re-render                                ~5-15ms
  ├─ Zustand selector detects new reference
  ├─ useGameTable('CombatEncounter') triggers re-render
  ├─ BattleContext computes currentBattle
  └─ UI shows new position / battle screen / outcome

Step 8: Splice resolution (if needed)                  ~100-300ms (async, parallel)
  ├─ SpliceStaticData/SpliceDynamicData events
  ├─ getRecord RPC reads full row from chain
  └─ Store updated with complete row data

  TOTAL (steps 1-7): ~250-600ms
  Player perceives: instant
```

### Background (non-blocking, after UI updates)

```
Step 9: Indexer delta fetch                            ~500-2000ms
  ├─ GET /api/delta?block=N (fire-and-forget)
  ├─ Catches non-UD namespace tables:
  │   gold (ERC20), items (ERC1155), characters (ERC721)
  └─ Idempotent — UD tables already in store from step 6

Step 10: WebSocket delivery                            ~500-3000ms
  ├─ Indexer processes block, broadcasts via WS
  ├─ All tables delivered as idempotent overwrites
  └─ Catch-all for anything missed by steps 6 + 9
```

### Where the Time Goes

| Step | Latency | % of Total | Can We Optimize? |
|------|---------|-----------|-----------------|
| Signing | <50ms | ~10% | Already local — near zero |
| Broadcast | ~20ms | ~5% | Self-hosted node — near zero |
| **Propagation + inclusion** | **~200-400ms** | **~70%** | **Limited by Base sequencer** |
| Receipt polling | ~75ms avg | ~15% | Could use WS subscriptions |
| Log decoding | ~0ms | ~0% | Already synchronous |
| React render | ~10ms | ~0% | Already fast |

**Propagation is the bottleneck** — and it's the one step we can't control. It's the time between broadcasting the TX and the Base sequencer including it in a Flashblock, then that block propagating back to our node. At ~200-400ms, it's already fast enough that players don't perceive it as a delay.

### Comparison: What Happens Without This Stack

If we relied on external signing + third-party RPC + indexer delta:

```
Step 1: Validation                                     ~0ms
Step 2: Remote signing service                         ~200-500ms
Step 3: Broadcast via Alchemy                          ~50-200ms
Step 4: Propagation + inclusion                        ~200-400ms
Step 5: Receipt polling (slower RPC)                   ~150-500ms
Step 6: Poll indexer delta (6x @ 500ms)                ~500-3000ms
Step 7: React render                                   ~10ms
  TOTAL: ~1.1-4.6 seconds
  Player perceives: laggy, "blockchain game"
```

The difference is **4-10x slower** and unreliable (delta can fail entirely).

---

*Last updated: March 13, 2026*
