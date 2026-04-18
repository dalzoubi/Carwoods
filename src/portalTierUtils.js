/**
 * Subscription tier helpers for the portal SPA (`/api/portal/me` → `meData.user.tier`).
 *
 * Populated from the signed-in user's `tier_id` (e.g. landlords). Tenants typically have no `user.tier`.
 */

/** @param {unknown} meData */
export function landlordTierLimits(meData) {
  return meData?.user?.tier?.limits ?? null;
}

/** @param {unknown} meData */
export function isLandlordOrAdminWithFreeStylePlan(meData) {
  const name = String(meData?.user?.tier?.name ?? '').toUpperCase();
  return name === 'FREE';
}

/** @param {unknown} limits */
export function allowsCsvExport(limits) {
  if (!limits || typeof limits !== 'object') return true;
  return Boolean(limits.csv_export_enabled);
}

/** @param {unknown} limits */
export function allowsAiRouting(limits) {
  if (!limits || typeof limits !== 'object') return true;
  return Boolean(limits.ai_routing_enabled);
}

/** @param {unknown} limits */
export function allowsSmsChannel(limits) {
  if (!limits || typeof limits !== 'object') return true;
  const ch = limits.notification_channels;
  return Array.isArray(ch) && ch.includes('sms');
}

/** @param {unknown} limits */
export function allowsRequestPhotoVideoAttachments(limits) {
  if (!limits || typeof limits !== 'object') return true;
  return limits.request_photo_video_attachments_enabled !== false;
}

/** @param {unknown} limits */
export function allowsDocumentCenter(limits) {
  if (!limits || typeof limits !== 'object') return true;
  return limits.document_center_enabled !== false;
}

/** @param {unknown} limits */
export function allowsPropertyApplyVisibilityEdit(limits) {
  if (!limits || typeof limits !== 'object') return true;
  return limits.property_apply_visibility_editable !== false;
}

/** @param {unknown} limits */
export function allowsPropertyElsaAutoSendEdit(limits) {
  if (!limits || typeof limits !== 'object') return true;
  return limits.property_elsa_auto_send_editable !== false;
}

/** @param {unknown} limits */
export function allowsPayments(limits) {
  if (!limits || typeof limits !== 'object') return true;
  return limits.payments_enabled !== false;
}

/**
 */
export function maxPropertiesForLandlord(limits) {
  if (!limits || typeof limits !== 'object') return -1;
  const n = Number(limits.max_properties);
  return Number.isFinite(n) ? n : -1;
}
