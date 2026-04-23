import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasAiAgentAccess, hasLandlordAccess, Role } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';
import { writeAudit } from '../../lib/auditRepo.js';
import {
  createElsaDecision,
  getElsaRequestAutoRespond,
  getElsaSettings,
  listActiveTroubleshootingAllowlist,
  resolveAiAgentModels,
  listCategoryPolicies,
  listPriorityPolicies,
  listPropertyPolicies,
} from '../../lib/elsaRepo.js';
import {
  getRequestById,
  insertRequestMessage,
  listRequestMessages,
  managementCanAccessRequest,
} from '../../lib/requestsRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { suggestReply } from './aiMaintenanceReplyService.js';
import { getLlmClient } from '../../lib/llmClientFactory.js';
import { evaluatePolicy } from './autoSendPolicyEngine.js';
import { ElsaPolicyDecision, parseElsaSuggestion } from './elsaTypes.js';
import { applyWaitingOnTenantAfterElsaTenantMessage } from './applyWaitingOnTenantAfterElsaMessage.js';
import {
  assertAiRoutingEnabledForRequest,
  getTierLimitsForPropertyId,
} from '../../lib/subscriptionTierCapabilities.js';
import { getTierByName } from '../../lib/subscriptionTiersRepo.js';
import { getLandlordForProperty, getPricingRates, logCostEvent } from '../../lib/costEventRepo.js';

export type ProcessElsaAutoResponseInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
  triggeringEvent?: string;
  forceReview?: boolean;
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
  tenantReplyDraft: string;
};

