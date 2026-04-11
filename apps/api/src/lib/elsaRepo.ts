import type { PoolClient, QueryResult } from './db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type ElsaSettings = {
  elsa_enabled: boolean;
  elsa_auto_send_enabled: boolean;
  elsa_auto_send_confidence_threshold: number;
  elsa_similar_reply_threshold: number;
  elsa_allowed_categories: string[];
  elsa_allowed_priorities: string[];
  elsa_blocked_keywords: string[];
  elsa_emergency_keywords: string[];
  elsa_max_questions: number;
  elsa_max_steps: number;
  elsa_admin_alert_recipients: string[];
  elsa_emergency_template_enabled: boolean;
};

export type ElsaDecisionRow = {
  id: string;
  request_id: string;
  triggering_event: string;
  model_name: string | null;
  provider_used: string | null;
  prompt_version: string | null;
  mode: string | null;
  delivery_decision: string | null;
  policy_decision: string;
  confidence: number | null;
  suggestion_json: string | null;
  tenant_reply_draft: string | null;
  internal_summary: string | null;
  recommended_next_action: string | null;
  dispatch_summary: string | null;
  policy_flags_json: string | null;
  auto_send_rationale: string | null;
  sent_message_id: string | null;
  sent_at: Date | null;
  review_status: string | null;
  review_action: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: Date | null;
  created_at: Date;
};

export type AiAgentRow = {
  id: string;
  code: string;
  display_name: string;
  provider: string;
  primary_model: string;
  fallback_model: string | null;
  enabled: boolean;
  is_system: boolean;
  metadata_json: string | null;
  updated_at: Date;
};

export type AiAgentRoutingRow = {
  primary_agent_id: string;
  fallback_agent_id: string | null;
  updated_at: Date;
};

const DEFAULT_SETTINGS: ElsaSettings = {
  elsa_enabled: true,
  elsa_auto_send_enabled: false,
  elsa_auto_send_confidence_threshold: 0.78,
  elsa_similar_reply_threshold: 0.86,
  elsa_allowed_categories: ['plumbing', 'hvac', 'electrical', 'appliances', 'general'],
  elsa_allowed_priorities: ['routine', 'urgent'],
  elsa_blocked_keywords: ['injury', 'lawsuit', 'attorney', 'reimbursement', 'liability', 'claim'],
  elsa_emergency_keywords: [
    'gas smell',
    'smoke',
    'fire',
    'burning smell',
    'sparking',
    'exposed wires',
    'flooding',
    'sewage',
    'carbon monoxide',
  ],
  elsa_max_questions: 5,
  elsa_max_steps: 5,
  elsa_admin_alert_recipients: [],
  elsa_emergency_template_enabled: true,
};

