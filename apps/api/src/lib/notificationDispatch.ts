import type { QueryResult } from './db.js';
import type { PoolClient } from './db.js';
import {
  createPortalNotification,
  portalNotificationExistsForOutboxRecipient,
  type PortalNotificationRow,
} from './notificationCenterRepo.js';
import {
  insertNotificationDelivery,
  notificationDeliveryExistsForOutboxRecipient,
  type NotificationOutboxRow,
} from './notificationRepo.js';
import {
  getRequestNotificationScope,
  listRequestNotificationRecipients,
  type RequestNotificationRecipient,
} from './requestsRepo.js';
import { resolveNotificationPolicy, getUserQuietHoursPreference } from './notificationPolicyRepo.js';
import { listActiveAdminNotificationRecipients } from './usersRepo.js';
import { Role } from '../domain/constants.js';
import {
  isChannelInCooldown,
  touchNotificationChannelCooldown,
} from './notificationCooldownRepo.js';
import { isQuietHoursNow, estimateResumeAfterQuietHours } from './notificationQuietHours.js';
import type { NotificationDispatchAiBundle } from './notificationAiEnrichment.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

type DispatchRecipient = {
  userId: string;
  email: string | null;
  phone: string | null;
  role: string;
};

type NotificationContent = {
  title: string;
  body: string;
  deepLink: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
};

function normalizeRole(role: string | null | undefined): string {
  return String(role ?? '').trim().toUpperCase();
}

function isManagementRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === Role.ADMIN || normalized === Role.LANDLORD || normalized === Role.AI_AGENT;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asRequestId(payload: Record<string, unknown>): string | null {
  return asString(payload.request_id);
}

function maintenanceBodyFromAi(
  baseBody: string,
  aiBundle: NotificationDispatchAiBundle | null,
  urgentLabel: string
): string {
  if (!aiBundle) return baseBody;
  const prefix =
    aiBundle.emergency || aiBundle.urgent ? `${urgentLabel} ` : '';
  return `${prefix}${aiBundle.summary160}`.trim() || baseBody;
}

function buildNotificationContent(
  eventTypeCode: string,
  payload: Record<string, unknown>,
  aiBundle: NotificationDispatchAiBundle | null
): NotificationContent {
  const requestId = asRequestId(payload);
  const requestTitle = asString(payload.title) ?? 'Maintenance request';
  const link = requestId ? `/portal/requests?id=${encodeURIComponent(requestId)}` : null;
  const normalizedEvent = eventTypeCode.trim().toUpperCase();
  const urgentLabel = aiBundle?.emergency ? '[Emergency]' : '[Urgent]';

  if (normalizedEvent === 'SECURITY_NOTIFICATION_DELIVERY_FAILURE') {
    const summary =
      asString(payload.summary)
      ?? 'A notification could not be delivered after repeated attempts.';
    return {
      title: 'Delivery failure alert',
      body: summary,
      deepLink: '/portal',
      requestId: null,
      metadata: { kind: 'security_notification_delivery_failure' },
    };
  }

  if (normalizedEvent === 'ACCOUNT_ONBOARDED_WELCOME') {
    return {
      title: 'Welcome to Carwoods Portal',
      body: 'Your account is ready. Sign in to review your profile and active requests.',
      deepLink: '/portal',
      requestId: null,
      metadata: { kind: 'onboarding_welcome' },
    };
  }

  if (normalizedEvent === 'ACCOUNT_EMAIL_VERIFICATION') {
    return {
      title: 'Verify your email',
      body: 'Please verify your email address to finish onboarding.',
      deepLink: '/portal/profile',
      requestId: null,
      metadata: { kind: 'onboarding_email_verification' },
    };
  }

  if (normalizedEvent === 'REQUEST_CREATED') {
    return {
      title: 'New maintenance request',
      body: maintenanceBodyFromAi(
        `A new maintenance request was created: ${requestTitle}.`,
        aiBundle,
        urgentLabel
      ),
      deepLink: link,
      requestId,
      metadata: { kind: 'request_created' },
    };
  }

  if (normalizedEvent === 'REQUEST_UPDATED') {
    return {
      title: 'Maintenance request updated',
      body: maintenanceBodyFromAi(
        `A maintenance request has new updates: ${requestTitle}.`,
        aiBundle,
        urgentLabel
      ),
      deepLink: link,
      requestId,
      metadata: { kind: 'request_updated' },
    };
  }

  if (normalizedEvent === 'REQUEST_INTERNAL_NOTE') {
    return {
      title: 'Internal request note',
      body: 'A new internal note was added to a maintenance request.',
      deepLink: link,
      requestId,
      metadata: { kind: 'request_internal_note' },
    };
  }

  if (normalizedEvent === 'LANDLORD_MESSAGE_POSTED') {
    return {
      title: 'New request message',
      body: maintenanceBodyFromAi('There is a new message on a maintenance request.', aiBundle, urgentLabel),
      deepLink: link,
      requestId,
      metadata: { kind: 'landlord_message_posted' },
    };
  }

  return {
    title: 'New request message',
    body: maintenanceBodyFromAi('There is a new message on a maintenance request.', aiBundle, urgentLabel),
    deepLink: link,
    requestId,
    metadata: { kind: 'request_message' },
  };
}

