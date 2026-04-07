# Ultimate Dominion - Launch Checklist

Organized into three phases: Beta Launch (Base Mainnet Beta), Mainnet Launch (Base), and Post-Launch.

> **Status Key**: `[x]` = done, `[ ]` = not started, `[~]` = in progress

---

## Phase 1: Beta Launch (Base Mainnet Beta / beta.ultimatedominion.com)

Get the game playable with real users. Rough edges acceptable — the goal is real player feedback.

> **Current status**: Game live at beta.ultimatedominion.com (Base Mainnet, separate world) and ultimatedominion.com (Base Mainnet, production world). Both environments on chain 8453, distinguished by world address. Privy embedded wallets active (MPC on-device signing). Alchemy RPC with Flashblocks (200ms preconfirmations). Gas station (relayer funds new users, tops up low balances).

### 1.1 Core Gameplay (Must Work)

**Authentication & Onboarding**
- [x] Google sign-in (Privy embedded wallet) ✓ Wallet created invisibly on sign-in
- [x] MetaMask / external wallet support ✓ "Connect Wallet" button, delegation fallback
- [x] Session persistence ✓ Privy auto-persists, auto-reconnect on refresh
- [x] Embedded wallet MUD integration ✓ EIP-7702 migration (`3886dada`), custom waitForTransaction using viem polling
- [x] Delegation flow ✓ "Authorize & Play" with crypto-free language
- [x] Delegation revoke ✓ "Reset Game Account" button, logout also revokes
- [x] Auth edge cases ✓ Stale session clearing (`6ecda63f`), wrong-account detection (`2e5cba03`), auto-navigate after sign-in (`c3cf4115`), logout no longer blocks on despawn failure (`60817b93`)

**Gasless Transactions (Onboarding Blocker)**
- [x] Gas onboarding system designed ✓ GasStationSystem (Gold→ETH swap for level 3+), gas station funds new users + tops up low balances
- [x] Gasless transactions implementation ✓ GasStation funded, EIP-7702 with 2x gas buffer (`f413df64`)

**Combat & Progression**
- [x] PvE combat working ✓ Full combat loop with loot drops, auto-retry on reverts (`6ef6b5bd`)
- [x] HP/damage scaling by level ✓ Weapon scalingStat (STR/AGI/INT)
- [x] Combat rebalance ✓ AGI/INT scaling, class multipliers, combat triangle (`014d0ae6`), stat growth rebalance (`82699a7e`)
- [x] PvP bug fixes ✓ Missing currentHp, incomplete getItemEffects, HP validation (`fe65eb35`)
- [x] PvP end-to-end validation ✓ Verified working on beta with 2 players
- [ ] Edge case testing (disconnects, timeouts during combat)

**Survivability**
- [x] Free healing mechanic ✓ `rest()` action heals to full HP at campfire (`112344c5`)

**Economy & Shop**
- [x] Buy/sell flow ✓ Fixed ERC1155 approval, shop encounter bugs (`1754b8b8`, `bc589ab7`, `dd714f7f`), optimistic updates (`8c41cf3c`)
- [x] Shop inventory and pricing ✓ Uncommon gear + consumables, updated prices (`92a520da`), 6 combat consumables added (`e6114fe5`)
- [x] Shop UI/UX ✓ Leave Shop button (`498b93bd`), friendly sell errors, Tal narrative intro (`bf411a69`)
- [x] Marketplace working ✓ List/buy/cancel flows, access grants (`fdb25190`), await tx receipts (`e7496147`), redesigned item page (`cf82490c`), sell action (`f7223baf`)
- [x] Gold Merchant (fiat-to-GOLD onramp) ✓ Stripe Checkout → backend Uniswap V3 swap → Gold delivered to wallet. Needs live Stripe keys for production.
- [x] Gold withdrawal design ✓ MetaMask/external wallet users can transfer directly; embedded wallet users cannot withdraw (by design)

**Narrative & Lore**
- [x] "Fragments" story arc ✓ 8-part story arc complete
- [x] FragmentSystem.sol ✓ ERC721 minting on claim
- [x] Lore fragment triggers ✓ Client-side post-combat triggers (`def60c83`), spawn, shop, PvP, locations
- [x] Badge system ✓ Adventurer badge at level 3, gates chat access
- [x] Fragment UX ✓ Modal closing fix (`8135c37f`), XP on claim + cinematic (`f9f42a60`), echo row colors (`ffea6c23`)
- [ ] Fragment artwork (placeholders acceptable for beta, but flag to players)