function parseJsonArray(value: string | null, fallback: string[]): string[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return fallback;
  }
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function parseNumber(value: string | null, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export async function getElsaSettings(client: Queryable): Promise<ElsaSettings> {
  const r = await client.query<{ setting_key: string; setting_value: string }>(
    `SELECT setting_key, setting_value
     FROM elsa_settings`
  );
  const map = new Map(r.rows.map((row) => [row.setting_key, row.setting_value]));
  return {
    elsa_enabled: parseBoolean(map.get('elsa_enabled') ?? null, DEFAULT_SETTINGS.elsa_enabled),
    elsa_auto_send_enabled: parseBoolean(
      map.get('elsa_auto_send_enabled') ?? null,
      DEFAULT_SETTINGS.elsa_auto_send_enabled
    ),
    elsa_auto_send_confidence_threshold: parseNumber(
      map.get('elsa_auto_send_confidence_threshold') ?? null,
      DEFAULT_SETTINGS.elsa_auto_send_confidence_threshold
    ),
    elsa_similar_reply_threshold: parseNumber(
      map.get('elsa_similar_reply_threshold') ?? null,
      DEFAULT_SETTINGS.elsa_similar_reply_threshold
    ),
    elsa_allowed_categories: parseJsonArray(
      map.get('elsa_allowed_categories') ?? null,
      DEFAULT_SETTINGS.elsa_allowed_categories
    ),
    elsa_allowed_priorities: parseJsonArray(
      map.get('elsa_allowed_priorities') ?? null,
      DEFAULT_SETTINGS.elsa_allowed_priorities
    ),
    elsa_blocked_keywords: parseJsonArray(
      map.get('elsa_blocked_keywords') ?? null,
      DEFAULT_SETTINGS.elsa_blocked_keywords
    ),
    elsa_emergency_keywords: parseJsonArray(
      map.get('elsa_emergency_keywords') ?? null,
      DEFAULT_SETTINGS.elsa_emergency_keywords
    ),
    elsa_max_questions: parseNumber(
      map.get('elsa_max_questions') ?? null,
      DEFAULT_SETTINGS.elsa_max_questions
    ),
    elsa_max_steps: parseNumber(map.get('elsa_max_steps') ?? null, DEFAULT_SETTINGS.elsa_max_steps),
    elsa_admin_alert_recipients: parseJsonArray(
      map.get('elsa_admin_alert_recipients') ?? null,
      DEFAULT_SETTINGS.elsa_admin_alert_recipients
    ),
    elsa_emergency_template_enabled: parseBoolean(
      map.get('elsa_emergency_template_enabled') ?? null,
      DEFAULT_SETTINGS.elsa_emergency_template_enabled
    ),
  };
}

export async function upsertElsaSettings(
  client: PoolClient,
  actorUserId: string,
  updates: Partial<ElsaSettings>
): Promise<void> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      entries.push([key, JSON.stringify(value)]);
      continue;
    }
    entries.push([key, String(value)]);
  }
  for (const [key, value] of entries) {
    await client.query(
      `MERGE elsa_settings AS target
       USING (SELECT $1 AS setting_key, $2 AS setting_value, $3 AS updated_by_user_id) AS src
         ON target.setting_key = src.setting_key
       WHEN MATCHED THEN
         UPDATE SET setting_value = src.setting_value,
                    updated_by_user_id = src.updated_by_user_id,
                    updated_at = SYSDATETIMEOFFSET()
       WHEN NOT MATCHED THEN
         INSERT (setting_key, setting_value, updated_by_user_id)
         VALUES (src.setting_key, src.setting_value, src.updated_by_user_id);`,
      [key, value, actorUserId]
    );
  }
}

export async function listActiveTroubleshootingAllowlist(client: Queryable): Promise<string[]> {
  const r = await client.query<{ code: string }>(
    `SELECT code
     FROM elsa_troubleshooting_allowlist
     WHERE active = 1`
  );
  return r.rows.map((row) => row.code);
}

export async function setElsaRequestAutoRespond(
  client: PoolClient,
  requestId: string,
  enabled: boolean,
  actorUserId: string
): Promise<void> {
  await client.query(
    `MERGE elsa_request_policies AS target
     USING (SELECT $1 AS request_id, $2 AS auto_respond_enabled, $3 AS updated_by_user_id) AS src
       ON target.request_id = src.request_id
     WHEN MATCHED THEN
       UPDATE SET auto_respond_enabled = src.auto_respond_enabled,
                  updated_by_user_id = src.updated_by_user_id,
                  updated_at = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN
       INSERT (request_id, auto_respond_enabled, updated_by_user_id)
       VALUES (src.request_id, src.auto_respond_enabled, src.updated_by_user_id);`,
    [requestId, enabled ? 1 : 0, actorUserId]
  );
}

export async function getElsaRequestAutoRespond(
  client: Queryable,
  requestId: string
): Promise<boolean> {
  const r = await client.query<{ auto_respond_enabled: boolean }>(
    `SELECT auto_respond_enabled
     FROM elsa_request_policies
     WHERE request_id = $1`,
    [requestId]
  );
  return Boolean(r.rows[0]?.auto_respond_enabled);
}

export async function listCategoryPolicies(
  client: Queryable
): Promise<Array<{ category_code: string; auto_send_enabled: boolean }>> {
  const r = await client.query<{ category_code: string; auto_send_enabled: boolean }>(
    `SELECT category_code, auto_send_enabled
     FROM elsa_category_policies`
  );
  return r.rows;
}

