import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';
import { writeAudit } from '../../lib/auditRepo.js';
import {
  createElsaDecision,
  getElsaRequestAutoRespond,
  getElsaSettings,
  listActiveTroubleshootingAllowlist,
  listCategoryPolicies,
  listPriorityPolicies,
  listPropertyPolicies,
} from '../../lib/elsaRepo.js';
import {
  getRequestById,
  insertRequestMessage,
  listRequestMessages,
} from '../../lib/requestsRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { suggestReply } from './aiMaintenanceReplyService.js';
import { evaluatePolicy } from './autoSendPolicyEngine.js';
import { normalizeTenantReply } from './elsaTemplateNormalizer.js';
import { ElsaPolicyDecision, parseElsaSuggestion } from './elsaTypes.js';

export type ProcessElsaAutoResponseInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
  triggeringEvent?: string;
  weatherSeverity?: 'NORMAL' | 'DANGEROUS_HEAT' | 'DANGEROUS_COLD';
  logger?: {
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
};

export type ProcessElsaAutoResponseOutput = {
  decisionId: string;
  policyDecision: string;
  tenantMessageSent: boolean;
  sentMessageId: string | null;
  suggestion: unknown;
  policyFlags: string[];
  reasons: string[];
  normalizedReply: string;
};

export async function processElsaAutoResponse(
  db: TransactionPool,
  input: ProcessElsaAutoResponseInput
): Promise<ProcessElsaAutoResponseOutput> {
  const log = (level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown>) => {
    const payload = JSON.stringify({ event, ...data });
    const logger = input.logger;
    if (level === 'error') {
      if (logger?.error) return logger.error(payload);
      return console.error(payload);
    }
    if (level === 'warn') {
      if (logger?.warn) return logger.warn(payload);
      return console.warn(payload);
    }
    if (logger?.info) return logger.info(payload);
    console.log(payload);
  };

  log('info', 'elsa.process.start', {
    requestId: input.requestId ?? null,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    triggeringEvent: input.triggeringEvent ?? 'MANUAL_RUN',
    weatherSeverity: input.weatherSeverity ?? 'NORMAL',
  });

  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.requestId) throw validationError('missing_id');
  const request = await getRequestById(db, input.requestId);
  if (!request) throw notFound();

  // Elsa should evaluate only tenant-visible conversation history.
  const messages = await listRequestMessages(db, input.requestId, false);
  const settings = await getElsaSettings(db);
  const [categoryPolicies, priorityPolicies, propertyPolicies, allowlistCodes] = await Promise.all([
    listCategoryPolicies(db),
    listPriorityPolicies(db),
    listPropertyPolicies(db),
    listActiveTroubleshootingAllowlist(db),
  ]);
  const requestAutoRespondEnabled = await getElsaRequestAutoRespond(db, input.requestId);
  log('info', 'elsa.process.context.loaded', {
    requestId: input.requestId,
    messageCount: messages.length,
    categoryPolicyCount: categoryPolicies.length,
    priorityPolicyCount: priorityPolicies.length,
    propertyPolicyCount: propertyPolicies.length,
    allowlistCount: allowlistCodes.length,
    requestAutoRespondEnabled,
    requestCategoryCode: request.category_code ?? null,
    requestPriorityCode: request.priority_code ?? null,
    requestStatusCode: request.status_code ?? null,
  });

  let aiResult: Awaited<ReturnType<typeof suggestReply>>;
  try {
    aiResult = await suggestReply({
      request,
      messages,
      weatherSeverity: input.weatherSeverity ?? 'NORMAL',
      nowIso: new Date().toISOString(),
      logger: input.logger,
    });
  } catch (aiError) {
    log('error', 'elsa.process.suggest_reply.threw', {
      requestId: input.requestId,
      message: aiError instanceof Error ? aiError.message : String(aiError),
    });
    aiResult = {
      suggestion: {
        mode: 'NEED_MORE_INFO',
        deliveryDecision: 'ADMIN_REVIEW_REQUIRED',
        tenantReplyDraft: 'Thanks for your request. A team member will review and follow up shortly.',
        internalSummary: 'suggestReply threw an unexpected error. Held for review.',
        recommendedNextAction: 'Review and respond manually.',
        missingInformation: [],
        safeTroubleshootingSteps: [],
        dispatchSummary: '',
        confidence: 0.0,
        policyFlags: ['MODEL_UNEXPECTED_ERROR'],
        autoSendRationale: 'Unexpected error in AI layer; held for manual review.',
      },
      modelName: process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash',
      providerUsed: 'unavailable',
      promptVersion: 'error',
    };
  }
  const validated = parseElsaSuggestion(aiResult.suggestion);
  const suggestion = validated ?? {
    mode: 'NEED_MORE_INFO',
    deliveryDecision: 'ADMIN_REVIEW_REQUIRED',
    tenantReplyDraft: 'Thanks for your request. We are reviewing this and a team member will follow up shortly.',
    internalSummary: 'Model output failed schema validation. Held for review.',
    recommendedNextAction: 'Admin review required due to schema mismatch.',
    missingInformation: [],
    safeTroubleshootingSteps: [],
    dispatchSummary: '',
    confidence: 0.0,
    policyFlags: ['MODEL_OUTPUT_SCHEMA_INVALID'],
    autoSendRationale: 'Model output failed strict JSON schema validation.',
  };
  log('info', 'elsa.process.suggestion.ready', {
    requestId: input.requestId,
    providerUsed: aiResult.providerUsed,
    modelName: aiResult.modelName,
    promptVersion: aiResult.promptVersion,
    validatedSchema: Boolean(validated),
    mode: suggestion.mode,
    deliveryDecision: suggestion.deliveryDecision,
    confidence: suggestion.confidence,
  });

  const categoryPolicy = categoryPolicies.find(
    (row) => String(row.category_code).toLowerCase() === String(request.category_code || '').toLowerCase()
  );
  const priorityPolicy = priorityPolicies.find(
    (row) => String(row.priority_code).toLowerCase() === String(request.priority_code || '').toLowerCase()
  );
  const propertyPolicy = propertyPolicies.find((row) => row.property_id === request.property_id);

  const baseEvaluation = evaluatePolicy(
    {
      request,
      settings,
      requestAutoRespondEnabled,
      categoryAutoSendEnabled: categoryPolicy ? Boolean(categoryPolicy.auto_send_enabled) : true,
      priorityAutoSendEnabled: priorityPolicy ? Boolean(priorityPolicy.auto_send_enabled) : true,
      priorityRequiresReview: priorityPolicy ? Boolean(priorityPolicy.require_admin_review) : false,
      propertyAutoSendEnabledOverride: propertyPolicy?.auto_send_enabled_override ?? null,
      propertyRequireReviewAll: Boolean(propertyPolicy?.require_review_all),
      allowlistCodes,
      hasScheduledWindow: Boolean(request.scheduled_from || request.scheduled_for),
    },
    suggestion
  );
  const evaluation = {
    ...baseEvaluation,
    policyFlags: [...baseEvaluation.policyFlags],
    reasons: [...baseEvaluation.reasons],
  };
  const normalizedReply = normalizeTenantReply(suggestion, evaluation);
  log('info', 'elsa.process.policy.evaluated', {
    requestId: input.requestId,
    policyDecision: evaluation.policyDecision,
    reasons: evaluation.reasons,
    policyFlags: evaluation.policyFlags,
  });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let sentMessageId: string | null = null;
    let sentAt: Date | null = null;
    if (evaluation.policyDecision === ElsaPolicyDecision.SEND_AUTOMATICALLY) {
      const sentMessage = await insertRequestMessage(client as Parameters<typeof insertRequestMessage>[0], {
        requestId: input.requestId,
        senderUserId: input.actorUserId,
        body: normalizedReply,
        isInternal: false,
        source: 'SYSTEM',
      });
      sentMessageId = sentMessage.id;
      sentAt = new Date();

      await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
        eventTypeCode: 'landlord_message_posted',
        idempotencyKey: `elsa-auto-${input.requestId}-${sentMessage.id}`,
        payload: {
          request_id: input.requestId,
          message_id: sentMessage.id,
          source: 'ELSA_AUTO_SENT',
        },
      });
      log('info', 'elsa.process.auto_send.sent', {
        requestId: input.requestId,
        sentMessageId,
      });
    } else if (evaluation.policyDecision === ElsaPolicyDecision.BLOCK_AND_ALERT_ADMIN) {
      await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
        eventTypeCode: 'request_status_changed',
        idempotencyKey: `elsa-alert-${input.requestId}-${Date.now()}`,
        payload: {
          request_id: input.requestId,
          severity: 'URGENT',
          reason: 'Elsa policy blocked auto-send and requires admin alert',
          policy_flags: evaluation.policyFlags,
        },
      });
      log('warn', 'elsa.process.blocked.alert_enqueued', {
        requestId: input.requestId,
        policyFlags: evaluation.policyFlags,
      });
    }

    const decisionId = await createElsaDecision(client as Parameters<typeof createElsaDecision>[0], {
      requestId: input.requestId,
      triggeringEvent: input.triggeringEvent || 'MANUAL_RUN',
      triggeringUserId: input.actorUserId,
      modelName: aiResult.modelName,
      providerUsed: aiResult.providerUsed,
      promptVersion: aiResult.promptVersion,
      mode: suggestion.mode,
      deliveryDecision: suggestion.deliveryDecision,
      policyDecision: evaluation.policyDecision,
      confidence: suggestion.confidence,
      suggestionJson: suggestion,
      normalizedTenantReply: normalizedReply,
      internalSummary: suggestion.internalSummary,
      recommendedNextAction: suggestion.recommendedNextAction,
      dispatchSummary: suggestion.dispatchSummary,
      policyFlags: Array.from(new Set([...(suggestion.policyFlags ?? []), ...evaluation.policyFlags])),
      autoSendRationale: suggestion.autoSendRationale,
      sentMessageId,
      sentAt,
    });
    log('info', 'elsa.process.decision.persisted', {
      requestId: input.requestId,
      decisionId,
      providerUsed: aiResult.providerUsed,
      policyDecision: evaluation.policyDecision,
      tenantMessageSent: Boolean(sentMessageId),
    });
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'ELSA_DECISION',
      entityId: input.requestId,
      action: evaluation.policyDecision,
      before: null,
      after: {
        decision_id: decisionId,
        mode: suggestion.mode,
        provider_used: aiResult.providerUsed,
        delivery_decision: suggestion.deliveryDecision,
        policy_flags: evaluation.policyFlags,
      },
    });
    await client.query('COMMIT');
    log('info', 'elsa.process.success', {
      requestId: input.requestId,
      decisionId,
      policyDecision: evaluation.policyDecision,
      tenantMessageSent: Boolean(sentMessageId),
    });
    return {
      decisionId,
      policyDecision: evaluation.policyDecision,
      tenantMessageSent: Boolean(sentMessageId),
      sentMessageId,
      suggestion,
      policyFlags: Array.from(new Set([...(suggestion.policyFlags ?? []), ...evaluation.policyFlags])),
      reasons: evaluation.reasons,
      normalizedReply,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    log('error', 'elsa.process.failed', {
      requestId: input.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    client.release();
  }
}
