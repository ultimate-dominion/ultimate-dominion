/*
 * Simplified setup: no RECS components, no client component wrapping.
 * System calls read from the Zustand game store.
 */

import { createSystemCalls } from './createSystemCalls';
import { setupNetwork } from './setupNetwork';

export type NetworkResult = Awaited<ReturnType<typeof setupNetwork>>;
export type SystemCallsResult = ReturnType<typeof createSystemCalls>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function setup() {
  const network = await setupNetwork();
  const systemCalls = createSystemCalls(network);

  return {
    network,
    systemCalls,
  };
}
