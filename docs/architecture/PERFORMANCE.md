# Performance Architecture — How the Game Feels Instant

How Ultimate Dominion achieves webapp-like speed on a fully on-chain game.

---

## Overview

The game runs on Base L2 with ~2-second block times and 200ms Flashblock preconfirmations. Three systems work together to hide blockchain latency:

1. **Self-hosted Base node** — eliminates third-party RPC latency
2. **Receipt log decoding** — instant store updates from TX receipts (~0ms)
3. **Tuned timing constants** — move debounce, gas limits, and retry logic aligned to Flashblock cadence

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

## The Speed Stack (How It All Fits Together)

```
Player taps "move right"
  ↓  MIN_MOVE_GAP_MS check (200ms debounce)
  ↓  Skip gas estimation (hardcoded 8M)
  ↓  TX submitted to self-hosted Base node
  ↓  ~200ms (Flashblock preconfirmation)
  ↓  Receipt available, polled at 150ms intervals
  ↓  applyReceiptToStore decodes receipt logs (~0ms)
  ↓  Zustand store updated → React re-renders
  ↓  Player sees new position + any encounter
  ↓  Total: ~200-400ms (feels instant)
  ↓
  Background: delta fetch for gold/items (~1-2s)
  Background: WebSocket delivers all updates (~1-2s)
```

Without this stack (e.g., relying on indexer delta):
```
Player taps "move right"
  ↓  TX submitted
  ↓  ~200ms receipt
  ↓  Poll indexer delta (500ms × 4 attempts = up to 2s)
  ↓  Maybe get data, maybe fall back to WebSocket
  ↓  Total: 1-5 seconds, sometimes never (requires refresh)
```

---

*Last updated: March 13, 2026*
