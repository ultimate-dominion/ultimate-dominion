# Ultimate Dominion

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A permanent, player-driven text RPG built on [MUD](https://mud.dev/) and Base. Characters, items, gold, and scars live on-chain. No downloads, no app stores — just a browser.

## What Is This

Ultimate Dominion is an on-chain MMORPG where everything that matters is owned by the player. Gold is an ERC20 token. Characters are ERC721 NFTs. Items are ERC1155 tokens. The game world runs as a set of Solidity smart contracts on Base Mainnet through the MUD v2 framework.

Players explore a grid-based world, fight monsters and each other, collect loot, trade on a player-driven marketplace, and build a character that persists forever on-chain.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Contracts | Solidity 0.8.24+, MUD v2.2.23, Forge |
| Client | React 18, Chakra UI, Vite |
| Auth | Privy embedded wallets (Google auth) + RainbowKit (MetaMask) |
| API | Express on Vercel serverless |
| Indexer | Custom MUD indexer on Railway |
| Relayer | Self-hosted, 5 EOA wallet pool |
| DEX | Uniswap V3 GOLD/WETH pool (1% fee tier) |
| Chain | Base Mainnet (chain 8453) |
| IPFS | Pinata for game assets |

## Quick Start

```bash
# Clone and install
git clone https://github.com/ultimate-dominion/ultimate-dominion.git
cd ultimate-dominion
pnpm install

# Set up environment files
cp packages/client/.env.sample packages/client/.env
cp packages/contracts/.env.sample packages/contracts/.env
cp packages/api/.env.sample packages/api/.env

# Start local development (Anvil + client + contracts)
pnpm dev
```

The game runs at `http://localhost:3000`. Local development uses Anvil (chain 31337).

### Requirements

- Node.js >= 18
- pnpm >= 8
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

## Environments

| Environment | Chain | URL | World Address |
|-------------|-------|-----|---------------|
| Local | Anvil (31337) | localhost:3000 | Deployed on `pnpm dev` |
| Beta | Base Mainnet (8453) | beta.ultimatedominion.com | `0x4a54538eCD32E1827121f9edb4a87CC4C08536E5` |
| Production | Base Mainnet (8453) | ultimatedominion.com | `0x99d01939F58B965E6E84a1D167E710Abdf5764b0` |

Both beta and production run on Base Mainnet, distinguished by world address.

## Project Structure

```
packages/
  contracts/    Solidity systems, MUD tables, deploy scripts
  client/       React frontend (Vite)
  api/          Express API (Vercel serverless)
  indexer/      Custom MUD indexer (Railway)
  relayer/      Gas relayer service (Railway)
  guide/        Player-facing Astro guide site
```

## Documentation

See [`docs/INDEX.md`](docs/INDEX.md) for the full documentation map.

Key docs:
- [Game Design](docs/GAME_DESIGN.md) — canonical game mechanics
- [Economics](docs/ECONOMICS.md) — gold economy, sinks, marketplace
- [System Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md) — smart contract systems
- [Roadmap](docs/ROADMAP.md) — future features with pre-defined MUD tables
- [Contributing](CONTRIBUTING.md) — how to contribute

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

The game's MUD schema includes **121 pre-defined tables** for future features (guilds, crafting, PvP arena, housing, world events, and more). Check [docs/ROADMAP.md](docs/ROADMAP.md) to see what's available to build.

## Security

For security vulnerabilities, see [SECURITY.md](SECURITY.md). Do not open public issues for security bugs.

## License

MIT — see [LICENSE](LICENSE).

## Built With

- [MUD Framework](https://mud.dev/) — on-chain game engine
- [Base](https://base.org/) — L2 chain
- [Privy](https://privy.io/) — embedded wallet auth
- [Uniswap V3](https://uniswap.org/) — DEX integration

---

*Last updated: March 9, 2026*
