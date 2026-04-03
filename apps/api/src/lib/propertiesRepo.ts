import type pg from 'pg';
import { propertyRowToPublicTile, type PublicApplyPropertyTile } from './applyPropertyMapper.js';

export type PropertyRowFull = {
  id: string;
  name: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  har_listing_id: string | null;
  listing_source: string;
  apply_visible: boolean;
  metadata: unknown;
  har_sync_status: string | null;
  har_sync_error: string | null;
  har_last_synced_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export async function listPublicApplyProperties(
  client: pg.Pool | pg.PoolClient
): Promise<PublicApplyPropertyTile[]> {
  const r = await client.query(
    `SELECT id, street, city, state, zip, har_listing_id, metadata
     FROM properties
     WHERE apply_visible = true AND deleted_at IS NULL
     ORDER BY created_at ASC`
  );
  const tiles: PublicApplyPropertyTile[] = [];
  for (const row of r.rows) {
    const t = propertyRowToPublicTile(row);
    if (t) tiles.push(t);
  }
  return tiles;
}

export async function listPropertiesAdmin(
  client: pg.Pool | pg.PoolClient
): Promise<PropertyRowFull[]> {
  const r = await client.query<PropertyRowFull>(
    `SELECT id, name, street, city, state, zip, har_listing_id, listing_source, apply_visible,
            metadata, har_sync_status, har_sync_error, har_last_synced_at,
            created_at, updated_at, deleted_at
     FROM properties
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC`
  );
  return r.rows;
}

export async function getPropertyById(
  client: pg.Pool | pg.PoolClient,
  id: string
): Promise<PropertyRowFull | null> {
  const r = await client.query<PropertyRowFull>(
    `SELECT id, name, street, city, state, zip, har_listing_id, listing_source, apply_visible,
            metadata, har_sync_status, har_sync_error, har_last_synced_at,
            created_at, updated_at, deleted_at
     FROM properties WHERE id = $1::uuid AND deleted_at IS NULL`,
    [id]
  );
  return r.rows[0] ?? null;
}

export type PropertyInsert = {
  name: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  har_listing_id: string | null;
  listing_source: string;
  apply_visible: boolean;
  metadata: unknown;
  har_sync_status: string | null;
  har_sync_error: string | null;
  har_last_synced_at: Date | null;
  created_by: string;
};

export async function insertProperty(
  client: pg.PoolClient,
  p: PropertyInsert
): Promise<PropertyRowFull> {
  const r = await client.query<PropertyRowFull>(
    `INSERT INTO properties (
       name, street, city, state, zip, har_listing_id, listing_source, apply_visible, metadata,
       har_sync_status, har_sync_error, har_last_synced_at, created_by, updated_by
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13::uuid, $13::uuid
     )
     RETURNING id, name, street, city, state, zip, har_listing_id, listing_source, apply_visible,
       metadata, har_sync_status, har_sync_error, har_last_synced_at,
       created_at, updated_at, deleted_at`,
    [
      p.name,
      p.street,
      p.city,
      p.state,
      p.zip,
      p.har_listing_id,
      p.listing_source,
      p.apply_visible,
      JSON.stringify(p.metadata ?? {}),
      p.har_sync_status,
      p.har_sync_error,
      p.har_last_synced_at,
      p.created_by,
    ]
  );
  return r.rows[0]!;
}

export type PropertyPatch = {
  name?: string | null;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  har_listing_id?: string | null;
  listing_source?: string;
  apply_visible?: boolean;
  metadata?: unknown;
  har_sync_status?: string | null;
  har_sync_error?: string | null;
  har_last_synced_at?: Date | null;
};

export async function updateProperty(
  client: pg.PoolClient,
  id: string,
  patch: PropertyPatch,
  updatedBy: string
): Promise<PropertyRowFull | null> {
  const current = await getPropertyById(client, id);
  if (!current) return null;

  const name = patch.name !== undefined ? patch.name : current.name;
  const street = patch.street ?? current.street;
  const city = patch.city ?? current.city;
  const state = patch.state ?? current.state;
  const zip = patch.zip ?? current.zip;
  const har_listing_id =
    patch.har_listing_id !== undefined ? patch.har_listing_id : current.har_listing_id;
  const listing_source = patch.listing_source ?? current.listing_source;
  const apply_visible = patch.apply_visible ?? current.apply_visible;
  const metadata =
    patch.metadata !== undefined ? patch.metadata : current.metadata;
  const har_sync_status =
    patch.har_sync_status !== undefined ? patch.har_sync_status : current.har_sync_status;
  const har_sync_error =
    patch.har_sync_error !== undefined ? patch.har_sync_error : current.har_sync_error;
  const har_last_synced_at =
    patch.har_last_synced_at !== undefined
      ? patch.har_last_synced_at
      : current.har_last_synced_at;

  const r = await client.query<PropertyRowFull>(
    `UPDATE properties SET
       name = $2,
       street = $3,
       city = $4,
       state = $5,
       zip = $6,
       har_listing_id = $7,
       listing_source = $8,
       apply_visible = $9,
       metadata = $10::jsonb,
       har_sync_status = $11,
       har_sync_error = $12,
       har_last_synced_at = $13,
       updated_by = $14::uuid,
       updated_at = now()
     WHERE id = $1::uuid AND deleted_at IS NULL
     RETURNING id, name, street, city, state, zip, har_listing_id, listing_source, apply_visible,
       metadata, har_sync_status, har_sync_error, har_last_synced_at,
       created_at, updated_at, deleted_at`,
    [
      id,
      name,
      street,
      city,
      state,
      zip,
      har_listing_id,
      listing_source,
      apply_visible,
      JSON.stringify(metadata ?? {}),
      har_sync_status,
      har_sync_error,
      har_last_synced_at,
      updatedBy,
    ]
  );
  return r.rows[0] ?? null;
}

export async function softDeleteProperty(
  client: pg.PoolClient,
  id: string,
  updatedBy: string
): Promise<boolean> {
  const r = await client.query(
    `UPDATE properties SET deleted_at = now(), updated_by = $2::uuid, updated_at = now()
     WHERE id = $1::uuid AND deleted_at IS NULL`,
    [id, updatedBy]
  );
  return (r.rowCount ?? 0) > 0;
}
