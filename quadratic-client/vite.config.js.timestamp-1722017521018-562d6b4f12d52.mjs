// vite.config.js
import { sentryVitePlugin } from "file:///Users/daviddimaria/work/quadratic/quadratic/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import react from "file:///Users/daviddimaria/work/quadratic/quadratic/node_modules/@vitejs/plugin-react/dist/index.mjs";
import path from "path";
import { defineConfig } from "file:///Users/daviddimaria/work/quadratic/quadratic/node_modules/vite/dist/node/index.js";
import checker from "file:///Users/daviddimaria/work/quadratic/quadratic/node_modules/vite-plugin-checker/dist/esm/main.js";
import svgr from "file:///Users/daviddimaria/work/quadratic/quadratic/node_modules/vite-plugin-svgr/dist/index.js";
import tsconfigPaths from "file:///Users/daviddimaria/work/quadratic/quadratic/node_modules/vite-tsconfig-paths/dist/index.mjs";
var __vite_injected_original_dirname = "/Users/daviddimaria/work/quadratic/quadratic/quadratic-client";
var vite_config_default = defineConfig(() => {
  const plugins = [
    react(),
    tsconfigPaths(),
    svgr(),
    checker({
      typescript: true,
      eslint: {
        lintCommand: "eslint --ext .ts,.tsx src"
      }
    }),
    {
      name: "configure-server",
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          next();
        });
      }
    }
  ];
  if (process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_AUTH_TOKEN !== "none") {
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
      sourcemap: process.env.VERCEL_ENV !== "preview" || process.env.VITEST !== "true"
      // Source map generation must be turned on
    },
    publicDir: "./public",
    assetsInclude: ["**/*.py"],
    server: {
      port: 3e3
    },
    resolve: {
      preserveSymlinks: process.env.VERCEL_ENV !== "preview" || process.env.VITEST !== "true",
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvZGF2aWRkaW1hcmlhL3dvcmsvcXVhZHJhdGljL3F1YWRyYXRpYy9xdWFkcmF0aWMtY2xpZW50XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvZGF2aWRkaW1hcmlhL3dvcmsvcXVhZHJhdGljL3F1YWRyYXRpYy9xdWFkcmF0aWMtY2xpZW50L3ZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9kYXZpZGRpbWFyaWEvd29yay9xdWFkcmF0aWMvcXVhZHJhdGljL3F1YWRyYXRpYy1jbGllbnQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBzZW50cnlWaXRlUGx1Z2luIH0gZnJvbSAnQHNlbnRyeS92aXRlLXBsdWdpbic7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCBjaGVja2VyIGZyb20gJ3ZpdGUtcGx1Z2luLWNoZWNrZXInO1xuaW1wb3J0IHN2Z3IgZnJvbSAndml0ZS1wbHVnaW4tc3Zncic7XG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCgpID0+IHtcbiAgY29uc3QgcGx1Z2lucyA9IFtcbiAgICByZWFjdCgpLFxuICAgIHRzY29uZmlnUGF0aHMoKSxcbiAgICBzdmdyKCksXG4gICAgY2hlY2tlcih7XG4gICAgICB0eXBlc2NyaXB0OiB0cnVlLFxuICAgICAgZXNsaW50OiB7XG4gICAgICAgIGxpbnRDb21tYW5kOiAnZXNsaW50IC0tZXh0IC50cywudHN4IHNyYycsXG4gICAgICB9LFxuICAgIH0pLFxuICAgIHtcbiAgICAgIG5hbWU6ICdjb25maWd1cmUtc2VydmVyJyxcbiAgICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgoX3JlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcignQ3Jvc3MtT3JpZ2luLUVtYmVkZGVyLVBvbGljeScsICdjcmVkZW50aWFsbGVzcycpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0Nyb3NzLU9yaWdpbi1PcGVuZXItUG9saWN5JywgJ3NhbWUtb3JpZ2luJyk7XG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfVxuICBdO1xuICBpZiAocHJvY2Vzcy5lbnYuU0VOVFJZX0FVVEhfVE9LRU4gJiYgcHJvY2Vzcy5lbnYuU0VOVFJZX0FVVEhfVE9LRU4gIT09ICdub25lJykge1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIHNlbnRyeVZpdGVQbHVnaW4oe1xuICAgICAgICBhdXRoVG9rZW46IHByb2Nlc3MuZW52LlNFTlRSWV9BVVRIX1RPS0VOLFxuICAgICAgICBvcmc6ICdxdWFkcmF0aWMnLFxuICAgICAgICBwcm9qZWN0OiAncXVhZHJhdGljJyxcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgYnVpbGQ6IHtcbiAgICAgIG91dERpcjogJy4uL2J1aWxkJyxcbiAgICAgIHNvdXJjZW1hcDogcHJvY2Vzcy5lbnYuVkVSQ0VMX0VOViAhPT0gJ3ByZXZpZXcnIHx8IHByb2Nlc3MuZW52LlZJVEVTVCAhPT0gJ3RydWUnLCAvLyBTb3VyY2UgbWFwIGdlbmVyYXRpb24gbXVzdCBiZSB0dXJuZWQgb25cbiAgICB9LFxuICAgIHB1YmxpY0RpcjogJy4vcHVibGljJyxcbiAgICBhc3NldHNJbmNsdWRlOiBbJyoqLyoucHknXSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHBvcnQ6IDMwMDAsXG4gICAgfSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBwcm9jZXNzLmVudi5WRVJDRUxfRU5WICE9PSAncHJldmlldycgfHwgcHJvY2Vzcy5lbnYuVklURVNUICE9PSAndHJ1ZScsXG4gICAgICBhbGlhczoge1xuICAgICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgICAgfSxcbiAgICAgIGRlZHVwZTogWydtb25hY28tZWRpdG9yJywgJ3ZzY29kZSddLFxuICAgIH0sXG4gICAgcGx1Z2lucyxcbiAgICB3b3JrZXI6IHtcbiAgICAgIGZvcm1hdDogJ2VzJyxcbiAgICAgIHBsdWdpbnM6ICgpID0+IFtcbiAgICAgICAgY2hlY2tlcih7XG4gICAgICAgICAgdHlwZXNjcmlwdDogdHJ1ZSxcbiAgICAgICAgICBlc2xpbnQ6IHtcbiAgICAgICAgICAgIGxpbnRDb21tYW5kOiAnZXNsaW50IC0tZXh0IC50cyBzcmMnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgLy8gdGhpcyBpcyBuZWVkZWQgYmVjYXVzZSBweW9kaWRlIHVzZXMgZmV0Y2ggZm9yIG9sZGVyIGJ1aWxkc1xuICAgICAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3B5b2RpZGUvcHlvZGlkZS9pc3N1ZXMvNDI0NFxuICAgICAgICBleHRlcm5hbDogWydub2RlLWZldGNoJ10sXG4gICAgICB9LFxuICAgIH0sXG4gICAgdGVzdDoge1xuICAgICAgZ2xvYmFsczogdHJ1ZSxcbiAgICAgIGVudmlyb25tZW50OiAnaGFwcHktZG9tJyxcbiAgICB9LFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIGlucHV0OiB7XG4gICAgICAgIG1haW46IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdpbmRleC5odG1sJyksXG4gICAgICAgIGludGVybmFsOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnX2ludGVybmFsL2VtYWlsLmh0bWwnKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5VyxTQUFTLHdCQUF3QjtBQUMxWSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sYUFBYTtBQUNwQixPQUFPLFVBQVU7QUFDakIsT0FBTyxtQkFBbUI7QUFOMUIsSUFBTSxtQ0FBbUM7QUFRekMsSUFBTyxzQkFBUSxhQUFhLE1BQU07QUFDaEMsUUFBTSxVQUFVO0FBQUEsSUFDZCxNQUFNO0FBQUEsSUFDTixjQUFjO0FBQUEsSUFDZCxLQUFLO0FBQUEsSUFDTCxRQUFRO0FBQUEsTUFDTixZQUFZO0FBQUEsTUFDWixRQUFRO0FBQUEsUUFDTixhQUFhO0FBQUEsTUFDZjtBQUFBLElBQ0YsQ0FBQztBQUFBLElBQ0Q7QUFBQSxNQUNFLE1BQU07QUFBQSxNQUNOLGdCQUFnQixRQUFRO0FBQ3RCLGVBQU8sWUFBWSxJQUFJLENBQUMsTUFBTSxLQUFLLFNBQVM7QUFDMUMsY0FBSSxVQUFVLGdDQUFnQyxnQkFBZ0I7QUFDOUQsY0FBSSxVQUFVLDhCQUE4QixhQUFhO0FBQ3pELGVBQUs7QUFBQSxRQUNQLENBQUM7QUFBQSxNQUNIO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDQSxNQUFJLFFBQVEsSUFBSSxxQkFBcUIsUUFBUSxJQUFJLHNCQUFzQixRQUFRO0FBQzdFLFlBQVE7QUFBQSxNQUNOLGlCQUFpQjtBQUFBLFFBQ2YsV0FBVyxRQUFRLElBQUk7QUFBQSxRQUN2QixLQUFLO0FBQUEsUUFDTCxTQUFTO0FBQUEsTUFDWCxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQUEsSUFDTCxPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixXQUFXLFFBQVEsSUFBSSxlQUFlLGFBQWEsUUFBUSxJQUFJLFdBQVc7QUFBQTtBQUFBLElBQzVFO0FBQUEsSUFDQSxXQUFXO0FBQUEsSUFDWCxlQUFlLENBQUMsU0FBUztBQUFBLElBQ3pCLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxrQkFBa0IsUUFBUSxJQUFJLGVBQWUsYUFBYSxRQUFRLElBQUksV0FBVztBQUFBLE1BQ2pGLE9BQU87QUFBQSxRQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxNQUN0QztBQUFBLE1BQ0EsUUFBUSxDQUFDLGlCQUFpQixRQUFRO0FBQUEsSUFDcEM7QUFBQSxJQUNBO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixRQUFRO0FBQUEsTUFDUixTQUFTLE1BQU07QUFBQSxRQUNiLFFBQVE7QUFBQSxVQUNOLFlBQVk7QUFBQSxVQUNaLFFBQVE7QUFBQSxZQUNOLGFBQWE7QUFBQSxVQUNmO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDSDtBQUFBLE1BQ0EsZUFBZTtBQUFBO0FBQUE7QUFBQSxRQUdiLFVBQVUsQ0FBQyxZQUFZO0FBQUEsTUFDekI7QUFBQSxJQUNGO0FBQUEsSUFDQSxNQUFNO0FBQUEsTUFDSixTQUFTO0FBQUEsTUFDVCxhQUFhO0FBQUEsSUFDZjtBQUFBLElBQ0EsZUFBZTtBQUFBLE1BQ2IsT0FBTztBQUFBLFFBQ0wsTUFBTSxLQUFLLFFBQVEsa0NBQVcsWUFBWTtBQUFBLFFBQzFDLFVBQVUsS0FBSyxRQUFRLGtDQUFXLHNCQUFzQjtBQUFBLE1BQzFEO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
