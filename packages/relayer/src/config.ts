import 'dotenv/config';
import { type Hex } from 'viem';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  relayerPrivateKey: required('RELAYER_PRIVATE_KEY') as Hex,
  rpcUrl: required('RPC_URL'),
  delegationContract: required('DELEGATION_CONTRACT') as Hex,
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  chainId: parseInt(process.env.CHAIN_ID || '8453', 10),
} as const;
