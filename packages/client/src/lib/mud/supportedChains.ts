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

import { DEFAULT_CHAIN_ID } from '../web3';

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

const POSSIBLE_SUPPORTED_CHAINS = [baseSepolia, garnet, mudFoundry];

const getSupportedChains = () => {
  if (import.meta.env.DEV) {
    return POSSIBLE_SUPPORTED_CHAINS.filter(
      chain => chain.id === DEFAULT_CHAIN_ID,
    );
  }

  return [garnet];
};

/*
 * See https://mud.dev/tutorials/minimal/deploy#run-the-user-interface
 * for instructions on how to add networks.
 */
export const supportedChains: MUDChain[] = getSupportedChains();
