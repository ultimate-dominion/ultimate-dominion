# Z2 Production Deploy — Phased Runbook

Each phase is independently deployable and rollbackable. Stop at any phase boundary if something breaks. Never combine phases into a single session.

**Total commits:** ~100 (dev ahead of main)
**Key risk:** 14+ system upgrades, new tables, PositionV2 migration, zone data, effects, quest chains all at once
**Mitigation:** Phase separation + SHOW_Z2 gate means Z1 players are never exposed to Z2 risk

---

## Pre-Flight (do this the day before)

### Blockers — must fix before any deploy

- [x] **Fix zone-loader mob counter** — Fixed in `3460172f`. Zone-loader now reads `Counters[world, 0]` directly via `getRecord` instead of calling non-existent `UD__getCurrentMobCounter`.
- [x] **Replace ConfigureZones.s.sol with viem script** — Fixed in `3460172f`. New script: `scripts/admin/configure-zones.ts`. Supports `--dry-run` and `--mainnet`.
- [x] **Build verify-zone-state script** — Fixed in `3460172f`. New script: `scripts/admin/verify-zone-state.ts`. Checks ZoneConfig, ZoneMapConfig, MobsByZoneLevel counts, mob ID ranges, monster inventories. Exits non-zero on failure.

### Verify

- [ ] Deployer ETH balance: `cast balance $DEPLOYER --rpc-url $PROD_RPC` — need ~0.05 ETH
- [ ] `worlds.json` has prod world address: `0x99d01939F58B965E6E84a1D167E710Abdf5764b0`
- [ ] nginx `limit_conn` on rpc.ultimatedominion.com is >= 50
- [ ] Read `memory/infra/deploy-guide.md` failure patterns table
- [ ] Read `memory/game/mud-gotchas.md`

### Merge

- [ ] Verify SHOW_Z2 gate is intact: `packages/client/src/lib/env.ts` → `export const SHOW_Z2 = !IS_PRODUCTION;`
- [ ] Clean build artifacts from dev: `.mud/local/systems.json`, `IWorld.abi.json`, `codegen/index.sol`
- [ ] PR from `dev` → `main` with full diff review
- [ ] **Do NOT remove SHOW_Z2 in this PR** — contracts deploy first, client goes live later

---

## Phase 1: Contract Deploy (Z2 invisible to players)

**Goal:** Get all system bytecode on-chain. Z2 is still gated — players see nothing new.
**Rollback:** Redeploy old system bytecode from previous main commit. Or just leave it — gated code does nothing.
**Duration:** ~15 min

```bash
# On main branch, clean tree
cd packages/contracts
pnpm deploy:mainnet
```

### Verify

```bash
# Check deploy output:
# - Correct world address (NOT a new one)
# - EnsureAccess ran
# - No Access_Denied errors in relayer logs (watch 5 min)
```

- [ ] Deploy output shows `0x99d01939F58B965E6E84a1D167E710Abdf5764b0`
- [ ] EnsureAccess completed (check deploy logs for "All cross-namespace access grants applied")
- [ ] **Z1 regression** — fight a mob, buy from shop, check marketplace. If anything breaks, STOP.

### If Z1 breaks

The PositionV2 migration touches MapSystem, MapSpawnSystem, EncounterSystem, AutoAdventureSystem, ShopSystem — all core gameplay. If Z1 combat/movement/shops break:

1. Check relayer logs for `Access_Denied` → re-run `pnpm ensure-access:mainnet`
2. If still broken → `git checkout HEAD~1 -- packages/contracts/` and redeploy to restore old system bytecode
3. Do not proceed to Phase 2

---

## Phase 2: Zone Configuration (still invisible)

**Goal:** Set up Z2 zone boundaries so the world knows where Z2 is.
**Rollback:** `setStaticField` ZoneMapConfig Z2 width=0 → tiles fall back to Z1.
**Duration:** ~10 min

### Z2 ZoneMapConfig

```bash
# Dry-run first to see current values:
source .env.mainnet && npx tsx scripts/admin/configure-zones.ts --mainnet --dry-run

# If values need updating:
source .env.mainnet && npx tsx scripts/admin/configure-zones.ts --mainnet
```

