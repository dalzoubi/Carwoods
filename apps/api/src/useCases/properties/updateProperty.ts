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
import { findUserById } from '../../lib/usersRepo.js';
import { validateUpdatePropertyAddress } from '../../domain/propertyValidation.js';
import { forbidden, notFound, unprocessable, validationError } from '../../domain/errors.js';
import { hasLandlordAccess, Role } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';
import { getTierLimitsForUserId } from '../../lib/subscriptionTierCapabilities.js';
import { getTierByName } from '../../lib/subscriptionTiersRepo.js';

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
  apply_visible_present?: boolean;
  har_listing_id?: string | null;
  metadata?: unknown;
  refresh_har?: boolean;
  /** Pass `true` to indicate the key was present in the body (even if null). */
  har_listing_id_present?: boolean;
  metadata_present?: boolean;
  name_present?: boolean;
  landlord_user_id?: string;
  landlord_user_id_present?: boolean;
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

  const addressValidation = validateUpdatePropertyAddress({
    street: input.street,
    city: input.city,
    state: input.state,
    zip: input.zip,
  });
  if (!addressValidation.valid) throw validationError(addressValidation.message);

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
        refresh_har: input.refresh_har,
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

  if (input.landlord_user_id_present) {
    const isAdmin = input.actorRole.trim().toUpperCase() === Role.ADMIN;
    if (!isAdmin) throw forbidden();
    const landlordUserId = String(input.landlord_user_id ?? '').trim();
    if (!landlordUserId) {
      throw validationError('landlord_user_id is required when reassigning property landlord');
    }
    const landlord = await findUserById(db, landlordUserId);
    const isActiveLandlord = Boolean(
      landlord
      && String(landlord.role ?? '').trim().toUpperCase() === Role.LANDLORD
      && String(landlord.status ?? '').trim().toUpperCase() === 'ACTIVE'
    );
    if (!isActiveLandlord) {
      throw validationError('landlord_user_id must reference an active landlord');
    }
    patch.created_by = landlordUserId;
  }

  const ownerIdForApplyVisibility = patch.created_by ?? current.created_by;
  if (ownerIdForApplyVisibility) {
    let visibilityLimits = await getTierLimitsForUserId(db, ownerIdForApplyVisibility);
    if (!visibilityLimits) {
      const free = await getTierByName(db, 'FREE');
      visibilityLimits = free?.limits ?? null;
    }
    if (visibilityLimits && !visibilityLimits.property_apply_visibility_editable) {
      if (Boolean(input.apply_visible_present) && input.apply_visible === true) {
        throw validationError('subscription_feature_not_available');
      }
      patch.apply_visible = false;
    }
  }

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
