# Ultimate Dominion - Project Memory

## Tech Stack
- **Framework**: MUD (Lattice) for on-chain game development
- **Contracts**: Solidity 0.8.24+, deployed via MUD World
- **Frontend**: React, Tailwind, shadcn/ui, RainbowKit
- **Testing**: Forge (Foundry)

## Key Documentation
- `docs/launch_checklist.md` - Launch readiness tracking
- `docs/combat-stats/combat_system_analysis.md` - Combat system design
- `docs/combat-stats/stat_progression_model.md` - Level 1-60 progression

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
