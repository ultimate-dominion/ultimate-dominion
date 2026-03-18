# Progressive Onboarding — "The First Five Minutes"

**Kaplan principle:** "Don't show players a cockpit. Give them a steering wheel, then add instruments one at a time as they learn to drive."

**Core constraint:** All client-side UI gating. No contract changes. No indexer changes. Data is always available — we just choose when to render it.

**Implementation order:** Each phase is self-contained, ships and tests independently.

---

## Architecture: The Onboarding Stage System

A single hook: `useOnboardingStage()`

Returns a stage enum derived from existing game state (no new storage needed):

```
Stage 0 — PRE_SPAWN:     character exists, not spawned (!isSpawned)
Stage 1 — JUST_SPAWNED:  spawned, hasn't claimed first fragment yet
Stage 2 — FIRST_STEPS:   spawned, has claimed first fragment, experience === 0
Stage 3 — FIRST_BLOOD:   level 1, has killed something (experience > 0)
Stage 4 — SETTLING_IN:   level 2
Stage 5 — ESTABLISHED:   level 3-4
Stage 6 — VETERAN:       level 5+
```

All computed from `character.level`, `character.experience`, and `fragments` — all already in context. No localStorage, no new DB queries, no flags to maintain. If a player is level 3, they're always stage 5, period.

Components check the stage and conditionally render. One import, one number comparison.

**File:** `packages/client/src/hooks/useOnboardingStage.ts`

---

## Phase 1: Movement Hint After First Fragment

**What:** After closing the first fragment claim modal, a movement hint appears in the center panel showing WASD/arrow key visuals with atmospheric text.

**Trigger:** Stage 1 (FIRST_STEPS) — spawned, level 1, hasn't killed anything yet. The fragment claim modal is already the first thing they see. After they close it, the center panel shows "No monsters in this area" and the movement hint below it.

**Implementation:**

