import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    plugins: [react()],
    server: {
      port: 3000,
      fs: {
        strict: false,
      },
      proxy: {
        '/mud-indexer': {
          target: 'https://indexer.mud.garnetchain.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/mud-indexer/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Origin', 'https://indexer.mud.garnetchain.com');
            });
          },
        },
      },
    },
    build: {
      target: 'es2022',
      minify: true,
      sourcemap: true,
    },
    define: {
      // By default, Vite doesn't include shims for NodeJS/
      // necessary for segment analytics lib to work
      ...(command === 'serve' ? { global: 'globalThis' } : {}),
      // Disable Vercel Analytics until properly configured
      'process.env.VERCEL_ANALYTICS': false,
    },
  };
});
