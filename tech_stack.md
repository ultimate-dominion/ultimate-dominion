# Ultimate Dominion Technical Stack

## Overview

Ultimate Dominion represents a sophisticated blend of modern web technologies and blockchain infrastructure, architected as a monorepo using pnpm workspaces. The project is divided into three primary packages: client, contracts, and api, each serving distinct but interconnected purposes in the game's ecosystem.

```ascii
Ultimate Dominion Architecture
┌────────────────────────────────────────────────────────┐
│                     Client Layer                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   React 18  │  │  TailwindCSS │  │  Chakra UI   │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ TypeScript  │  │   Vite       │  │  RainbowKit  │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└───────────────────────────┬────────────────────────────┘
                           │
┌───────────────────────────┴────────────────────────────┐
│                     API Layer                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Express    │  │   MongoDB    │  │    Redis     │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Node.js    │  │    JWT       │  │   Winston    │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└───────────────────────────┬────────────────────────────┘
                           │
┌───────────────────────────┴────────────────────────────┐
│                  Blockchain Layer                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Solidity    │  │     MUD      │  │  Hardhat     │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ OpenZeppelin│  │   Ethers     │  │    Wagmi     │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────────────────────────────────────┘
```

## Client Application Architecture

The client application builds upon React 18 with TypeScript, leveraging Vite's powerful build tooling and development server capabilities. The frontend's visual presentation combines TailwindCSS's utility-first approach with Chakra UI's accessible component library, creating a responsive and engaging user interface. Blockchain interactions are handled through a combination of Ethers.js and Wagmi hooks, with RainbowKit providing a seamless wallet connection experience.

```ascii
Client Architecture
┌──────────────────────────────────────────────────┐
│                  Components                       │
├──────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │   Pages     │ │   Layouts   │ │   Shared    │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ │
├──────────────────────────────────────────────────┤
│                State Management                   │
├──────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ MUD State   │ │React Query  │ │   Context   │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ │
├──────────────────────────────────────────────────┤
│               Web3 Integration                    │
├──────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ RainbowKit  │ │   Wagmi     │ │   Ethers    │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ │
└──────────────────────────────────────────────────┘
```

State management in the client application employs a multi-layered approach. MUD's built-in sync system handles blockchain state synchronization, while React Query manages API data caching and synchronization. Local state management utilizes React Context, with LocalStorage handling session persistence. This comprehensive approach ensures efficient state handling across all aspects of the application.

The development environment is enhanced by a robust set of tools including ESLint with TypeScript configuration, Prettier for consistent code formatting, and Husky for git hooks. Testing is handled through a combination of Jest and React Testing Library for unit tests, with Cypress managing end-to-end testing scenarios.

The client application's key dependencies include:
```json
{
  "@chakra-ui/react": "^2.8.0",
  "@latticexyz/react": "^2.0.0",
  "@rainbow-me/rainbowkit": "^1.0.8",
  "@wagmi/core": "^1.3.9",
  "ethers": "^5.7.2",
  "react": "^18.2.0",
  "react-query": "^3.39.3",
  "tailwindcss": "^3.3.3",
  "typescript": "^5.1.6",
  "vite": "^4.4.9",
  "wagmi": "^1.3.9"
}
```

## API Server Infrastructure

The API server is built on Node.js 18+, utilizing Express.js as its framework backbone. TypeScript ensures type safety throughout the codebase, while MongoDB handles persistent storage needs and Redis manages caching and session requirements. This foundation supports a RESTful API design with comprehensive features including JWT authentication, rate limiting, request validation, and sophisticated error handling middleware.

```ascii
API Server Architecture
┌──────────────────────────────────────────────────┐
│                  API Routes                       │
├──────────┬─────────────┬───────────┬────────────┤
│ /auth    │ /players    │ /game     │ /market    │
└──────────┴─────────────┴───────────┴────────────┘
           │
┌──────────────────────────────────────────────────┐
│               Middleware Layer                    │
├──────────┬─────────────┬───────────┬────────────┤
│  Auth    │   Rate      │  Input    │  Error     │
│  Check   │   Limit     │  Valid    │  Handler   │
└──────────┴─────────────┴───────────┴────────────┘
           │
┌──────────────────────────────────────────────────┐
│               Service Layer                       │
├──────────┬─────────────┬───────────┬────────────┤
│ Business │  Data       │ Cache     │ External   │
│  Logic   │  Access     │ Manager   │   APIs     │
└──────────┴─────────────┴───────────┴────────────┘
           │
┌──────────────────────────────────────────────────┐
│               Storage Layer                       │
├──────────┬─────────────┬───────────┬────────────┤
│ MongoDB  │   Redis     │  IPFS     │ Blockchain │
└──────────┴─────────────┴───────────┴────────────┘
```

The API's development workflow is streamlined through tools like Nodemon for development, Jest and Supertest for testing, and OpenAPI/Swagger for documentation. This setup ensures maintainable, well-tested code with clear documentation for all endpoints and functionality.

Essential API dependencies include:
```json
{
  "express": "^4.18.2",
  "mongoose": "^7.4.3",
  "redis": "^4.6.7",
  "jsonwebtoken": "^9.0.1",
  "winston": "^3.10.0",
  "cors": "^2.8.5",
  "helmet": "^7.0.0",
  "express-rate-limit": "^6.9.0",
  "typescript": "^5.1.6"
}
```

