import type { InvocationContext } from '@azure/functions';
import { notFound, validationError, unprocessable } from '../../domain/errors.js';
import { logInfo, logWarn } from '../../lib/serverLogger.js';
import {
  getContactRequestById,
  type ContactRequestRow,
} from '../../lib/contactRequestsRepo.js';
import { listContactRequestMessages } from '../../lib/contactRequestMessagesRepo.js';
import { getLlmClient } from '../../lib/llmClientFactory.js';
import type { QueryResult } from '../../lib/db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const PROMPT_VERSION = 'contact-reply-suggest-v1';

const VALID_TONES = new Set(['friendly', 'formal', 'apologetic', 'concise']);
const VALID_LENGTHS = new Set(['short', 'medium', 'detailed']);

export type SuggestContactReplyInput = {
  contactRequestId: string;
  tone?: string;
  length?: string;
  extraContext?: string | null;
};

export type SuggestContactReplyOutput = {
  suggestion: string;
  model: string;
  prompt_version: string;
  tone: string;
  length: string;
};

const SUBJECT_DESCRIPTIONS: Record<string, string> = {
  GENERAL: 'General inquiry about Carwoods.',
  RENTER: 'From a renter or prospective tenant searching for properties.',
  PROPERTY_OWNER: 'From a property owner or landlord evaluating Carwoods.',
  PORTAL_SAAS: 'About the Carwoods portal / SaaS product.',
  PAID_SUBSCRIPTION: 'About paid plans, billing, or subscription tiers.',
};

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function parseSuggestion(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.reply !== 'string') return null;
  const s = row.reply.trim();
  if (!s) return null;
  return s.length > 4000 ? `${s.slice(0, 3997)}...` : s;
}

function buildPrompt(
  request: ContactRequestRow,
  tone: string,
  length: string,
  extraContext: string | null,
  previousThread: string
): string {
  const lengthHint =
    length === 'short'
      ? '2–4 short sentences, no more than ~60 words'
      : length === 'detailed'
        ? '3–5 short paragraphs covering context, answer, and next steps'
        : '1–2 short paragraphs, roughly 80–150 words';

  return [
    'You are a customer support assistant drafting a reply to a Contact Us message for Carwoods, a property management platform.',
    'Return ONLY one raw JSON object, no markdown:',
    '{ "reply": "string" }',
    'Rules:',
    `- Tone: ${tone}.`,
    `- Length: ${lengthHint}.`,
    '- Address the sender by first name if known; otherwise a neutral greeting.',
    '- Do not sign off with a specific agent name; leave the closing as "— Carwoods Support" or similar.',
    '- Do not invent prices, SLAs, or features that are not evident from the message.',
    '- If the question cannot be answered without more info, politely ask a targeted follow-up question.',
    '- Write plain text (no HTML, no markdown, no links unless clearly needed).',
    '',
    'Submitter:',
    JSON.stringify(
      {
        name: request.name,
        email: request.email,
        phone: request.phone,
        subject_code: request.subject,
        subject_description: SUBJECT_DESCRIPTIONS[request.subject] ?? 'General inquiry.',
      },
      null,
      2
    ),
    '',
    'Original message:',
    request.message,
    '',
    previousThread ? 'Prior thread (chronological):' : '',
    previousThread || '',
    extraContext ? `Admin notes: ${extraContext}` : '',
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');
}

export async function suggestContactReply(
  db: Queryable,
  input: SuggestContactReplyInput,
  context?: InvocationContext
): Promise<SuggestContactReplyOutput> {
  const tone = (input.tone ?? 'friendly').toLowerCase();
  const length = (input.length ?? 'medium').toLowerCase();
  if (!VALID_TONES.has(tone)) throw validationError('invalid_tone');
  if (!VALID_LENGTHS.has(length)) throw validationError('invalid_length');

  const request = await getContactRequestById(db, input.contactRequestId);
  if (!request) throw notFound();

  const messages = await listContactRequestMessages(db, input.contactRequestId);
  const previousThread = messages
    .map((m) => {
      const author = (m.author_name || m.author_email || 'admin').trim();
      const marker = m.is_internal_note ? ' [internal]' : '';
      return `[${author}${marker}] ${m.body}`;
    })
    .join('\n');

  const llmClient = getLlmClient();
  if (!llmClient) {
    logWarn(context, 'contact.reply_suggest.no_api_key', {
      contactRequestId: input.contactRequestId,
    });
    throw unprocessable('ai_not_configured');
  }

  const response = await llmClient.complete({
    prompt: buildPrompt(request, tone, length, input.extraContext ?? null, previousThread),
    expectJsonResponse: true,
    temperature: 0.4,
  });

  if (response === null) {
    logWarn(context, 'contact.reply_suggest.llm_null', {
      contactRequestId: input.contactRequestId,
    });
    throw unprocessable('ai_unavailable');
  }

  let suggestion: string | null = null;
  try {
    const parsed = extractJsonFromText(response.text);
    suggestion = parseSuggestion(parsed);
  } catch (e) {
    logWarn(context, 'contact.reply_suggest.parse_error', {
      contactRequestId: input.contactRequestId,
      message: e instanceof Error ? e.message : String(e),
    });
  }

  if (!suggestion) {
    throw unprocessable('ai_bad_response');
  }

  logInfo(context, 'contact.reply_suggest.ok', {
    contactRequestId: input.contactRequestId,
    model: response.model,
    latencyMs: response.latencyMs,
    tone,
    length,
  });

  return {
    suggestion,
    model: response.model,
    prompt_version: PROMPT_VERSION,
    tone,
    length,
  };
}
