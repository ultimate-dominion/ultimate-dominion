import '@fontsource/fira-code';

import { extendTheme } from '@chakra-ui/react';
import { css } from '@emotion/react';

export const globalStyles = css`
  body {
    background: #a2a9b0;
    color: #000;
    font-family: 'Fira Code', monospace;
    font-size: 1rem;
  }
`;

const Button = {
  baseStyle: {
    borderRadius: '12px',
    fontWeight: 500,
  },
  defaultProps: {
    variant: 'solid',
  },
  sizes: {
    sm: {
      p: 5,
    },
    md: {
      px: 14,
      py: 5,
    },
  },
  variants: {
    dark: {
      bg: 'grey500',
      border: '2px solid',
      borderColor: 'grey500',
      borderRadius: '8px',
      boxShadow: '-10px -10px 20px 0px #54545440, 5px 5px 10px 0px #54545480',
      color: 'white',
      _active: {
        bg: 'rgba(0, 0, 0, 0.8)',
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
      bg: 'blue400',
      border: '2px solid',
      borderColor: 'blue400',
      borderRadius: '8px',
      boxShadow:
        '2px 2px 5px rgba(0, 0, 0, 0.3), inset 0 0 10px rgba(0, 0, 255, 0.5)',
      color: 'white',
      _active: {
        bg: 'blue300',
        _disabled: {
          bg: 'rgba(0, 0, 0, 0.7)',
        },
      },
      _hover: {
        bg: 'blue300',
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
    lg: {
      fontSize: '48px',
    },
  },
};

const Input = {
  variants: {
    outline: {
      field: {
        border: '2px solid',
        borderColor: 'transparent',
        borderRadius: '8px',
        boxShadow:
          '-5px -5px 10px 0px #54545440 inset, 5px 5px 10px 0px #A6A6A680 inset, 2px 2px 4px 0px #18161640 inset, -2px -2px 4px 0px #A2A9B080 inset',
        py: 5,
        _active: {
          borderColor: 'blue400',
        },
        _focus: {
          borderColor: 'blue400',
        },
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
      bgColor: '#B3B9BE',
      clipPath:
        'polygon(40px 0%, 100% 0%, 100% calc(100% - 50px), calc(100% - 50px) 100%, 0% 100%, 0% 80px)',
      maxH: 'calc(100% - 7.5rem)',
      minW: { base: '100%', md: '500px' },
      maxW: { base: '100%', md: '500px' },
      position: 'absolute',
    },
    body: {
      overflow: 'auto',
      pb: 8,
      px: 8,
    },
    footer: {
      borderTop: '1px solid',
      display: 'flex',
      justifyContent: 'center',
      p: 4,
    },
    header: {
      color: '#283570',
      fontWeight: 700,
      px: 4,
      py: 8,
      textAlign: 'center',
    },
  },
};

const Progress = {
  baseStyle: {
    track: {
      borderRadius: 5,
    },
    filledTrack: {
      transition: 'width 0.5s',
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
    maxed: {
      filledTrack: {
        bg: 'purple',
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

const Select = {
  variants: {
    outline: {
      field: {
        border: '2px solid',
        borderColor: 'grey',
        borderRadius: '5px',
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
      borderColor: 'transparent',
      borderRadius: '5px',
      boxShadow:
        '-5px -5px 10px 0px #54545440 inset, 5px 5px 10px 0px #A6A6A680 inset, 2px 2px 4px 0px #18161640 inset, -2px -2px 4px 0px #A2A9B080 inset',
      _active: {
        borderColor: 'blue400',
      },
      _focus: {
        borderColor: 'blue400',
      },
    },
  },
};

const Tooltip = {
  baseStyle: {
    bg: 'black',
    borderRadius: 0,
    color: 'white',
    p: 4,
  },
};

export const theme = extendTheme({
  config: { initialColorMode: 'light', useSystemColorMode: false },
  fonts: {
    body: `'Fira Code', monospace`,
    heading: `'Fira Code', monospace`,
  },
  colors: {
    black: '#000',
    blue300: '#1633B6',
    blue400: '#0A2187',
    blue500: '#131832',
    green: '#008F07',
    grey100: '#D0D0D0',
    grey200: '#A8ADB2',
    grey300: '#A2A9B0',
    grey400: '#7E848A',
    grey500: '#3D4247',
    red: '#AF0D08',
    white: '#fff',
    yellow: '#EFD31C',
  },
  components: {
    Button,
    Heading,
    Input,
    Modal,
    Progress,
    Select,
    Text,
    Textarea,
    Tooltip,
  },
});
