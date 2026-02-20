import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error("INPUT environment variable is not set");
}

const isDevelopment = process.env.NODE_ENV === "development";

const EMBED_URL =
  process.env.EMBED_URL ??
  "https://sab-fallback.quadratic-preview.com/embed?embedId=0bab2826-ab21-4ed7-a3ef-883b5e47280b";

export default defineConfig({
  define: {
    __EMBED_URL__: JSON.stringify(EMBED_URL),
  },
  plugins: [react(), viteSingleFile()],
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {
      input: INPUT,
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
