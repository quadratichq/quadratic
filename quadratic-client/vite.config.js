import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { compression } from 'vite-plugin-compression2';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

const COMPRESS_FILE_TYPES = ['wasm', 'whl', 'css', 'json', 'html', 'svg', 'ttf', 'otf', 'eot', 'woff', 'woff2'];

export default defineConfig(() => {
  const plugins = [
    react(),
    tsconfigPaths(),
    svgr(),
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint --ext .ts,.tsx src',
      },
    }),
    {
      name: 'configure-server',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          next();
        });
      },
    },
    // Compress build files (excluding JS)
    compression({
      algorithm: 'gzip',
      include: [new RegExp(`\\.(${COMPRESS_FILE_TYPES.join('|')})$`, 'i')],
      threshold: 10 * 1000 * 1000,
      compressionOptions: {
        level: 9,
      },
      deleteOriginalAssets: false,
      skipIfLargerOrEqual: false,
    }),
    compression({
      algorithm: 'brotliCompress',
      include: [new RegExp(`\\.(${COMPRESS_FILE_TYPES.join('|')})$`, 'i')],
      threshold: 10 * 1000 * 1000,
      compressionOptions: {
        level: 11,
      },
      deleteOriginalAssets: false,
      skipIfLargerOrEqual: false,
    }),
  ];

  if (process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_AUTH_TOKEN !== 'none') {
    plugins.push(
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: 'quadratic',
        project: 'quadratic',
      })
    );
  }

  return {
    build: {
      outDir: '../build',
      sourcemap: process.env.VERCEL_ENV !== 'preview' || process.env.VITEST !== 'true', // Source map generation must be turned on
    },
    publicDir: './public',
    assetsInclude: ['**/*.py'],
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
    resolve: {
      preserveSymlinks: process.env.VERCEL_ENV !== 'preview' || process.env.VITEST !== 'true',
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['monaco-editor', 'vscode'],
    },
    plugins,
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
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        internal: path.resolve(__dirname, '_internal/email.html'),
      },
    },
  };
});