async function resolveRecipientsForEvent(
  db: Queryable,
  eventTypeCode: string,
  payload: Record<string, unknown>
): Promise<DispatchRecipient[]> {
  const normalizedEvent = eventTypeCode.trim().toUpperCase();

  if (normalizedEvent === 'SECURITY_NOTIFICATION_DELIVERY_FAILURE') {
    const admins = await listActiveAdminNotificationRecipients(db);
    return admins.map((row) => ({
      userId: row.user_id,
      email: row.email,
      phone: row.phone,
      role: row.role,
    }));
  }

  if (normalizedEvent === 'ACCOUNT_ONBOARDED_WELCOME' || normalizedEvent === 'ACCOUNT_EMAIL_VERIFICATION') {
    const userId = asString(payload.user_id);
    const email = asString(payload.email);
    const phone = asString(payload.phone);
    const role = asString(payload.role) ?? Role.TENANT;
    if (!userId) return [];
    return [{ userId, email, phone, role }];
  }

  const requestId = asRequestId(payload);
  if (!requestId) return [];
  const senderUserId = asString(payload.sender_user_id);
  const recipients = await listRequestNotificationRecipients(db, requestId);
  if (!recipients.length) return [];

  if (normalizedEvent === 'REQUEST_INTERNAL_NOTE') {
    return recipients
      .filter((row) => row.is_management)
      .map((row) => ({
        userId: row.user_id,
        email: row.email,
        phone: row.phone,
        role: row.role,
      }));
  }

  if (normalizedEvent === 'REQUEST_MESSAGE_CREATED' && senderUserId) {
    const sender = recipients.find((row) => row.user_id === senderUserId);
    if (!sender) {
      return recipients.map((row) => ({
        userId: row.user_id,
        email: row.email,
        phone: row.phone,
        role: row.role,
      }));
    }

    const senderIsManagement = isManagementRole(sender.role);
    return recipients
      .filter((row) => row.user_id !== senderUserId)
      .filter((row) => (senderIsManagement ? !row.is_management : row.is_management))
      .map((row) => ({
        userId: row.user_id,
        email: row.email,
        phone: row.phone,
        role: row.role,
      }));
  }

  return recipients.map((row) => ({
    userId: row.user_id,
    email: row.email,
    phone: row.phone,
    role: row.role,
  }));
}

function dedupeRecipients(recipients: DispatchRecipient[]): DispatchRecipient[] {
  const seen = new Set<string>();
  const out: DispatchRecipient[] = [];
  for (const recipient of recipients) {
    if (seen.has(recipient.userId)) continue;
    seen.add(recipient.userId);
    out.push(recipient);
  }
  return out;
}

function cooldownRequestId(content: NotificationContent, outboxId: string): string {
  if (content.requestId) return content.requestId;
  /** Per-outbox for non-thread events so distinct onboarding notifications are not merged. */
  return outboxId;
}

async function enqueueChannelDeliveries(
  client: PoolClient,
  outboxId: string,
  recipient: DispatchRecipient,
  templateId: string,
  channels: { emailEnabled: boolean; smsEnabled: boolean },
  options: {
    now: Date;
    quietHoursPref: Awaited<ReturnType<typeof getUserQuietHoursPreference>>;
    smsUrgentBypass: boolean;
  }
): Promise<void> {
  const inQuiet = isQuietHoursNow(options.now, options.quietHoursPref);
  const deferSms = inQuiet && !options.smsUrgentBypass;
  const smsResume = deferSms ? estimateResumeAfterQuietHours(options.now, options.quietHoursPref) : options.now;

  if (channels.emailEnabled && recipient.email) {
    await insertNotificationDelivery(client, {
      outboxId,
      recipientTarget: recipient.email,
      templateId: `EMAIL:${templateId}`,
      status: 'QUEUED',
      scheduledSendAt: null,
    });
  }
  if (channels.smsEnabled && recipient.phone) {
    await insertNotificationDelivery(client, {
      outboxId,
      recipientTarget: recipient.phone,
      templateId: `SMS:${templateId}`,
      status: 'QUEUED',
      scheduledSendAt: deferSms ? smsResume : null,
    });
  }
}

