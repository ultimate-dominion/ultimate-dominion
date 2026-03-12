import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ultimatedominion.com',
  base: '/guide',
  output: 'static',
  integrations: [
    tailwind(),
    sitemap(),
  ],
  server: {
    port: 4000,
  },
});
