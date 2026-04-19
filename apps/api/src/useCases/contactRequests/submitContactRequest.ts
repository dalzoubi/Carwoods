import { insertContactRequest, type ContactRequestRow } from '../../lib/contactRequestsRepo.js';
import { validationError } from '../../domain/errors.js';
import { logError, logWarn } from '../../lib/serverLogger.js';
import { sendResendEmail } from '../../lib/resendClient.js';
import type { InvocationContext } from '@azure/functions';

const VALID_SUBJECTS = new Set([
  'GENERAL',
  'RENTER',
  'PROPERTY_OWNER',
  'PORTAL_SAAS',
  'PAID_SUBSCRIPTION',
]);
const RECAPTCHA_MIN_SCORE = 0.3;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function verifyRecaptcha(
  token: string,
  context?: InvocationContext
): Promise<number | null> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    logWarn(context, 'contact.recaptcha.skipped', { reason: 'no_secret_key' });
    return null; // dev mode — skip
  }
  try {
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
    });
    const data = (await resp.json()) as { success: boolean; score?: number };
    if (!data.success) {
      logWarn(context, 'contact.recaptcha.failed', { success: false });
      return 0;
    }
    return data.score ?? 1;
  } catch (err) {
    logError(context, 'contact.recaptcha.error', {
      message: err instanceof Error ? err.message : String(err),
    });
    return null; // network error — allow through rather than hard fail
  }
}

async function sendAdminAlert(
  row: ContactRequestRow,
  context?: InvocationContext
): Promise<void> {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) return;
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_EMAIL_FROM) return;

  try {
    await sendResendEmail({
      to: adminEmail,
      subject: `[Carwoods] New contact request from ${row.name} (${row.subject})`,
      text: [
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
      ].join('\n'),
    });
  } catch (err) {
    logWarn(context, 'contact.admin_alert.failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    // Non-blocking — don't fail the request if alert fails
  }
}

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<import('../../lib/db.js').QueryResult<T>> };

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

  const recaptchaSecretConfigured = Boolean(process.env.RECAPTCHA_SECRET_KEY?.trim());
  let recaptchaScore: number | null = null;

  if (recaptchaSecretConfigured) {
    if (!recaptchaToken) {
      throw validationError('recaptcha_required');
    }
    recaptchaScore = await verifyRecaptcha(recaptchaToken, context);
    if (recaptchaScore === null || recaptchaScore < RECAPTCHA_MIN_SCORE) {
      throw validationError('recaptcha_failed');
    }
  } else if (recaptchaToken) {
    recaptchaScore = await verifyRecaptcha(recaptchaToken, context);
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
  sendAdminAlert(row, context).catch(() => {});

  return row;
}
