import { defineConfig } from 'vite';

// base './' so every asset path is relative — required inside itch.io's iframe.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
  server: { port: 5180 },
});
