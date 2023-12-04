import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(() => {
  return {
    build: {
      outDir: '../build',
    },
    assetsInclude: ['**/*.py'],
    server: {
      port: 3000,
    },
    plugins: [
      tsconfigPaths(),
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
