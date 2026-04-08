/**
 * Elsa AI maintenance reply service.
 *
 * This module owns:
 * - Prompt construction (Elsa guardrails v3)
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

export type AiMaintenanceReplyContext = {
  request: RequestRow;
  messages: RequestMessageRow[];
  weatherSeverity: 'NORMAL' | 'DANGEROUS_HEAT' | 'DANGEROUS_COLD';
  nowIso: string;
};

export type AiMaintenanceReplyResult = {
  suggestion: ElsaSuggestion;
  modelName: string;
  providerUsed: 'remote' | 'unavailable';
  promptVersion: string;
};

const PROMPT_VERSION = 'elsa-guardrails-v3-remote';

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
    'Return ONLY strict JSON matching this exact schema (no markdown, no extra text):',
    '{',
    '  "mode":"NEED_MORE_INFO|SAFE_BASIC_TROUBLESHOOTING|ESCALATE_TO_VENDOR|EMERGENCY_ESCALATION|DUPLICATE_OR_ALREADY_IN_PROGRESS",',
    '  "deliveryDecision":"AUTO_SEND_ALLOWED|ADMIN_REVIEW_REQUIRED",',
    '  "tenantReplyDraft":"string",',
    '  "internalSummary":"string",',
    '  "recommendedNextAction":"string",',
    '  "missingInformation":["string"],',
    '  "safeTroubleshootingSteps":["string"],',
    '  "dispatchSummary":"string",',
    '  "confidence":0.0,',
    '  "policyFlags":["string"],',
    '  "autoSendRationale":"string"',
    '}',
    '',
    'Rules:',
    '- tenantReplyDraft must be concise, empathetic, and safe. No legal advice, no liability admissions.',
    '- Do not make specific scheduling promises unless scheduled_from/scheduled_to are set.',
    '- If the conversation already contains a management reply that is similar or identical to what you would write, write something meaningfully different: ask for one new concrete detail, acknowledge a new symptom, or give a brief status update. Never repeat what was already sent.',
    '- Set mode=EMERGENCY_ESCALATION and deliveryDecision=ADMIN_REVIEW_REQUIRED for any gas, fire, smoke, flooding, sparking, sewage, or carbon monoxide signals.',
    '- Set confidence between 0.0 and 1.0. Use >= 0.78 only when the reply is clearly safe and low-risk.',
    '- policyFlags: include EMERGENCY_SIGNAL_* codes when emergency keywords are present.',
    '',
    'Request context (full non-internal conversation history is included so you can avoid repetition):',
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
  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = codeFenceMatch ? codeFenceMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
}

// ── Degraded-mode stub ────────────────────────────────────────────────────────

function buildUnavailableSuggestion(modelName: string): AiMaintenanceReplyResult {
  const suggestion: ElsaSuggestion = {
    mode: 'NEED_MORE_INFO',
    deliveryDecision: ElsaDeliveryDecision.ADMIN_REVIEW_REQUIRED,
    tenantReplyDraft: 'Thanks for your request. We are reviewing this and a team member will follow up shortly.',
    internalSummary: 'LLM provider unavailable or returned an invalid response. Held for admin review.',
    recommendedNextAction: 'Review and respond manually.',
    missingInformation: [],
    safeTroubleshootingSteps: [],
    dispatchSummary: '',
    confidence: 0.0,
    policyFlags: ['MODEL_PROVIDER_UNAVAILABLE'],
    autoSendRationale: 'Remote model unavailable; held for review.',
  };
  return {
    suggestion,
    modelName,
    providerUsed: 'unavailable',
    promptVersion: PROMPT_VERSION,
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

  if (!llmClient) {
    return buildUnavailableSuggestion('unconfigured');
  }

  const response = await llmClient.complete({
    prompt: buildPrompt(context),
    expectJsonResponse: true,
    temperature: 0.2,
  });

  if (response === null) {
    return buildUnavailableSuggestion('unknown');
  }

  try {
    const parsed = extractJsonFromText(response.text);
    const suggestion = parseElsaSuggestion(parsed);
    if (suggestion) {
      return {
        suggestion,
        modelName: response.model,
        providerUsed: 'remote',
        promptVersion: PROMPT_VERSION,
      };
    }
  } catch {
    // JSON parse error – fall through to degraded
  }

  return buildUnavailableSuggestion(response.model);
}
