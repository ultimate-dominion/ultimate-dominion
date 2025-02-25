# Ultimate Dominion - Implementation Plan

This guide walks through everything needed to run Ultimate Dominion, from local development to production deployment.

## Prerequisites

### Required Software
- Node.js v18.x
- pnpm 9.x
- Git
- MetaMask or another Web3 wallet

### Required Accounts
- GitHub account
- Vercel account
- Pinata account (for IPFS)
- Alchemy account (for blockchain RPC)

## Local Development Setup

### 1. Repository Setup
```bash
# Clone the repository
git clone https://github.com/ultimate-dominion/ultimate-dominion.git
cd ultimate-dominion

# Install dependencies
pnpm install
```

### 2. Environment Configuration

Create the following `.env` files:

#### Client Environment (`packages/client/.env`)
```env
VITE_WORLD_ADDRESS=         # MUD World contract address
VITE_CHAIN_ID=31337        # Local chain ID
VITE_BLOCK_TIME=1000       # Block time in milliseconds
VITE_RPC_URL=http://localhost:8545
VITE_PINATA_API_KEY=       # Your Pinata API key
VITE_PINATA_SECRET_KEY=    # Your Pinata secret key
```

#### API Environment (`packages/api/.env`)
```env
PORT=8080
WORLD_ADDRESS=             # Same as client's VITE_WORLD_ADDRESS
PRIVATE_KEY=              # Local development private key
RPC_URL=http://localhost:8545
```

#### Contracts Environment (`packages/contracts/.env`)
```env
PRIVATE_KEY=              # Local development private key
RPC_URL=http://localhost:8545
```

### 3. Start Local Development

```bash
# Terminal 1: Start local blockchain
pnpm mud:dev

# Terminal 2: Deploy contracts
cd packages/contracts
pnpm deploy:local

# Terminal 3: Start API server
cd packages/api
pnpm dev

# Terminal 4: Start client
cd packages/client
pnpm dev
```

## Production Deployment

### 1. Vercel Project Setup

1. Create new project in Vercel
2. Connect to GitHub repository
3. Configure build settings:
   - Framework Preset: Vite
   - Root Directory: Project root (/)
   - Build Command: `pnpm build`
   - Output Directory: `packages/client/dist`
4. Add environment variables from step 2
5. Enable Edge Functions in project settings

### 2. Production Environment Variables

#### Vercel (Client and API)
Configure these in Vercel project settings:
```env
# Client Variables
VITE_WORLD_ADDRESS=         # Production World contract address
VITE_CHAIN_ID=1            # Mainnet chain ID
VITE_BLOCK_TIME=12000      # Mainnet block time
VITE_RPC_URL=              # Alchemy RPC URL
VITE_PINATA_API_KEY=       # Production Pinata API key
VITE_PINATA_SECRET_KEY=    # Production Pinata secret key

# API Variables (Edge Functions)
WORLD_ADDRESS=             # Production World contract address
PRIVATE_KEY=              # Production private key
RPC_URL=                  # Alchemy RPC URL
```

### 3. Contract Deployment

Deploy contracts to production network:
```bash
cd packages/contracts
pnpm deploy:production
```

Save the deployed contract addresses for environment variables.

### 4. Vercel Deployment

#### Frontend Deployment
1. Connect your GitHub repository to Vercel
2. Configure build settings:
   ```
   Build Command: pnpm build
   Output Directory: packages/client/dist
   Install Command: pnpm install
   ```
3. Add environment variables from client .env
4. Deploy and verify frontend is accessible

#### API Deployment (Edge Functions)
1. In the same Vercel project, enable Edge Functions
2. Configure API settings:
   ```
   API Directory: packages/api
   Edge Function Region: Auto (recommended)
   ```
3. Add environment variables from api .env
4. Deploy and verify API endpoints are accessible

#### Deployment Verification
1. Test frontend connectivity
2. Verify API endpoints using health check
3. Confirm Edge Function distribution
4. Monitor performance metrics in Vercel dashboard

### 5. Environment Configuration

#### Client Environment (.env in packages/client)
```env
# Local Development
VITE_API_URL=http://localhost:8080
VITE_CHAIN_ID=31337
VITE_WORLD_ADDRESS=0x...

# Production (Vercel)
VITE_API_URL=/api
VITE_CHAIN_ID=1
VITE_WORLD_ADDRESS=0x...
```

#### API Environment (.env in packages/api)
```env
# Required for all environments
DATABASE_URL=postgresql://...
ALCHEMY_API_KEY=your_key
PINATA_API_KEY=your_key
PINATA_SECRET_KEY=your_key

# Local Development
PORT=8080
NODE_ENV=development

# Production (Vercel)
NODE_ENV=production
```

## Environment-Specific Configuration

### Staging Environment

#### Vercel (`packages/client/.env.staging` and Edge Functions)
```env
# Client Variables
VITE_WORLD_ADDRESS=         # Staging World contract address
VITE_CHAIN_ID=5            # Goerli testnet
VITE_BLOCK_TIME=12000      # Testnet block time
VITE_RPC_URL=              # Staging RPC URL
VITE_PINATA_API_KEY=       # Staging Pinata API key
VITE_PINATA_SECRET_KEY=    # Staging Pinata secret key

# API Variables (Edge Functions)
WORLD_ADDRESS=             # Staging World contract address
PRIVATE_KEY=              # Staging private key
RPC_URL=                  # Staging RPC URL
```

## Monitoring and Maintenance

### Health Checks
- Client: `https://{VERCEL_URL}/health`
- API: `https://{VERCEL_URL}/api/health`
- Smart Contracts: Check World contract events

### Backup Strategy
1. Environment variables (store securely)
2. Contract addresses and ABIs
3. IPFS content hashes

### Regular Maintenance Tasks
1. Update dependencies monthly
2. Monitor smart contract events
3. Check IPFS asset availability
4. Review Edge Function logs in Vercel
5. Check Vercel analytics

## Troubleshooting Guide

### Common Local Issues

1. **Contract deployment fails**
   - Check if local blockchain is running
   - Verify private key in `.env`
   - Clear cache: `pnpm mud:clean`

2. **Client can't connect to contracts**
   - Verify WORLD_ADDRESS is correct
   - Check if API is running
   - Clear browser cache and MetaMask history

3. **API connection issues**
   - Verify RPC_URL is accessible
   - Check if contract addresses match
   - Verify port is not in use

### Production Issues

1. **Vercel deployment fails**
   - Check build logs
   - Verify environment variables
   - Review package versions
   - Check Edge Function limits and usage

2. **Contract interaction issues**
   - Monitor gas prices
   - Check RPC endpoint status
   - Verify contract state

3. **IPFS content unavailable**
   - Check Pinata service status
   - Verify content is pinned
   - Review Edge Function logs

## Security Considerations

1. **Environment Variables**
   - Never commit `.env` files
   - Rotate API keys regularly
   - Use different keys for each environment

2. **Contract Security**
   - Keep private keys secure
   - Use different deployment accounts per environment
   - Monitor contract events for unusual activity

3. **API Security**
   - Rate limiting enabled
   - CORS properly configured
   - Regular security audits

## Scaling Considerations

1. **API Scaling**
   - Vercel Edge Function auto-scaling
   - Edge caching configuration
   - Monitor function execution limits
   - Geographic distribution

2. **Client Performance**
   - Asset optimization
   - Code splitting
   - CDN configuration

3. **Contract Optimization**
   - Gas optimization
   - Batch transactions
   - Event monitoring

Remember to update this document as the implementation evolves. All commands and configurations should be tested in a safe environment before applying to production.
