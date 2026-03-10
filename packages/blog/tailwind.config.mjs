/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  theme: {
    extend: {
      colors: {
        page: '#12100E',
        surface: '#1C1814',
        border: '#3A3228',
        'text-primary': '#C4B89E',
        'text-secondary': '#8A7E6A',
        accent: '#C87A2A',
        'accent-glow': '#E8A840',
        'accent-gold': '#D4A54A',
        parchment: '#E8DCC8',
      },
      fontFamily: {
        sans: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        display: ['Cinzel', 'Georgia', 'serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(0, 0, 0, 0.5)',
        'glow-torch': '0 0 20px rgba(200, 122, 42, 0.2)',
      },
      keyframes: {
        'torch-glow': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(200,122,42,0.2), 0 0 24px rgba(200,122,42,0.1)' },
          '50%': { boxShadow: '0 0 20px rgba(232,168,64,0.35), 0 0 40px rgba(200,122,42,0.15)' },
        },
      },
      animation: {
        'torch-glow': 'torch-glow 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
