# Ultimate Dominion - Launch Checklist

## Pre-Launch Requirements

### 1. Narrative & Lore
- [x] Develop game narrative/storyline ✓ "Fragments of the Fallen" - 8-part story arc complete
- [x] Create NFT drop system that reveals parts of the story ✓ FragmentSystem.sol fully implemented
- [x] Design lore fragments tied to NFT collectibles ✓ ERC721 minting on claim
- [x] Plan narrative progression through gameplay ✓ Triggers: spawn, shop, combat, PvP, locations
- [ ] Fragment artwork (currently placeholders)
- [ ] Fragment system tests
- [x] Badge system integration ✓ Adventurer badge mints at level 3, gates chat access

### 2. Non-Crypto Authentication
- [x] Implement traditional authentication (OAuth) ✓ Thirdweb embedded wallet with Google sign-in (Apple/Email removed to simplify)
- [x] Allow players to onboard without requiring wallet connection ✓ Embedded wallet created invisibly on sign-in
- [x] Session management for non-crypto users ✓ Thirdweb auto-persists sessions, auto-reconnect on refresh
- [x] Embedded wallet MUD integration ✓ Thirdweb wallet client used directly (preserves signing transport), custom waitForTransaction using viem polling (avoids RECS sync race)
- **Note**: MetaMask "Connect Wallet" button only shows when `window.ethereum` is detected. Needs `VITE_THIRDWEB_CLIENT_ID` env var set.

### 3. UI/UX
- [x] Review and polish all UI components ✓ Full 6-phase UI/UX overhaul
- [x] StatsPanel readability ✓ Larger fonts for XP/gold, visual dividers between sections, total gold display
- [x] StatsPanel cleanup ✓ Removed redundant "Equipped Items" section (visible in ActionsPanel during battle)
- [x] Level bar readability ✓ Larger font (10px→12px), thicker progress bar, semi-bold level labels
- [x] Battle UI consumables ✓ Potion buttons in ActionsPanel during combat, opens ItemConsumeModal
- [x] Mobile responsiveness ✓ GameBoard auto height, responsive grids, MapPanel/compass sizing, Stats drawer on mobile, modal full-screen on small screens
- [x] Accessibility improvements ✓ aria-labels on icon buttons, role="alert" on errors, focus-visible styles on buttons
- [x] Loading states and error handling ✓ Welcome sync timeout with retry, waitForTransaction retry wrapper (3 attempts with backoff)
- [x] User feedback and tooltips ✓ Character creation step indicator, battle keyboard shortcut hints [1-4], item requirement per-stat breakdown, golden level-up card
- [x] Hybrid font system ✓ Inter for UI text, Fira Code mono for stats/numbers
- [x] Crypto abstraction ✓ All blockchain terminology replaced with game-friendly language (wallet→account, delegation→authorize, allowance→permission, $GOLD→Gold)
- [x] Dark mode theme support ✓ Semantic tokens, useColorModeValue in PolygonalCard (toggle hidden for now)

### 4. PvP Testing
- [ ] Comprehensive PvP balance testing
- [ ] Combat mechanics validation
- [ ] Matchmaking system (if applicable)
- [ ] Anti-cheat considerations
- [ ] Edge case testing (disconnects, timeouts)

### 5. Shop System
- [ ] Shop inventory and pricing fixes
- [ ] Shop UI/UX improvements
- [x] Buy/sell flow validation ✓ Fixed ERC1155MissingApprovalForAll bug — PostDeploy was corrupting shop address in config (wrote 32-byte ABI-encoded address to 20-byte field). Fixed PostDeploy to use Systems.getSystem() and patched on-chain data.
- [ ] Restock mechanics testing

### 6. Item Drop Balance
- [ ] Review drop rates for all monsters
- [ ] Balance loot tables by level/zone
- [ ] Rare item drop rate tuning
- [ ] Test item scarcity/abundance

### 7. Economics & Gold Balance
- [ ] Gold sink/faucet balance
- [ ] Shop pricing vs monster rewards
- [ ] Item pricing consistency
- [ ] Inflation/deflation prevention
- [ ] Marketplace fee structure

### 8. Stats & Leveling Balance
- [ ] Starting stat point allocation balance
- [ ] Stat points per level progression
- [ ] Class stat multiplier tuning
- [x] HP/damage scaling by level ✓ Weapon scalingStat implemented (STR/AGI/INT)
- [ ] Experience curve balance
- [ ] Level cap and endgame balance

### 9. Delegation UI/UX
- [x] Delegation flow improvements ✓ Crypto-free language ("Authorize & Play"), streamlined ConnectWalletModal
- [x] Clear delegation status indicators ✓ "Game Account" terminology, simplified WalletDetailsModal
- [x] Revoke delegation functionality ✓ "Reset Game Account" button with AlertDialog confirmation. Logout also revokes delegation (best-effort) and clears burner from localStorage.
- [x] Delegation permissions display ✓ Renamed allowance modals to "Permissions" with clear spending language
- [x] Error handling for delegation failures ✓ BattleContext guards against undefined RECS components (StatusEffectValidity null check), graceful error toasts on revoke failure

