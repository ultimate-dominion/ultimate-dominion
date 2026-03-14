import { transportObserver } from '@latticexyz/common';
import { type MUDChain } from '@latticexyz/common/chains';
import {
  type ClientConfig,
  fallback,
  FallbackTransport,
  http,
  webSocket,
} from 'viem';

/*
 * Create a viem public (read only) client
 * (https://viem.sh/docs/clients/public.html)
 *
 * Builds a fallback transport from all RPC URLs defined on the chain.
 * HTTP first for reliability (receipt polling, gas estimation), then WS.
 * The game's real-time updates use the indexer WS, not viem's transport.
 */
export function createViemClientConfig(chain: MUDChain): {
  readonly chain: MUDChain;
  readonly transport: FallbackTransport;
  readonly pollingInterval: 250;
} {
  const wsUrls = chain.rpcUrls?.default?.webSocket ?? [];
  const httpUrls = chain.rpcUrls?.default?.http ?? [];

  // HTTP first — more reliable for request/response patterns (receipt polling,
  // gas estimation, contract reads). WS can hang if the endpoint is unreachable
  // or returns 403, blocking the fallback chain.
  const transports = [
    ...httpUrls.map(url => http(url, { retryCount: 2, timeout: 10_000 })),
    ...wsUrls.map(url => webSocket(url, { retryCount: 0, timeout: 5_000 })),
  ];

  return {
    chain,
    transport: transportObserver(fallback(transports.length > 0 ? transports : [http()])),
    pollingInterval: 250,
  } as const satisfies ClientConfig;
}
