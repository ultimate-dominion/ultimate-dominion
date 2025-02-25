# Ultimate Dominion

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/ultimate-dominion/ultimate-dominion/workflows/CI/badge.svg)](https://github.com/ultimate-dominion/ultimate-dominion/actions)
[![Discord](https://img.shields.io/discord/1234567890?color=7289da&label=Discord&logo=discord&logoColor=ffffff)](https://discord.gg/ultimate-dominion)

Ultimate Dominion is a text-based MMORPG built on the [MUD engine](https://mud.dev/), combining classic text adventure gameplay with modern blockchain technology. Players can own their items, trade with others, and participate in a dynamic player-driven economy.

![Game Screenshot](docs/assets/game-screenshot.png)

## Features

- **Rich Text-Based World**: Explore dungeons, cities, and wilderness through immersive text descriptions
- **Blockchain Integration**: True ownership of items and characters
- **Player Economy**: Trade items and resources in a player-driven marketplace
- **Guild System**: Form alliances and compete for territory
- **Combat System**: Strategic turn-based combat with various character classes
- **Crafting**: Create unique items using gathered resources

## Documentation

Our documentation is organized into several key areas:

- [Technical Architecture](technical_architecture.md) - System design and components
- [Implementation Plan](implementation_plan.md) - Setup and deployment guides
- [Frontend Guidelines](frontend_guidelines.md) - UI/UX standards and patterns
- [Backend Structure](backend_structure.md) - API and server architecture
- [Smart Contracts](smart_contracts.md) - Blockchain integration
- [Project Requirements](project_requirements_document.md) - Game features and scope
- [App Flow](app_flow_document.md) - User journey and game flow

For contributors:
- [Documentation Review Checklist](documentation_review_checklist.md) - Ensuring doc quality
- [Changelog](CHANGELOG.md) - Version history and updates

## Quick Start

- ⚔️ Character Creation & Customization
- 🌍 Vast World Exploration
- ⚔️ PvE & PvP Combat Systems
- 🏪 Trading & Marketplace
- 💎 NFT-Based Items & Equipment
- 🤝 Player Interactions
- 🌐 Decentralized Infrastructure

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Blockchain: Solidity + MUD Framework
- Storage: IPFS (Pinata)
- Development Chain: Anvil
- Testnet: Sepolia
- Production: Ethereum Mainnet

## Prerequisites

- Node.js v18.x
- pnpm 8+
- Foundry
- MetaMask or other Web3 wallet

## Local Development

1. Clone the repository:
```bash
git clone https://github.com/ultimate-dominion/ultimate-dominion.git
cd ultimate-dominion
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
# In packages/client
cp .env.sample .env
# In packages/api
cp .env.sample .env
```

4. Start the local blockchain:
```bash
pnpm anvil
```

5. Deploy contracts:
```bash
pnpm deploy:local
```

6. Start the development servers:
```bash
pnpm dev
```

The game will be available at `http://localhost:3000`

## Environment Setup

### Client (.env)
```
VITE_WALLET_CONNECT_PROJECT_ID=
VITE_CHAIN_ID=31337 # Local
VITE_INDEXER_URL=
VITE_HTTPS_RPC_URL=
VITE_WS_RPC_URL=
VITE_API_URL=
```

### API (.env)
```
PINATA_JWT=
PRIVATE_KEY=
WORLD_ADDRESS=
INITIAL_BLOCK_NUMBER=
```

## Deployment

### API Deployment (Render)

The API is configured to deploy on Render using the `render.yaml` configuration file. To deploy:

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Render will automatically detect the `render.yaml` configuration
4. Set up the following environment variables in Render:
   - `NODE_ENV`: Set to `production`
   - `PINATA_JWT`: Your Pinata JWT token (keep this secret!)

The build process will:
1. Install dependencies using pnpm
2. Build the TypeScript files
3. Start the server using the production entry point

### Environment Variables

Required environment variables for the API:
- `NODE_ENV`: Set to `production` for deployment
- `PINATA_JWT`: JWT token for Pinata IPFS service
- `PRIVATE_KEY`: Ethereum private key for blockchain interactions
- `WORLD_ADDRESS`: Address of the deployed World contract
- `INITIAL_BLOCK_NUMBER`: Block number where the World contract was deployed

Optional environment variables:
- `PORT`: Port number for the server (defaults to 8080)

Make sure to set these variables in your deployment environment. For Render deployment:
1. All sensitive variables (PINATA_JWT, PRIVATE_KEY, etc.) should be marked as "Secret"
2. Variables are configured in the Render dashboard under Environment
3. Changes to environment variables will trigger a redeploy

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

- Discord: [Join our community](https://discord.gg/ultimate-dominion)
- Twitter: [@UltimateDominion](https://twitter.com/UltimateDominion)
- Email: team@ultimatedominion.game

## Acknowledgments

- [MUD Framework](https://mud.dev/)
- [Ethereum Foundation](https://ethereum.org/)
- [All Contributors](CONTRIBUTORS.md)