function normalizeForExactMatch(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

  if (!hasLandlordAccess(input.actorRole) && !hasAiAgentAccess(input.actorRole)) throw forbidden();
  if (!input.requestId) throw validationError('missing_id');
  if (hasLandlordAccess(input.actorRole)) {
    const ar = input.actorRole.trim().toUpperCase();
    const ok = await managementCanAccessRequest(db, input.requestId, ar, input.actorUserId);
    if (!ok) throw notFound();
  }
  const request = await getRequestById(db, input.requestId);
  if (!request) throw notFound();

  await assertAiRoutingEnabledForRequest(db, input.requestId);

  // Elsa should evaluate only tenant-visible conversation history.
  const messages = await listRequestMessages(db, input.requestId, false);
  const settings = await getElsaSettings(db);
  const [categoryPolicies, priorityPolicies, propertyPolicies, allowlistCodes, agentModels] = await Promise.all([
    listCategoryPolicies(db),
    listPriorityPolicies(db),
    listPropertyPolicies(db),
    listActiveTroubleshootingAllowlist(db),
    resolveAiAgentModels(db),
  ]);
  const requestAutoRespondEnabled = await getElsaRequestAutoRespond(db, input.requestId);
  log('info', 'elsa.process.context.loaded', {
    requestId: input.requestId,
    messageCount: messages.length,
    categoryPolicyCount: categoryPolicies.length,
    priorityPolicyCount: priorityPolicies.length,
    propertyPolicyCount: propertyPolicies.length,
    allowlistCount: allowlistCodes.length,
    primaryAgentModel: agentModels.primaryModel,
    fallbackAgentModel: agentModels.fallbackModel,
    requestAutoRespondEnabled,
    requestCategoryCode: request.category_code ?? null,
    requestPriorityCode: request.priority_code ?? null,
    requestStatusCode: request.status_code ?? null,
  });

  const llmClient = getLlmClient({
    primaryModel: agentModels.primaryModel ?? undefined,
    fallbackModel: agentModels.fallbackModel,
  });
  let aiResult: Awaited<ReturnType<typeof suggestReply>>;
  try {
    aiResult = await suggestReply(
      {
        request,
        messages,
        weatherSeverity: input.weatherSeverity ?? 'NORMAL',
        nowIso: new Date().toISOString(),
        logger: input.logger,
      },
      { llmClient }
    );
  } catch (aiError) {
    log('error', 'elsa.process.suggest_reply.threw', {
      requestId: input.requestId,
      message: aiError instanceof Error ? aiError.message : String(aiError),
    });
    aiResult = {
      suggestion: {
        mode: 'NEED_MORE_INFO',
        deliveryDecision: 'ADMIN_REVIEW_REQUIRED',
        tenantReplyDraft: 'We received your request. A team member will review it and follow up shortly.',
        internalSummary: 'suggestReply threw an unexpected error. Held for review.',
        recommendedNextAction: 'Review and respond manually.',
        missingInformation: [],
        safeTroubleshootingSteps: [],
        dispatchSummary: '',
        confidence: 0.0,
        policyFlags: ['MODEL_UNEXPECTED_ERROR'],
        autoSendRationale: 'Unexpected error in AI layer; held for manual review.',
      },
      modelName: agentModels.primaryModel ?? 'gemini-2.5-flash',
      providerUsed: 'unavailable',
      promptVersion: 'error',
    };
  }
  const validated = parseElsaSuggestion(aiResult.suggestion);
  const suggestion = validated ?? {
    mode: 'NEED_MORE_INFO',
    deliveryDecision: 'ADMIN_REVIEW_REQUIRED',
    tenantReplyDraft: 'We received your request. A team member will review it and follow up shortly.',
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

  if (aiResult.providerUsed === 'remote' && aiResult.tokensUsed !== undefined) {
    const rates = await getPricingRates(db);
    const rate = rates.get('GEMINI_AI') ?? 0;
    const landlordId = request.property_id
      ? await getLandlordForProperty(db, request.property_id)
      : null;
    await logCostEvent(db, {
      service: 'GEMINI_AI',
      landlordId,
      propertyId: request.property_id ?? null,
      units: aiResult.tokensUsed,
      unitType: 'TOKEN',
      estimatedCostUsd: aiResult.tokensUsed * rate,
      metadata: { model: aiResult.modelName, prompt_version: aiResult.promptVersion, request_id: input.requestId },
    });
  }

  const categoryPolicy = categoryPolicies.find(
    (row) => String(row.category_code).toLowerCase() === String(request.category_code || '').toLowerCase()
  );
  const priorityPolicy = priorityPolicies.find(
    (row) => String(row.priority_code).toLowerCase() === String(request.priority_code || '').toLowerCase()
  );
  const propertyPolicy = propertyPolicies.find((row) => row.property_id === request.property_id);

  let propertyAutoSendEnabledOverride: boolean | null = propertyPolicy?.auto_send_enabled_override ?? null;
  if (request.property_id) {
    let lim = await getTierLimitsForPropertyId(db, request.property_id);
    if (!lim) {
      const free = await getTierByName(db, 'FREE');
      lim = free?.limits ?? null;
    }
    if (lim && !lim.property_elsa_auto_send_editable) {
      propertyAutoSendEnabledOverride = false;
    }
  }

  const baseEvaluation = evaluatePolicy(
    {
      request,
      settings,
      requestAutoRespondEnabled,
      categoryAutoSendEnabled: categoryPolicy ? Boolean(categoryPolicy.auto_send_enabled) : true,
      priorityAutoSendEnabled: priorityPolicy ? Boolean(priorityPolicy.auto_send_enabled) : true,
      priorityRequiresReview: priorityPolicy ? Boolean(priorityPolicy.require_admin_review) : false,
      propertyAutoSendEnabledOverride,
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
  if (input.forceReview && evaluation.policyDecision === ElsaPolicyDecision.SEND_AUTOMATICALLY) {
    evaluation.policyDecision = ElsaPolicyDecision.HOLD_FOR_REVIEW;
    if (!evaluation.policyFlags.includes('MANUAL_REVIEW_REQUIRED')) {
      evaluation.policyFlags.push('MANUAL_REVIEW_REQUIRED');
    }
    evaluation.reasons.push('Manual review required for this run');
  }
  const tenantReplyDraft = suggestion.tenantReplyDraft;
  if (evaluation.policyDecision === ElsaPolicyDecision.SEND_AUTOMATICALLY) {
    const normalizedCandidate = normalizeForExactMatch(tenantReplyDraft);
    const similarPriorMessage = [...messages]
      .reverse()
      .find((msg) => {
        if (msg.is_internal) return false;
        if (String(msg.sender_role || '').trim().toUpperCase() === Role.TENANT) return false;
        const source = String(msg.source || '').trim().toUpperCase();
        const isAutomatedSource = source === 'SYSTEM' || source === 'ELSA_AUTO_SENT';
        const isManagementSender =
          hasAiAgentAccess(String(msg.sender_role || '')) || hasLandlordAccess(String(msg.sender_role || ''));
        if (!isAutomatedSource && !isManagementSender) return false;
        return normalizeForExactMatch(msg.body) === normalizedCandidate;
      });

    if (similarPriorMessage) {
      evaluation.policyDecision = ElsaPolicyDecision.HOLD_FOR_REVIEW;
      if (!evaluation.policyFlags.includes('SIMILAR_RESPONSE_PREVIOUSLY_SENT')) {
        evaluation.policyFlags.push('SIMILAR_RESPONSE_PREVIOUSLY_SENT');
      }
      evaluation.reasons.push('Similar tenant-facing response was already sent earlier');
      log('info', 'elsa.process.auto_send.suppressed_similar_prior_reply', {
        requestId: input.requestId,
        priorMessageId: similarPriorMessage.id,
        matchType: 'exact_normalized',
      });
    }
  }
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
        body: tenantReplyDraft,
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
          title: request.title,
        },
      });
      await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
        eventTypeCode: 'REQUEST_TENANT_AI_REPLY',
        idempotencyKey: `elsa-tenant-reply-${sentMessage.id}`,
        payload: {
          request_id: input.requestId,
          message_id: sentMessage.id,
          title: request.title,
          reply_kind: 'AUTO',
        },
      });
      await applyWaitingOnTenantAfterElsaTenantMessage(
        client as Parameters<typeof applyWaitingOnTenantAfterElsaTenantMessage>[0],
        { requestId: input.requestId, actorUserId: input.actorUserId, actorRole: input.actorRole }
      );
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
          reason: 'Elsa blocked an automatic reply and requires a management review.',
          policy_flags: evaluation.policyFlags,
          title: request.title,
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
      tenantReplyDraft,
      internalSummary: suggestion.internalSummary,
      recommendedNextAction: suggestion.recommendedNextAction,
      dispatchSummary: suggestion.dispatchSummary,
      policyFlags: Array.from(new Set([...(suggestion.policyFlags ?? []), ...evaluation.policyFlags])),
      autoSendRationale: suggestion.autoSendRationale,
      sentMessageId,
      sentAt,
    });
    if (evaluation.policyDecision === ElsaPolicyDecision.HOLD_FOR_REVIEW) {
      await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
        eventTypeCode: 'REQUEST_ELSA_REVIEW_PENDING',
        idempotencyKey: `elsa-review-pending:${decisionId}`,
        payload: {
          request_id: input.requestId,
          decision_id: decisionId,
          title: request.title,
        },
      });
      log('info', 'elsa.process.review_pending.notification_enqueued', {
        requestId: input.requestId,
        decisionId,
      });
    }
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
      tenantReplyDraft,
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
