/*
 * The supported chains.
 */

import { MUDChain } from '@latticexyz/common/chains';

// Primary RPC from env, then dedicated fallback, then public fallbacks
const baseHttpRpcs = [
  import.meta.env.VITE_HTTPS_RPC_URL,
  import.meta.env.VITE_HTTPS_RPC_FALLBACK_URL,
  'https://base.drpc.org',
  'https://mainnet.base.org',
].filter(Boolean) as string[];

const baseWsRpcs = [
  import.meta.env.VITE_WS_RPC_URL,
  import.meta.env.VITE_WS_RPC_FALLBACK_URL,
  'wss://base.drpc.org',
  'wss://base-rpc.publicnode.com',
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

/*
 * See https://mud.dev/tutorials/minimal/deploy#run-the-user-interface
 * for instructions on how to add networks.
 */
export const supportedChains: MUDChain[] = [base];
