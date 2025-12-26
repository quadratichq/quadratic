import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  root: 'examples',
  publicDir: false,
  server: {
    port: 8080,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['quadratic_rust_renderer'],
  },
});
