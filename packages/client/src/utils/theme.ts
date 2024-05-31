import '@fontsource/ibm-plex-mono';

import { extendTheme } from '@chakra-ui/react';
import { css } from '@emotion/react';

export const globalStyles = css`
  html,
  #react-root,
  #react-root:first-child {
    height: 100%;
  }
  body {
    background: #fff;
    color: #000;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 1rem;
    height: 100%;
  }
`;

const Button = {
  baseStyle: {
    borderRadius: 5,
  },
  defaultProps: {
    variant: 'solid',
  },
  variants: {
    solid: {
      bg: 'black',
      color: 'white',
      px: 10,
      py: 6,
      _hover: {
        bg: 'rgba(0, 0, 0, 0.8)',
      },
      _active: {
        bg: 'rgba(0, 0, 0, 0.7)',
      },
    },
  },
};

const Heading = {
  defaultProps: {
    variant: 'primary',
  },
  variants: {
    primary: {
      fontSize: '24px',
    },
  },
};

const Text = {
  sizes: {
    xs: {
      fontSize: '12px',
    },
    sm: {
      fontSize: '14px',
    },
    md: {
      fontSize: '16px',
    },
  },
};

export const theme = extendTheme({
  config: { initialColorMode: 'light', useSystemColorMode: false },
  fonts: {
    body: `'IBM Plex Mono', monospace`,
    heading: `'IBM Plex Mono', monospace`,
  },
  colors: {
    black: '#000',
    white: '#fff',
  },
  components: {
    Button,
    Heading,
    Text,
  },
});