The script uses `setStaticField` (NOT `setRecord` — that's a known no-op, failure #3).
It verifies each write by reading back the value — if verification fails, it exits immediately.

- [ ] Z1 ZoneMapConfig: width=10, height=10, originX=0, originY=0, minLevel=1
- [ ] Z2 ZoneMapConfig: width=10, height=10, originX=0, originY=100, minLevel=10
- [ ] Z1 ZoneConfig: maxLevel=10, badgeBase=100
- [ ] Z2 ZoneConfig: maxLevel=20, badgeBase=101

### Verify

```bash
source .env.mainnet && npx tsx scripts/admin/verify-zone-state.ts dark_cave --mainnet
source .env.mainnet && npx tsx scripts/admin/verify-zone-state.ts windy_peaks --mainnet
```

- [ ] Both zones pass all checks
- [ ] Z1 regression — mobs still spawn correctly at existing tiles

---

## Phase 3: Zone Content Loading

**Goal:** Populate Z2 monsters, items, effects, shops, NPCs on-chain.
**Rollback:** Can't cleanly undo zone-loader (creates entities). But data is inert until Z2 is visible.
**Duration:** ~20 min
**CRITICAL:** Zone-loader runs ONCE. Re-running creates duplicates (failure #6).

### Load

```bash
pnpm zone:load:mainnet windy_peaks
```

### Verify immediately

```bash
source .env.mainnet && npx tsx scripts/admin/verify-zone-state.ts windy_peaks --mainnet
```

The script automatically checks:
- MobsByZoneLevel mob counts match monsters.json
- Mob IDs are NOT in Z1 range (catches the counter bug)
- Monster inventories are non-empty

- [ ] verify-zone-state passes all checks for windy_peaks
- [ ] Z2 monster inventories include Z1 consumables (Health Potion, Bloodrage Tonic)
- [ ] If zone-loader fails mid-run: **DO NOT re-run**. Diagnose first — re-running creates duplicates.

### Sync & verify

```bash
# Effects
npx tsx scripts/effect-sync.ts dark_cave          # verify Z1 survived
npx tsx scripts/effect-sync.ts windy_peaks        # verify Z2 loaded

# Items
pnpm item:verify:mainnet dark_cave                # verify Z1
pnpm item:verify:mainnet windy_peaks              # verify Z2
```

- [ ] Z1 effects: 0 mismatched, 0 missing
- [ ] Z2 effects: 0 mismatched, 0 missing (24 total including wind_gust)
- [ ] Z1 items: 0 mismatched
- [ ] Z2 items: 0 mismatched

### If anything mismatched

```bash
# Fix with --update flag:
npx tsx scripts/effect-sync.ts windy_peaks --update
pnpm item:sync:mainnet windy_peaks
# Then re-verify
```

---

## Phase 4: Data Scripts (still invisible)

**Goal:** Populate lookup tables, XP thresholds, class grants, boss config.
**Rollback:** Each script is idempotent — re-run with correct values.
**Duration:** ~15 min

### Run in order

```bash
# 1. XP thresholds for L11-20
# Prod already has L1-10. Add L11-20:
# L11=26600, L12=28800, L13=31680, L14=35320, L15=39800
# L16=45200, L17=51600, L18=59300, L19=68800, L20=84800

# 2. Class spell grants (scans URIStorage — never hardcodes IDs)
npx tsx scripts/admin/populate-class-spell-grants.ts --mainnet --dry-run
npx tsx scripts/admin/populate-class-spell-grants.ts --mainnet

# 3. Patch Warden inventory (cross-zone items)
npx tsx scripts/admin/patch-warden-inventory.ts --mainnet --dry-run
npx tsx scripts/admin/patch-warden-inventory.ts --mainnet

# 4. Configure World Boss
# configureWorldBoss(bossId=1, mobId=WARDEN_ID, zoneId=2, spawnX=5, spawnY=9, respawnSeconds=3600)

# 5. Remove Warden from regular mob pool
# Remove from MobsByZoneLevel[2][20] if present

# 6. Bump MAX_LEVEL to 20 (if not done in contract deploy)
# This is a constants.sol change — requires system redeploy if not already in the main merge
```

### Verify

- [ ] Levels table has entries for L1-20 (all non-zero)
- [ ] LevelUnlockItems has 9 entries (one per class at L15)
- [ ] AdvancedClassItems has 9 entries (one per class at L10)
- [ ] WorldBoss configured and active
- [ ] Warden NOT in regular spawn pool
- [ ] **Z1 regression** — fight, shop, marketplace still work

---

## Phase 5: Playtest on Prod (gated)

**Goal:** Verify Z2 works with real prod data, real indexer, real relayer.
**How:** Temporarily enable Z2 for a test account by overriding the flag locally, or use beta as final proxy.

- [ ] Full playthrough: new char → L10 → class select → zone transition → Z2
- [ ] Z2 mob spawns at correct levels
- [ ] Z2 drops are Z2 items
- [ ] Wind gust applies on peak tiles (y >= 8)
- [ ] Warden spawns at fixed coords, double wind gust stacks
- [ ] Fragment chain initializes
- [ ] Pioneer badge mints
- [ ] Z2 NPCs visible and functional
- [ ] Run smoke test suite

---

## Phase 6: Go Live (client deploy)

**Goal:** Remove SHOW_Z2 gate. Z2 visible to all players.
**Rollback:** Re-add SHOW_Z2 gate, merge to main → Vercel auto-deploys. Instant.
**Duration:** ~5 min

```bash
# Remove gate in Routes.tsx, Header.tsx, env.ts
# PR to main → merge → Vercel auto-deploys
```

- [ ] **Do NOT** use `vercel --prod` from CLI (failure #10)
- [ ] Use `printf` not `echo` for any env var changes (failure #11)
- [ ] Monitor for 30 min: relayer logs, indexer lag, player reports

### Tag

```bash
git tag deploy-prod-z2-$(date +%Y%m%d-%H%M)
```

---

## Emergency Rollback (any time after go-live)

All reversible without contract redeploy:

| Level | Action | Effect | Command |
|-------|--------|--------|---------|
| 1 | Disable Z2 spawns | No new mobs in Z2, existing mobs stay | `setStaticField ZoneMapConfig[2] width=0` |
| 2 | Block transitions | No new players enter Z2 | `setStaticField ZoneConfig[2] maxLevel=0` |
| 3 | Hide Z2 client | Z2 UI disappears entirely | Re-add SHOW_Z2 gate, merge to main |

Z1 is never at risk — all Z2 content is additive.

---

## Timing Recommendation

Deploy during lowest traffic (check analytics). Each phase has a natural stop point. If you do one phase per session with verification between, total wall time is ~2 hours but spread across a day with confidence between each step.

**Recommended schedule:**
- Morning: Phase 1 (contracts) + Phase 2 (zone config) — verify Z1 survives
- Afternoon: Phase 3 (zone load) + Phase 4 (data scripts) — verify Z2 data correct
- Next morning: Phase 5 (playtest) — catch anything missed
- When satisfied: Phase 6 (go live)