## Smart Contract Architecture

The smart contract layer utilizes Solidity 0.8.17 and the MUD Framework for game systems implementation. The contract architecture is organized around a central World.sol contract, with separate directories for components, systems, tables, and custom type definitions. This modular approach allows for clear separation of concerns and easier maintenance.

Development of smart contracts is supported by Hardhat's comprehensive development environment, with additional tools including Slither for security analysis, Solhint for linting, and detailed gas reporting for optimization. OpenZeppelin contracts provide battle-tested implementations of common standards and patterns.

Core contract dependencies include:
```json
{
  "@latticexyz/cli": "^2.0.0",
  "@latticexyz/world": "^2.0.0",
  "@openzeppelin/contracts": "^4.9.3",
  "@nomiclabs/hardhat-ethers": "^2.2.3",
  "hardhat": "^2.17.1",
  "solidity-coverage": "^0.8.4"
}
```

## Infrastructure and Deployment

The infrastructure utilizes a modern, distributed approach with Vercel hosting the client application, Render managing the API server, and IPFS/Pinata handling decentralized storage needs. Database services are provided by MongoDB Atlas, with Redis Labs managing caching requirements. This distributed architecture ensures high availability and scalability.

```ascii
Deployment Architecture
┌─────────────────────┐      ┌─────────────────────┐
│    GitHub Actions   │─────►│      Docker Hub     │
└─────────────────────┘      └─────────────────────┘
          │                           │
          ▼                           ▼
┌─────────────────────┐      ┌─────────────────────┐
│   Quality Gates     │      │    Container Reg    │
└─────────────────────┘      └─────────────────────┘
          │                           │
          ▼                           ▼
┌─────────────────────┐      ┌─────────────────────┐
│   Security Scan     │      │     Deployment      │
└─────────────────────┘      └─────────────────────┘
          │                           │
          └───────────────┬──────────┘
                         ▼
┌───────────────────────────────────────────┐
│              Production                    │
├────────────────┬────────────┬─────────────┤
│    Vercel      │   Render   │    IPFS     │
│   (Frontend)   │   (API)    │  (Storage)  │
└────────────────┴────────────┴─────────────┘
```

DevOps processes are automated through GitHub Actions for CI/CD, with Docker handling containerization needs. Package management is handled efficiently through pnpm, while environment configuration is managed via dotenv. Monitoring solutions include Sentry for error tracking, DataDog for performance monitoring, and EtherscanAPI for transaction oversight.

## Environment Configuration

The environment configuration is carefully structured across all system components. The client environment variables manage blockchain interactions and API connections:
```
VITE_CHAIN_ID=17069
VITE_WALLET_CONNECT_PROJECT_ID=xxxxx
VITE_HTTPS_RPC_URL=https://rpc.garnetchain.com
VITE_WS_RPC_URL=wss://rpc.garnetchain.com
VITE_API_URL=https://ultimate-dominion-api.onrender.com
VITE_INDEXER_URL=https://indexer.mud.garnetchain.com
```

The API environment configuration manages server settings and external service connections:
```
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://xxx
REDIS_URL=redis://xxx
JWT_SECRET=xxx
PINATA_API_KEY=xxx
PINATA_SECRET_KEY=xxx
```

The blockchain configuration is specifically tailored for the Garnet Testnet, utilizing chain ID 17069 with appropriate RPC and indexer endpoints.

## Security Implementation

Security measures are implemented comprehensively across all layers of the application. The client side implements wallet connection security, local storage encryption, and various XSS and CSRF protections. API security includes rate limiting, JWT validation, and robust input sanitization. Smart contract security focuses on access control, reentrancy protection, and emergency pause functionality.

## Monitoring and Security

```ascii
Monitoring Stack
┌─────────────────────────────────────────────┐
│              Observability                   │
├───────────────┬─────────────┬───────────────┤
│    Metrics    │    Logs     │    Traces     │
├───────────────┼─────────────┼───────────────┤
│   DataDog     │   Winston   │    Sentry     │
└───────────────┴─────────────┴───────────────┘
         │             │             │
         ▼             ▼             ▼
┌─────────────────────────────────────────────┐
│              Alerting                       │
├───────────────┬─────────────┬───────────────┤
│    PagerDuty  │    Slack    │    Email      │
└───────────────┴─────────────┴───────────────┘
```

## Development Workflow

The development process follows industry best practices, utilizing Git for version control with a feature branch workflow and conventional commits. Testing is comprehensive, covering unit tests for components, integration tests for the API, and thorough contract test coverage. The deployment process follows a structured approach, moving through development and staging environments before production deployment.

## Documentation Strategy

Documentation is maintained across all aspects of the project, with OpenAPI/Swagger handling API documentation, NatSpec covering smart contract documentation, and Storybook managing component documentation. Additional documentation includes detailed architecture diagrams, setup guides, and comprehensive developer resources covering local setup, contribution guidelines, and deployment procedures.

This technical stack represents a carefully considered balance of modern tools and practices, creating a robust foundation for Ultimate Dominion's gaming experience while ensuring maintainability and scalability for future growth.
