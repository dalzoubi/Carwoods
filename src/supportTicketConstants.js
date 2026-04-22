export const SUPPORT_TICKET_CATEGORIES = ['BUG', 'FEATURE', 'QUESTION', 'COMPLAINT'];

export const SUPPORT_TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export const SUPPORT_TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const SUPPORT_TICKET_AREAS = [
  'LEASES',
  'TENANTS',
  'PAYMENTS',
  'DOCUMENTS',
  'REQUESTS',
  'PROPERTIES',
  'NOTIFICATIONS',
  'ACCOUNT',
  'OTHER',
];

export const SUPPORT_TICKET_TITLE_MAX = 200;
export const SUPPORT_TICKET_BODY_MAX = 5000;
export const SUPPORT_TICKET_MESSAGE_MAX = 5000;

export const SUPPORT_TICKET_MAX_ATTACHMENTS = 5;
export const SUPPORT_TICKET_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const SUPPORT_TICKET_ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/json',
  'application/octet-stream',
];

export function isAllowedSupportTicketMime(contentType) {
  if (typeof contentType !== 'string') return false;
  return SUPPORT_TICKET_ALLOWED_MIME.includes(contentType.trim().toLowerCase());
}

export function formatSupportTicketFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
