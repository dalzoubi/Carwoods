import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { corsHeadersForRequest } from '../lib/corsHeaders.js';
import { logInfo, logWarn } from '../lib/serverLogger.js';
import { processInboundEmailReply } from '../useCases/requests/processInboundEmailReply.js';

function jsonResponse(
  status: number,
  headers: Record<string, string>,
  body: unknown
): HttpResponseInit {
  return {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    jsonBody: body,
  };
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim() : undefined;
}

function listStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim());
}

function parseFromAddress(fromRaw: string): string {
  const trimmed = fromRaw.trim();
  const m = trimmed.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  return trimmed;
}

/**
 * Minimal ACS / custom webhook payload. Event Grid email events can be mapped to this shape upstream.
 */
async function inboundEmailReply(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const headers = corsHeadersForRequest(request);
  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  const secret = process.env.INBOUND_EMAIL_INGEST_SECRET?.trim();
  if (!secret) {
    logWarn(context, 'inbound.email.ingest.disabled', { reason: 'missing_secret' });
    return jsonResponse(503, headers, { error: 'ingest_unconfigured' });
  }
  const provided = request.headers.get('x-carwoods-email-ingest-secret')?.trim();
  if (provided !== secret) {
    logWarn(context, 'inbound.email.ingest.unauthorized', {});
    return jsonResponse(401, headers, { error: 'unauthorized' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }

  let root: Record<string, unknown> = asRecord(body);
  if (Array.isArray(body) && body[0] && typeof body[0] === 'object') {
    root = asRecord(body[0]);
  }
  const data = asRecord(root.data);
  const merged = { ...root, ...data };

  const fromRaw =
    str(merged.from)
    ?? str(merged.sender)
    ?? str(merged.senderAddress)
    ?? str(merged.fromEmail);
  if (!fromRaw) {
    return jsonResponse(400, headers, { error: 'missing_from' });
  }

  const toList =
    listStrings(merged.to)
    .concat(listStrings(merged.recipients))
    .concat(str(merged.toAddress) ? [str(merged.toAddress)!] : []);
  if (!toList.length) {
    return jsonResponse(400, headers, { error: 'missing_to' });
  }

  const textBody =
    str(merged.text)
    ?? str(merged.plainText)
    ?? str(merged.textBody)
    ?? str(merged.bodyPlain)
    ?? '';

  const result = await processInboundEmailReply(getPool(), {
    toAddresses: toList,
    fromEmail: parseFromAddress(fromRaw),
    textBody,
  });

  if (result.ok) {
    logInfo(context, 'inbound.email.reply.accepted', {
      requestId: result.requestId,
      messageId: result.messageId,
    });
    return jsonResponse(200, headers, { ok: true, request_id: result.requestId, message_id: result.messageId });
  }

  logWarn(context, 'inbound.email.reply.rejected', {
    reason: result.reason,
    requestId: result.requestId ?? null,
  });
  return jsonResponse(422, headers, {
    ok: false,
    reason: result.reason,
    request_id: result.requestId ?? null,
  });
}

app.http('inboundEmailReply', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'public/inbound-email/reply',
  handler: inboundEmailReply,
});