export async function listPriorityPolicies(
  client: Queryable
): Promise<Array<{ priority_code: string; auto_send_enabled: boolean; require_admin_review: boolean }>> {
  const r = await client.query<{
    priority_code: string;
    auto_send_enabled: boolean;
    require_admin_review: boolean;
  }>(
    `SELECT priority_code, auto_send_enabled, require_admin_review
     FROM elsa_priority_policies`
  );
  return r.rows;
}

export async function listPropertyPolicies(
  client: Queryable
): Promise<Array<{ property_id: string; auto_send_enabled_override: boolean | null; require_review_all: boolean }>> {
  const r = await client.query<{
    property_id: string;
    auto_send_enabled_override: boolean | null;
    require_review_all: boolean;
  }>(
    `SELECT property_id, auto_send_enabled_override, require_review_all
     FROM elsa_property_policies`
  );
  return r.rows;
}

export async function upsertCategoryPolicy(
  client: PoolClient,
  categoryCode: string,
  autoSendEnabled: boolean,
  actorUserId: string
): Promise<void> {
  await client.query(
    `MERGE elsa_category_policies AS target
     USING (SELECT $1 AS category_code, $2 AS auto_send_enabled, $3 AS updated_by_user_id) AS src
       ON target.category_code = src.category_code
     WHEN MATCHED THEN
       UPDATE SET auto_send_enabled = src.auto_send_enabled,
                  updated_by_user_id = src.updated_by_user_id,
                  updated_at = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN
       INSERT (category_code, auto_send_enabled, updated_by_user_id)
       VALUES (src.category_code, src.auto_send_enabled, src.updated_by_user_id);`,
    [categoryCode, autoSendEnabled ? 1 : 0, actorUserId]
  );
}

export async function upsertPriorityPolicy(
  client: PoolClient,
  priorityCode: string,
  autoSendEnabled: boolean,
  requireAdminReview: boolean,
  actorUserId: string
): Promise<void> {
  await client.query(
    `MERGE elsa_priority_policies AS target
     USING (
      SELECT $1 AS priority_code, $2 AS auto_send_enabled, $3 AS require_admin_review, $4 AS updated_by_user_id
     ) AS src
       ON target.priority_code = src.priority_code
     WHEN MATCHED THEN
       UPDATE SET auto_send_enabled = src.auto_send_enabled,
                  require_admin_review = src.require_admin_review,
                  updated_by_user_id = src.updated_by_user_id,
                  updated_at = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN
       INSERT (priority_code, auto_send_enabled, require_admin_review, updated_by_user_id)
       VALUES (src.priority_code, src.auto_send_enabled, src.require_admin_review, src.updated_by_user_id);`,
    [priorityCode, autoSendEnabled ? 1 : 0, requireAdminReview ? 1 : 0, actorUserId]
  );
}

export async function upsertPropertyPolicy(
  client: PoolClient,
  propertyId: string,
  autoSendEnabledOverride: boolean | null,
  requireReviewAll: boolean,
  actorUserId: string
): Promise<void> {
  await client.query(
    `MERGE elsa_property_policies AS target
     USING (
      SELECT $1 AS property_id, $2 AS auto_send_enabled_override, $3 AS require_review_all, $4 AS updated_by_user_id
     ) AS src
       ON target.property_id = src.property_id
     WHEN MATCHED THEN
       UPDATE SET auto_send_enabled_override = src.auto_send_enabled_override,
                  require_review_all = src.require_review_all,
                  updated_by_user_id = src.updated_by_user_id,
                  updated_at = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN
       INSERT (property_id, auto_send_enabled_override, require_review_all, updated_by_user_id)
       VALUES (src.property_id, src.auto_send_enabled_override, src.require_review_all, src.updated_by_user_id);`,
    [propertyId, autoSendEnabledOverride, requireReviewAll ? 1 : 0, actorUserId]
  );
}

