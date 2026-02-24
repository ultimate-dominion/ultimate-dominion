'use client';

import {
  connectorsForWallets,
  darkTheme,
  getDefaultWallets,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http, WagmiProvider } from 'wagmi';

import { SUPPORTED_CHAINS, WALLET_CONNECT_PROJECT_ID } from '../lib/web3';

const { wallets } = getDefaultWallets();

const connectors = connectorsForWallets(wallets, {
  appName: 'Ultimate Dominion',
  projectId: WALLET_CONNECT_PROJECT_ID,
});

const transports = Object.fromEntries(
  SUPPORTED_CHAINS.map(chain => {
    const rpcUrl = chain.rpcUrls?.default?.http?.[0];
    return [chain.id, http(rpcUrl)];
  }),
);

const wagmiConfig = createConfig({
  chains: SUPPORTED_CHAINS,
  connectors,
  transports,
});

const queryClient = new QueryClient();

export const Web3Provider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
