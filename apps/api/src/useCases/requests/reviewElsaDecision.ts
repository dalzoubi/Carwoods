import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';
import { writeAudit } from '../../lib/auditRepo.js';
import {
  getElsaDecisionForRequest,
  markElsaDecisionReviewed,
  type ElsaDecisionRow,
} from '../../lib/elsaRepo.js';
import { getRequestById, insertRequestMessage } from '../../lib/requestsRepo.js';

export type ReviewElsaDecisionInput = {
  requestId: string;
  decisionId: string;
  actorUserId: string;
  actorRole: string;
  action: 'MARK_RESOLVED' | 'SEND_AND_RESOLVE' | 'DISMISS';
};

export type ReviewElsaDecisionOutput = {
  decision: ElsaDecisionRow;
  sentMessageId: string | null;
};

function extractTenantReply(decision: ElsaDecisionRow): string {
  const normalized = String(decision.normalized_tenant_reply ?? '').trim();
  if (normalized) return normalized;
  if (!decision.suggestion_json) return '';
  try {
    const parsed = JSON.parse(decision.suggestion_json);
    const draft = parsed && typeof parsed === 'object' ? String(parsed.tenantReplyDraft ?? '').trim() : '';
    return draft;
  } catch {
    return '';
  }
}

export async function reviewElsaDecision(
  db: TransactionPool,
  input: ReviewElsaDecisionInput
): Promise<ReviewElsaDecisionOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.requestId) throw validationError('missing_id');
  if (!input.decisionId) throw validationError('missing_decision_id');
  if (!input.action) throw validationError('missing_action');

  const request = await getRequestById(db, input.requestId);
  if (!request) throw notFound();

  const existingDecision = await getElsaDecisionForRequest(db, input.requestId, input.decisionId);
  if (!existingDecision) throw notFound();
  if (String(existingDecision.policy_decision).toUpperCase() !== 'HOLD_FOR_REVIEW') {
    throw validationError('decision_not_hold_for_review');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    let sentMessageId: string | null = null;
    if (input.action === 'SEND_AND_RESOLVE') {
      const tenantReply = extractTenantReply(existingDecision);
      if (!tenantReply) throw validationError('decision_missing_tenant_reply');
      const message = await insertRequestMessage(client as Parameters<typeof insertRequestMessage>[0], {
        requestId: input.requestId,
        senderUserId: input.actorUserId,
        body: tenantReply,
        isInternal: false,
        source: 'SYSTEM',
      });
      sentMessageId = message.id;
    }

    const reviewStatus = input.action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';
    const updated = await markElsaDecisionReviewed(client as Parameters<typeof markElsaDecisionReviewed>[0], {
      requestId: input.requestId,
      decisionId: input.decisionId,
      reviewStatus,
      reviewAction: input.action,
      actorUserId: input.actorUserId,
    });
    if (!updated) throw notFound();

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'ELSA_DECISION',
      entityId: input.requestId,
      action: input.action,
      before: {
        decision_id: existingDecision.id,
        review_status: existingDecision.review_status,
        review_action: existingDecision.review_action,
        reviewed_by_user_id: existingDecision.reviewed_by_user_id,
        reviewed_at: existingDecision.reviewed_at,
      },
      after: {
        decision_id: updated.id,
        review_status: updated.review_status,
        review_action: updated.review_action,
        reviewed_by_user_id: updated.reviewed_by_user_id,
        reviewed_at: updated.reviewed_at,
        sent_message_id: sentMessageId,
      },
    });

    await client.query('COMMIT');
    return { decision: updated, sentMessageId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
