import '@fontsource/ibm-plex-mono';

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
  sizes: {
    sm: {
      p: 5,
    },
    md: {
      px: 10,
      py: 6,
    },
  },
  variants: {
    gold: {
      bg: 'gold',
      border: '2px solid',
      borderColor: 'black',
      color: 'black',
      _active: {
        bg: 'rgba(0, 0, 0, 1)',
        color: 'white',
        _disabled: {
          bg: 'rgba(0, 0, 0, 0.7)',
        },
      },
      _hover: {
        bg: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        _disabled: {
          bg: 'rgba(0, 0, 0, 0.7)',
        },
      },
      _loading: {
        bg: 'rgba(0, 0, 0, 0.8)',
        _hover: {
          bg: 'rgba(0, 0, 0, 0.8)',
        },
      },
    },
    outline: {
      border: '2px solid',
      borderColor: 'grey500',
    },
    solid: {
      bg: 'black',
      border: '2px solid',
      borderColor: 'black',
      color: 'white',
      _active: {
        bg: 'rgba(0, 0, 0, 1)',
        _disabled: {
          bg: 'rgba(0, 0, 0, 0.7)',
        },
      },
      _hover: {
        bg: 'rgba(0, 0, 0, 0.8)',
        _disabled: {
          bg: 'rgba(0, 0, 0, 0.7)',
        },
      },
      _loading: {
        bg: 'rgba(0, 0, 0, 0.8)',
        _hover: {
          bg: 'rgba(0, 0, 0, 0.8)',
        },
      },
    },
  },
};

const Heading = {
  defaultProps: {
    size: 'md',
  },
  sizes: {
    sm: {
      fontSize: '18px',
    },
    md: {
      fontSize: '24px',
    },
  },
};

const Input = {
  variants: {
    outline: {
      field: {
        border: '2px solid',
        borderColor: 'grey',
        borderRadius: '5px',
        py: 5,
      },
    },
  },
};

const Modal = {
  defaultProps: {
    scrollBehavior: 'inside',
  },
  baseStyle: {
    dialogContainer: {
      overflow: 'hidden',
    },
    dialog: {
      maxH: { base: '100%', md: 'calc(100% - 7.5rem)' },
      minW: { base: '100%', md: '500px' },
      maxW: { base: '100%', md: '500px' },
    },
    body: {
      overflow: 'auto',
    },
    footer: {
      borderTop: '1px solid',
      display: 'flex',
      justifyContent: 'center',
    },
  },
};

const Progress = {
  baseStyle: {
    track: {
      borderRadius: 5,
    },
  },
  defaultProps: {
    variant: 'filling',
  },
  variants: {
    filling: {
      filledTrack: {
        bg: 'black',
      },
    },
    filled: {
      filledTrack: {
        bg: 'green',
      },
    },
    timer: {
      filledTrack: {
        bg: 'blue',
      },
      track: {
        borderRadius: 0,
      },
    },
  },
};

const Text = {
  sizes: {
    '4xs': {
      fontSize: '6px',
    },
    '3xs': {
      fontSize: '8px',
    },
    '2xs': {
      fontSize: '10px',
    },
    xs: {
      fontSize: '12px',
    },
    sm: {
      fontSize: '14px',
    },
    md: {
      fontSize: '16px',
    },
    lg: {
      fontSize: '18px',
    },
    xl: {
      fontSize: '24px',
    },
    '2xl': {
      fontSize: '32px',
    },
  },
};

const Textarea = {
  variants: {
    outline: {
      border: '2px solid',
      borderColor: 'grey',
      borderRadius: '5px',
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
    blue: '#0B5ED7',
    green: '#0BA789',
    grey300: '#E6E6E6',
    grey400: '#D1D1D1',
    grey500: '#808080',
    red: '#F24725',
    white: '#fff',
    yellow: '#F9C712',
  },
  components: {
    Button,
    Heading,
    Input,
    Modal,
    Progress,
    Text,
    Textarea,
  },
});
