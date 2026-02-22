import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Allow both real and original paths (Vite has path resolution issues on Windows network drives)
const projectRoot = path.resolve(__dirname);
const realRoot = fs.realpathSync.native(projectRoot);

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  // Match gh-pages deploy: homepage is carwoods.com, base path is /
  base: '/',
  build: {
    outDir: 'build',
    sourcemap: false,
  },
  server: {
    port: 3000,
    fs: {
      allow: [realRoot, projectRoot],
    },
    watch: {
      usePolling: true,
      interval: 500
    },
    hmr: {
      overlay: true
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/index.js', 'src/reportWebVitals.js', 'src/setupTests.js'],
      thresholds: {
        statements: 40,
        branches: 35,
        functions: 40,
        lines: 40,
      },
    },
  },
});
