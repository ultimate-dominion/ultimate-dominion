import '@fontsource/fira-code';

import { extendTheme } from '@chakra-ui/react';
import { css } from '@emotion/react';

// Torchlit Dungeon shadow constants — use in components replacing old neumorphic shadows
export const DARK_INSET_SHADOW =
  '2px 2px 6px rgba(0,0,0,0.5) inset, -1px -1px 3px rgba(60,50,40,0.15) inset';
export const DARK_DIVIDER_SHADOW =
  '0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)';

export const globalStyles = css`
  body {
    background: #12100E;
    color: #C4B89E;
    font-family: 'Cormorant Garamond', 'Inter', Georgia, serif;
    font-size: 1.05rem;
  }

  .game-image {
    filter: sepia(0.15) brightness(0.95);
  }

  .data-dense {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: #14120F;
  }
  ::-webkit-scrollbar-thumb {
    background: #3A3228;
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #4A4238;
  }

  /* Firefox scrollbar */
  * {
    scrollbar-width: thin;
    scrollbar-color: #3A3228 #14120F;
  }
`;

const Button = {
  baseStyle: {
    borderRadius: '12px',
    fontWeight: 500,
    _focusVisible: {
      boxShadow: '0 0 0 3px rgba(200, 122, 42, 0.4)',
      outline: 'none',
    },
  },
  defaultProps: {
    variant: 'amber',
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
    amber: {
      bg: '#C87A2A',
      border: '2px solid',
      borderColor: '#C87A2A',
      borderRadius: '8px',
      boxShadow:
        '2px 2px 5px rgba(0, 0, 0, 0.4), inset 0 0 10px rgba(200, 122, 42, 0.3)',
      color: '#E8DCC8',
      _active: {
        bg: '#A86420',
        _disabled: {
          bg: 'rgba(200, 122, 42, 0.4)',
        },
      },
      _hover: {
        bg: '#E8A840',
        _disabled: {
          bg: 'rgba(200, 122, 42, 0.4)',
        },
      },
      _loading: {
        bg: '#A86420',
        _hover: {
          bg: '#A86420',
        },
      },
    },
    dark: {
      bg: '#14120F',
      border: '2px solid',
      borderColor: '#3A3228',
      borderRadius: '8px',
      boxShadow: '2px 2px 6px rgba(0,0,0,0.4)',
      color: '#E8DCC8',
      _active: {
        bg: '#0A0908',
        _disabled: {
          bg: 'rgba(20, 18, 15, 0.7)',
        },
      },
      _hover: {
        bg: '#2E2820',
        _disabled: {
          bg: 'rgba(20, 18, 15, 0.7)',
        },
      },
      _loading: {
        bg: '#0A0908',
        _hover: {
          bg: '#0A0908',
        },
      },
    },
    gold: {
      bg: '#EFD31C',
      border: '2px solid',
      borderColor: '#3A3228',
      color: '#12100E',
      _active: {
        bg: '#C8B018',
        _disabled: {
          bg: 'rgba(239, 211, 28, 0.4)',
        },
      },
      _hover: {
        bg: '#F8E040',
        _disabled: {
          bg: 'rgba(239, 211, 28, 0.4)',
        },
      },
      _loading: {
        bg: '#C8B018',
        _hover: {
          bg: '#C8B018',
        },
      },
    },
    outline: {
      border: '2px solid',
      borderColor: '#3A3228',
      bg: 'transparent',
      color: '#C4B89E',
      _hover: {
        bg: '#2E2820',
      },
    },
    blue: {
      bg: '#C87A2A',
      border: '2px solid',
      borderColor: '#C87A2A',
      borderRadius: '8px',
      boxShadow:
        '2px 2px 5px rgba(0, 0, 0, 0.4), inset 0 0 10px rgba(200, 122, 42, 0.3)',
      color: '#E8DCC8',
      _active: {
        bg: '#A86420',
        _disabled: {
          bg: 'rgba(200, 122, 42, 0.4)',
        },
      },
      _hover: {
        bg: '#E8A840',
        _disabled: {
          bg: 'rgba(200, 122, 42, 0.4)',
        },
      },
      _loading: {
        bg: '#A86420',
        _hover: {
          bg: '#A86420',
        },
      },
    },
    white: {
      bg: '#24201A',
      borderRadius: '8px',
      boxShadow: '2px 2px 6px rgba(0,0,0,0.4)',
      color: '#E8DCC8',
      _active: {
        bg: '#2E2820',
        _disabled: {
          bg: 'rgba(36, 32, 26, 0.7)',
        },
      },
      _hover: {
        bg: '#2E2820',
        _disabled: {
          bg: 'rgba(36, 32, 26, 0.7)',
        },
      },
      _loading: {
        bg: '#2E2820',
        _hover: {
          bg: '#2E2820',
        },
      },
    },
  },
};

