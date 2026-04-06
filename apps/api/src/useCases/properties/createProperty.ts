/**
 * Create a new property (management access required).
 *
 * Business rules:
 * - street, city, state, zip are required.
 * - HAR listing sync is attempted if har_listing_id is supplied; failure returns UNPROCESSABLE.
 */

import { insertProperty, type PropertyRowFull, type PropertyInsert } from '../../lib/propertiesRepo.js';
import { harColumnsForCreate } from '../../lib/propertyHarSync.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { validateCreateProperty } from '../../domain/propertyValidation.js';
import { forbidden, unprocessable, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type CreatePropertyInput = {
  actorUserId: string;
  actorRole: string;
  name?: string | null;
  street: string | undefined;
  city: string | undefined;
  state: string | undefined;
  zip: string | undefined;
  apply_visible?: boolean;
  har_listing_id?: string | null;
  metadata?: unknown;
};

export type CreatePropertyOutput = {
  property: PropertyRowFull;
};

export async function createProperty(
  db: TransactionPool,
  input: CreatePropertyInput
): Promise<CreatePropertyOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const fieldValidation = validateCreateProperty({
    street: input.street,
    city: input.city,
    state: input.state,
    zip: input.zip,
  });
  if (!fieldValidation.valid) throw validationError(fieldValidation.message);

  let har: Awaited<ReturnType<typeof harColumnsForCreate>>;
  try {
    har = await harColumnsForCreate({
      har_listing_id: input.har_listing_id,
      metadata: input.metadata,
    });
  } catch (e) {
    throw unprocessable('har_sync_failed', e instanceof Error ? e.message : undefined);
  }

  const insert: PropertyInsert = {
    name: input.name ?? null,
    street: input.street!,
    city: input.city!,
    state: input.state!,
    zip: input.zip!,
    har_listing_id: har.har_listing_id,
    listing_source: har.listing_source,
    apply_visible: input.apply_visible ?? false,
    metadata: har.metadata,
    har_sync_status: har.har_sync_status,
    har_sync_error: har.har_sync_error,
    har_last_synced_at: har.har_last_synced_at,
    created_by: input.actorUserId,
  };

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const row = await insertProperty(client as Parameters<typeof insertProperty>[0], insert);
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'PROPERTY',
      entityId: row.id,
      action: 'CREATE',
      before: null,
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
