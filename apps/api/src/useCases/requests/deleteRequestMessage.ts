import {
  clearElsaDecisionMessageReference,
  deleteRequestMessageById,
  getRequestMessageById,
} from '../../lib/requestsRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import { validateRequestId } from '../../domain/requestValidation.js';
import { isValidUuid } from '../../domain/validation.js';
import type { TransactionPool } from '../types.js';

export type DeleteRequestMessageInput = {
  requestId: string | undefined;
  messageId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type DeleteRequestMessageOutput = {
  deleted_message_id: string;
};

export async function deleteRequestMessage(
  db: TransactionPool,
  input: DeleteRequestMessageInput
): Promise<DeleteRequestMessageOutput> {
  const idValidation = validateRequestId(input.requestId);
  if (!idValidation.valid) {
    if (idValidation.message === 'missing_id') throw validationError('missing_id');
    throw notFound();
  }
  if (!input.messageId) throw validationError('missing_message_id');
  if (!isValidUuid(input.messageId)) throw notFound();

  const role = String(input.actorRole || '').trim().toUpperCase();
  if (role !== Role.ADMIN) throw forbidden();

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const existing = await getRequestMessageById(client, input.requestId!, input.messageId);
    if (!existing) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    await clearElsaDecisionMessageReference(client, input.messageId);
    const deleted = await deleteRequestMessageById(
      client as Parameters<typeof deleteRequestMessageById>[0],
      input.requestId!,
      input.messageId
    );
    if (!deleted) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'REQUEST_MESSAGE',
      entityId: deleted.id,
      action: 'DELETE',
      before: existing,
      after: null,
    });
    await client.query('COMMIT');
    return { deleted_message_id: deleted.id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