### 10. Security Review
- [ ] Smart contract audit (external or internal review)
- [x] Access control verification (admin functions, namespace permissions) ✓ 6 admin systems locked (openAccess:false), _requireSystemOrAdmin() on LootManager/PveReward/PvpReward/CombatSystem/MobSystem, marketplace counter bug fixed
- [x] Reentrancy protection on all external calls ✓ PvpRewardSystem: fixed missing rewardsDistributed flag (double-claim bug), ShopSystem: added nonReentrant to buy()/sell()
- [x] Integer overflow/underflow checks ✓ CombatMath: clamped negative hit probability (5-98%), PveRewardSystem: guarded mobLevel==0 division-by-zero
- [x] Input validation on all user-facing functions ✓ Negative stat validation in StatCalculator, HP clamping in CombatSystem
- [x] Rate limiting and anti-griefing measures ✓ 1s move cooldown (MapSystem), one character per account (CharacterSystem), MAX_PARTY_SIZE=10 (EncounterSystem)
- [x] Private key management for deployment accounts ✓ Removed hardcoded anvil keys from package.json scripts, Forge scripts use vm.envUint("PRIVATE_KEY"), TS scripts auto-load .env via dotenv
- [x] Frontend security (XSS, CSRF protection) ✓ Verified: no dangerouslySetInnerHTML, no eval/Function, chainId validated against supportedChains, React JSX auto-escapes
- [x] API authentication and authorization ✓ Path traversal fix (resolve + startsWith guard), CORS restricted to env-driven allowlist, rate limiting (100 req/15min), file upload validation (1MB max, image-only mimetype, sanitized filenames), metadata schema validation, removed secret logging, removed stack traces from error responses
- [x] Dependency audit (npm, forge dependencies) ✓ Pinned OpenZeppelin to 5.0.2, pnpm audit run (126 vulns mostly from transitive deps in ethersproject/next/wagmi — not directly fixable without upstream updates)
- [ ] Test coverage for critical paths (combat, trading, minting)
- [ ] Economic exploit review (inflation attacks, arbitrage)
- [x] Emergency pause/upgrade mechanisms ✓ PauseSystem with admin-only pause/unpause, PauseLib checks on all 30+ user-facing entry points across 13 systems

### 11. Testnet Deployment
#### Smart Contracts
- [ ] Deploy MUD World to testnet (Garnet/Base Sepolia)
- [ ] Run FullPostDeploy (ERC20 Gold, ERC721 Characters, ERC1155 Items, core config)
- [ ] Seed game data (items, monsters, shops via zone loader or SeedGameData)
- [ ] Configure badge token and fragment NFTs
- [ ] Verify all contracts on block explorer
- [ ] Record deployed WORLD_ADDRESS and INITIAL_BLOCK_NUMBER
- [ ] Test all system calls against live testnet (mint, move, combat, shop, marketplace)
- [ ] Validate MUD indexer sync (latency, missed events, reorgs)

#### API Server
- [ ] Deploy API to Vercel (or hosting provider)
- [ ] Configure production environment variables (PINATA_JWT, WORLD_ADDRESS, RPC URLs, INITIAL_BLOCK_NUMBER)
- [ ] Set up Pinata IPFS for character metadata storage (replace local dev-storage)
- [ ] Verify /api/upload, /api/upload-file, /api/session endpoints work
- [ ] Set up health check monitoring (/health endpoint)
- [x] Configure CORS for production domain ✓ CORS_ORIGINS env var (comma-separated allowlist, defaults to localhost:3000)
- [x] API rate limiting ✓ express-rate-limit: 100 req/15min on /api/ routes

#### Client / Website
- [ ] Build client for production (`pnpm build`)
- [ ] Deploy to Vercel (vercel.json SPA rewrite already configured)
- [ ] Configure production .env (CHAIN_ID, RPC URLs, INDEXER_URL, API_URL, THIRDWEB_CLIENT_ID)
- [ ] Set up custom domain and SSL
- [ ] Verify Thirdweb embedded wallet works on production domain (allowlisted origins)
- [ ] Verify WalletConnect works on production domain
- [ ] Test MUD indexer proxy / direct indexer URL in production mode
- [ ] Verify Vite build output (bundle size, code splitting, no dev artifacts)

#### Infrastructure
- [ ] Set up RPC provider (public node or dedicated — Alchemy/Infura/custom)
- [ ] Ensure MUD indexer is reachable and syncing for chosen testnet
- [ ] DNS and domain configuration
- [ ] Set up error monitoring (Sentry or similar)
- [ ] Set up uptime monitoring for API and client
- [ ] Push Protocol chat — verify works on production domain (CORS issue on localhost)
- [ ] Document deployment runbook (step-by-step for future deploys/resets)

#### Smoke Test Checklist (post-deploy)
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
- [ ] Multiple concurrent users

### 12. Launch Strategy
- [x] Define target audience ✓ MUD players, old-school MMO vets, LitRPG readers, browser game players, web3 gamers, OSR/TTRPG crossover
- [x] Marketing plan and timeline ✓ Full go-to-market in GO_TO_MARKET.md (community channels, content marketing, press, priority action plan)
- [x] Community platform decision ✓ Self-hosted Discourse (no Discord). SIWE plugin for wallet auth, DiscourseConnect SSO for Thirdweb bridge
- [x] Distribution channels mapped ✓ 40+ directories, forums, and communities identified (web3 + non-crypto). See GO_TO_MARKET.md
- [x] SEO audit completed ✓ Critical gaps identified (no meta tags, no SSR, no sitemap). Quick wins documented.
- [ ] Implement SEO quick wins (react-helmet-async, robots.txt, OG tags, sitemap)
- [ ] Create press kit (PressKitty)
- [ ] Set up Discourse forum
- [ ] Submit to game directories (MUD Connector, PBBG.com, IndieDB, itch.io, DappRadar, etc.)
- [ ] Beta testing program
- [ ] Launch date and milestones
- [ ] Post-launch support plan

---

## Notes

_Add additional notes and decisions here as planning progresses._
