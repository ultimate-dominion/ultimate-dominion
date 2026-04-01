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
import { ChakraProvider } from '@chakra-ui/react';
import { Global } from '@emotion/react';
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
import { base } from './lib/mud/supportedChains';
import { globalStyles, theme } from './utils/theme';

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

const setupPromise = import('./lib/mud/setup').then(({ setup }) => setup());

const GameAppRoot = (): JSX.Element => (
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
  </HelmetProvider>
);

export default GameAppRoot;
