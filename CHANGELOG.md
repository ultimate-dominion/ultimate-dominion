# Changelog

All notable changes to Ultimate Dominion will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project is pre-1.0 and does not yet follow Semantic Versioning.

## [0.5.0] - 2025-03-09 — Documentation Overhaul

### Added
- Full documentation audit and overhaul across all systems
- New docs: TOKEN_GUIDE, ACCESS_CONTROL, AUTH_INTEGRATION, INDEXER, RELAYER, ROADMAP, DEPLOY_RUNBOOK, ERROR_REFERENCE
- OSS infrastructure: CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, PR template, issue templates, CODEOWNERS

### Changed
- Complete README.md rewrite
- Corrected BASE_GOLD_DROP from 5 to 3 in docs
- Corrected PvP flee penalty from 25% to 10%
- Corrected pool fee from 0.3% to 1%
- Death penalties marked as implemented (were listed as planned)

## [0.4.0] - 2025-03-07 — Wallet Migration & Stabilization

### Added
- Privacy policy and terms of service pages
- Stripe Checkout integration for Gold purchases (replaced MoonPay)

### Changed
- Migrated from Thirdweb to Privy embedded wallet with gas station
- Fixed OAuth redirect flow for Privy integration
- Fixed wallet initialization race conditions
- Fixed nonce serialization issues with Privy
- Fixed navigation loop on auth state changes
- Fixed battle state and timing synchronization bugs
- Added Buffer polyfill for Privy in production builds

### Removed
- Thirdweb embedded wallet integration
- MoonPay checkout flow

## [0.3.0] - 2025-03-05 — Queue System & Auth

### Added
- Queue system with invite codes and waiting room
- Pre-auth waiting room when game is at capacity
- Starter invite codes and slot notification system
- World events panel
- reth metrics monitoring and infrastructure dashboard
- 40+ regression tests with vitest
- Self-hosted RPC node with fallback transport
- Infrastructure monitoring stack

### Changed
- Waiting room UI redesign
- Combat balance overhaul with batch gas charging
- Drop rate formula fix
- Reactive entity data architecture to eliminate stale state

## [0.2.0] - 2025-03-02 — Infrastructure & Deployment

### Added
- Beta/production environment separation (same chain, different world addresses)
- 120+ future feature MUD tables
- Durability design document
- Flashpowder item added to shop
- GasStation system for Gold-to-ETH gas swaps
- GameDelegationControl for burner wallet permissions
- Manifesto page
- Zone loader with chain selection

### Changed
- Gold economy rebalanced — death penalties, flee gold reduction, shop pricing overhaul
- Shop now sells from loot manager reserve instead of minting
- Dark Cave zone balance overhaul
- Tab idle reconnection fixes

## [0.1.0] - 2025-02-25 — Foundation

### Added
- Initial project setup based on RaidGuild's original game design
- MUD Framework v2 integration with React frontend
- Core libraries: CombatMath, StatCalculator, EffectProcessor
- Modular contract systems: WeaponSystem, LevelSystem, ArmorSystem, AccessorySystem, CharacterCore, StatSystem
- AdminSystem, EffectsSystem, ItemsSystem modularization
- RNG system with fixes for on-chain randomness
- Character creation end-to-end flow
- Battle consumables and starter health potions
- Thematic monster attack set
- Badge system for chat gating
- Gold transfer access and marketplace with 3% transaction fee
- Lore NFT fragments system
- Thirdweb embedded wallet for non-crypto authentication
- Emergency pause mechanism
- Access control on critical systems with reentrancy and integer safety protections
- API security hardening

### Changed
- Battle UI improvements
- Client auth flow and delegation streamlining
- Client UI/UX polish pass

### Credits
- Original game concept and implementation by [RaidGuild](https://raidguild.org)

---

*Last updated: March 9, 2026*
