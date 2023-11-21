import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
    },
    assetsInclude: ['**/*.py'],
    server: {
      port: 3000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      react(),
      checker({
        typescript: true,
        eslint: {
          lintCommand: 'eslint --ext .ts,.tsx src',
        },
      }),
    ],
    worker: {
      format: 'iife',
      plugins: () => [
        checker({
          typescript: true,
          eslint: {
            lintCommand: 'eslint --ext .ts src',
          },
        }),
      ],
    },
  };
});
