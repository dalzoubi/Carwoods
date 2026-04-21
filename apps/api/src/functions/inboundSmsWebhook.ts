/**
 * Inbound SMS webhook — STOP / HELP keyword handling.
 *
 * Telnyx (and other carriers) deliver keyword replies to this endpoint. We
 * match against the CTIA-required keyword set and:
 *   - on any STOP variant: persist an opt-out on the matched user and send
 *     the canonical confirmation reply
 *   - on HELP / INFO: send the canonical help reply (no state change)
 *   - anything else: log-and-ack; the portal does not accept keyword-based
 *     opt-in, so we never persist opt-in state from inbound traffic.
 *
 * Integration notes (see docs/portal/sms-opt-in-compliance.md):
 *   - Telnyx Messaging Profile must POST inbound.received events to
 *     {FUNCTION_HOST}/api/public/inbound-sms with header
 *     `x-carwoods-sms-ingest-secret: $INBOUND_SMS_INGEST_SECRET`.
 *   - STOP auto-replies are typically sent by the carrier, but this handler
 *     still sends a branded confirmation so behaviour is consistent when
 *     the provider doesn't auto-reply.
 *   - If your carrier handles STOP / HELP entirely at the network level,
 *     this handler acts as a defensive backstop and audit log.
 */

import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { corsHeadersForRequest } from '../lib/corsHeaders.js';
import { getPool, hasDatabaseUrl } from '../lib/db.js';
import { logInfo, logWarn } from '../lib/serverLogger.js';
import { safeErrorResponseBody } from '../lib/safeErrorResponse.js';
import { findUserByPhoneDigits } from '../lib/usersRepo.js';
import {
  ensureUserNotificationPreference,
  updateUserNotificationPreference,
} from '../lib/notificationPolicyRepo.js';
import { writeAudit } from '../lib/auditRepo.js';
import { sendTelnyxSms, TelnyxNotConfiguredError } from '../lib/telnyxClient.js';
import {
  isSmsHelpKeyword,
  isSmsStopKeyword,
  SMS_HELP_REPLY,
  SMS_STOP_REPLY,
} from '../domain/smsConsent.js';

const INBOUND_SMS_SOURCE = 'INBOUND_SMS_KEYWORD';

function jsonResponse(
  status: number,
  headers: Record<string, string>,
  body: unknown
): HttpResponseInit {
  return {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    jsonBody: safeErrorResponseBody(status, body),
  };
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim() : undefined;
}

/**
 * Extracts `from`, `to`, `text` from a variety of inbound webhook shapes
 * (Telnyx v2, generic { from, to, text }, Event Grid wrapped arrays, etc.).
 */
export function parseInboundSmsPayload(raw: unknown): {
  from: string | null;
  to: string | null;
  text: string | null;
} {
  let root: Record<string, unknown> = asRecord(raw);
  if (Array.isArray(raw) && raw[0] && typeof raw[0] === 'object') {
    root = asRecord(raw[0]);
  }
  const data = asRecord(root.data);
  const payload = asRecord(data.payload ?? root.payload);
  const merged = { ...root, ...data, ...payload };

  // Telnyx v2 shape: { data: { payload: { from: { phone_number }, to: [{ phone_number }], text } } }
  const fromObj = asRecord(merged.from);
  const toList = Array.isArray(merged.to) ? merged.to : [];
  const toFirst = asRecord(toList[0]);

  const from =
    str(fromObj.phone_number)
    ?? str(merged.from)
    ?? str(merged.sender)
    ?? null;
  const to =
    str(toFirst.phone_number)
    ?? (typeof merged.to === 'string' ? String(merged.to).trim() : null)
    ?? str(merged.toNumber)
    ?? null;
  const text =
    str(merged.text)
    ?? str(merged.body)
    ?? str(merged.message)
    ?? null;

  return { from, to, text };
}

async function inboundSmsWebhookHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const headers = corsHeadersForRequest(request);
  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  const secret = process.env.INBOUND_SMS_INGEST_SECRET?.trim();
  if (!secret) {
    logWarn(context, 'inbound.sms.ingest.disabled', { reason: 'missing_secret' });
    return jsonResponse(503, headers, { error: 'ingest_unconfigured' });
  }
  const provided = request.headers.get('x-carwoods-sms-ingest-secret')?.trim();
  if (provided !== secret) {
    logWarn(context, 'inbound.sms.ingest.unauthorized', {});
    return jsonResponse(401, headers, { error: 'unauthorized' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }

  const { from, text } = parseInboundSmsPayload(body);
  if (!from || !text) {
    return jsonResponse(400, headers, { error: 'missing_from_or_text' });
  }

  const keyword = text.trim().toUpperCase();
  const isStop = isSmsStopKeyword(keyword);
  const isHelp = isSmsHelpKeyword(keyword);

  if (!isStop && !isHelp) {
    logInfo(context, 'inbound.sms.non_keyword', { from });
    return jsonResponse(200, headers, { ok: true, action: 'ignored' });
  }

  if (isHelp) {
    await replyOrLog(from, SMS_HELP_REPLY, context);
    logInfo(context, 'inbound.sms.help_replied', { from });
    return jsonResponse(200, headers, { ok: true, action: 'help_replied' });
  }

  // STOP path: persist opt-out + audit, then send canonical confirmation.
  if (!hasDatabaseUrl()) {
    await replyOrLog(from, SMS_STOP_REPLY, context);
    logWarn(context, 'inbound.sms.stop.no_db', { from });
    return jsonResponse(200, headers, { ok: true, action: 'stop_replied_no_db' });
  }

  const pool = getPool();
  const user = await findUserByPhoneDigits(pool, from);
  if (!user) {
    await replyOrLog(from, SMS_STOP_REPLY, context);
    logInfo(context, 'inbound.sms.stop.no_user', { from });
    return jsonResponse(200, headers, { ok: true, action: 'stop_replied_no_user' });
  }

  const prior = await ensureUserNotificationPreference(pool, user.id);
  await updateUserNotificationPreference(pool, {
    userId: user.id,
    smsEnabled: false,
    smsOptIn: false,
    smsOptOutCapture: {
      source: INBOUND_SMS_SOURCE,
    },
  });
  await writeAudit(pool, {
    actorUserId: user.id,
    entityType: 'USER_NOTIFICATION_PREFERENCE',
    entityId: user.id,
    action: 'SMS_OPT_IN_DISABLED',
    before: { sms_opt_in: prior.sms_opt_in, sms_enabled: prior.sms_enabled },
    after: { sms_opt_in: false, sms_enabled: false, source: INBOUND_SMS_SOURCE, keyword },
  });

  await replyOrLog(from, SMS_STOP_REPLY, context);
  logInfo(context, 'inbound.sms.stop.opt_out', { userId: user.id });
  return jsonResponse(200, headers, { ok: true, action: 'stop_opt_out' });
}

async function replyOrLog(
  to: string,
  text: string,
  context: InvocationContext
): Promise<void> {
  try {
    await sendTelnyxSms({ to, text });
  } catch (err) {
    if (err instanceof TelnyxNotConfiguredError) {
      logWarn(context, 'inbound.sms.reply.skipped', {
        reason: err.message,
      });
      return;
    }
    logWarn(context, 'inbound.sms.reply.failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

app.http('inboundSmsWebhook', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'public/inbound-sms',
  handler: inboundSmsWebhookHandler,
});

export { inboundSmsWebhookHandler };
