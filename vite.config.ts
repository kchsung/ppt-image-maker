import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // dom-to-pptx imports opentype.js as a default export. Its ESM entry
      // exposes named exports only, while the UMD build provides the expected
      // CommonJS default shape for Vite's dependency transformer.
      'opentype.js': path.resolve(__dirname, 'node_modules/opentype.js/dist/opentype.js'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
