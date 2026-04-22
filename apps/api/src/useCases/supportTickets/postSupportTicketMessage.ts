import type { InvocationContext } from '@azure/functions';
import type { getPool } from '../../lib/db.js';
import {
  getSupportTicketById,
  insertSupportTicketMessage,
  touchSupportTicketActivity,
  type SupportTicketMessageRow,
  type SupportTicketAuthorRole,
} from '../../lib/supportTicketsRepo.js';
import { assertMessageBody } from '../../domain/supportTicketValidation.js';
import { notFound, forbidden } from '../../domain/errors.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { logWarn } from '../../lib/serverLogger.js';
import { Role } from '../../domain/constants.js';

type PoolLike = ReturnType<typeof getPool>;

export type PostSupportTicketMessageInput = {
  ticketId: string;
  authorUserId: string;
  authorRole: SupportTicketAuthorRole;
  bodyMarkdown?: string;
  isInternalNote?: boolean;
};

/**
 * Appends a reply to a ticket. Users can only reply on their own tickets;
 * admins can reply on any. Users cannot post internal notes.
 */
export async function postSupportTicketMessage(
  pool: PoolLike,
  input: PostSupportTicketMessageInput,
  context?: InvocationContext
): Promise<SupportTicketMessageRow> {
  const body = assertMessageBody(input.bodyMarkdown);
  const isAdmin = input.authorRole === Role.ADMIN;
  const isInternalNote = isAdmin && Boolean(input.isInternalNote);

  const ticket = await getSupportTicketById(pool, input.ticketId);
  if (!ticket) throw notFound('ticket_not_found');

  const isOwner = ticket.user_id === input.authorUserId;
  if (!isAdmin && !isOwner) throw forbidden('not_ticket_owner');

  const message = await insertSupportTicketMessage(pool, {
    ticketId: input.ticketId,
    authorUserId: input.authorUserId,
    authorRole: input.authorRole,
    bodyMarkdown: body,
    isInternalNote,
  });

  // Bump last_activity_at on the ticket so it floats in lists
  await touchSupportTicketActivity(pool, input.ticketId);

  // Fire-and-forget: notify the appropriate party
  if (!isInternalNote) {
    notifyForReply(pool, {
      ticket,
      message,
      isAdmin,
    }, context).catch(() => {});
  }

  return message;
}

async function notifyForReply(
  pool: PoolLike,
  params: {
    ticket: { id: string; user_id: string; title: string };
    message: SupportTicketMessageRow;
    isAdmin: boolean;
  },
  context?: InvocationContext
): Promise<void> {
  // Admin reply -> notify the ticket owner via SUPPORT_TICKET_REPLY
  // User reply -> notify admins via SUPPORT_TICKET_ADMIN_NEW (reuses admin flow)
  const client = await pool.connect();
  try {
    if (params.isAdmin) {
      await enqueueNotification(client, {
        eventTypeCode: 'SUPPORT_TICKET_REPLY',
        payload: {
          support_ticket_id: params.ticket.id,
          recipient_user_id: params.ticket.user_id,
          message_id: params.message.id,
          title: params.ticket.title,
          preview: params.message.body_markdown.slice(0, 500),
        },
        idempotencyKey: `support-ticket-reply:${params.message.id}`,
      });
    } else {
      await enqueueNotification(client, {
        eventTypeCode: 'SUPPORT_TICKET_ADMIN_NEW',
        payload: {
          support_ticket_id: params.ticket.id,
          submitter_user_id: params.ticket.user_id,
          title: params.ticket.title,
          preview: params.message.body_markdown.slice(0, 500),
          event: 'user_reply',
          message_id: params.message.id,
        },
        idempotencyKey: `support-ticket-admin-new:user-reply:${params.message.id}`,
      });
    }
  } catch (err) {
    logWarn(context, 'support_ticket.reply_notify.failed', {
      message: err instanceof Error ? err.message : String(err),
      ticketId: params.ticket.id,
    });
  } finally {
    client.release();
  }
}
