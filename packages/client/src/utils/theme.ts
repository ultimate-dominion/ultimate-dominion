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
const Progress = {
  baseStyle: {
    track: {
      borderRadius: 5,
    },
    filledTrack: {
      bg: 'black',
    },
  },
};
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
const Progress = {
  baseStyle: {
    track: {
      borderRadius: 5,
    },
    filledTrack: {
      bg: 'black',
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
    lg: {
      fontSize: '18px',
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
    grey300: '#E6E6E6',
    grey400: '#D1D1D1',
    grey500: '#808080',
    white: '#fff',
  },
  components: {
    Button,
    Heading,
    Input,
    Progress,
    Text,
    Textarea,
  },
});
