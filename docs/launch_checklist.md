# Ultimate Dominion - Launch Checklist

Organized into three phases: Beta Launch (Base Sepolia), Mainnet Launch (Base), and Post-Launch.

> **Status Key**: `[x]` = done, `[ ]` = not started, `[~]` = in progress

---

## Phase 1: Beta Launch (Base Sepolia / beta.ultimatedominion.com)

Get the game playable with real users on testnet. Rough edges acceptable — the goal is real player feedback.

> **Current status**: Game live at beta.ultimatedominion.com (Base Sepolia) and ultimatedominion.com. Fresh redeploy complete with Dark Cave balance overhaul. Gasless transactions nearly done — last onboarding blocker.

### 1.1 Core Gameplay (Must Work)

**Authentication & Onboarding**
- [x] Google sign-in (Thirdweb embedded wallet) ✓ Wallet created invisibly on sign-in
- [x] MetaMask / external wallet support ✓ "Connect Wallet" button when `window.ethereum` detected
- [x] Session persistence ✓ Thirdweb auto-persists, auto-reconnect on refresh
- [x] Embedded wallet MUD integration ✓ Custom waitForTransaction using viem polling
- [x] Delegation flow ✓ "Authorize & Play" with crypto-free language
- [x] Delegation revoke ✓ "Reset Game Account" button, logout also revokes
- **Note**: Needs `VITE_THIRDWEB_CLIENT_ID` env var set.

**Gasless Transactions (Onboarding Blocker)**
- [x] Gas onboarding system designed ✓ GasStationSystem (Gold→ETH swap for level 3+), Thirdweb paymaster (levels 1-3)
- [~] Gasless transactions implementation — in progress (separate session)
  - Sponsored gas so new players don't need testnet ETH to play
  - Without this, non-crypto users hit a wall immediately after sign-in

**Combat & Progression**
- [x] PvE combat working ✓ Full combat loop with loot drops
- [x] HP/damage scaling by level ✓ Weapon scalingStat (STR/AGI/INT)
- [ ] PvP combat validation — at minimum, verify 2-player PvP completes without errors
- [ ] Basic PvP balance pass — ensure no class/build is completely dominant
- [ ] Edge case testing (disconnects, timeouts during combat)

**Economy & Shop**
- [x] Buy/sell flow ✓ Fixed ERC1155MissingApprovalForAll bug
- [ ] Shop inventory and pricing — verify all items purchasable and prices reasonable
- [ ] Shop UI/UX improvements
- [ ] Verify marketplace list/buy/cancel flows work end-to-end

**Narrative & Lore**
- [x] "Fragments of the Fallen" story arc ✓ 8-part story arc complete
- [x] FragmentSystem.sol ✓ ERC721 minting on claim
- [x] Lore fragment triggers ✓ Spawn, shop, combat, PvP, locations
- [x] Badge system ✓ Adventurer badge at level 3, gates chat access
- [ ] Fragment artwork (placeholders acceptable for beta, but flag to players)
- [ ] Fragment system tests

**UI/UX (Already Complete)**
- [x] Full 6-phase UI/UX overhaul ✓
- [x] Mobile responsiveness ✓
- [x] Accessibility (aria-labels, role="alert", focus-visible) ✓
- [x] Loading states and error handling ✓
- [x] Crypto abstraction (all blockchain terminology replaced) ✓
- [x] Hybrid font system (Inter + Fira Code) ✓
- [x] Dark mode support ✓ (toggle hidden for now)

### 1.2 Testnet Deployment

**Smart Contracts**
- [x] Deploy MUD World to Base Sepolia ✓
- [x] Run FullPostDeploy (ERC20 Gold, ERC721 Characters, ERC1155 Items, core config) ✓
- [x] Seed game data (items, monsters, shops via zone loader or SeedGameData) ✓
- [ ] Configure badge token and fragment NFTs
- [ ] Verify all contracts on block explorer
- [x] Record deployed WORLD_ADDRESS and INITIAL_BLOCK_NUMBER ✓
- [x] Test all system calls against live testnet (mint, move, combat, shop, marketplace) ✓ Game working on Sepolia
- [ ] Validate MUD indexer sync (latency, missed events, reorgs)