**UI/UX (Already Complete)**
- [x] Full 6-phase UI/UX overhaul ✓
- [x] Torchlit dungeon dark theme ✓ (`b7bf197f`)
- [x] Mobile responsiveness ✓ Mobile game board overhaul (`1b9b01e6`), compass rose navigation
- [x] Accessibility (aria-labels, role="alert", focus-visible) ✓
- [x] Loading states and error handling ✓ Optimistic progress bars (`01b17c94`), friendly error messages (`768999ca`)
- [x] Crypto abstraction (all blockchain terminology replaced) ✓ Wallet modal simplified (`a0b4d2d0`)
- [x] Persistent header nav bar ✓ (`00de29fb`)
- [x] Rarity system ✓ Color palette + animated glow (`46b0fd9b`), sort by rarity (`01b17c94`)

### 1.2 Deployment

**Smart Contracts**
- [x] Deploy MUD World to Base Mainnet Beta ✓ World: `0xDd8692cf4C0A20569D8e78D9015d1e44D5E0b662`
- [x] Run MinimalPostDeploy (ERC20 Gold, ERC721 Characters, ERC1155 Items, core config) ✓
- [x] Load zone data via zone-loader ✓ Dark Cave zone loaded
- [x] Record deployed WORLD_ADDRESS and INITIAL_BLOCK_NUMBER ✓
- [x] Test all system calls against live world ✓ Game fully playable on beta
- [x] Contract size management ✓ Split AdminTuningSystem (`088ad960`), danger-zone splits (`2221ad2d`), optimization sweep (`506dcfda`)
- [ ] Verify contracts on Basescan
- [ ] Configure badge token and fragment NFTs on beta

**API Server**
- [x] Deploy API to Vercel ✓
- [x] Configure environment variables ✓
- [x] IPFS for character metadata ✓ Upload endpoints working, CID returns fixed (`f8eea4f7`)
- [x] CORS for production domain ✓ CORS_ORIGINS env var
- [x] API rate limiting ✓ express-rate-limit: 100 req/15min
- [ ] Set up health check monitoring (/health endpoint)

**Client**
- [x] Build client for production ✓
- [x] Deploy to Vercel (vercel.json SPA rewrite configured) ✓
- [x] Configure production .env (CHAIN_ID, RPC URLs, API_URL, PRIVY_APP_ID) ✓
- [x] Set up beta.ultimatedominion.com domain and SSL ✓
- [x] Verify Privy embedded wallet on production domain
- [x] Code splitting and lazy loading ✓ Route code-splitting (`adb1d835`), lazy-load Push Protocol

**Infrastructure**
- [x] RPC provider ✓ Alchemy with Flashblocks (200ms preconfirmations)
- [x] Custom indexer ✓ Replaced RECS with custom indexer + Zustand store (`8383fbbb`), Railway deployment
- [x] DNS: beta.ultimatedominion.com → Vercel ✓
- [x] Push Protocol chat ✓ CORS fix, EOA signer, class-colored names (`bb442d1e`), tavern scroll redesign (`1e263341`)
- [x] Client error reporting ✓ Contract revert telemetry (`584846b2`), client error reporting (`24aef4ff`), performance metrics (`db0b9e04`)
- [x] Google Analytics ✓ GA4 tracking (`23e2b380`)
- [~] Dedicated relayer ✓ $99/mo Standard plan activated, provisioning (~48-72h from Mar 3)
- [ ] Set up uptime monitoring for API and client

### 1.3 Beta Smoke Test (Post-Deploy)

Run through every core flow before inviting players:

- [x] Sign in with Google (embedded wallet) — full flow ✓
- [x] Sign in with MetaMask (external wallet) — delegation flow ✓
- [x] Create character (metadata upload to IPFS, mint tx) ✓
- [x] Enter game, move on map ✓ (movement reliability extensively fixed)
- [x] Fight a monster, win/lose ✓
- [x] Visit shop, buy/sell items ✓
- [x] List item on marketplace, buy from marketplace ✓
- [x] Level up, allocate stats ✓
- [x] Chat (Push Protocol) ✓ Class-colored names, rare item broadcasts
- [x] Mobile browser — full flow ✓
- [x] Advanced class spells ✓ 9 class spells implemented (`31da6ca6`), DeployClassSpells script, self-buff targeting fix (`2338d332`), combat integration in ActionsPanel
- [ ] Multiple concurrent users (at least 2-3 testers simultaneously)

### 1.4 Community & GTM (Beta)

