/**
 * Compact AI pass for notification preview + urgency hints (Phase 3).
 * Fail-open: never throws; returns degraded result on any error or missing LLM.
 */

import type { LlmClient } from '../../lib/llm/index.js';

const PROMPT_VERSION = 'notification-summarize-v1';

export type NotificationSummarizationResult = {
  notificationSummary: string;
  urgent: boolean;
  emergency: boolean;
  confidence: number;
  modelName: string;
  providerUsed: 'remote' | 'unavailable';
  promptVersion: string;
  errorDetail: string | null;
};

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function truncate160(value: string): string {
  const t = value.replace(/\s+/g, ' ').trim();
  if (t.length <= 160) return t;
  return `${t.slice(0, 157)}...`;
}

function parseNotificationAiPayload(raw: unknown): {
  notificationSummary: string;
  urgent: boolean;
  emergency: boolean;
  confidence: number;
} | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.notificationSummary !== 'string') return null;
  const confidence = Number(row.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  return {
    notificationSummary: row.notificationSummary,
    urgent: Boolean(row.urgent),
    emergency: Boolean(row.emergency),
    confidence,
  };
}

function buildPrompt(params: {
  requestTitle: string;
  requestDescription: string;
  messageSnippet: string;
  currentPriorityCode: string | null;
}): string {
  return [
    'You classify maintenance thread activity for operational notifications.',
    'Return ONLY one raw JSON object, no markdown.',
    'Schema:',
    '{ "notificationSummary": "string <= 160 chars", "urgent": boolean, "emergency": boolean, "confidence": number 0-1 }',
    'Rules:',
    '- notificationSummary: concise, for SMS/email preview; max 160 characters.',
    '- urgent true for time-sensitive issues (no heat in freeze, active leak, safety).',
    '- emergency true only for gas, fire, major flooding, sparking electrical, CO, life safety.',
    '- If unsure, set urgent/emergency false and lower confidence.',
    '',
    'Context:',
    JSON.stringify(params, null, 2),
  ].join('\n');
}

export async function summarizeForNotification(
  params: {
    requestTitle: string;
    requestDescription: string;
    messageSnippet: string;
    currentPriorityCode: string | null;
  },
  deps: { llmClient: LlmClient | null }
): Promise<NotificationSummarizationResult> {
  const { llmClient } = deps;
  if (!llmClient) {
    return {
      notificationSummary: truncate160(params.messageSnippet || params.requestTitle || 'Maintenance update'),
      urgent: false,
      emergency: false,
      confidence: 0,
      modelName: 'unconfigured',
      providerUsed: 'unavailable',
      promptVersion: PROMPT_VERSION,
      errorDetail: 'GEMINI_API_KEY is not configured',
    };
  }

  try {
    const response = await llmClient.complete({
      prompt: buildPrompt(params),
      expectJsonResponse: false,
      temperature: 0.1,
    });
    if (response === null) {
      return {
        notificationSummary: truncate160(params.messageSnippet || params.requestTitle || 'Maintenance update'),
        urgent: false,
        emergency: false,
        confidence: 0,
        modelName: 'unknown',
        providerUsed: 'unavailable',
        promptVersion: PROMPT_VERSION,
        errorDetail: 'LLM returned null',
      };
    }
    let parsed: unknown;
    try {
      parsed = extractJsonFromText(response.text);
    } catch (e) {
      return {
        notificationSummary: truncate160(params.messageSnippet || params.requestTitle || 'Maintenance update'),
        urgent: false,
        emergency: false,
        confidence: 0,
        modelName: response.model,
        providerUsed: 'unavailable',
        promptVersion: PROMPT_VERSION,
        errorDetail: e instanceof Error ? e.message : 'json_parse_error',
      };
    }
    const validated = parseNotificationAiPayload(parsed);
    if (!validated) {
      return {
        notificationSummary: truncate160(params.messageSnippet || params.requestTitle || 'Maintenance update'),
        urgent: false,
        emergency: false,
        confidence: 0,
        modelName: response.model,
        providerUsed: 'unavailable',
        promptVersion: PROMPT_VERSION,
        errorDetail: 'schema_validation_failed',
      };
    }
    return {
      notificationSummary: truncate160(validated.notificationSummary),
      urgent: validated.urgent,
      emergency: validated.emergency,
      confidence: validated.confidence,
      modelName: response.model,
      providerUsed: 'remote',
      promptVersion: PROMPT_VERSION,
      errorDetail: null,
    };
  } catch (e) {
    return {
      notificationSummary: truncate160(params.messageSnippet || params.requestTitle || 'Maintenance update'),
      urgent: false,
      emergency: false,
      confidence: 0,
      modelName: 'unknown',
      providerUsed: 'unavailable',
      promptVersion: PROMPT_VERSION,
      errorDetail: e instanceof Error ? e.message : 'unexpected_error',
    };
  }
}
