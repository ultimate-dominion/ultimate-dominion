# Ultimate Dominion

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/ultimate-dominion/ultimate-dominion/workflows/CI/badge.svg)](https://github.com/ultimate-dominion/ultimate-dominion/actions)
[![Discord](https://img.shields.io/discord/1234567890?color=7289da&label=Discord&logo=discord&logoColor=ffffff)](https://discord.gg/ultimate-dominion)

Ultimate Dominion is a text-based MMORPG built on the [MUD engine](https://mud.dev/) with blockchain integration, currently supporting both Optimism and Pyrope chains. Players can own their items, trade with others, and participate in a dynamic player-driven economy.

![Game Screenshot](docs/assets/game-screenshot.png)

## Features

- **Rich Text-Based World**: Explore dungeons, cities, and wilderness through immersive text descriptions
- **Blockchain Integration**: True ownership of items and characters
- **Player Economy**: Trade items and resources in a player-driven marketplace
- **Guild System**: Form alliances and compete for territory
- **Combat System**: Strategic turn-based combat with various character classes
- **Crafting**: Create unique items using gathered resources

## Requirements

- **Node.js**: >=18.0.0
- **pnpm**: >=8.0.0
- **Foundry**: v0.3.0 (required for contract deployment)
- **Git**: For version control

## Quick Start

- ⚔️ Character Creation & Customization
- 🌍 Vast World Exploration
- ⚔️ PvE & PvP Combat Systems
- 🏪 Trading & Marketplace
- 💎 NFT-Based Items & Equipment
- 🤝 Player Interactions
- 🌐 Decentralized Infrastructure

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ultimate-dominion/ultimate-dominion.git
   cd ultimate-dominion
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Setup Foundry (v0.3.0)**:
   ```bash
   ./setup.sh
   ```

4. **Start development**:
   ```bash
   pnpm dev
   ```

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Blockchain: Solidity + MUD Framework
- Storage: IPFS (Pinata)
- Development Chain: Anvil
- Testnet: Sepolia
- Production: Ethereum Mainnet

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

## Prerequisites

- Node.js v18.x
- pnpm 8+
- Foundry
- MetaMask or other Web3 wallet

## Getting Started

### Requirements

- [Node.js v18.x](https://nodejs.org/en/download/package-manager) Note that version 18 is required. We do not support older or newer versions at the moment.
- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [pnpm, at least version 8](https://pnpm.io/)
- [Pinata account](https://www.pinata.cloud/) - for IPFS file storage (character avatars/metadata)

### Installation

1. Install dependencies:

```bash
pnpm install
```

2. Create an env file in the client directory

```bash
cd packages/client
cp .env.sample .env
```

3. Return to the root directory

```bash
cd ../..
```

4. Create an env file in the contracts directory

```bash
cd packages/contracts
cp .env.sample .env
```

5. Create an env file in the API directory

```bash
cd ../api
cp .env.sample .env
```

6. Return to the root directory

```bash
cd ../..
```

### Pinata Setup for Game Assets

Ultimate Dominion requires uploading game assets (items and monsters) to IPFS through Pinata:

1. Create a [Pinata](https://www.pinata.cloud/) account if you don't have one already
2. Generate a JWT token in your Pinata dashboard
3. Add this token to your API `.env` file as `PINATA_JWT`
4. Upload items.json and monsters.json to your Pinata account:

```bash
# To view items.json and get its content
cat packages/contracts/items.json

# To view monsters.json and get its content
cat packages/contracts/monsters.json
```

5. Upload both files to your Pinata account through their web interface
6. Note the CIDs (Content Identifiers) generated for each file, as these will be needed for the game to access the assets

These CIDs need to match what's referenced in the game code. If you're using your own Pinata account for a fresh deployment, you may need to update references to these CIDs in the codebase.

### Update Pinata Gateway URL

**CRITICAL**: You must update the hardcoded Pinata gateway URL in the client code with your own Pinata gateway URL:

1. Find your Pinata gateway URL in your Pinata dashboard (e.g., `https://your-gateway-name.mypinata.cloud`)
2. Open the file `packages/client/src/utils/helpers.ts`
3. Update the `IPFS_GATEWAYS` array around line 173-174:

```typescript
const IPFS_GATEWAYS = [
  'https://your-gateway-name.mypinata.cloud', // Replace with your Pinata gateway URL
  // 'https://cloudflare-ipfs.com',
  // 'https://ipfs.io',
];
```

This step is required for the client to access IPFS content through your Pinata gateway. Without this change, character images and metadata will not display correctly, even if you've set up the Pinata JWT token correctly.

### Environment Variables Setup

#### Client (.env)

```
VITE_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id
VITE_CHAIN_ID=695569 # For Pyrope chain (or other supported chain ID)
VITE_API_URL=http://localhost:8080 # For local development
```

#### API (.env)

```
PINATA_JWT=your_pinata_jwt_token
PRIVATE_KEY=your_private_key
WORLD_ADDRESS=your_world_contract_address
INITIAL_BLOCK_NUMBER=your_initial_block_number
RPC_HTTP_URL=https://rpc.pyropechain.com
RPC_WS_URL=wss://ws.pyropechain.com
```

#### Contracts (.env)

```
# Anvil default private key (or your own private key):
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Pyrope Chain Configuration
CHAIN_ID=695569
RPC_URL=https://rpc.pyropechain.com
```

### Development Workflow

Run the development server:

```bash
pnpm dev
```

This will start all services (client, contracts, and API) concurrently using mprocs.

To run just the client:

```bash
pnpm dev:client
```

To build the client:

```bash
pnpm build:client
```

To preview the built client:

```bash
pnpm start:client
```

The game will be available at `http://localhost:3000`

## Deployment

Ultimate Dominion consists of two separate deployments on Vercel:

1. **Client** (front-end web application)
2. **API** (server-side code that handles IPFS/Pinata and blockchain interactions)

**IMPORTANT:** You must deploy both components separately to have a fully functional application. They are distinct Vercel projects with their own configuration and environment variables.

### Deployment Commands

#### 1. Deploying the Client

**RECOMMENDED METHOD:** Deploy from the project root to correctly handle workspace dependencies:

```bash
# From the project root directory
vercel --prod
```

> **NOTE:** Deploying from the client directory directly often fails due to workspace dependencies. The root deployment method ensures that all workspace dependencies (like the contracts package) are properly included.

#### 2. Deploying the API (Required Separate Deployment)

```bash
# From the project root directory
cd packages/api && vercel --prod
```

After deploying both components, make sure to:

1. Get the URL of your API deployment (e.g., https://ud-api.vercel.app)
2. Update the client's environment variable `VITE_API_URL` to point to your API deployment URL
3. Redeploy the client for the changes to take effect

Without both components deployed correctly and connected, character creation and other IPFS-dependent features will not work.

### Vercel Build Settings

#### Client Project (ud)

- **Framework Preset**: Vite
- **Build Command**: pnpm build:client
- **Output Directory**: packages/client/dist
- **Install Command**: pnpm install --ignore-scripts
- **Development Command**: vite
- **Node.js Version**: 18.x
- **Root Directory**: Leave blank (or specify packages/client if deploying from root)

#### API Project (ud-api) - Must be deployed separately

- **Framework Preset**: Other
- **Build Command**: npm run vercel-build or npm run build
- **Output Directory**: public (if it exists, or '')
- **Install Command**: pnpm install
- **Node.js Version**: 20.x
- **Root Directory**: Leave blank (or specify packages/api if deploying from root)

### Important Vercel Environment Variables

Ensure these environment variables are set in your Vercel project settings:

#### For Client Deployment
- VITE_WALLET_CONNECT_PROJECT_ID
- VITE_CHAIN_ID
- VITE_API_URL (set to your API deployment URL)

#### For API Deployment
- PINATA_JWT (required for character avatar/metadata storage)
- PRIVATE_KEY
- WORLD_ADDRESS
- INITIAL_BLOCK_NUMBER
- RPC_HTTP_URL
- RPC_WS_URL

## Supported Chains

The project currently supports the following chains:

1. **Optimism (Chain ID: 10)**
   - RPC URL: https://mainnet.optimism.io
   - Explorer: https://optimistic.etherscan.io

2. **Pyrope (Chain ID: 695569)**
   - RPC URL: https://rpc.pyropechain.com
   - Explorer: https://explorer.pyropechain.com

## MUD

This game is built off of the MUD engine. Check their docs [here](https://mud.dev/introduction).

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
