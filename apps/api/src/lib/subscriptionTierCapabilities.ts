/**
 * Resolve subscription tier limits for enforcement (landlord = users.tier_id;
 * request/property-scoped rules use property owner).
 */

import { validationError } from '../domain/errors.js';
import { findUserById } from './usersRepo.js';
import { getTierById, getTierByName } from './subscriptionTiersRepo.js';
import type { TierLimits } from './subscriptionTiersRepo.js';
import type { Queryable } from '../useCases/types.js';

export type SubscriptionFeaturesPayload = {
  ai_routing_enabled: boolean;
  request_photo_video_attachments_enabled: boolean;
  csv_export_enabled: boolean;
  sms_channel_enabled: boolean;
  notification_email_enabled: boolean;
};

export function tierLimitsToSubscriptionFeatures(limits: TierLimits): SubscriptionFeaturesPayload {
  return {
    ai_routing_enabled: limits.ai_routing_enabled,
    request_photo_video_attachments_enabled: limits.request_photo_video_attachments_enabled,
    csv_export_enabled: limits.csv_export_enabled,
    sms_channel_enabled: limits.notification_channels.includes('sms'),
    notification_email_enabled: limits.notification_channels.includes('email'),
  };
}

export async function getTierLimitsForUserId(
  db: Queryable,
  userId: string
): Promise<TierLimits | null> {
  const user = await findUserById(db, userId);
  if (!user?.tier_id) return null;
  const tier = await getTierById(db, user.tier_id);
  return tier?.limits ?? null;
}

/** Property owner (`properties.created_by`) tier limits, or null if owner has no tier. */
export async function getTierLimitsForPropertyId(
  db: Queryable,
  propertyId: string
): Promise<TierLimits | null> {
  const r = await db.query<{ landlord_id: string }>(
    `SELECT TOP 1 created_by AS landlord_id
     FROM properties
     WHERE id = $1 AND deleted_at IS NULL`,
    [propertyId]
  );
  const landlordId = r.rows[0]?.landlord_id;
  if (!landlordId) return null;
  return getTierLimitsForUserId(db, landlordId);
}

export async function getTierLimitsForRequestId(
  db: Queryable,
  requestId: string
): Promise<TierLimits | null> {
  const r = await db.query<{ property_id: string }>(
    `SELECT TOP 1 property_id
     FROM maintenance_requests
     WHERE id = $1 AND deleted_at IS NULL`,
    [requestId]
  );
  const propertyId = r.rows[0]?.property_id;
  if (!propertyId) return null;
  return getTierLimitsForPropertyId(db, propertyId);
}

/**
 * Same ordering as findTenantRequestDefaults: primary active lease → property → owner tier.
 */
export async function getTierLimitsForTenantPrimaryLease(
  db: Queryable,
  tenantUserId: string
): Promise<TierLimits | null> {
  const r = await db.query<{ landlord_id: string }>(
    `SELECT TOP 1 p.created_by AS landlord_id
     FROM lease_tenants lt
     JOIN leases l ON l.id = lt.lease_id
     JOIN properties p ON p.id = l.property_id
     WHERE lt.user_id = $1
       AND l.deleted_at IS NULL
       AND p.deleted_at IS NULL
       AND (lt.access_end_at IS NULL OR lt.access_end_at > SYSDATETIMEOFFSET())
     ORDER BY
       CASE WHEN lt.access_end_at IS NULL THEN 0 ELSE 1 END,
       lt.access_start_at DESC,
       lt.created_at DESC`,
    [tenantUserId]
  );
  const landlordId = r.rows[0]?.landlord_id;
  if (!landlordId) return null;
  return getTierLimitsForUserId(db, landlordId);
}

export async function countActivePropertiesForLandlord(
  db: Queryable,
  landlordUserId: string
): Promise<number> {
  const r = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c
     FROM properties
     WHERE created_by = $1 AND deleted_at IS NULL`,
    [landlordUserId]
  );
  return Number(r.rows[0]?.c ?? 0);
}

/** Landlord tier for a request's property; falls back to FREE tier row when owner has no tier_id. */
export async function getEffectiveTierLimitsForRequest(
  db: Queryable,
  requestId: string
): Promise<TierLimits> {
  let lim = await getTierLimitsForRequestId(db, requestId);
  if (!lim) {
    const free = await getTierByName(db, 'FREE');
    lim = free?.limits ?? null;
  }
  if (!lim) {
    throw validationError('tier_configuration_missing');
  }
  return lim;
}

export async function assertAiRoutingEnabledForRequest(
  db: Queryable,
  requestId: string
): Promise<void> {
  const lim = await getEffectiveTierLimitsForRequest(db, requestId);
  if (!lim.ai_routing_enabled) {
    throw validationError('subscription_feature_not_available');
  }
}

export async function assertRequestPhotoVideoAttachmentsEnabled(
  db: Queryable,
  requestId: string
): Promise<void> {
  const lim = await getEffectiveTierLimitsForRequest(db, requestId);
  if (!lim.request_photo_video_attachments_enabled) {
    throw validationError('subscription_feature_not_available');
  }
}
