# Ultimate Dominion - Tech Stack

Complete technology reference for the project.

> **Status Key**: `[IMPLEMENTED]` = in code, `[PLANNED]` = designed but not built

---

## Monorepo Structure

| Package | Purpose |
|---------|---------|
| `packages/contracts` | Solidity smart contracts (MUD World) |
| `packages/client` | React SPA (game frontend) |
| `packages/api` | Express API (metadata, file uploads) |

- **Package Manager**: pnpm >=8.0.0
- **Node Version**: v18.20.2 (`.nvmrc`)
- **Workspace**: pnpm-workspace.yaml

---

## Smart Contracts (`packages/contracts`)

| Tool | Version |
|------|---------|
| Solidity | 0.8.24 |
| MUD Framework | 2.2.23 |
| OpenZeppelin | 5.0.2 (pinned) |
| Foundry | 0.3.0 |

**Foundry Config** (`foundry.toml`):
- EVM target: Cancun
- Optimizer: enabled, 10 runs, `via_ir = true`
- FFI: disabled
- Fuzz runs: 256

**Key Dependencies**:
- `@latticexyz/cli`, `store`, `world`, `world-modules`, `schema-type` (all ^2.2.23)
- `@openzeppelin/contracts` 5.0.2
- `forge-std`, `ds-test` (Foundry test libraries)

**Dev Tools**: solhint + MUD plugins, prettier-plugin-solidity

---

## Frontend (`packages/client`)

### Core

| Tool | Version |
|------|---------|
| React | 18.2.0 |
| Vite | ^4.2.1 |
| TypeScript | 5.3.3 |
| Build target | ES2022 |

### UI Framework

| Tool | Version | Purpose |
|------|---------|---------|
| Chakra UI | ^2.8.2 | Component library (primary) |
| Emotion | ^11.11.4 | CSS-in-JS (Chakra dependency) |
| Framer Motion | ^11.2.6 | Animations |

**No Tailwind CSS** — styling is entirely Chakra UI + Emotion.

### Fonts

| Font | Package | Usage |
|------|---------|-------|
| Inter | @fontsource/inter ^5.2.8 | Body text, headings |
| Fira Code | @fontsource/fira-code ^5.1.0 | Stats, numbers, monospace |

Loaded via `@fontsource` packages (not Google Fonts CDN).

### Web3 & Wallet

| Tool | Version | Purpose |
|------|---------|---------|
| Thirdweb | ^5.42.0 | Embedded wallet (Google sign-in), wallet adapter |
| RainbowKit | ^2.1.1 | External wallet connection UI (MetaMask) |
| wagmi | ^2.9.6 | Wallet client management |
| viem | 2.9.20 | Blockchain interactions |

**Dual-path authentication**:
- Embedded: Thirdweb (Google OAuth) — wallet created invisibly
- External: RainbowKit (MetaMask) — requires delegation

### MUD Client Libraries

All at version 2.0.11:
- `@latticexyz/common` — shared utilities
- `@latticexyz/react` — React hooks for RECS
- `@latticexyz/recs` — reactive ECS (Entity Component System)
- `@latticexyz/store-sync` — indexer sync
- `@latticexyz/world` — World client interface
- `@latticexyz/faucet` ^2.1.1 — testnet faucet

### Other Frontend Dependencies

| Package | Purpose |
|---------|---------|
| react-router-dom ^6.23.1 | Client-side routing |
| @tanstack/react-query ^5.37.1 | Server state management |
| react-icons ^5.2.1 | Icon library |
| rxjs 7.5.5 | Reactive streams (MUD sync) |
| fuzzy-search ^3.2.1 | Search filtering |
| react-typist ^2.0.5 | Typing animation |
| @pushprotocol/restapi ^1.7.25 | In-game chat |
| @vercel/analytics ^1.3.1 | Analytics |

### Vite Build Config

- React plugin enabled
- Manual chunks: Chakra UI bundled separately
- Chakra UI CommonJS transformation enabled
- Dev server: port 3000
- MUD indexer proxy at `/mud-indexer`
- Top-level await support

---

## API (`packages/api`)

| Tool | Version | Purpose |
|------|---------|---------|
| Express | ^4.19.2 | HTTP server |
| cors | ^2.8.5 | Cross-origin support |
| express-rate-limit | ^7.1.5 | Rate limiting (100 req/15min) |
| formidable | ^3.5.1 | File upload parsing |
| sharp | ^0.33.4 | Image processing |
| @pinata/sdk | ^2.1.0 | IPFS pinning (character metadata) |
| @vercel/node | ^3.1.7 | Vercel serverless deployment |
| viem | 2.9.20 | On-chain reads |

**Deployment**: Vercel serverless functions (not a long-running Express server in production).

---

## Supported Chains

| Chain | ID | Environment |
|-------|-----|-------------|
| Anvil | 31337 | Local development |
| Base Sepolia | 84532 | Testnet |
| Base | 8453 | Mainnet (launch target) |

---

## Environment Variables

### Client (`packages/client/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_THIRDWEB_CLIENT_ID` | Thirdweb embedded wallet client ID |
| `VITE_WALLET_CONNECT_PROJECT_ID` | WalletConnect v2 project ID |
| `VITE_CHAIN_ID` | Target chain (default: 31337) |
| `VITE_HTTPS_RPC_URL` | HTTPS RPC endpoint |
| `VITE_WS_RPC_URL` | WebSocket RPC endpoint |

### API (`packages/api/.env`)

| Variable | Purpose |
|----------|---------|
| `PINATA_JWT` | Pinata IPFS authentication |
| `WORLD_ADDRESS` | Deployed World contract address |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `INITIAL_BLOCK_NUMBER` | Block to start indexer sync from |

### Contracts (`packages/contracts/.env`)

| Variable | Purpose |
|----------|---------|
| `PRIVATE_KEY` | Deployer private key (never hardcoded) |

---

## Local Development

### Ports

| Service | Port |
|---------|------|
| Anvil (local chain) | 8545 |
| Client (Vite dev) | 3000 |
| API | 3001 |
| MUD Indexer | proxied via client |

### Commands

```bash
# Start everything (from root)
pnpm dev

# Contracts only
cd packages/contracts && pnpm dev

# Client only
cd packages/client && pnpm dev

# API only
cd packages/api && pnpm dev

# Deploy contracts to testnet
cd packages/contracts && pnpm mud deploy --rpc <RPC_URL>

# Run contract tests
cd packages/contracts && forge test
```

---

## Code Quality

### ESLint (client)
- Extends: eslint:recommended, typescript-eslint, react, react-hooks, import, prettier
- Import ordering: builtin > external > internal > parent > sibling > index (alphabetized)
- React: `react-in-jsx-scope` off (React 18 JSX transform)

### Prettier
- Single quotes, trailing commas, 2-space tabs, 80 char width, no parens on single arrow params

### TypeScript
- Strict mode enabled
- Target: ESNext (client), ES2020 (API)
- Module resolution: Node (client), NodeNext (API)

---

*Last updated: February 2026*
