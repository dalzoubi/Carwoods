/**
 * Strict inbound reply-to-thread: token in recipient address + From must match token user.
 */

import { findUserByEmail, findUserById } from '../../lib/usersRepo.js';
import {
  insertRequestMessage,
  tenantCanAccessRequest,
  landlordOwnsRequestProperty,
} from '../../lib/requestsRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { verifyEmailReplyToken, extractTokenFromRecipientAddress } from '../../lib/secureSignedToken.js';
import { validateMessageBody } from '../../domain/requestValidation.js';
import { Role, hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';
import { getElsaRequestAutoRespond, getElsaSettings } from '../../lib/elsaRepo.js';
import type { PoolClient } from '../../lib/db.js';
import { processElsaAutoResponse } from './processElsaAutoResponse.js';

const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000';

export type ProcessInboundEmailReplyInput = {
  toAddresses: string[];
  fromEmail: string;
  textBody: string;
};

export type ProcessInboundEmailReplyOutput =
  | { ok: true; requestId: string; messageId: string }
  | { ok: false; reason: string; requestId?: string };

function stripEmailReply(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+ wrote:\s*$/i.test(line.trim())) break;
    if (/^[-_]{2,}\s*Original Message\s*[-_]{2,}$/i.test(line.trim())) break;
    if (line.trim().startsWith('>')) continue;
    out.push(line);
  }
  return out.join('\n').trim();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function userMayPostOnRequest(
  db: TransactionPool,
  requestId: string,
  userId: string
): Promise<boolean> {
  const user = await findUserById(db, userId);
  if (!user) return false;
  const role = String(user.role ?? '').trim().toUpperCase();
  if (role === Role.ADMIN) return true;
  if (role === Role.TENANT) {
    return tenantCanAccessRequest(db, requestId, userId);
  }
  if (hasLandlordAccess(role) && role !== Role.TENANT) {
    if (role === Role.LANDLORD) {
      return landlordOwnsRequestProperty(db, requestId, userId);
    }
    return true;
  }
  return false;
}

export async function processInboundEmailReply(
  db: TransactionPool,
  input: ProcessInboundEmailReplyInput
): Promise<ProcessInboundEmailReplyOutput> {
  const prefix = process.env.INBOUND_EMAIL_REPLY_LOCAL_PREFIX?.trim() || 'cwreply';
  let token: string | null = null;
  for (const raw of input.toAddresses) {
    const t = extractTokenFromRecipientAddress(raw, prefix);
    if (t) {
      token = t;
      break;
    }
  }
  if (!token) {
    return { ok: false, reason: 'missing_reply_token' };
  }

  const verified = verifyEmailReplyToken(token);
  if (!verified) {
    return { ok: false, reason: 'invalid_or_expired_token' };
  }

  const { requestId, userId } = verified;
  const fromNorm = normalizeEmail(input.fromEmail);
  if (!fromNorm) {
    await recordRejection(db, requestId, 'missing_from', { from: input.fromEmail });
    return { ok: false, reason: 'missing_from', requestId };
  }

  const authorizedUser = await findUserByEmail(db, fromNorm);
  if (!authorizedUser || authorizedUser.id !== userId) {
    await recordRejection(db, requestId, 'sender_mismatch', {
      from: fromNorm,
      expected_user_id: userId,
    });
    return { ok: false, reason: 'sender_mismatch', requestId };
  }

  const allowed = await userMayPostOnRequest(db, requestId, userId);
  if (!allowed) {
    await recordRejection(db, requestId, 'not_request_member', { user_id: userId });
    return { ok: false, reason: 'not_request_member', requestId };
  }

  const bodyRaw = stripEmailReply(input.textBody || '');
  const bodyValidation = validateMessageBody(bodyRaw);
  if (!bodyValidation.valid) {
    await recordRejection(db, requestId, 'invalid_body', { code: bodyValidation.message });
    return { ok: false, reason: 'invalid_body', requestId };
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const pc = client as PoolClient;
    const created = await insertRequestMessage(pc, {
      requestId,
      senderUserId: userId,
      body: bodyRaw,
      isInternal: false,
      source: 'EMAIL_REPLY',
    });
    await writeAudit(pc, {
      actorUserId: userId,
      entityType: 'REQUEST_MESSAGE',
      entityId: created.id,
      action: 'CREATE_EMAIL_REPLY',
      before: null,
      after: { request_id: requestId, source: 'EMAIL_REPLY' },
    });
    await enqueueNotification(pc, {
      eventTypeCode: 'REQUEST_MESSAGE_CREATED',
      payload: {
        request_id: requestId,
        message_id: created.id,
        sender_user_id: userId,
      },
      idempotencyKey: `request-message:${created.id}`,
    });
    await client.query('COMMIT');

    const role = String(authorizedUser.role ?? '').trim().toUpperCase();
    if (role === Role.TENANT) {
      (async () => {
        try {
          const [autoRespondEnabled, settings] = await Promise.all([
            getElsaRequestAutoRespond(db, requestId),
            getElsaSettings(db),
          ]);
          if (autoRespondEnabled && settings.elsa_enabled) {
            await processElsaAutoResponse(db, {
              requestId,
              actorUserId: SYSTEM_ACTOR,
              actorRole: Role.AI_AGENT,
              triggeringEvent: 'TENANT_MESSAGE_POSTED',
            });
          }
        } catch {
          // non-fatal
        }
      })();
    }

    return { ok: true, requestId, messageId: created.id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function recordRejection(
  db: TransactionPool,
  requestId: string,
  reason: string,
  detail: Record<string, unknown>
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await writeAudit(client as PoolClient, {
      actorUserId: SYSTEM_ACTOR,
      entityType: 'REQUEST_EMAIL_REPLY',
      entityId: requestId,
      action: 'REJECTED',
      before: null,
      after: { reason, ...detail },
    });
    await client.query('COMMIT');
  } catch {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}
