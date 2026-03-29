/**
 * Writes PWA / favicon assets under public/ from the canonical navbar logo.
 * Manifest and index.html reference these paths; without real image bytes,
 * production can serve index.html for those URLs and Chrome reports an invalid manifest icon.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcLogo = join(root, 'src', 'assets', 'carwoods-logo.png');
const publicDir = join(root, 'public');

async function writeSquarePng(filename, size) {
  await sharp(srcLogo)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toFile(join(publicDir, filename));
}

if (!existsSync(srcLogo)) {
  console.error('[generatePublicIcons] Missing source logo:', srcLogo);
  process.exit(1);
}

await writeSquarePng('favicon.png', 32);
await writeSquarePng('logo.png', 180);
await writeSquarePng('logo192.png', 192);
await writeSquarePng('logo512.png', 512);

console.log('[generatePublicIcons] Wrote favicon.png, logo.png, logo192.png, logo512.png → public/');
