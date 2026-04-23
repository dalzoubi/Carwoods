/**
 * Phase 3: AI summarization + urgency override before notification fan-out.
 */

import type { PoolClient } from './db.js';
import type { QueryResult } from './db.js';
import { deriveEventCategory } from './notificationPolicyRepo.js';
import { getLlmClient } from './llmClientFactory.js';
import { resolveAiAgentModels } from './elsaRepo.js';
import {
  getRequestById,
  getRequestMessageSnippetById,
  getPriorityIdByCode,
  updateRequestManagementFields,
} from './requestsRepo.js';
import { summarizeForNotification } from '../useCases/requests/notificationSummarizationService.js';
import { writeAudit } from './auditRepo.js';
import { insertNotificationAiSignal } from './notificationAiSignalsRepo.js';
import type { NotificationOutboxRow } from './notificationRepo.js';
import { getLandlordForProperty, getPricingRates, logCostEvent } from './costEventRepo.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const SYSTEM_AUDIT_ACTOR = '00000000-0000-0000-0000-000000000000';

export type MaintenanceNotificationAiContext = {
  requestId: string;
  propertyId: string | null;
  messageSnippet: string;
  requestTitle: string;
  requestDescription: string;
  currentPriorityCode: string | null;
};

export type NotificationDispatchAiBundle = {
  context: MaintenanceNotificationAiContext;
  summary160: string;
  urgent: boolean;
  emergency: boolean;
  /** True when SMS may bypass quiet hours (AI or manual emergency priority). */
  smsUrgentBypass: boolean;
  confidence: number;
  modelName: string;
  providerUsed: string;
  errorDetail: string | null;
};

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t ? t : null;
}

function priorityRank(code: string | null | undefined): number {
  const c = String(code ?? '').toLowerCase();
  if (c === 'emergency') return 3;
  if (c === 'urgent') return 2;
  return 1;
}

function targetPriorityCodeForAi(bundle: NotificationDispatchAiBundle): 'emergency' | 'urgent' | null {
  if (bundle.emergency) return 'emergency';
  if (bundle.urgent) return 'urgent';
  return null;
}

export function isMaintenanceNotificationEventType(eventTypeCode: string): boolean {
  const code = String(eventTypeCode ?? '').trim().toUpperCase();
  if (deriveEventCategory(eventTypeCode) !== 'MAINTENANCE') return false;
  if (code === 'REQUEST_INTERNAL_NOTE') return false;
  if (code === 'SECURITY_NOTIFICATION_DELIVERY_FAILURE') return false;
  return true;
}

export async function loadMaintenanceAiContext(
  client: Queryable,
  payload: Record<string, unknown>
): Promise<MaintenanceNotificationAiContext | null> {
  const requestId = asString(payload.request_id);
  if (!requestId) return null;
  const messageId = asString(payload.message_id);
  let messageSnippet = '';
  if (messageId) {
    const msg = await getRequestMessageSnippetById(client, messageId);
    if (msg) {
      messageSnippet = msg.body ?? '';
    }
  }
  const request = await getRequestById(client, requestId);
  if (!request) return null;
  return {
    requestId,
    propertyId: request.property_id ?? null,
    messageSnippet: messageSnippet || request.description || request.title || '',
    requestTitle: request.title ?? '',
    requestDescription: request.description ?? '',
    currentPriorityCode: request.priority_code ?? null,
  };
}

