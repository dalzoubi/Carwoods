import type { RequestMessageRow, RequestRow } from '../../lib/requestsRepo.js';
import {
  ElsaDeliveryDecision,
  parseElsaSuggestion,
  type ElsaSuggestion,
} from './elsaTypes.js';

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

const REMOTE_MODEL_TIMEOUT_MS = 12000;
const PROMPT_VERSION = 'elsa-guardrails-v4-remote';

function log(logger: ElsaLogger | undefined, level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown>): void {
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
    '- tenantReplyDraft must be concise, empathetic, and safe. No legal advice. No liability admissions.',
    '- Do NOT make scheduling promises unless scheduled_from or scheduled_to is already set in the request.',
    '- The full non-internal conversation history is included below. Read every prior management message. If a prior management message is similar or identical to what you would write, produce something meaningfully different — ask for one new concrete detail, acknowledge a new symptom, or give a short progress update. Never repeat what was already sent.',
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

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  // Strip markdown code fences if present
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function unavailableStub(reason: string): ElsaSuggestion {
  return {
    mode: 'NEED_MORE_INFO',
    deliveryDecision: ElsaDeliveryDecision.ADMIN_REVIEW_REQUIRED,
    tenantReplyDraft: 'Thanks for your request. A team member will review and follow up shortly.',
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

export async function suggestReply(context: AiMaintenanceReplyContext): Promise<AiMaintenanceReplyResult> {
  const logger = context.logger;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const modelName = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

  if (!apiKey) {
    log(logger, 'warn', 'elsa.gemini.no_api_key', {
      hint: 'Set GEMINI_API_KEY in Function App settings to enable AI responses.',
    });
    return { suggestion: unavailableStub('GEMINI_API_KEY is not configured.'), modelName, providerUsed: 'unavailable', promptVersion: PROMPT_VERSION };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_MODEL_TIMEOUT_MS);
  try {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    log(logger, 'info', 'elsa.gemini.request.start', { modelName, requestId: context.request.id });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(context) }] }],
        // Do NOT use responseMimeType — not supported on all model versions and
        // causes silent 400s. We rely on extractJsonFromText to parse the output.
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch { /* ignore */ }
      log(logger, 'error', 'elsa.gemini.http_error', {
        status: res.status,
        statusText: res.statusText,
        body: errBody.slice(0, 500),
        modelName,
      });
      return { suggestion: unavailableStub(`Gemini HTTP ${res.status}: ${res.statusText}`), modelName, providerUsed: 'unavailable', promptVersion: PROMPT_VERSION };
    }

    const payload = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = payload?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text ?? '')
      .join('\n')
      .trim();

    if (!rawText) {
      log(logger, 'error', 'elsa.gemini.empty_response', { modelName, payload: JSON.stringify(payload).slice(0, 500) });
      return { suggestion: unavailableStub('Gemini returned an empty response.'), modelName, providerUsed: 'unavailable', promptVersion: PROMPT_VERSION };
    }

    let parsed: unknown;
    try {
      parsed = extractJsonFromText(rawText);
    } catch (parseErr) {
      log(logger, 'error', 'elsa.gemini.json_parse_error', {
        modelName,
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
        rawText: rawText.slice(0, 500),
      });
      return { suggestion: unavailableStub('Gemini response could not be parsed as JSON.'), modelName, providerUsed: 'unavailable', promptVersion: PROMPT_VERSION };
    }

    const suggestion = parseElsaSuggestion(parsed);
    if (!suggestion) {
      log(logger, 'error', 'elsa.gemini.schema_validation_failed', {
        modelName,
        parsed: JSON.stringify(parsed).slice(0, 500),
      });
      return { suggestion: unavailableStub('Gemini response failed schema validation.'), modelName, providerUsed: 'unavailable', promptVersion: PROMPT_VERSION };
    }

    log(logger, 'info', 'elsa.gemini.success', { modelName, mode: suggestion.mode, confidence: suggestion.confidence });
    return { suggestion, modelName, providerUsed: 'remote', promptVersion: PROMPT_VERSION };

  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    log(logger, 'error', 'elsa.gemini.request_failed', {
      modelName,
      reason: isAbort ? 'timeout' : (err instanceof Error ? err.message : String(err)),
    });
    return { suggestion: unavailableStub(isAbort ? 'Gemini request timed out.' : 'Gemini request failed with a network error.'), modelName, providerUsed: 'unavailable', promptVersion: PROMPT_VERSION };
  } finally {
    clearTimeout(timeout);
  }
}
