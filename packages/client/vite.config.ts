import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// esbuild 0.18 doesn't support import attributes (`with { type: 'json' }`).
// This plugin strips them so @base-org/account can be pre-bundled.
const stripImportAttributes = {
  name: 'strip-import-attributes',
  setup(build: any) {
    build.onLoad(
      { filter: /\.js$/, namespace: 'file' },
      async (args: any) => {
        if (!args.path.includes('@base-org/account')) return undefined;
        const fs = await import('fs');
        let contents = fs.readFileSync(args.path, 'utf8');
        contents = contents.replace(
          /\bwith\s*\{\s*type:\s*['"]json['"]\s*\}/g,
          '',
        );
        return { contents, loader: 'js' };
      },
    );
  },
};

export default defineConfig(({ command }) => {
  return {
    plugins: [react()],
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
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            thirdweb: ['thirdweb', 'thirdweb/wallets/in-app', 'thirdweb/adapters/viem'],
          },
        },
      },
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
        plugins: [stripImportAttributes],
      },
    },
    define: {
      // By default, Vite doesn't include shims for NodeJS/
      // necessary for segment analytics lib to work
      ...(command === 'serve' ? { global: 'globalThis' } : {}),
    },
  };
});
