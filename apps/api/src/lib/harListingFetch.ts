/**
 * Server-side HAR listing HTML fetch + JSON-LD / apply.link parse.
 * Blocking HAR HTML fetch + JSON-LD parse on property writes (admin POST/PATCH with har_listing_id).
 */

const UA = 'Mozilla/5.0 (compatible; CarwoodsPortal/1.0; +https://carwoods.com)';

export type HarApplyTile = {
  id: string;
  addressLine: string;
  cityStateZip: string;
  monthlyRentLabel: string;
  photoUrl: string;
  harListingUrl: string;
  /** Empty string when no application URL is available for this listing. */
  applyUrl: string;
  detailLines: string[];
};

function findProductNode(graph: unknown): Record<string, unknown> | null {
  if (!Array.isArray(graph)) return null;
  for (const n of graph) {
    if (!n || typeof n !== 'object') continue;
    const o = n as Record<string, unknown>;
    const t = o['@type'];
    if (
      Array.isArray(t) &&
      t.includes('Product') &&
      t.includes('SingleFamilyResidence')
    ) {
      return o;
    }
  }
  return null;
}

function extractProductFromHtml(html: string): Record<string, unknown> | null {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1]!) as { '@graph'?: unknown };
      const product = findProductNode(json['@graph']);
      if (product) return product;
    } catch {
      /* next block */
    }
  }
  return null;
}

function findAdditional(product: Record<string, unknown>, name: string): unknown {
  const offers = product.offers as Record<string, unknown> | undefined;
  const itemOffered = offers?.itemOffered as Record<string, unknown> | undefined;
  const list = itemOffered?.additionalProperty;
  if (!Array.isArray(list)) return null;
  for (const x of list) {
    if (!x || typeof x !== 'object') continue;
    const row = x as { name?: string; value?: unknown };
    if (row.name === name) return row.value ?? null;
  }
  return null;
}

function lotSqftFromSpeech(html: string): number | null {
  const match = html.match(/lot size is ([\d,]+) Square feet/i);
  if (!match) return null;
  return Number.parseInt(match[1]!.replace(/,/g, ''), 10);
}

function formatUsdMonthly(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '';
  return `$${n.toLocaleString('en-US')}/mo`;
}

function formatBaths(total: number): string | null {
  if (typeof total !== 'number' || Number.isNaN(total)) return null;
  const full = Math.floor(total);
  const frac = total - full;
  const halfCount = Math.round(frac * 2);
  if (halfCount === 0) return `${full} Full Bath(s)`;
  if (full === 0) return `${halfCount} Half Bath(s)`;
  return `${full} Full & ${halfCount} Half Bath(s)`;
}

function formatSqft(n: number): string | null {
  if (typeof n !== 'number' || Number.isNaN(n)) return null;
  return `${n.toLocaleString('en-US')} Sqft`;
}

function formatLotLine(product: Record<string, unknown>, html: string): string | null {
  const raw = findAdditional(product, 'Lot Size');
  if (raw != null) {
    const acresMatch = String(raw).match(/([\d.]+)\s*Acres?/i);
    if (acresMatch) {
      const acres = Number.parseFloat(acresMatch[1]!);
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

function extractApplyLink(html: string): string | null {
  const m = html.match(/https:\/\/apply\.link\/[A-Za-z0-9_-]+/);
  return m ? m[0]! : null;
}

function firstImageUrl(product: Record<string, unknown>): string | null {
  const img = product.image;
  if (typeof img === 'string') return img;
  if (Array.isArray(img) && img.length) {
    const first = img[0];
    return typeof first === 'string' ? first : null;
  }
  return null;
}

function buildTilesFromProduct(
  listingId: string,
  product: Record<string, unknown>,
  harListingUrl: string,
  applyUrl: string,
  html: string
): HarApplyTile {
  const addr = (product.address ?? {}) as Record<string, unknown>;
  const street = typeof addr.streetAddress === 'string' ? addr.streetAddress : '';
  const city = typeof addr.addressLocality === 'string' ? addr.addressLocality : '';
  const region = typeof addr.addressRegion === 'string' ? addr.addressRegion : '';
  const zip = typeof addr.postalCode === 'string' ? addr.postalCode : '';
  const cityStateZip = [city, region].filter(Boolean).join(', ') + (zip ? ` ${zip}` : '');

  const beds = product.numberOfBedrooms;
  const baths = product.numberOfBathroomsTotal;
  const floorSize = product.floorSize as { value?: number } | undefined;
  const livingSqft = floorSize?.value;

  const detailLines: string[] = [];
  if (typeof beds === 'number') detailLines.push(`${beds} Bedroom(s)`);
  const bathLine = typeof baths === 'number' ? formatBaths(baths) : null;
  if (bathLine) detailLines.push(bathLine);
  const sqftLine = typeof livingSqft === 'number' ? formatSqft(livingSqft) : null;
  if (sqftLine) detailLines.push(sqftLine);
  const lotLine = formatLotLine(product, html);
  if (lotLine) detailLines.push(lotLine);
  const ptype = findAdditional(product, 'Property Type');
  if (ptype != null) detailLines.push(String(ptype));

  const offers = product.offers as { price?: number } | undefined;
  const price = offers?.price;

  const name = typeof product.name === 'string' ? product.name : '';
  return {
    id: `har-${listingId}`,
    addressLine:
      street || name.split(',')[0]?.trim() || 'Rental listing',
    cityStateZip: cityStateZip.trim(),
    monthlyRentLabel: typeof price === 'number' ? formatUsdMonthly(price) : '',
    photoUrl: firstImageUrl(product) ?? '',
    harListingUrl,
    applyUrl,
    detailLines,
  };
}

export async function fetchHarListingTile(listingId: string): Promise<HarApplyTile> {
  const id = listingId.trim();
  if (!id) {
    throw new Error('HAR listing id is empty');
  }
  const url = `https://www.har.com/homedetail/${id}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(`HAR ${id}: HTTP 403 Forbidden`);
    }
    throw new Error(`HAR ${id}: HTTP ${res.status}`);
  }
  const html = await res.text();
  const harListingUrl = res.url;
  const product = extractProductFromHtml(html);
  if (!product) {
    throw new Error(`HAR ${id}: could not parse listing JSON-LD`);
  }
  const applyUrl = extractApplyLink(html) ?? '';
  return buildTilesFromProduct(id, product, harListingUrl, applyUrl, html);
}
