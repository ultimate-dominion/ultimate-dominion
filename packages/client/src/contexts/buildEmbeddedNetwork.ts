import { type NetworkResult } from '../lib/mud/setup';

export function buildEmbeddedNetwork(
  baseNetwork: NetworkResult,
  walletClient: NetworkResult['walletClient'],
  worldContract: NetworkResult['worldContract'],
  write$: NetworkResult['write$'],
): NetworkResult {
  return {
    ...baseNetwork,
    walletClient,
    worldContract,
    write$,
  };
}
