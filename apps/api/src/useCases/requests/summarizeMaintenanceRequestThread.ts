import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';
import {
  getRequestById,
  listRequestMessages,
  managementCanAccessRequest,
  type RequestMessageRow,
  type RequestRow,
} from '../../lib/requestsRepo.js';
import { resolveAiAgentModels } from '../../lib/elsaRepo.js';
import { getLlmClient } from '../../lib/llmClientFactory.js';

const PROMPT_VERSION = 'elsa-request-summary-v1';
const MAX_MESSAGE_CHARS = 14_000;

export type SummarizeMaintenanceRequestThreadInput = {
  requestId: string | undefined;
  actorUserId: string;
  actorRole: string;
  logger?: {
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
};

export type SummarizeMaintenanceRequestThreadOutput = {
  summary: string;
  model_name: string;
  provider_used: 'remote' | 'unavailable';
  prompt_version: string;
};

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function parseSummaryPayload(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.summary !== 'string') return null;
  const s = row.summary.replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.length > 4000 ? `${s.slice(0, 3997)}...` : s;
}

function buildThreadSnippet(messages: RequestMessageRow[]): string {
  const lines: string[] = [];
  let used = 0;
  for (const msg of messages) {
    const role = String(msg.sender_role || 'unknown');
    const internal = msg.is_internal ? ' [internal]' : '';
    const line = `[${role}${internal}] ${msg.body}`;
    if (used + line.length > MAX_MESSAGE_CHARS) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join('\n');
}

function buildFallbackSummary(request: RequestRow, messages: RequestMessageRow[]): string {
  const parts = [
    `Title: ${request.title}`,
    `Description: ${request.description}`,
    `Status: ${request.status_code || request.status_name || 'unknown'}`,
  ];
  if (messages.length > 0) {
    const last = messages[messages.length - 1];
    parts.push(`Latest message (${last.sender_display_name || last.sender_role || 'sender'}): ${last.body}`);
  }
  return parts.join('\n');
}

function buildPrompt(request: RequestRow, threadText: string): string {
  return [
    'You are Elsa, summarizing a maintenance request for property management staff.',
    'Return ONLY one raw JSON object, no markdown.',
    'Schema:',
    '{ "summary": "string" }',
    'Rules:',
    '- summary: 3–8 short bullet lines or one tight paragraph (plain text, no HTML).',
    '- Cover: what the tenant reported, current status, key dates or scheduling if mentioned, and open follow-ups.',
    '- Include internal staff notes only if they change understanding of the issue.',
    '- Do not invent facts; say if information is missing.',
    '',
    'Request metadata:',
    JSON.stringify(
      {
        title: request.title,
        description: request.description,
        status: request.status_code || request.status_name,
        category: request.category_code || request.category_name,
        priority: request.priority_code || request.priority_name,
        internal_notes: request.internal_notes,
      },
      null,
      2
    ),
    '',
    'Message thread (chronological):',
    threadText || '(no messages yet)',
  ].join('\n');
}

/**
 * One-off AI summary of a request thread for landlord/admin UI. Read-only (no DB writes).
 */
export async function summarizeMaintenanceRequestThread(
  db: TransactionPool,
  input: SummarizeMaintenanceRequestThreadInput
): Promise<SummarizeMaintenanceRequestThreadOutput> {
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

  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.requestId) throw validationError('missing_id');
  const role = input.actorRole.trim().toUpperCase();
  const ok = await managementCanAccessRequest(db, input.requestId, role, input.actorUserId);
  if (!ok) throw notFound();
  const request = await getRequestById(db, input.requestId);
  if (!request) throw notFound();

  const messages = await listRequestMessages(db, input.requestId, true);
  const threadText = buildThreadSnippet(messages);
  const agentModels = await resolveAiAgentModels(db);
  const llmClient = getLlmClient({
    primaryModel: agentModels.primaryModel ?? undefined,
    fallbackModel: agentModels.fallbackModel,
  });

  if (!llmClient) {
    log('warn', 'elsa.summarize.no_api_key', { requestId: input.requestId });
    return {
      summary: buildFallbackSummary(request, messages),
      model_name: 'unconfigured',
      provider_used: 'unavailable',
      prompt_version: PROMPT_VERSION,
    };
  }

  log('info', 'elsa.summarize.start', { requestId: input.requestId });

  const response = await llmClient.complete({
    prompt: buildPrompt(request, threadText),
    expectJsonResponse: false,
    temperature: 0.2,
  });

  if (response === null) {
    log('error', 'elsa.summarize.llm_null', { requestId: input.requestId });
    return {
      summary: buildFallbackSummary(request, messages),
      model_name: 'unknown',
      provider_used: 'unavailable',
      prompt_version: PROMPT_VERSION,
    };
  }

  try {
    const parsed = extractJsonFromText(response.text);
    const summary = parseSummaryPayload(parsed);
    if (!summary) {
      log('error', 'elsa.summarize.schema_invalid', {
        requestId: input.requestId,
        sample: JSON.stringify(parsed).slice(0, 400),
      });
      return {
        summary: buildFallbackSummary(request, messages),
        model_name: response.model,
        provider_used: 'unavailable',
        prompt_version: PROMPT_VERSION,
      };
    }
    log('info', 'elsa.summarize.ok', {
      requestId: input.requestId,
      model: response.model,
      latencyMs: response.latencyMs,
    });
    return {
      summary,
      model_name: response.model,
      provider_used: 'remote',
      prompt_version: PROMPT_VERSION,
    };
  } catch (e) {
    log('error', 'elsa.summarize.parse_error', {
      requestId: input.requestId,
      message: e instanceof Error ? e.message : String(e),
    });
    return {
      summary: buildFallbackSummary(request, messages),
      model_name: response.model,
      provider_used: 'unavailable',
      prompt_version: PROMPT_VERSION,
    };
  }
}
