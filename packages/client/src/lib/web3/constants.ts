import { anvil, baseSepolia, Chain } from 'wagmi/chains';

export const WALLET_CONNECT_PROJECT_ID = import.meta.env
  .VITE_WALLET_CONNECT_PROJECT_ID;

export const CHAIN_NAME_TO_ID: { [key: string]: number } = {
  Anvil: anvil.id,
  'Base Sepolia': baseSepolia.id,
};

export const CHAIN_ID_TO_LABEL: { [key: number]: string } = {
  [anvil.id]: 'Anvil',
  [baseSepolia.id]: 'Base Sepolia',
};

const getSupportedChains = () => {
  if (import.meta.env.DEV) {
    return [anvil, baseSepolia] as const;
  }

  return [baseSepolia] as const;
};

export const SUPPORTED_CHAINS: readonly [Chain, ...Chain[]] =
  getSupportedChains();

const validateConfig = () => {
  if (!WALLET_CONNECT_PROJECT_ID) {
    throw new Error('VITE_WALLET_CONNECT_PROJECT_ID is not set');
  }

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
