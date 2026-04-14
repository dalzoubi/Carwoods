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

/** In-app / email deep link to the requests page with optional focus targets (hl* = highlight). */
function portalRequestsDeepLink(
  requestId: string,
  focus: { messageId?: string | null; attachmentId?: string | null; decisionId?: string | null } = {}
): string {
  const params = new URLSearchParams();
  params.set('id', requestId);
  const mid = asString(focus.messageId);
  const aid = asString(focus.attachmentId);
  const did = asString(focus.decisionId);
  if (mid) params.set('hlMsg', mid);
  if (aid) params.set('hlAtt', aid);
  if (did) params.set('hlDec', did);
  return `/portal/requests?${params.toString()}`;
}

function deepLinkForPayload(
  requestId: string | null,
  payload: Record<string, unknown>,
  focus: 'none' | 'message' | 'attachment' | 'decision'
): string | null {
  if (!requestId) return null;
  if (focus === 'message') {
    return portalRequestsDeepLink(requestId, { messageId: asString(payload.message_id) });
  }
  if (focus === 'attachment') {
    return portalRequestsDeepLink(requestId, { attachmentId: asString(payload.attachment_id) });
  }
  if (focus === 'decision') {
    return portalRequestsDeepLink(requestId, { decisionId: asString(payload.decision_id) });
  }
  return portalRequestsDeepLink(requestId);
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

function displayRequestTitle(payload: Record<string, unknown>): string {
  const raw = asString(payload.title)?.trim();
  return raw && raw.length > 0 ? raw : 'Maintenance request';
}

function contentForRequestMessageCreated(
  payload: Record<string, unknown>,
  requestTitle: string,
  aiBundle: NotificationDispatchAiBundle | null,
  urgentLabel: string
): Pick<NotificationContent, 'title' | 'body' | 'metadata'> {
  const senderRole = normalizeRole(asString(payload.sender_role));
  const messageSource = (asString(payload.message_source) ?? 'PORTAL').trim().toUpperCase();

  if (senderRole === Role.TENANT) {
    if (messageSource === 'EMAIL_REPLY') {
      return {
        title: 'Tenant replied by email',
        body: maintenanceBodyFromAi(
          `The tenant sent a new reply by email on "${requestTitle}".`,
          aiBundle,
          urgentLabel
        ),
        metadata: { kind: 'request_message_tenant_email' },
      };
    }
    return {
      title: 'Tenant replied',
      body: maintenanceBodyFromAi(
        `The tenant posted a new message on "${requestTitle}".`,
        aiBundle,
        urgentLabel
      ),
      metadata: { kind: 'request_message_tenant_portal' },
    };
  }

  if (senderRole === Role.LANDLORD || senderRole === Role.ADMIN) {
    const who =
      senderRole === Role.ADMIN
        ? 'An administrator'
        : 'Your property manager';
    return {
      title: 'Message from management',
      body: maintenanceBodyFromAi(
        `${who} posted a new message on "${requestTitle}".`,
        aiBundle,
        urgentLabel
      ),
      metadata: { kind: 'request_message_management' },
    };
  }

  return {
    title: 'New request message',
    body: maintenanceBodyFromAi(
      `Someone posted a new message on "${requestTitle}".`,
      aiBundle,
      urgentLabel
    ),
    metadata: { kind: 'request_message' },
  };
}

function buildNotificationContent(
  eventTypeCode: string,
  payload: Record<string, unknown>,
  aiBundle: NotificationDispatchAiBundle | null
): NotificationContent {
  const requestId = asRequestId(payload);
  const requestTitle = displayRequestTitle(payload);
  const linkNone = () => deepLinkForPayload(requestId, payload, 'none');
  const linkMessage = () => deepLinkForPayload(requestId, payload, 'message');
  const linkAttachment = () => deepLinkForPayload(requestId, payload, 'attachment');
  const linkDecision = () => deepLinkForPayload(requestId, payload, 'decision');
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

  if (normalizedEvent === 'ACCOUNT_LANDLORD_CREATED') {
    const email =
      asString(payload.landlord_email)
      ?? asString(payload.email)
      ?? 'unknown';
    const first = asString(payload.first_name);
    const last = asString(payload.last_name);
    const name = [first, last].filter(Boolean).join(' ').trim();
    const display = name || email;
    const source = (asString(payload.source) ?? 'SELF_REGISTRATION').trim().toUpperCase();
    const body =
      source === 'ADMIN_INVITE'
        ? `An administrator created a new landlord account for ${display} (${email}).`
        : `A landlord self-registered in the portal: ${display} (${email}).`;
    return {
      title: 'New landlord account',
      body,
      deepLink: '/portal/admin/landlords',
      requestId: null,
      metadata: {
        kind: 'landlord_account_created',
        landlord_user_id: asString(payload.landlord_user_id),
        source: source.toLowerCase(),
      },
    };
  }

  if (normalizedEvent === 'REQUEST_CREATED') {
    return {
      title: 'New maintenance request',
      body: maintenanceBodyFromAi(
        `A tenant submitted a new maintenance request: "${requestTitle}".`,
        aiBundle,
        urgentLabel
      ),
      deepLink: linkNone(),
      requestId,
      metadata: { kind: 'request_created' },
    };
  }

  if (normalizedEvent === 'REQUEST_UPDATED') {
    const waitingAfterAi = Boolean(payload.waiting_on_tenant_after_ai);
    const statusChanged = Boolean(payload.status_changed);
    if (waitingAfterAi) {
      return {
        title: 'Waiting for your reply',
        body: maintenanceBodyFromAi(
          `Your maintenance request "${requestTitle}" was updated and is waiting for your response.`,
          aiBundle,
          urgentLabel
        ),
        deepLink: linkNone(),
        requestId,
        metadata: { kind: 'request_updated_waiting_on_tenant_ai' },
      };
    }
    if (statusChanged) {
      return {
        title: 'Request status updated',
        body: maintenanceBodyFromAi(
          `The status of "${requestTitle}" was updated.`,
          aiBundle,
          urgentLabel
        ),
        deepLink: linkNone(),
        requestId,
        metadata: { kind: 'request_updated_status' },
      };
    }
    return {
      title: 'Maintenance request updated',
      body: maintenanceBodyFromAi(
        `Details were updated for "${requestTitle}".`,
        aiBundle,
        urgentLabel
      ),
      deepLink: linkNone(),
      requestId,
      metadata: { kind: 'request_updated' },
    };
  }

  if (normalizedEvent === 'REQUEST_CANCELLED') {
    return {
      title: 'Request cancelled by tenant',
      body: maintenanceBodyFromAi(
        `The tenant cancelled the maintenance request "${requestTitle}".`,
        aiBundle,
        urgentLabel
      ),
      deepLink: linkNone(),
      requestId,
      metadata: { kind: 'request_cancelled' },
    };
  }

  if (normalizedEvent === 'REQUEST_ATTACHMENT_ADDED') {
    const uploaderRole = normalizeRole(asString(payload.uploader_role));
    const who =
      uploaderRole === Role.TENANT
        ? 'The tenant'
        : uploaderRole === Role.LANDLORD || uploaderRole === Role.ADMIN
          ? 'Your team'
          : 'Someone';
    return {
      title: 'New attachment on request',
      body: maintenanceBodyFromAi(
        `${who} added a photo or file to "${requestTitle}".`,
        aiBundle,
        urgentLabel
      ),
      deepLink: linkAttachment(),
      requestId,
      metadata: { kind: 'request_attachment_added' },
    };
  }

  if (normalizedEvent === 'REQUEST_STATUS_CHANGED') {
    const reason =
      asString(payload.reason)
      ?? 'Elsa blocked an automatic reply and needs a management review.';
    const severity = (asString(payload.severity) ?? '').trim().toUpperCase();
    const isUrgent = severity === 'URGENT';
    return {
      title: isUrgent ? 'Urgent: Elsa needs review' : 'Elsa needs review',
      body: maintenanceBodyFromAi(
        `${reason} Request: "${requestTitle}".`,
        aiBundle,
        urgentLabel
      ),
      deepLink: linkNone(),
      requestId,
      metadata: { kind: 'request_status_changed_elsa_alert' },
    };
  }

  if (normalizedEvent === 'REQUEST_ELSA_REVIEW_PENDING') {
    const decisionId = asString(payload.decision_id);
    return {
      title: 'Elsa draft needs review',
      body: maintenanceBodyFromAi(
        `The maintenance assistant (Elsa) drafted a tenant reply on "${requestTitle}" and is waiting for a landlord or administrator to review and send it.`,
        aiBundle,
        urgentLabel
      ),
      deepLink: linkDecision(),
      requestId,
      metadata: {
        kind: 'elsa_review_pending',
        ...(decisionId ? { decision_id: decisionId } : {}),
      },
    };
  }

  if (normalizedEvent === 'REQUEST_INTERNAL_NOTE') {
    return {
      title: 'Internal note added',
      body: `A team member added an internal note (not visible to the tenant) on "${requestTitle}".`,
      deepLink: linkMessage(),
      requestId,
      metadata: { kind: 'request_internal_note' },
    };
  }

  if (normalizedEvent === 'REQUEST_MESSAGE_CREATED') {
    const part = contentForRequestMessageCreated(payload, requestTitle, aiBundle, urgentLabel);
    return {
      ...part,
      deepLink: linkMessage(),
      requestId,
    };
  }

  if (normalizedEvent === 'REQUEST_TENANT_AI_REPLY') {
    const replyKind = (asString(payload.reply_kind) ?? 'AUTO').trim().toUpperCase();
    if (replyKind === 'REVIEW_APPROVED') {
      return {
        title: 'New reply on your request',
        body: maintenanceBodyFromAi(
          `Your management team sent a new reply on "${requestTitle}". Open the request to read the full message.`,
          aiBundle,
          urgentLabel
        ),
        deepLink: linkMessage(),
        requestId,
        metadata: { kind: 'tenant_ai_reply_review_approved' },
      };
    }
    return {
      title: 'New assistant reply',
      body: maintenanceBodyFromAi(
        `The maintenance assistant (Elsa) posted a new reply on "${requestTitle}". Open the request to read the full message.`,
        aiBundle,
        urgentLabel
      ),
      deepLink: linkMessage(),
      requestId,
      metadata: { kind: 'tenant_ai_reply_auto' },
    };
  }

  if (normalizedEvent === 'LANDLORD_MESSAGE_POSTED') {
    const source = (asString(payload.source) ?? '').trim().toUpperCase();
    const isElsaAuto = source === 'ELSA_AUTO_SENT' || source === 'SYSTEM';
    if (isElsaAuto) {
      return {
        title: 'AI assistant replied',
        body: maintenanceBodyFromAi(
          `Elsa (AI) posted an automatic reply to the tenant on "${requestTitle}".`,
          aiBundle,
          urgentLabel
        ),
        deepLink: linkMessage(),
        requestId,
        metadata: { kind: 'landlord_message_elsa_auto' },
      };
    }
    return {
      title: 'New team message',
      body: maintenanceBodyFromAi(
        `Someone on the management team posted a message on "${requestTitle}".`,
        aiBundle,
        urgentLabel
      ),
      deepLink: linkMessage(),
      requestId,
      metadata: { kind: 'landlord_message_posted' },
    };
  }

  return {
    title: 'Portal notification',
    body: maintenanceBodyFromAi(
      requestId
        ? `There is an update on "${requestTitle}".`
        : 'You have a new portal notification.',
      aiBundle,
      urgentLabel
    ),
    deepLink: linkNone(),
    requestId,
    metadata: { kind: 'generic' },
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

  if (normalizedEvent === 'ACCOUNT_LANDLORD_CREATED') {
    const admins = await listActiveAdminNotificationRecipients(db);
    return admins.map((row) => ({
      userId: row.user_id,
      email: row.email,
      phone: row.phone,
      role: row.role,
    }));
  }

  const requestId = asRequestId(payload);
  if (!requestId) return [];
  const senderUserId = asString(payload.sender_user_id);
  const uploaderUserId = asString(payload.uploader_user_id);
  const recipients = await listRequestNotificationRecipients(db, requestId);
  if (!recipients.length) return [];

  if (normalizedEvent === 'REQUEST_CREATED' || normalizedEvent === 'REQUEST_CANCELLED') {
    return recipients
      .filter((row) => row.is_management)
      .map((row) => ({
        userId: row.user_id,
        email: row.email,
        phone: row.phone,
        role: row.role,
      }));
  }

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

  if (normalizedEvent === 'REQUEST_STATUS_CHANGED') {
    return recipients
      .filter((row) => row.is_management)
      .map((row) => ({
        userId: row.user_id,
        email: row.email,
        phone: row.phone,
        role: row.role,
      }));
  }

  if (normalizedEvent === 'REQUEST_ELSA_REVIEW_PENDING') {
    return recipients
      .filter((row) => row.is_management)
      .map((row) => ({
        userId: row.user_id,
        email: row.email,
        phone: row.phone,
        role: row.role,
      }));
  }

  if (normalizedEvent === 'REQUEST_UPDATED' && Boolean(payload.waiting_on_tenant_after_ai)) {
    return recipients
      .filter((row) => !row.is_management)
      .map((row) => ({
        userId: row.user_id,
        email: row.email,
        phone: row.phone,
        role: row.role,
      }));
  }

  if (normalizedEvent === 'REQUEST_TENANT_AI_REPLY') {
    return recipients
      .filter((row) => !row.is_management)
      .map((row) => ({
        userId: row.user_id,
        email: row.email,
        phone: row.phone,
        role: row.role,
      }));
  }

  if (normalizedEvent === 'LANDLORD_MESSAGE_POSTED') {
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

  if (normalizedEvent === 'REQUEST_ATTACHMENT_ADDED' && uploaderUserId) {
    const uploader = recipients.find((row) => row.user_id === uploaderUserId);
    if (!uploader) {
      return recipients.map((row) => ({
        userId: row.user_id,
        email: row.email,
        phone: row.phone,
        role: row.role,
      }));
    }
    const uploaderIsManagement = isManagementRole(uploader.role);
    return recipients
      .filter((row) => row.user_id !== uploaderUserId)
      .filter((row) => (uploaderIsManagement ? !row.is_management : row.is_management))
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
  const rid = content.requestId;
  if (!rid) {
    /** Per-outbox for non-thread events so distinct onboarding notifications are not merged. */
    return outboxId;
  }
  const kind = typeof content.metadata?.kind === 'string' ? content.metadata.kind : '';
  /** Same request can produce several tenant-facing rows in one transaction; avoid suppressing later ones. */
  if (kind === 'tenant_ai_reply_auto') return `${rid}:tenant_ai_reply_auto`;
  if (kind === 'tenant_ai_reply_review_approved') return `${rid}:tenant_ai_reply_reviewed`;
  if (kind === 'request_updated_waiting_on_tenant_ai') return `${rid}:waiting_on_tenant_after_ai`;
  if (kind === 'elsa_review_pending') {
    const did =
      typeof content.metadata?.decision_id === 'string' ? content.metadata.decision_id.trim() : '';
    return did ? `${rid}:elsa_review_pending:${did}` : `${rid}:elsa_review_pending`;
  }
  return rid;
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
              ...(asString(payload.message_id) ? { message_id: asString(payload.message_id) } : {}),
              ...(asString(payload.attachment_id) ? { attachment_id: asString(payload.attachment_id) } : {}),
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
