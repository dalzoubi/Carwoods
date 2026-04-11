import { validationError } from './errors.js';

export const ATTACHMENT_CONFIG_RANGES = {
  maxAttachments: { min: 1, max: 20 },
  maxImageBytes: { min: 1 * 1024 * 1024, max: 50 * 1024 * 1024 },
  maxVideoBytes: { min: 1 * 1024 * 1024, max: 500 * 1024 * 1024 },
  maxVideoDurationSeconds: { min: 1, max: 300 },
  shareExpirySeconds: { min: 5 * 60, max: 7 * 24 * 60 * 60 },
} as const;

export type AttachmentUploadConfig = {
  id: string;
  scope_type: 'GLOBAL' | 'LANDLORD';
  landlord_user_id: string | null;
  max_attachments: number;
  max_image_bytes: number;
  max_video_bytes: number;
  max_video_duration_seconds: number;
  allowed_mime_types: string[];
  allowed_extensions: string[];
  share_enabled: boolean;
  share_expiry_seconds: number;
  malware_scan_required: boolean;
  updated_by_user_id: string | null;
  updated_at: Date;
};

export type AttachmentUploadConfigInput = {
  max_attachments: number;
  max_image_bytes: number;
  max_video_bytes: number;
  max_video_duration_seconds: number;
  allowed_mime_types: string[];
  allowed_extensions: string[];
  share_enabled: boolean;
  share_expiry_seconds: number;
  malware_scan_required: boolean;
};

function assertIntInRange(value: number, min: number, max: number, field: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw validationError(`invalid_${field}`);
  }
}

export function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean);
}

export function validateAttachmentUploadConfigInput(input: AttachmentUploadConfigInput): void {
  assertIntInRange(
    input.max_attachments,
    ATTACHMENT_CONFIG_RANGES.maxAttachments.min,
    ATTACHMENT_CONFIG_RANGES.maxAttachments.max,
    'max_attachments'
  );
  assertIntInRange(
    input.max_image_bytes,
    ATTACHMENT_CONFIG_RANGES.maxImageBytes.min,
    ATTACHMENT_CONFIG_RANGES.maxImageBytes.max,
    'max_image_bytes'
  );
  assertIntInRange(
    input.max_video_bytes,
    ATTACHMENT_CONFIG_RANGES.maxVideoBytes.min,
    ATTACHMENT_CONFIG_RANGES.maxVideoBytes.max,
    'max_video_bytes'
  );
  assertIntInRange(
    input.max_video_duration_seconds,
    ATTACHMENT_CONFIG_RANGES.maxVideoDurationSeconds.min,
    ATTACHMENT_CONFIG_RANGES.maxVideoDurationSeconds.max,
    'max_video_duration_seconds'
  );
  assertIntInRange(
    input.share_expiry_seconds,
    ATTACHMENT_CONFIG_RANGES.shareExpirySeconds.min,
    ATTACHMENT_CONFIG_RANGES.shareExpirySeconds.max,
    'share_expiry_seconds'
  );
  if (!Array.isArray(input.allowed_mime_types) || input.allowed_mime_types.length === 0) {
    throw validationError('invalid_allowed_mime_types');
  }
  if (!Array.isArray(input.allowed_extensions) || input.allowed_extensions.length === 0) {
    throw validationError('invalid_allowed_extensions');
  }
}

export function extensionFromFilename(filename: string | undefined): string {
  const raw = String(filename ?? '').trim();
  const dotIdx = raw.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === raw.length - 1) return '';
  return raw.slice(dotIdx + 1).toLowerCase();
}

export function mimeMatchesAllowed(contentType: string, allowedMimeTypes: string[]): boolean {
  const mime = String(contentType ?? '').trim().toLowerCase();
  if (!mime) return false;
  return allowedMimeTypes.some((candidate) => {
    const c = String(candidate ?? '').trim().toLowerCase();
    if (!c) return false;
    if (c.endsWith('/*')) {
      const prefix = c.slice(0, c.length - 1);
      return mime.startsWith(prefix);
    }
    return mime === c;
  });
}

