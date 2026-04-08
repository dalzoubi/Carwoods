import { RequestStatus } from '../../domain/constants.js';
import type { RequestMessageRow, RequestRow } from '../../lib/requestsRepo.js';
import {
  ElsaDeliveryDecision,
  ElsaResponseMode,
  parseElsaSuggestion,
  type ElsaDeliveryDecision as ElsaDeliveryDecisionType,
  type ElsaResponseMode as ElsaResponseModeType,
  type ElsaSuggestion,
} from './elsaTypes.js';

export type AiMaintenanceReplyContext = {
  request: RequestRow;
  messages: RequestMessageRow[];
  weatherSeverity: 'NORMAL' | 'DANGEROUS_HEAT' | 'DANGEROUS_COLD';
  nowIso: string;
};

export type AiMaintenanceReplyResult = {
  suggestion: ElsaSuggestion;
  modelName: string;
  providerUsed: 'remote' | 'heuristic_fallback';
  promptVersion: string;
};

const REMOTE_MODEL_TIMEOUT_MS = 8000;

const EMERGENCY_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: 'EMERGENCY_SIGNAL_GAS', pattern: /\bgas smell|gas odor\b/i },
  { code: 'EMERGENCY_SIGNAL_SMOKE', pattern: /\bsmoke|fire|flame\b/i },
  { code: 'EMERGENCY_SIGNAL_SPARKING', pattern: /\bsparking|exposed wire|electrical burn\b/i },
  { code: 'EMERGENCY_SIGNAL_FLOOD', pattern: /\bflood|flooding|major leak|burst pipe\b/i },
  { code: 'EMERGENCY_SIGNAL_SEWAGE', pattern: /\bsewage|sewer backup\b/i },
  { code: 'EMERGENCY_SIGNAL_CO', pattern: /\bcarbon monoxide|co alarm\b/i },
];

const TROUBLESHOOTING_MAP: Array<{ code: string; matcher: RegExp; step: string }> = [
  {
    code: 'HVAC_CHECK_THERMOSTAT_MODE',
    matcher: /\b(ac|air|cool|heat|hvac|thermostat)\b/i,
    step: 'Please confirm the thermostat mode is set correctly for the issue (cool or heat).',
  },
  {
    code: 'HVAC_CHECK_SETPOINT',
    matcher: /\b(ac|air|cool|heat|thermostat)\b/i,
    step: 'Please share the thermostat set temperature and current room temperature if visible.',
  },
  {
    code: 'HVAC_CONFIRM_BLOWING_AIR',
    matcher: /\b(ac|air|hvac|vent)\b/i,
    step: 'Please confirm whether air is blowing from the vents.',
  },
  {
    code: 'ELECTRICAL_CHECK_GFCI_RESET',
    matcher: /\boutlet|bathroom|kitchen|gfci|power\b/i,
    step: 'If applicable, please check and reset a nearby GFCI outlet.',
  },
  {
    code: 'APPLIANCE_CONFIRM_POWER',
    matcher: /\bfridge|oven|microwave|dishwasher|appliance|washer|dryer\b/i,
    step: 'Please confirm the appliance is plugged in and receiving power.',
  },
];

function latestTenantText(messages: RequestMessageRow[], fallback: string): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const row = messages[i];
    if (String(row.sender_role || '').toUpperCase() === 'TENANT' && !row.is_internal) {
      return String(row.body || '').trim();
    }
  }
  return fallback;
}

function hasAny(text: string, patterns: Array<{ code: string; pattern: RegExp }>): string[] {
  return patterns.filter((item) => item.pattern.test(text)).map((item) => item.code);
}

