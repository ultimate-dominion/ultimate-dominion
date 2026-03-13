# Client Data Sync Architecture

How the game achieves instant UI updates despite being fully on-chain.

---

## Design Principle

**Decode receipt logs locally. Never depend on the indexer for critical UI updates.**

The game feels like a webapp when store updates come from receipt logs (~0ms). It breaks the moment we switch to indexer-dependent approaches. This has been learned the hard way — do not change this pattern without reading the postmortem below.

## Three-Layer Pipeline

After every transaction, `applyReceiptToStore` runs three update paths in priority order:

### 1. Receipt Log Decoding (instant, ~0ms)

Decodes `Store_SetRecord` and `Store_DeleteRecord` events directly from the TX receipt logs using `logToRecord` from `@latticexyz/store/internal`. Covers all UD-namespace tables (~185 tables from `mudConfig.tables`) — this includes every critical game table: Position, Spawned, CombatEncounter, EncounterEntity, CombatOutcome, ActionOutcome, Stats, and more.

Splice events (`Store_SpliceStaticData` / `Store_SpliceDynamicData`) are resolved by reading the full record from the chain via `getRecord` RPC (~100-300ms). These are awaited before the function returns.

**This is what makes moves, encounters, combat, kills, and level-ups feel instant.**

### 2. Indexer Delta (background, ~0.5-3s)

`fetchDeltaBackground()` fires a non-blocking request to `GET /api/delta?block=N` on the indexer. This catches non-UD namespace tables that aren't in `mudConfig.tables`:

- Gold (ERC20 balance tables)
- Items (ERC1155 ownership/balance)
- Characters (ERC721 token metadata)
- Fragments, Badges (ERC1155)

Polls up to 4 times at 500ms intervals. Fire-and-forget — the caller doesn't wait for this.

### 3. WebSocket (continuous)

The `WSClient` maintains a persistent WebSocket connection to the indexer. All table changes are broadcast in real-time as idempotent overwrites. This is the catch-all — if receipt decoding or delta miss something, WS will deliver it.

## File Map

| File | Role |
|------|------|
| `packages/client/src/lib/gameStore/applyReceiptToStore.ts` | Hybrid implementation (receipt + delta + splice) |
| `packages/client/src/lib/gameStore/store.ts` | Zustand store (setRow, deleteRow, applyBatch) |
| `packages/client/src/lib/gameStore/GameStoreProvider.tsx` | Initial snapshot fetch + WS setup |
| `packages/client/src/lib/gameStore/wsClient.ts` | WebSocket client with reconnect + batching |
| `packages/client/src/lib/mud/setupNetwork.ts` | Burner wallet path — calls applyReceiptToStore |
| `packages/client/src/contexts/MUDContext.tsx` | Embedded wallet path — calls applyReceiptToStore |

## Postmortem: The Delta-Only Regression (March 2026)

**What happened:** `applyReceiptToStore` was changed to replace local receipt decoding with indexer delta polling (commit `52d879a5`). The motivation was valid — local decoding only covered UD-namespace tables, silently missing 36 ERC module tables (gold, items). When WebSocket had hiccups, those tables were permanently stale until page refresh.

**What broke:** With delta as the sole update path, ALL store updates (including critical game state) depended on the indexer being within 3 seconds of the chain head. When it wasn't — even briefly — encounters didn't show after moves, combat outcomes were invisible, kills required page refresh. The game felt broken.

**The fix:** Hybrid approach — restore local receipt decoding for UD-namespace tables (instant), add delta as a background supplement for non-UD tables (non-blocking). Both paths coexist. Receipt handles the 185 critical tables instantly; delta handles the 36 non-critical tables with acceptable latency.

**The lesson:** When fixing a gap in the sync pipeline, ADD a new layer — don't replace the existing one. Local receipt decoding and indexer delta are complementary, not alternatives.

## Rules for Future Changes

1. **Never remove local receipt decoding.** It's the only path that gives instant feedback for game-critical actions.
2. **Test with indexer artificially delayed** — stop Railway, verify the game is still playable from receipt logs alone.
3. **All three paths should work independently.** Receipt alone = playable. Delta alone = playable with lag. WS alone = playable with lag. Together = best experience.
4. **When adding new UD-namespace tables**, they're automatically covered by receipt decoding (they're in `mudConfig.tables`).
5. **When adding new non-UD tables**, they'll be covered by delta + WS. No code change needed.

---

*Last updated: March 13, 2026*
