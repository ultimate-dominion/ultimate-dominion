// Polyfill Node.js globals for browser — required by Privy embedded wallet SDK
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
(globalThis as any).global = globalThis;

import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/fira-code/300.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import '@fontsource/fira-code/600.css';
import '@fontsource/fira-code/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import React, { useEffect, useState } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { Global } from '@emotion/react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';

import { PrivyProvider } from '@privy-io/react-auth';

import { initErrorReporter } from './utils/errorReporter';
import { initMetrics } from './utils/metricsReporter';
import { base } from './lib/mud/supportedChains';
import { globalStyles, theme } from './utils/theme';

// Initialize error reporting and metrics before anything else
initErrorReporter();
initMetrics();

const rootElement = document.getElementById('react-root');
if (!rootElement) throw new Error('React root not found');
const root = createRoot(rootElement);

const isGameLive = import.meta.env.VITE_GAME_LIVE === 'true';
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID || '';

const privyConfig = {
  loginMethods: ['google'] as const,
  appearance: { theme: 'dark' as const },
  embeddedWallets: {
    createOnLogin: 'users-without-wallets' as const,
    requireUserPasswordOnCreate: false,
    showWalletUIs: false,
  },
  defaultChain: base,
  supportedChains: [base],
};

if (isGameLive) {
  // Render PrivyProvider immediately so it can catch OAuth callback params on redirect.
  // The rest of the app loads lazily inside it.
  const LazyApp = () => {
    const [tree, setTree] = useState<React.ReactNode>(null);

    useEffect(() => {
      Promise.all([
        import('./App'),
        import('./contexts/AllowanceContext'),
        import('./contexts/AuthContext'),
        import('./contexts/CharacterContext'),
        import('./contexts/ItemsContext'),
        import('./contexts/MonstersContext'),
        import('./contexts/MUDContext'),
        import('./contexts/OrdersContext'),
        import('./contexts/Web3Provider'),
        import('./lib/gameStore'),
        import('./lib/mud/setup'),
      ]).then(([
        { App },
        { AllowanceProvider },
        { AuthProvider },
        { CharacterProvider },
        { ItemsProvider },
        { MonstersProvider },
        { MUDProvider },
        { OrdersProvider },
        { Web3Provider },
        { GameStoreProvider },
        { setup },
      ]) => {
        const setupPromise = setup();
        setTree(
          <Web3Provider>
          <AuthProvider>
          <GameStoreProvider>
            <MUDProvider setupPromise={setupPromise}>
              <ItemsProvider>
                <MonstersProvider>
                  <OrdersProvider>
                    <CharacterProvider>
                      <AllowanceProvider>
                        <App />
                      </AllowanceProvider>
                    </CharacterProvider>
                  </OrdersProvider>
                </MonstersProvider>
              </ItemsProvider>
            </MUDProvider>
          </GameStoreProvider>
          </AuthProvider>
          </Web3Provider>,
        );
      });
    }, []);

    return <>{tree}</>;
  };

  root.render(
    <HelmetProvider>
      <ChakraProvider resetCSS theme={theme}>
        <Global styles={globalStyles} />
        <PrivyProvider appId={privyAppId} config={privyConfig}>
          <LazyApp />
        </PrivyProvider>
      </ChakraProvider>
    </HelmetProvider>,
  );
} else {
  // Placeholder / landing page — no MUD, no Web3, no chain connection
  import('./PlaceholderApp').then(({ PlaceholderApp }) => {
    root.render(
      <HelmetProvider>
        <ChakraProvider resetCSS theme={theme}>
          <Global styles={globalStyles} />
          <PlaceholderApp />
        </ChakraProvider>
      </HelmetProvider>,
    );
  });
}
