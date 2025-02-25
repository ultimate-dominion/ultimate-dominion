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

### Requirements

- [Node.js v18](https://nodejs.org/en/download/package-manager) (required, no other versions supported)
- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [pnpm](https://pnpm.io/) (v8 or higher)

### Development Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/ultimate-dominion/ultimate-dominion.git
   cd ultimate-dominion
   pnpm install
   ```

2. **Configure Environment**
   ```bash
   # Client environment
   cd packages/client
   cp .env.sample .env
   cd ../..

   # Contract environment
   cd packages/contracts
   cp .env.sample .env
   cd ../..
   ```

3. **Start Development**
   ```bash
   pnpm dev
   ```

## Architecture Overview

Ultimate Dominion uses:
- React with TypeScript for the frontend
- Vercel Edge Functions for the API
- [MUD Framework](https://mud.dev/) for game state
- IPFS for asset storage

See our [Technical Architecture](technical_architecture.md) for details.

## Contributing

We welcome contributions! Please see:
- [Contributing Guidelines](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

## Development Status

Check our [Project Board](https://github.com/orgs/ultimate-dominion/projects/1) for:
- Current sprint goals
- Open issues
- Planned features
- Roadmap

## Community & Support

- [Discord Server](https://discord.gg/ultimate-dominion)
- [GitHub Discussions](https://github.com/ultimate-dominion/ultimate-dominion/discussions)
- [Bug Reports](https://github.com/ultimate-dominion/ultimate-dominion/issues)
- Email: support@ultimate-dominion.com

## Built With

- [MUD Engine](https://mud.dev/) - Game state and blockchain integration
- [React](https://reactjs.org/) - Frontend framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vercel](https://vercel.com/) - Deployment and Edge Functions
- [IPFS](https://ipfs.io/) - Decentralized storage

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [RaidGuild](https://raidguild.org) for creating the original version of Ultimate Dominion
- [MUD Framework Team](https://mud.dev/) for their excellent game engine
- All our contributors and community members
- [Lattice](https://lattice.xyz/) for inspiration and guidance
