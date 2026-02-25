import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://ultimatedominion.com',
  base: '/guide',
  output: 'static',
  integrations: [
    tailwind(),
  ],
  server: {
    port: 4000,
  },
});
