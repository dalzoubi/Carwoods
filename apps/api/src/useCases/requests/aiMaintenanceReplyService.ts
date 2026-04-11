/**
 * Elsa AI maintenance reply service.
 *
 * This module owns:
 * - Prompt construction (Elsa guardrails v4)
 * - JSON extraction / schema validation of the model's output
 * - Safe degraded-mode response when the LLM module returns null
 *
 * It does NOT own:
 * - Transport, retry, circuit breaker, or model selection (→ LlmClient)
 * - Policy evaluation (→ autoSendPolicyEngine)
 * - Persistence (→ elsaRepo, processElsaAutoResponse)
 */

import type { RequestMessageRow, RequestRow } from '../../lib/requestsRepo.js';
import { ElsaDeliveryDecision, parseElsaSuggestion, type ElsaSuggestion } from './elsaTypes.js';
import type { LlmClient, LlmMetricsHook } from '../../lib/llm/index.js';

export type ElsaLogger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
};

export type AiMaintenanceReplyContext = {
  request: RequestRow;
  messages: RequestMessageRow[];
  weatherSeverity: 'NORMAL' | 'DANGEROUS_HEAT' | 'DANGEROUS_COLD';
  nowIso: string;
  logger?: ElsaLogger;
};

export type AiMaintenanceReplyResult = {
  suggestion: ElsaSuggestion;
  modelName: string;
  providerUsed: 'remote' | 'unavailable';
  promptVersion: string;
};

const PROMPT_VERSION = 'elsa-guardrails-v5-pure-ai';

// ── Logger helper ─────────────────────────────────────────────────────────────

function log(
  logger: ElsaLogger | undefined,
  level: 'info' | 'warn' | 'error',
  event: string,
  data: Record<string, unknown>
): void {
  const payload = JSON.stringify({ event, ...data });
  // Use explicit method-call syntax so `this` is preserved for host objects
  // like Azure InvocationContext that rely on it internally.
  if (level === 'error') {
    if (logger?.error) { logger.error(payload); } else { console.error(payload); }
    return;
  }
  if (level === 'warn') {
    if (logger?.warn) { logger.warn(payload); } else { console.warn(payload); }
    return;
  }
  if (logger?.info) { logger.info(payload); } else { console.log(payload); }
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(context: AiMaintenanceReplyContext): string {
  const conversationHistory = context.messages
    .filter((msg) => !msg.is_internal)
    .map((msg) => ({
      sender_role: msg.sender_role,
      body: msg.body,
      created_at: msg.created_at,
    }));

  return [
    'You are Elsa, a constrained maintenance triage assistant for a property management company.',
    'Return ONLY a single raw JSON object — no markdown, no code fences, no explanation.',
    'The JSON must match this schema exactly:',
    '{',
    '  "mode": "NEED_MORE_INFO | SAFE_BASIC_TROUBLESHOOTING | ESCALATE_TO_VENDOR | EMERGENCY_ESCALATION | DUPLICATE_OR_ALREADY_IN_PROGRESS",',
    '  "deliveryDecision": "AUTO_SEND_ALLOWED | ADMIN_REVIEW_REQUIRED",',
    '  "tenantReplyDraft": "string",',
    '  "internalSummary": "string",',
    '  "recommendedNextAction": "string",',
    '  "missingInformation": ["string"],',
    '  "safeTroubleshootingSteps": ["string"],',
    '  "dispatchSummary": "string",',
    '  "confidence": 0.0,',
    '  "policyFlags": ["string"],',
    '  "autoSendRationale": "string"',
    '}',
    '',
    'Rules:',
    '- tenantReplyDraft is the exact tenant-facing message that will be sent. Write it as a complete, ready-to-send response.',
    '- tenantReplyDraft must be concise, empathetic, and safe. No legal advice. No liability admissions.',
    '- Do not rely on missingInformation or safeTroubleshootingSteps arrays to carry the actual reply. Weave required details naturally into tenantReplyDraft.',
    '- Avoid canned openings. Do not start with "Thanks for reporting this" or close variants unless absolutely required by context.',
    '- Do NOT make scheduling promises unless scheduled_from or scheduled_to is already set in the request.',
    '- The full non-internal conversation history is included below. Read every prior management message.',
    '- You MUST NOT produce a tenantReplyDraft that is substantially similar to any prior management message. If overlap exists, acknowledge progress, ask for one new concrete detail, or provide a meaningful status update. Repetition will be blocked.',
    '- If mode=NEED_MORE_INFO, ask for missing details naturally in tenantReplyDraft.',
    '- If mode=SAFE_BASIC_TROUBLESHOOTING, include safe troubleshooting guidance naturally in tenantReplyDraft.',
    '- If mode=DUPLICATE_OR_ALREADY_IN_PROGRESS, acknowledge the duplicate and redirect tenant to the active thread in tenantReplyDraft.',
    '- If mode=ESCALATE_TO_VENDOR, explain that the request is under review and next steps will follow in tenantReplyDraft.',
    '- Set mode=EMERGENCY_ESCALATION and deliveryDecision=ADMIN_REVIEW_REQUIRED for any gas, fire, smoke, flooding, sparking, sewage, or carbon monoxide signal.',
    '- confidence must be a float between 0.0 and 1.0. Only use >= 0.78 for clearly safe, low-risk informational replies.',
    '- policyFlags: include EMERGENCY_SIGNAL_GAS, EMERGENCY_SIGNAL_SMOKE, etc. when applicable.',
    '',
    'Request context:',
    JSON.stringify(
      {
        request: {
          id: context.request.id,
          title: context.request.title,
          description: context.request.description,
          status_code: context.request.status_code,
          category_code: context.request.category_code,
          priority_code: context.request.priority_code,
          scheduled_from: context.request.scheduled_from,
          scheduled_to: context.request.scheduled_to,
        },
        conversation_history: conversationHistory,
        weather_severity: context.weatherSeverity,
        now_iso: context.nowIso,
      },
      null,
      2
    ),
  ].join('\n');
}

// ── JSON extraction ───────────────────────────────────────────────────────────

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  // Strip markdown code fences if present
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
}

