/**
 * Update the authenticated user's own profile.
 *
 * Business rules:
 * - Email is required and must be valid.
 * - Optional fields: first_name, last_name, phone.
 * - SMS opt-in requires an explicit, audited consent capture (see
 *   `smsOptInConsent`). A phone change while previously opted-in invalidates
 *   the prior consent and resets sms_opt_in / sms_enabled to false. Any
 *   re-enable must come with a fresh consent capture from the portal.
 */

import { findUserByEmail, updateUserProfile, updateUserUiPreferences, type UserRow } from '../../lib/usersRepo.js';
import {
  ensureUserNotificationPreference,
  updateUserNotificationPreference,
  listUserNotificationFlowPreferences,
  upsertUserNotificationFlowPreference,
  type UserNotificationPreferenceRow,
  type UserNotificationFlowPreferenceRow,
  type SmsConsentCapture,
} from '../../lib/notificationPolicyRepo.js';
import { normalizeQuietHoursPreference } from '../../lib/notificationQuietHours.js';
import { getFlowDefault } from '../../config/notificationFlowDefaults.js';
import { validateProfileUpdate } from '../../domain/userValidation.js';
import { conflictError, notFound, validationError } from '../../domain/errors.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { SMS_OPT_IN_SOURCE_WEB_PORTAL, SMS_OPT_IN_VERSION } from '../../domain/smsConsent.js';
import type { Queryable } from '../types.js';

export type UpdateProfileInput = {
  actorUserId: string;
  actorRole: string;
  email: string | undefined;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  uiLanguage?: string | null;
  uiColorScheme?: string | null;
  /** When present (hasOwnProperty), persisted via `updateUserUiPreferences`. */
  portalTourCompleted?: boolean;
  notificationPreferences?: {
    emailEnabled?: boolean;
    inAppEnabled?: boolean;
    smsEnabled?: boolean;
    smsOptIn?: boolean;
    quietHours?: {
      timezone?: string | null;
      startMinute?: number | null;
      endMinute?: number | null;
    };
  };
  /**
   * Explicit SMS consent confirmation captured from the web portal. Required
   * when transitioning sms_opt_in from false → true. Must be present exactly
   * when the user confirmed the consent dialog and clicked save.
   *
   * `source` defaults to WEB_PORTAL_PROFILE when caller omits it.
   * `version` defaults to the current SMS_OPT_IN_VERSION.
   */
  smsOptInConsent?: {
    source?: string;
    version?: string;
    ip?: string | null;
    userAgent?: string | null;
  };
  /**
   * Per-flow channel preferences. Each entry overrides the compile-time
   * default for one event type. `null` on a channel means "clear the
   * override back to the flow default".
   */
  notificationFlowPreferences?: Array<{
    eventTypeCode: string;
    emailEnabled?: boolean | null;
    inAppEnabled?: boolean | null;
    smsEnabled?: boolean | null;
  }>;
};

export type UpdateProfileOutput = {
  user: UserRow;
  notificationPreferences: UserNotificationPreferenceRow;
  notificationFlowPreferences: UserNotificationFlowPreferenceRow[];
  /** True when the phone number change invalidated a prior SMS opt-in. */
  phoneChangeInvalidatedSmsConsent: boolean;
};

function normalizePhoneForCompare(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/[^\d+]/g, '').trim();
}