**API Server**
- [x] Deploy API to Vercel ✓
- [x] Configure environment variables (WORLD_ADDRESS, RPC URLs, INITIAL_BLOCK_NUMBER) ✓
- [ ] Set up Pinata IPFS for character metadata (replace local dev-storage)
- [ ] Verify /api/upload, /api/upload-file, /api/session endpoints
- [ ] Set up health check monitoring (/health endpoint)
- [x] CORS for production domain ✓ CORS_ORIGINS env var
- [x] API rate limiting ✓ express-rate-limit: 100 req/15min

**Client**
- [x] Build client for production (`pnpm build`) ✓
- [x] Deploy to Vercel (vercel.json SPA rewrite configured) ✓
- [x] Configure production .env (CHAIN_ID, RPC URLs, INDEXER_URL, API_URL, THIRDWEB_CLIENT_ID) ✓
- [x] Set up beta.ultimatedominion.com domain and SSL ✓
- [x] Verify Thirdweb embedded wallet on production domain (allowlisted origins) ✓
- [ ] Verify WalletConnect on production domain
- [ ] Test MUD indexer proxy / direct indexer URL in production
- [ ] Verify Vite build output (bundle size, code splitting, no dev artifacts)

**Infrastructure**
- [x] Set up RPC provider ✓
- [ ] MUD indexer reachable and syncing for Base Sepolia
- [x] DNS: beta.ultimatedominion.com → Vercel ✓
- [ ] Set up error monitoring (Sentry or similar)
- [ ] Set up uptime monitoring for API and client
- [ ] Push Protocol chat — verify on production domain (CORS issue on localhost)

### 1.3 Beta Smoke Test (Post-Deploy)

Run through every core flow before inviting players:

- [ ] Sign in with Google (embedded wallet) — full flow
- [ ] Sign in with MetaMask (external wallet) — delegation flow
- [ ] Create character (metadata upload to IPFS, mint tx)
- [ ] Enter game, move on map
- [ ] Fight a monster, win/lose
- [ ] Visit shop, buy/sell items
- [ ] List item on marketplace, buy from marketplace
- [ ] Level up, allocate stats
- [ ] Chat (Push Protocol)
- [ ] Mobile browser — full flow
- [ ] Multiple concurrent users (at least 2-3 testers simultaneously)

### 1.4 Community & GTM (Beta)

These must be ready before inviting the first public player:

**Before First Public Post**
- [ ] SEO quick wins: `react-helmet-async`, `robots.txt`, `sitemap.xml`, OG image (1-2 hours)
- [ ] Build or enhance landing page / Welcome page with game description + screenshots
- [ ] Create 1200x630px OG image for social sharing
- [ ] Add JSON-LD structured data (VideoGame schema)
- [ ] Set `sourcemap: false` in `vite.config.ts` for production

**Community Channels**
- [ ] Launch Discourse forum at forum.ultimatedominion.com (live from day one)
  - Seed categories: Announcements, Game Discussion, Guides, Community, Support
  - Configure SIWE or DiscourseConnect SSO for wallet auth
- [ ] Create X/Twitter account, pre-write first 5 posts (see GO_TO_MARKET.md)
- [ ] Create Farcaster/Warpcast account
- [ ] Set up email capture on landing page (Buttondown or Discourse mailing list)

**Directory Listings**
- [ ] PBBG.com + Discourse forum
- [ ] BrowserMMORPG.com
- [ ] MUD directories (MUD Connector, MudVerse, MudListings, Top Mud Sites)

**First Outreach**
- [ ] Post on r/MUD — developer introduction
- [ ] Post in MUD Coders Guild Slack
- [ ] Share in Lattice/MUD Discord

**Beta Testing Program**
- [ ] Define beta feedback channels (Discourse "Bug Reports" + "Feedback" categories)
- [ ] Create beta tester onboarding guide (how to get testnet ETH, how to report bugs)
- [ ] Target: 10-25 active beta testers

---

## Phase 2: Mainnet Launch (Base / ultimatedominion.com)

Only after beta is stable, feedback is incorporated, and security is verified.

### 2.1 Security Review (Gate for Mainnet)

All security items must be complete before touching real money:

- [ ] Smart contract audit (external or internal review)
- [x] Access control verification ✓ 6 admin systems locked, _requireSystemOrAdmin() on critical systems
- [x] Reentrancy protection ✓ PvpRewardSystem double-claim fix, ShopSystem nonReentrant
- [x] Integer overflow/underflow checks ✓ CombatMath clamping, division-by-zero guards
- [x] Input validation ✓ Negative stat validation, HP clamping
- [x] Rate limiting and anti-griefing ✓ 1s move cooldown, one character per account, MAX_PARTY_SIZE=10
- [x] Private key management ✓ No hardcoded keys, vm.envUint("PRIVATE_KEY")
- [x] Frontend security ✓ No dangerouslySetInnerHTML, no eval, chainId validated
- [x] API security ✓ Path traversal fix, CORS allowlist, rate limiting, input validation
- [x] Dependency audit ✓ OpenZeppelin pinned to 5.0.2, pnpm audit run
- [ ] Test coverage for critical paths (combat, trading, minting)
- [ ] Economic exploit review (inflation attacks, arbitrage, gold duplication)
- [x] Emergency pause mechanism ✓ PauseSystem + PauseLib on 30+ entry points across 13 systems

### 2.2 Game Balance (Incorporate Beta Feedback)

**PvP Balance**
- [ ] Comprehensive PvP balance testing (all class matchups)
- [ ] Combat mechanics validation (hit/miss, damage formulas, status effects)
- [ ] Matchmaking system (if applicable)
- [ ] Anti-cheat considerations (transaction ordering, bot detection)

