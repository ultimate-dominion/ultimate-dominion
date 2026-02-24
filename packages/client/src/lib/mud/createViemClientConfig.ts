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
 */
export function createViemClientConfig(chain: MUDChain): {
  readonly chain: MUDChain;
  readonly transport: FallbackTransport;
  readonly pollingInterval: 4000;
} {
  return {
    chain,
    transport: transportObserver(fallback([webSocket(), http()])),
    pollingInterval: 4000,
  } as const satisfies ClientConfig;
}