export async function createElsaDecision(
  client: PoolClient,
  params: {
    requestId: string;
    triggeringEvent: string;
    triggeringUserId: string | null;
    modelName: string | null;
    providerUsed: string | null;
    promptVersion: string | null;
    mode: string | null;
    deliveryDecision: string | null;
    policyDecision: string;
    confidence: number | null;
    suggestionJson: unknown;
    tenantReplyDraft: string | null;
    internalSummary: string | null;
    recommendedNextAction: string | null;
    dispatchSummary: string | null;
    policyFlags: string[];
    autoSendRationale: string | null;
    sentMessageId: string | null;
    sentAt: Date | null;
  }
): Promise<string> {
  const r = await client.query<{ id: string }>(
    `DECLARE @inserted TABLE (id UNIQUEIDENTIFIER);
     INSERT INTO elsa_decisions (
       id, request_id, triggering_event, triggering_user_id, model_name, provider_used, prompt_version,
       mode, delivery_decision, policy_decision, confidence, suggestion_json, tenant_reply_draft,
       internal_summary, recommended_next_action, dispatch_summary, policy_flags_json,
       auto_send_rationale, sent_message_id, sent_at
     )
     OUTPUT INSERTED.id INTO @inserted(id)
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19);
     SELECT CONVERT(NVARCHAR(36), id) AS id FROM @inserted;`,
    [
      params.requestId,
      params.triggeringEvent,
      params.triggeringUserId,
      params.modelName,
      params.providerUsed,
      params.promptVersion,
      params.mode,
      params.deliveryDecision,
      params.policyDecision,
      params.confidence,
      JSON.stringify(params.suggestionJson ?? null),
      params.tenantReplyDraft,
      params.internalSummary,
      params.recommendedNextAction,
      params.dispatchSummary,
      JSON.stringify(params.policyFlags ?? []),
      params.autoSendRationale,
      params.sentMessageId,
      params.sentAt,
    ]
  );
  return r.rows[0]?.id ?? '';
}

export async function listElsaDecisionsForRequest(
  client: Queryable,
  requestId: string,
  limit = 25
): Promise<ElsaDecisionRow[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.floor(limit))) : 25;
  const r = await client.query<ElsaDecisionRow>(
    `SELECT TOP (${safeLimit})
       id, request_id, triggering_event, model_name, provider_used, prompt_version,
       mode, delivery_decision, policy_decision, confidence, suggestion_json,
       tenant_reply_draft, internal_summary, recommended_next_action, dispatch_summary,
       policy_flags_json, auto_send_rationale, sent_message_id, sent_at,
       review_status, review_action, reviewed_by_user_id, reviewed_at, created_at
     FROM elsa_decisions
     WHERE request_id = $1
     ORDER BY created_at DESC;`,
    [requestId]
  );
  return r.rows;
}

export async function getElsaDecisionForRequest(
  client: Queryable,
  requestId: string,
  decisionId: string
): Promise<ElsaDecisionRow | null> {
  const r = await client.query<ElsaDecisionRow>(
    `SELECT TOP 1
       id, request_id, triggering_event, model_name, provider_used, prompt_version,
       mode, delivery_decision, policy_decision, confidence, suggestion_json,
       tenant_reply_draft, internal_summary, recommended_next_action, dispatch_summary,
       policy_flags_json, auto_send_rationale, sent_message_id, sent_at,
       review_status, review_action, reviewed_by_user_id, reviewed_at, created_at
     FROM elsa_decisions
     WHERE request_id = $1
       AND id = $2`,
    [requestId, decisionId]
  );
  return r.rows[0] ?? null;
}

export async function markElsaDecisionReviewed(
  client: PoolClient,
  params: {
    requestId: string;
    decisionId: string;
    reviewStatus: 'RESOLVED' | 'DISMISSED';
    reviewAction: 'MARK_RESOLVED' | 'SEND_AND_RESOLVE' | 'DISMISS';
    actorUserId: string;
  }
): Promise<ElsaDecisionRow | null> {
  const r = await client.query<ElsaDecisionRow>(
    `UPDATE elsa_decisions
       SET review_status = $3,
           review_action = $4,
           reviewed_by_user_id = $5,
           reviewed_at = SYSDATETIMEOFFSET()
     OUTPUT INSERTED.id, INSERTED.request_id, INSERTED.triggering_event, INSERTED.model_name,
            INSERTED.provider_used, INSERTED.prompt_version, INSERTED.mode, INSERTED.delivery_decision,
            INSERTED.policy_decision, INSERTED.confidence, INSERTED.suggestion_json,
           INSERTED.tenant_reply_draft, INSERTED.internal_summary, INSERTED.recommended_next_action,
            INSERTED.dispatch_summary, INSERTED.policy_flags_json, INSERTED.auto_send_rationale,
            INSERTED.sent_message_id, INSERTED.sent_at, INSERTED.review_status, INSERTED.review_action,
            CONVERT(NVARCHAR(36), INSERTED.reviewed_by_user_id) AS reviewed_by_user_id,
            INSERTED.reviewed_at, INSERTED.created_at
     WHERE request_id = $1
       AND id = $2`,
    [params.requestId, params.decisionId, params.reviewStatus, params.reviewAction, params.actorUserId]
  );
  return r.rows[0] ?? null;
}

