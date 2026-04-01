'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, fallback, http, WagmiProvider } from 'wagmi';
import { injected } from 'wagmi/connectors';

import { SUPPORTED_CHAINS } from '../lib/web3';

const transports = Object.fromEntries(
  SUPPORTED_CHAINS.map(chain => {
    const httpUrls = chain.rpcUrls?.default?.http ?? [];
    const httpTransports = httpUrls.map(url => http(url, { retryCount: 2, timeout: 10_000 }));
    return [chain.id, httpTransports.length > 1 ? fallback(httpTransports) : http(httpUrls[0])];
  }),
);

const wagmiConfig = createConfig({
  chains: SUPPORTED_CHAINS,
  connectors: [injected({ shimDisconnect: true })],
  transports,
});

const queryClient = new QueryClient();

export const Web3Provider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
};
