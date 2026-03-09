import 'dotenv/config';
import { type Address, type Hex } from 'viem';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

// Support multi-key pool (RELAYER_PRIVATE_KEYS) or single key (RELAYER_PRIVATE_KEY)
const singleKey = process.env.RELAYER_PRIVATE_KEY;
const multiKeys = process.env.RELAYER_PRIVATE_KEYS;
if (!singleKey && !multiKeys) throw new Error('Missing RELAYER_PRIVATE_KEY or RELAYER_PRIVATE_KEYS');

const relayerPrivateKeys: Hex[] = multiKeys
  ? multiKeys.split(',').map(k => k.trim() as Hex)
  : [singleKey as Hex];

export const config = {
  relayerPrivateKeys,
  relayerPrivateKey: relayerPrivateKeys[0],  // backward compat — first key is primary
  rpcUrl: required('RPC_URL'),
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  chainId: parseInt(process.env.CHAIN_ID || '8453', 10),
  rpcAuthToken: process.env.RPC_AUTH_TOKEN || '',
  rpcFallbackUrl: process.env.RPC_FALLBACK_URL || '',

  // World address allowlist — relayer rejects funding for unlisted addresses.
  allowedWorldAddresses: (process.env.ALLOWED_WORLD_ADDRESSES || '')
    .split(',')
    .map(a => a.trim().toLowerCase())
    .filter(Boolean),

  // Gas funding config
  fundingAmount: BigInt(process.env.FUNDING_AMOUNT || '1000000000000000'), // 0.001 ETH
  minPlayerBalance: BigInt(process.env.MIN_PLAYER_BALANCE || '300000000000000'), // 0.0003 ETH
  maxFundingsPerMinute: parseInt(process.env.MAX_FUNDINGS_PER_MINUTE || '10', 10),

  // Gas charging & Gold swap (optional — disabled if WORLD_ADDRESS or GOLD_TOKEN not set)
  worldAddress: (process.env.WORLD_ADDRESS || '') as Address,
  goldToken: (process.env.GOLD_TOKEN || '') as Address,
  weth: (process.env.WETH || '0x4200000000000000000000000000000000000006') as Address,
  swapRouter: (process.env.SWAP_ROUTER || '0x2626664c2603336E57B271c5C0b26F421741e481') as Address,
  poolFee: parseInt(process.env.POOL_FEE || '3000', 10),
  chargeIntervalMs: parseInt(process.env.CHARGE_INTERVAL_MS || '300000', 10),
  swapIntervalMs: parseInt(process.env.SWAP_INTERVAL_MS || '3600000', 10),
  swapThreshold: BigInt(process.env.SWAP_THRESHOLD || '100000000000000000000'), // 100e18

  // Gold purchase (Stripe → Uniswap ETH→Gold)
  goldPurchaseApiKey: process.env.GOLD_PURCHASE_API_KEY || '',
} as const;

/** Whether gas charging is enabled (requires WORLD_ADDRESS + GOLD_TOKEN) */
export const gasChargingEnabled = !!(config.worldAddress && config.goldToken);
