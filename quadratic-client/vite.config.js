import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

export default defineConfig(() => {
  return {
    build: {
      outDir: '../build',
    },
    publicDir: './public',
    assetsInclude: ['**/*.py'],
    server: {
      port: 3000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['monaco-editor', 'vscode'],
    },
    optimizeDeps: {
      exclude: ['pyodide'],
    },
    plugins: [
      react(),
      // tsconfigPaths(),
      checker({
        typescript: true,
        eslint: {
          lintCommand: 'eslint --ext .ts,.tsx src',
        },
      }),
    ],
    worker: {
      format: 'es',
      plugins: () => [
        checker({
          typescript: true,
          eslint: {
            lintCommand: 'eslint --ext .ts src',
          },
        }),
      ],
      rollupOptions: {
        // this is needed because pyodide uses fetch for older builds
        // see https://github.com/pyodide/pyodide/issues/4244
        external: ['node-fetch'],
      },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
    },
  };
});