- **New component:** `MovementHint.tsx` — renders in `TileDetailsPanel` when `stage === FIRST_STEPS` and no monsters are on the tile.
- **Visual:** Four key cap shapes (W/A/S/D) rendered as styled `Box` elements with the game's dark parchment aesthetic. Below them: *"Explore the Dark Cave"* in Cinzel. The key caps pulse with the cyan fragment glow (same `filter: brightness` approach).
- **Desktop:** WASD key caps centered in the area where "Click on a monster to battle." normally shows.
- **Mobile:** Same, but with swipe/tap arrows since there's no keyboard.
- **Disappears:** Naturally, when they move to a tile with monsters (they'll be in Stage 1 with monsters present, and the monster list takes over). OR when they kill something and enter Stage 2. No localStorage flag needed.

**Files to modify:**
- `TileDetailsPanel.tsx` — add `MovementHint` render when stage === 1 and no monsters
- New: `components/MovementHint.tsx`
- `hooks/useOnboardingStage.ts` (create)

**Test:** Create a new character, spawn, claim fragment, verify hint appears. Move to a tile with monsters, verify hint is gone and monster list shows. Kill monster, verify hint never comes back.

---

## Phase 2: Monster List Filtering by Level

**What:** Level 1 players only see level 1 monsters on their tile. Level 2 sees level 1-2. Level 3+ sees everything.

**Current state:** `monstersOnTile` in `MapContext.tsx` returns all monsters at the player's position. The `Monster` type includes `level: bigint`.

**Implementation:**

- **In `MapContext.tsx`:** Add a filtered `visibleMonstersOnTile` computed value. Filter `monstersOnTile` by `monster.level <= playerLevel` when `playerLevel < 3`. Expose as `visibleMonstersOnTile` alongside the unfiltered `monstersOnTile` (other systems may still need the full list).
- **In `TileDetailsPanel.tsx`:** Replace `monstersOnTile` with `visibleMonstersOnTile` in the render loop.
- **In `MapPanel.tsx`:** The tile tooltip shows monster count — use `visibleMonstersOnTile.length` for the tooltip, `monstersOnTile.length` for tile coloring (so the tile still shows there's "something" there even if filtered).

**Edge case:** If all monsters on a tile are filtered out, show the "No monsters in this area" state — which is fine, it encourages movement.

**Concern:** Player might see "No monsters" on a tile that actually has high-level monsters. Add a subtle hint when monsters are hidden: *"Stronger creatures lurk here... (Level 3)"* — shows the minimum level needed to see them. This maintains the mystery without confusing the player.

**Files to modify:**
- `contexts/MapContext.tsx` — add `visibleMonstersOnTile` with level filter
- `components/TileDetailsPanel.tsx` — use `visibleMonstersOnTile`
- `components/MapPanel.tsx` — use filtered count in tooltips

**Test:** Level 1 character on tile with mixed monsters, verify only level 1 monsters show. Level up to 2, verify level 2 monsters now visible. Level 3, all visible.

---

## Phase 3: Progressive UI Panel Reveal

**What:** Hide UI elements that aren't relevant to the player's current stage.

### Stats Panel Gating (`StatsPanel.tsx`)

| Element | Show at stage | Why |
|---------|--------------|-----|
| Name + HP bar | Always | Core identity |
| Stats (AGL/INT/STR) | Stage 2+ (FIRST_BLOOD) | Meaningless until they've seen combat |
| Level + XP bar | Stage 2+ (FIRST_BLOOD) | First kill gives XP, now it matters |
| Gold (spendable) | Stage 2+ (FIRST_BLOOD) | Loot drops on kill |
| Gold (escrow breakdown) | Stage 4+ (ESTABLISHED, level 3) | Too complex for early game |
| "Get Gold" button | Stage 4+ (ESTABLISHED) | Don't tempt purchases before they're hooked |
| Fragments section | Always | It's the hook, they see it on spawn |
| Nearby Ranks / Leaderboard | Stage 5+ (VETERAN, level 5) | Competitive motivation for invested players |
| Equipped Loadout | Stage 2+ (FIRST_BLOOD) | They might have loot now |

### TileDetailsPanel Gating

| Element | Show at stage | Why |
|---------|--------------|-----|
| Monster list | Stage 1+ | Core gameplay |
| Player list | Stage 4+ (ESTABLISHED) | PvP awareness not needed early |
| "Outer Realms" / zone label | Stage 4+ | Don't confuse with zones early |
| Adventure Escrow row | Stage 4+ | Complex mechanic |
| Fragment echo row | Always | Discovery moment |

### MapPanel Gating

| Element | Show at stage | Why |
|---------|--------------|-----|
| Map grid | Always | Spatial awareness |
| Navigation arrows | Always | Core movement |
| Compass tooltips (monster/player counts) | Stage 3+ (SETTLING_IN) | Information overload early |
| Player dots on map | Stage 4+ | PvP awareness |
| Auto-adventure toggle | Stage 3+ | Power user feature |

### World Feed / Right Column

| Element | Show at stage | Why |
|---------|--------------|-----|
| World feed | Stage 4+ (ESTABLISHED) | Social proof for invested players, noise for new ones |

**Implementation approach:** Each component gets `const stage = useOnboardingStage(...)` and wraps sections in `{stage >= STAGE.FIRST_BLOOD && (...)}`. Simple conditional rendering — no layout changes, no new components.

**Files to modify:**
- `components/StatsPanel.tsx` — conditional sections
- `components/TileDetailsPanel.tsx` — conditional sections
- `components/MapPanel.tsx` — conditional sections
- `App.tsx` or `GameBoard.tsx` — world feed gating

**Test:** Create character at each level, screenshot the game board, verify appropriate sections are visible/hidden at each stage.

---

## Phase 4: PvP Zone Client-Side Gate

**What:** Prevent movement into Outer Realms (x >= 5 || y >= 5) until level 5 via the client. Show a locked visual on the map boundary and a message on attempt.

**Current state:** Safety zone is `x < 5 && y < 5` (defined in `MapContext.tsx` line 128). There's already an "Outer Realms warning" modal for level 1 players (GameBoard.tsx line 186-203) — but it's just a warning, doesn't block.

**Implementation:**

- **In `MovementContext.tsx`:** Before calling `moveCharacter`, check if the target tile is outside safety zone AND `character.level < 5`. If so, don't execute the move — instead trigger a toast/modal: *"You must reach Level 5 to enter the Outer Realms."*
- **In `MapPanel.tsx` (map grid):** Tiles outside the safety zone get a visual treatment when `level < 5`:
  - Darkened / desaturated overlay
  - A subtle lock icon or boundary line at the safety zone edge
  - Tooltip: *"Outer Realms — Level 5 required"*
- **Navigation compass:** Disable direction buttons that would move into restricted tiles. Grey them out with the level requirement tooltip.
- **Remove the current soft warning modal** (GameBoard.tsx lines 186-211) — it's replaced by the hard gate.

**Target tile calculation:** The compass already knows adjacent tiles. We need `position + direction → target coords`, then check `targetX >= 5 || targetY >= 5`. This calc already exists implicitly in `COMPASS_DIRECTIONS` with `dx/dy`.

**Files to modify:**
- `contexts/MovementContext.tsx` — block move + show message
- `components/MapPanel.tsx` — visual gate on map tiles + compass buttons
- `pages/GameBoard.tsx` — remove soft warning modal (replaced by hard gate)

**Test:** Level 4 character at safety zone edge, try to move out, verify blocked with message. Level up to 5, verify movement works. Verify map tiles show locked visual.

---

## Implementation Order & Session Plan

Each phase is one session. Ship, test on prod, move to next.

```
[ ] Phase 1: Movement hint + useOnboardingStage hook
[ ] Phase 2: Monster level filtering
[ ] Phase 3: Progressive UI reveal
[ ] Phase 4: PvP zone gate
```

**Estimated effort:**
- Phase 1: ~1.5 hours (new hook, new component, one render gate)
- Phase 2: ~1 hour (filter in MapContext, swap in two components)
- Phase 3: ~2 hours (many small conditional wraps across 4 files, careful testing)
- Phase 4: ~1.5 hours (movement block, map visual, compass disable)

**Risk notes:**
- Phase 3 has the most surface area — test thoroughly at each level
- Phase 4 changes movement behavior — needs testing with edge cases (what if they're already outside safety zone at < level 5? Don't trap them — only block moves that go OUT, not moves within the Outer Realms or moves back IN)
