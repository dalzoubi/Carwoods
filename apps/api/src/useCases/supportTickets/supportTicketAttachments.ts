import type { QueryResult } from '../../lib/db.js';
import {
  getSupportTicketAttachmentById,
  getSupportTicketById,
  insertSupportTicketAttachmentIntent,
  finalizeSupportTicketAttachment,
  type SupportTicketAttachmentRow,
} from '../../lib/supportTicketsRepo.js';
import { assertAttachmentIntent } from '../../domain/supportTicketValidation.js';
import { notFound, forbidden } from '../../domain/errors.js';
import {
  buildAttachmentReadUrl,
  buildAttachmentUploadUrl,
} from '../../lib/requestAttachmentStorage.js';
import { Role } from '../../domain/constants.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const UPLOAD_URL_EXPIRES_SECONDS = 15 * 60;
const READ_URL_EXPIRES_SECONDS = 10 * 60;

function safeFilenameSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

export async function createSupportTicketAttachmentIntent(
  db: Queryable,
  params: {
    ticketId: string;
    actorUserId: string;
    actorRole: string;
    messageId: string | null;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }
): Promise<{ attachment: SupportTicketAttachmentRow; uploadUrl: string | null }> {
  const validated = assertAttachmentIntent({
    filename: params.filename,
    contentType: params.contentType,
    sizeBytes: params.sizeBytes,
  });

  const ticket = await getSupportTicketById(db, params.ticketId);
  if (!ticket) throw notFound('ticket_not_found');
  const isAdmin = params.actorRole === Role.ADMIN;
  if (!isAdmin && ticket.user_id !== params.actorUserId) {
    throw forbidden('not_ticket_owner');
  }

  const storagePath = `support-tickets/${ticket.id}/${Date.now()}-${safeFilenameSegment(validated.filename)}`;

  const attachment = await insertSupportTicketAttachmentIntent(db, {
    ticketId: params.ticketId,
    messageId: params.messageId,
    uploadedByUserId: params.actorUserId,
    storagePath,
    originalFilename: validated.filename,
    contentType: validated.contentType,
    fileSizeBytes: validated.sizeBytes,
  });

  const uploadUrl = buildAttachmentUploadUrl(
    storagePath,
    validated.contentType,
    UPLOAD_URL_EXPIRES_SECONDS
  );

  return { attachment, uploadUrl };
}

export async function finalizeSupportTicketAttachmentUpload(
  db: Queryable,
  params: { attachmentId: string; actorUserId: string; actorRole: string }
): Promise<SupportTicketAttachmentRow> {
  const existing = await getSupportTicketAttachmentById(db, params.attachmentId);
  if (!existing) throw notFound('attachment_not_found');
  const ticket = await getSupportTicketById(db, existing.ticket_id);
  if (!ticket) throw notFound('ticket_not_found');
  const isAdmin = params.actorRole === Role.ADMIN;
  const isUploader = existing.uploaded_by_user_id === params.actorUserId;
  if (!isAdmin && !isUploader) throw forbidden('not_attachment_owner');

  const finalized = await finalizeSupportTicketAttachment(db, params.attachmentId);
  if (!finalized) throw notFound('attachment_not_found');
  return finalized;
}

export async function buildSupportTicketAttachmentDownloadUrl(
  db: Queryable,
  params: { attachmentId: string; actorUserId: string; actorRole: string }
): Promise<{ url: string; attachment: SupportTicketAttachmentRow }> {
  const attachment = await getSupportTicketAttachmentById(db, params.attachmentId);
  if (!attachment) throw notFound('attachment_not_found');
  const ticket = await getSupportTicketById(db, attachment.ticket_id);
  if (!ticket) throw notFound('ticket_not_found');
  const isAdmin = params.actorRole === Role.ADMIN;
  if (!isAdmin && ticket.user_id !== params.actorUserId) {
    throw forbidden('not_ticket_owner');
  }
  const url = buildAttachmentReadUrl(attachment.storage_path, READ_URL_EXPIRES_SECONDS);
  if (!url) throw notFound('storage_unconfigured');
  return { url, attachment };
}
