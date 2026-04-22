import type { InvocationContext } from '@azure/functions';
import { logError, logWarn } from './serverLogger.js';

/** Minimum reCAPTCHA v3 score required to consider a submission legitimate. */
export const RECAPTCHA_MIN_SCORE = 0.3;

/**
 * Verify a reCAPTCHA v3 token with Google. Returns the assigned score, or
 * `null` when verification was skipped (no secret configured) or a transient
 * error occurred. Caller decides how strict to be based on the return value.
 */
export async function verifyRecaptcha(
  token: string,
  context?: InvocationContext,
  action?: string
): Promise<number | null> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    logWarn(context, 'recaptcha.skipped', { reason: 'no_secret_key', action });
    return null;
  }
  try {
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
    });
    const data = (await resp.json()) as {
      success: boolean;
      score?: number;
      action?: string;
    };
    if (!data.success) {
      logWarn(context, 'recaptcha.failed', { success: false, action });
      return 0;
    }
    if (action && data.action && data.action !== action) {
      logWarn(context, 'recaptcha.action_mismatch', {
        expected: action,
        received: data.action,
      });
      return 0;
    }
    return data.score ?? 1;
  } catch (err) {
    logError(context, 'recaptcha.error', {
      message: err instanceof Error ? err.message : String(err),
      action,
    });
    return null;
  }
}

export function isRecaptchaSecretConfigured(): boolean {
  return Boolean(process.env.RECAPTCHA_SECRET_KEY?.trim());
}
