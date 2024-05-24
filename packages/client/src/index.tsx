import '@fontsource/ibm-plex-mono/100.css';
import '@fontsource/ibm-plex-mono/200.css';
import '@fontsource/ibm-plex-mono/300.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-mono/700.css';

import { ChakraProvider } from '@chakra-ui/react';
import { Global } from '@emotion/react';
import mudConfig from 'contracts/mud.config';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { setup } from './mud/setup';
import { MUDProvider } from './MUDContext';
import { globalStyles, theme } from './utils/theme';

const rootElement = document.getElementById('react-root');
if (!rootElement) throw new Error('React root not found');
const root = createRoot(rootElement);

// TODO: figure out if we actually want this to be async or if we should render something else in the meantime
setup().then(async result => {
  root.render(
    <ChakraProvider resetCSS theme={theme}>
      <Global styles={globalStyles} />
      <MUDProvider value={result}>
        <App />
      </MUDProvider>
    </ChakraProvider>,
  );

  // https://vitejs.dev/guide/env-and-mode.html
  if (import.meta.env.DEV) {
    const { mount: mountDevTools } = await import('@latticexyz/dev-tools');
    mountDevTools({
      config: mudConfig,
      publicClient: result.network.publicClient,
      walletClient: result.network.walletClient,
      latestBlock$: result.network.latestBlock$,
      storedBlockLogs$: result.network.storedBlockLogs$,
      worldAddress: result.network.worldContract.address,
      worldAbi: result.network.worldContract.abi,
      write$: result.network.write$,
      recsWorld: result.network.world,
    });
  }
});
