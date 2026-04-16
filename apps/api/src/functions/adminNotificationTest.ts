import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { requireAdmin, jsonResponse, mapDomainError } from '../lib/managementRequest.js';
import { readJsonBody } from '../lib/readBody.js';
import { isDomainError } from '../domain/errors.js';
import { insertNotificationDelivery } from '../lib/notificationRepo.js';
import { createPortalNotification } from '../lib/notificationCenterRepo.js';
import { writeAudit } from '../lib/auditRepo.js';
import { logInfo } from '../lib/serverLogger.js';
import { findUserById } from '../lib/usersRepo.js';

const EVENT_ADMIN_TEST = 'ADMIN_NOTIFICATION_TEST';
const TEMPLATE_EMAIL = 'EMAIL:ADMIN_TEST';
const TEMPLATE_SMS = 'SMS:ADMIN_TEST';

const E164_RE = /^\+[1-9]\d{7,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asOptionalTrimmed(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

type TestBody = {
  channel?: unknown;
  email?: unknown;
  phone?: unknown;
  title?: unknown;
  body?: unknown;
  /** In-app only: portal `users.id` to receive the notification (defaults to admin). */
  target_user_id?: unknown;
};

async function adminNotificationTestHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  if (request.method === 'OPTIONS') {
    return { status: 204, headers: ctx.headers };
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, ctx.headers, { error: 'method_not_allowed' });
  }

  let raw: TestBody | null;
  try {
    raw = await readJsonBody<TestBody>(request);
  } catch (e) {
    const mapped = mapDomainError(e, ctx.headers);
    if (mapped) return mapped;
    throw e;
  }
  if (!raw || typeof raw !== 'object') {
    return jsonResponse(400, ctx.headers, { error: 'invalid_json' });
  }

  const channel = String(raw.channel ?? '').trim().toLowerCase();
  if (!['in_app', 'email', 'sms'].includes(channel)) {
    return jsonResponse(400, ctx.headers, { error: 'invalid_channel' });
  }

  const title =
    asOptionalTrimmed(raw.title, 280)
    ?? (channel === 'sms' ? 'Admin SMS test' : 'Admin notification test');
  const bodyText =
    asOptionalTrimmed(raw.body, 8000)
    ?? 'This is an admin-triggered test message from the Carwoods portal.';

  let targetEmail: string | null = null;
  let targetPhone: string | null = null;
  if (channel === 'email') {
    targetEmail = asOptionalTrimmed(raw.email, 320);
    if (!targetEmail || !EMAIL_RE.test(targetEmail)) {
      return jsonResponse(400, ctx.headers, { error: 'invalid_email' });
    }
  }
  if (channel === 'sms') {
    targetPhone = asOptionalTrimmed(raw.phone, 32);
    if (!targetPhone || !E164_RE.test(targetPhone)) {
      return jsonResponse(400, ctx.headers, { error: 'invalid_phone_e164' });
    }
  }

  let inAppRecipientId: string = String(ctx.user.id).trim();
  if (channel === 'in_app') {
    const rawTarget = raw.target_user_id;
    if (rawTarget !== undefined && rawTarget !== null && String(rawTarget).trim() !== '') {
      const tid = String(rawTarget).trim();
      if (!UUID_RE.test(tid)) {
        return jsonResponse(400, ctx.headers, { error: 'invalid_target_user_id' });
      }
      inAppRecipientId = tid;
    }
  }

  const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  const pool = getPool();
  const client = await pool.connect();

  try {
    if (channel === 'in_app') {
      await client.query('BEGIN');
      const targetUser = sameId(inAppRecipientId, ctx.user.id)
        ? ctx.user
        : await findUserById(client, inAppRecipientId);
      if (!targetUser) {
        await client.query('ROLLBACK');
        return jsonResponse(400, ctx.headers, { error: 'target_user_not_found' });
      }
      const row = await createPortalNotification(client, {
        userId: targetUser.id,
        eventTypeCode: EVENT_ADMIN_TEST,
        title,
        body: bodyText,
        deepLink: '/portal/inbox/notifications',
        requestId: null,
        metadata: {
          kind: 'admin_test',
          triggered_by: ctx.user.id,
          target_user_id: targetUser.id,
        },
      });
      await writeAudit(client, {
        actorUserId: ctx.user.id,
        entityType: 'PORTAL_NOTIFICATION',
        entityId: row.id,
        action: 'ADMIN_TEST_IN_APP',
        before: null,
        after: { title, body: bodyText, recipient_user_id: targetUser.id },
      });
      await client.query('COMMIT');
      logInfo(context, 'admin.notification_test.in_app', {
        actorUserId: ctx.user.id,
        recipientUserId: targetUser.id,
        notificationId: row.id,
      });
      return jsonResponse(200, ctx.headers, {
        channel: 'in_app',
        notification_id: row.id,
        recipient_user_id: targetUser.id,
      });
    }

    if (channel === 'email' && targetEmail) {
      const acsConnStr = process.env.ACS_CONNECTION_STRING;
      if (!acsConnStr) {
        return jsonResponse(500, ctx.headers, { error: 'acs_not_configured' });
      }

      let providerMessageId: string | null = null;
      let sendError: string | null = null;
      try {
        const { EmailClient } = await import('@azure/communication-email');
        const emailClient = new EmailClient(acsConnStr);
        const sender = process.env.ACS_SENDER_ADDRESS ?? 'DoNotReply@carwoods.com';
        const poller = await emailClient.beginSend({
          senderAddress: sender,
          recipients: { to: [{ address: targetEmail }] },
          content: {
            subject: title,
            plainText: bodyText,
          },
        });
        // Poll briefly (up to ~15s) to check for immediate failures, but don't block forever
        const POLL_TIMEOUT_MS = 15_000;
        const start = Date.now();
        while (!poller.isDone() && Date.now() - start < POLL_TIMEOUT_MS) {
          await poller.poll();
          if (!poller.isDone()) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
        const result = poller.getResult();
        if (result?.status === 'Failed') {
          sendError = result.error?.message ?? 'email_send_failed';
        } else {
          providerMessageId = result?.id ?? null;
        }
      } catch (err) {
        sendError = err instanceof Error ? err.message : String(err);
      }

      const deliveryStatus = sendError ? 'FAILED' : 'SENT';
      await client.query('BEGIN');
      const delivery = await insertNotificationDelivery(client, {
        outboxId: null,
        recipientTarget: targetEmail,
        templateId: TEMPLATE_EMAIL,
        status: deliveryStatus as 'QUEUED' | 'SENT' | 'FAILED',
        providerMessageId,
        error: sendError,
        payloadJson: JSON.stringify({
          subject: title,
          body_text: bodyText,
        }),
      });
      await writeAudit(client, {
        actorUserId: ctx.user.id,
        entityType: 'NOTIFICATION_DELIVERY',
        entityId: delivery.id,
        action: sendError ? 'ADMIN_TEST_EMAIL_FAILED' : 'ADMIN_TEST_EMAIL_SENT',
        before: null,
        after: {
          recipient: targetEmail,
          template_id: TEMPLATE_EMAIL,
          provider_message_id: providerMessageId,
          error: sendError,
        },
      });
      await client.query('COMMIT');
      logInfo(context, 'admin.notification_test.email', {
        userId: ctx.user.id,
        deliveryId: delivery.id,
        status: deliveryStatus,
      });

      if (sendError) {
        return jsonResponse(502, ctx.headers, {
          channel: 'email',
          delivery_id: delivery.id,
          error: sendError,
        });
      }
      return jsonResponse(200, ctx.headers, {
        channel: 'email',
        delivery_id: delivery.id,
        sent: true,
        provider_message_id: providerMessageId,
      });
    }

    const acsConnStr = process.env.ACS_CONNECTION_STRING;
    const smsFrom = process.env.ACS_SMS_FROM_NUMBER;
    if (!acsConnStr || !smsFrom) {
      return jsonResponse(500, ctx.headers, {
        error: !acsConnStr ? 'acs_not_configured' : 'sms_from_number_not_configured',
      });
    }

    let providerMessageId: string | null = null;
    let sendError: string | null = null;
    try {
      const { SmsClient } = await import('@azure/communication-sms');
      const smsClient = new SmsClient(acsConnStr);
      const [result] = await smsClient.send({
        from: smsFrom,
        to: [targetPhone!],
        message: bodyText.slice(0, 160),
      });
      if (!result.successful) {
        sendError = result.errorMessage ?? 'sms_send_failed';
      } else {
        providerMessageId = result.messageId ?? null;
      }
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err);
    }

    const smsStatus = sendError ? 'FAILED' : 'SENT';
    await client.query('BEGIN');
    const delivery = await insertNotificationDelivery(client, {
      outboxId: null,
      recipientTarget: targetPhone!,
      templateId: TEMPLATE_SMS,
      status: smsStatus as 'QUEUED' | 'SENT' | 'FAILED',
      providerMessageId,
      error: sendError,
      payloadJson: JSON.stringify({ body: bodyText }),
    });
    await writeAudit(client, {
      actorUserId: ctx.user.id,
      entityType: 'NOTIFICATION_DELIVERY',
      entityId: delivery.id,
      action: sendError ? 'ADMIN_TEST_SMS_FAILED' : 'ADMIN_TEST_SMS_SENT',
      before: null,
      after: {
        recipient: targetPhone,
        template_id: TEMPLATE_SMS,
        provider_message_id: providerMessageId,
        error: sendError,
      },
    });
    await client.query('COMMIT');
    logInfo(context, 'admin.notification_test.sms', {
      userId: ctx.user.id,
      deliveryId: delivery.id,
      status: smsStatus,
    });

    if (sendError) {
      return jsonResponse(502, ctx.headers, {
        channel: 'sms',
        delivery_id: delivery.id,
        error: sendError,
      });
    }
    return jsonResponse(200, ctx.headers, {
      channel: 'sms',
      delivery_id: delivery.id,
      sent: true,
      provider_message_id: providerMessageId,
    });
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore if no active transaction
    }
    if (isDomainError(e)) {
      const mapped = mapDomainError(e, ctx.headers);
      if (mapped) return mapped;
    }
    logInfo(context, 'admin.notification_test.error', {
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  } finally {
    client.release();
  }
}

app.http('adminNotificationTest', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/admin/notifications/test',
  handler: adminNotificationTestHandler,
});
