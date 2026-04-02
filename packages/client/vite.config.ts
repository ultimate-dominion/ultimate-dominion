/// <reference types="vitest" />
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    plugins: [react()],
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
    resolve: {
      alias: {
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      },
    },
    server: {
      port: 3000, // Use port 3000 for client to avoid conflict with API on 3001
      fs: {
        strict: false,
      },
    },
    build: {
      target: 'es2022',
      minify: true,
      modulePreload: false,
      sourcemap: false,
      commonjsOptions: {
        // Handle 'use client' directives
        transformMixedEsModules: true,
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        // Handle 'use client' directives
        supported: {
          'top-level-await': true,
        },
        target: 'es2022',
        // Suppress 'use client' directive warnings
        banner: {
          js: '// @ts-nocheck\n"use client";',
        },
      },
    },
    define: {
      // Shim NodeJS globals for browser — required by Privy embedded wallet SDK
      // NOTE: Cannot use `global: 'globalThis'` — it replaces "global" inside
      // package names like @safe-global/safe-apps-sdk, breaking the build.
      // The shim is applied at runtime in src/index.tsx instead.
    },
  };
});
