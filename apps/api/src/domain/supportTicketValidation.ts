import { validationError } from './errors.js';
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../lib/supportTicketsRepo.js';

export const SUPPORT_TICKET_CATEGORIES: ReadonlyArray<SupportTicketCategory> = [
  'BUG',
  'FEATURE',
  'QUESTION',
  'COMPLAINT',
];

export const SUPPORT_TICKET_STATUSES: ReadonlyArray<SupportTicketStatus> = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

export const SUPPORT_TICKET_PRIORITIES: ReadonlyArray<SupportTicketPriority> = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

export const SUPPORT_TICKET_AREAS: ReadonlyArray<string> = [
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
export const SUPPORT_TICKET_ALLOWED_MIME: ReadonlyArray<string> = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/json',
  'application/octet-stream',
];

export function isValidCategory(v: unknown): v is SupportTicketCategory {
  return typeof v === 'string' && SUPPORT_TICKET_CATEGORIES.includes(v.toUpperCase() as SupportTicketCategory);
}

export function isValidStatus(v: unknown): v is SupportTicketStatus {
  return typeof v === 'string' && SUPPORT_TICKET_STATUSES.includes(v.toUpperCase() as SupportTicketStatus);
}

export function isValidPriority(v: unknown): v is SupportTicketPriority {
  return typeof v === 'string' && SUPPORT_TICKET_PRIORITIES.includes(v.toUpperCase() as SupportTicketPriority);
}

export function isValidArea(v: unknown): boolean {
  return typeof v === 'string' && SUPPORT_TICKET_AREAS.includes(v.toUpperCase());
}

export function assertCreateTicketInput(input: {
  title?: string;
  descriptionMarkdown?: string;
  category?: string;
  area?: string | null;
}): {
  title: string;
  descriptionMarkdown: string;
  category: SupportTicketCategory;
  area: string | null;
} {
  const title = (input.title ?? '').trim();
  const descriptionMarkdown = (input.descriptionMarkdown ?? '').trim();
  if (!title) throw validationError('title_required');
  if (title.length > SUPPORT_TICKET_TITLE_MAX) throw validationError('title_too_long');
  if (!descriptionMarkdown) throw validationError('description_required');
  if (descriptionMarkdown.length > SUPPORT_TICKET_BODY_MAX) throw validationError('description_too_long');
  if (!isValidCategory(input.category)) throw validationError('invalid_category');
  let area: string | null = null;
  if (input.area != null && input.area !== '') {
    if (!isValidArea(input.area)) throw validationError('invalid_area');
    area = String(input.area).toUpperCase();
  }
  return {
    title,
    descriptionMarkdown,
    category: String(input.category).toUpperCase() as SupportTicketCategory,
    area,
  };
}

export function assertMessageBody(body: string | undefined): string {
  const v = (body ?? '').trim();
  if (!v) throw validationError('body_required');
  if (v.length > SUPPORT_TICKET_MESSAGE_MAX) throw validationError('body_too_long');
  return v;
}

export function assertAttachmentIntent(input: {
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
}): { filename: string; contentType: string; sizeBytes: number } {
  const filename = (input.filename ?? '').trim();
  const contentType = (input.contentType ?? '').trim().toLowerCase();
  const sizeBytes = Math.trunc(Number(input.sizeBytes ?? 0));
  if (!filename) throw validationError('filename_required');
  if (filename.length > 260) throw validationError('filename_too_long');
  if (!contentType) throw validationError('content_type_required');
  if (!SUPPORT_TICKET_ALLOWED_MIME.includes(contentType)) {
    throw validationError('content_type_not_allowed');
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw validationError('invalid_file_size');
  if (sizeBytes > SUPPORT_TICKET_MAX_ATTACHMENT_BYTES) throw validationError('file_too_large');
  return { filename, contentType, sizeBytes };
}
