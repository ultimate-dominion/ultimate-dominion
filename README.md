# Ultimate Dominion

Ultimate Dominion is an open-source blockchain-based text MMORPG built on the MUD framework. Players can create characters, explore a vast world, engage in combat, trade items, and interact with other players in a decentralized gaming environment.

## Features

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
