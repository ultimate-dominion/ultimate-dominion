/*
 * The supported chains.
 * By default, there are only two chains here:
 *
 * - mudFoundry, the chain running on anvil that pnpm dev
 *   starts by default. It is similar to the viem anvil chain
 *   (see https://viem.sh/docs/clients/test.html), but with the
 *   basefee set to zero to avoid transaction fees.
 * - latticeTestnet, our public test network.
 *
 */

import { garnet, MUDChain, mudFoundry } from '@latticexyz/common/chains';

// Primary RPC from env, plus public fallbacks
const baseHttpRpcs = [
  import.meta.env.VITE_HTTPS_RPC_URL,
  'https://mainnet.base.org',
  'https://base-rpc.publicnode.com',
  'https://base.drpc.org',
].filter(Boolean) as string[];

const baseWsRpcs = [
  import.meta.env.VITE_WS_RPC_URL,
  'wss://base-rpc.publicnode.com',
].filter(Boolean) as string[];

const baseSepoliaHttpRpcs = [
  import.meta.env.VITE_HTTPS_RPC_URL,
  'https://base-sepolia-rpc.publicnode.com',
  'https://sepolia.base.org',
  'https://base-sepolia.drpc.org',
].filter(Boolean) as string[];

const baseSepoliaWsRpcs = [
  import.meta.env.VITE_WS_RPC_URL,
  'wss://base-sepolia-rpc.publicnode.com',
].filter(Boolean) as string[];

export const base = {
  name: 'Base',
  id: 8453,
  network: 'Base',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: {
      http: baseHttpRpcs,
      webSocket: baseWsRpcs,
    },
    public: {
      http: baseHttpRpcs,
      webSocket: baseWsRpcs,
    },
  },
  blockExplorers: {
    default: {
      name: 'BaseScan',
      url: 'https://basescan.org',
    },
  },
};

export const baseSepolia = {
  name: 'Base Sepolia',
  id: 84532,
  network: 'Base Sepolia',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: {
      http: baseSepoliaHttpRpcs,
      webSocket: baseSepoliaWsRpcs,
    },
    public: {
      http: baseSepoliaHttpRpcs,
      webSocket: baseSepoliaWsRpcs,
    },
  },
  blockExplorers: {
    default: {
      name: 'Base Sepolia',
      url: 'https://sepolia-explorer.base.org',
    },
  },
};

export const pyrope = {
  name: 'Pyrope',
  id: 695569,
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: {
      http: [
        import.meta.env.VITE_HTTPS_RPC_URL || 'https://rpc.pyropechain.com',
      ],
      webSocket: [
        import.meta.env.VITE_WS_RPC_URL || 'wss://rpc.pyropechain.com',
      ],
    },
    public: {
      http: [
        import.meta.env.VITE_HTTPS_RPC_URL || 'https://rpc.pyropechain.com',
      ],
      webSocket: [
        import.meta.env.VITE_WS_RPC_URL || 'wss://rpc.pyropechain.com',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Pyrope Explorer',
      url: 'https://explorer.pyropechain.com',
    },
  },
};

const POSSIBLE_SUPPORTED_CHAINS = [base, baseSepolia, garnet, mudFoundry, pyrope];

const getSupportedChains = () => {
  // Get the chain ID from environment or use 31337 (Anvil) as default for development
  const chainId = import.meta.env.VITE_CHAIN_ID
    ? Number(import.meta.env.VITE_CHAIN_ID)
    : 31337;

  if (import.meta.env.DEV) {
    return POSSIBLE_SUPPORTED_CHAINS.filter(chain => chain.id === chainId);
  }

  const prodChainId = Number(import.meta.env.VITE_CHAIN_ID);
  if (prodChainId === base.id) return [base];
  if (prodChainId === baseSepolia.id) return [baseSepolia];
  if (prodChainId === pyrope.id) return [pyrope];
  return [garnet];
};

/*
 * See https://mud.dev/tutorials/minimal/deploy#run-the-user-interface
 * for instructions on how to add networks.
 */
export const supportedChains: MUDChain[] = getSupportedChains();
