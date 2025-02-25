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

## Monitoring

### Health Checks
- Frontend: `/health`
- API: `/api/health`
- Contracts: Check latest block number

### Logging
- Frontend: Vercel Analytics
- API: Vercel Edge Logs
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
