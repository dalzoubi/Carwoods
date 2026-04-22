import type { InvocationContext } from '@azure/functions';
import type { getPool } from '../../lib/db.js';
import {
  insertSupportTicket,
  type SupportTicketRow,
} from '../../lib/supportTicketsRepo.js';
import { assertCreateTicketInput } from '../../domain/supportTicketValidation.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { logWarn } from '../../lib/serverLogger.js';

type PoolLike = ReturnType<typeof getPool>;

export type SubmitSupportTicketInput = {
  userId: string;
  title?: string;
  descriptionMarkdown?: string;
  category?: string;
  area?: string | null;
  diagnostics?: Record<string, unknown> | null;
};

export async function submitSupportTicket(
  pool: PoolLike,
  input: SubmitSupportTicketInput,
  context?: InvocationContext
): Promise<SupportTicketRow> {
  const validated = assertCreateTicketInput(input);
  const diagnosticsJson = input.diagnostics
    ? JSON.stringify(input.diagnostics).slice(0, 20000)
    : null;

  const row = await insertSupportTicket(pool, {
    userId: input.userId,
    category: validated.category,
    area: validated.area,
    title: validated.title,
    descriptionMarkdown: validated.descriptionMarkdown,
    diagnosticsJson,
  });

  // Fire-and-forget admin notification
  notifyAdminsOfNewTicket(pool, row, context).catch(() => {});

  return row;
}

async function notifyAdminsOfNewTicket(
  pool: PoolLike,
  ticket: SupportTicketRow,
  context?: InvocationContext
): Promise<void> {
  const client = await pool.connect();
  try {
    await enqueueNotification(client, {
      eventTypeCode: 'SUPPORT_TICKET_ADMIN_NEW',
      payload: {
        support_ticket_id: ticket.id,
        submitter_user_id: ticket.user_id,
        category: ticket.category,
        area: ticket.area,
        title: ticket.title,
        description: ticket.description_markdown.slice(0, 2000),
      },
      idempotencyKey: `support-ticket-admin-new:${ticket.id}`,
    });
  } catch (err) {
    logWarn(context, 'support_ticket.admin_notify.failed', {
      message: err instanceof Error ? err.message : String(err),
      ticketId: ticket.id,
    });
  } finally {
    client.release();
  }
}
