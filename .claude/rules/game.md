---
paths:
  - packages/contracts/src/systems/**
  - packages/contracts/zones/**
  - packages/contracts/test/**
  - "**/items.json"
  - "**/effects.json"
  - "**/monsters.json"
  - "**/balance*"
  - "**/combat*"
  - "**/sim*"
---

# Game Systems Rules

@./docs/combat-stats/BALANCE_GOALS.md
@./docs/combat-stats/BALANCE_STATE.md

## Memory Pointers (read on demand, not all at once)
When working on game systems, check these memory files for relevant context:
- `game/game-balance.md` — Item IDs, combat triangle, monster roster, drop rates, class spells
- `game/launch-values.md` — Production constants (XP, gold, combat)
- `game/economic-design.md` — Hearthstone model, F2P vs marketplace drivers
- `game/design_principles_kaplan.md` — **READ BEFORE BALANCE WORK**
- `game/gotcha_*.md` — Grep when touching a specific system

## ID Lookups
- Basilisk boss: mob ID `12`
- Item IDs: see `items.json` (single source of truth)
- Effect IDs: see `effects.json` (single source of truth)
- Drop rates: ONLY changeable via items.json → item-sync flow

## Balance Changes
- items.json is the SINGLE SOURCE OF TRUTH. Never bypass with cast/scripts.
- Flow: edit JSON → commit → `item-sync dark_cave --update` → verify (0 mismatches) → stop if verify fails.
- After any `mud deploy`: run item-sync + effect-sync to verify, tag the deploy, run drop-sim.
- Don't over-optimize balance. Set floors and ceilings, not parity. The game is infinite at L20.

## Testing
- Tests run against forked beta world, never local anvil.
- Every code change MUST have tests — happy paths, unhappy paths, edge cases.
