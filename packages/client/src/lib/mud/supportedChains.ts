/*
 * The supported chains.
 */

import { MUDChain } from '@latticexyz/common/chains';

// ORDER MATTERS — viem ranks fallbacks by array position.
// Primary: rpc.ultimatedominion.com (our node). Fallback: Alchemy.
// NEVER add free public RPCs (publicnode, drpc, mainnet.base.org) —
// they poison viem's fallback ranking with stale reads and 500s.
const baseHttpRpcs = [
  import.meta.env.VITE_HTTPS_RPC_URL,     // primary: our node
  import.meta.env.VITE_HTTPS_RPC_FALLBACK_URL,  // fallback: alchemy
].filter(Boolean) as string[];

const baseWsRpcs = [
  import.meta.env.VITE_WS_RPC_URL,        // primary: our node
  import.meta.env.VITE_WS_RPC_FALLBACK_URL,     // fallback: alchemy
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