export async function dispatchOutboxNotification(
  client: PoolClient,
  row: NotificationOutboxRow,
  aiBundle: NotificationDispatchAiBundle | null,
  clock: { now: Date } = { now: new Date() }
): Promise<{ createdInApp: number; queuedDeliveries: number }> {
  const payload = toRecord(row.payload);
  const recipients = dedupeRecipients(
    await resolveRecipientsForEvent(client, row.event_type_code, payload)
  );
  const content = buildNotificationContent(row.event_type_code, payload, aiBundle);
  let requestScope: { request_id: string; property_id: string | null } | null = null;
  if (content.requestId) {
    requestScope = await getRequestNotificationScope(client, content.requestId);
  }

  const smsUrgentBypass = Boolean(aiBundle?.smsUrgentBypass);

  let createdInApp = 0;
  let queuedDeliveries = 0;

  for (const recipient of recipients) {
    const channels = await resolveNotificationPolicy(client, {
      userId: recipient.userId,
      eventTypeCode: row.event_type_code,
      requestId: requestScope?.request_id ?? content.requestId ?? null,
      propertyId: requestScope?.property_id ?? asString(payload.property_id),
    });

    const quietPref = await getUserQuietHoursPreference(client, recipient.userId);
    const requestKey = cooldownRequestId(content, row.id);

    if (channels.inAppEnabled) {
      const alreadyInApp = await portalNotificationExistsForOutboxRecipient(client, {
        userId: recipient.userId,
        outboxId: row.id,
      });
      if (!alreadyInApp) {
        const inCooldown = await isChannelInCooldown(client, {
          userId: recipient.userId,
          requestId: requestKey,
          channel: 'IN_APP',
          now: clock.now,
        });
        if (!inCooldown) {
          const created: PortalNotificationRow = await createPortalNotification(client, {
            userId: recipient.userId,
            eventTypeCode: row.event_type_code,
            title: content.title,
            body: content.body,
            deepLink: content.deepLink,
            requestId: content.requestId,
            metadata: {
              ...content.metadata,
              outbox_id: row.id,
              role: recipient.role,
              ai_summary: aiBundle?.summary160 ?? null,
              ai_urgent: Boolean(aiBundle?.urgent || aiBundle?.emergency),
            },
          });
          if (created.id) {
            createdInApp += 1;
            await touchNotificationChannelCooldown(client, {
              userId: recipient.userId,
              requestId: requestKey,
              channel: 'IN_APP',
              firedAt: clock.now,
            });
          }
        }
      }
    }

    const before = await client.query<{ count_value: number }>(
      `SELECT COUNT(*) AS count_value FROM notification_deliveries WHERE outbox_id = $1`,
      [row.id]
    );

    if (channels.emailEnabled && recipient.email) {
      const emailTemplateId = `EMAIL:${row.event_type_code}`;
      const alreadyEmail = await notificationDeliveryExistsForOutboxRecipient(client, {
        outboxId: row.id,
        recipientTarget: recipient.email,
        templateId: emailTemplateId,
      });
      if (!alreadyEmail) {
        const inCooldown = await isChannelInCooldown(client, {
          userId: recipient.userId,
          requestId: requestKey,
          channel: 'EMAIL',
          now: clock.now,
        });
        if (!inCooldown) {
          await insertNotificationDelivery(client, {
            outboxId: row.id,
            recipientTarget: recipient.email,
            templateId: emailTemplateId,
            status: 'QUEUED',
            scheduledSendAt: null,
          });
          await touchNotificationChannelCooldown(client, {
            userId: recipient.userId,
            requestId: requestKey,
            channel: 'EMAIL',
            firedAt: clock.now,
          });
        }
      }
    }

    if (channels.smsEnabled && recipient.phone) {
      const smsTemplateId = `SMS:${row.event_type_code}`;
      const alreadySms = await notificationDeliveryExistsForOutboxRecipient(client, {
        outboxId: row.id,
        recipientTarget: recipient.phone,
        templateId: smsTemplateId,
      });
      if (!alreadySms) {
        const inCooldown = await isChannelInCooldown(client, {
          userId: recipient.userId,
          requestId: requestKey,
          channel: 'SMS',
          now: clock.now,
        });
        if (!inCooldown) {
          await enqueueChannelDeliveries(client, row.id, recipient, row.event_type_code, {
            emailEnabled: false,
            smsEnabled: true,
          }, { now: clock.now, quietHoursPref: quietPref, smsUrgentBypass });
          await touchNotificationChannelCooldown(client, {
            userId: recipient.userId,
            requestId: requestKey,
            channel: 'SMS',
            firedAt: clock.now,
          });
        }
      }
    }

    const after = await client.query<{ count_value: number }>(
      `SELECT COUNT(*) AS count_value FROM notification_deliveries WHERE outbox_id = $1`,
      [row.id]
    );
    const beforeCount = Number(before.rows[0]?.count_value ?? 0);
    const afterCount = Number(after.rows[0]?.count_value ?? 0);
    queuedDeliveries += Math.max(0, afterCount - beforeCount);
  }

  return { createdInApp, queuedDeliveries };
}
