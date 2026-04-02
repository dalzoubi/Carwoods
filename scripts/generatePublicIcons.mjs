/**
 * Writes derived public icons from `src/assets/carwoods-logo.png` (apple-touch) and
 * from checked-in raster files that must not be overwritten by prebuild:
 * `public/favicon.png` (read → favicon.ico) and `public/logo192.png` / `public/logo512.png`
 * (PWA manifest icons; commit your pixel edits).
 * Manifest and index.html reference these paths; without real image bytes,
 * SPA hosts may serve index.html for those URLs (and favicon.ico must be a real icon file).
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcLogo = join(root, 'src', 'assets', 'carwoods-logo.png');
const printLogoOut = join(root, 'src', 'assets', 'carwoods-logo-print.png');
const publicDir = join(root, 'public');

/**
 * Height of the top band to use when gap detection falls through (e.g. flat logo).
 * Tuned for current `carwoods-logo.png` (800×500): house ~y 52–322, text below ~y 379+.
 */
const FAVICON_FALLBACK_CROP_HEIGHT_RATIO = 0.66;

/** Rows with no opaque pixels count as empty; min gap rows to treat as house/text separator. */
const FAVICON_GAP_MIN_ROWS = 30;

function houseOnlyCropHeightPx(width, height, rgbaBuffer, channels) {
  const rowHits = new Uint32Array(height);
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) {
      const a = rgbaBuffer[(y * width + x) * channels + (channels - 1)];
      if (a > 10) n++;
    }
    rowHits[y] = n;
  }

  let sawContent = false;
  let gapLen = 0;
  let gapStart = 0;
  for (let y = 0; y < height; y++) {
    const has = rowHits[y] > 0;
    if (has) {
      sawContent = true;
      gapLen = 0;
      continue;
    }
    if (!sawContent) continue;
    if (gapLen === 0) gapStart = y;
    gapLen++;
    if (gapLen >= FAVICON_GAP_MIN_ROWS) {
      const cropH = Math.min(height, Math.max(1, gapStart + 2));
      return cropH;
    }
  }

  return Math.max(1, Math.round(height * FAVICON_FALLBACK_CROP_HEIGHT_RATIO));
}

/** House-only band of the navbar logo (apple-touch icon), as a sharp pipeline before resize. */
async function houseOnlyExtractSharp() {
  const meta = await sharp(srcLogo).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    throw new Error('[generatePublicIcons] Could not read logo dimensions');
  }

  const { data, info } = await sharp(srcLogo)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const cropH = houseOnlyCropHeightPx(w, h, data, ch);

  return sharp(srcLogo).extract({ left: 0, top: 0, width: w, height: cropH });
}

/**
 * Black artwork on transparent for print/PDF: avoids CSS `filter` (often dropped when printing).
 * Source logo is light-on-transparent; negate RGB only so alpha stays correct.
 */
async function writePrintLogoPng() {
  await sharp(srcLogo)
    .ensureAlpha()
    .negate({ alpha: false })
    .png()
    .toFile(printLogoOut);
}

/** Apple touch icon: house-only crop (tab favicon is the checked-in favicon.png). */
async function writeAppleTouchIconHouseOnly() {
  const pipeline = await houseOnlyExtractSharp();
  await pipeline
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));
}

async function writeFaviconIcoFromPng() {
  const pngPath = join(publicDir, 'favicon.png');
  const pngBuf = await readFile(pngPath);
  const icoBuf = await pngToIco([pngBuf]);
  await writeFile(join(publicDir, 'favicon.ico'), icoBuf);
}

const faviconPngPath = join(publicDir, 'favicon.png');
const logo192Path = join(publicDir, 'logo192.png');
const logo512Path = join(publicDir, 'logo512.png');
if (!existsSync(faviconPngPath)) {
  console.error('[generatePublicIcons] Missing checked-in favicon (commit public/favicon.png):', faviconPngPath);
  process.exit(1);
}
if (!existsSync(logo192Path)) {
  console.error('[generatePublicIcons] Missing checked-in PWA icon (commit public/logo192.png):', logo192Path);
  process.exit(1);
}
if (!existsSync(logo512Path)) {
  console.error('[generatePublicIcons] Missing checked-in PWA icon (commit public/logo512.png):', logo512Path);
  process.exit(1);
}

if (!existsSync(srcLogo)) {
  console.error('[generatePublicIcons] Missing source logo:', srcLogo);
  process.exit(1);
}

await writeFaviconIcoFromPng();
await writeAppleTouchIconHouseOnly();
await writePrintLogoPng();

console.log(
  '[generatePublicIcons] Wrote favicon.ico (from favicon.png), apple-touch-icon.png → public/, carwoods-logo-print.png → src/assets/ (logo192.png / logo512.png are checked in)'
);
