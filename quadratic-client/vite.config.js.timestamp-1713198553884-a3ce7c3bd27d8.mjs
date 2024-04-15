// vite.config.js
import { sentryVitePlugin } from "file:///Users/davidfig/Programming/quadratic/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import react from "file:///Users/davidfig/Programming/quadratic/node_modules/@vitejs/plugin-react/dist/index.mjs";
import path from "path";
import { defineConfig } from "file:///Users/davidfig/Programming/quadratic/node_modules/vite/dist/node/index.js";
import checker from "file:///Users/davidfig/Programming/quadratic/node_modules/vite-plugin-checker/dist/esm/main.js";
import tsconfigPaths from "file:///Users/davidfig/Programming/quadratic/node_modules/vite-tsconfig-paths/dist/index.mjs";
var __vite_injected_original_dirname = "/Users/davidfig/Programming/quadratic/quadratic-client";
var vite_config_default = defineConfig(() => {
  const plugins = [
    react(),
    tsconfigPaths(),
    checker({
      typescript: true,
      eslint: {
        lintCommand: "eslint --ext .ts,.tsx src"
      }
    })
  ];
  if (process.env.SENTRY_AUTH_TOKEN) {
    plugins.push(
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: "quadratic",
        project: "quadratic"
      })
    );
  }
  return {
    build: {
      outDir: "../build",
      sourcemap: true
      // Source map generation must be turned on
    },
    publicDir: "./public",
    assetsInclude: ["**/*.py"],
    server: {
      port: 3e3
    },
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      },
      dedupe: ["monaco-editor", "vscode"]
    },
    plugins,
    worker: {
      format: "es",
      plugins: () => [
        checker({
          typescript: true,
          eslint: {
            lintCommand: "eslint --ext .ts src"
          }
        })
      ],
      rollupOptions: {
        // this is needed because pyodide uses fetch for older builds
        // see https://github.com/pyodide/pyodide/issues/4244
        external: ["node-fetch"]
      }
    },
    test: {
      globals: true,
      environment: "happy-dom"
    },
    rollupOptions: {
      input: {
        main: path.resolve(__vite_injected_original_dirname, "index.html"),
        internal: path.resolve(__vite_injected_original_dirname, "_internal/email.html")
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvZGF2aWRmaWcvUHJvZ3JhbW1pbmcvcXVhZHJhdGljL3F1YWRyYXRpYy1jbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9kYXZpZGZpZy9Qcm9ncmFtbWluZy9xdWFkcmF0aWMvcXVhZHJhdGljLWNsaWVudC92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvZGF2aWRmaWcvUHJvZ3JhbW1pbmcvcXVhZHJhdGljL3F1YWRyYXRpYy1jbGllbnQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBzZW50cnlWaXRlUGx1Z2luIH0gZnJvbSAnQHNlbnRyeS92aXRlLXBsdWdpbic7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCBjaGVja2VyIGZyb20gJ3ZpdGUtcGx1Z2luLWNoZWNrZXInO1xuaW1wb3J0IHRzY29uZmlnUGF0aHMgZnJvbSAndml0ZS10c2NvbmZpZy1wYXRocyc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoKSA9PiB7XG4gIGNvbnN0IHBsdWdpbnMgPSBbXG4gICAgcmVhY3QoKSxcbiAgICB0c2NvbmZpZ1BhdGhzKCksXG4gICAgY2hlY2tlcih7XG4gICAgICB0eXBlc2NyaXB0OiB0cnVlLFxuICAgICAgZXNsaW50OiB7XG4gICAgICAgIGxpbnRDb21tYW5kOiAnZXNsaW50IC0tZXh0IC50cywudHN4IHNyYycsXG4gICAgICB9LFxuICAgIH0pLFxuICBdO1xuICBpZiAocHJvY2Vzcy5lbnYuU0VOVFJZX0FVVEhfVE9LRU4pIHtcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICBzZW50cnlWaXRlUGx1Z2luKHtcbiAgICAgICAgYXV0aFRva2VuOiBwcm9jZXNzLmVudi5TRU5UUllfQVVUSF9UT0tFTixcbiAgICAgICAgb3JnOiAncXVhZHJhdGljJyxcbiAgICAgICAgcHJvamVjdDogJ3F1YWRyYXRpYycsXG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGJ1aWxkOiB7XG4gICAgICBvdXREaXI6ICcuLi9idWlsZCcsXG4gICAgICBzb3VyY2VtYXA6IHRydWUsIC8vIFNvdXJjZSBtYXAgZ2VuZXJhdGlvbiBtdXN0IGJlIHR1cm5lZCBvblxuICAgIH0sXG4gICAgcHVibGljRGlyOiAnLi9wdWJsaWMnLFxuICAgIGFzc2V0c0luY2x1ZGU6IFsnKiovKi5weSddLFxuICAgIHNlcnZlcjoge1xuICAgICAgcG9ydDogMzAwMCxcbiAgICB9LFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzOiB7XG4gICAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgICB9LFxuICAgICAgZGVkdXBlOiBbJ21vbmFjby1lZGl0b3InLCAndnNjb2RlJ10sXG4gICAgfSxcbiAgICBwbHVnaW5zLFxuICAgIHdvcmtlcjoge1xuICAgICAgZm9ybWF0OiAnZXMnLFxuICAgICAgcGx1Z2luczogKCkgPT4gW1xuICAgICAgICBjaGVja2VyKHtcbiAgICAgICAgICB0eXBlc2NyaXB0OiB0cnVlLFxuICAgICAgICAgIGVzbGludDoge1xuICAgICAgICAgICAgbGludENvbW1hbmQ6ICdlc2xpbnQgLS1leHQgLnRzIHNyYycsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICAvLyB0aGlzIGlzIG5lZWRlZCBiZWNhdXNlIHB5b2RpZGUgdXNlcyBmZXRjaCBmb3Igb2xkZXIgYnVpbGRzXG4gICAgICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vcHlvZGlkZS9weW9kaWRlL2lzc3Vlcy80MjQ0XG4gICAgICAgIGV4dGVybmFsOiBbJ25vZGUtZmV0Y2gnXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB0ZXN0OiB7XG4gICAgICBnbG9iYWxzOiB0cnVlLFxuICAgICAgZW52aXJvbm1lbnQ6ICdoYXBweS1kb20nLFxuICAgIH0sXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgbWFpbjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ2luZGV4Lmh0bWwnKSxcbiAgICAgICAgaW50ZXJuYWw6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdfaW50ZXJuYWwvZW1haWwuaHRtbCcpLFxuICAgICAgfSxcbiAgICB9LFxuICB9O1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW9WLFNBQVMsd0JBQXdCO0FBQ3JYLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxhQUFhO0FBQ3BCLE9BQU8sbUJBQW1CO0FBTDFCLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYSxNQUFNO0FBQ2hDLFFBQU0sVUFBVTtBQUFBLElBQ2QsTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLElBQ2QsUUFBUTtBQUFBLE1BQ04sWUFBWTtBQUFBLE1BQ1osUUFBUTtBQUFBLFFBQ04sYUFBYTtBQUFBLE1BQ2Y7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQ0EsTUFBSSxRQUFRLElBQUksbUJBQW1CO0FBQ2pDLFlBQVE7QUFBQSxNQUNOLGlCQUFpQjtBQUFBLFFBQ2YsV0FBVyxRQUFRLElBQUk7QUFBQSxRQUN2QixLQUFLO0FBQUEsUUFDTCxTQUFTO0FBQUEsTUFDWCxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQUEsSUFDTCxPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixXQUFXO0FBQUE7QUFBQSxJQUNiO0FBQUEsSUFDQSxXQUFXO0FBQUEsSUFDWCxlQUFlLENBQUMsU0FBUztBQUFBLElBQ3pCLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDdEM7QUFBQSxNQUNBLFFBQVEsQ0FBQyxpQkFBaUIsUUFBUTtBQUFBLElBQ3BDO0FBQUEsSUFDQTtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sUUFBUTtBQUFBLE1BQ1IsU0FBUyxNQUFNO0FBQUEsUUFDYixRQUFRO0FBQUEsVUFDTixZQUFZO0FBQUEsVUFDWixRQUFRO0FBQUEsWUFDTixhQUFhO0FBQUEsVUFDZjtBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0g7QUFBQSxNQUNBLGVBQWU7QUFBQTtBQUFBO0FBQUEsUUFHYixVQUFVLENBQUMsWUFBWTtBQUFBLE1BQ3pCO0FBQUEsSUFDRjtBQUFBLElBQ0EsTUFBTTtBQUFBLE1BQ0osU0FBUztBQUFBLE1BQ1QsYUFBYTtBQUFBLElBQ2Y7QUFBQSxJQUNBLGVBQWU7QUFBQSxNQUNiLE9BQU87QUFBQSxRQUNMLE1BQU0sS0FBSyxRQUFRLGtDQUFXLFlBQVk7QUFBQSxRQUMxQyxVQUFVLEtBQUssUUFBUSxrQ0FBVyxzQkFBc0I7QUFBQSxNQUMxRDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
