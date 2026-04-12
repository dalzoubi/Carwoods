import { ok, fail, isValidUuid, type ValidationResult } from './validation.js';

export const MAX_REQUEST_ATTACHMENTS = 3;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const PHOTO_MIME_PREFIXES = ['image/'];
const VIDEO_MIME_PREFIXES = ['video/'];
export type UploadMediaType = 'PHOTO' | 'VIDEO';

export function detectMediaType(contentType: string): UploadMediaType | null {
  const mime = contentType.trim().toLowerCase();
  if (!mime) return null;
  if (PHOTO_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) return 'PHOTO';
  if (VIDEO_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) return 'VIDEO';
  return null;
}

export function maxBytesForMediaType(mediaType: UploadMediaType): number {
  if (mediaType === 'PHOTO') return MAX_PHOTO_BYTES;
  return MAX_VIDEO_BYTES;
}

export function validateRequestId(id: string | undefined): ValidationResult {
  if (!id) return fail('id', 'missing_id');
  if (!isValidUuid(id)) return fail('id', 'not_found');
  return ok();
}

export function validateCreateRequest(input: {
  leaseId: string | undefined;
  propertyId: string | undefined;
  categoryCode: string | undefined;
  priorityCode: string | undefined;
  title: string | undefined;
  description: string | undefined;
}): ValidationResult {
  if (
    !input.leaseId ||
    !input.propertyId ||
    !input.categoryCode ||
    !input.priorityCode ||
    !input.title ||
    !input.description
  ) {
    return fail('fields', 'missing_required_fields');
  }
  if (input.title.length > 500) {
    return fail('title', 'field_too_long');
  }
  if (input.description.length > 5000) {
    return fail('description', 'field_too_long');
  }
  return ok();
}

/** Portal UI/API limit for messages posted via `postRequestMessage` (email/Elsa use separate paths). */
export const PORTAL_REQUEST_MESSAGE_MAX_CHARS = 200;

export function validateMessageBody(body: string | undefined): ValidationResult {
  if (!body) return fail('body', 'missing_body');
  if (body.length > 5000) return fail('body', 'body_too_long');
  return ok();
}

/** Stricter cap for portal-posted thread messages only. */
export function validatePortalRequestMessageBody(body: string | undefined): ValidationResult {
  const base = validateMessageBody(body);
  if (!base.valid) return base;
  if (body!.length > PORTAL_REQUEST_MESSAGE_MAX_CHARS) {
    return fail('body', 'body_too_long_portal');
  }
  return ok();
}

export function validateUploadFile(input: {
  filename: string | undefined;
  contentType: string | undefined;
  fileSizeBytes: number;
}): ValidationResult {
  if (!input.filename || !input.contentType || !Number.isFinite(input.fileSizeBytes) || input.fileSizeBytes <= 0) {
    return fail('file', 'missing_or_invalid_file_fields');
  }
  const mediaType = detectMediaType(input.contentType);
  if (!mediaType) return fail('content_type', 'unsupported_mime_type');
  const maxBytes = maxBytesForMediaType(mediaType);
  if (input.fileSizeBytes > maxBytes) {
    return fail('file_size_bytes', 'file_too_large');
  }
  return ok();
}

export function validateFinalizeUpload(input: {
  storagePath: string | undefined;
  filename: string | undefined;
  contentType: string | undefined;
  fileSizeBytes: number;
}): ValidationResult {
  if (
    !input.storagePath ||
    !input.filename ||
    !input.contentType ||
    !Number.isFinite(input.fileSizeBytes) ||
    input.fileSizeBytes <= 0
  ) {
    return fail('file', 'missing_or_invalid_file_fields');
  }
  const mediaType = detectMediaType(input.contentType);
  if (!mediaType) return fail('content_type', 'unsupported_mime_type');
  const maxBytes = maxBytesForMediaType(mediaType);
  if (input.fileSizeBytes > maxBytes) {
    return fail('file_size_bytes', 'file_too_large');
  }
  return ok();
}