// ── Degraded-mode stub ────────────────────────────────────────────────────────

function buildUnavailableSuggestion(reason: string): ElsaSuggestion {
  return {
    mode: 'NEED_MORE_INFO',
    deliveryDecision: ElsaDeliveryDecision.ADMIN_REVIEW_REQUIRED,
    tenantReplyDraft: 'We received your request. A team member will review it and follow up shortly.',
    internalSummary: reason,
    recommendedNextAction: 'Review and respond manually.',
    missingInformation: [],
    safeTroubleshootingSteps: [],
    dispatchSummary: '',
    confidence: 0.0,
    policyFlags: ['MODEL_PROVIDER_UNAVAILABLE'],
    autoSendRationale: 'Model unavailable; held for manual review.',
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export type SuggestReplyDeps = {
  /**
   * LlmClient instance. When null (GEMINI_API_KEY absent), the service
   * immediately returns degraded-mode without attempting any network call.
   */
  llmClient: LlmClient | null;
  metrics?: LlmMetricsHook;
};

/**
 * Generate an Elsa suggestion for a maintenance request.
 *
 * Never throws. All LLM errors are caught by LlmClient and result in a null response,
 * which this function converts to a safe degraded-mode suggestion.
 */
export async function suggestReply(
  context: AiMaintenanceReplyContext,
  deps: SuggestReplyDeps
): Promise<AiMaintenanceReplyResult> {
  const { llmClient } = deps;
  const logger = context.logger;

  if (!llmClient) {
    log(logger, 'warn', 'elsa.gemini.no_api_key', {
      hint: 'Set GEMINI_API_KEY in Function App settings to enable AI responses.',
    });
    return {
      suggestion: buildUnavailableSuggestion('GEMINI_API_KEY is not configured.'),
      modelName: 'unconfigured',
      providerUsed: 'unavailable',
      promptVersion: PROMPT_VERSION,
    };
  }

  log(logger, 'info', 'elsa.gemini.request.start', { requestId: context.request.id });

  const response = await llmClient.complete({
    prompt: buildPrompt(context),
    // Do NOT request JSON MIME mode — not supported on all model versions and
    // causes silent 400s. extractJsonFromText handles raw model output.
    expectJsonResponse: false,
    temperature: 0.2,
  });

  if (response === null) {
    log(logger, 'error', 'elsa.gemini.request_failed', {
      reason: 'LlmClient returned null (all retries + fallback exhausted or circuit open)',
    });
    return {
      suggestion: buildUnavailableSuggestion('LLM provider unavailable (retries exhausted or circuit open).'),
      modelName: 'unknown',
      providerUsed: 'unavailable',
      promptVersion: PROMPT_VERSION,
    };
  }

  let parsed: unknown;
  try {
    parsed = extractJsonFromText(response.text);
  } catch (parseErr) {
    log(logger, 'error', 'elsa.gemini.json_parse_error', {
      model: response.model,
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
      rawText: response.text.slice(0, 500),
    });
    return {
      suggestion: buildUnavailableSuggestion('Gemini response could not be parsed as JSON.'),
      modelName: response.model,
      providerUsed: 'unavailable',
      promptVersion: PROMPT_VERSION,
    };
  }

  const suggestion = parseElsaSuggestion(parsed);
  if (!suggestion) {
    log(logger, 'error', 'elsa.gemini.schema_validation_failed', {
      model: response.model,
      parsed: JSON.stringify(parsed).slice(0, 500),
    });
    return {
      suggestion: buildUnavailableSuggestion('Gemini response failed schema validation.'),
      modelName: response.model,
      providerUsed: 'unavailable',
      promptVersion: PROMPT_VERSION,
    };
  }

  log(logger, 'info', 'elsa.gemini.success', {
    model: response.model,
    usedFallback: response.usedFallback,
    attempts: response.attempts,
    latencyMs: response.latencyMs,
    mode: suggestion.mode,
    confidence: suggestion.confidence,
  });
  return {
    suggestion,
    modelName: response.model,
    providerUsed: 'remote',
    promptVersion: PROMPT_VERSION,
  };
}
