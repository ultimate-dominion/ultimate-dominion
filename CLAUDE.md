# Ultimate Dominion - Project Memory

## Tech Stack
- **Framework**: MUD (Lattice) v2 for on-chain game development
- **Contracts**: Solidity 0.8.24+, deployed via MUD World, tested with Forge (Foundry)
- **Frontend**: React 18, Chakra UI, Thirdweb + RainbowKit, viem/wagmi
- **API**: Express on Vercel serverless, Pinata IPFS
- **Chain**: Base Sepolia (testnet) → Base (mainnet)

## Key Documentation
- `docs/launch_checklist.md` - Launch readiness tracking
- `docs/GAME_DESIGN.md` - Canonical game mechanics reference
- `docs/ECONOMICS.md` - Token economy and gold balance
- `docs/architecture/TECH_STACK.md` - Full tech stack details
- `docs/architecture/SYSTEM_ARCHITECTURE.md` - Smart contract systems
- `docs/architecture/FRONTEND_GUIDELINES.md` - UI design system
- `docs/combat-stats/COMBAT_SYSTEM.md` - Combat formulas and constants
- `docs/combat-stats/COMBAT_BALANCE.md` - Balance issues and tuning
- `docs/APP_FLOW.md` - User-facing app flow
- `docs/LAUNCH_STRATEGY.md` - Launch plan and anti-abuse
- `docs/GO_TO_MARKET.md` - Marketing and distribution

## Reminders

### Launch Checklist Updates
**IMPORTANT**: After completing any significant work, update `docs/launch_checklist.md` to reflect progress. Key areas to track:

- [x] Non-Crypto Authentication (Done - Google OAuth via Thirdweb embedded wallet)
- [ ] PvP Testing & Balance (50% - Phase 1 done, Phase 2-3 pending)
- [ ] Item Drop Balance (40% - needs zone-specific tuning)
- [x] Delegation Revoke (Done - Revoke button + logout revoke implemented)
- [x] Emergency Pause Mechanism (Done - PauseSystem + PauseLib on all user-facing entry points)
- [ ] Security Audit (CRITICAL - not done)

When updating, change `[ ]` to `[x]` for completed items and add notes on partial progress.

## Critical Gaps (Pre-Launch Blockers)
1. ~~No emergency pause/circuit breaker mechanism~~ (DONE)
2. No external security audit
3. Inconsistent access control on some admin functions
