import type { PoolClient, QueryResult } from './db.js';
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
  landlord_user_id?: string | null;
  landlord_first_name?: string | null;
  landlord_last_name?: string | null;
  landlord_email?: string | null;
  landlord_name?: string | null;
};

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export async function listPublicApplyProperties(
  client: Queryable
): Promise<PublicApplyPropertyTile[]> {
  const r = await client.query<PropertyRowFull>(
    `SELECT p.id, p.street, p.city, p.state, p.zip, p.har_listing_id, p.metadata
     FROM properties p
     LEFT JOIN users landlord
       ON landlord.id = p.created_by
      AND landlord.role = 'LANDLORD'
     WHERE p.apply_visible = 1
       AND p.deleted_at IS NULL
       AND (landlord.id IS NULL OR landlord.status = 'ACTIVE')
     ORDER BY p.created_at ASC`
  );
  const tiles: PublicApplyPropertyTile[] = [];
  for (const row of r.rows) {
    const t = propertyRowToPublicTile(row);
    if (t) tiles.push(t);
  }
  return tiles;
}

export async function listPropertiesLandlord(
  client: Queryable
): Promise<PropertyRowFull[]> {
  const r = await client.query<PropertyRowFull>(
    `SELECT p.id, p.name, p.street, p.city, p.state, p.zip, p.har_listing_id, p.listing_source, p.apply_visible,
            p.metadata, p.har_sync_status, p.har_sync_error, p.har_last_synced_at,
            p.created_at, p.updated_at, p.deleted_at,
            landlord.id AS landlord_user_id,
            landlord.first_name AS landlord_first_name,
            landlord.last_name AS landlord_last_name,
            landlord.email AS landlord_email,
            NULLIF(LTRIM(RTRIM(CONCAT(COALESCE(landlord.first_name, ''), ' ', COALESCE(landlord.last_name, '')))), '') AS landlord_name
     FROM properties p
     LEFT JOIN users landlord
       ON landlord.id = p.created_by
     WHERE p.deleted_at IS NULL
     ORDER BY p.created_at DESC`
  );
  return r.rows;
}

export async function listPropertiesForActor(
  client: Queryable,
  actorRole: string,
  actorUserId: string
): Promise<PropertyRowFull[]> {
  const r = await client.query<PropertyRowFull>(
    `SELECT p.id, p.name, p.street, p.city, p.state, p.zip, p.har_listing_id, p.listing_source, p.apply_visible,
            p.metadata, p.har_sync_status, p.har_sync_error, p.har_last_synced_at,
            p.created_at, p.updated_at, p.deleted_at,
            landlord.id AS landlord_user_id,
            landlord.first_name AS landlord_first_name,
            landlord.last_name AS landlord_last_name,
            landlord.email AS landlord_email,
            NULLIF(LTRIM(RTRIM(CONCAT(COALESCE(landlord.first_name, ''), ' ', COALESCE(landlord.last_name, '')))), '') AS landlord_name
     FROM properties p
     LEFT JOIN users landlord
       ON landlord.id = p.created_by
     WHERE p.deleted_at IS NULL
       AND ($1 = 'ADMIN' OR p.created_by = $2)
     ORDER BY p.created_at DESC`,
    [actorRole.trim().toUpperCase(), actorUserId]
  );
  return r.rows;
}

export async function getPropertyById(
  client: Queryable,
  id: string
): Promise<PropertyRowFull | null> {
  const r = await client.query<PropertyRowFull>(
    `SELECT id, name, street, city, state, zip, har_listing_id, listing_source, apply_visible,
            metadata, har_sync_status, har_sync_error, har_last_synced_at,
            created_at, updated_at, deleted_at
     FROM properties WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function getPropertyByIdForActor(
  client: Queryable,
  id: string,
  actorRole: string,
  actorUserId: string
): Promise<PropertyRowFull | null> {
  const r = await client.query<PropertyRowFull>(
    `SELECT id, name, street, city, state, zip, har_listing_id, listing_source, apply_visible,
            metadata, har_sync_status, har_sync_error, har_last_synced_at,
            created_at, updated_at, deleted_at
     FROM properties
     WHERE id = $1
       AND deleted_at IS NULL
       AND ($2 = 'ADMIN' OR created_by = $3)`,
    [id, actorRole.trim().toUpperCase(), actorUserId]
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
  client: PoolClient,
  p: PropertyInsert
): Promise<PropertyRowFull> {
  const newId = `00000000-0000-0000-0000-000000000000`; // placeholder; NEWID() used in SQL
  void newId; // not used directly
  const r = await client.query<PropertyRowFull>(
    `INSERT INTO properties (
       id, name, street, city, state, zip, har_listing_id, listing_source, apply_visible, metadata,
       har_sync_status, har_sync_error, har_last_synced_at, created_by, updated_by
     )
     OUTPUT INSERTED.id, INSERTED.name, INSERTED.street, INSERTED.city, INSERTED.state,
            INSERTED.zip, INSERTED.har_listing_id, INSERTED.listing_source, INSERTED.apply_visible,
            INSERTED.metadata, INSERTED.har_sync_status, INSERTED.har_sync_error,
            INSERTED.har_last_synced_at, INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
     VALUES (
       NEWID(), $1, $2, $3, $4, $5, $6, $7, $8, $9,
       $10, $11, $12, $13, $13
     )`,
    [
      p.name,
      p.street,
      p.city,
      p.state,
      p.zip,
      p.har_listing_id,
      p.listing_source,
      p.apply_visible ? 1 : 0,
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
  client: PoolClient,
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
  const har_listing_id = patch.har_listing_id !== undefined ? patch.har_listing_id : current.har_listing_id;
  const listing_source = patch.listing_source ?? current.listing_source;
  const apply_visible = patch.apply_visible ?? current.apply_visible;
  const metadata = patch.metadata !== undefined ? patch.metadata : current.metadata;
  const har_sync_status = patch.har_sync_status !== undefined ? patch.har_sync_status : current.har_sync_status;
  const har_sync_error = patch.har_sync_error !== undefined ? patch.har_sync_error : current.har_sync_error;
  const har_last_synced_at = patch.har_last_synced_at !== undefined ? patch.har_last_synced_at : current.har_last_synced_at;

  const r = await client.query<PropertyRowFull>(
    `UPDATE properties SET
       name               = $2,
       street             = $3,
       city               = $4,
       state              = $5,
       zip                = $6,
       har_listing_id     = $7,
       listing_source     = $8,
       apply_visible      = $9,
       metadata           = $10,
       har_sync_status    = $11,
       har_sync_error     = $12,
       har_last_synced_at = $13,
       updated_by         = $14,
       updated_at         = GETUTCDATE()
     OUTPUT INSERTED.id, INSERTED.name, INSERTED.street, INSERTED.city, INSERTED.state,
            INSERTED.zip, INSERTED.har_listing_id, INSERTED.listing_source, INSERTED.apply_visible,
            INSERTED.metadata, INSERTED.har_sync_status, INSERTED.har_sync_error,
            INSERTED.har_last_synced_at, INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
     WHERE id = $1 AND deleted_at IS NULL`,
    [
      id,
      name,
      street,
      city,
      state,
      zip,
      har_listing_id,
      listing_source,
      apply_visible ? 1 : 0,
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
  client: PoolClient,
  id: string,
  updatedBy: string
): Promise<boolean> {
  const r = await client.query(
    `UPDATE properties SET deleted_at = GETUTCDATE(), updated_by = $2, updated_at = GETUTCDATE()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id, updatedBy]
  );
  return (r.rowCount ?? 0) > 0;
}
