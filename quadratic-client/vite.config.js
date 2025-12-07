import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import checker from 'vite-plugin-checker';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Validate required environment variables at build time
  const requiredEnvVars = [
    'VITE_AUTH_TYPE',
    'VITE_QUADRATIC_API_URL',
    'VITE_QUADRATIC_MULTIPLAYER_URL',
    'VITE_QUADRATIC_CONNECTION_URL',
  ];
  if (env.VITE_AUTH_TYPE === 'workos') {
    requiredEnvVars.push('VITE_WORKOS_CLIENT_ID');
  }

  const missingEnvVars = requiredEnvVars.filter((varName) => !(varName in env));
  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }

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
          res.setHeader('Document-Policy', 'js-profiling');
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
        url: 'https://sentry.quadratichq.com',
        release: `quadratic@${env.VITE_VERSION}`,
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
