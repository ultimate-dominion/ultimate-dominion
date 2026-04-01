# MAGIC DOC: Deploy State
_What's deployed where across beta and prod. Updated automatically during deploy and feature work sessions._

## Contract Addresses
- **Prod World:** `0x99d01939F58B965E6E84a1D167E710Abdf5764b0` (Base Mainnet, chain 8453)
- **Beta World:** `0xDc34AC3b06fa0ed899696A72B7706369864E5678` (Base Sepolia)

## Beta State
- **Contracts:** Last deployed via `pnpm deploy:testnet`
- **Client:** Auto-deploys via Vercel on push to `dev`
- **Indexer:** Railway `indexer-beta` service (WARNING: domain contains "prod" — misleading)
- **Relayer:** Railway `relayer` service

### Features on Beta (not yet on prod)
- Chat system (v0.3.0 — WS multiplexed, PostgreSQL backed)
- Durability sentinel fix (0=uninitialized, 1=broken, 2+=functional)
- Equip flow auto-initializes durability
- Z2 plate stats bumped (Windsworn Plate armor 9→12, Warden's Bulwark 11→14)

### Pending Beta Actions
- Guild stat buffs (`feat/guild-stat-buffs` — committed, not deployed)
- ATTACK_MODIFIER deployment (1.0 in code, may not be on-chain)

## Prod State
- **Contracts:** Deployed via `pnpm deploy:mainnet` (requires confirmation)
- **Client:** Auto-deploys via Vercel git integration on push to `main`
- **Indexer:** Railway `indexer-prod` service
- **Relayer:** Railway `relayer` service, 5 EOA pool

### Prod Versions
- Check latest deploy tag: `git tag -l 'deploy-prod-*' --sort=-version:refname | head -5`
- 132 characters, 92 created total
- DAU ~9.6, peak 35

## Environment Files
- `packages/contracts/.env` — MUST default to beta (testnet)
- `packages/contracts/.env.mainnet` — prod config, used by `deploy:mainnet`
- `packages/contracts/.env.testnet` — beta config, used by `deploy:testnet`

## Deploy Commands
- Beta contracts: `pnpm deploy:testnet`
- Prod contracts: `pnpm deploy:mainnet` (MUST ASK FIRST)
- After any deploy: `git tag deploy-{env}-$(date +%Y%m%d-%H%M)`, run item-sync + effect-sync verify
- Indexer: `railway deploy --service indexer-beta` or `railway deploy --service indexer-prod`
- Client: push to `dev` (beta) or `main` (prod) — Vercel auto-deploys
