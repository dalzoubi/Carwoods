/**
 * Post-build pre-rendering script.
 * Launches a static server on the build output, visits each public route with
 * Puppeteer, and writes the fully-rendered HTML back to disk so that crawlers
 * and social-media scrapers receive complete meta tags without executing JS.
 *
 * Usage: node scripts/prerender.mjs
 * Runs automatically as part of `npm run build` (postbuild hook).
 */

import { createServer } from 'http';
import { readFile, mkdir, writeFile } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(__dirname, '..', 'build');
const PORT = 4173;

const routes = [
  '/',
  '/property-management',
  '/features',
  '/pricing',
  '/for-property-managers',
  '/apply',
  '/tenant-selection-criteria',
  '/application-required-documents',
  '/contact-us',
  '/privacy',
  '/terms-of-service',
  '/accessibility',
];

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let filePath = join(BUILD_DIR, req.url === '/' ? 'index.html' : req.url);

      try {
        const data = await readFile(filePath);
        const ext = extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      } catch {
        // SPA fallback — serve index.html for all routes
        const html = await readFile(join(BUILD_DIR, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      }
    });

    server.listen(PORT, () => resolve(server));
  });
}

async function prerender() {
  console.log('Starting pre-render server...');
  const server = await startServer();

  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  for (const route of routes) {
    const url = `http://localhost:${PORT}${route}`;
    console.log(`  Rendering ${route}...`);

    const page = await browser.newPage();

    // Wait for the app to dispatch prerender-ready
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => {
      return document.querySelector('title')?.textContent !== '';
    }, { timeout: 10000 });

    const html = await page.content();
    await page.close();

    // Write to build/<route>/index.html
    const outDir = route === '/' ? BUILD_DIR : join(BUILD_DIR, route);
    await mkdir(outDir, { recursive: true });

    const outPath = join(outDir, 'index.html');
    await writeFile(outPath, html, 'utf-8');
  }

  await browser.close();
  server.close();
  console.log(`Pre-rendered ${routes.length} routes.`);
}

prerender().catch((err) => {
  console.error('Pre-render failed:', err);
  process.exit(1);
});
