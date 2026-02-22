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
- [x] Implement traditional authentication (email/password, OAuth) ✓ Thirdweb embedded wallet with Google, Apple, Email OTP
- [x] Allow players to onboard without requiring wallet connection ✓ Embedded wallet created invisibly on sign-in
- [ ] Wallet linking as optional feature for existing accounts
- [x] Session management for non-crypto users ✓ Thirdweb auto-persists sessions, auto-reconnect on refresh
- **Note**: MetaMask "Connect Wallet" button only shows when `window.ethereum` is detected. Needs `VITE_THIRDWEB_CLIENT_ID` env var set.

### 3. UI Tweaks
- [ ] Review and polish all UI components
- [x] StatsPanel readability ✓ Larger fonts for XP/gold, visual dividers between sections, total gold display
- [x] StatsPanel cleanup ✓ Removed redundant "Equipped Items" section (visible in ActionsPanel during battle)
- [x] Level bar readability ✓ Larger font (10px→12px), thicker progress bar, semi-bold level labels
- [x] Battle UI consumables ✓ Potion buttons in ActionsPanel during combat, opens ItemConsumeModal
- [ ] Mobile responsiveness
- [ ] Accessibility improvements
- [ ] Loading states and error handling
- [ ] User feedback and tooltips

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
- [ ] Delegation flow improvements
- [ ] Clear delegation status indicators
- [ ] Revoke delegation functionality
- [ ] Delegation permissions display
- [ ] Error handling for delegation failures

### 10. Security Review
- [ ] Smart contract audit (external or internal review)
- [ ] Access control verification (admin functions, namespace permissions)
- [ ] Reentrancy protection on all external calls
- [ ] Integer overflow/underflow checks
- [ ] Input validation on all user-facing functions
- [ ] Rate limiting and anti-griefing measures
- [ ] Private key management for deployment accounts
- [ ] Frontend security (XSS, CSRF protection)
- [ ] API authentication and authorization
- [ ] Dependency audit (npm, forge dependencies)
- [ ] Test coverage for critical paths (combat, trading, minting)
- [ ] Economic exploit review (inflation attacks, arbitrage)
- [ ] Emergency pause/upgrade mechanisms

### 11. Launch Strategy
- [ ] Define target audience
- [ ] Marketing plan and timeline
- [ ] Community building (Discord, social media)
- [ ] Beta testing program
- [ ] Launch date and milestones
- [ ] Post-launch support plan

---

## Notes

_Add additional notes and decisions here as planning progresses._
