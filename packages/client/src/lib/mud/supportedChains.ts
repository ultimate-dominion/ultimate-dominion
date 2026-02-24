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

export const baseSepolia = {
  name: 'Base Sepolia',
  id: 84532,
  network: 'Base Sepolia',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_HTTPS_RPC_URL],
      webSocket: [import.meta.env.VITE_WS_RPC_URL],
    },
    public: {
      http: [import.meta.env.VITE_HTTPS_RPC_URL],
      webSocket: [import.meta.env.VITE_WS_RPC_URL],
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

const POSSIBLE_SUPPORTED_CHAINS = [baseSepolia, garnet, mudFoundry, pyrope];

const getSupportedChains = () => {
  // Get the chain ID from environment or use 31337 (Anvil) as default for development
  const chainId = import.meta.env.VITE_CHAIN_ID
    ? Number(import.meta.env.VITE_CHAIN_ID)
    : 31337;

  // Filter to the chain matching the configured chain ID
  const matched = POSSIBLE_SUPPORTED_CHAINS.filter(chain => chain.id === chainId);
  if (matched.length > 0) return matched;

  // Fallback for production if no match
  return [baseSepolia];
};

/*
 * See https://mud.dev/tutorials/minimal/deploy#run-the-user-interface
 * for instructions on how to add networks.
 */
export const supportedChains: MUDChain[] = getSupportedChains();
