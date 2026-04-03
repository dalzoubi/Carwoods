import { mergeMetadataApply } from './applyPropertyMapper.js';
import { fetchHarListingTile } from './harListingFetch.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

export type HarColumns = {
  har_listing_id: string | null;
  listing_source: string;
  metadata: Record<string, unknown>;
  har_sync_status: string | null;
  har_sync_error: string | null;
  har_last_synced_at: Date | null;
};

export async function harColumnsForCreate(body: {
  har_listing_id?: string | null;
  metadata?: unknown;
}): Promise<HarColumns> {
  const metaBase = asRecord(body.metadata);
  const harId = body.har_listing_id?.trim() || null;
  if (!harId) {
    return {
      har_listing_id: null,
      listing_source: 'MANUAL',
      metadata: metaBase,
      har_sync_status: null,
      har_sync_error: null,
      har_last_synced_at: null,
    };
  }
  const tile = await fetchHarListingTile(harId);
  return {
    har_listing_id: harId,
    listing_source: 'HAR_SYNC',
    metadata: mergeMetadataApply(metaBase, tile),
    har_sync_status: 'OK',
    har_sync_error: null,
    har_last_synced_at: new Date(),
  };
}

export async function harColumnsForPatch(
  current: {
    har_listing_id: string | null;
    listing_source: string;
    metadata: unknown;
    har_sync_status: string | null;
    har_sync_error: string | null;
    har_last_synced_at: Date | null;
  },
  body: { har_listing_id?: string | null; metadata?: unknown }
): Promise<HarColumns> {
  const metaBase = { ...asRecord(current.metadata) };
  if (body.metadata !== undefined) {
    Object.assign(metaBase, asRecord(body.metadata));
  }

  if (body.har_listing_id === undefined) {
    return {
      har_listing_id: current.har_listing_id,
      listing_source: current.listing_source,
      metadata: metaBase,
      har_sync_status: current.har_sync_status,
      har_sync_error: current.har_sync_error,
      har_last_synced_at: current.har_last_synced_at,
    };
  }

  const nextHar = body.har_listing_id?.trim() || null;
  if (!nextHar) {
    return {
      har_listing_id: null,
      listing_source: 'MANUAL',
      metadata: metaBase,
      har_sync_status: null,
      har_sync_error: null,
      har_last_synced_at: null,
    };
  }

  const tile = await fetchHarListingTile(nextHar);
  return {
    har_listing_id: nextHar,
    listing_source: 'HAR_SYNC',
    metadata: mergeMetadataApply(metaBase, tile),
    har_sync_status: 'OK',
    har_sync_error: null,
    har_last_synced_at: new Date(),
  };
}
