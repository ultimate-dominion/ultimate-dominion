import '@fontsource/fira-code/300.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import '@fontsource/fira-code/600.css';
import '@fontsource/fira-code/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@rainbow-me/rainbowkit/styles.css';

import { ChakraProvider } from '@chakra-ui/react';
import { Global } from '@emotion/react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { DevTools } from './components/DevTools';
import { AllowanceProvider } from './contexts/AllowanceContext';
import { AuthProvider } from './contexts/AuthContext';
import { CharacterProvider } from './contexts/CharacterContext';
import { ItemsProvider } from './contexts/ItemsContext';
import { MonstersProvider } from './contexts/MonstersContext';
import { MUDProvider } from './contexts/MUDContext';
import { OrdersProvider } from './contexts/OrdersContext';
import { Web3Provider } from './contexts/Web3Provider';
import { setup } from './lib/mud/setup';
import { globalStyles, theme } from './utils/theme';

const rootElement = document.getElementById('react-root');
if (!rootElement) throw new Error('React root not found');
const root = createRoot(rootElement);

// TODO: figure out if we actually want this to be async or if we should render something else in the meantime
setup().then(async result => {
  root.render(
    <ChakraProvider resetCSS theme={theme}>
      <Global styles={globalStyles} />
      <Web3Provider>
        <AuthProvider>
          <MUDProvider setupResult={result}>
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
            {/* DevTools temporarily disabled - causes error with undefined table values */}
            {/* {import.meta.env.DEV && <DevTools />} */}
          </MUDProvider>
        </AuthProvider>
      </Web3Provider>
    </ChakraProvider>,
  );
});
