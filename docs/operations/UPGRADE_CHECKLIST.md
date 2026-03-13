# Upgrade Checklist

When making changes to contracts, balance, or client data sync, use this checklist to prevent desync bugs.

---

## Balance / Constants Changes

Any time a constant is changed on-chain (stat points, HP gain, XP thresholds, cooldowns, etc.):

- [ ] **Find every client-side hardcoded copy** of the value. Grep the client for the old value AND the constant name. Common locations:
  - `packages/client/src/components/LevelingPanel.tsx` (stat points per level, HP gain)
  - `packages/client/src/contexts/` (cooldowns, timers)
  - `packages/client/src/lib/mud/createSystemCalls.ts` (gas limits, retry delays)
  - `packages/client/src/utils/constants.ts`
- [ ] **Update the guide** (`packages/guide/src/data/`) — xp-table, progression rules, item stats
- [ ] **Update docs** — `GAME_DESIGN.md`, `COMBAT_SYSTEM.md`, `ECONOMICS.md` as applicable
- [ ] **Verify with tests** — run `pnpm test` in `packages/client` and `packages/contracts`
- [ ] **Check the balance scripts** — `packages/contracts/scripts/balance/constants.json` and `overrides.ts`

## Contract Deploys / Schema Changes

- [ ] **Run indexer table rediscovery** after deploying new tables
- [ ] **Check `applyReceiptToStore.ts`** — if new tables need instant UI updates, verify they're in `mudConfig.tables` (UD-namespace). Non-UD tables rely on delta/WS.
- [ ] **Verify table naming** — `packages/indexer/src/naming.ts` has a `TRUNCATED_NAME_MAP` for names > 16 chars. New long table names need entries.
- [ ] **Test the full action flow** end-to-end: send TX, verify receipt logs decode, verify store updates, verify UI reacts

## Client Data Sync Architecture

The sync pipeline has three layers (in priority order):

1. **Receipt log decoding** (instant, ~0ms) — `applyReceiptToStore` decodes `Store_SetRecord` and `Store_DeleteRecord` from TX receipt logs for UD-namespace tables. Splice events are resolved via `getRecord` RPC (~100-300ms).
2. **Indexer delta** (background, ~0.5-3s) — fetches all changed rows from `/api/delta` for ALL namespaces including non-UD (gold, items ERC modules). Fire-and-forget, not blocking.
3. **WebSocket** (continuous) — live stream of all table changes from the indexer. Idempotent overwrites.

**If you change the sync pipeline:**
- [ ] Never remove local receipt decoding — it's the only path that gives instant feedback
- [ ] Test with indexer artificially delayed (stop Railway, observe behavior)
- [ ] Verify all three paths work independently (receipt alone, delta alone, WS alone)
- [ ] Check that `logToRecord` from `@latticexyz/store/internal` can decode the table schema

## Pre-Deploy Verification

- [ ] **Play-test the full loop**: spawn, move, encounter mob, fight, kill, level up, allocate stats, use shop
- [ ] **Check console** for `[TX][RECEIPT]` and `[TX][DELTA]` logs — receipt should inject instantly, delta should follow
- [ ] **Test with slow network** — throttle to 3G in DevTools, verify the game is still playable
- [ ] **Refresh test** — after each action, refresh the page and verify state matches

---

*Created: March 13, 2026*
