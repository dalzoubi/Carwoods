import type { QueryResult } from '../../lib/db.js';
import {
  getSupportTicketById,
  insertStatusEvent,
  updateSupportTicketFields,
  type SupportTicketRow,
} from '../../lib/supportTicketsRepo.js';
import { notFound, forbidden, conflictError } from '../../domain/errors.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export async function reopenSupportTicket(
  db: Queryable,
  params: { ticketId: string; actorUserId: string }
): Promise<SupportTicketRow> {
  const existing = await getSupportTicketById(db, params.ticketId);
  if (!existing) throw notFound('ticket_not_found');
  if (existing.user_id !== params.actorUserId) throw forbidden('not_ticket_owner');
  if (existing.status !== 'RESOLVED' && existing.status !== 'CLOSED') {
    throw conflictError('ticket_not_resolvable_reopen');
  }
  const updated = await updateSupportTicketFields(db, params.ticketId, {
    status: 'IN_PROGRESS',
  });
  if (!updated) throw notFound('ticket_not_found');
  await insertStatusEvent(db, {
    ticketId: params.ticketId,
    actorUserId: params.actorUserId,
    fieldName: 'status',
    fromValue: existing.status,
    toValue: 'IN_PROGRESS',
  });
  return updated;
}
