import type { QueryResult } from './db.js';
import type { PoolClient } from './db.js';
import {
  createPortalNotification,
  type PortalNotificationRow,
} from './notificationCenterRepo.js';
import { insertNotificationDelivery, type NotificationOutboxRow } from './notificationRepo.js';
import { listRequestNotificationRecipients, type RequestNotificationRecipient } from './requestsRepo.js';
import { Role } from '../domain/constants.js';

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
  const requestId = asString(payload.request_id);
  return requestId;
}

function buildNotificationContent(
  eventTypeCode: string,
  payload: Record<string, unknown>
): NotificationContent {
  const requestId = asRequestId(payload);
  const requestTitle = asString(payload.title) ?? 'Maintenance request';
  const link = requestId ? `/portal/requests?id=${encodeURIComponent(requestId)}` : null;
  const normalizedEvent = eventTypeCode.trim().toUpperCase();

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
      body: `A new maintenance request was created: ${requestTitle}.`,
      deepLink: link,
      requestId,
      metadata: { kind: 'request_created' },
    };
  }

  if (normalizedEvent === 'REQUEST_UPDATED') {
    return {
      title: 'Maintenance request updated',
      body: `A maintenance request has new updates: ${requestTitle}.`,
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

  return {
    title: 'New request message',
    body: 'There is a new message on a maintenance request.',
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

async function enqueueChannelDeliveries(
  client: PoolClient,
  outboxId: string,
  recipient: DispatchRecipient,
  templateId: string
): Promise<void> {
  if (recipient.email) {
    await insertNotificationDelivery(client, {
      outboxId,
      recipientTarget: recipient.email,
      templateId: `EMAIL:${templateId}`,
      status: 'QUEUED',
    });
  }
  if (recipient.phone) {
    await insertNotificationDelivery(client, {
      outboxId,
      recipientTarget: recipient.phone,
      templateId: `SMS:${templateId}`,
      status: 'QUEUED',
    });
  }
}

export async function dispatchOutboxNotification(
  client: PoolClient,
  row: NotificationOutboxRow
): Promise<{ createdInApp: number; queuedDeliveries: number }> {
  const payload = toRecord(row.payload);
  const recipients = dedupeRecipients(
    await resolveRecipientsForEvent(client, row.event_type_code, payload)
  );
  const content = buildNotificationContent(row.event_type_code, payload);

  let createdInApp = 0;
  let queuedDeliveries = 0;

  for (const recipient of recipients) {
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
      },
    });
    if (created.id) {
      createdInApp += 1;
    }

    const before = await client.query<{ count_value: number }>(
      `SELECT COUNT(*) AS count_value FROM notification_deliveries WHERE outbox_id = $1`,
      [row.id]
    );
    await enqueueChannelDeliveries(client, row.id, recipient, row.event_type_code);
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

