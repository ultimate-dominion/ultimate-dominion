import { extendTheme } from '@chakra-ui/react';
import { css } from '@emotion/react';

export const globalStyles = css`
  body {
    background: #fff;
    color: #000;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 1rem;
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
      p: 6,
      _hover: {
        bg: 'rgba(0, 0, 0, 0.8)',
      },
      _active: {
        bg: 'rgba(0, 0, 0, 0.7)',
      },
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
  },
});
