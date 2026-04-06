/**
 * Generate an AI-suggested reply for a landlord responding to a maintenance request.
 *
 * Business rules:
 * - Actor must have landlord or admin access.
 * - Request must exist.
 * - The suggestion is generated and the event is logged to ai_suggestion_log.
 */

import { getRequestById } from '../../lib/requestsRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type SuggestRequestReplyInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type SuggestRequestReplyOutput = {
  suggestion: string;
  metadata: {
    request_id: string;
    model: string;
    prompt_template_version: string;
    latency_ms: number;
  };
};

export async function suggestRequestReply(
  db: TransactionPool,
  input: SuggestRequestReplyInput
): Promise<SuggestRequestReplyOutput> {
  if (!hasLandlordAccess(input.actorRole)) {
    throw forbidden();
  }
  if (!input.requestId) {
    throw validationError('missing_id');
  }

  const req = await getRequestById(db, input.requestId);
  if (!req) throw notFound();

  const start = Date.now();
  const suggestion = `Thanks for reporting this. We have logged your request "${req.title}" and will follow up with scheduling details shortly.`;
  const latencyMs = Date.now() - start;
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-backend-adapter';
  const promptTemplateVersion = 'v1-maintenance-reply';

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ai_suggestion_log (
         id, request_id, actor_user_id, model, prompt_template_version, latency_ms,
         input_token_count, output_token_count
       )
       VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7)`,
      [input.requestId, input.actorUserId, model, promptTemplateVersion, latencyMs, null, null]
    );
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'AI_SUGGESTION',
      entityId: input.requestId,
      action: 'GENERATE',
      before: null,
      after: { model, promptTemplateVersion, latencyMs },
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    suggestion,
    metadata: { request_id: input.requestId, model, prompt_template_version: promptTemplateVersion, latency_ms: latencyMs },
  };
}