export async function runMaintenanceNotificationAiPhase(
  pool: Queryable,
  row: NotificationOutboxRow
): Promise<NotificationDispatchAiBundle | null> {
  if (!isMaintenanceNotificationEventType(row.event_type_code)) return null;
  if (String(process.env.NOTIFICATION_AI_ENRICHMENT ?? '').toLowerCase() === 'false') {
    const payload = toRecord(row.payload);
    const ctx = await loadMaintenanceAiContext(pool, payload);
    if (!ctx) return null;
    const manualEmergency = priorityRank(ctx.currentPriorityCode) >= 3;
    const manualUrgent = priorityRank(ctx.currentPriorityCode) >= 2;
    return {
      context: ctx,
      summary160: (ctx.messageSnippet || ctx.requestTitle).slice(0, 160),
      urgent: manualUrgent,
      emergency: manualEmergency,
      smsUrgentBypass: manualEmergency || manualUrgent,
      confidence: 0,
      modelName: 'disabled',
      providerUsed: 'skipped',
      errorDetail: 'NOTIFICATION_AI_ENRICHMENT=false',
    };
  }

  const payload = toRecord(row.payload);
  const ctx = await loadMaintenanceAiContext(pool, payload);
  if (!ctx) return null;

  const agentModels = await resolveAiAgentModels(pool);
  const llmClient = getLlmClient({
    primaryModel: agentModels.primaryModel ?? undefined,
    fallbackModel: agentModels.fallbackModel,
  });

  const ai = await summarizeForNotification(
    {
      requestTitle: ctx.requestTitle,
      requestDescription: ctx.requestDescription,
      messageSnippet: ctx.messageSnippet,
      currentPriorityCode: ctx.currentPriorityCode,
    },
    { llmClient }
  );

  if (ai.providerUsed === 'remote' && ai.tokensUsed !== undefined) {
    const rates = await getPricingRates(pool);
    const rate = rates.get('GEMINI_AI') ?? 0;
    const landlordId = ctx.propertyId
      ? await getLandlordForProperty(pool, ctx.propertyId)
      : null;
    await logCostEvent(pool, {
      service: 'GEMINI_AI',
      landlordId,
      propertyId: ctx.propertyId,
      units: ai.tokensUsed,
      unitType: 'TOKEN',
      estimatedCostUsd: ai.tokensUsed * rate,
      metadata: { model: ai.modelName, prompt_version: ai.promptVersion, source: 'notification_ai_enrichment' },
    });
  }

  const manualEmergency = priorityRank(ctx.currentPriorityCode) >= 3;
  const manualUrgent = priorityRank(ctx.currentPriorityCode) >= 2;
  const smsUrgentBypass = manualEmergency || manualUrgent || ai.emergency || ai.urgent;

  return {
    context: ctx,
    summary160: ai.notificationSummary,
    urgent: ai.urgent,
    emergency: ai.emergency,
    smsUrgentBypass,
    confidence: ai.confidence,
    modelName: ai.modelName,
    providerUsed: ai.providerUsed,
    errorDetail: ai.errorDetail,
  };
}

export async function applyAiUrgencyOverrideIfNeeded(
  client: PoolClient,
  bundle: NotificationDispatchAiBundle,
  outboxId: string
): Promise<boolean> {
  const target = targetPriorityCodeForAi(bundle);
  if (!target) return false;
  const curRank = priorityRank(bundle.context.currentPriorityCode);
  const targetRank = priorityRank(target);
  if (curRank >= targetRank) return false;

  const priorityId = await getPriorityIdByCode(client, target);
  if (!priorityId) return false;

  const before = await getRequestById(client, bundle.context.requestId);
  const updated = await updateRequestManagementFields(client, bundle.context.requestId, {
    priorityId,
  });
  if (!updated) return false;

  await writeAudit(client, {
    actorUserId: SYSTEM_AUDIT_ACTOR,
    entityType: 'MAINTENANCE_REQUEST',
    entityId: bundle.context.requestId,
    action: 'AI_URGENCY_OVERRIDE',
    before: before
      ? {
          priority_code: before.priority_code,
          priority_id: before.priority_id,
        }
      : null,
    after: {
          outbox_id: outboxId,
          previous_priority_code: before?.priority_code ?? null,
          new_priority_code: target,
          confidence: bundle.confidence,
          model_name: bundle.modelName,
          provider_used: bundle.providerUsed,
          emergency: bundle.emergency,
          urgent: bundle.urgent,
        },
  });
  return true;
}

export async function persistNotificationAiSignalRow(
  client: PoolClient,
  params: {
    outboxId: string;
    bundle: NotificationDispatchAiBundle;
    priorityOverrideApplied: boolean;
  }
): Promise<void> {
  await insertNotificationAiSignal(client, {
    outboxId: params.outboxId,
    requestId: params.bundle.context.requestId,
    summaryText: params.bundle.summary160,
    urgent: params.bundle.urgent || params.bundle.emergency,
    confidence: params.bundle.confidence,
    modelName: params.bundle.modelName,
    providerUsed: params.bundle.providerUsed,
    priorityOverrideApplied: params.priorityOverrideApplied,
    errorDetail: params.bundle.errorDetail,
  });
}
