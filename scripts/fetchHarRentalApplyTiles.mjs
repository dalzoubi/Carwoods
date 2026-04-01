/**
 * Fetches each HAR listing by numeric id, parses JSON-LD + apply.link from HTML,
 * and writes src/data/rentalPropertyApplyTiles.generated.js for the Apply page.
 *
 * HAR does not allow browser cross-origin fetches to listing pages, so this runs in Node.
 */
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { HAR_RENTAL_LISTING_IDS } from '../src/data/harRentalListingIds.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../src/data/rentalPropertyApplyTiles.generated.js');

const UA = 'Mozilla/5.0 (compatible; CarwoodsSite/1.0; +https://carwoods.com)';

if (process.env.SKIP_HAR_RENTAL_FETCH === 'true') {
  if (!existsSync(OUT)) {
    console.error(
      'SKIP_HAR_RENTAL_FETCH is set but rentalPropertyApplyTiles.generated.js is missing. Run without the skip flag once.'
    );
    process.exit(1);
  }
  console.warn('[fetchHarRentalApplyTiles] Skipped (SKIP_HAR_RENTAL_FETCH=true).');
  process.exit(0);
}

function findProductNode(graph) {
  if (!Array.isArray(graph)) return null;
  return graph.find(
    (n) =>
      Array.isArray(n['@type']) &&
      n['@type'].includes('Product') &&
      n['@type'].includes('SingleFamilyResidence')
  );
}

function extractProductFromHtml(html) {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1]);
      const graph = json['@graph'];
      const product = findProductNode(graph);
      if (product) return product;
    } catch {
      /* next block */
    }
  }
  return null;
}

function findAdditional(product, name) {
  const list = product?.offers?.itemOffered?.additionalProperty;
  if (!Array.isArray(list)) return null;
  const row = list.find((x) => x?.name === name);
  return row?.value ?? null;
}

function lotSqftFromSpeech(html) {
  const match = html.match(/lot size is ([\d,]+) Square feet/i);
  if (!match) return null;
  return Number.parseInt(match[1].replace(/,/g, ''), 10);
}

function formatUsdMonthly(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '';
  return `$${n.toLocaleString('en-US')}/mo`;
}

function formatBaths(total) {
  if (typeof total !== 'number' || Number.isNaN(total)) return null;
  const full = Math.floor(total);
  const frac = total - full;
  const halfCount = Math.round(frac * 2);
  if (halfCount === 0) return `${full} Full Bath(s)`;
  if (full === 0) return `${halfCount} Half Bath(s)`;
  return `${full} Full & ${halfCount} Half Bath(s)`;
}

function formatSqft(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return null;
  return `${n.toLocaleString('en-US')} Sqft`;
}

function formatLotLine(product, html) {
  const raw = findAdditional(product, 'Lot Size');
  if (raw) {
    const acresMatch = String(raw).match(/([\d.]+)\s*Acres?/i);
    if (acresMatch) {
      const acres = Number.parseFloat(acresMatch[1]);
      if (!Number.isNaN(acres)) {
        const sqft = Math.round(acres * 43560);
        return `${sqft.toLocaleString('en-US')} Lot Sqft`;
      }
    }
    if (/sq\.?\s*ft/i.test(String(raw))) {
      return String(raw).replace(/\s+/g, ' ').trim();
    }
  }
  const speechSqft = lotSqftFromSpeech(html);
  if (speechSqft != null) {
    return `${speechSqft.toLocaleString('en-US')} Lot Sqft`;
  }
  return null;
}

function extractApplyLink(html) {
  const m = html.match(/https:\/\/apply\.link\/[A-Za-z0-9_-]+/);
  return m ? m[0] : null;
}

function firstImageUrl(product) {
  const img = product?.image;
  if (typeof img === 'string') return img;
  if (Array.isArray(img) && img.length) return img[0];
  return null;
}

function buildTilesFromProduct(listingId, product, harListingUrl, applyUrl, html) {
  const addr = product.address ?? {};
  const street = addr.streetAddress ?? '';
  const city = addr.addressLocality ?? '';
  const region = addr.addressRegion ?? '';
  const zip = addr.postalCode ?? '';
  const cityStateZip = [city, region].filter(Boolean).join(', ') + (zip ? ` ${zip}` : '');

  const beds = product.numberOfBedrooms;
  const baths = product.numberOfBathroomsTotal;
  const livingSqft = product.floorSize?.value;

  const detailLines = [];
  if (typeof beds === 'number') detailLines.push(`${beds} Bedroom(s)`);
  const bathLine = formatBaths(baths);
  if (bathLine) detailLines.push(bathLine);
  const sqftLine = formatSqft(livingSqft);
  if (sqftLine) detailLines.push(sqftLine);
  const lotLine = formatLotLine(product, html);
  if (lotLine) detailLines.push(lotLine);
  const ptype = findAdditional(product, 'Property Type');
  if (ptype) detailLines.push(String(ptype));

  const price = product.offers?.price;

  return {
    id: `har-${listingId}`,
    addressLine: street || (product.name ?? '').split(',')[0]?.trim() || 'Rental listing',
    cityStateZip: cityStateZip.trim() || '',
    monthlyRentLabel: formatUsdMonthly(price),
    photoUrl: firstImageUrl(product) ?? '',
    harListingUrl,
    applyUrl,
    detailLines,
  };
}

async function fetchListing(listingId) {
  const url = `https://www.har.com/homedetail/${listingId}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`HAR ${listingId}: HTTP ${res.status}`);
  }
  const html = await res.text();
  const harListingUrl = res.url;
  const product = extractProductFromHtml(html);
  if (!product) {
    throw new Error(`HAR ${listingId}: could not parse listing JSON-LD`);
  }
  const applyUrl = extractApplyLink(html);
  if (!applyUrl) {
    throw new Error(
      `HAR ${listingId}: no apply.link URL found (RentSpree may be off for this listing)`
    );
  }
  return buildTilesFromProduct(listingId, product, harListingUrl, applyUrl, html);
}

async function main() {
  if (!HAR_RENTAL_LISTING_IDS.length) {
    const body = `/**
 * AUTO-GENERATED by scripts/fetchHarRentalApplyTiles.mjs — do not edit.
 * Source: src/data/harRentalListingIds.js (empty).
 */
export const RENTAL_APPLY_PROPERTIES = [];
`;
    writeFileSync(OUT, body, 'utf8');
    console.log('[fetchHarRentalApplyTiles] Wrote empty RENTAL_APPLY_PROPERTIES (no listing ids).');
    return;
  }

  const tiles = [];
  for (const id of HAR_RENTAL_LISTING_IDS) {
    console.log(`[fetchHarRentalApplyTiles] Fetching HAR listing ${id}…`);
    try {
      tiles.push(await fetchListing(String(id).trim()));
    } catch (err) {
      if (existsSync(OUT)) {
        console.warn(
          `[fetchHarRentalApplyTiles] Warning: ${err.message}. ` +
          `Keeping existing generated file (network may be restricted in this environment).`
        );
        process.exit(0);
      }
      // No cached fallback available — surface the error so the developer knows
      // the generated file needs to be created locally first.
      throw err;
    }
  }

  const serialized = JSON.stringify(tiles, null, 4);
  const file = `/**
 * AUTO-GENERATED by scripts/fetchHarRentalApplyTiles.mjs — do not edit.
 * Source: src/data/harRentalListingIds.js
 */
export const RENTAL_APPLY_PROPERTIES = ${serialized};
`;

  writeFileSync(OUT, file, 'utf8');
  console.log(`[fetchHarRentalApplyTiles] Wrote ${tiles.length} listing(s) to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