**Before First Public Post**
- [x] SEO: react-helmet-async, robots.txt, sitemap.xml, OG tags ✓ (`119c4afa`)
- [x] Player guide site live at /guide ✓ 13 pages, full JSON-LD, OG tags
- [x] Landing page with game description ✓ Torchlit dungeon theme (`b7bf197f`), welcome page refresh (`6c470bfb`)
- [x] OG image and favicon ✓ Dragon favicon (`c2b15235`), OG image updated (`278804c3`)
- [x] Email capture ✓ Resend integration — signup capture, welcome email, drip infrastructure (`becde351`)
- [x] Set `sourcemap: false` in `vite.config.ts` for production ✓ Already configured

**Community Channels**
- [x] Discourse forum live at tavern.ultimatedominion.com ✓ `/tavern` redirect, setup runbook, changelog automation
- [ ] Create X/Twitter account, pre-write first 5 posts (see GO_TO_MARKET.md)
- [ ] Create Farcaster/Warpcast account

**Directory Listings**
- [ ] PBBG.com + Discourse forum
- [ ] BrowserMMORPG.com
- [ ] MUD directories (MUD Connector, MudVerse, MudListings, Top Mud Sites)

**First Outreach**
- [ ] Post on r/MUD — developer introduction
- [ ] Post in MUD Coders Guild Slack
- [ ] Share in Lattice/MUD Discord

**Beta Testing Program**
- [x] Define beta feedback channels ✓ Tavern (Discourse) at tavern.ultimatedominion.com, linked in main nav
- [ ] Create beta tester onboarding guide
- [ ] Target: 10-25 active beta testers

---

## Phase 2: Mainnet Launch (Base / ultimatedominion.com)

Only after beta is stable, feedback is incorporated, and security is verified.

### 2.1 Security Review (Gate for Mainnet)

- [~] Smart contract audit (external or internal review) — full security review in progress
- [x] Access control verification ✓ 6 admin systems locked, _requireSystemOrAdmin() on critical systems
- [x] Reentrancy protection ✓ PvpRewardSystem double-claim fix, ShopSystem nonReentrant
- [x] Integer overflow/underflow checks ✓ CombatMath clamping, division-by-zero guards, MapRemovalSystem counter underflow guard (`60817b93`)
- [x] Input validation ✓ Negative stat validation, HP clamping, entity ownership validation (`479ff421`)
- [x] Rate limiting and anti-griefing ✓ 1s move cooldown, one character per account, MAX_PARTY_SIZE=10, movement mutex (`52869919`)
- [x] Private key management ✓ No hardcoded keys, vm.envUint("PRIVATE_KEY"), env file separation (`ad04edee`)
- [x] Frontend security ✓ No dangerouslySetInnerHTML, no eval, chainId validated
- [x] API security ✓ Path traversal fix, CORS allowlist, rate limiting, input validation
- [x] Dependency audit ✓ OpenZeppelin pinned to 5.0.2, pnpm audit run
- [x] Emergency pause mechanism ✓ PauseSystem + PauseLib on 30+ entry points across 13 systems
- [ ] Test coverage for critical paths (combat, trading, minting)
- [~] Economic exploit review (inflation attacks, arbitrage, gold duplication) — in progress

### 2.2 Playtest Feedback (Must Fix)

**Transaction Reliability**
- [x] Eliminate jank, stutters, and failed txs ✓ Auto-retry on reverts (`6ef6b5bd`, `acf453ba`), movement cooldown tracking (`145dbfb1`, `394664db`), move mutex (`52869919`), Alchemy Flashblocks (200ms blocks)
- [x] Fire-and-forget gameplay actions ✓ (`6b100929`) — removed simulateContract blocking
- [x] Optimistic progress bars ✓ (`01b17c94`) — asymptotic deceleration on all transactions
- [x] Ghost encounter hardening ✓ click-time stale-target validation plus authoritative combat bootstrap prevent stale cached PvE state from reviving battles (`0b61f384`, `b0f87e60`)

**Chat**
- [x] Show usernames in chat ✓ Class-colored character names (`bb442d1e`)
- [x] Broadcast item finds to chat ✓ Rare item drop announcements + rare-only marketplace (`f6187148`)

**Player Hooks & Engagement**
- [x] Item discovery emphasis ✓ Rarity color palette + animated glow (`46b0fd9b`), sort loot by rarity (`01b17c94`), breathing animation on Uncommon+
- [ ] Leaderboard position updates — notify players of rank changes

