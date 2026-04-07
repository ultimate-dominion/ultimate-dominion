// Local imports
import { base } from '../mud/supportedChains';

import { Chain } from 'wagmi/chains';

export const CHAIN_NAME_TO_ID: { [key: string]: number } = {
  Base: base.id,
};

export const CHAIN_ID_TO_LABEL: { [key: number]: string } = {
  [base.id]: 'Base',
};

export const EXPLORER_URLS: { [key: number]: string } = {
  [base.id]: base.blockExplorers.default.url,
};

export const DEFAULT_CHAIN_ID = import.meta.env.VITE_CHAIN_ID
  ? Number(import.meta.env.VITE_CHAIN_ID)
  : 8453;

const getSupportedChains = (): readonly [Chain, ...Chain[]] => {
  return [base as unknown as Chain] as const;
};

export const SUPPORTED_CHAINS: readonly [Chain, ...Chain[]] =
  getSupportedChains();

const validateConfig = () => {
  SUPPORTED_CHAINS.forEach(chain => {
    if (!CHAIN_ID_TO_LABEL[chain.id]) {
      throw new Error(`CHAIN_ID_TO_LABEL[${chain.id}] is not set`);
    }

    if (
      !CHAIN_NAME_TO_ID[CHAIN_ID_TO_LABEL[chain.id]] ||
      CHAIN_NAME_TO_ID[CHAIN_ID_TO_LABEL[chain.id]] !== chain.id
    ) {
      throw new Error(
        `CHAIN_NAME_TO_ID[${
          CHAIN_ID_TO_LABEL[chain.id]
        }] is not set or does not match ${chain.id}`,
      );
    }
  });
};

validateConfig();
