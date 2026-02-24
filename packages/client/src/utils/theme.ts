import '@fontsource/fira-code';

import { extendTheme } from '@chakra-ui/react';
import { css } from '@emotion/react';

export const globalStyles = css`
  body {
    background: #a2a9b0;
    color: #000;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1rem;
  }
`;

const Button = {
  baseStyle: {
    borderRadius: '12px',
    fontWeight: 500,
    _focusVisible: {
      boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.6)',
      outline: 'none',
    },
  },
  defaultProps: {
    variant: 'blue',
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
      bg: 'yellow',
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
      bg: 'white',
    },
    blue: {
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
    white: {
      bg: 'white',
      borderRadius: '8px',
      boxShadow: '-10px -10px 20px 0px #54545440, 5px 5px 10px 0px #54545480',
      color: 'black',
      _active: {
        bg: 'grey500',
        color: 'white',
        svg: {
          fill: 'white',
        },
        _disabled: {
          bg: 'rgba(0, 0, 0, 0.7)',
        },
      },
      _hover: {
        bg: 'grey500',
        color: 'white',
        svg: {
          fill: 'white',
        },
        _disabled: {
          bg: 'rgba(0, 0, 0, 0.7)',
        },
      },
      _loading: {
        bg: 'grey500',
        color: 'white',
        _hover: {
          bg: 'grey500',
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
    closeButton: {
      right: 5,
      top: 4,
    },
    dialogContainer: {
      overflow: 'hidden',
    },
    dialog: {
      bgColor: '#B3B9BE',
      borderRadius: { base: 0, md: 'lg' },
      clipPath:
        'polygon(40px 0%, 100% 0%, 100% calc(100% - 50px), calc(100% - 50px) 100%, 0% 100%, 0% 80px)',
      m: { base: 0, md: 'auto' },
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
      borderTop: '1px #1A244E solid',
      display: 'flex',
      justifyContent: 'center',
      pb: 6,
      pt: 4,
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
      bg: '#6363634D',
      boxShadow:
        '-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset',
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
        bg: '#283570',
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
        borderColor: 'white',
        borderRadius: '5px',
      },
    },
  },
};

const Tabs = {
  defaultProps: {
    variant: 'line',
  },
  variants: {
    line: {
      tab: {
        _selected: {
          color: 'blue400',
        },
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
    bg: '#070D2A',
    borderRadius: 0,
    clipPath: 'polygon(0% 0%, 93% 0%, 100% 18%, 100% 100%, 10% 100%, 0% 90%);',
    color: 'white',
    p: 4,
  },
};

export const theme = extendTheme({
  config: { initialColorMode: 'light', useSystemColorMode: false },
  fonts: {
    body: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`,
    heading: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`,
    mono: `'Fira Code', monospace`,
  },
  colors: {
    black: '#000',
    blue300: '#1633B6',
    blue400: '#0A2187',
    blue500: '#0C1539',
    blue600: '#131832',
    green: '#008F07',
    grey100: '#D0D0D0',
    grey200: '#A8ADB2',
    grey300: '#A2A9B0',
    grey400: '#7E848A',
    grey500: '#3D4247',
    red: '#AF0D08',
    white: '#fff',
    yellow: '#EFD31C',
    // Rarity colors
    rarityWorn: '#9d9d9d',
    rarityCommon: '#ffffff',
    rarityUncommon: '#1eff00',
    rarityRare: '#0070dd',
    rarityEpic: '#a335ee',
    rarityLegendary: '#ff8000',
  },
  semanticTokens: {
    colors: {
      'bg.primary': {
        default: '#B3B9BE',
        _dark: '#1a1a2e',
      },
      'bg.secondary': {
        default: '#A2A9B0',
        _dark: '#16213e',
      },
      'bg.card': {
        default: '#B3B9BE',
        _dark: '#0f3460',
      },
      'text.primary': {
        default: '#000',
        _dark: '#e0e0e0',
      },
      'text.secondary': {
        default: '#3D4247',
        _dark: '#a0a0b0',
      },
      'border.primary': {
        default: '#1A244E',
        _dark: '#2a2a4e',
      },
      'border.accent': {
        default: '#3B82C4',
        _dark: '#4a6fa5',
      },
    },
  },
  components: {
    Button,
    Heading,
    Input,
    Modal,
    Progress,
    Select,
    Tabs,
    Text,
    Textarea,
    Tooltip,
  },
});
