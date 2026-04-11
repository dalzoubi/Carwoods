/**
 * Fallback when GET /api/portal/me omits attachment_upload_limits.
 * Keep aligned with apps/api/src/domain/requestValidation.ts MAX_PHOTO_BYTES.
 */
export const FALLBACK_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * @param {unknown} meData
 * @returns {number}
 */
export function maxImageBytesFromMeData(meData) {
  const raw = meData && typeof meData === 'object' && meData !== null
    ? /** @type {{ attachment_upload_limits?: { max_image_bytes?: unknown } }} */ (meData).attachment_upload_limits
    : undefined;
  const n = Number(raw?.max_image_bytes);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return FALLBACK_MAX_IMAGE_BYTES;
}

/**
 * @param {number} maxBytes
 * @returns {number}
 */
export function maxImageMbForDisplay(maxBytes) {
  return Math.max(1, Math.round(maxBytes / (1024 * 1024)));
}
