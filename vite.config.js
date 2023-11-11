import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
    },
    server: {
      port: 3000,
    },
    // TODO --fast
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [react(), checker({ typescript: true })],
  };
});
