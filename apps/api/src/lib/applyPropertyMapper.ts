import type { HarApplyTile } from './harListingFetch.js';

export type PublicApplyPropertyTile = {
  id: string;
  addressLine: string;
  cityStateZip: string;
  monthlyRentLabel: string;
  photoUrl: string;
  harListingUrl: string;
  applyUrl: string;
  detailLines: string[];
};

type PropertyRow = {
  id: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  har_listing_id: string | null;
  metadata: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === 'object' && !Array.isArray(v));
}

function formatCityStateZip(city: string, state: string, zip: string): string {
  const a = [city, state].filter(Boolean).join(', ');
  return (a ? `${a} ` : '') + (zip || '');
}

/**
 * Maps a DB row to the public `/apply` DTO, or null if not exposable (no apply URL / missing fields).
 */
export function propertyRowToPublicTile(row: PropertyRow): PublicApplyPropertyTile | null {
  const meta = isRecord(row.metadata) ? row.metadata : {};
  const applyRaw = meta.apply;
  const apply = isRecord(applyRaw) ? applyRaw : null;
  if (!apply) return null;

  const applyUrl = typeof apply.applyUrl === 'string' ? apply.applyUrl.trim() : '';
  if (!applyUrl) return null;

  const addressLine =
    typeof apply.addressLine === 'string' && apply.addressLine.trim()
      ? apply.addressLine
      : row.street;
  let cityStateZip =
    typeof apply.cityStateZip === 'string' && apply.cityStateZip.trim()
      ? apply.cityStateZip
      : formatCityStateZip(row.city, row.state, row.zip).trim();

  if (!cityStateZip) {
    cityStateZip = formatCityStateZip(row.city, row.state, row.zip).trim();
  }

  const harListingUrl =
    typeof apply.harListingUrl === 'string' && apply.harListingUrl.trim()
      ? apply.harListingUrl
      : row.har_listing_id
        ? `https://www.har.com/homedetail/${row.har_listing_id}`
        : '';

  const monthlyRentLabel =
    typeof apply.monthlyRentLabel === 'string' ? apply.monthlyRentLabel : '';
  const photoUrl = typeof apply.photoUrl === 'string' ? apply.photoUrl : '';

  let detailLines: string[] = [];
  if (Array.isArray(apply.detailLines)) {
    detailLines = apply.detailLines.filter((x): x is string => typeof x === 'string');
  }

  const id =
    typeof apply.id === 'string' && apply.id.trim() ? apply.id : `prop-${row.id}`;

  const tile: PublicApplyPropertyTile = {
    id,
    addressLine,
    cityStateZip,
    monthlyRentLabel,
    photoUrl,
    harListingUrl,
    applyUrl,
    detailLines,
  };

  for (const k of [
    'id',
    'addressLine',
    'cityStateZip',
    'monthlyRentLabel',
    'photoUrl',
    'harListingUrl',
    'applyUrl',
  ] as const) {
    if (!String(tile[k]).trim() && k !== 'monthlyRentLabel' && k !== 'photoUrl') {
      return null;
    }
  }
  if (!tile.applyUrl) return null;
  return tile;
}

export function mergeMetadataApply(
  existingMetadata: Record<string, unknown>,
  harTile: HarApplyTile
): Record<string, unknown> {
  return {
    ...existingMetadata,
    apply: {
      id: harTile.id,
      addressLine: harTile.addressLine,
      cityStateZip: harTile.cityStateZip,
      monthlyRentLabel: harTile.monthlyRentLabel,
      photoUrl: harTile.photoUrl,
      harListingUrl: harTile.harListingUrl,
      applyUrl: harTile.applyUrl,
      detailLines: harTile.detailLines,
    },
  };
}