function buildPrompt(context: AiMaintenanceReplyContext): string {
  const recentMessages = context.messages.slice(-8).map((msg) => ({
    sender_role: msg.sender_role,
    is_internal: msg.is_internal,
    body: msg.body,
    created_at: msg.created_at,
  }));
  return [
    'You are Elsa, a constrained maintenance triage assistant.',
    'Return only strict JSON matching this schema:',
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
    'Rules:',
    '- Keep tenantReplyDraft concise and safe.',
    '- No legal advice, no liability admissions, no unsupported scheduling promises.',
    '- Include emergency-related policy flags when applicable.',
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
        recent_messages: recentMessages,
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
  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = codeFenceMatch ? codeFenceMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
}

async function suggestFromRemoteModel(
  context: AiMaintenanceReplyContext
): Promise<AiMaintenanceReplyResult | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const modelName = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_MODEL_TIMEOUT_MS);
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildPrompt(context) }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text ?? '').join('\n').trim();
    if (!text) return null;
    const parsed = extractJsonFromText(text);
    const suggestion = parseElsaSuggestion(parsed);
    if (!suggestion) return null;
    return {
      suggestion,
      modelName,
      providerUsed: 'remote',
      promptVersion: 'elsa-guardrails-v2-remote',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function suggestHeuristically(context: AiMaintenanceReplyContext): AiMaintenanceReplyResult {
  const modelName = process.env.GEMINI_MODEL?.trim() || 'elsa-guardrailed-v1';
  const promptVersion = 'elsa-guardrails-v1';
  const latestText = latestTenantText(context.messages, context.request.description || '');
  const allThreadText = [context.request.title, context.request.description, ...context.messages.map((m) => m.body)]
    .join('\n')
    .toLowerCase();
  const emergencyFlags = hasAny(allThreadText, EMERGENCY_PATTERNS);
  const missingInfo: string[] = [];
  const troubleshootingSteps: string[] = [];
  const policyFlags = [...emergencyFlags];
  let mode: ElsaResponseModeType = ElsaResponseMode.NEED_MORE_INFO;
  let deliveryDecision: ElsaDeliveryDecisionType = ElsaDeliveryDecision.ADMIN_REVIEW_REQUIRED;
  let confidence = 0.62;

  if (emergencyFlags.length > 0) {
    mode = ElsaResponseMode.EMERGENCY_ESCALATION;
    confidence = 0.93;
    policyFlags.push('BLOCKED_EMERGENCY_CATEGORY');
  } else if (
    String(context.request.status_code || '').toUpperCase() === RequestStatus.SCHEDULED
    || String(context.request.status_code || '').toUpperCase() === RequestStatus.IN_PROGRESS
  ) {
    mode = ElsaResponseMode.DUPLICATE_OR_ALREADY_IN_PROGRESS;
    deliveryDecision = ElsaDeliveryDecision.AUTO_SEND_ALLOWED;
    confidence = 0.88;
    policyFlags.push('DUPLICATE_OR_IN_PROGRESS_CONTEXT');
  } else {
    for (const item of TROUBLESHOOTING_MAP) {
      if (item.matcher.test(allThreadText)) {
        troubleshootingSteps.push(item.step);
        policyFlags.push(`SAFE_TROUBLESHOOTING_ALLOWLIST:${item.code}`);
      }
    }
    if (troubleshootingSteps.length > 0) {
      mode = ElsaResponseMode.SAFE_BASIC_TROUBLESHOOTING;
      deliveryDecision = ElsaDeliveryDecision.AUTO_SEND_ALLOWED;
      confidence = 0.83;
    } else {
      mode = ElsaResponseMode.NEED_MORE_INFO;
      deliveryDecision = ElsaDeliveryDecision.AUTO_SEND_ALLOWED;
      confidence = 0.8;
    }
  }

  if (latestText.length < 12) missingInfo.push('Please describe the issue in more detail.');
  if (!/\b(kitchen|bath|bed|living|hall|garage|unit|room)\b/i.test(allThreadText)) {
    missingInfo.push('Which room or fixture is affected?');
  }
  if (!/\b(today|yesterday|hour|day|week|started|since)\b/i.test(allThreadText)) {
    missingInfo.push('When did this issue start?');
  }
  if (!/\bphoto|video|picture|image\b/i.test(allThreadText)) {
    missingInfo.push('Please share a photo or short video if possible.');
  }
  if (!/\bone|single|multiple|all\b/i.test(allThreadText)) {
    missingInfo.push('Does this affect one area or multiple areas?');
  }

  const tenantReplyDraft = emergencyFlags.length > 0
    ? 'We are flagging this as urgent. If there is immediate danger, please prioritize safety and call emergency services or the utility emergency line right away, then move to a safe location.'
    : mode === ElsaResponseMode.DUPLICATE_OR_ALREADY_IN_PROGRESS
      ? 'Thanks for the update. This request is already in progress. If there is any new symptom, new damage, or access change, please share that here.'
      : mode === ElsaResponseMode.SAFE_BASIC_TROUBLESHOOTING
        ? `Thanks for reporting this. While we review, please try these safe checks:\n- ${troubleshootingSteps.slice(0, 5).join('\n- ')}`
        : `Thanks for reporting this. We are reviewing your request. To help us triage quickly, please share:\n- ${missingInfo.slice(0, 5).join('\n- ')}`;

  const suggestion: ElsaSuggestion = {
    mode,
    deliveryDecision,
    tenantReplyDraft,
    internalSummary: `Issue triaged as ${mode}. Latest tenant message: "${latestText.slice(0, 200)}"`,
    recommendedNextAction:
      mode === ElsaResponseMode.EMERGENCY_ESCALATION
        ? 'Alert on-call manager immediately and prioritize dispatch.'
        : mode === ElsaResponseMode.DUPLICATE_OR_ALREADY_IN_PROGRESS
          ? 'Keep current workflow; monitor for materially new details.'
          : mode === ElsaResponseMode.SAFE_BASIC_TROUBLESHOOTING
            ? 'Collect troubleshooting outcomes and evaluate dispatch need.'
            : 'Collect missing details and reassess priority/vendor routing.',
    missingInformation: missingInfo.slice(0, 5),
    safeTroubleshootingSteps: troubleshootingSteps.slice(0, 5),
    dispatchSummary:
      mode === ElsaResponseMode.EMERGENCY_ESCALATION
        ? 'Likely vendor follow-up required after triage.'
        : 'Dispatch not yet required pending triage responses.',
    confidence,
    policyFlags: Array.from(new Set(policyFlags)),
    autoSendRationale:
      deliveryDecision === ElsaDeliveryDecision.AUTO_SEND_ALLOWED
        ? 'Low-risk informational response with no unsupported promises.'
        : 'Higher-risk/emergency context requires deterministic hold or block.',
  };
  return { suggestion, modelName, providerUsed: 'heuristic_fallback', promptVersion };
}

export async function suggestReply(context: AiMaintenanceReplyContext): Promise<AiMaintenanceReplyResult> {
  const remote = await suggestFromRemoteModel(context);
  if (remote) return remote;
  const fallback = suggestHeuristically(context);
  fallback.suggestion.policyFlags = Array.from(
    new Set([...(fallback.suggestion.policyFlags ?? []), 'MODEL_PROVIDER_UNAVAILABLE'])
  );
  fallback.suggestion.deliveryDecision = ElsaDeliveryDecision.ADMIN_REVIEW_REQUIRED;
  fallback.suggestion.autoSendRationale = 'Remote model unavailable; fallback triage generated and held for review.';
  return fallback;
}
