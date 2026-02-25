import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Allow both real and original paths (Vite has path resolution issues on Windows network drives)
const projectRoot = path.resolve(__dirname);
const realRoot = fs.realpathSync.native(projectRoot);
// Use file:// URL for setupFiles to avoid Vite treating UNC paths as virtual module IDs
const setupTestsUrl = pathToFileURL(path.join(projectRoot, 'src/setupTests.js')).href;

export default defineConfig({
  root: projectRoot,
  resolve: {
    preserveSymlinks: true,
  },
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
    setupFiles: ['./src/setupTests.js'],
    include: ['src/**/*.{test,spec}.{jsx,js}'],
    server: {
      fs: {
        allow: [projectRoot, realRoot],
      },
    },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{jsx,js}'],
        exclude: ['src/index.jsx', 'src/reportWebVitals.js', 'src/setupTests.js'],
      thresholds: {
        statements: 40,
        branches: 35,
        functions: 40,
        lines: 40,
      },
    },
  },
});
