# Ultimate Dominion - Implementation Plan

This guide walks through everything needed to run Ultimate Dominion, from local development to production deployment.

## Prerequisites

- [Node.js v18](https://nodejs.org/en/download/package-manager) (required, no other versions supported)
- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [pnpm](https://pnpm.io/) (v8 or higher)

## Local Development

1. **Clone and Install**
   ```bash
   git clone https://github.com/ultimate-dominion/ultimate-dominion.git
   cd ultimate-dominion
   pnpm install
   ```

2. **Environment Setup**
   ```bash
   # Client environment
   cd packages/client
   cp .env.sample .env

   # API environment
   cd ../api
   cp .env.sample .env

   # Contract environment
   cd ../contracts
   cp .env.sample .env
   ```

3. **Start Development**
   ```bash
   pnpm dev
   ```

## Testing

Run tests for all packages:
```bash
pnpm test
```

Or test specific packages:
```bash
pnpm --filter client test
pnpm --filter contracts test
```

## Deployment

### 1. Environment Configuration

Create environment files for each stage:

```bash
# Client
cd packages/client
cp .env.sample .env.staging
cp .env.sample .env.production

# API
cd ../api
cp .env.sample .env.staging
cp .env.sample .env.production

# Contracts
cd ../contracts
cp .env.sample .env.staging
cp .env.sample .env.production
```

Configure variables for each environment:

```ini
# Client (.env.staging, .env.production)
VITE_WALLET_CONNECT_PROJECT_ID=
VITE_CHAIN_ID=
VITE_INDEXER_URL=
VITE_HTTPS_RPC_URL=
VITE_WS_RPC_URL=
VITE_API_URL=

# API (.env.staging, .env.production)
PINATA_JWT=
PRIVATE_KEY=
WORLD_ADDRESS=
INITIAL_BLOCK_NUMBER=
```

### 2. Contract Deployment

Deploy contracts to production network:
```bash
cd packages/contracts
pnpm deploy:production
```

Save the deployed contract addresses for environment variables.

### 3. Vercel Deployment

#### Frontend and API Deployment
1. Connect your GitHub repository to Vercel
2. Create two separate projects in Vercel:
   - **Client Project**: For the frontend web application
   - **API Project**: For the server-side code that handles IPFS/Pinata and blockchain interactions

3. For the Client Project, configure:
   ```
   Build Command: pnpm build:client
   Output Directory: packages/client/dist
   Install Command: pnpm install --ignore-scripts
   Node.js Version: 18.x
   Root Directory: . (or packages/client if deploying from root)
   ```

4. For the API Project, configure:
   ```
   Framework Preset: Other
   Build Command: npm run vercel-build or npm run build
   Output Directory: public (if it exists, or '')
   Install Command: pnpm install
   Node.js Version: 20.x
   Root Directory: . (or packages/api if deploying from root)
   ```

5. Add environment variables:
   - For Client: VITE_WALLET_CONNECT_PROJECT_ID, VITE_CHAIN_ID, VITE_API_URL
   - For API: PINATA_JWT, PRIVATE_KEY, WORLD_ADDRESS, INITIAL_BLOCK_NUMBER, RPC_HTTP_URL, RPC_WS_URL

6. Deploy both projects
7. After deployment, update the Client's VITE_API_URL to point to your API deployment URL
8. Redeploy the client for the changes to take effect

#### Deployment Verification
1. Test frontend connectivity
2. Verify API endpoints using health check
3. Monitor performance metrics in Vercel dashboard

## Monitoring

### Health Checks
- Frontend: `/health`
- API: `/api/health`
- Contracts: Check latest block number

### Logging
- Frontend: Vercel Analytics Dashboard
- API: Vercel Logs Dashboard
- Contracts: Network Explorer

### Alerts
Configure alerts in Vercel for:
- Build failures
- API errors
- High latency
- Resource limits

## Maintenance

### Updates
1. Dependencies: Weekly security updates
2. Contracts: Monthly audits
3. Documentation: Update with changes

### Backups
1. Database: Daily snapshots
2. Contracts: Keep deployment history
3. Environment: Secure backup of all .env files

### Security
1. Regular security audits
2. Dependency vulnerability checks
3. Access control review
4. API rate limiting
