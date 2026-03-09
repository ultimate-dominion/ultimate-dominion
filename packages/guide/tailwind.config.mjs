/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  theme: {
    extend: {
      colors: {
        // Torchlit Dungeon palette — warm charcoal, parchment, amber fire
        page: '#12100E',
        surface: '#1C1814',
        sidebar: '#1A1610',
        border: '#3A3228',
        'text-primary': '#C4B89E',
        'text-secondary': '#8A7E6A',
        accent: '#C87A2A',           // torch orange — primary interactive
        'accent-glow': '#E8A840',    // lighter amber — hover/glow states
        'accent-gold': '#D4A54A',    // warm gold — headings, emphasis
        'blue-primary': '#3A2810',   // warm dark brown (replaces blue for active bg)
        'blue-bright': '#D4A54A',    // amber gold (replaces blue for links)
        'blue-dark': '#1C1814',
        red: '#B83A2A',
        green: '#5A8A3E',
        parchment: '#E8DCC8',        // brightest readable text
        'rarity-worn': '#8a8a8a',
        'rarity-common': '#C4B89E',
        'rarity-uncommon': '#3d8a4e',
        'rarity-rare': '#3d6fb5',
        'rarity-epic': '#7b4ab5',
        'rarity-legendary': '#c47a2a',
      },
      fontFamily: {
        sans: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        display: ['Cinzel', 'Georgia', 'serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0, 0, 0, 0.5)',
        'glow-torch': '0 0 20px rgba(200, 122, 42, 0.2)',
        'glow-gold': '0 0 20px rgba(212, 165, 74, 0.15)',
      },
      keyframes: {
        'torch-flicker': {
          '0%, 100%': { opacity: '0.06' },
          '50%': { opacity: '0.1' },
        },
        'torch-glow': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(200,122,42,0.2), 0 0 24px rgba(200,122,42,0.1)' },
          '50%': { boxShadow: '0 0 20px rgba(232,168,64,0.35), 0 0 40px rgba(200,122,42,0.15)' },
        },
      },
      animation: {
        'torch-flicker': 'torch-flicker 3s ease-in-out infinite',
        'torch-glow': 'torch-glow 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