const Heading = {
  baseStyle: {
    color: '#E8DCC8',
  },
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
        bg: '#14120F',
        border: '2px solid',
        borderColor: '#3A3228',
        borderRadius: '8px',
        color: '#E8DCC8',
        py: 5,
        _active: {
          borderColor: '#C87A2A',
        },
        _focus: {
          borderColor: '#C87A2A',
        },
        _placeholder: {
          color: '#8A7E6A',
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
      color: '#8A7E6A',
      right: 5,
      top: 4,
      _hover: {
        color: '#E8DCC8',
      },
    },
    dialogContainer: {
      overflow: 'hidden',
    },
    dialog: {
      bgColor: '#1C1814',
      borderRadius: { base: 0, md: 'lg' },
      clipPath:
        'polygon(40px 0%, 100% 0%, 100% calc(100% - 50px), calc(100% - 50px) 100%, 0% 100%, 0% 80px)',
      color: '#C4B89E',
      m: { base: 0, md: 'auto' },
      maxH: 'calc(100% - 7.5rem)',
      minW: { base: '100%', md: '500px' },
      maxW: { base: '100%', md: '500px' },
    },
    body: {
      overflow: 'auto',
      pb: 8,
      px: 8,
    },
    footer: {
      borderTop: '1px solid #3A3228',
      display: 'flex',
      justifyContent: 'center',
      pb: 6,
      pt: 4,
    },
    header: {
      color: '#D4A54A',
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
      bg: '#14120F',
      boxShadow: DARK_INSET_SHADOW,
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
        bg: '#5A8A7A',
      },
    },
    filled: {
      filledTrack: {
        bg: '#5A8A3E',
      },
    },
    maxed: {
      filledTrack: {
        bg: '#7b4ab5',
      },
    },
    timer: {
      filledTrack: {
        bg: '#C87A2A',
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
        bg: '#14120F',
        border: '2px solid',
        borderColor: '#3A3228',
        borderRadius: '5px',
        color: '#E8DCC8',
        _focus: {
          borderColor: '#C87A2A',
        },
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
        color: '#8A7E6A',
        _selected: {
          color: '#C87A2A',
          borderColor: '#C87A2A',
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
      bg: '#14120F',
      border: '2px solid',
      borderColor: '#3A3228',
      borderRadius: '5px',
      color: '#E8DCC8',
      _active: {
        borderColor: '#C87A2A',
      },
      _focus: {
        borderColor: '#C87A2A',
      },
      _placeholder: {
        color: '#8A7E6A',
      },
    },
  },
};

const Tooltip = {
  baseStyle: {
    bg: '#14120F',
    borderRadius: 0,
    clipPath: 'polygon(0% 0%, 93% 0%, 100% 18%, 100% 100%, 10% 100%, 0% 90%);',
    color: '#E8DCC8',
    p: 4,
  },
};

export const theme = extendTheme({
  config: { initialColorMode: 'dark', useSystemColorMode: false, disableTransitionOnChange: false },
  fonts: {
    body: `'Cormorant Garamond', 'Inter', Georgia, serif`,
    heading: `'Cinzel', 'Inter', serif`,
    mono: `'Fira Code', monospace`,
  },
  colors: {
    black: '#000',
    white: '#fff',
    yellow: '#EFD31C',
    green: '#5A8A3E',
    red: '#B83A2A',

    // Legacy aliases — remap old names to Torchlit palette
    blue300: '#E8A840',   // was #1633B6 — now hover glow
    blue400: '#C87A2A',   // was #0A2187 — now action amber
    blue500: '#1C1814',   // was #0C1539 — now card bg
    blue600: '#14120F',   // was #131832 — now input bg
    grey100: '#2E2820',   // was #D0D0D0 — now hover surface
    grey200: '#8A7E6A',   // was #A8ADB2 — now muted text
    grey300: '#1C1814',   // was #A2A9B0 — now card bg
    grey400: '#24201A',   // was #7E848A — now panel bg
    grey500: '#3A3228',   // was #3D4247 — now border

    // Rarity colors
    rarityWorn: '#8a8a8a',
    rarityCommon: '#C4B89E',
    rarityUncommon: '#3d8a4e',
    rarityRare: '#3d6fb5',
    rarityEpic: '#7b4ab5',
    rarityLegendary: '#c47a2a',
  },
  semanticTokens: {
    colors: {
      'bg.primary': '#12100E',
      'bg.secondary': '#14120F',
      'bg.card': '#1C1814',
      'bg.panel': '#24201A',
      'bg.hover': '#2E2820',
      'text.primary': '#E8DCC8',
      'text.body': '#C4B89E',
      'text.muted': '#8A7E6A',
      'text.heading': '#E8DCC8',
      'text.secondary': '#8A7E6A',
      'accent.action': '#C87A2A',
      'accent.glow': '#E8A840',
      'accent.success': '#5A8A3E',
      'accent.danger': '#B83A2A',
      'border.primary': '#3A3228',
      'border.accent': 'rgba(200,122,42,0.3)',
      'border.subtle': 'rgba(196,184,158,0.1)',
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