**Marketplace**
- [x] Marketplace working end-to-end ✓ Access grants (`fdb25190`), await receipts (`e7496147`), redesigned layout (`cf82490c`), sell action (`f7223baf`)
- [x] Navigation to marketplace/leaderboard prominent ✓ Persistent header nav bar (`00de29fb`)

### 2.3 Game Balance (Incorporate Beta Feedback)

**PvP Balance**
- [x] PvP bug fixes ✓ Missing currentHp, incomplete getItemEffects, HP validation (`fe65eb35`)
- [ ] Comprehensive PvP balance testing (all class matchups)
- [ ] Anti-cheat considerations (transaction ordering, bot detection)

**Economy & Gold**
- [x] Gas onboarding system ✓ GasStationSystem, gas station (relayer), OutOfResourcesModal
- [ ] Gold sink/faucet balance (verify gold isn't inflating or deflating)
- [ ] Shop pricing vs monster rewards (progression feel)
- [ ] Marketplace fee structure

**Item Drops**
- [x] Review drop rates for all monsters ✓ Beta rates: starters 60%, common 50%, uncommon 40%, rare 25%
- [x] Balance loot tables by level/zone ✓ Staggered weapon/armor stat gates, consumable distribution per combat triangle
- [x] On-chain drop multipliers ✓ (`ec1f19f5`) — admin-tunable per-zone
- [ ] Rare item drop rate tuning (post-beta feedback)

**Stats & Leveling**
- [x] Stat growth rebalance ✓ Combat triangle for levels 1-10 (`82699a7e`)
- [x] Class stat multipliers ✓ AGI/INT scaling, class multipliers (`014d0ae6`)
- [x] Early level stat points ✓ 2 stat points for levels 1-10 (`12e5f476`)
- [x] Power source stat bonus ✓ At level 5 (`fff02e9b`)
- [ ] Experience curve balance (post-beta feedback)
- [ ] Level cap and endgame balance

**V3 Balance Patch**
- [x] BalancePatchV3 forge script — deployed to beta, 101 txs confirmed (2026-03-11). Fixes: OldMonsterStats decode, direct table writes for Basilisk + SpellScaling
- [ ] V3 balance patch verification tests (dedicated test file — run against beta fork)
- [ ] Shop inventory update — add new V3 items (Trollhide Cleaver, Phasefang, Drakescale Staff, Drake's Cowl) to Tal's buyable list (separate script)
- [ ] Metadata URI renames — item/monster name updates (Dire Rat Fang, Light Mace, Notched Blade, etc.) (separate script)
- [ ] Data file sync — update items.json, monsters.json with V3 values (Phase 5 in roadmap)

### 2.4 Mainnet Deployment

**Smart Contracts**
- [x] Deploy MUD World to Base mainnet ✓ World: `0x99d01939F58B965E6E84a1D167E710Abdf5764b0`
- [x] Run MinimalPostDeploy with production config ✓
- [x] Load zone data via zone-loader ✓
- [x] Record production WORLD_ADDRESS and INITIAL_BLOCK_NUMBER ✓
- [x] Validate all system calls on mainnet ✓ Game playable on production
- [x] Document deployment runbook ✓ `deploy-guide.md` — fresh deploy checklist, upgrade checklist, zone loading, item sync
- [ ] Verify all contracts on Basescan
- [ ] Deploy latest contract changes to production (beta is ahead of prod)

**Live Operations Tooling**
- [x] AdminTuningSystem ✓ `adminUpdateItemStats()`, `adminSetWeaponScaling()`, `adminSetClassMultipliers()` (`088ad960`)
- [x] Item stats sync script ✓ `item-sync.ts` — compare on-chain vs JSON, push updates (`4603f3ec`)
- [x] Test AdminTuning on beta ✓ 65 items synced successfully
- [x] Document live update runbook ✓ `deploy-guide.md` — three tiers (data tuning, content additions, system logic)

**Infrastructure**
- [x] Production RPC provider ✓ Alchemy with Flashblocks (dedicated, not public node)
- [x] Custom indexer for Base mainnet ✓ Railway (sweet-quietude)
- [x] DNS: ultimatedominion.com → Vercel ✓
- [x] Environment separation verified ✓ Per-environment .env files (`ad04edee`), deploy scripts source correct file
- [x] IPFS for character metadata ✓ Pinata via API
- [x] Client error reporting + telemetry ✓ Custom endpoints (not Sentry)
- [ ] Uptime monitoring for API and client

**Client**
- [x] Production build deployed to Vercel ✓
- [x] Production .env verified ✓
- [x] Privy embedded wallet configured for production domain
- [ ] WalletConnect verified on production domain

### 2.5 GTM (Mainnet Launch)

**Content & SEO**
- [x] Player guide site ✓ 13 pages at /guide with JSON-LD and OG tags
- [ ] Submit sitemap to Google Search Console
- [ ] Create press kit — screenshots, GIFs, trailer, logo, fact sheet
- [ ] Write first Medium article

**Distribution Push**
- [ ] Apply for Base Builder Grants
- [ ] Start #ScreenshotSaturday on X/Twitter
- [ ] Set up IndieDB and itch.io game pages
- [ ] Submit to web3 aggregators (DappRadar, ChainPlay, PlayToEarn, GAM3S.GG)
- [ ] Email MMORPG.com Indie MMO Spotlight columnist
- [ ] Post on r/IndieGaming, r/playmygame

**Launch Mechanics**
- [x] Queue/invite system implementation ✓ Code complete, deployed, working on beta
- [~] Human verification system (Cloudflare Turnstile) — code complete (`CaptchaGate.tsx` + indexer `captcha.ts`), needs Turnstile site keys set on Railway + Vercel
- [ ] DEX liquidity setup for $GOLD token (see ECONOMICS.md)
- [ ] Set `founderWindowEnd` timestamp via `cast send` on production world (decides how long founder badges are available)
- [ ] Set `maxPlayers = 10` via `cast send` on production world
- [ ] Set `sessionTimeout = 300` in SessionConfig via `cast send` on production world
- [ ] Set up Cloudflare Turnstile site + add `TURNSTILE_SECRET_KEY` to Railway, `VITE_TURNSTILE_SITE_KEY` to Vercel

### 2.6 Mainnet Smoke Test

Same as beta smoke test, but on mainnet with real assets:

- [ ] Sign in with Google — full flow
- [ ] Sign in with MetaMask — delegation flow
- [ ] Create character (verify IPFS metadata, mint tx on Base)
- [ ] Full gameplay loop: move, fight, loot, shop, marketplace
- [ ] Level up, allocate stats
- [ ] Chat (Push Protocol)
- [ ] Mobile browser — full flow
- [ ] GasStation system (Gold→ETH auto-swap for level 3+)
- [ ] Paymaster working (free gas for levels 1-3)
- [ ] Verify emergency pause works on mainnet

---

## Phase 3: Post-Launch

Ongoing after mainnet is live. Focus shifts from building to growing and sustaining.

### 3.1 Community Growth

- [ ] Show HN post (once browser experience is friction-free)
- [ ] Post on Royal Road (serialized lore or forum posts)
- [ ] Engage LitRPG communities (Goodreads, LitRPG Legends)
- [ ] Apply to Base Batches 2026
- [ ] Reach out to gaming guilds (YGG, Merit Circle, Avocado DAO)
- [ ] Post in old-school MMO communities (Project 1999, ServUO, Project Gorgon)
- [ ] Build in-game referral system (double-sided rewards)

### 3.2 Content Cadence

- [ ] Weekly dev logs on Discourse + X/Twitter
- [ ] #WIPWednesday and #ScreenshotSaturday on X/Twitter
- [ ] Monthly progress summaries with before/after screenshots
- [ ] Patch notes on every update (Discourse + docs site)
- [ ] Medium articles (monthly, cross-posted to Discourse)

### 3.3 Ongoing Balance & Tuning

All tuning changes use AdminTuningSystem + `item-sync.ts` — single-transaction admin calls, no downtime, no redeployment. Changes are instant and affect all players.

- [ ] Monitor gold inflation/deflation (on-chain metrics)
- [ ] Adjust drop rates based on player data
- [ ] PvP meta monitoring — nerf/buff as needed
- [ ] Experience curve adjustments based on average time-to-level
- [ ] Shop pricing adjustments based on marketplace data
- [ ] Retire underused items (set dropChance to 0, remove from shops — existing copies stay as legacy)
- [ ] Establish patch cadence: data-only hotfixes (AdminTuning) vs system upgrades (`mud deploy`)

### 3.4 Feature Expansion

New zones, items, and monsters can be added live via AdminTuning + zone loader without redeployment. System-level features (guild, abilities) require `mud deploy`.

- [ ] New zones and monsters (zone loader + AdminTuning for wiring drops/shops)
- [ ] New items and equipment tiers
- [ ] Guild system (`mud deploy` — new system + tables)
- [ ] Advanced class abilities (`mud deploy` — combat system changes)
- [ ] Seasonal events and limited-time content
- [ ] Fragment artwork (replace placeholders with final art)

### 3.5 Retention & Re-engagement

- [x] Email infrastructure ✓ Resend integration — signup capture, welcome email, drip ready (`becde351`)
- [x] "Founding Player" badge for first 100 accounts ✓ Badge #50
- [ ] Email re-engagement for lapsed players (patch notes, new content alerts)
- [ ] Visible changelogs on Discourse + docs site
- [ ] Responsive developer presence (answer questions, ship feedback-driven fixes)
- [ ] Public roadmap (what's coming next — builds anticipation)

### 3.6 Metrics & Review

- [x] Client performance metrics ✓ TX latency, sync lag, memory, page load (`db0b9e04`)
- [x] Google Analytics (GA4) ✓ (`23e2b380`)
- [ ] On-chain analytics (DAU, new characters/day, retention)
- [ ] Google Search Console monitoring
- [ ] Weekly: check DAU, new signups, channel attribution
- [ ] Monthly: review retention curves, content performance, adjust strategy

---

## Summary: What's Left for Production Launch

### Blocking (must do)
- [ ] Deploy latest contract changes to production (beta is ahead of prod)
- [ ] Wipe indexer DB and re-sync from scratch with new production world
- [ ] Production smoke test (Section 2.6) — planned for contract deploy day
- [ ] Add DEX liquidity for $GOLD token — planned for contract deploy day

### In Progress
- [~] Smart contract security review — full audit in progress
- [~] Economic exploit review (gold duplication, inflation) — in progress
- [~] Cloudflare Turnstile — code done, needs site keys on Railway + Vercel

### Recently Completed
- [x] PvP end-to-end validation ✓
- [x] Queue/invite system ✓
- [x] Gold Merchant (Stripe Checkout) ✓
- [x] Gold withdrawal design ✓ (MetaMask only, embedded wallet locked by design)
- [x] sourcemap: false ✓
- [x] Ghost mob prod hotfix ✓ stale client monster targets now reconcile against on-chain state before combat (`0b61f384`)
- [x] Ghost cleanup no longer clears whole prod tiles ✓ stale targets are evicted without hiding valid mobs on the same tile (`fc728097`)
- [x] Ghost encounter bootstrap fix on beta branch ✓ stale cached `CombatEncounter` rows no longer boot as authoritative UI state, and client no longer force-ends encounters (`b0f87e60`)

### Should Do
- [ ] Verify contracts on Basescan
- [ ] Switch Stripe to live keys (`sk_live_`) for production
- [ ] Set launch config on production world (`maxPlayers`, `sessionTimeout`, `founderWindowEnd`)

### Nice to Have (can do post-launch)
- [ ] WalletConnect verification on production
- [ ] Uptime monitoring
- [ ] Fragment artwork
- [ ] Leaderboard position notifications

---

## Reference: What's Already Done

**Auth & Onboarding**: Google sign-in, MetaMask, session persistence, delegation flow/revoke, EIP-7702 embedded wallet, auth edge cases (stale sessions, wrong account, auto-reconnect)

**UI/UX**: Torchlit dungeon dark theme, mobile game board overhaul, compass navigation, persistent header nav, rarity color palette + animated glow, optimistic progress bars, crypto abstraction, friendly error messages

**Combat**: PvE full loop, PvP bug fixes, combat rebalance (AGI/INT scaling, class multipliers, combat triangle), auto-retry on reverts, fire-and-forget actions, consumable system (6 combat consumables + Flashpowder flee)

**Economy**: GasStation + paymaster, shop buy/sell with optimistic updates, marketplace list/buy/cancel, item stats sync tooling, on-chain drop multipliers

**Narrative**: 8-part story arc, FragmentSystem ERC721, client-side triggers, badge system, fragment XP + cinematic

**Infrastructure**: Alchemy RPC (Flashblocks), custom indexer on Railway, Vercel (client + API), Resend email, Push Protocol chat with class-colored names + item broadcasts, client error telemetry + performance metrics, GA4

**Live Ops**: AdminTuningSystem (item stats, weapon scaling, class multipliers), item-sync.ts (compare + push), zone loader, deploy-guide.md runbook, per-environment .env files

**Game Balance**: Dark Cave monsters (10, staggered combat triangle), weapon/armor stat gating, consumable distribution, stat growth rebalance, early level bonus stat points, power source bonus at level 5, beta drop rates set

---

_Last updated: April 7, 2026_
