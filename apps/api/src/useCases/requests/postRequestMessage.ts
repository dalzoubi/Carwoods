/**
 * Post a message on a maintenance request.
 *
 * Business rules:
 * - Tenant must own the request (active lease link).
 * - Only landlords/admins may set is_internal = true.
 * - When a tenant posts a non-internal message and the request has Elsa
 *   auto-respond enabled, processElsaAutoResponse is triggered asynchronously
 *   so the tenant reply is not delayed. Failures are logged but do not fail
 *   the message post.
 */

import {
  insertRequestMessage,
  tenantCanAccessRequest,
  type RequestMessageRow,
} from '../../lib/requestsRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { validateMessageBody, validateRequestId } from '../../domain/requestValidation.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { Role, hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';
import { getElsaRequestAutoRespond, getElsaSettings } from '../../lib/elsaRepo.js';
import { processElsaAutoResponse } from './processElsaAutoResponse.js';

export type PostRequestMessageInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
  body: string | undefined;
  isInternalRequested: boolean;
};

export type PostRequestMessageOutput = {
  message: RequestMessageRow;
};

const ELSA_SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

export async function postRequestMessage(
  db: TransactionPool,
  input: PostRequestMessageInput
): Promise<PostRequestMessageOutput> {
  const idValidation = validateRequestId(input.requestId);
  if (!idValidation.valid) {
    if (idValidation.message === 'missing_id') throw validationError('missing_id');
    throw notFound();
  }

  const requestId = input.requestId!;
  const role = input.actorRole.trim().toUpperCase();
  const isManagement = hasLandlordAccess(role);

  if (!isManagement) {
    if (role !== Role.TENANT) throw forbidden();
    const allowed = await tenantCanAccessRequest(db, requestId, input.actorUserId);
    if (!allowed) throw notFound();
  }

  const bodyValidation = validateMessageBody(input.body);
  if (!bodyValidation.valid) {
    throw validationError(bodyValidation.message);
  }

  const isInternal = isManagement ? input.isInternalRequested : false;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const created = await insertRequestMessage(
      client as Parameters<typeof insertRequestMessage>[0],
      {
        requestId,
        senderUserId: input.actorUserId,
        body: input.body!,
        isInternal,
        source: 'PORTAL',
      }
    );
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'REQUEST_MESSAGE',
      entityId: created.id,
      action: 'CREATE',
      before: null,
      after: created,
    });
    await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
      eventTypeCode: isInternal ? 'REQUEST_INTERNAL_NOTE' : 'REQUEST_MESSAGE_CREATED',
      payload: {
        request_id: requestId,
        message_id: created.id,
        sender_user_id: input.actorUserId,
      },
      idempotencyKey: `request-message:${created.id}`,
    });
    await client.query('COMMIT');

    // Trigger Elsa auto-respond asynchronously when a tenant posts a non-internal
    // message and per-request auto-respond is enabled. We fire-and-forget so the
    // tenant does not wait for the AI pipeline; failures are logged but never
    // surface to the caller.
    const shouldTriggerElsa =
      !isManagement && !isInternal && String(role).toUpperCase() === Role.TENANT;

    if (shouldTriggerElsa) {
      (async () => {
        try {
          const [autoRespondEnabled, settings] = await Promise.all([
            getElsaRequestAutoRespond(db, requestId),
            getElsaSettings(db),
          ]);
          if (autoRespondEnabled && settings.elsa_enabled) {
            await processElsaAutoResponse(db, {
              requestId,
              actorUserId: ELSA_SYSTEM_ACTOR_ID,
              actorRole: Role.AI_AGENT,
              triggeringEvent: 'TENANT_MESSAGE_POSTED',
            });
          }
        } catch {
          // Auto-respond failures are non-fatal; the message was already committed.
        }
      })();
    }

    return { message: created };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
