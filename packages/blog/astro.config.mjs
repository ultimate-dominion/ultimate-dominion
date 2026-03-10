import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://ultimatedominion.com',
  base: '/blog',
  output: 'static',
  integrations: [
    tailwind(),
  ],
  server: {
    port: 4001,
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
