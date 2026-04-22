import type { InvocationContext } from '@azure/functions';
import type { getPool } from '../../lib/db.js';
import {
  getSupportTicketById,
  updateSupportTicketFields,
  insertStatusEvent,
  type SupportTicketRow,
} from '../../lib/supportTicketsRepo.js';
import {
  isValidCategory,
  isValidPriority,
  isValidStatus,
  isValidArea,
} from '../../domain/supportTicketValidation.js';
import { notFound, validationError } from '../../domain/errors.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { logWarn } from '../../lib/serverLogger.js';

type PoolLike = ReturnType<typeof getPool>;

export type UpdateSupportTicketAdminInput = {
  ticketId: string;
  actorUserId: string;
  status?: unknown;
  priority?: unknown;
  assigneeUserId?: unknown;
  area?: unknown;
  category?: unknown;
};

export async function updateSupportTicketAdmin(
  pool: PoolLike,
  input: UpdateSupportTicketAdminInput,
  context?: InvocationContext
): Promise<SupportTicketRow> {
  const existing = await getSupportTicketById(pool, input.ticketId);
  if (!existing) throw notFound('ticket_not_found');

  const patch: Parameters<typeof updateSupportTicketFields>[2] = {};
  const events: Array<{
    fieldName: 'status' | 'priority' | 'assignee' | 'area' | 'category';
    fromValue: string | null;
    toValue: string | null;
  }> = [];

  if (input.status !== undefined) {
    if (!isValidStatus(input.status)) throw validationError('invalid_status');
    const next = String(input.status).toUpperCase() as SupportTicketRow['status'];
    if (next !== existing.status) {
      patch.status = next;
      events.push({ fieldName: 'status', fromValue: existing.status, toValue: next });
    }
  }

  if (input.priority !== undefined) {
    if (input.priority === null || input.priority === '') {
      if (existing.priority !== null) {
        patch.priority = null;
        events.push({ fieldName: 'priority', fromValue: existing.priority, toValue: null });
      }
    } else {
      if (!isValidPriority(input.priority)) throw validationError('invalid_priority');
      const next = String(input.priority).toUpperCase() as SupportTicketRow['priority'];
      if (next !== existing.priority) {
        patch.priority = next;
        events.push({ fieldName: 'priority', fromValue: existing.priority, toValue: next });
      }
    }
  }

  if (input.assigneeUserId !== undefined) {
    const raw = input.assigneeUserId;
    const next = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
    if (next !== existing.assignee_user_id) {
      patch.assigneeUserId = next;
      events.push({
        fieldName: 'assignee',
        fromValue: existing.assignee_user_id,
        toValue: next,
      });
    }
  }

  if (input.area !== undefined) {
    if (input.area === null || input.area === '') {
      if (existing.area !== null) {
        patch.area = null;
        events.push({ fieldName: 'area', fromValue: existing.area, toValue: null });
      }
    } else {
      if (!isValidArea(input.area)) throw validationError('invalid_area');
      const next = String(input.area).toUpperCase();
      if (next !== existing.area) {
        patch.area = next;
        events.push({ fieldName: 'area', fromValue: existing.area, toValue: next });
      }
    }
  }

  if (input.category !== undefined) {
    if (!isValidCategory(input.category)) throw validationError('invalid_category');
    const next = String(input.category).toUpperCase() as SupportTicketRow['category'];
    if (next !== existing.category) {
      patch.category = next;
      events.push({ fieldName: 'category', fromValue: existing.category, toValue: next });
    }
  }

  if (Object.keys(patch).length === 0) {
    return existing;
  }

  const updated = await updateSupportTicketFields(pool, input.ticketId, patch);
  if (!updated) throw notFound('ticket_not_found');

  for (const evt of events) {
    await insertStatusEvent(pool, {
      ticketId: input.ticketId,
      actorUserId: input.actorUserId,
      fieldName: evt.fieldName,
      fromValue: evt.fromValue,
      toValue: evt.toValue,
    });
  }

  const statusChanged = events.some((e) => e.fieldName === 'status');
  if (statusChanged) {
    notifyUserOfStatusChange(pool, updated, context).catch(() => {});
  }

  return updated;
}

async function notifyUserOfStatusChange(
  pool: PoolLike,
  ticket: SupportTicketRow,
  context?: InvocationContext
): Promise<void> {
  const client = await pool.connect();
  try {
    await enqueueNotification(client, {
      eventTypeCode: 'SUPPORT_TICKET_STATUS_CHANGED',
      payload: {
        support_ticket_id: ticket.id,
        recipient_user_id: ticket.user_id,
        title: ticket.title,
        status: ticket.status,
      },
      idempotencyKey: `support-ticket-status:${ticket.id}:${ticket.status}:${ticket.updated_at}`,
    });
  } catch (err) {
    logWarn(context, 'support_ticket.status_notify.failed', {
      message: err instanceof Error ? err.message : String(err),
      ticketId: ticket.id,
    });
  } finally {
    client.release();
  }
}
