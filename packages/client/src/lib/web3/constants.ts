// Third-party imports
import { garnet } from '@latticexyz/common/chains';
import { anvil, baseSepolia, Chain } from 'wagmi/chains';

// Local imports
import { pyrope } from '../mud/supportedChains';

export const WALLET_CONNECT_PROJECT_ID = import.meta.env
  .VITE_WALLET_CONNECT_PROJECT_ID;

export const CHAIN_NAME_TO_ID: { [key: string]: number } = {
  Anvil: anvil.id,
  'Base Sepolia': baseSepolia.id,
  'Garnet Holesky': garnet.id,
  Pyrope: pyrope.id,
};

export const CHAIN_ID_TO_LABEL: { [key: number]: string } = {
  [anvil.id]: 'Anvil',
  [baseSepolia.id]: 'Base Sepolia',
  [garnet.id]: 'Garnet Holesky',
  [pyrope.id]: 'Pyrope',
};

export const EXPLORER_URLS: { [key: number]: string } = {
  [garnet.id]: garnet.blockExplorers.default.url,
  [pyrope.id]: pyrope.blockExplorers.default.url,
};

const POSSIBLE_SUPPORTED_CHAINS = [baseSepolia, garnet, anvil, pyrope];

export const DEFAULT_CHAIN_ID = import.meta.env.VITE_CHAIN_ID
  ? Number(import.meta.env.VITE_CHAIN_ID)
  : 31337;

const getSupportedChains = (): readonly [Chain, ...Chain[]] => {
  if (import.meta.env.DEV) {
    return POSSIBLE_SUPPORTED_CHAINS.filter(
      chain => chain.id === DEFAULT_CHAIN_ID,
    ) as unknown as [Chain];
  }

  return [
    Number(import.meta.env.VITE_CHAIN_ID) === pyrope.id ? pyrope : garnet,
  ] as const;
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