export async function listAiAgents(client: Queryable): Promise<AiAgentRow[]> {
  const r = await client.query<AiAgentRow>(
    `SELECT
       CONVERT(NVARCHAR(36), id) AS id,
       code,
       display_name,
       provider,
       primary_model,
       fallback_model,
       enabled,
       is_system,
       metadata_json,
       updated_at
     FROM ai_agents
     ORDER BY enabled DESC, code ASC`
  );
  return r.rows;
}

export async function getAiAgentRouting(client: Queryable): Promise<AiAgentRoutingRow | null> {
  const r = await client.query<AiAgentRoutingRow>(
    `SELECT TOP 1
       CONVERT(NVARCHAR(36), primary_agent_id) AS primary_agent_id,
       CONVERT(NVARCHAR(36), fallback_agent_id) AS fallback_agent_id,
       updated_at
     FROM ai_agent_routing
     WHERE config_key = 'default'`
  );
  return r.rows[0] ?? null;
}

export async function setAiAgentRouting(
  client: PoolClient,
  params: {
    primaryAgentId: string;
    fallbackAgentId: string | null;
    actorUserId: string;
  }
): Promise<void> {
  await client.query(
    `MERGE ai_agent_routing AS target
     USING (
       SELECT
         'default' AS config_key,
         CAST($1 AS UNIQUEIDENTIFIER) AS primary_agent_id,
         CAST($2 AS UNIQUEIDENTIFIER) AS fallback_agent_id,
         CAST($3 AS UNIQUEIDENTIFIER) AS updated_by_user_id
     ) AS src
       ON target.config_key = src.config_key
     WHEN MATCHED THEN
       UPDATE SET primary_agent_id = src.primary_agent_id,
                  fallback_agent_id = src.fallback_agent_id,
                  updated_by_user_id = src.updated_by_user_id,
                  updated_at = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN
       INSERT (config_key, primary_agent_id, fallback_agent_id, updated_by_user_id)
       VALUES (src.config_key, src.primary_agent_id, src.fallback_agent_id, src.updated_by_user_id);`,
    [params.primaryAgentId, params.fallbackAgentId, params.actorUserId]
  );
}

export async function resolveAiAgentModels(client: Queryable): Promise<{
  primaryModel: string | null;
  fallbackModel: string | null;
  primaryAgentId: string | null;
  fallbackAgentId: string | null;
}> {
  const routing = await getAiAgentRouting(client);
  if (!routing) {
    return {
      primaryModel: null,
      fallbackModel: null,
      primaryAgentId: null,
      fallbackAgentId: null,
    };
  }

  const r = await client.query<{
    primary_model: string | null;
    fallback_model: string | null;
  }>(
    `SELECT TOP 1
       p.primary_model AS primary_model,
       f.primary_model AS fallback_model
     FROM ai_agent_routing ar
     INNER JOIN ai_agents p ON p.id = ar.primary_agent_id AND p.enabled = 1
     LEFT JOIN ai_agents f ON f.id = ar.fallback_agent_id AND f.enabled = 1
     WHERE ar.config_key = 'default'`
  );
  return {
    primaryModel: r.rows[0]?.primary_model ?? null,
    fallbackModel: r.rows[0]?.fallback_model ?? null,
    primaryAgentId: routing.primary_agent_id,
    fallbackAgentId: routing.fallback_agent_id,
  };
}
