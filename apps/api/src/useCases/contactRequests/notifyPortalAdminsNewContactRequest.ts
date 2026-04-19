import type { InvocationContext } from '@azure/functions';
import { getPool } from '../../lib/db.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import type { ContactRequestRow } from '../../lib/contactRequestsRepo.js';
import { logWarn } from '../../lib/serverLogger.js';

type PortalPool = ReturnType<typeof getPool>;

/**
 * Enqueues a CONTACT_REQUEST_CREATED notification so all active portal admins
 * receive both an in-app alert and an email with the full submission details.
 */
export async function notifyPortalAdminsNewContactRequest(
  pool: PortalPool,
  row: ContactRequestRow,
  context?: InvocationContext
): Promise<void> {
  const client = await pool.connect();
  try {
    await enqueueNotification(client, {
      eventTypeCode: 'CONTACT_REQUEST_CREATED',
      payload: {
        contact_request_id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone ?? null,
        subject: row.subject,
        message: row.message,
      },
      idempotencyKey: `contact-request-created:${row.id}`,
    });
  } catch (err) {
    logWarn(context, 'contact.portal_admin_notify.failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    client.release();
  }
}
