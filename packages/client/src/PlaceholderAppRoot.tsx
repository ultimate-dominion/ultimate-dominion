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

import { PlaceholderApp } from './PlaceholderApp';
import { globalStyles, theme } from './utils/theme';

const PlaceholderAppRoot = (): JSX.Element => (
  <HelmetProvider>
    <ChakraProvider resetCSS theme={theme}>
      <Global styles={globalStyles} />
      <PlaceholderApp />
    </ChakraProvider>
  </HelmetProvider>
);

export default PlaceholderAppRoot;
