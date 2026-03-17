import 'dotenv/config';
import { type Hex } from 'viem';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  database: {
    url: required('DATABASE_URL'),
  },
  chain: {
    rpcHttpUrl: required('RPC_HTTP_URL'),
    rpcFallbackHttpUrl: process.env.RPC_FALLBACK_HTTP_URL || '',
    rpcWsUrl: process.env.RPC_WS_URL || '',
    chainId: parseInt(process.env.CHAIN_ID || '8453', 10),
  },
  world: {
    address: required('WORLD_ADDRESS') as Hex,
    startBlock: BigInt(required('START_BLOCK')),
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  },
  cleanup: {
    privateKey: (process.env.PRIVATE_KEY || '') as Hex,
  },
  captcha: {
    turnstileSecret: process.env.TURNSTILE_SECRET_KEY || '',
  },
  auth: {
    apiKey: process.env.INDEXER_API_KEY || '',
  },
  monitor: {
    baseNodeUrl: process.env.MONITOR_BASE_NODE_URL || '',
    baseNodeToken: process.env.MONITOR_BASE_NODE_TOKEN || '',
    baseNodeMetricsUrl: process.env.MONITOR_BASE_NODE_METRICS_URL || '',
    alchemyUrl: process.env.MONITOR_ALCHEMY_URL || '',
    relayerUrl: process.env.MONITOR_RELAYER_URL || 'https://8453.relay.ultimatedominion.com/',
    clientProdUrl: process.env.MONITOR_CLIENT_PROD_URL || 'https://ultimatedominion.com',
    clientBetaUrl: process.env.MONITOR_CLIENT_BETA_URL || 'https://beta.ultimatedominion.com',
    apiUrl: process.env.MONITOR_API_URL || '',
  },
} as const;
