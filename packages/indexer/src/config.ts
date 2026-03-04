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
} as const;