export async function updateProfile(
  db: Queryable,
  input: UpdateProfileInput
): Promise<UpdateProfileOutput> {
  const requestedSmsEnabled = Boolean(input.notificationPreferences?.smsEnabled);
  const requestedSmsOptIn = Boolean(input.notificationPreferences?.smsOptIn);
  const normalizedPhone = String(input.phone ?? '').trim();
  if ((requestedSmsEnabled || requestedSmsOptIn) && !normalizedPhone) {
    throw validationError('sms_phone_required');
  }

  const validation = validateProfileUpdate({
    email: input.email,
    firstName: input.firstName ?? undefined,
    lastName: input.lastName ?? undefined,
    phone: input.phone ?? undefined,
  });
  if (!validation.valid) throw validationError(validation.message);

  const existingByEmail = await findUserByEmail(db, input.email!);
  if (existingByEmail && existingByEmail.id !== input.actorUserId) {
    throw conflictError('email_already_in_use');
  }

  // Snapshot prior preferences so we can detect opt-in/out transitions and
  // phone-change re-consent requirements. `ensureUserNotificationPreference`
  // idempotently creates the row so a new user has a baseline.
  const priorPrefs = await ensureUserNotificationPreference(db, input.actorUserId);
  const priorPhone = existingByEmail?.phone ?? null;
  const phoneChanged =
    normalizePhoneForCompare(priorPhone) !== normalizePhoneForCompare(input.phone ?? null);
  const phoneChangeInvalidatedSmsConsent =
    phoneChanged && priorPrefs.sms_opt_in === true;

  let updated: UserRow | null;
  try {
    updated = await updateUserProfile(db, input.actorUserId, {
      email: input.email!,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
    });
  } catch (error) {
    // Handles race conditions when another request claims the email first.
    const message = String((error as { message?: string })?.message ?? '').toLowerCase();
    if (message.includes('duplicate') || message.includes('unique')) {
      throw conflictError('email_already_in_use');
    }
    throw error;
  }

  if (!updated) throw notFound();

  const hasUiLanguage = Object.prototype.hasOwnProperty.call(input, 'uiLanguage');
  const hasUiColorScheme = Object.prototype.hasOwnProperty.call(input, 'uiColorScheme');
  const hasPortalTourCompleted = Object.prototype.hasOwnProperty.call(input, 'portalTourCompleted');
  if (hasUiLanguage || hasUiColorScheme || hasPortalTourCompleted) {
    const withPrefs = await updateUserUiPreferences(db, input.actorUserId, {
      ...(hasUiLanguage ? { uiLanguage: input.uiLanguage ?? null } : {}),
      ...(hasUiColorScheme ? { uiColorScheme: input.uiColorScheme ?? null } : {}),
      ...(hasPortalTourCompleted ? { portalTourCompleted: input.portalTourCompleted } : {}),
    });
    if (withPrefs) updated = withPrefs;
  }

  // Compute final notification-preferences update taking the phone-change
  // re-consent rule into account. A new phone number invalidates the prior
  // consent, so even if the client sent sms_opt_in = true we ignore it unless
  // the client also supplied fresh `smsOptInConsent` capture from the
  // consent dialog.
  const hasFreshConsentCapture = Boolean(input.smsOptInConsent);
  const hadPriorOptIn = priorPrefs.sms_opt_in === true;
  const effectiveSmsOptIn =
    requestedSmsOptIn
    && (!phoneChanged || hasFreshConsentCapture);
  const effectiveSmsEnabled = requestedSmsEnabled && effectiveSmsOptIn;

  const capture: SmsConsentCapture | undefined =
    (!hadPriorOptIn || phoneChangeInvalidatedSmsConsent)
    && effectiveSmsOptIn
    && hasFreshConsentCapture
      ? {
          source: input.smsOptInConsent?.source ?? SMS_OPT_IN_SOURCE_WEB_PORTAL,
          version: input.smsOptInConsent?.version ?? SMS_OPT_IN_VERSION,
          phone: normalizedPhone,
          ip: input.smsOptInConsent?.ip ?? null,
          userAgent: input.smsOptInConsent?.userAgent ?? null,
        }
      : undefined;

  const optOutCapture =
    hadPriorOptIn && !effectiveSmsOptIn
      ? { source: SMS_OPT_IN_SOURCE_WEB_PORTAL }
      : undefined;

  const notificationPreferences = input.notificationPreferences
    ? await updateUserNotificationPreference(db, {
        userId: input.actorUserId,
        emailEnabled: input.notificationPreferences.emailEnabled,
        inAppEnabled: input.notificationPreferences.inAppEnabled,
        smsEnabled: effectiveSmsEnabled,
        smsOptIn: effectiveSmsOptIn,
        quietHours:
          input.notificationPreferences.quietHours === undefined
            ? undefined
            : normalizeQuietHoursPreference(input.notificationPreferences.quietHours),
        smsOptInCapture: capture,
        smsOptOutCapture: optOutCapture,
      })
    : priorPrefs;

  // Audit log for consent state transitions (best-effort — any failure here
  // must not roll back a successful profile update, so errors are caught and
  // logged as audit_failed rows via the normal logger outside this function).
  if (capture) {
    await writeAudit(db, {
      actorUserId: input.actorUserId,
      entityType: 'USER_NOTIFICATION_PREFERENCE',
      entityId: input.actorUserId,
      action: 'SMS_OPT_IN_ENABLED',
      before: {
        sms_opt_in: priorPrefs.sms_opt_in,
        sms_enabled: priorPrefs.sms_enabled,
        phone: priorPhone,
      },
      after: {
        sms_opt_in: true,
        sms_enabled: effectiveSmsEnabled,
        phone: normalizedPhone,
        source: capture.source,
        version: capture.version,
        ip: capture.ip ?? null,
        user_agent: capture.userAgent ?? null,
      },
    });
  }
  if (optOutCapture) {
    await writeAudit(db, {
      actorUserId: input.actorUserId,
      entityType: 'USER_NOTIFICATION_PREFERENCE',
      entityId: input.actorUserId,
      action: 'SMS_OPT_IN_DISABLED',
      before: {
        sms_opt_in: priorPrefs.sms_opt_in,
        sms_enabled: priorPrefs.sms_enabled,
      },
      after: {
        sms_opt_in: false,
        sms_enabled: false,
        source: optOutCapture.source,
      },
    });
  }
  if (phoneChangeInvalidatedSmsConsent) {
    await writeAudit(db, {
      actorUserId: input.actorUserId,
      entityType: 'USER_NOTIFICATION_PREFERENCE',
      entityId: input.actorUserId,
      action: 'SMS_OPT_IN_PHONE_CHANGE_RESET',
      before: {
        sms_opt_in: priorPrefs.sms_opt_in,
        phone: priorPhone,
      },
      after: {
        sms_opt_in: effectiveSmsOptIn,
        phone: normalizedPhone,
        re_consent_required: !effectiveSmsOptIn,
      },
    });
  }

  if (Array.isArray(input.notificationFlowPreferences)) {
    for (const entry of input.notificationFlowPreferences) {
      const code = String(entry?.eventTypeCode ?? '').trim().toUpperCase();
      const flowDefault = getFlowDefault(code);
      if (!flowDefault) throw validationError('unknown_event_type_code');
      if (!flowDefault.userOverridable) throw validationError('flow_not_user_overridable');
      await upsertUserNotificationFlowPreference(db, {
        userId: input.actorUserId,
        eventTypeCode: code,
        emailEnabled: entry.emailEnabled,
        inAppEnabled: entry.inAppEnabled,
        smsEnabled: entry.smsEnabled,
      });
    }
  }
  const notificationFlowPreferences = await listUserNotificationFlowPreferences(
    db,
    input.actorUserId
  );

  return {
    user: updated,
    notificationPreferences,
    notificationFlowPreferences,
    phoneChangeInvalidatedSmsConsent,
  };
}
