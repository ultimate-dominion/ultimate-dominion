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
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';

import { globalStyles, theme } from './utils/theme';

const rootElement = document.getElementById('react-root');
if (!rootElement) throw new Error('React root not found');
const root = createRoot(rootElement);

const isGameLive = import.meta.env.VITE_GAME_LIVE === 'true';

if (isGameLive) {
  // Full game — lazy-import heavy MUD/Web3 dependencies only when needed
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
    { setup },
  ]) => {
    const setupPromise = setup();

    root.render(
      <HelmetProvider>
        <ChakraProvider resetCSS theme={theme}>
          <Global styles={globalStyles} />
          <Web3Provider>
          <AuthProvider>
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
          </AuthProvider>
        </Web3Provider>
      </ChakraProvider>
      </HelmetProvider>,
    );
  });
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
