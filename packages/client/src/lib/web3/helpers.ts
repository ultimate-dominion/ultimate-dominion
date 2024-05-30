import {
  CHAIN_ID_TO_LABEL,
  CHAIN_NAME_TO_ID,
  SUPPORTED_CHAINS,
} from './constants';

export const isSupportedChain = (
  chainId: number | string | bigint | undefined,
): boolean =>
  chainId !== undefined &&
  SUPPORTED_CHAINS.find(c => c.id === Number(chainId)) !== undefined;

export const getChainIdFromName = (chainLabel: string): number | undefined => {
  const chainId = CHAIN_NAME_TO_ID[chainLabel];
  if (!chainId || !isSupportedChain(chainId)) {
    return undefined;
  }
  return chainId;
};

export const getChainNameFromId = (chainId: number): string | undefined => {
  if (!chainId || !isSupportedChain(chainId)) {
    return undefined;
  }

  return CHAIN_ID_TO_LABEL[chainId];
};
