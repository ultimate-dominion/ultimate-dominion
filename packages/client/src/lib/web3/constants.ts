import { anvil, baseSepolia, Chain } from 'wagmi/chains';

export const WALLET_CONNECT_PROJECT_ID = import.meta.env
  .VITE_WALLET_CONNECT_PROJECT_ID;

const getSupportedChains = () => {
  if (import.meta.env.DEV) {
    return [anvil] as const;
  }

  return [baseSepolia] as const;
};

export const SUPPORTED_CHAINS: readonly [Chain, ...Chain[]] =
  getSupportedChains();

const validateConfig = () => {
  if (!WALLET_CONNECT_PROJECT_ID) {
    throw new Error('VITE_WALLET_CONNECT_PROJECT_ID is not set');
  }
};

validateConfig();
