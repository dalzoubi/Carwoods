import type { InvocationContext } from '@azure/functions';
import { validationError, notFound } from '../../domain/errors.js';
import { logWarn, logInfo } from '../../lib/serverLogger.js';
import { sendResendEmail } from '../../lib/resendClient.js';
import {
  getContactRequestById,
  setContactRequestStatus,
  type ContactRequestRow,
} from '../../lib/contactRequestsRepo.js';
import {
  insertContactRequestMessage,
  updateContactRequestMessageEmailStatus,
  type ContactRequestMessageRow,
} from '../../lib/contactRequestMessagesRepo.js';
import type { QueryResult } from '../../lib/db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const MAX_BODY_CHARS = 10_000;

export type SendContactReplyInput = {
  contactRequestId: string;
  actorUserId: string;
  actorEmail: string | null;
  body: string;
  isInternalNote?: boolean;
  aiSuggested?: boolean;
  aiModel?: string | null;
  markHandled?: boolean;
};

export type SendContactReplyOutput = {
  message: ContactRequestMessageRow;
  contactRequest: ContactRequestRow;
  emailDelivered: boolean;
  emailError: string | null;
};

function buildEmailText(row: ContactRequestRow, replyBody: string): string {
  const portalBase = process.env.PORTAL_BASE_URL ?? 'https://carwoods.com';
  return [
    `Hi ${row.name || 'there'},`,
    ``,
    replyBody,
    ``,
    `— Carwoods Support`,
    ``,
    `--`,
    `This reply was sent in response to your message submitted on ${row.created_at}.`,
    `If you need to follow up, simply reply to this email.`,
    ``,
    `Visit: ${portalBase}`,
  ].join('\n');
}

export async function sendContactReply(
  db: Queryable,
  input: SendContactReplyInput,
  context?: InvocationContext
): Promise<SendContactReplyOutput> {
  const body = (input.body ?? '').trim();
  if (!body) throw validationError('body_required');
  if (body.length > MAX_BODY_CHARS) throw validationError('body_too_long');

  const existing = await getContactRequestById(db, input.contactRequestId);
  if (!existing) throw notFound();

  const isInternal = Boolean(input.isInternalNote);

  const message = await insertContactRequestMessage(db, {
    contactRequestId: input.contactRequestId,
    authorUserId: input.actorUserId,
    body,
    isInternalNote: isInternal,
    aiSuggested: Boolean(input.aiSuggested),
    aiModel: input.aiModel ?? null,
  });

  let emailDelivered = false;
  let emailError: string | null = null;

  if (!isInternal) {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_EMAIL_FROM) {
      emailError = 'resend_not_configured';
      logWarn(context, 'contact.reply.email_skipped', {
        reason: emailError,
        messageId: message.id,
      });
    } else {
      try {
        const providerId = await sendResendEmail({
          to: existing.email,
          subject: `Re: ${existing.subject} — your message to Carwoods`,
          text: buildEmailText(existing, body),
          replyTo: input.actorEmail ?? undefined,
        });
        emailDelivered = true;
        await updateContactRequestMessageEmailStatus(db, message.id, {
          providerId: providerId ?? null,
          error: null,
        });
        message.email_sent_at = new Date().toISOString();
        message.email_provider_id = providerId ?? null;
        logInfo(context, 'contact.reply.email_sent', {
          messageId: message.id,
          contactRequestId: input.contactRequestId,
          providerId,
        });
      } catch (err) {
        emailError = err instanceof Error ? err.message : 'send_failed';
        await updateContactRequestMessageEmailStatus(db, message.id, {
          providerId: null,
          error: emailError.slice(0, 500),
        });
        message.email_error = emailError.slice(0, 500);
        logWarn(context, 'contact.reply.email_failed', {
          messageId: message.id,
          contactRequestId: input.contactRequestId,
          message: emailError,
        });
      }
    }
  }

  let contactRequest: ContactRequestRow = existing;
  const shouldMarkHandled =
    input.markHandled !== false && !isInternal && existing.status !== 'HANDLED';
  if (shouldMarkHandled) {
    const updated = await setContactRequestStatus(db, input.contactRequestId, 'HANDLED');
    if (updated) contactRequest = updated;
  } else if (existing.status === 'UNREAD') {
    const updated = await setContactRequestStatus(db, input.contactRequestId, 'READ');
    if (updated) contactRequest = updated;
  }

  return { message, contactRequest, emailDelivered, emailError };
}
