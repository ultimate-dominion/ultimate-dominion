# Ultimate Dominion

Ultimate Dominion is a text-based MMORPG built on the MUD engine.

## Getting Started

### Requirements

- [Node.js v18](https://nodejs.org/en/download/package-manager) Note that version 18 is required. We do not support older or newer versions at the moment.
- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [pnpm, at least version 8](https://pnpm.io/)

### Required API Keys

1. **WalletConnect Project ID**
   - Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
   - Create a new project
   - Copy the Project ID

2. **Pinata JWT**
   - Go to [Pinata Cloud](https://app.pinata.cloud/)
   - Create an account
   - Generate a new API Key with upload permissions
   - Copy the JWT token

### Local Setup Steps

1. Install dependencies:
```bash
pnpm install
```

2. Set up client environment:
```bash
cd packages/client
cp .env.sample .env
```
Edit `.env` and add your WalletConnect Project ID

3. Set up API environment:
```bash
cd ../api
cp .env.sample .env
```
Edit `.env` and add your Pinata JWT

4. Return to root and start local blockchain:
```bash
cd ../..
pnpm foundry:up  # Only needed first time
anvil
```

5. In a new terminal, deploy contracts:
```bash
cd packages/contracts
pnpm deploy:local
```
Note the World Contract address and Initial Block Number

6. Update API environment:
Edit `packages/api/.env` and update:
- WORLD_ADDRESS with the deployed contract address
- INITIAL_BLOCK_NUMBER with the deployment block number

7. Start the development server:
```bash
cd ../..
pnpm dev
```

The game should now be running at:
- Frontend: http://localhost:3000
- API: http://localhost:8080
- Local Blockchain: http://localhost:8545

## MUD

This game is built off of the MUD engine. Check their docs [here](https://mud.dev/introduction).
