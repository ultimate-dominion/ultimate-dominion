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
 * Builds a fallback transport from all RPC URLs defined on the chain,
 * trying WebSocket first, then each HTTP endpoint in order.
 */
export function createViemClientConfig(chain: MUDChain): {
  readonly chain: MUDChain;
  readonly transport: FallbackTransport;
  readonly pollingInterval: 500;
} {
  const wsUrls = chain.rpcUrls?.default?.webSocket ?? [];
  const httpUrls = chain.rpcUrls?.default?.http ?? [];

  const transports = [
    ...wsUrls.map(url => webSocket(url, { retryCount: 2 })),
    ...httpUrls.map(url => http(url, { retryCount: 2, timeout: 10_000 })),
  ];

  return {
    chain,
    transport: transportObserver(fallback(transports.length > 0 ? transports : [http()])),
    pollingInterval: 200,
  } as const satisfies ClientConfig;
}
