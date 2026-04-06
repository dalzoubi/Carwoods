/**
 * Patch an existing property (management access required).
 *
 * Business rules:
 * - Property must exist.
 * - HAR sync runs when har_listing_id or metadata changes; failure returns UNPROCESSABLE.
 */

import {
  getPropertyByIdForActor,
  updateProperty as updatePropertyRepo,
  type PropertyRowFull,
  type PropertyPatch,
} from '../../lib/propertiesRepo.js';
import { harColumnsForPatch } from '../../lib/propertyHarSync.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, unprocessable, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type UpdatePropertyInput = {
  propertyId: string | undefined;
  actorUserId: string;
  actorRole: string;
  name?: string | null;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  apply_visible?: boolean;
  har_listing_id?: string | null;
  metadata?: unknown;
  /** Pass `true` to indicate the key was present in the body (even if null). */
  har_listing_id_present?: boolean;
  metadata_present?: boolean;
  name_present?: boolean;
};

export type UpdatePropertyOutput = {
  property: PropertyRowFull;
};

export async function updateProperty(
  db: TransactionPool,
  input: UpdatePropertyInput
): Promise<UpdatePropertyOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.propertyId) throw validationError('missing_id');

  const pool = db;
  const current = await getPropertyByIdForActor(
    pool,
    input.propertyId,
    input.actorRole,
    input.actorUserId
  );
  if (!current) throw notFound();

  let har: Awaited<ReturnType<typeof harColumnsForPatch>>;
  try {
    har = await harColumnsForPatch(
      {
        har_listing_id: current.har_listing_id,
        listing_source: current.listing_source,
        metadata: current.metadata,
        har_sync_status: current.har_sync_status,
        har_sync_error: current.har_sync_error,
        har_last_synced_at: current.har_last_synced_at,
      },
      {
        har_listing_id: input.har_listing_id,
        metadata: input.metadata,
      }
    );
  } catch (e) {
    throw unprocessable('har_sync_failed', e instanceof Error ? e.message : undefined);
  }

  const patch: PropertyPatch = {
    name: input.name_present ? input.name : undefined,
    street: input.street,
    city: input.city,
    state: input.state,
    zip: input.zip,
    har_listing_id: har.har_listing_id,
    listing_source: har.listing_source,
    apply_visible: input.apply_visible,
    metadata: har.metadata,
    har_sync_status: har.har_sync_status,
    har_sync_error: har.har_sync_error,
    har_last_synced_at: har.har_last_synced_at,
  };

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const before = await getPropertyByIdForActor(
      client,
      input.propertyId,
      input.actorRole,
      input.actorUserId
    );
    if (!before) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    const row = await updatePropertyRepo(
      client as Parameters<typeof updatePropertyRepo>[0],
      input.propertyId,
      patch,
      input.actorUserId
    );
    if (!row) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'PROPERTY',
      entityId: row.id,
      action: 'UPDATE',
      before,
      after: row,
    });
    await client.query('COMMIT');
    return { property: row };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
