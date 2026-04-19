import type { InvocationContext } from '@azure/functions';
import { getPool, hasDatabaseUrl } from './db.js';
import {
  listQueuedDeliveries,
  markDeliverySent,
  markDeliveryFailed,
  type QueuedDeliveryRow,
} from './notificationRepo.js';
import { buildNotificationContent } from './notificationDispatch.js';
import { writeAudit } from './auditRepo.js';
import { logInfo, logWarn } from './serverLogger.js';
import { sendResendEmail } from './resendClient.js';
import { sendTelnyxSms, TelnyxNotConfiguredError } from './telnyxClient.js';

export type ProcessNotificationDeliveryBatchResult = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
};

function notificationChannelsEnabled(): { email: boolean; sms: boolean } {
  const raw = (process.env.NOTIFICATION_CHANNELS ?? 'email').trim().toLowerCase();
  if (raw === 'both') return { email: true, sms: true };
  if (raw === 'sms') return { email: false, sms: true };
  return { email: true, sms: false };
}

function parseOutboxPayload(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parsePayloadJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildEmailContent(
  row: QueuedDeliveryRow
): { subject: string; plainText: string; replyTo?: string } {
  const override = parsePayloadJson(row.payload_json);
  if (override?.subject && (override?.body || override?.body_text)) {
    return {
      subject: String(override.subject),
      plainText: String(override.body_text ?? override.body),
    };
  }

  const eventTypeCode = row.event_type_code ?? row.template_id?.replace(/^EMAIL:|^SMS:/, '') ?? 'UNKNOWN';
  const payload = parseOutboxPayload(row.outbox_payload);
  const content = buildNotificationContent(eventTypeCode, payload, null);

  const portalBase = process.env.PORTAL_BASE_URL ?? 'https://carwoods.com';
  const deepLinkLine = content.deepLink ? `\nView in portal: ${portalBase}${content.deepLink}` : '';

  const result: { subject: string; plainText: string; replyTo?: string } = {
    subject: `[Carwoods] ${content.title}`,
    plainText: `${content.body}${deepLinkLine}\n`,
  };

  if (eventTypeCode.toUpperCase() === 'CONTACT_REQUEST_CREATED') {
    const contactEmail = typeof payload.email === 'string' ? payload.email.trim() : '';
    if (contactEmail) result.replyTo = contactEmail;
  }

  return result;
}

function buildSmsBody(row: QueuedDeliveryRow): string {
  const override = parsePayloadJson(row.payload_json);
  if (override?.body) return String(override.body);

  const eventTypeCode = row.event_type_code ?? row.template_id?.replace(/^EMAIL:|^SMS:/, '') ?? 'UNKNOWN';
  const payload = parseOutboxPayload(row.outbox_payload);
  const content = buildNotificationContent(eventTypeCode, payload, null);

  const portalBase = process.env.PORTAL_BASE_URL ?? 'https://carwoods.com';
  const link = content.deepLink ? ` ${portalBase}${content.deepLink}` : '';
  return `Carwoods: ${content.body}${link}`.slice(0, 160);
}

async function sendEmail(
  recipientEmail: string,
  emailContent: { subject: string; plainText: string; replyTo?: string }
): Promise<string | null> {
  return sendResendEmail({
    to: recipientEmail,
    subject: emailContent.subject,
    text: emailContent.plainText,
    replyTo: emailContent.replyTo,
  });
}

async function sendSms(
  recipientPhone: string,
  body: string,
  context: InvocationContext
): Promise<string | null> {
  try {
    return await sendTelnyxSms({ to: recipientPhone, text: body });
  } catch (err) {
    if (err instanceof TelnyxNotConfiguredError) {
      logWarn(context, 'delivery.sms.skipped', {
        reason: err.message,
        phone: recipientPhone,
      });
      return null;
    }
    throw err;
  }
}

export async function processNotificationDeliveryBatch(
  context: InvocationContext,
  options: { limit: number; auditActorUserId: string }
): Promise<ProcessNotificationDeliveryBatchResult> {
  if (!hasDatabaseUrl()) {
    return { attempted: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const pool = getPool();
  const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.min(200, options.limit)) : 50;
  const queued = await listQueuedDeliveries(pool, safeLimit);
  const channels = notificationChannelsEnabled();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of queued) {
    const isEmail = row.template_id?.startsWith('EMAIL:');
    const isSms = row.template_id?.startsWith('SMS:');

    if (isEmail && !channels.email) {
      skipped += 1;
      continue;
    }
    if (isSms && !channels.sms) {
      skipped += 1;
      continue;
    }

    const client = await pool.connect();
    try {
      let providerMessageId: string | null = null;

      if (isEmail) {
        const emailContent = buildEmailContent(row);
        providerMessageId = await sendEmail(row.recipient_email, emailContent);
      } else if (isSms) {
        const smsBody = buildSmsBody(row);
        providerMessageId = await sendSms(row.recipient_email, smsBody, context);
        if (providerMessageId === null) {
          await client.query('BEGIN');
          await markDeliveryFailed(client, row.id, 'sms_not_configured');
          await client.query('COMMIT');
          skipped += 1;
          continue;
        }
      } else {
        skipped += 1;
        continue;
      }

      await client.query('BEGIN');
      await markDeliverySent(client, row.id, providerMessageId);
      await writeAudit(client, {
        actorUserId: options.auditActorUserId,
        entityType: 'NOTIFICATION_DELIVERY',
        entityId: row.id,
        action: 'SENT',
        before: null,
        after: {
          template_id: row.template_id,
          recipient: row.recipient_email,
          provider_message_id: providerMessageId,
        },
      });
      await client.query('COMMIT');
      sent += 1;
    } catch (error) {
      try {
        await client.query('BEGIN');
        await markDeliveryFailed(
          client,
          row.id,
          error instanceof Error ? error.message : 'send_failed'
        );
        await writeAudit(client, {
          actorUserId: options.auditActorUserId,
          entityType: 'NOTIFICATION_DELIVERY',
          entityId: row.id,
          action: 'SEND_FAILED',
          before: null,
          after: {
            template_id: row.template_id,
            recipient: row.recipient_email,
            error: error instanceof Error ? error.message : 'send_failed',
          },
        });
        await client.query('COMMIT');
      } catch (inner) {
        await client.query('ROLLBACK');
        logWarn(context, 'delivery.mark_failed.error', {
          deliveryId: row.id,
          message: inner instanceof Error ? inner.message : String(inner),
        });
      }
      failed += 1;
    } finally {
      client.release();
    }
  }

  if (queued.length > 0) {
    logInfo(context, 'delivery.batch_complete', {
      attempted: queued.length,
      sent,
      failed,
      skipped,
    });
  }

  return { attempted: queued.length, sent, failed, skipped };
}
