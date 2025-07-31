import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import checker from 'vite-plugin-checker';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

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
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Security-Policy', 'frame-ancestors *');
          next();
        });
      },
    },
  ];

  if (!!env.SENTRY_AUTH_TOKEN && env.SENTRY_AUTH_TOKEN !== 'none') {
    plugins.push(
      sentryVitePlugin({
        authToken: env.SENTRY_AUTH_TOKEN,
        org: 'quadratic',
        project: 'quadratic',
      })
    );
  }

  return {
    define: {
      global: 'globalThis',
    },
    build: {
      outDir: '../build',
      sourcemap: !!env.SENTRY_AUTH_TOKEN && env.SENTRY_AUTH_TOKEN !== 'none',
    },
    publicDir: './public',
    assetsInclude: ['**/*.py'],
    server: {
      host: '0.0.0.0',
      port: 3000,
      // uncomment once we have a way to hot reload web workers on wasm changes
      // watch: {
      //   ignored: [
      //     '**/src/app/quadratic-core/**',
      //   ],
      // },
    },
    resolve: {
      preserveSymlinks: true,
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
