/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  theme: {
    extend: {
      colors: {
        page: '#070D2A',
        surface: '#0C1539',
        sidebar: '#131832',
        border: '#1A244E',
        'text-primary': '#D0D0D0',
        'text-secondary': '#7E848A',
        accent: '#EFD31C',
        'blue-primary': '#0A2187',
        'blue-bright': '#1633B6',
        'blue-dark': '#0C1539',
        red: '#AF0D08',
        green: '#008F07',
        'rarity-worn': '#9d9d9d',
        'rarity-common': '#ffffff',
        'rarity-uncommon': '#1eff00',
        'rarity-rare': '#0070dd',
        'rarity-epic': '#a335ee',
        'rarity-legendary': '#ff8000',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'glow-gold': '0 0 20px rgba(239, 211, 28, 0.15)',
        'glow-blue': '0 0 20px rgba(22, 51, 182, 0.2)',
      },
    },
  },
  plugins: [],
};
