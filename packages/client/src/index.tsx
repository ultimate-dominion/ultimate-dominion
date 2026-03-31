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
// CJK fonts loaded conditionally per locale (saves ~10MB for non-CJK users)
import i18n from './i18n';

function loadCjkFont(lang: string) {
  const code = lang?.substring(0, 2);
  if (code === 'ko') {
    import('@fontsource/noto-sans-kr/400.css');
    import('@fontsource/noto-sans-kr/500.css');
    import('@fontsource/noto-sans-kr/700.css');
  } else if (code === 'ja') {
    import('@fontsource/noto-sans-jp/400.css');
    import('@fontsource/noto-sans-jp/500.css');
    import('@fontsource/noto-sans-jp/700.css');
  } else if (code === 'zh') {
    import('@fontsource/noto-sans-sc/400.css');
    import('@fontsource/noto-sans-sc/500.css');
    import('@fontsource/noto-sans-sc/700.css');
  }
}

loadCjkFont(i18n.language);
i18n.on('languageChanged', loadCjkFont);

import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { Global } from '@emotion/react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';

import { PrivyProvider } from '@privy-io/react-auth';

import { App } from './App';
import { AllowanceProvider } from './contexts/AllowanceContext';
import { AuthProvider } from './contexts/AuthContext';
import { CharacterProvider } from './contexts/CharacterContext';
import { ItemsProvider } from './contexts/ItemsContext';
import { MonstersProvider } from './contexts/MonstersContext';
import { MUDProvider } from './contexts/MUDContext';
import { OrdersProvider } from './contexts/OrdersContext';
import { Web3Provider } from './contexts/Web3Provider';
import { GameStoreProvider } from './lib/gameStore';
import { setup } from './lib/mud/setup';
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
    createOnLogin: 'off' as const,
    requireUserPasswordOnCreate: false,
    showWalletUIs: false,
  },
  defaultChain: base,
  supportedChains: [base],
};

if (isGameLive) {
  // Start setup immediately at module level — resolves in background while React renders.
  const setupPromise = setup();

  root.render(
    <HelmetProvider>
      <ChakraProvider resetCSS theme={theme}>
        <Global styles={globalStyles} />
        <PrivyProvider appId={privyAppId} config={privyConfig}>
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
          </Web3Provider>
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
