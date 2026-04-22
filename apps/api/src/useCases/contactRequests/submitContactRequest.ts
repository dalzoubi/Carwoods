import { insertContactRequest, type ContactRequestRow } from '../../lib/contactRequestsRepo.js';
import { validationError } from '../../domain/errors.js';
import { logWarn } from '../../lib/serverLogger.js';
import { sendResendEmail } from '../../lib/resendClient.js';
import { listActiveAdminNotificationRecipients } from '../../lib/usersRepo.js';
import {
  RECAPTCHA_MIN_SCORE,
  isRecaptchaSecretConfigured,
  verifyRecaptcha,
} from '../../lib/recaptcha.js';
import type { InvocationContext } from '@azure/functions';

const VALID_SUBJECTS = new Set([
  'GENERAL',
  'RENTER',
  'PROPERTY_OWNER',
  'PORTAL_SAAS',
  'PAID_SUBSCRIPTION',
]);

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<import('../../lib/db.js').QueryResult<T>> };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendAdminAlert(
  db: Queryable,
  row: ContactRequestRow,
  context?: InvocationContext
): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_EMAIL_FROM) return;

  let recipients: string[];
  try {
    const admins = await listActiveAdminNotificationRecipients(db);
    recipients = [
      ...new Set(
        admins.map((a) => (a.email ?? '').trim().toLowerCase()).filter((e) => e.length > 0)
      ),
    ];
  } catch (err) {
    logWarn(context, 'contact.admin_alert.recipients_failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (recipients.length === 0) return;

  const bodyText = [
    `New contact form submission:`,
    ``,
    `Name: ${row.name}`,
    `Email: ${row.email}`,
    `Phone: ${row.phone ?? 'not provided'}`,
    `Subject: ${row.subject}`,
    ``,
    `Message:`,
    row.message,
    ``,
    `Submitted: ${row.created_at}`,
    `View in portal: ${process.env.PORTAL_BASE_URL ?? 'https://carwoods.com'}/portal/inbox/contact`,
  ].join('\n');

  try {
    await sendResendEmail({
      to: recipients,
      subject: `[Carwoods] New contact request from ${row.name} (${row.subject})`,
      text: bodyText,
      replyTo: row.email,
    });
  } catch (err) {
    logWarn(context, 'contact.admin_alert.failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    // Non-blocking — don't fail the request if alert fails
  }
}

export async function submitContactRequest(
  db: Queryable,
  params: {
    name: string;
    email: string;
    phone?: string | null;
    subject: string;
    message: string;
    recaptchaToken?: string | null;
    ipAddress?: string | null;
  },
  context?: InvocationContext
): Promise<ContactRequestRow> {
  const name = (params.name ?? '').trim();
  const email = (params.email ?? '').trim().toLowerCase();
  const phone = (params.phone ?? '').trim() || null;
  const subject = (params.subject ?? '').trim().toUpperCase();
  const message = (params.message ?? '').trim();
  const recaptchaToken = params.recaptchaToken ?? null;

  if (!name) throw validationError('name_required');
  if (!email || !isValidEmail(email)) throw validationError('invalid_email');
  if (!message) throw validationError('message_required');
  if (!VALID_SUBJECTS.has(subject)) throw validationError('invalid_subject');

  let recaptchaScore: number | null = null;

  if (isRecaptchaSecretConfigured()) {
    if (!recaptchaToken) {
      throw validationError('recaptcha_required');
    }
    recaptchaScore = await verifyRecaptcha(recaptchaToken, context, 'contact_form');
    if (recaptchaScore === null || recaptchaScore < RECAPTCHA_MIN_SCORE) {
      throw validationError('recaptcha_failed');
    }
  } else if (recaptchaToken) {
    recaptchaScore = await verifyRecaptcha(recaptchaToken, context, 'contact_form');
    if (recaptchaScore !== null && recaptchaScore < RECAPTCHA_MIN_SCORE) {
      throw validationError('recaptcha_failed');
    }
  }

  const row = await insertContactRequest(db, {
    name,
    email,
    phone,
    subject,
    message,
    recaptchaScore,
    ipAddress: params.ipAddress ?? null,
  });

  // Fire-and-forget admin alert
  sendAdminAlert(db, row, context).catch(() => {});

  return row;
}
