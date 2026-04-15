import type { InvocationContext } from '@azure/functions';
import { getPool } from '../../lib/db.js';
import { createPortalNotification } from '../../lib/notificationCenterRepo.js';
import { listActiveAdminNotificationRecipients } from '../../lib/usersRepo.js';
import type { ContactRequestRow } from '../../lib/contactRequestsRepo.js';
import { logWarn } from '../../lib/serverLogger.js';

type PortalPool = ReturnType<typeof getPool>;

const SUBJECT_TITLE: Record<string, string> = {
  GENERAL: 'General Inquiry',
  RENTER: 'Renter / Applicant',
  PROPERTY_OWNER: 'Property Owner',
  PORTAL_SAAS: 'Portal / SaaS',
};

function subjectTitle(subject: string): string {
  const key = String(subject ?? '').toUpperCase();
  return SUBJECT_TITLE[key] ?? key;
}

function messagePreview(message: string, maxLen: number): string {
  const collapsed = String(message ?? '').replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLen) return collapsed;
  return `${collapsed.slice(0, maxLen)}...`;
}

/**
 * Creates an in-app notification for each active portal admin when a public
 * contact form submission is stored.
 */
export async function notifyPortalAdminsNewContactRequest(
  pool: PortalPool,
  row: ContactRequestRow,
  context?: InvocationContext
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const admins = await listActiveAdminNotificationRecipients(client);
    const title = subjectTitle(row.subject);
    const body = messagePreview(row.message, 140);
    const deepLink = `/portal/inbox/contact#${row.id}`;

    for (const admin of admins) {
      await createPortalNotification(client, {
        userId: admin.user_id,
        eventTypeCode: 'CONTACT_REQUEST_CREATED',
        title,
        body,
        deepLink,
        requestId: null,
        metadata: {
          contact_request_id: row.id,
          subject: row.subject,
        },
      });
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    logWarn(context, 'contact.portal_admin_notify.failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    client.release();
  }
}