**Economy & Gold**
- [ ] Gold sink/faucet balance (verify gold isn't inflating or deflating)
- [ ] Shop pricing vs monster rewards (progression should feel fair)
- [ ] Item pricing consistency across zones
- [ ] Inflation/deflation prevention mechanisms
- [ ] Marketplace fee structure
- [x] Gas onboarding system ✓ GasStationSystem, Thirdweb paymaster, OutOfResourcesModal

**Item Drops**
- [x] Review drop rates for all monsters ✓ Beta rates: starters 60%, common 50%, uncommon 40%, rare 25%
- [x] Balance loot tables by level/zone ✓ Staggered weapon/armor stat gates, consumable distribution per combat triangle
- [ ] Rare item drop rate tuning (post-beta feedback)
- [ ] Test item scarcity/abundance (post-beta feedback)

**Stats & Leveling**
- [ ] Starting stat point allocation balance
- [ ] Stat points per level progression
- [ ] Class stat multiplier tuning
- [ ] Experience curve balance
- [ ] Level cap and endgame balance
- [ ] Restock mechanics testing (shop restocking frequency and quantities)

### 2.3 Mainnet Deployment

**Smart Contracts**
- [ ] Deploy MUD World to Base mainnet
- [ ] Run FullPostDeploy with production config
- [ ] Seed production game data
- [ ] Verify all contracts on Basescan
- [ ] Record production WORLD_ADDRESS and INITIAL_BLOCK_NUMBER
- [ ] Validate all system calls on mainnet
- [ ] Document deployment runbook (step-by-step for future deploys/resets)

**Live Operations Tooling**
- [ ] Build `AdminTuning.s.sol` — forge script for surgical live updates without redeployment
  - Item tuning: update stats (damage, armor, modifiers), drop rates, prices, stat requirements
  - Monster tuning: update stats (HP, STR, AGI, INT, armor, XP), add/remove inventory items
  - Shop tuning: update prices, stock, restock rates
  - Economy tuning: gold rewards, marketplace fees
  - Content additions: add new items/monsters/shops without touching existing data
  - Retirement: set dropChance to 0 and remove from shops (existing player copies become legacy items)
- [ ] Test AdminTuning against Sepolia — verify each tuning function works without side effects
- [ ] Document live update runbook (what can be changed hot vs what requires `mud deploy`)

**Infrastructure**
- [ ] Production RPC provider (dedicated, not public node)
- [ ] MUD indexer for Base mainnet
- [ ] DNS: ultimatedominion.com → Vercel (separate project from beta)
- [ ] Environment separation verified — CHAIN_ID, RPC URLs, WORLD_ADDRESS all production values
- [ ] Production API with Pinata IPFS
- [ ] Error monitoring (Sentry) configured for production
- [ ] Uptime monitoring for API and client

**Client**
- [ ] Production build deployed to Vercel
- [ ] Production .env verified (Base mainnet chain ID, RPC URLs, etc.)
- [ ] Thirdweb embedded wallet allowlisted for production domain
- [ ] WalletConnect verified on production domain

### 2.4 GTM (Mainnet Launch)

**Content & SEO**
- [ ] Public docs site live at docs.ultimatedominion.com (Docusaurus, 10+ pages)
- [ ] Submit sitemap to Google Search Console
- [ ] Create press kit (PressKitty) — screenshots, GIFs, trailer, logo, fact sheet
- [ ] Write first Medium article (cross-post to Discourse)

**Distribution Push**
- [ ] Apply for Base Builder Grants
- [ ] Start #ScreenshotSaturday on X/Twitter
- [ ] Set up IndieDB and itch.io game pages with dev logs
- [ ] Submit to web3 aggregators (DappRadar, ChainPlay, PlayToEarn, GAM3S.GG)
- [ ] Email MMORPG.com Indie MMO Spotlight columnist
- [ ] Email Massively Overpowered
- [ ] Post on r/IndieGaming, r/playmygame

**Launch Mechanics**
- [ ] Queue/invite system implementation (see LAUNCH_STRATEGY.md)
- [ ] Human verification system (see LAUNCH_STRATEGY.md)
- [ ] DEX liquidity setup for $GOLD token (see ECONOMICS.md)

### 2.5 Mainnet Smoke Test

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

All tuning changes below use `AdminTuning.s.sol` (built in 2.3) — single-transaction admin calls, no downtime, no redeployment. Changes are instant and affect all players (items are referenced by ID, stats live in shared tables).

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
- [ ] New items and equipment tiers (AdminTuning — counter increments, new IDs, wire to drops/shops)
- [ ] Guild system (`mud deploy` — new system + tables)
- [ ] Advanced class abilities (`mud deploy` — combat system changes)
- [ ] Seasonal events and limited-time content (AdminTuning for temp items/monsters, retire after event)
- [ ] Fragment artwork (replace placeholders with final art)

### 3.5 Retention & Re-engagement

- [ ] Email re-engagement for lapsed players (patch notes, new content alerts)
- [ ] "Founding Player" badge for first 100 accounts `[IMPLEMENTED]` (Badge #50)
- [ ] Visible changelogs on Discourse + docs site
- [ ] Responsive developer presence (answer questions, ship feedback-driven fixes)
- [ ] Public roadmap (what's coming next — builds anticipation)

### 3.6 Metrics & Review

- [ ] Set up on-chain analytics (DAU, new characters/day, retention)
- [ ] Google Search Console monitoring for docs site
- [ ] Weekly: check DAU, new signups, channel attribution
- [ ] Monthly: review retention curves, content performance, adjust strategy
- [ ] Quarterly: full GTM strategy review, reallocate effort to winning channels

---

## Reference: What's Already Done

A consolidated view of all completed items across phases:

**Auth & Onboarding**: Google sign-in, MetaMask, session persistence, delegation flow, delegation revoke, Thirdweb embedded wallet verified on production domain

**UI/UX**: Full 6-phase overhaul, mobile responsive, accessibility, loading states, crypto abstraction, hybrid fonts, dark mode, manifesto page linked from welcome screen

**Security**: Access control, reentrancy, overflow checks, input validation, rate limiting, key management, frontend security, API security, dependency audit, emergency pause

**Economy**: Gas onboarding (GasStationSystem + paymaster), buy/sell flow, HP/damage scaling

**Game Balance**: Dark Cave monsters trimmed to 10 (one per level, staggered combat triangle), weapon/armor stat-only gating with inverse staggering, consumable distribution for class balance, beta drop rates set

**Narrative**: Story arc, FragmentSystem, lore triggers, badge system

**Infrastructure**: API on Vercel, RPC provider, DNS (beta.ultimatedominion.com + ultimatedominion.com), CORS, API rate limiting

**Deployment**: MUD World on Base Sepolia, FullPostDeploy, game data seeded, WORLD_ADDRESS + INITIAL_BLOCK_NUMBER recorded, client built and deployed to Vercel

**GTM**: Target audience defined, marketing plan drafted, messaging by segment, Founding Player badge

---

_Last updated: February 2026_
